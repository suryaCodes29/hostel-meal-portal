"""Add the retained attendance-summary table without changing existing data.

From backend/:
    python migrate_menu_attendance_summary.py --dry-run
    python migrate_menu_attendance_summary.py --apply

No arguments means dry-run. MySQL DDL commits implicitly; this migration
never drops tables or attempts destructive rollback of an existing table.
"""

import argparse
import json
import re
import sys

from sqlalchemy import inspect, text

from models import db
from menu_report_models import MenuAttendanceSummary


TABLE = MenuAttendanceSummary.__table__
LOCK_NAME = "hostel_meal_portal_attendance_schema_v1"
PARENT_TABLES = (
    "users",
    "hostels",
    "mess_units",
    "menus",
)


class MigrationError(RuntimeError):
    """An actionable schema failure without database secrets."""


def _normalize_check(expression):
    return re.sub(
        r"[\s`()\"]",
        "",
        expression,
    ).lower()


def _verify_parents(connection):
    inspector = inspect(connection)

    for name in PARENT_TABLES:
        if not inspector.has_table(name):
            raise MigrationError(
                f"Missing required table: {name}. "
                "Run the existing menu-management migration first."
            )

        columns = {
            column["name"]: column
            for column in inspector.get_columns(name)
        }

        if "id" not in columns:
            raise MigrationError(
                f"Required primary-key column missing: {name}.id"
            )

        primary_key = inspector.get_pk_constraint(name)[
            "constrained_columns"
        ]

        if primary_key != ["id"]:
            raise MigrationError(
                f"Expected a single id primary key on {name}."
            )

        if connection.dialect.name in {"mysql", "mariadb"}:
            options = inspector.get_table_options(name)
            engine = (
                options.get("mysql_engine")
                or options.get("mariadb_engine")
            )

            if str(engine).lower() != "innodb":
                raise MigrationError(
                    f"{name} must use InnoDB for safe foreign keys."
                )

            column_type = columns["id"]["type"]

            if (
                str(column_type).upper() != "INTEGER"
                or getattr(column_type, "unsigned", False)
            ):
                raise MigrationError(
                    f"{name}.id must match the existing "
                    "signed INTEGER model."
                )


def verify_summary_schema(connection):
    """Reject incompatible schemas without silently patching them."""
    inspector = inspect(connection)

    if not inspector.has_table(TABLE.name):
        raise MigrationError(
            "Attendance-summary table was not created."
        )

    columns = {
        column["name"]: column
        for column in inspector.get_columns(TABLE.name)
    }

    for expected in TABLE.columns:
        actual = columns.get(expected.name)

        if actual is None:
            raise MigrationError(
                f"Summary column missing: {expected.name}"
            )

        if (
            actual["type"]._type_affinity
            is not expected.type._type_affinity
        ):
            raise MigrationError(
                f"Summary column type mismatch: {expected.name}"
            )

        if bool(actual["nullable"]) != bool(expected.nullable):
            raise MigrationError(
                f"Summary nullability mismatch: {expected.name}"
            )

        expected_length = getattr(
            expected.type,
            "length",
            None,
        )

        if expected_length is not None:
            actual_length = getattr(
                actual["type"],
                "length",
                None,
            )

            if actual_length != expected_length:
                raise MigrationError(
                    f"Summary column length mismatch: {expected.name}"
                )

        if hasattr(actual["type"], "enums"):
            if actual["type"].enums != getattr(
                expected.type,
                "enums",
                None,
            ):
                raise MigrationError(
                    f"Summary enum mismatch: {expected.name}"
                )

    primary_key = inspector.get_pk_constraint(TABLE.name)[
        "constrained_columns"
    ]

    if primary_key != ["id"]:
        raise MigrationError(
            "Summary primary key must be id."
        )

    unique_columns = {
        tuple(item["column_names"])
        for item in inspector.get_unique_constraints(TABLE.name)
    }

    unique_columns.update(
        tuple(item["column_names"])
        for item in inspector.get_indexes(TABLE.name)
        if item.get("unique")
    )

    required_unique = {
        ("menu_id",),
        (
            "manager_user_id",
            "hostel_id",
            "mess_unit_id",
            "menu_date",
            "meal",
            "meal_category",
        ),
    }

    if not required_unique.issubset(unique_columns):
        raise MigrationError(
            "Summary uniqueness constraints are missing."
        )

    foreign_keys = {
        (
            tuple(fk["constrained_columns"]),
            fk["referred_table"],
            tuple(fk["referred_columns"]),
            fk.get("options", {}).get("ondelete", "").upper(),
        )
        for fk in inspector.get_foreign_keys(TABLE.name)
    }

    required_foreign_keys = (
        ("manager_user_id", "users", "CASCADE"),
        ("hostel_id", "hostels", "CASCADE"),
        ("mess_unit_id", "mess_units", "CASCADE"),
        ("menu_id", "menus", "SET NULL"),
    )

    for column, parent, action in required_foreign_keys:
        expected = (
            (column,),
            parent,
            ("id",),
            action,
        )

        if expected not in foreign_keys:
            raise MigrationError(
                f"Summary foreign key mismatch: {column}"
            )

    index_columns = {
        tuple(index["column_names"])
        for index in inspector.get_indexes(TABLE.name)
    }

    for index in TABLE.indexes:
        expected = tuple(
            column.name
            for column in index.columns
        )

        if expected not in index_columns:
            raise MigrationError(
                f"Summary index missing: {index.name}"
            )

    # Older MySQL releases may ignore CHECK constraints.
    # Application-side validation remains required.
    checks = inspector.get_check_constraints(TABLE.name)

    if connection.dialect.name == "sqlite" or checks:
        actual_checks = {
            _normalize_check(check["sqltext"])
            for check in checks
        }

        for constraint in TABLE.constraints:
            if isinstance(constraint, db.CheckConstraint):
                expected = _normalize_check(
                    str(constraint.sqltext)
                )

                if expected not in actual_checks:
                    raise MigrationError(
                        f"Summary check missing: {constraint.name}"
                    )


def run_migration(*, apply_changes=False):
    """Run within a Flask context against its configured database."""
    with db.engine.connect() as connection:
        locked = False

        try:
            if connection.dialect.name not in {
                "mysql",
                "mariadb",
                "sqlite",
            }:
                raise MigrationError(
                    "Supported databases: MySQL/MariaDB "
                    "and test SQLite."
                )

            if (
                apply_changes
                and connection.dialect.name in {"mysql", "mariadb"}
            ):
                locked = connection.execute(
                    text("SELECT GET_LOCK(:name, 10)"),
                    {"name": LOCK_NAME},
                ).scalar() == 1

                if not locked:
                    raise MigrationError(
                        "Another attendance migration is running; "
                        "retry later."
                    )

            _verify_parents(connection)

            exists = inspect(connection).has_table(TABLE.name)

            if exists:
                verify_summary_schema(connection)
                status = "already-applied"

            elif not apply_changes:
                status = "would-create"

            else:
                # Create only this table and its indexes.
                # Do not call db.create_all().
                options = TABLE.dialect_options["mysql"]
                previous_engine = options.get("engine")

                try:
                    options["engine"] = "InnoDB"
                    TABLE.create(
                        bind=connection,
                        checkfirst=True,
                    )
                finally:
                    if previous_engine is None:
                        del options["engine"]
                    else:
                        options["engine"] = previous_engine

                verify_summary_schema(connection)
                connection.commit()
                status = "created"

            return {
                "status": status,
                "dryRun": not apply_changes,
                "table": TABLE.name,
                "existingDataChanged": False,
            }

        except Exception:
            connection.rollback()
            raise

        finally:
            if locked:
                try:
                    connection.execute(
                        text("SELECT RELEASE_LOCK(:name)"),
                        {"name": LOCK_NAME},
                    )
                except Exception:
                    connection.invalidate()


def main():
    parser = argparse.ArgumentParser(
        description=__doc__
    )

    mode = parser.add_mutually_exclusive_group()

    mode.add_argument(
        "--apply",
        action="store_true",
        help="Create and verify the table.",
    )

    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="Inspect without schema changes.",
    )

    args = parser.parse_args()

    try:
        # File 2's app.py does not start a scheduler on import.
        from app import app

        with app.app_context():
            result = run_migration(
                apply_changes=args.apply
            )

        print(json.dumps(result, indent=2))
        return 0

    except MigrationError as error:
        print(
            f"MIGRATION STOPPED: {error}",
            file=sys.stderr,
        )

    except Exception as error:
        print(
            f"MIGRATION FAILED ({type(error).__name__}). "
            "Check database access and schema compatibility. "
            "Existing data was not deleted. "
            "MySQL DDL may have committed; "
            "rerun dry-run to inspect the result.",
            file=sys.stderr,
        )

    return 1


if __name__ == "__main__":
    sys.exit(main())
    