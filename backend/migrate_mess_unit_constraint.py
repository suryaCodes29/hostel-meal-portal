from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError

from app import app
from models import db


TABLE_NAME = "mess_units"

OLD_CONSTRAINT_NAME = (
    "uq_hostel_mess_unit_name"
)

NEW_CONSTRAINT_NAME = (
    "uq_hostel_mess_unit_type"
)


# ============================================================
# DISPLAY HELPERS
# ============================================================

def print_line():

    print(
        "=" * 72
    )


# ============================================================
# NORMALIZATION
# ============================================================

def normalize_column_names(
    columns
):

    return tuple(

        str(column)
        .strip()
        .lower()

        for column
        in (
            columns
            or []
        )

    )


# ============================================================
# UNIQUE CONSTRAINTS
# ============================================================

def get_unique_constraints(
    connection
):

    inspector = inspect(
        connection
    )


    rows = (
        inspector
        .get_unique_constraints(
            TABLE_NAME
        )
    )


    result = []


    for row in rows:

        result.append({

            "name":
                row.get(
                    "name"
                ),

            "columns":
                normalize_column_names(
                    row.get(
                        "column_names"
                    )
                )

        })


    return result


# ============================================================
# INDEXES
# ============================================================

def get_indexes(
    connection
):

    inspector = inspect(
        connection
    )


    rows = (
        inspector
        .get_indexes(
            TABLE_NAME
        )
    )


    result = []


    for row in rows:

        result.append({

            "name":
                row.get(
                    "name"
                ),

            "columns":
                normalize_column_names(
                    row.get(
                        "column_names"
                    )
                ),

            "unique":
                bool(
                    row.get(
                        "unique"
                    )
                )

        })


    return result


# ============================================================
# FOREIGN KEYS
# ============================================================

def get_foreign_keys(
    connection
):

    inspector = inspect(
        connection
    )


    rows = (
        inspector
        .get_foreign_keys(
            TABLE_NAME
        )
    )


    result = []


    for row in rows:

        result.append({

            "name":
                row.get(
                    "name"
                ),

            "columns":
                normalize_column_names(
                    row.get(
                        "constrained_columns"
                    )
                ),

            "referred_table":
                row.get(
                    "referred_table"
                ),

            "referred_columns":
                normalize_column_names(
                    row.get(
                        "referred_columns"
                    )
                )

        })


    return result


# ============================================================
# IDENTIFIER QUOTING
# ============================================================

def quote_identifier(
    connection,
    identifier
):

    return (
        connection
        .dialect
        .identifier_preparer
        .quote(
            identifier
        )
    )


# ============================================================
# DUPLICATE CHECK
# ============================================================

def find_duplicate_unit_types(
    connection
):

    rows = (
        connection
        .execute(
            text(
                """
                SELECT
                    hostel_id,
                    unit_type,
                    COUNT(*) AS duplicate_count

                FROM mess_units

                GROUP BY
                    hostel_id,
                    unit_type

                HAVING
                    COUNT(*) > 1

                ORDER BY
                    hostel_id,
                    unit_type
                """
            )
        )
        .mappings()
        .all()
    )


    return rows


# ============================================================
# TARGET RULE CHECK
# ============================================================

def has_target_unique_rule(
    connection
):

    target_columns = (
        "hostel_id",
        "unit_type"
    )


    constraints = (
        get_unique_constraints(
            connection
        )
    )


    for constraint in constraints:

        if (
            constraint[
                "columns"
            ]
            == target_columns
        ):

            return True


    indexes = (
        get_indexes(
            connection
        )
    )


    for index in indexes:

        if (
            index[
                "unique"
            ]
            and
            index[
                "columns"
            ]
            == target_columns
        ):

            return True


    return False


# ============================================================
# OLD RULE CHECK
# ============================================================

def find_old_unique_names(
    connection
):

    old_columns = (
        "hostel_id",
        "name"
    )


    names = set()


    constraints = (
        get_unique_constraints(
            connection
        )
    )


    for constraint in constraints:

        if (
            constraint[
                "columns"
            ]
            == old_columns
            and
            constraint[
                "name"
            ]
        ):

            names.add(
                constraint[
                    "name"
                ]
            )


    indexes = (
        get_indexes(
            connection
        )
    )


    for index in indexes:

        if (
            index[
                "unique"
            ]
            and
            index[
                "columns"
            ]
            == old_columns
            and
            index[
                "name"
            ]
        ):

            names.add(
                index[
                    "name"
                ]
            )


    return sorted(
        names
    )


# ============================================================
# PRINT CURRENT SCHEMA INFO
# ============================================================

def print_schema_information(
    connection
):

    print()
    print(
        "Current unique constraints:"
    )


    constraints = (
        get_unique_constraints(
            connection
        )
    )


    if not constraints:

        print(
            "  None detected"
        )


    for constraint in constraints:

        print(
            "  "
            f"{constraint['name']} -> "
            f"{constraint['columns']}"
        )


    print()

    print(
        "Current indexes:"
    )


    indexes = (
        get_indexes(
            connection
        )
    )


    if not indexes:

        print(
            "  None detected"
        )


    for index in indexes:

        print(
            "  "
            f"{index['name']} -> "
            f"{index['columns']} "
            f"(unique={index['unique']})"
        )


    print()

    print(
        "Foreign keys:"
    )


    foreign_keys = (
        get_foreign_keys(
            connection
        )
    )


    if not foreign_keys:

        print(
            "  None detected"
        )


    for foreign_key in foreign_keys:

        print(
            "  "
            f"{foreign_key['name']} | "
            f"{foreign_key['columns']} -> "
            f"{foreign_key['referred_table']}"
            f"{foreign_key['referred_columns']}"
        )


# ============================================================
# MYSQL / MARIADB
# ============================================================

def migrate_mysql(
    engine
):

    print()
    print(
        "Running MySQL/MariaDB migration..."
    )


    # --------------------------------------------------------
    # STEP 1
    # CREATE NEW UNIQUE RULE FIRST
    #
    # IMPORTANT:
    # MySQL may currently use:
    #
    #     UNIQUE(hostel_id, name)
    #
    # as the supporting index for the hostel_id foreign key.
    #
    # Therefore we MUST create:
    #
    #     UNIQUE(hostel_id, unit_type)
    #
    # BEFORE dropping the old index.
    # --------------------------------------------------------

    with engine.begin() as connection:

        if not has_target_unique_rule(
            connection
        ):

            quoted_table = (
                quote_identifier(
                    connection,
                    TABLE_NAME
                )
            )


            quoted_constraint = (
                quote_identifier(
                    connection,
                    NEW_CONSTRAINT_NAME
                )
            )


            print()

            print(
                "Creating new unique constraint first:"
            )

            print(
                "  UNIQUE(hostel_id, unit_type)"
            )


            connection.execute(
                text(
                    f"""
                    ALTER TABLE
                        {quoted_table}

                    ADD CONSTRAINT
                        {quoted_constraint}

                    UNIQUE (
                        hostel_id,
                        unit_type
                    )
                    """
                )
            )


            print(
                "New unique constraint created."
            )


        else:

            print()

            print(
                "New unique constraint already exists:"
            )

            print(
                "  UNIQUE(hostel_id, unit_type)"
            )


    # --------------------------------------------------------
    # STEP 2
    # VERIFY NEW INDEX BEFORE DROPPING OLD
    # --------------------------------------------------------

    with engine.connect() as connection:

        if not has_target_unique_rule(
            connection
        ):

            raise RuntimeError(
                "The new unique constraint "
                "(hostel_id, unit_type) "
                "could not be verified."
            )


    # --------------------------------------------------------
    # STEP 3
    # NOW DROP OLD UNIQUE RULE
    #
    # Because the new unique index starts with hostel_id,
    # MySQL can use it for the hostel_id foreign key.
    # --------------------------------------------------------

    with engine.connect() as connection:

        old_names = (
            find_old_unique_names(
                connection
            )
        )


    if not old_names:

        print()

        print(
            "Old unique constraint is already removed."
        )


    for old_name in old_names:

        if (
            old_name
            == NEW_CONSTRAINT_NAME
        ):

            continue


        with engine.begin() as connection:

            quoted_table = (
                quote_identifier(
                    connection,
                    TABLE_NAME
                )
            )


            quoted_name = (
                quote_identifier(
                    connection,
                    old_name
                )
            )


            print()

            print(
                "Dropping old unique index:"
            )

            print(
                f"  {old_name}"
            )


            connection.execute(
                text(
                    f"""
                    ALTER TABLE
                        {quoted_table}

                    DROP INDEX
                        {quoted_name}
                    """
                )
            )


            print(
                "Old unique index removed."
            )


# ============================================================
# POSTGRESQL
# ============================================================

def migrate_postgresql(
    engine
):

    print()
    print(
        "Running PostgreSQL migration..."
    )


    # --------------------------------------------------------
    # CREATE NEW RULE
    # --------------------------------------------------------

    with engine.begin() as connection:

        if not has_target_unique_rule(
            connection
        ):

            quoted_table = (
                quote_identifier(
                    connection,
                    TABLE_NAME
                )
            )


            quoted_constraint = (
                quote_identifier(
                    connection,
                    NEW_CONSTRAINT_NAME
                )
            )


            connection.execute(
                text(
                    f"""
                    ALTER TABLE
                        {quoted_table}

                    ADD CONSTRAINT
                        {quoted_constraint}

                    UNIQUE (
                        hostel_id,
                        unit_type
                    )
                    """
                )
            )


    # --------------------------------------------------------
    # DROP OLD RULE
    # --------------------------------------------------------

    with engine.connect() as connection:

        old_names = (
            find_old_unique_names(
                connection
            )
        )


    for old_name in old_names:

        if (
            old_name
            == NEW_CONSTRAINT_NAME
        ):

            continue


        with engine.begin() as connection:

            quoted_table = (
                quote_identifier(
                    connection,
                    TABLE_NAME
                )
            )


            quoted_name = (
                quote_identifier(
                    connection,
                    old_name
                )
            )


            try:

                connection.execute(
                    text(
                        f"""
                        ALTER TABLE
                            {quoted_table}

                        DROP CONSTRAINT
                        IF EXISTS
                            {quoted_name}
                        """
                    )
                )


            except SQLAlchemyError:

                connection.execute(
                    text(
                        f"""
                        DROP INDEX
                        IF EXISTS
                            {quoted_name}
                        """
                    )
                )


# ============================================================
# SQLITE
# ============================================================

def migrate_sqlite(
    engine
):

    print()
    print(
        "Running SQLite migration..."
    )


    with engine.begin() as connection:

        if has_target_unique_rule(
            connection
        ):

            print(
                "Required unique index "
                "already exists."
            )

            return


        quoted_table = (
            quote_identifier(
                connection,
                TABLE_NAME
            )
        )


        quoted_constraint = (
            quote_identifier(
                connection,
                NEW_CONSTRAINT_NAME
            )
        )


        connection.execute(
            text(
                f"""
                CREATE UNIQUE INDEX
                IF NOT EXISTS
                    {quoted_constraint}

                ON
                    {quoted_table}
                (
                    hostel_id,
                    unit_type
                )
                """
            )
        )


        print(
            "SQLite unique index created."
        )


# ============================================================
# FINAL VERIFICATION
# ============================================================

def verify_migration(
    engine
):

    with engine.connect() as connection:

        new_rule_exists = (
            has_target_unique_rule(
                connection
            )
        )


        old_rules = (
            find_old_unique_names(
                connection
            )
        )


    return (
        new_rule_exists,
        old_rules
    )


# ============================================================
# MAIN MIGRATION
# ============================================================

def run_migration():

    print_line()

    print(
        "HOSTEL MEAL PORTAL"
    )

    print(
        "Mess Unit Unique Constraint Migration"
    )

    print_line()


    with app.app_context():

        engine = db.engine


        dialect = (
            engine
            .dialect
            .name
            .lower()
        )


        print(
            f"Database dialect: {dialect}"
        )

        print(
            f"Table: {TABLE_NAME}"
        )


        # ----------------------------------------------------
        # CHECK TABLE EXISTS
        # ----------------------------------------------------

        inspector = inspect(
            engine
        )


        table_names = (
            inspector
            .get_table_names()
        )


        if (
            TABLE_NAME
            not in table_names
        ):

            print()

            print(
                "ERROR:"
            )

            print(
                "The mess_units table "
                "does not exist."
            )

            print()

            print(
                "No database changes were made."
            )

            return


        # ----------------------------------------------------
        # DISPLAY CURRENT SCHEMA
        # ----------------------------------------------------

        with engine.connect() as connection:

            print_schema_information(
                connection
            )


        # ----------------------------------------------------
        # CHECK EXISTING DUPLICATES
        # ----------------------------------------------------

        with engine.connect() as connection:

            duplicates = (
                find_duplicate_unit_types(
                    connection
                )
            )


        if duplicates:

            print()

            print_line()

            print(
                "MIGRATION STOPPED"
            )

            print_line()

            print()

            print(
                "Duplicate Mess Unit types "
                "already exist."
            )

            print()

            print(
                "No data was deleted or modified."
            )

            print()

            print(
                "Duplicate records:"
            )


            for row in duplicates:

                print(
                    "  Hostel ID: "
                    f"{row['hostel_id']} | "
                    "Type: "
                    f"{row['unit_type']} | "
                    "Count: "
                    f"{row['duplicate_count']}"
                )


            print()

            print(
                "Resolve these duplicate records "
                "before running the migration."
            )

            return


        # ----------------------------------------------------
        # RUN DIALECT-SPECIFIC MIGRATION
        # ----------------------------------------------------

        try:

            if dialect in (
                "mysql",
                "mariadb"
            ):

                migrate_mysql(
                    engine
                )


            elif dialect in (
                "postgresql",
                "postgres"
            ):

                migrate_postgresql(
                    engine
                )


            elif dialect == "sqlite":

                migrate_sqlite(
                    engine
                )


            else:

                raise RuntimeError(
                    "Unsupported database dialect: "
                    f"{dialect}"
                )


        except Exception as error:

            print()

            print_line()

            print(
                "MIGRATION FAILED"
            )

            print_line()

            print()

            print(
                f"Error: {error}"
            )

            print()

            print(
                "Existing database records "
                "were not intentionally deleted."
            )

            print()

            raise


        # ----------------------------------------------------
        # FINAL CHECK
        # ----------------------------------------------------

        (
            new_rule_exists,
            old_rules
        ) = verify_migration(
            engine
        )


        if not new_rule_exists:

            raise RuntimeError(
                "Migration finished but "
                "UNIQUE(hostel_id, unit_type) "
                "could not be verified."
            )


        print()

        print_line()

        print(
            "MIGRATION SUCCESSFUL"
        )

        print_line()

        print()

        print(
            "Required unique rule exists:"
        )

        print(
            "  UNIQUE(hostel_id, unit_type)"
        )


        if old_rules:

            print()

            print(
                "Warning:"
            )

            print(
                "The following old unique rule(s) "
                "still exist:"
            )


            for name in old_rules:

                print(
                    f"  {name}"
                )


        else:

            print()

            print(
                "Old UNIQUE(hostel_id, name) "
                "rule has been removed."
            )


        print()

        print(
            "One Hostel can now have:"
        )

        print(
            "  North Mess -> maximum 1"
        )

        print(
            "  South Mess -> maximum 1"
        )

        print()

        print(
            "Existing Hostels and data "
            "were preserved."
        )

        print_line()


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":

    run_migration()