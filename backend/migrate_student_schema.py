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

                    `title` VARCHAR(255) NOT NULL,

                    `message` TEXT NOT NULL,

                    `announcement_type` VARCHAR(50) NULL,

                    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,

                    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

                    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                        ON UPDATE CURRENT_TIMESTAMP,

                    PRIMARY KEY (`id`),

                    INDEX `idx_announcements_manager`
                        (`manager_user_id`),

                    CONSTRAINT `fk_announcements_manager`
                        FOREIGN KEY (`manager_user_id`)
                        REFERENCES `users` (`id`)
                        ON DELETE CASCADE

                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                """
            )

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
            