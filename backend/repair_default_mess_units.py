import argparse

from sqlalchemy import func  # type: ignore[reportMissingImports]
from sqlalchemy.exc import IntegrityError  # type: ignore[reportMissingImports]

from app import app

from models import (
    db,
    Hostel,
    MessUnit,
    User,
)


# ============================================================
# DEFAULT MESS UNIT DEFINITIONS
# ============================================================

DEFAULT_MESS_UNITS = [
    {
        "name": "North Mess",
        "unit_type": "north",
    },
    {
        "name": "South Mess",
        "unit_type": "south",
    },
]


# ============================================================
# GET MANAGER
# ============================================================

def get_manager_by_email(
    email,
):
    if not email:
        return None


    normalized_email = (
        str(email)
        .strip()
        .lower()
    )


    manager = (
        User.query
        .filter(
            func.lower(
                User.email
            )
            ==
            normalized_email,

            User.role
            ==
            "manager",
        )
        .first()
    )


    if manager is None:
        raise RuntimeError(
            "No Manager account was found "
            f"for email: {email}"
        )


    return manager


# ============================================================
# FIND EXISTING DEFAULT MESS
# ============================================================

def find_default_mess(
    hostel_id,
    mess_name,
):
    return (
        MessUnit.query
        .filter(
            MessUnit.hostel_id
            ==
            hostel_id,

            func.lower(
                MessUnit.name
            )
            ==
            mess_name.lower(),
        )
        .first()
    )


# ============================================================
# REPAIR ONE HOSTEL
# ============================================================

def repair_hostel(
    hostel,
):
    created = []

    skipped = []


    for definition in (
        DEFAULT_MESS_UNITS
    ):

        existing = (
            find_default_mess(
                hostel.id,
                definition["name"],
            )
        )


        if existing is not None:

            skipped.append(
                definition["name"]
            )

            continue


        mess_unit = MessUnit(
            hostel_id=
                hostel.id,

            block_id=
                None,

            name=
                definition[
                    "name"
                ],

            unit_type=
                definition[
                    "unit_type"
                ],

            supported_categories=
                "both",

            capacity=
                300,

            supervisor_user_id=
                None,

            status=
                (
                    "active"
                    if hostel.status
                    == "active"
                    else "inactive"
                ),
        )


        db.session.add(
            mess_unit
        )


        # /*
        #  * Flush immediately so a duplicate
        #  * constraint failure happens before
        #  * processing the next unit.
        #  */

        db.session.flush()


        created.append(
            definition["name"]
        )


    return {
        "created":
            created,

        "skipped":
            skipped,
    }


# ============================================================
# REPAIR
# ============================================================

def repair(
    manager_email=None,
):
    with app.app_context():

        manager = (
            get_manager_by_email(
                manager_email
            )
        )


        query = (
            Hostel.query
            .order_by(
                Hostel.id.asc()
            )
        )


        if manager is not None:

            query = (
                query
                .filter(
                    Hostel.manager_user_id
                    ==
                    manager.id
                )
            )


        hostels = (
            query.all()
        )


        if not hostels:

            if manager is not None:

                print()
                print(
                    "No Hostels were found "
                    "for this Manager."
                )

                print(
                    f"Manager: "
                    f"{manager.email}"
                )

            else:

                print()
                print(
                    "No Hostels exist "
                    "in the database."
                )

            return


        print()
        print(
            "=" * 72
        )

        print(
            "DEFAULT MESS UNIT REPAIR"
        )

        print(
            "=" * 72
        )


        if manager is not None:

            print(
                f"Manager: "
                f"{manager.name}"
            )

            print(
                f"Email:   "
                f"{manager.email}"
            )

        else:

            print(
                "Scope: All existing Hostels"
            )


        print()


        total_created = 0

        total_skipped = 0

        repaired_hostels = 0


        try:

            for hostel in hostels:

                result = (
                    repair_hostel(
                        hostel
                    )
                )


                created = (
                    result[
                        "created"
                    ]
                )

                skipped = (
                    result[
                        "skipped"
                    ]
                )


                total_created += (
                    len(
                        created
                    )
                )

                total_skipped += (
                    len(
                        skipped
                    )
                )


                if created:

                    repaired_hostels += 1


                print(
                    f"{hostel.name} "
                    f"(ID {hostel.id})"
                )


                if created:

                    print(
                        "  Created:"
                    )

                    for name in created:

                        print(
                            f"    + {name}"
                        )


                if skipped:

                    print(
                        "  Already exists:"
                    )

                    for name in skipped:

                        print(
                            f"    = {name}"
                        )


                print()


            db.session.commit()


        except IntegrityError as error:

            db.session.rollback()


            print()
            print(
                "Repair failed because "
                "of a database constraint."
            )

            print(
                "No partial changes from "
                "this run were committed."
            )

            print(
                f"Details: {error}"
            )


            raise


        except Exception as error:

            db.session.rollback()


            print()
            print(
                "Repair failed."
            )

            print(
                "Changes from this run "
                "were rolled back."
            )

            print(
                f"Reason: {error}"
            )


            raise


        print(
            "-" * 72
        )

        print(
            f"Hostels checked: "
            f"{len(hostels)}"
        )

        print(
            f"Hostels repaired: "
            f"{repaired_hostels}"
        )

        print(
            f"Mess Units created: "
            f"{total_created}"
        )

        print(
            f"Existing units skipped: "
            f"{total_skipped}"
        )

        print(
            "-" * 72
        )


        print()
        print(
            "Verification:"
        )


        for hostel in hostels:

            north = (
                find_default_mess(
                    hostel.id,
                    "North Mess",
                )
            )

            south = (
                find_default_mess(
                    hostel.id,
                    "South Mess",
                )
            )


            north_status = (
                "OK"
                if north is not None
                else "MISSING"
            )

            south_status = (
                "OK"
                if south is not None
                else "MISSING"
            )


            print(
                f"{hostel.name:<25} "
                f"North Mess: "
                f"{north_status:<8} "
                f"South Mess: "
                f"{south_status}"
            )


        print()
        print(
            "Repair completed successfully."
        )

        print(
            "Running this script again "
            "will not create duplicate "
            "North/South Mess Units."
        )

        print(
            "=" * 72
        )


# ============================================================
# COMMAND LINE
# ============================================================

if __name__ == "__main__":

    parser = argparse.ArgumentParser(
        description=(
            "Add missing default North Mess "
            "and South Mess units to existing "
            "Hostels."
        )
    )


    parser.add_argument(
        "--manager-email",
        default=None,

        help=(
            "Optional Manager email. "
            "When supplied, only Hostels "
            "owned by that Manager are repaired. "
            "When omitted, all existing Hostels "
            "are checked."
        ),
    )


    args = (
        parser.parse_args()
    )


    repair(
        manager_email=
            args.manager_email
    )