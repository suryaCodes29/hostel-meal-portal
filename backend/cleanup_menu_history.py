import argparse
import importlib
import json
import sys

from pathlib import Path

from sqlalchemy import inspect


# ============================================================
# BACKEND IMPORT PATH
# ============================================================

BACKEND_DIR = (
    Path(__file__)
    .resolve()
    .parent
)

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(
        0,
        str(BACKEND_DIR)
    )


from models import (
    CleanupAudit,
    db,
)

from services.menu_history_cleanup import (
    DEFAULT_BATCH_SIZE,
    DEFAULT_RETENTION_DAYS,
    MenuHistoryCleanupError,
    cleanup_old_menu_history,
)


# ============================================================
# FLASK APPLICATION LOADER
# ============================================================

def load_flask_app():
    """
    Load the existing Hostel Meal Portal Flask application.

    The cleanup command uses the application's existing
    database configuration and credentials. It does not
    contain or duplicate database credentials here.
    """

    candidates = [
        "app",
        "run",
        "main",
    ]

    errors = []

    for module_name in candidates:

        try:

            module = (
                importlib.import_module(
                    module_name
                )
            )

        except ModuleNotFoundError as error:

            if (
                error.name
                == module_name
            ):

                errors.append(
                    (
                        f"{module_name}: "
                        "module not found"
                    )
                )

                continue

            raise

        create_app = getattr(
            module,
            "create_app",
            None,
        )

        if callable(
            create_app
        ):

            app = create_app()

            if hasattr(
                app,
                "app_context",
            ):
                return app

        app = getattr(
            module,
            "app",
            None,
        )

        if (
            app is not None
            and hasattr(
                app,
                "app_context",
            )
        ):
            return app

        errors.append(
            (
                f"{module_name}: "
                "no Flask app or "
                "create_app() found"
            )
        )

    raise RuntimeError(
        (
            "Unable to load the existing Flask "
            "application.\nTried:\n- "
            + "\n- ".join(
                errors
            )
        )
    )


# ============================================================
# OUTPUT
# ============================================================

def print_heading(
    title
):

    print()

    print(
        "=" * 72
    )

    print(
        title
    )

    print(
        "=" * 72
    )


def print_json(
    value
):

    print(
        json.dumps(
            value,
            indent=2,
            default=str,
        )
    )


# ============================================================
# SCHEMA CHECK
# ============================================================

def verify_cleanup_schema():

    inspector = inspect(
        db.engine
    )

    required_tables = [
        "menus",
        "meal_responses",
        "menu_menu_items",
        "menu_notifications",
        "cleanup_audits",
    ]

    existing_tables = set(
        inspector.get_table_names()
    )

    missing_tables = [
        table_name
        for table_name
        in required_tables
        if table_name
        not in existing_tables
    ]

    if missing_tables:

        raise RuntimeError(
            (
                "Menu Management migration "
                "has not been fully applied. "
                "Missing table(s): "
                + ", ".join(
                    missing_tables
                )
                + ". Run "
                "'python "
                "migrate_menu_management_schema.py "
                "--apply' first."
            )
        )


# ============================================================
# AUDIT SERIALIZATION
# ============================================================

def serialize_audit(
    audit
):

    return {
        "id":
            audit.id,

        "jobId":
            audit.job_id,

        "executedAt": (
            audit.executed_at.isoformat()
            if audit.executed_at
            else None
        ),

        "completedAt": (
            audit.completed_at.isoformat()
            if audit.completed_at
            else None
        ),

        "cutoffDate": (
            audit.cutoff_date.isoformat()
            if audit.cutoff_date
            else None
        ),

        "menusDeleted":
            int(
                audit.menus_deleted
                or 0
            ),

        "dependentRowsDeleted":
            int(
                audit.dependent_rows_deleted
                or 0
            ),

        "status":
            audit.status,

        "dryRun":
            bool(
                audit.dry_run
            ),

        "errorMessage":
            audit.error_message,
    }


# ============================================================
# VIEW CLEANUP LOGS
# ============================================================

def show_cleanup_logs(
    limit
):

    try:

        limit = int(
            limit
        )

    except (
        TypeError,
        ValueError,
    ) as error:

        raise ValueError(
            "limit must be an integer."
        ) from error

    if limit < 1:

        raise ValueError(
            "limit must be at least 1."
        )

    limit = min(
        limit,
        100,
    )

    audits = (
        CleanupAudit.query
        .order_by(
            CleanupAudit.executed_at.desc(),
            CleanupAudit.id.desc(),
        )
        .limit(
            limit
        )
        .all()
    )

    print_heading(
        "MENU HISTORY CLEANUP LOGS"
    )

    if not audits:

        print(
            "No cleanup audit records found."
        )

        return

    print_json(
        {
            "count":
                len(
                    audits
                ),

            "records": [
                serialize_audit(
                    audit
                )
                for audit
                in audits
            ],
        }
    )


# ============================================================
# DRY RUN
# ============================================================

def run_dry_run(
    batch_size
):

    print_heading(
        (
            "MENU HISTORY CLEANUP "
            "- DRY RUN"
        )
    )

    print(
        (
            "No database rows will be "
            "changed in this mode."
        )
    )

    print()

    print(
        (
            "Retention rule: menu_date < "
            "UTC today - "
            f"{DEFAULT_RETENTION_DAYS} days"
        )
    )

    result = (
        cleanup_old_menu_history(
            retention_days=
                DEFAULT_RETENTION_DAYS,

            batch_size=
                batch_size,

            dry_run=True,
        )
    )

    print()

    print_json(
        result
    )

    print()

    print(
        (
            "Dry-run completed. "
            "No Menu, dependency, or "
            "CleanupAudit rows were changed."
        )
    )


# ============================================================
# ACTUAL CLEANUP
# ============================================================

def run_actual_cleanup(
    batch_size,
    max_batches=None,
):

    print_heading(
        (
            "MENU HISTORY CLEANUP "
            "- APPLY"
        )
    )

    print(
        (
            "Retention rule: menu_date < "
            "UTC today - "
            f"{DEFAULT_RETENTION_DAYS} days"
        )
    )

    print()

    print(
        (
            "Only eligible old Menu records "
            "and their direct Menu-owned "
            "dependencies will be deleted."
        )
    )

    print()

    print(
        (
            "Templates, food-item master records, "
            "Forecasts, Waste Records, Students, "
            "Staff, Hostels, Mess Units and "
            "Manager accounts are not deleted."
        )
    )

    result = (
        cleanup_old_menu_history(
            retention_days=
                DEFAULT_RETENTION_DAYS,

            batch_size=
                batch_size,

            dry_run=False,

            max_batches=
                max_batches,
        )
    )

    print()

    print_json(
        result
    )

    print()

    print(
        "Cleanup completed successfully."
    )


# ============================================================
# ARGUMENT PARSER
# ============================================================

def parse_arguments():

    parser = argparse.ArgumentParser(
        description=(
            "Safely clean Hostel Meal Portal "
            "Menu History records older than "
            "40 complete UTC days."
        )
    )

    mode_group = (
        parser.add_mutually_exclusive_group()
    )

    mode_group.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "Show what would be deleted "
            "without changing the database. "
            "This is the default mode."
        ),
    )

    mode_group.add_argument(
        "--apply",
        action="store_true",
        help=(
            "Actually delete eligible old "
            "Menu History records."
        ),
    )

    mode_group.add_argument(
        "--show-logs",
        action="store_true",
        help=(
            "Display recent CleanupAudit "
            "records instead of running cleanup."
        ),
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=
            DEFAULT_BATCH_SIZE,
        help=(
            "Maximum Menus processed in "
            "one transaction. "
            f"Default: {DEFAULT_BATCH_SIZE}."
        ),
    )

    parser.add_argument(
        "--max-batches",
        type=int,
        default=None,
        help=(
            "Optional maximum number of "
            "batches for an actual cleanup run. "
            "Useful for controlled maintenance."
        ),
    )

    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help=(
            "Number of cleanup audit records "
            "to display with --show-logs. "
            "Default: 20, maximum: 100."
        ),
    )

    return parser.parse_args()


# ============================================================
# MAIN
# ============================================================

def main():

    args = (
        parse_arguments()
    )

    try:

        app = (
            load_flask_app()
        )

        with app.app_context():

            verify_cleanup_schema()

            if args.show_logs:

                show_cleanup_logs(
                    args.limit
                )

                return

            if args.apply:

                run_actual_cleanup(
                    batch_size=
                        args.batch_size,

                    max_batches=
                        args.max_batches,
                )

                return

            # ------------------------------------------------
            # Safe default:
            # no mode argument means dry-run.
            # ------------------------------------------------

            run_dry_run(
                batch_size=
                    args.batch_size
            )

    except (
        ValueError,
        RuntimeError,
        MenuHistoryCleanupError,
    ) as error:

        print()

        print(
            (
                "CLEANUP STOPPED: "
                f"{error}"
            )
        )

        sys.exit(1)

    except KeyboardInterrupt:

        print()

        print(
            (
                "Cleanup cancelled by user. "
                "No unfinished transaction "
                "was intentionally committed."
            )
        )

        sys.exit(130)

    except Exception as error:

        print()

        print(
            (
                "CLEANUP FAILED: "
                f"{type(error).__name__}: "
                f"{error}"
            )
        )

        sys.exit(1)


if __name__ == "__main__":
    main()