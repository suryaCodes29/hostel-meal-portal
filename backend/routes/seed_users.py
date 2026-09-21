from werkzeug.security import (  # type: ignore[import-not-found]
    generate_password_hash
)

from app import app
from models import db, User


TEMPORARY_PASSWORD = (
    "Mess@123"
)


SAMPLE_USERS = [

    {
        "name":
            "Ananya Reddy",

        "email":
            "ananya.student@hostel.test",

        "mobile":
            "9000000001",

        "role":
            "student",

        "hostel":
            "Krishna Hostel",

        "hostel_block":
            "B",

        "mess_unit":
            "South Mess"
    },

    {
        "name":
            "Rahul Kumar",

        "email":
            "rahul.student@hostel.test",

        "mobile":
            "9000000002",

        "role":
            "student",

        "hostel":
            "Krishna Hostel",

        "hostel_block":
            "A",

        "mess_unit":
            "North Mess"
    },

    {
        "name":
            "Priya Naidu",

        "email":
            "priya.student@hostel.test",

        "mobile":
            "9000000003",

        "role":
            "student",

        "hostel":
            "Ganga Hostel",

        "hostel_block":
            "C",

        "mess_unit":
            "Veg Mess"
    },

    {
        "name":
            "Ramesh Kumar",

        "email":
            "ramesh.staff@hostel.test",

        "mobile":
            "9000000004",

        "role":
            "staff",

        "hostel":
            "Krishna Hostel",

        "hostel_block":
            "B",

        "mess_unit":
            "South Mess"
    },

    {
        "name":
            "Kavitha Reddy",

        "email":
            "kavitha.staff@hostel.test",

        "mobile":
            "9000000005",

        "role":
            "staff",

        "hostel":
            "Ganga Hostel",

        "hostel_block":
            "C",

        "mess_unit":
            "Veg Mess"
    }

]


with app.app_context():

    created_count = 0

    skipped_count = 0


    for sample in SAMPLE_USERS:

        existing_user = (

            User.query

            .filter_by(
                email=
                    sample["email"]
            )

            .first()

        )


        if existing_user:

            print(
                f"SKIPPED: "
                f"{sample['email']} "
                f"already exists."
            )

            skipped_count += 1

            continue


        new_user = User(

            name=
                sample["name"],

            manager_id=None,

            email=
                sample["email"],

            mobile=
                sample["mobile"],

            password_hash=
                generate_password_hash(
                    TEMPORARY_PASSWORD
                ),

            role=
                sample["role"],

            hostel=
                sample["hostel"],

            hostel_block=
                sample[
                    "hostel_block"
                ],

            mess_unit=
                sample[
                    "mess_unit"
                ],

            meal_category=None,

            is_active=True,

            must_change_password=True

        )


        db.session.add(
            new_user
        )

        created_count += 1


    db.session.commit()


    print()
    print(
        f"Created: {created_count}"
    )

    print(
        f"Skipped: {skipped_count}"
    )

    print(
        "Sample user seeding completed."
    )