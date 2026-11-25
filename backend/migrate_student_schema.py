"""
Safe Student Portal Database Migration
--------------------------------------

This migration:
- DOES NOT drop tables
- DOES NOT delete existing data
- DOES NOT recreate the database
- Adds only missing Student Portal tables/columns
- Can be safely run multiple times

Run from project root:

    python backend/migrate_student_schema.py

or from backend:

    python migrate_student_schema.py
"""

import os
import sys
from urllib.parse import urlparse
from config import Config
from sqlalchemy import create_engine, inspect, text


# ============================================================
# DATABASE CONFIGURATION
# ============================================================


def get_database_url():
    """Use the same database configuration as the Flask application."""
    return Config.SQLALCHEMY_DATABASE_URI


DATABASE_URL = get_database_url()


# ============================================================
# HELPERS
# ============================================================

def normalize_database_url(url):
    """
    SQLAlchemy supports mysql+pymysql:// directly.
    This helper also handles postgres-style DATABASE_URL values
    if one happens to be present.
    """

    if url.startswith("mysql://"):
        return url.replace(
            "mysql://",
            "mysql+pymysql://",
            1
        )

    if url.startswith("postgres://"):
        return url.replace(
            "postgres://",
            "postgresql://",
            1
        )

    return url


def print_header(title):
    print()
    print("=" * 70)
    print(title)
    print("=" * 70)


def table_exists(inspector, table_name):
    return table_name in inspector.get_table_names()


def get_columns(inspector, table_name):
    if not table_exists(inspector, table_name):
        return set()

    return {
        column["name"]
        for column in inspector.get_columns(table_name)
    }


def add_column_if_missing(
    connection,
    inspector,
    table_name,
    column_name,
    definition
):
    """
    Add a column only when it doesn't already exist.
    """

    columns = get_columns(inspector, table_name)

    if column_name in columns:
        print(
            f"  [OK] {table_name}.{column_name} already exists"
        )
        return

    print(
        f"  [ADD] {table_name}.{column_name}"
    )

    connection.execute(
        text(
            f"ALTER TABLE `{table_name}` "
            f"ADD COLUMN `{column_name}` {definition}"
        )
    )

    print(
        f"  [DONE] Added {table_name}.{column_name}"
    )


def create_table_if_missing(
    connection,
    inspector,
    table_name,
    create_sql
):
    """
    Create a table only if it does not already exist.
    """

    if table_exists(inspector, table_name):
        print(
            f"  [OK] Table `{table_name}` already exists"
        )
        return

    print(
        f"  [CREATE] Table `{table_name}`"
    )

    connection.execute(text(create_sql))

    print(
        f"  [DONE] Created `{table_name}`"
    )


def add_index_if_missing(
    connection,
    inspector,
    table_name,
    index_name,
    columns
):
    indexes = inspector.get_indexes(table_name)

    if any(index.get("name") == index_name for index in indexes):
        print(f"  [OK] Index `{index_name}` already exists")
        return

    column_sql = ", ".join(f"`{column}`" for column in columns)
    connection.execute(
        text(
            f"CREATE INDEX `{index_name}` "
            f"ON `{table_name}` ({column_sql})"
        )
    )
    print(f"  [DONE] Created index `{index_name}`")


def add_foreign_key_if_missing(
    connection,
    inspector,
    table_name,
    constraint_name,
    column,
    referenced_table
):
    foreign_keys = inspector.get_foreign_keys(table_name)

    if any(
        column in key.get("constrained_columns", [])
        and key.get("referred_table") == referenced_table
        for key in foreign_keys
    ):
        print(f"  [OK] Foreign key for `{column}` already exists")
        return

    connection.execute(
        text(
            f"ALTER TABLE `{table_name}` "
            f"ADD CONSTRAINT `{constraint_name}` "
            f"FOREIGN KEY (`{column}`) "
            f"REFERENCES `{referenced_table}` (`id`) "
            "ON DELETE CASCADE"
        )
    )
    print(f"  [DONE] Added foreign key for `{column}`")


# ============================================================
# MAIN MIGRATION
# ============================================================

def run_migration():

    print_header(
        "HOSTEL MEAL PORTAL - STUDENT DATABASE MIGRATION"
    )

    database_url = normalize_database_url(DATABASE_URL)

    print()
    print("Database URL:")
    print(
        database_url.split("@")[-1]
        if "@" in database_url
        else database_url
    )

    print()
    print("Connecting to database...")

    try:
        engine = create_engine(
            database_url,
            pool_pre_ping=True,
            future=True
        )

        with engine.connect() as connection:

            connection.execute(text("SELECT 1"))

            print("[OK] Database connection successful")

            inspector = inspect(connection)

            # ------------------------------------------------
            # CURRENT TABLES
            # ------------------------------------------------

            print_header("CHECKING EXISTING TABLES")

            existing_tables = inspector.get_table_names()

            for table in sorted(existing_tables):
                print(f"  [FOUND] {table}")

            # ------------------------------------------------
            # 1. MEAL RESPONSE SNAPSHOT COLUMNS
            # ------------------------------------------------

            print_header(
                "1. CHECKING meal_responses"
            )

            if not table_exists(
                inspector,
                "meal_responses"
            ):
                print(
                    "[ERROR] meal_responses table does not exist."
                )
                print(
                    "Create the existing application tables first."
                )
                return False

            add_column_if_missing(
                connection,
                inspector,
                "meal_responses",
                "menu_date_snapshot",
                "DATE NULL"
            )

            # Refresh inspector after ALTER TABLE
            inspector = inspect(connection)

            add_column_if_missing(
                connection,
                inspector,
                "meal_responses",
                "meal_snapshot",
                "VARCHAR(50) NULL"
            )

            inspector = inspect(connection)

            add_column_if_missing(
                connection,
                inspector,
                "meal_responses",
                "meal_category_snapshot",
                "VARCHAR(50) NULL"
            )

            inspector = inspect(connection)

            add_column_if_missing(
                connection,
                inspector,
                "meal_responses",
                "menu_items_snapshot",
                "TEXT NULL"
            )

            # ------------------------------------------------
            # 2. STUDENT FEEDBACK
            # ------------------------------------------------

            print_header(
                "2. CHECKING student_feedback"
            )

            create_table_if_missing(
                connection,
                inspector,
                "student_feedback",
                """
                CREATE TABLE `student_feedback` (
                    `id` INT NOT NULL AUTO_INCREMENT,

                    `student_user_id` INT NOT NULL,

                    `menu_id` INT NULL,

                    `feedback_date` DATE NULL,

                    `meal` VARCHAR(50) NULL,

                    `category` VARCHAR(100) NULL,

                    `overall_rating` INT NULL,

                    `taste_rating` INT NULL,

                    `hygiene_rating` INT NULL,

                    `quantity_rating` INT NULL,

                    `comments` TEXT NULL,

                    `photo_path` VARCHAR(500) NULL,

                    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

                    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                        ON UPDATE CURRENT_TIMESTAMP,

                    PRIMARY KEY (`id`),

                    INDEX `idx_feedback_student`
                        (`student_user_id`),

                    INDEX `idx_feedback_menu`
                        (`menu_id`),

                    CONSTRAINT `fk_feedback_student`
                        FOREIGN KEY (`student_user_id`)
                        REFERENCES `users` (`id`)
                        ON DELETE CASCADE,

                    CONSTRAINT `fk_feedback_menu`
                        FOREIGN KEY (`menu_id`)
                        REFERENCES `menus` (`id`)
                        ON DELETE SET NULL

                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )

            # ------------------------------------------------
            # 3. ANNOUNCEMENTS
            # ------------------------------------------------

            print_header(
                "3. CHECKING announcements"
            )

            create_table_if_missing(
                connection,
                inspector,
                "announcements",
                """
                CREATE TABLE `announcements` (
                    `id` INT NOT NULL AUTO_INCREMENT,
                    `manager_user_id` INT NOT NULL,
                    `recipient_user_id` INT NULL,
                    `hostel_id` INT NULL,
                    `mess_unit_id` INT NULL,
                    `meal_category` VARCHAR(30) NULL,
                    `is_general` BOOLEAN NOT NULL DEFAULT FALSE,
                    `title` VARCHAR(200) NOT NULL,
                    `message` TEXT NOT NULL,
                    `sender_name` VARCHAR(120) NULL,
                    `priority` ENUM('normal', 'important', 'urgent')
                        NOT NULL DEFAULT 'normal',
                    `attachment_url` VARCHAR(500) NULL,
                    `expires_at` DATETIME NULL,
                    `status` ENUM('draft', 'published', 'unpublished')
                        NOT NULL DEFAULT 'draft',
                    `published_at` DATETIME NULL,
                    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                        ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    INDEX `ix_announcements_manager_status`
                        (`manager_user_id`, `status`),
                    INDEX `ix_announcements_recipient`
                        (`recipient_user_id`, `status`),
                    INDEX `ix_announcements_scope`
                        (`hostel_id`, `mess_unit_id`, `meal_category`, `status`),
                    INDEX `ix_announcements_published_at`
                        (`published_at`),
                    CONSTRAINT `fk_announcement_manager`
                        FOREIGN KEY (`manager_user_id`)
                        REFERENCES `users` (`id`)
                        ON DELETE CASCADE,
                    CONSTRAINT `fk_announcement_recipient`
                        FOREIGN KEY (`recipient_user_id`)
                        REFERENCES `users` (`id`)
                        ON DELETE CASCADE,
                    CONSTRAINT `fk_announcement_hostel`
                        FOREIGN KEY (`hostel_id`)
                        REFERENCES `hostels` (`id`)
                        ON DELETE CASCADE,
                    CONSTRAINT `fk_announcement_mess_unit`
                        FOREIGN KEY (`mess_unit_id`)
                        REFERENCES `mess_units` (`id`)
                        ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )

            inspector = inspect(connection)
            existing_announcement_columns = get_columns(
                inspector,
                "announcements"
            )

            announcement_columns = [
                ("recipient_user_id", "INT NULL"),
                ("hostel_id", "INT NULL"),
                ("mess_unit_id", "INT NULL"),
                ("meal_category", "VARCHAR(30) NULL"),
                ("is_general", "BOOLEAN NOT NULL DEFAULT FALSE"),
                ("sender_name", "VARCHAR(120) NULL"),
                (
                    "priority",
                    "ENUM('normal', 'important', 'urgent') "
                    "NOT NULL DEFAULT 'normal'"
                ),
                ("attachment_url", "VARCHAR(500) NULL"),
                ("expires_at", "DATETIME NULL"),
                (
                    "status",
                    "ENUM('draft', 'published', 'unpublished') "
                    "NOT NULL DEFAULT 'draft'"
                ),
                ("published_at", "DATETIME NULL"),
            ]

            for column_name, definition in announcement_columns:
                add_column_if_missing(
                    connection,
                    inspector,
                    "announcements",
                    column_name,
                    definition
                )
                inspector = inspect(connection)

            if "status" not in existing_announcement_columns:
                if "is_active" in existing_announcement_columns:
                    connection.execute(
                        text(
                            "UPDATE `announcements` "
                            "SET `status` = CASE "
                            "WHEN `is_active` = 1 THEN 'published' "
                            "ELSE 'unpublished' END"
                        )
                    )

            if "is_general" not in existing_announcement_columns:
                connection.execute(
                    text(
                        "UPDATE `announcements` "
                        "SET `is_general` = TRUE "
                        "WHERE `recipient_user_id` IS NULL "
                        "AND `hostel_id` IS NULL "
                        "AND `mess_unit_id` IS NULL "
                        "AND `meal_category` IS NULL"
                    )
                )

            if (
                "published_at" not in existing_announcement_columns
                and "created_at" in existing_announcement_columns
            ):
                connection.execute(
                    text(
                        "UPDATE `announcements` "
                        "SET `published_at` = `created_at` "
                        "WHERE `status` = 'published' "
                        "AND `published_at` IS NULL"
                    )
                )

            for index_name, columns in (
                (
                    "ix_announcements_manager_status",
                    ("manager_user_id", "status")
                ),
                (
                    "ix_announcements_recipient",
                    ("recipient_user_id", "status")
                ),
                (
                    "ix_announcements_scope",
                    (
                        "hostel_id",
                        "mess_unit_id",
                        "meal_category",
                        "status"
                    )
                ),
                (
                    "ix_announcements_published_at",
                    ("published_at",)
                ),
            ):
                add_index_if_missing(
                    connection,
                    inspector,
                    "announcements",
                    index_name,
                    columns
                )
                inspector = inspect(connection)

            for constraint_name, column, referenced_table in (
                (
                    "fk_announcement_manager",
                    "manager_user_id",
                    "users"
                ),
                (
                    "fk_announcement_recipient",
                    "recipient_user_id",
                    "users"
                ),
                (
                    "fk_announcement_hostel",
                    "hostel_id",
                    "hostels"
                ),
                (
                    "fk_announcement_mess_unit",
                    "mess_unit_id",
                    "mess_units"
                ),
            ):
                add_foreign_key_if_missing(
                    connection,
                    inspector,
                    "announcements",
                    constraint_name,
                    column,
                    referenced_table
                )
                inspector = inspect(connection)

            # ------------------------------------------------
            # 4. ANNOUNCEMENT READ STATUS
            # ------------------------------------------------

            print_header(
                "4. CHECKING announcement_reads"
            )

            create_table_if_missing(
                connection,
                inspector,
                "announcement_reads",
                """
                CREATE TABLE `announcement_reads` (
                    `id` INT NOT NULL AUTO_INCREMENT,

                    `announcement_id` INT NOT NULL,

                    `student_user_id` INT NOT NULL,

                    `read_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

                    PRIMARY KEY (`id`),

                    UNIQUE KEY `uq_announcement_student`
                        (`announcement_id`, `student_user_id`),

                    INDEX `idx_announcement_reads_student`
                        (`student_user_id`),

                    CONSTRAINT `fk_announcement_reads_announcement`
                        FOREIGN KEY (`announcement_id`)
                        REFERENCES `announcements` (`id`)
                        ON DELETE CASCADE,

                    CONSTRAINT `fk_announcement_reads_student`
                        FOREIGN KEY (`student_user_id`)
                        REFERENCES `users` (`id`)
                        ON DELETE CASCADE

                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )

            # ------------------------------------------------
            # 5. STUDENT SETTINGS
            # ------------------------------------------------

            print_header(
                "5. CHECKING student_settings"
            )

            create_table_if_missing(
                connection,
                inspector,
                "student_settings",
                """
                CREATE TABLE `student_settings` (
                    `id` INT NOT NULL AUTO_INCREMENT,

                    `student_user_id` INT NOT NULL,

                    `email_notifications` BOOLEAN NOT NULL DEFAULT TRUE,

                    `meal_notifications` BOOLEAN NOT NULL DEFAULT TRUE,

                    `announcement_notifications` BOOLEAN NOT NULL DEFAULT TRUE,

                    `feedback_notifications` BOOLEAN NOT NULL DEFAULT TRUE,

                    `meal_reminders` BOOLEAN NOT NULL DEFAULT TRUE,

                    `push_notifications` BOOLEAN NOT NULL DEFAULT TRUE,

                    `dark_mode` BOOLEAN NOT NULL DEFAULT FALSE,

                    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

                    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                        ON UPDATE CURRENT_TIMESTAMP,

                    PRIMARY KEY (`id`),

                    UNIQUE KEY `uq_student_settings_student`
                        (`student_user_id`),

                    CONSTRAINT `fk_student_settings_student`
                        FOREIGN KEY (`student_user_id`)
                        REFERENCES `users` (`id`)
                        ON DELETE CASCADE

                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )

            # ------------------------------------------------
            # COMMIT
            # ------------------------------------------------

            connection.commit()

            print_header(
                "MIGRATION COMPLETED"
            )

            print(
                "[SUCCESS] Existing data was preserved."
            )

            print(
                "[SUCCESS] No tables were dropped."
            )

            print(
                "[SUCCESS] No records were deleted."
            )

            print(
                "[SUCCESS] Missing Student Portal schema "
                "elements were added where necessary."
            )

            return True

    except Exception as exc:

        print_header(
            "MIGRATION FAILED"
        )

        print(
            f"[ERROR] {type(exc).__name__}: {exc}"
        )

        return False


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":

    success = run_migration()

    if success:
        print()
        print("Next:")
        print("1. Start Flask again.")
        print("2. Login as Student.")
        print("3. Refresh Student Dashboard.")
        print()
        sys.exit(0)

    print()
    print(
        "Migration did not complete. "
        "Fix the reported database error before continuing."
    )
    sys.exit(1)
            