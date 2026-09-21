import argparse
import importlib
import sys
from pathlib import Path

from sqlalchemy import inspect, text


# ============================================================
# BACKEND IMPORT PATH
# ============================================================

BACKEND_DIR = Path(__file__).resolve().parent

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(
        0,
        str(BACKEND_DIR)
    )


from models import db


# ============================================================
# MIGRATION CONFIGURATION
# ============================================================

MIGRATION_NAME = "menu-management-schema-v1"

NEW_TABLES_IN_ORDER = [
    "menu_items",
    "menu_templates",
    "menu_menu_items",
    "menu_template_items",
    "menu_notifications",
    "cleanup_audits",
]


# ============================================================
# APPLICATION LOADER
# ============================================================

def load_flask_app():
    """
    Load the existing Hostel Meal Portal Flask application.

    This avoids hard-coding database credentials inside this migration.

    Supported common layouts:
        app.py  -> app
        app.py  -> create_app()
        run.py  -> app
        run.py  -> create_app()
        main.py -> app
        main.py -> create_app()
    """

    candidates = [
        "app",
        "run",
        "main",
    ]

    errors = []

    for module_name in candidates:

        try:
            module = importlib.import_module(
                module_name
            )

        except ModuleNotFoundError as error:

            if error.name == module_name:
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
            None
        )

        if callable(create_app):

            app = create_app()

            if hasattr(
                app,
                "app_context"
            ):
                return app

        app = getattr(
            module,
            "app",
            None
        )

        if (
            app is not None
            and hasattr(
                app,
                "app_context"
            )
        ):
            return app

        errors.append(
            (
                f"{module_name}: "
                "no Flask app or create_app found"
            )
        )

    raise RuntimeError(
        (
            "Unable to load the existing Flask application.\n"
            "Tried:\n- "
            + "\n- ".join(errors)
        )
    )


# ============================================================
# INSPECTION HELPERS
# ============================================================

def table_exists(
    connection,
    table_name
):
    return inspect(
        connection
    ).has_table(
        table_name
    )


def column_names(
    connection,
    table_name
):
    return {
        column["name"]
        for column
        in inspect(
            connection
        ).get_columns(
            table_name
        )
    }


def get_column(
    connection,
    table_name,
    column_name
):
    columns = inspect(
        connection
    ).get_columns(
        table_name
    )

    for column in columns:

        if (
            column["name"]
            == column_name
        ):
            return column

    return None


def index_names(
    connection,
    table_name
):
    indexes = inspect(
        connection
    ).get_indexes(
        table_name
    )

    return {
        index.get("name")
        for index in indexes
        if index.get("name")
    }


def unique_constraint_names(
    connection,
    table_name
):
    constraints = inspect(
        connection
    ).get_unique_constraints(
        table_name
    )

    return {
        constraint.get("name")
        for constraint in constraints
        if constraint.get("name")
    }


def foreign_key_exists_for_column(
    connection,
    table_name,
    column_name
):
    foreign_keys = inspect(
        connection
    ).get_foreign_keys(
        table_name
    )

    for foreign_key in foreign_keys:

        constrained_columns = (
            foreign_key.get(
                "constrained_columns"
            )
            or []
        )

        if (
            column_name
            in constrained_columns
        ):
            return True

    return False


# ============================================================
# OUTPUT HELPERS
# ============================================================

def print_heading(title):

    print()

    print("=" * 72)

    print(title)

    print("=" * 72)


def print_action(
    apply_changes,
    message
):

    prefix = (
        "APPLY"
        if apply_changes
        else "PLAN "
    )

    print(
        f"[{prefix}] {message}"
    )


# ============================================================
# BASE SCHEMA CHECK
# ============================================================

def require_base_schema(
    connection
):

    required_tables = [
        "users",
        "hostels",
        "mess_units",
        "menus",
        "meal_responses",
    ]

    missing_tables = [
        table_name
        for table_name
        in required_tables
        if not table_exists(
            connection,
            table_name
        )
    ]

    if missing_tables:

        raise RuntimeError(
            (
                "Required existing tables are missing: "
                + ", ".join(
                    missing_tables
                )
                + ". Migration stopped before making changes."
            )
        )


# ============================================================
# DUPLICATE MENU PREFLIGHT
# ============================================================

def find_duplicate_menu_scopes(
    connection
):

    result = connection.execute(
        text(
            """
            SELECT
                hostel_id,
                mess_unit_id,
                menu_date,
                meal,
                meal_category,
                COUNT(*) AS duplicate_count,
                GROUP_CONCAT(
                    id
                    ORDER BY id
                    SEPARATOR ','
                ) AS menu_ids
            FROM menus
            GROUP BY
                hostel_id,
                mess_unit_id,
                menu_date,
                meal,
                meal_category
            HAVING COUNT(*) > 1
            ORDER BY
                menu_date,
                hostel_id,
                mess_unit_id,
                meal,
                meal_category
            """
        )
    )

    return [
        dict(row._mapping)
        for row in result
    ]


def ensure_no_duplicate_menu_scopes(
    connection
):

    duplicates = (
        find_duplicate_menu_scopes(
            connection
        )
    )

    if not duplicates:

        print(
            "[CHECK] No duplicate Menu scope records found."
        )

        return

    print()

    print(
        "Duplicate Menu records were found."
    )

    print(
        (
            "This migration will NOT delete, merge, "
            "or silently modify those records."
        )
    )

    print()

    print(
        (
            "The following duplicate groups prevent "
            "the new database uniqueness rule:"
        )
    )

    print()

    for item in duplicates[:20]:

        print(
            (
                "  hostel_id="
                f"{item['hostel_id']} | "
                "mess_unit_id="
                f"{item['mess_unit_id']} | "
                "date="
                f"{item['menu_date']} | "
                "meal="
                f"{item['meal']} | "
                "category="
                f"{item['meal_category']} | "
                "count="
                f"{item['duplicate_count']} | "
                "menu_ids="
                f"{item['menu_ids']}"
            )
        )

    if len(duplicates) > 20:

        print(
            (
                "  ... and "
                f"{len(duplicates) - 20} "
                "additional duplicate groups."
            )
        )

    raise RuntimeError(
        (
            "Migration stopped before schema changes. "
            "Existing duplicate Menu records must be "
            "reviewed before the uniqueness constraint "
            "can be safely added."
        )
    )


# ============================================================
# MENU COLUMNS
# ============================================================

def ensure_menu_columns(
    connection,
    apply_changes
):

    existing_columns = column_names(
        connection,
        "menus"
    )

    if (
        "published_at"
        not in existing_columns
    ):

        print_action(
            apply_changes,
            (
                "Add menus.published_at "
                "DATETIME NULL"
            )
        )

        if apply_changes:

            connection.execute(
                text(
                    """
                    ALTER TABLE menus
                    ADD COLUMN published_at
                    DATETIME NULL
                    """
                )
            )

    if (
        "published_by"
        not in existing_columns
    ):

        print_action(
            apply_changes,
            (
                "Add menus.published_by "
                "INT NULL"
            )
        )

        if apply_changes:

            connection.execute(
                text(
                    """
                    ALTER TABLE menus
                    ADD COLUMN published_by
                    INT NULL
                    """
                )
            )


# ============================================================
# MENU STATUS ENUM
# ============================================================

def ensure_menu_status_enum(
    connection,
    apply_changes
):

    status_column = get_column(
        connection,
        "menus",
        "status"
    )

    if not status_column:

        raise RuntimeError(
            "Existing menus.status column was not found."
        )

    column_type = status_column.get(
        "type"
    )

    enum_values = (
        getattr(
            column_type,
            "enums",
            None
        )
        or []
    )

    if (
        "unpublished"
        in enum_values
    ):
        return

    print_action(
        apply_changes,
        (
            "Extend menus.status ENUM "
            "with 'unpublished'"
        )
    )

    if apply_changes:

        connection.execute(
            text(
                """
                ALTER TABLE menus
                MODIFY COLUMN status
                ENUM(
                    'draft',
                    'scheduled',
                    'published',
                    'unpublished',
                    'completed'
                )
                NOT NULL
                DEFAULT 'draft'
                """
            )
        )


# ============================================================
# MENU PUBLISHER FOREIGN KEY
# ============================================================

def ensure_menu_publisher_foreign_key(
    connection,
    apply_changes
):

    current_columns = column_names(
        connection,
        "menus"
    )

    if (
        "published_by"
        not in current_columns
    ):

        if not apply_changes:

            print_action(
                False,
                (
                    "Add foreign key "
                    "menus.published_by -> users.id "
                    "ON DELETE SET NULL"
                )
            )

            return

        raise RuntimeError(
            (
                "menus.published_by was expected to exist "
                "before adding its foreign key."
            )
        )

    if foreign_key_exists_for_column(
        connection,
        "menus",
        "published_by"
    ):
        return

    print_action(
        apply_changes,
        (
            "Add foreign key "
            "menus.published_by -> users.id "
            "ON DELETE SET NULL"
        )
    )

    if apply_changes:

        connection.execute(
            text(
                """
                ALTER TABLE menus
                ADD CONSTRAINT
                    fk_menus_published_by_users
                FOREIGN KEY (
                    published_by
                )
                REFERENCES users(id)
                ON DELETE SET NULL
                """
            )
        )


# ============================================================
# MENU INDEXES
# ============================================================

def ensure_menu_indexes(
    connection,
    apply_changes
):

    existing_indexes = index_names(
        connection,
        "menus"
    )

    wanted_indexes = [
        (
            "ix_menus_menu_date",
            """
            CREATE INDEX
                ix_menus_menu_date
            ON menus (
                menu_date
            )
            """
        ),
        (
            "ix_menus_status_date",
            """
            CREATE INDEX
                ix_menus_status_date
            ON menus (
                status,
                menu_date
            )
            """
        ),
    ]

    for (
        index_name,
        ddl
    ) in wanted_indexes:

        if (
            index_name
            in existing_indexes
        ):
            continue

        print_action(
            apply_changes,
            (
                "Create index "
                f"{index_name}"
            )
        )

        if apply_changes:

            connection.execute(
                text(ddl)
            )


# ============================================================
# UNIQUE MENU SCOPE
# ============================================================

def ensure_menu_unique_constraint(
    connection,
    apply_changes
):

    constraint_name = (
        "uq_menu_scope_date_meal_category"
    )

    unique_names = (
        unique_constraint_names(
            connection,
            "menus"
        )
    )

    indexes = index_names(
        connection,
        "menus"
    )

    if (
        constraint_name
        in unique_names
        or constraint_name
        in indexes
    ):
        return

    print_action(
        apply_changes,
        (
            "Add unique Menu scope constraint: "
            "hostel_id + mess_unit_id + menu_date + "
            "meal + meal_category"
        )
    )

    if apply_changes:

        connection.execute(
            text(
                """
                ALTER TABLE menus
                ADD CONSTRAINT
                    uq_menu_scope_date_meal_category
                UNIQUE (
                    hostel_id,
                    mess_unit_id,
                    menu_date,
                    meal,
                    meal_category
                )
                """
            )
        )


# ============================================================
# NEW TABLES
# ============================================================

def ensure_new_tables(
    connection,
    apply_changes
):

    for table_name in NEW_TABLES_IN_ORDER:

        if table_exists(
            connection,
            table_name
        ):
            continue

        print_action(
            apply_changes,
            (
                "Create table "
                f"{table_name}"
            )
        )

        if not apply_changes:
            continue

        table = db.metadata.tables.get(
            table_name
        )

        if table is None:

            raise RuntimeError(
                (
                    f"Table metadata for "
                    f"{table_name} was not found. "
                    "Make sure backend/models.py was replaced "
                    "with the new version before running "
                    "this migration."
                )
            )

        table.create(
            bind=connection,
            checkfirst=True
        )


# ============================================================
# FINAL SCHEMA VERIFICATION
# ============================================================

def verify_schema(
    connection
):

    problems = []

    menu_columns = column_names(
        connection,
        "menus"
    )

    for required_column in [
        "published_at",
        "published_by",
    ]:

        if (
            required_column
            not in menu_columns
        ):

            problems.append(
                (
                    "Missing menus."
                    f"{required_column}"
                )
            )

    status_column = get_column(
        connection,
        "menus",
        "status"
    )

    status_values = []

    if status_column:

        status_values = (
            getattr(
                status_column.get(
                    "type"
                ),
                "enums",
                None
            )
            or []
        )

    if (
        "unpublished"
        not in status_values
    ):

        problems.append(
            (
                "menus.status does not "
                "include 'unpublished'"
            )
        )

    if not foreign_key_exists_for_column(
        connection,
        "menus",
        "published_by"
    ):

        problems.append(
            (
                "Missing foreign key for "
                "menus.published_by"
            )
        )

    menu_indexes = index_names(
        connection,
        "menus"
    )

    for required_index in [
        "ix_menus_menu_date",
        "ix_menus_status_date",
    ]:

        if (
            required_index
            not in menu_indexes
        ):

            problems.append(
                (
                    "Missing Menu index: "
                    f"{required_index}"
                )
            )

    unique_names = (
        unique_constraint_names(
            connection,
            "menus"
        )
    )

    if (
        "uq_menu_scope_date_meal_category"
        not in unique_names
        and
        "uq_menu_scope_date_meal_category"
        not in menu_indexes
    ):

        problems.append(
            (
                "Missing Menu scope "
                "unique constraint."
            )
        )

    for table_name in NEW_TABLES_IN_ORDER:

        if not table_exists(
            connection,
            table_name
        ):

            problems.append(
                (
                    "Missing table: "
                    f"{table_name}"
                )
            )

    if problems:

        print()

        print(
            "Schema verification failed:"
        )

        for problem in problems:

            print(
                f"  - {problem}"
            )

        raise RuntimeError(
            (
                "Migration did not reach "
                "the required schema."
            )
        )

    print()

    print(
        (
            "[VERIFY] Menu Management "
            "schema is complete."
        )
    )


# ============================================================
# MIGRATION
# ============================================================

def run_migration(
    apply_changes
):

    app = load_flask_app()

    print_heading(
        (
            "HOSTEL MEAL PORTAL "
            "MENU MANAGEMENT MIGRATION"
        )
    )

    print(
        f"Migration: {MIGRATION_NAME}"
    )

    print(
        (
            "Mode: "
            + (
                "APPLY"
                if apply_changes
                else "DRY RUN"
            )
        )
    )

    with app.app_context():

        engine = db.engine

        dialect_name = (
            engine.dialect.name
        )

        print(
            (
                "Database dialect: "
                f"{dialect_name}"
            )
        )

        if (
            dialect_name
            != "mysql"
        ):

            raise RuntimeError(
                (
                    "This migration is intentionally "
                    "restricted to MySQL because this "
                    "project uses MySQL ENUM and ALTER "
                    "TABLE behaviour. No migration "
                    "changes were applied."
                )
            )

        with engine.connect() as connection:

            # ------------------------------------------------
            # Preflight
            # ------------------------------------------------

            require_base_schema(
                connection
            )

            ensure_no_duplicate_menu_scopes(
                connection
            )

            print_heading(
                "MIGRATION PLAN"
            )

            # ------------------------------------------------
            # Existing Menu table
            # ------------------------------------------------

            ensure_menu_columns(
                connection,
                apply_changes
            )

            ensure_menu_status_enum(
                connection,
                apply_changes
            )

            ensure_menu_publisher_foreign_key(
                connection,
                apply_changes
            )

            ensure_menu_indexes(
                connection,
                apply_changes
            )

            ensure_menu_unique_constraint(
                connection,
                apply_changes
            )

            # ------------------------------------------------
            # New Menu Management tables
            # ------------------------------------------------

            ensure_new_tables(
                connection,
                apply_changes
            )

            if not apply_changes:

                print()

                print(
                    (
                        "Dry-run complete. "
                        "This script intentionally did not "
                        "execute migration DDL."
                    )
                )

                print(
                    (
                        "Review the plan before running "
                        "the migration with --apply."
                    )
                )

                return

            connection.commit()

        # ----------------------------------------------------
        # Verify through a fresh connection
        # ----------------------------------------------------

        with engine.connect() as connection:

            verify_schema(
                connection
            )

    print()

    print(
        (
            "Migration completed successfully."
        )
    )

    print(
        (
            "No existing Menu, Student, Staff, Hostel, "
            "Mess Unit, Forecast, Waste, Notification, "
            "or User rows were deleted by this migration."
        )
    )


# ============================================================
# COMMAND-LINE INTERFACE
# ============================================================

def parse_args():

    parser = argparse.ArgumentParser(
        description=(
            "Migrate the Hostel Meal Portal MySQL "
            "database for structured Menu Management."
        )
    )

    parser.add_argument(
        "--apply",
        action="store_true",
        help=(
            "Apply schema changes. "
            "Without this flag the script "
            "performs a dry-run only."
        )
    )

    return parser.parse_args()


def main():

    args = parse_args()

    try:

        run_migration(
            apply_changes=
                args.apply
        )

    except Exception as error:

        print()

        print(
            (
                "MIGRATION STOPPED: "
                f"{error}"
            )
        )

        sys.exit(1)


if __name__ == "__main__":
    main()