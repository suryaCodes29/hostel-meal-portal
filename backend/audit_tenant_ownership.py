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
    Forecast,
    Hostel,
    HostelBlock,
    MealResponse,
    Menu,
    MessUnit,
    Notification,
    User,
    WasteRecord,
)


CATEGORY_ORDER = [
    "hostels",
    "hostel_blocks",
    "mess_units",
    "students",
    "staff",
    "menus",
    "meal_responses",
    "forecasts",
    "waste_records",
    "notifications",
]


class AuditReport:
    def __init__(self):
        self.stats = {
            category: {
                "correctly_owned": 0,
                "missing_ownership": 0,
                "invalid_or_orphaned": 0,
                "reassigned": 0,
            }
            for category in CATEGORY_ORDER
        }
        self.issues = []
        self.repairs = []

    def add(self, category, status, record_id, message, details=None):
        if category not in self.stats:
            raise ValueError(f"Unknown audit category: {category}")

        if status not in self.stats[category]:
            raise ValueError(f"Unknown audit status: {status}")

        self.stats[category][status] += 1

        if status in {"missing_ownership", "invalid_or_orphaned"}:
            self.issues.append(
                {
                    "category": category,
                    "status": status,
                    "record_id": record_id,
                    "message": message,
                    "details": details or {},
                }
            )

    def add_repair(self, category, record_id, message, details=None):
        self.stats[category]["reassigned"] += 1
        self.repairs.append(
            {
                "category": category,
                "record_id": record_id,
                "message": message,
                "details": details or {},
            }
        )

    def totals(self):
        result = {
            "correctly_owned": 0,
            "missing_ownership": 0,
            "invalid_or_orphaned": 0,
            "reassigned": 0,
        }

        for category in CATEGORY_ORDER:
            for key in result:
                result[key] += self.stats[category][key]

        return result

    def to_dict(self, mode, seed_manager=None):
        return {
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "mode": mode,
            "seed_manager": (
                {
                    "id": seed_manager.id,
                    "email": seed_manager.email,
                    "name": seed_manager.name,
                }
                if seed_manager
                else None
            ),
            "totals": self.totals(),
            "categories": self.stats,
            "issues": self.issues,
            "repairs": self.repairs,
        }


def normalize_text(value):
    if value is None:
        return ""
    return str(value).strip().casefold()


def get_manager(user_id):
    if not user_id:
        return None

    user = db.session.get(User, user_id)
    if not user:
        return None

    if user.role != "manager":
        return None

    return user


def get_hostel(hostel_id):
    if not hostel_id:
        return None
    return db.session.get(Hostel, hostel_id)


def get_block(block_id):
    if not block_id:
        return None
    return db.session.get(HostelBlock, block_id)


def get_mess_unit(mess_unit_id):
    if not mess_unit_id:
        return None
    return db.session.get(MessUnit, mess_unit_id)


def hostel_owner_id(hostel_id):
    hostel = get_hostel(hostel_id)
    if not hostel:
        return None

    manager = get_manager(hostel.manager_user_id)
    if not manager:
        return None

    return manager.id


def exact_hostel_matches_for_seed_manager(seed_manager, legacy_value):
    if not seed_manager or not legacy_value:
        return []

    wanted = normalize_text(legacy_value)
    if not wanted:
        return []

    matches = []
    for hostel in Hostel.query.filter_by(manager_user_id=seed_manager.id).all():
        if wanted in {
            normalize_text(hostel.name),
            normalize_text(hostel.code),
        }:
            matches.append(hostel)

    return matches


def exact_block_matches(hostel_id, legacy_value):
    if not hostel_id or not legacy_value:
        return []

    wanted = normalize_text(legacy_value)
    if not wanted:
        return []

    matches = []
    for block in HostelBlock.query.filter_by(hostel_id=hostel_id).all():
        if wanted in {
            normalize_text(block.name),
            normalize_text(block.code),
        }:
            matches.append(block)

    return matches


def exact_mess_matches(hostel_id, legacy_value):
    if not hostel_id or not legacy_value:
        return []

    wanted = normalize_text(legacy_value)
    if not wanted:
        return []

    matches = []
    for mess in MessUnit.query.filter_by(hostel_id=hostel_id).all():
        if wanted in {
            normalize_text(mess.name),
            normalize_text(mess.unit_type),
            normalize_text(f"{mess.unit_type} mess"),
        }:
            matches.append(mess)

    return matches


def audit_hostels(report):
    for hostel in Hostel.query.order_by(Hostel.id.asc()).all():
        if not hostel.manager_user_id:
            report.add(
                "hostels",
                "missing_ownership",
                hostel.id,
                "Hostel has no manager_user_id.",
                {"name": hostel.name, "code": hostel.code},
            )
            continue

        manager = db.session.get(User, hostel.manager_user_id)
        if not manager or manager.role != "manager":
            report.add(
                "hostels",
                "invalid_or_orphaned",
                hostel.id,
                "Hostel manager reference does not point to a valid Manager account.",
                {
                    "name": hostel.name,
                    "code": hostel.code,
                    "manager_user_id": hostel.manager_user_id,
                },
            )
            continue

        report.add(
            "hostels",
            "correctly_owned",
            hostel.id,
            "Hostel is owned by a valid Manager.",
        )


def audit_blocks(report):
    for block in HostelBlock.query.order_by(HostelBlock.id.asc()).all():
        if not block.hostel_id:
            report.add(
                "hostel_blocks",
                "missing_ownership",
                block.id,
                "Hostel block has no hostel_id.",
                {"name": block.name},
            )
            continue

        hostel = get_hostel(block.hostel_id)
        if not hostel or not get_manager(hostel.manager_user_id):
            report.add(
                "hostel_blocks",
                "invalid_or_orphaned",
                block.id,
                "Hostel block does not resolve to a valid Manager-owned Hostel.",
                {"hostel_id": block.hostel_id, "name": block.name},
            )
            continue

        report.add(
            "hostel_blocks",
            "correctly_owned",
            block.id,
            "Hostel block inherits valid Manager ownership from its Hostel.",
        )


def audit_mess_units(report):
    for mess in MessUnit.query.order_by(MessUnit.id.asc()).all():
        if not mess.hostel_id:
            report.add(
                "mess_units",
                "missing_ownership",
                mess.id,
                "Mess Unit has no hostel_id.",
                {"name": mess.name},
            )
            continue

        hostel = get_hostel(mess.hostel_id)
        if not hostel or not get_manager(hostel.manager_user_id):
            report.add(
                "mess_units",
                "invalid_or_orphaned",
                mess.id,
                "Mess Unit does not resolve to a valid Manager-owned Hostel.",
                {"hostel_id": mess.hostel_id, "name": mess.name},
            )
            continue

        errors = []

        if mess.block_id:
            block = get_block(mess.block_id)
            if not block:
                errors.append("block_id points to a missing Hostel Block")
            elif block.hostel_id != mess.hostel_id:
                errors.append("block_id belongs to a different Hostel")

        if mess.supervisor_user_id:
            supervisor = db.session.get(User, mess.supervisor_user_id)
            if not supervisor:
                errors.append("supervisor_user_id points to a missing User")
            elif supervisor.role != "staff":
                errors.append("supervisor_user_id does not point to Staff")
            elif supervisor.hostel_id != mess.hostel_id:
                errors.append("supervisor belongs to a different Hostel")

        if errors:
            report.add(
                "mess_units",
                "invalid_or_orphaned",
                mess.id,
                "; ".join(errors) + ".",
                {
                    "hostel_id": mess.hostel_id,
                    "block_id": mess.block_id,
                    "supervisor_user_id": mess.supervisor_user_id,
                    "name": mess.name,
                },
            )
            continue

        report.add(
            "mess_units",
            "correctly_owned",
            mess.id,
            "Mess Unit inherits valid Manager ownership from its Hostel.",
        )


def audit_portal_users(report, role):
    category = "students" if role == "student" else "staff"

    for user in User.query.filter_by(role=role).order_by(User.id.asc()).all():
        if not user.hostel_id:
            report.add(
                category,
                "missing_ownership",
                user.id,
                f"{role.title()} has no hostel_id, so Manager ownership cannot be derived safely.",
                {
                    "email": user.email,
                    "legacy_hostel": user.hostel,
                    "block_id": user.block_id,
                    "mess_unit_id": user.mess_unit_id,
                },
            )
            continue

        hostel = get_hostel(user.hostel_id)
        if not hostel or not get_manager(hostel.manager_user_id):
            report.add(
                category,
                "invalid_or_orphaned",
                user.id,
                f"{role.title()} references a missing or invalid Manager-owned Hostel.",
                {"email": user.email, "hostel_id": user.hostel_id},
            )
            continue

        errors = []

        if user.block_id:
            block = get_block(user.block_id)
            if not block:
                errors.append("block_id points to a missing Hostel Block")
            elif block.hostel_id != user.hostel_id:
                errors.append("block_id belongs to a different Hostel")

        if user.mess_unit_id:
            mess = get_mess_unit(user.mess_unit_id)
            if not mess:
                errors.append("mess_unit_id points to a missing Mess Unit")
            elif mess.hostel_id != user.hostel_id:
                errors.append("mess_unit_id belongs to a different Hostel")

        if errors:
            report.add(
                category,
                "invalid_or_orphaned",
                user.id,
                "; ".join(errors) + ".",
                {
                    "email": user.email,
                    "hostel_id": user.hostel_id,
                    "block_id": user.block_id,
                    "mess_unit_id": user.mess_unit_id,
                },
            )
            continue

        report.add(
            category,
            "correctly_owned",
            user.id,
            f"{role.title()} inherits valid Manager ownership from the assigned Hostel.",
        )


def audit_menus(report):
    for menu in Menu.query.order_by(Menu.id.asc()).all():
        if not menu.hostel_id:
            report.add(
                "menus",
                "missing_ownership",
                menu.id,
                "Menu has no hostel_id.",
            )
            continue

        hostel = get_hostel(menu.hostel_id)
        if not hostel or not get_manager(hostel.manager_user_id):
            report.add(
                "menus",
                "invalid_or_orphaned",
                menu.id,
                "Menu does not resolve to a valid Manager-owned Hostel.",
                {"hostel_id": menu.hostel_id},
            )
            continue

        errors = []
        mess = get_mess_unit(menu.mess_unit_id)

        if not mess:
            errors.append("mess_unit_id points to a missing Mess Unit")
        elif mess.hostel_id != menu.hostel_id:
            errors.append("mess_unit_id belongs to a different Hostel")

        if menu.created_by:
            creator = db.session.get(User, menu.created_by)
            if not creator:
                errors.append("created_by points to a missing User")
            elif creator.role == "manager" and creator.id != hostel.manager_user_id:
                errors.append("created_by is a different Manager than the Hostel owner")
            elif creator.role in {"student", "staff"}:
                errors.append("created_by is not a Manager account")

        if errors:
            report.add(
                "menus",
                "invalid_or_orphaned",
                menu.id,
                "; ".join(errors) + ".",
                {
                    "hostel_id": menu.hostel_id,
                    "mess_unit_id": menu.mess_unit_id,
                    "created_by": menu.created_by,
                },
            )
            continue

        report.add(
            "menus",
            "correctly_owned",
            menu.id,
            "Menu inherits valid Manager ownership from its Hostel.",
        )


def audit_meal_responses(report):
    for response in MealResponse.query.order_by(MealResponse.id.asc()).all():
        menu = db.session.get(Menu, response.menu_id)
        student = db.session.get(User, response.student_user_id)
        mess = get_mess_unit(response.mess_unit_id)

        if not menu or not student or not mess:
            report.add(
                "meal_responses",
                "invalid_or_orphaned",
                response.id,
                "Meal response references a missing Menu, Student, or Mess Unit.",
                {
                    "menu_id": response.menu_id,
                    "student_user_id": response.student_user_id,
                    "mess_unit_id": response.mess_unit_id,
                },
            )
            continue

        hostel = get_hostel(menu.hostel_id)
        if not hostel or not get_manager(hostel.manager_user_id):
            report.add(
                "meal_responses",
                "invalid_or_orphaned",
                response.id,
                "Meal response Menu does not resolve to a valid Manager-owned Hostel.",
                {"menu_id": menu.id, "hostel_id": menu.hostel_id},
            )
            continue

        errors = []

        if student.role != "student":
            errors.append("student_user_id does not point to a Student")

        if student.hostel_id != menu.hostel_id:
            errors.append("Student belongs to a different Hostel than the Menu")

        if mess.hostel_id != menu.hostel_id:
            errors.append("Mess Unit belongs to a different Hostel than the Menu")

        if menu.mess_unit_id != response.mess_unit_id:
            errors.append("Response Mess Unit does not match the Menu Mess Unit")

        if errors:
            report.add(
                "meal_responses",
                "invalid_or_orphaned",
                response.id,
                "; ".join(errors) + ".",
                {
                    "menu_id": response.menu_id,
                    "student_user_id": response.student_user_id,
                    "mess_unit_id": response.mess_unit_id,
                },
            )
            continue

        report.add(
            "meal_responses",
            "correctly_owned",
            response.id,
            "Meal response resolves consistently to one Manager-owned Hostel.",
        )


def audit_hostel_mess_records(report, model, category, date_field_name):
    for record in model.query.order_by(model.id.asc()).all():
        if not record.hostel_id:
            report.add(
                category,
                "missing_ownership",
                record.id,
                f"{category} record has no hostel_id.",
            )
            continue

        hostel = get_hostel(record.hostel_id)
        mess = get_mess_unit(record.mess_unit_id)

        if not hostel or not get_manager(hostel.manager_user_id):
            report.add(
                category,
                "invalid_or_orphaned",
                record.id,
                f"{category} record does not resolve to a valid Manager-owned Hostel.",
                {"hostel_id": record.hostel_id},
            )
            continue

        if not mess or mess.hostel_id != record.hostel_id:
            report.add(
                category,
                "invalid_or_orphaned",
                record.id,
                "Mess Unit is missing or belongs to a different Hostel.",
                {
                    "hostel_id": record.hostel_id,
                    "mess_unit_id": record.mess_unit_id,
                    date_field_name: (
                        getattr(record, date_field_name).isoformat()
                        if getattr(record, date_field_name, None)
                        else None
                    ),
                },
            )
            continue

        report.add(
            category,
            "correctly_owned",
            record.id,
            f"{category} record resolves consistently to one Manager-owned Hostel.",
        )


def audit_notifications(report):
    for notification in Notification.query.order_by(Notification.id.asc()).all():
        if not notification.manager_user_id:
            report.add(
                "notifications",
                "missing_ownership",
                notification.id,
                "Notification has no manager_user_id.",
                {"title": notification.title},
            )
            continue

        manager = db.session.get(User, notification.manager_user_id)
        if not manager or manager.role != "manager":
            report.add(
                "notifications",
                "invalid_or_orphaned",
                notification.id,
                "Notification manager_user_id does not point to a valid Manager.",
                {
                    "manager_user_id": notification.manager_user_id,
                    "title": notification.title,
                },
            )
            continue

        report.add(
            "notifications",
            "correctly_owned",
            notification.id,
            "Notification is scoped to a valid Manager.",
        )


def run_audit():
    report = AuditReport()

    audit_hostels(report)
    audit_blocks(report)
    audit_mess_units(report)
    audit_portal_users(report, "student")
    audit_portal_users(report, "staff")
    audit_menus(report)
    audit_meal_responses(report)
    audit_hostel_mess_records(
        report,
        Forecast,
        "forecasts",
        "forecast_date",
    )
    audit_hostel_mess_records(
        report,
        WasteRecord,
        "waste_records",
        "record_date",
    )
    audit_notifications(report)

    return report


def resolve_seed_manager(email):
    if not email:
        return None

    manager = (
        User.query
        .filter(db.func.lower(User.email) == email.strip().lower())
        .first()
    )

    if not manager:
        raise ValueError(
            f"No user exists with seed manager email: {email}"
        )

    if manager.role != "manager":
        raise ValueError(
            f"The selected seed account is not a Manager: {email}"
        )

    return manager


def candidate_hostels_for_unowned_user(user, seed_manager):
    candidates = []

    if user.mess_unit_id:
        mess = get_mess_unit(user.mess_unit_id)
        if mess and get_hostel(mess.hostel_id):
            candidates.append((mess.hostel_id, "mess_unit_id"))

    if user.block_id:
        block = get_block(user.block_id)
        if block and get_hostel(block.hostel_id):
            candidates.append((block.hostel_id, "block_id"))

    if seed_manager and user.hostel:
        matches = exact_hostel_matches_for_seed_manager(
            seed_manager,
            user.hostel,
        )
        if len(matches) == 1:
            candidates.append((matches[0].id, "legacy_hostel_text"))

    unique_ids = {hostel_id for hostel_id, _ in candidates}

    if len(unique_ids) != 1:
        return None, candidates

    hostel_id = next(iter(unique_ids))
    hostel = get_hostel(hostel_id)
    if not hostel:
        return None, candidates

    if seed_manager and hostel.manager_user_id != seed_manager.id:
        explicit_reference_sources = {
            source
            for _, source in candidates
            if source in {"mess_unit_id", "block_id"}
        }
        if not explicit_reference_sources:
            return None, candidates

    return hostel, candidates


def safe_fill_user_subreferences(user, hostel, repair_log):
    changed = False

    if user.block_id:
        block = get_block(user.block_id)
        if not block or block.hostel_id != hostel.id:
            return False
    elif user.hostel_block:
        block_matches = exact_block_matches(
            hostel.id,
            user.hostel_block,
        )
        if len(block_matches) == 1:
            user.block_id = block_matches[0].id
            changed = True
            repair_log.append(
                f"block_id -> {block_matches[0].id}"
            )

    if user.mess_unit_id:
        mess = get_mess_unit(user.mess_unit_id)
        if not mess or mess.hostel_id != hostel.id:
            return False
    elif user.mess_unit:
        mess_matches = exact_mess_matches(
            hostel.id,
            user.mess_unit,
        )
        if len(mess_matches) == 1:
            user.mess_unit_id = mess_matches[0].id
            changed = True
            repair_log.append(
                f"mess_unit_id -> {mess_matches[0].id}"
            )

    return changed


def repair_users(seed_manager, repair_report):
    for role, category in (("student", "students"), ("staff", "staff")):
        users = User.query.filter_by(role=role).order_by(User.id.asc()).all()

        for user in users:
            if user.hostel_id:
                hostel = get_hostel(user.hostel_id)
                if not hostel or not get_manager(hostel.manager_user_id):
                    continue

                repair_log = []
                changed = safe_fill_user_subreferences(
                    user,
                    hostel,
                    repair_log,
                )

                if changed:
                    if not user.hostel:
                        user.hostel = hostel.name

                    if user.block_id and not user.hostel_block:
                        block = get_block(user.block_id)
                        if block:
                            user.hostel_block = block.name

                    if user.mess_unit_id and not user.mess_unit:
                        mess = get_mess_unit(user.mess_unit_id)
                        if mess:
                            user.mess_unit = mess.name

                    repair_report.add_repair(
                        category,
                        user.id,
                        "Filled missing relational IDs from unambiguous legacy text within the already-owned Hostel.",
                        {
                            "email": user.email,
                            "changes": repair_log,
                            "hostel_id": hostel.id,
                        },
                    )

                continue

            hostel, candidates = candidate_hostels_for_unowned_user(
                user,
                seed_manager,
            )

            if not hostel:
                continue

            if not get_manager(hostel.manager_user_id):
                continue

            if user.block_id:
                block = get_block(user.block_id)
                if not block or block.hostel_id != hostel.id:
                    continue

            if user.mess_unit_id:
                mess = get_mess_unit(user.mess_unit_id)
                if not mess or mess.hostel_id != hostel.id:
                    continue

            old_hostel_id = user.hostel_id
            user.hostel_id = hostel.id
            user.hostel = hostel.name

            repair_log = [
                f"hostel_id {old_hostel_id!r} -> {hostel.id}"
            ]

            safe_fill_user_subreferences(
                user,
                hostel,
                repair_log,
            )

            if user.block_id:
                block = get_block(user.block_id)
                if block:
                    user.hostel_block = block.name

            if user.mess_unit_id:
                mess = get_mess_unit(user.mess_unit_id)
                if mess:
                    user.mess_unit = mess.name

            repair_report.add_repair(
                category,
                user.id,
                "Assigned missing Hostel ownership using only consistent existing references or an exact Hostel match under the explicitly selected seed Manager.",
                {
                    "email": user.email,
                    "hostel_id": hostel.id,
                    "hostel_name": hostel.name,
                    "hostel_manager_user_id": hostel.manager_user_id,
                    "candidate_sources": [
                        {
                            "hostel_id": hostel_id,
                            "source": source,
                        }
                        for hostel_id, source in candidates
                    ],
                    "changes": repair_log,
                },
            )


def print_report(report_dict):
    print("\n" + "=" * 78)
    print("TENANT OWNERSHIP AUDIT")
    print("=" * 78)
    print(f"Mode: {report_dict['mode']}")

    seed_manager = report_dict.get("seed_manager")
    if seed_manager:
        print(
            "Seed manager: "
            f"{seed_manager['name']} <{seed_manager['email']}> "
            f"(user id {seed_manager['id']})"
        )
    else:
        print("Seed manager: not selected")

    print("\nPer-category counts")
    print("-" * 78)
    print(
        f"{'Category':<20}"
        f"{'Correct':>12}"
        f"{'Missing':>12}"
        f"{'Invalid':>12}"
        f"{'Reassigned':>14}"
    )
    print("-" * 78)

    for category in CATEGORY_ORDER:
        stats = report_dict["categories"][category]
        print(
            f"{category:<20}"
            f"{stats['correctly_owned']:>12}"
            f"{stats['missing_ownership']:>12}"
            f"{stats['invalid_or_orphaned']:>12}"
            f"{stats['reassigned']:>14}"
        )

    print("-" * 78)
    totals = report_dict["totals"]
    print(
        f"{'TOTAL':<20}"
        f"{totals['correctly_owned']:>12}"
        f"{totals['missing_ownership']:>12}"
        f"{totals['invalid_or_orphaned']:>12}"
        f"{totals['reassigned']:>14}"
    )

    issues = report_dict["issues"]
    if issues:
        print("\nIssues requiring review")
        print("-" * 78)
        for issue in issues:
            print(
                f"[{issue['status']}] "
                f"{issue['category']} id={issue['record_id']}: "
                f"{issue['message']}"
            )
            if issue["details"]:
                print(
                    "  "
                    + json.dumps(
                        issue["details"],
                        sort_keys=True,
                        default=str,
                    )
                )
    else:
        print("\nNo ownership/orphan issues found.")

    repairs = report_dict["repairs"]
    if repairs:
        print("\nRepairs applied")
        print("-" * 78)
        for repair in repairs:
            print(
                f"{repair['category']} id={repair['record_id']}: "
                f"{repair['message']}"
            )
            if repair["details"]:
                print(
                    "  "
                    + json.dumps(
                        repair["details"],
                        sort_keys=True,
                        default=str,
                    )
                )

    print("=" * 78)


def write_json_report(report_dict, output_path):
    if not output_path:
        return

    path = Path(output_path).expanduser().resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            report_dict,
            indent=2,
            sort_keys=True,
            default=str,
        ),
        encoding="utf-8",
    )
    print(f"JSON audit report written to: {path}")


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Audit Manager tenant ownership in the Hostel Meal Portal. "
            "The default mode is read-only. Use --apply only for safe, "
            "deterministic Student/Staff ownership backfills."
        )
    )

    parser.add_argument(
        "--apply",
        action="store_true",
        help=(
            "Apply only deterministic Student/Staff ownership backfills. "
            "No records are deleted."
        ),
    )

    parser.add_argument(
        "--seed-manager-email",
        default=None,
        help=(
            "Explicit Manager email used only to resolve legacy text-only "
            "Hostel assignments. The script never selects a Manager implicitly."
        ),
    )

    parser.add_argument(
        "--json-report",
        default=None,
        help="Optional path for a JSON audit report.",
    )

    return parser.parse_args()


def main():
    args = parse_args()

    with app.app_context():
        try:
            seed_manager = resolve_seed_manager(
                args.seed_manager_email
            )

            if args.apply:
                before = run_audit()
                before_dict = before.to_dict(
                    mode="before-backfill",
                    seed_manager=seed_manager,
                )

                print("\nBEFORE BACKFILL")
                print_report(before_dict)

                repair_report = AuditReport()
                repair_users(
                    seed_manager,
                    repair_report,
                )

                db.session.commit()

                after = run_audit()

                for category in CATEGORY_ORDER:
                    after.stats[category]["reassigned"] = (
                        repair_report.stats[category]["reassigned"]
                    )

                after.repairs = repair_report.repairs

                final_dict = after.to_dict(
                    mode="after-backfill",
                    seed_manager=seed_manager,
                )

                print("\nAFTER BACKFILL")
                print_report(final_dict)
                write_json_report(
                    final_dict,
                    args.json_report,
                )

            else:
                report = run_audit()
                report_dict = report.to_dict(
                    mode="audit-only",
                    seed_manager=seed_manager,
                )
                print_report(report_dict)
                write_json_report(
                    report_dict,
                    args.json_report,
                )

        except ValueError as exc:
            db.session.rollback()
            print(f"ERROR: {exc}", file=sys.stderr)
            return 2

        except SQLAlchemyError as exc:
            db.session.rollback()
            print(
                "DATABASE ERROR: tenant ownership audit/backfill failed. "
                "No deletion or database reset was attempted.",
                file=sys.stderr,
            )
            print(str(exc), file=sys.stderr)
            return 3

        except Exception as exc:
            db.session.rollback()
            print(
                "UNEXPECTED ERROR: tenant ownership audit/backfill failed. "
                "The transaction was rolled back where possible.",
                file=sys.stderr,
            )
            print(str(exc), file=sys.stderr)
            return 4

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
