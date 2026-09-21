import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.exc import SQLAlchemyError

from app import app
from models import (
    db,
    Hostel,
    MealResponse,
    Menu,
    MessUnit,
    User,
)


class RepairPlan:
    def __init__(self):
        self.summary = {
            "mess_supervisors": {
                "checked": 0,
                "valid": 0,
                "planned_clear": 0,
                "applied_clear": 0,
                "unresolved": 0,
            },
            "meal_responses": {
                "checked": 0,
                "valid": 0,
                "planned_reassign": 0,
                "applied_reassign": 0,
                "unresolved": 0,
            },
        }
        self.actions = []
        self.unresolved = []
        self.backup = {
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "mess_units": [],
            "meal_responses": [],
        }

    def add_action(self, category, record_id, action, before, after, reason):
        self.actions.append(
            {
                "category": category,
                "record_id": record_id,
                "action": action,
                "reason": reason,
                "before": before,
                "after": after,
            }
        )

    def add_unresolved(self, category, record_id, reason, details=None):
        self.unresolved.append(
            {
                "category": category,
                "record_id": record_id,
                "reason": reason,
                "details": details or {},
            }
        )

    def to_dict(self, mode):
        return {
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "mode": mode,
            "summary": self.summary,
            "actions": self.actions,
            "unresolved": self.unresolved,
        }


def safe_user(user_id):
    if not user_id:
        return None
    return db.session.get(User, user_id)


def safe_hostel(hostel_id):
    if not hostel_id:
        return None
    return db.session.get(Hostel, hostel_id)


def safe_mess(mess_unit_id):
    if not mess_unit_id:
        return None
    return db.session.get(MessUnit, mess_unit_id)


def safe_menu(menu_id):
    if not menu_id:
        return None
    return db.session.get(Menu, menu_id)


def manager_for_hostel(hostel_id):
    hostel = safe_hostel(hostel_id)
    if not hostel:
        return None

    manager = safe_user(hostel.manager_user_id)
    if not manager or manager.role != "manager":
        return None

    return manager


def serialize_mess_unit(mess):
    return {
        "id": mess.id,
        "hostel_id": mess.hostel_id,
        "block_id": mess.block_id,
        "name": mess.name,
        "unit_type": mess.unit_type,
        "supervisor_user_id": mess.supervisor_user_id,
        "status": mess.status,
    }


def serialize_response(response):
    return {
        "id": response.id,
        "menu_id": response.menu_id,
        "student_user_id": response.student_user_id,
        "mess_unit_id": response.mess_unit_id,
        "response": response.response,
        "created_at": (
            response.created_at.isoformat()
            if response.created_at
            else None
        ),
        "updated_at": (
            response.updated_at.isoformat()
            if response.updated_at
            else None
        ),
    }


def serialize_menu(menu):
    if not menu:
        return None

    return {
        "id": menu.id,
        "hostel_id": menu.hostel_id,
        "mess_unit_id": menu.mess_unit_id,
        "menu_date": (
            menu.menu_date.isoformat()
            if menu.menu_date
            else None
        ),
        "meal": menu.meal,
        "meal_category": menu.meal_category,
        "status": menu.status,
    }


def serialize_user(user):
    if not user:
        return None

    return {
        "id": user.id,
        "role": user.role,
        "email": user.email,
        "hostel_id": user.hostel_id,
        "block_id": user.block_id,
        "mess_unit_id": user.mess_unit_id,
        "is_active": bool(user.is_active),
    }


def mess_supervisor_is_valid(mess):
    if not mess.supervisor_user_id:
        return True, "No supervisor assigned."

    supervisor = safe_user(mess.supervisor_user_id)
    if not supervisor:
        return False, "Supervisor user does not exist."

    if supervisor.role != "staff":
        return False, "Supervisor user is not a Staff account."

    if not supervisor.hostel_id:
        return False, "Supervisor Staff account has no Hostel assignment."

    if supervisor.hostel_id != mess.hostel_id:
        return False, "Supervisor belongs to a different Hostel."

    if supervisor.mess_unit_id and supervisor.mess_unit_id != mess.id:
        assigned_mess = safe_mess(supervisor.mess_unit_id)
        if assigned_mess and assigned_mess.hostel_id != mess.hostel_id:
            return False, "Supervisor is assigned to a Mess Unit in another Hostel."

    return True, "Supervisor is scoped to the same Hostel."


def plan_mess_supervisor_repairs(plan, apply_changes):
    rows = MessUnit.query.order_by(MessUnit.id.asc()).all()

    for mess in rows:
        plan.summary["mess_supervisors"]["checked"] += 1

        valid, reason = mess_supervisor_is_valid(mess)
        if valid:
            plan.summary["mess_supervisors"]["valid"] += 1
            continue

        before = serialize_mess_unit(mess)
        plan.backup["mess_units"].append(before)

        after = dict(before)
        after["supervisor_user_id"] = None

        plan.summary["mess_supervisors"]["planned_clear"] += 1

        plan.add_action(
            "mess_units",
            mess.id,
            "clear_invalid_supervisor",
            before,
            after,
            reason,
        )

        if apply_changes:
            mess.supervisor_user_id = None
            plan.summary["mess_supervisors"]["applied_clear"] += 1


def response_is_consistent(response):
    menu = safe_menu(response.menu_id)
    student = safe_user(response.student_user_id)
    mess = safe_mess(response.mess_unit_id)

    if not menu:
        return False, "Menu does not exist."

    if not student:
        return False, "Student user does not exist."

    if student.role != "student":
        return False, "student_user_id does not point to a Student account."

    if not mess:
        return False, "Mess Unit does not exist."

    if not manager_for_hostel(menu.hostel_id):
        return False, "Menu Hostel does not resolve to a valid Manager."

    if student.hostel_id != menu.hostel_id:
        return False, "Student belongs to a different Hostel than the Menu."

    if mess.hostel_id != menu.hostel_id:
        return False, "Response Mess Unit belongs to a different Hostel than the Menu."

    if response.mess_unit_id != menu.mess_unit_id:
        return False, "Response Mess Unit does not match the Menu Mess Unit."

    return True, "Meal Response is internally consistent."


def matching_target_menus(source_menu, student):
    if not source_menu or not student:
        return []

    if not student.hostel_id or not student.mess_unit_id:
        return []

    student_hostel = safe_hostel(student.hostel_id)
    student_mess = safe_mess(student.mess_unit_id)

    if not student_hostel:
        return []

    if not manager_for_hostel(student_hostel.id):
        return []

    if not student_mess:
        return []

    if student_mess.hostel_id != student_hostel.id:
        return []

    return (
        Menu.query
        .filter(
            Menu.hostel_id == student_hostel.id,
            Menu.mess_unit_id == student_mess.id,
            Menu.menu_date == source_menu.menu_date,
            Menu.meal == source_menu.meal,
            Menu.meal_category == source_menu.meal_category,
        )
        .order_by(Menu.id.asc())
        .all()
    )


def response_conflict_exists(response, target_menu):
    existing = (
        MealResponse.query
        .filter(
            MealResponse.menu_id == target_menu.id,
            MealResponse.student_user_id == response.student_user_id,
            MealResponse.id != response.id,
        )
        .first()
    )

    return existing


def plan_meal_response_repairs(plan, apply_changes):
    responses = MealResponse.query.order_by(MealResponse.id.asc()).all()

    for response in responses:
        plan.summary["meal_responses"]["checked"] += 1

        valid, reason = response_is_consistent(response)
        if valid:
            plan.summary["meal_responses"]["valid"] += 1
            continue

        source_menu = safe_menu(response.menu_id)
        student = safe_user(response.student_user_id)
        source_mess = safe_mess(response.mess_unit_id)

        backup_row = {
            "response": serialize_response(response),
            "source_menu": serialize_menu(source_menu),
            "student": serialize_user(student),
            "source_mess_unit": (
                serialize_mess_unit(source_mess)
                if source_mess
                else None
            ),
        }

        plan.backup["meal_responses"].append(backup_row)

        if not source_menu:
            plan.summary["meal_responses"]["unresolved"] += 1
            plan.add_unresolved(
                "meal_responses",
                response.id,
                reason,
                backup_row,
            )
            continue

        if not student or student.role != "student":
            plan.summary["meal_responses"]["unresolved"] += 1
            plan.add_unresolved(
                "meal_responses",
                response.id,
                reason,
                backup_row,
            )
            continue

        if not student.hostel_id:
            plan.summary["meal_responses"]["unresolved"] += 1
            plan.add_unresolved(
                "meal_responses",
                response.id,
                "Student has no Hostel ownership; automatic reassignment is unsafe.",
                backup_row,
            )
            continue

        if not student.mess_unit_id:
            plan.summary["meal_responses"]["unresolved"] += 1
            plan.add_unresolved(
                "meal_responses",
                response.id,
                "Student has no Mess Unit assignment; automatic reassignment is unsafe.",
                backup_row,
            )
            continue

        candidates = matching_target_menus(
            source_menu,
            student,
        )

        if len(candidates) != 1:
            plan.summary["meal_responses"]["unresolved"] += 1
            plan.add_unresolved(
                "meal_responses",
                response.id,
                (
                    "Could not find exactly one target Menu in the Student's own "
                    "Hostel/Mess Unit for the same date, meal, and category."
                ),
                {
                    **backup_row,
                    "candidate_menu_ids": [menu.id for menu in candidates],
                },
            )
            continue

        target_menu = candidates[0]

        conflict = response_conflict_exists(
            response,
            target_menu,
        )

        if conflict:
            plan.summary["meal_responses"]["unresolved"] += 1
            plan.add_unresolved(
                "meal_responses",
                response.id,
                "Target Menu already has a Meal Response for this Student.",
                {
                    **backup_row,
                    "target_menu": serialize_menu(target_menu),
                    "conflicting_response_id": conflict.id,
                },
            )
            continue

        target_mess = safe_mess(target_menu.mess_unit_id)
        if not target_mess:
            plan.summary["meal_responses"]["unresolved"] += 1
            plan.add_unresolved(
                "meal_responses",
                response.id,
                "Target Menu points to a missing Mess Unit.",
                {
                    **backup_row,
                    "target_menu": serialize_menu(target_menu),
                },
            )
            continue

        if target_mess.hostel_id != student.hostel_id:
            plan.summary["meal_responses"]["unresolved"] += 1
            plan.add_unresolved(
                "meal_responses",
                response.id,
                "Target Menu Mess Unit does not belong to the Student's Hostel.",
                {
                    **backup_row,
                    "target_menu": serialize_menu(target_menu),
                    "target_mess_unit": serialize_mess_unit(target_mess),
                },
            )
            continue

        before = serialize_response(response)
        after = dict(before)
        after["menu_id"] = target_menu.id
        after["mess_unit_id"] = target_menu.mess_unit_id

        plan.summary["meal_responses"]["planned_reassign"] += 1

        plan.add_action(
            "meal_responses",
            response.id,
            "reassign_to_students_owned_menu",
            before,
            after,
            (
                "The source response points across Hostel boundaries. A unique Menu "
                "exists in the Student's own Hostel and assigned Mess Unit for the "
                "same menu_date, meal, and meal_category."
            ),
        )

        if apply_changes:
            response.menu_id = target_menu.id
            response.mess_unit_id = target_menu.mess_unit_id
            plan.summary["meal_responses"]["applied_reassign"] += 1


def verify_post_repair_consistency():
    problems = []

    for mess in MessUnit.query.order_by(MessUnit.id.asc()).all():
        valid, reason = mess_supervisor_is_valid(mess)
        if not valid:
            problems.append(
                {
                    "category": "mess_units",
                    "record_id": mess.id,
                    "reason": reason,
                }
            )

    for response in MealResponse.query.order_by(MealResponse.id.asc()).all():
        valid, reason = response_is_consistent(response)
        if not valid:
            problems.append(
                {
                    "category": "meal_responses",
                    "record_id": response.id,
                    "reason": reason,
                }
            )

    return problems


def default_backup_path():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"tenant_integrity_backup_{timestamp}.json"


def write_json(path_value, payload):
    path = Path(path_value).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            payload,
            indent=2,
            sort_keys=True,
            default=str,
        ),
        encoding="utf-8",
    )
    return path


def print_plan(plan_dict):
    print("\n" + "=" * 86)
    print("TENANT INTEGRITY REPAIR PLAN")
    print("=" * 86)
    print(f"Mode: {plan_dict['mode']}")

    print("\nMess Unit supervisor integrity")
    print("-" * 86)
    mess = plan_dict["summary"]["mess_supervisors"]
    print(f"Checked:       {mess['checked']}")
    print(f"Valid:         {mess['valid']}")
    print(f"Planned clear: {mess['planned_clear']}")
    print(f"Applied clear: {mess['applied_clear']}")
    print(f"Unresolved:    {mess['unresolved']}")

    print("\nMeal Response integrity")
    print("-" * 86)
    responses = plan_dict["summary"]["meal_responses"]
    print(f"Checked:           {responses['checked']}")
    print(f"Valid:             {responses['valid']}")
    print(f"Planned reassign:  {responses['planned_reassign']}")
    print(f"Applied reassign:  {responses['applied_reassign']}")
    print(f"Unresolved:        {responses['unresolved']}")

    actions = plan_dict["actions"]
    if actions:
        print("\nPlanned / applied actions")
        print("-" * 86)
        for action in actions:
            print(
                f"[{action['category']}] id={action['record_id']} "
                f"{action['action']}"
            )
            print(f"  reason: {action['reason']}")
            print(
                "  before: "
                + json.dumps(action["before"], sort_keys=True, default=str)
            )
            print(
                "  after:  "
                + json.dumps(action["after"], sort_keys=True, default=str)
            )

    unresolved = plan_dict["unresolved"]
    if unresolved:
        print("\nUnresolved records")
        print("-" * 86)
        for item in unresolved:
            print(
                f"[{item['category']}] id={item['record_id']}: "
                f"{item['reason']}"
            )

    print("=" * 86)


def build_parser():
    parser = argparse.ArgumentParser(
        description=(
            "Safely repair cross-tenant integrity errors in the Hostel Meal Portal. "
            "The default mode is dry-run and does not modify the database."
        )
    )

    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply only deterministic repairs. Without this flag the script is read-only.",
    )

    parser.add_argument(
        "--backup",
        default=None,
        help=(
            "Backup JSON path. On --apply, a backup is always written before commit. "
            "If omitted, a timestamped file is created in the backend directory."
        ),
    )

    parser.add_argument(
        "--json-report",
        default=None,
        help="Optional JSON path for the repair plan/result.",
    )

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    mode = "apply" if args.apply else "dry-run"

    with app.app_context():
        plan = RepairPlan()

        try:
            plan_mess_supervisor_repairs(
                plan,
                apply_changes=args.apply,
            )

            plan_meal_response_repairs(
                plan,
                apply_changes=args.apply,
            )

            report_dict = plan.to_dict(mode)
            print_plan(report_dict)

            if args.json_report:
                report_path = write_json(
                    args.json_report,
                    report_dict,
                )
                print(f"\nJSON repair report written to: {report_path}")

            if not args.apply:
                db.session.rollback()
                print("\nDry-run complete. No database rows were modified.")
                return 0

            backup_path = args.backup or default_backup_path()
            backup_payload = {
                "generated_at_utc": datetime.now(timezone.utc).isoformat(),
                "purpose": "Pre-commit backup for deterministic tenant integrity repair.",
                "repair_plan": report_dict,
                "original_rows": plan.backup,
            }

            written_backup = write_json(
                backup_path,
                backup_payload,
            )

            print(f"\nBackup written BEFORE commit to: {written_backup}")

            unresolved_count = len(plan.unresolved)
            if unresolved_count > 0:
                db.session.rollback()
                print(
                    "\nAPPLY CANCELLED: unresolved records remain. "
                    "No database changes were committed."
                )
                print(
                    "Run the dry-run report, review the unresolved records, "
                    "and repair their source assignments before trying --apply again."
                )
                return 2

            db.session.commit()

            verification_problems = verify_post_repair_consistency()
            if verification_problems:
                print(
                    "\nWARNING: commit completed, but post-repair verification "
                    "still found integrity problems:"
                )
                for problem in verification_problems:
                    print(
                        f"  [{problem['category']}] id={problem['record_id']}: "
                        f"{problem['reason']}"
                    )
                return 3

            print("\nRepair committed successfully.")
            print("Post-repair verification found no cross-tenant integrity errors.")
            return 0

        except SQLAlchemyError as exc:
            db.session.rollback()
            print("\nDATABASE ERROR")
            print(type(exc).__name__)
            print(str(exc))
            return 1

        except Exception as exc:
            db.session.rollback()
            print("\nUNEXPECTED ERROR")
            print(type(exc).__name__)
            print(str(exc))
            return 1


if __name__ == "__main__":
    sys.exit(main())
