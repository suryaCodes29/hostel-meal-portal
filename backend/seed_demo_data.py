import argparse
from datetime import date, datetime, timedelta

from werkzeug.security import generate_password_hash  # type: ignore[reportMissingImports]

from app import app
from models import (
    db,
    User,
    Hostel,
    HostelBlock,
    MessUnit,
    Menu,
    MealResponse,
    Forecast,
    WasteRecord,
    Notification,
)


# ============================================================
# CONFIGURATION
# ============================================================

DEFAULT_PASSWORD = "Mess@123"


HOSTEL_DEFINITIONS = [
    {
        "name": "Krishna Hostel",
        "code": "KRI",
        "slug": "krishna",
        "address": "Krishna Hostel Campus",
        "contact": "9876501001",
    },
    {
        "name": "Kaveri Hostel",
        "code": "KAV",
        "slug": "kaveri",
        "address": "Kaveri Hostel Campus",
        "contact": "9876501002",
    },
    {
        "name": "Yamuna Hostel",
        "code": "YAM",
        "slug": "yamuna",
        "address": "Yamuna Hostel Campus",
        "contact": "9876501003",
    },
    {
        "name": "Ganga Hostel",
        "code": "GAN",
        "slug": "ganga",
        "address": "Ganga Hostel Campus",
        "contact": "9876501004",
    },
]


BLOCK_NAMES = [
    "Block A",
    "Block B",
    "Block C",
]


STAFF_ROLES = [
    "Supervisor",
    "Cook",
    "Helper",
    "Cleaner",
    "Supervisor",
    "Cook",
    "Store Manager",
]


STUDENT_FIRST_NAMES = [
    "Aarav",
    "Aditya",
    "Akhil",
    "Ananya",
    "Arjun",
    "Bhavana",
    "Charan",
    "Deepika",
    "Harsha",
    "Ishitha",
    "Karthik",
    "Keerthi",
    "Lokesh",
    "Madhavi",
    "Manoj",
    "Meghana",
    "Naveen",
    "Nikhil",
    "Pavani",
    "Pranav",
    "Rahul",
    "Riya",
    "Sai",
    "Sanjana",
    "Tejas",
]


STUDENT_LAST_NAMES = [
    "Reddy",
    "Kumar",
    "Naidu",
    "Rao",
    "Sharma",
]


STAFF_BASE_NAMES = [
    "Ramesh Kumar",
    "Suresh Reddy",
    "Lakshmi Devi",
    "Prakash Rao",
    "Kavitha Reddy",
    "Mohan Kumar",
    "Anitha Naidu",
]


MEALS = [
    "breakfast",
    "lunch",
    "snacks",
    "dinner",
]


MEAL_CATEGORIES = [
    "veg",
    "non-veg",
]


VEG_MENU = {
    "breakfast":
        "Idli, Sambar, Coconut Chutney, Tea",

    "lunch":
        "Rice, Dal Tadka, Vegetable Curry, "
        "Sambar, Curd, Salad",

    "snacks":
        "Vegetable Samosa, Tea",

    "dinner":
        "Chapati, Paneer Curry, Jeera Rice, "
        "Dal, Curd",
}


NON_VEG_MENU = {
    "breakfast":
        "Egg Dosa, Sambar, Chutney, Tea",

    "lunch":
        "Chicken Biryani, Chicken Curry, "
        "Dal Tadka, Raita, Salad",

    "snacks":
        "Egg Puff, Tea",

    "dinner":
        "Chapati, Chicken Curry, Jeera Rice, "
        "Dal, Curd",
}


# ============================================================
# MANAGER
# ============================================================

def get_manager(manager_email=None):
    query = (
        User.query
        .filter(
            User.role == "manager",
            User.is_active.is_(True),
        )
    )

    if manager_email:
        manager = (
            query
            .filter(
                User.email ==
                manager_email.strip().lower()
            )
            .first()
        )

        if manager is None:
            raise RuntimeError(
                "No active Manager account was found "
                f"for email: {manager_email}"
            )

        return manager

    manager = (
        query
        .order_by(User.id.asc())
        .first()
    )

    if manager is None:
        raise RuntimeError(
            "No active Manager exists in the database. "
            "Create the Manager account first."
        )

    return manager


# ============================================================
# HOSTELS
# ============================================================

def seed_hostels(manager):
    seeded_hostels = {}

    for item in HOSTEL_DEFINITIONS:

        hostel = (
            Hostel.query
            .filter_by(
                manager_user_id=manager.id,
                code=item["code"],
            )
            .first()
        )

        if hostel is None:
            hostel = Hostel(
                manager_user_id=manager.id,
                name=item["name"],
                code=item["code"],
                address=item["address"],
                contact_number=item["contact"],
                status="active",
            )

            db.session.add(hostel)
            db.session.flush()

        else:
            hostel.name = item["name"]
            hostel.address = item["address"]
            hostel.contact_number = item["contact"]
            hostel.status = "active"

        seeded_hostels[item["code"]] = hostel

    db.session.flush()

    return seeded_hostels


# ============================================================
# HOSTEL BLOCKS
# ============================================================

def seed_blocks(hostels):
    seeded_blocks = {}

    for hostel_code, hostel in hostels.items():

        seeded_blocks[hostel_code] = []

        for index, block_name in enumerate(
            BLOCK_NAMES,
            start=1,
        ):

            block = (
                HostelBlock.query
                .filter_by(
                    hostel_id=hostel.id,
                    name=block_name,
                )
                .first()
            )

            block_code = (
                f"{hostel_code}-B{index}"
            )

            if block is None:
                block = HostelBlock(
                    hostel_id=hostel.id,
                    name=block_name,
                    code=block_code,
                    status="active",
                )

                db.session.add(block)
                db.session.flush()

            else:
                block.code = block_code
                block.status = "active"

            seeded_blocks[
                hostel_code
            ].append(block)

    db.session.flush()

    return seeded_blocks


# ============================================================
# MESS UNITS
# ============================================================

def seed_mess_units(hostels):
    seeded_mess_units = {}

    for hostel_code, hostel in hostels.items():

        seeded_mess_units[
            hostel_code
        ] = {}

        definitions = [
            {
                "name": "North Mess",
                "unit_type": "north",
            },
            {
                "name": "South Mess",
                "unit_type": "south",
            },
        ]

        for item in definitions:

            mess = (
                MessUnit.query
                .filter_by(
                    hostel_id=hostel.id,
                    name=item["name"],
                )
                .first()
            )

            if mess is None:
                mess = MessUnit(
                    hostel_id=hostel.id,
                    block_id=None,
                    name=item["name"],
                    unit_type=item["unit_type"],
                    supported_categories="both",
                    capacity=300,
                    supervisor_user_id=None,
                    status="active",
                )

                db.session.add(mess)
                db.session.flush()

            else:
                mess.unit_type = (
                    item["unit_type"]
                )

                mess.supported_categories = (
                    "both"
                )

                mess.capacity = 300
                mess.status = "active"

            seeded_mess_units[
                hostel_code
            ][
                item["unit_type"]
            ] = mess

    db.session.flush()

    return seeded_mess_units


# ============================================================
# STUDENT HELPERS
# ============================================================

def build_student_name(
    hostel_index,
    student_number,
):
    first_name = (
        STUDENT_FIRST_NAMES[
            (
                student_number
                + hostel_index
                - 2
            )
            % len(
                STUDENT_FIRST_NAMES
            )
        ]
    )

    last_name = (
        STUDENT_LAST_NAMES[
            (
                student_number
                + hostel_index
                - 2
            )
            % len(
                STUDENT_LAST_NAMES
            )
        ]
    )

    return (
        f"{first_name} {last_name}"
    )


def build_student_mobile(
    hostel_index,
    student_number,
):
    number = (
        9000000000
        + hostel_index * 100
        + student_number
    )

    return str(number)


def build_staff_mobile(
    hostel_index,
    staff_number,
):
    number = (
        8000000000
        + hostel_index * 100
        + staff_number
    )

    return str(number)


# ============================================================
# STUDENTS
# ============================================================

def seed_students(
    hostels,
    blocks,
    mess_units,
):
    seeded_students = {}

    default_password_hash = (
        generate_password_hash(
            DEFAULT_PASSWORD
        )
    )

    for hostel_index, item in enumerate(
        HOSTEL_DEFINITIONS,
        start=1,
    ):

        hostel_code = item["code"]

        hostel = (
            hostels[hostel_code]
        )

        hostel_blocks = (
            blocks[hostel_code]
        )

        north_mess = (
            mess_units[
                hostel_code
            ]["north"]
        )

        south_mess = (
            mess_units[
                hostel_code
            ]["south"]
        )

        seeded_students[
            hostel_code
        ] = []

        for student_number in range(
            1,
            26,
        ):

            student_id = (
                f"{hostel_code}"
                f"-STU-"
                f"{student_number:03d}"
            )

            email = (
                f"{item['slug']}"
                f".student"
                f"{student_number:02d}"
                f"@hostel.test"
            )

            block = (
                hostel_blocks[
                    (
                        student_number
                        - 1
                    )
                    % len(
                        hostel_blocks
                    )
                ]
            )

            if student_number <= 13:
                mess = north_mess
            else:
                mess = south_mess

            if student_number % 2 == 1:
                meal_category = "veg"
            else:
                meal_category = "non-veg"

            student = (
                User.query
                .filter(
                    (
                        User.email == email
                    )
                    |
                    (
                        User.student_id ==
                        student_id
                    )
                )
                .first()
            )

            if student is None:

                student = User(
                    name=build_student_name(
                        hostel_index,
                        student_number,
                    ),

                    manager_id=None,

                    student_id=student_id,

                    staff_id=None,

                    email=email,

                    mobile=build_student_mobile(
                        hostel_index,
                        student_number,
                    ),

                    password_hash=
                        default_password_hash,

                    role="student",

                    staff_role=None,

                    hostel=hostel.name,

                    hostel_block=block.name,

                    mess_unit=mess.name,

                    meal_category=
                        meal_category,

                    hostel_id=hostel.id,

                    block_id=block.id,

                    mess_unit_id=mess.id,

                    is_active=True,

                    must_change_password=True,
                )

                db.session.add(student)
                db.session.flush()

            else:

                # Keep the student's changed password
                # if this script is run again.

                student.name = (
                    build_student_name(
                        hostel_index,
                        student_number,
                    )
                )

                student.student_id = (
                    student_id
                )

                student.role = "student"

                student.mobile = (
                    build_student_mobile(
                        hostel_index,
                        student_number,
                    )
                )

                student.hostel_id = (
                    hostel.id
                )

                student.block_id = (
                    block.id
                )

                student.mess_unit_id = (
                    mess.id
                )

                student.meal_category = (
                    meal_category
                )

                student.hostel = (
                    hostel.name
                )

                student.hostel_block = (
                    block.name
                )

                student.mess_unit = (
                    mess.name
                )

                student.is_active = True

            seeded_students[
                hostel_code
            ].append(student)

    db.session.flush()

    return seeded_students


# ============================================================
# STAFF
# ============================================================

def seed_staff(
    hostels,
    blocks,
    mess_units,
):
    seeded_staff = {}

    default_password_hash = (
        generate_password_hash(
            DEFAULT_PASSWORD
        )
    )

    for hostel_index, item in enumerate(
        HOSTEL_DEFINITIONS,
        start=1,
    ):

        hostel_code = item["code"]

        hostel = (
            hostels[hostel_code]
        )

        hostel_blocks = (
            blocks[hostel_code]
        )

        seeded_staff[
            hostel_code
        ] = []

        for staff_number in range(
            1,
            8,
        ):

            staff_id = (
                f"{hostel_code}"
                f"-STF-"
                f"{staff_number:03d}"
            )

            email = (
                f"{item['slug']}"
                f".staff"
                f"{staff_number:02d}"
                f"@hostel.test"
            )

            if staff_number <= 4:
                mess_type = "north"
            else:
                mess_type = "south"

            mess = (
                mess_units[
                    hostel_code
                ][mess_type]
            )

            block = (
                hostel_blocks[
                    (
                        staff_number
                        - 1
                    )
                    % len(
                        hostel_blocks
                    )
                ]
            )

            base_name = (
                STAFF_BASE_NAMES[
                    staff_number - 1
                ]
            )

            display_name = (
                f"{base_name} "
                f"{hostel.name.split()[0]}"
            )

            staff = (
                User.query
                .filter(
                    (
                        User.email == email
                    )
                    |
                    (
                        User.staff_id ==
                        staff_id
                    )
                )
                .first()
            )

            if staff is None:

                staff = User(
                    name=display_name,

                    manager_id=None,

                    student_id=None,

                    staff_id=staff_id,

                    email=email,

                    mobile=build_staff_mobile(
                        hostel_index,
                        staff_number,
                    ),

                    password_hash=
                        default_password_hash,

                    role="staff",

                    staff_role=
                        STAFF_ROLES[
                            staff_number
                            - 1
                        ],

                    hostel=hostel.name,

                    hostel_block=block.name,

                    mess_unit=mess.name,

                    meal_category=None,

                    hostel_id=hostel.id,

                    block_id=block.id,

                    mess_unit_id=mess.id,

                    is_active=True,

                    must_change_password=True,
                )

                db.session.add(staff)
                db.session.flush()

            else:

                # Do not overwrite a password
                # already changed by the Staff user.

                staff.name = (
                    display_name
                )

                staff.staff_id = (
                    staff_id
                )

                staff.role = "staff"

                staff.staff_role = (
                    STAFF_ROLES[
                        staff_number
                        - 1
                    ]
                )

                staff.mobile = (
                    build_staff_mobile(
                        hostel_index,
                        staff_number,
                    )
                )

                staff.hostel_id = (
                    hostel.id
                )

                staff.block_id = (
                    block.id
                )

                staff.mess_unit_id = (
                    mess.id
                )

                staff.hostel = (
                    hostel.name
                )

                staff.hostel_block = (
                    block.name
                )

                staff.mess_unit = (
                    mess.name
                )

                staff.is_active = True

            seeded_staff[
                hostel_code
            ].append(staff)

    db.session.flush()

    return seeded_staff


# ============================================================
# MESS SUPERVISORS
# ============================================================

def assign_mess_supervisors(
    mess_units,
    staff,
):
    for item in HOSTEL_DEFINITIONS:

        code = item["code"]

        hostel_staff = (
            staff[code]
        )

        north_mess = (
            mess_units[
                code
            ]["north"]
        )

        south_mess = (
            mess_units[
                code
            ]["south"]
        )

        # First Staff member belongs
        # to North Mess.

        north_mess.supervisor_user_id = (
            hostel_staff[0].id
        )

        # Fifth Staff member belongs
        # to South Mess.

        south_mess.supervisor_user_id = (
            hostel_staff[4].id
        )

    db.session.flush()


# ============================================================
# MENU HELPERS
# ============================================================

def get_menu_items(
    meal,
    category,
):
    if category == "veg":
        return VEG_MENU[meal]

    return NON_VEG_MENU[meal]


# ============================================================
# MENUS
# ============================================================

def seed_menus(
    manager,
    hostels,
    mess_units,
):
    seeded_menus = []

    today = date.today()

    for days_ago in range(
        6,
        -1,
        -1,
    ):

        menu_date = (
            today
            - timedelta(
                days=days_ago
            )
        )

        for item in (
            HOSTEL_DEFINITIONS
        ):

            code = item["code"]

            hostel = (
                hostels[code]
            )

            for mess_type in [
                "north",
                "south",
            ]:

                mess = (
                    mess_units[
                        code
                    ][mess_type]
                )

                for category in (
                    MEAL_CATEGORIES
                ):

                    for meal in MEALS:

                        menu = (
                            Menu.query
                            .filter_by(
                                hostel_id=
                                    hostel.id,

                                mess_unit_id=
                                    mess.id,

                                menu_date=
                                    menu_date,

                                meal=meal,

                                meal_category=
                                    category,
                            )
                            .first()
                        )

                        menu_items = (
                            get_menu_items(
                                meal,
                                category,
                            )
                        )

                        cutoff = (
                            datetime.combine(
                                menu_date,
                                datetime.min.time(),
                            )
                            +
                            timedelta(
                                hours=20
                            )
                        )

                        if menu is None:

                            menu = Menu(
                                hostel_id=
                                    hostel.id,

                                mess_unit_id=
                                    mess.id,

                                menu_date=
                                    menu_date,

                                meal=meal,

                                meal_category=
                                    category,

                                menu_items=
                                    menu_items,

                                response_cutoff=
                                    cutoff,

                                status=
                                    "published",

                                created_by=
                                    manager.id,
                            )

                            db.session.add(menu)
                            db.session.flush()

                        else:

                            menu.menu_items = (
                                menu_items
                            )

                            menu.response_cutoff = (
                                cutoff
                            )

                            menu.status = (
                                "published"
                            )

                            menu.created_by = (
                                manager.id
                            )

                        seeded_menus.append(
                            menu
                        )

    db.session.flush()

    return seeded_menus


# ============================================================
# MEAL RESPONSES
# ============================================================

def seed_meal_responses(
    students,
    menus,
):
    """
    Create responses only for today's
    lunch menus.

    The Manager response summary currently
    counts responses across today's menu IDs.
    Restricting the seeded responses to one
    meal prevents one Student from being
    counted four times in the summary.
    """

    today = date.today()

    hostel_code_by_id = {}

    for item in (
        HOSTEL_DEFINITIONS
    ):

        hostel = (
            Hostel.query
            .filter_by(
                code=item["code"]
            )
            .first()
        )

        if hostel:
            hostel_code_by_id[
                hostel.id
            ] = item["code"]

    for menu in menus:

        if menu.menu_date != today:
            continue

        if menu.meal != "lunch":
            continue

        hostel_code = (
            hostel_code_by_id.get(
                menu.hostel_id
            )
        )

        if hostel_code is None:
            continue

        matching_students = [
            student
            for student
            in students[
                hostel_code
            ]
            if (
                student.mess_unit_id
                == menu.mess_unit_id

                and

                student.meal_category
                == menu.meal_category
            )
        ]

        for index, student in enumerate(
            matching_students,
            start=1,
        ):

            # Every fifth student is
            # intentionally unanswered.

            if index % 5 == 0:
                continue

            response_value = (
                "skipping"
                if index % 4 == 0
                else "attending"
            )

            existing = (
                MealResponse.query
                .filter_by(
                    menu_id=menu.id,

                    student_user_id=
                        student.id,
                )
                .first()
            )

            if existing is None:

                response = (
                    MealResponse(
                        menu_id=
                            menu.id,

                        student_user_id=
                            student.id,

                        mess_unit_id=
                            menu.mess_unit_id,

                        response=
                            response_value,

                        created_at=
                            datetime.utcnow(),

                        updated_at=
                            datetime.utcnow(),
                    )
                )

                db.session.add(
                    response
                )

            else:

                existing.mess_unit_id = (
                    menu.mess_unit_id
                )

                existing.response = (
                    response_value
                )

                existing.updated_at = (
                    datetime.utcnow()
                )

    db.session.flush()


# ============================================================
# STUDENT COUNTS FOR MESS/CATEGORY
# ============================================================

def count_students(
    students,
    hostel_code,
    mess_unit_id,
    category,
):
    return len(
        [
            student
            for student
            in students[
                hostel_code
            ]
            if (
                student.mess_unit_id
                == mess_unit_id

                and

                student.meal_category
                == category
            )
        ]
    )


# ============================================================
# FORECASTS
# ============================================================

def seed_forecasts(
    hostels,
    mess_units,
    students,
):
    today = date.today()

    for day_offset in range(
        0,
        7,
    ):

        forecast_date = (
            today
            + timedelta(
                days=day_offset
            )
        )

        for item in (
            HOSTEL_DEFINITIONS
        ):

            code = item["code"]

            hostel = (
                hostels[code]
            )

            for mess_type in [
                "north",
                "south",
            ]:

                mess = (
                    mess_units[
                        code
                    ][mess_type]
                )

                for category in (
                    MEAL_CATEGORIES
                ):

                    base_students = (
                        count_students(
                            students,
                            code,
                            mess.id,
                            category,
                        )
                    )

                    for meal_index, meal in enumerate(
                        MEALS,
                        start=1,
                    ):

                        predicted = (
                            base_students
                        )

                        # Small variation makes
                        # the forecast chart useful.

                        if (
                            (
                                day_offset
                                + meal_index
                            )
                            % 3
                            == 0
                        ):

                            predicted = max(
                                predicted - 1,
                                0,
                            )

                        actual = None

                        if day_offset == 0:

                            actual = max(
                                predicted - (
                                    1
                                    if meal_index
                                    % 2 == 0
                                    else 0
                                ),
                                0,
                            )

                        forecast = (
                            Forecast.query
                            .filter_by(
                                hostel_id=
                                    hostel.id,

                                mess_unit_id=
                                    mess.id,

                                forecast_date=
                                    forecast_date,

                                meal=meal,

                                meal_category=
                                    category,
                            )
                            .first()
                        )

                        if forecast is None:

                            forecast = (
                                Forecast(
                                    hostel_id=
                                        hostel.id,

                                    mess_unit_id=
                                        mess.id,

                                    forecast_date=
                                        forecast_date,

                                    meal=meal,

                                    meal_category=
                                        category,

                                    predicted_students=
                                        predicted,

                                    actual_students=
                                        actual,

                                    preparation_status=
                                        (
                                            "in_progress"
                                            if day_offset == 0
                                            else "planned"
                                        ),

                                    updated_at=
                                        datetime.utcnow(),
                                )
                            )

                            db.session.add(
                                forecast
                            )

                        else:

                            forecast.predicted_students = (
                                predicted
                            )

                            forecast.actual_students = (
                                actual
                            )

                            forecast.preparation_status = (
                                "in_progress"
                                if day_offset == 0
                                else "planned"
                            )

                            forecast.updated_at = (
                                datetime.utcnow()
                            )

    db.session.flush()


# ============================================================
# WASTE RECORDS / MEALS SERVED
# ============================================================

def seed_waste_records(
    hostels,
    mess_units,
    students,
):
    today = date.today()

    for days_ago in range(
        6,
        -1,
        -1,
    ):

        record_date = (
            today
            - timedelta(
                days=days_ago
            )
        )

        for hostel_index, item in enumerate(
            HOSTEL_DEFINITIONS,
            start=1,
        ):

            code = item["code"]

            hostel = (
                hostels[code]
            )

            for mess_type in [
                "north",
                "south",
            ]:

                mess = (
                    mess_units[
                        code
                    ][mess_type]
                )

                for category in (
                    MEAL_CATEGORIES
                ):

                    base_students = (
                        count_students(
                            students,
                            code,
                            mess.id,
                            category,
                        )
                    )

                    for meal_index, meal in enumerate(
                        MEALS,
                        start=1,
                    ):

                        students_served = (
                            base_students
                        )

                        # Previous-day variation
                        # for seven-day chart.

                        if days_ago > 0:

                            if (
                                (
                                    days_ago
                                    + hostel_index
                                    + meal_index
                                )
                                % 4
                                == 0
                            ):

                                students_served = (
                                    max(
                                        students_served
                                        - 1,
                                        0,
                                    )
                                )

                        quantity_prepared = (
                            float(
                                students_served
                                * 0.45
                            )
                        )

                        quantity_served = (
                            float(
                                students_served
                                * 0.40
                            )
                        )

                        waste_kg = round(
                            max(
                                quantity_prepared
                                -
                                quantity_served,
                                0,
                            ),
                            2,
                        )

                        shortage = False

                        waste_record = (
                            WasteRecord.query
                            .filter_by(
                                hostel_id=
                                    hostel.id,

                                mess_unit_id=
                                    mess.id,

                                record_date=
                                    record_date,

                                meal=
                                    meal,

                                meal_category=
                                    category,
                            )
                            .first()
                        )

                        if waste_record is None:

                            waste_record = (
                                WasteRecord(
                                    hostel_id=
                                        hostel.id,

                                    mess_unit_id=
                                        mess.id,

                                    record_date=
                                        record_date,

                                    meal=
                                        meal,

                                    meal_category=
                                        category,

                                    quantity_prepared=
                                        quantity_prepared,

                                    quantity_served=
                                        quantity_served,

                                    waste_kg=
                                        waste_kg,

                                    students_served=
                                        students_served,

                                    shortage_occurred=
                                        shortage,

                                    created_at=
                                        datetime.utcnow(),
                                )
                            )

                            db.session.add(
                                waste_record
                            )

                        else:

                            waste_record.quantity_prepared = (
                                quantity_prepared
                            )

                            waste_record.quantity_served = (
                                quantity_served
                            )

                            waste_record.waste_kg = (
                                waste_kg
                            )

                            waste_record.students_served = (
                                students_served
                            )

                            waste_record.shortage_occurred = (
                                shortage
                            )

    db.session.flush()


# ============================================================
# NOTIFICATIONS
# ============================================================

def seed_notifications(manager):

    notifications = [
        {
            "type": "menu",

            "title":
                "Today's menus are published",

            "message":
                "Breakfast, lunch, snacks and "
                "dinner menus are available.",
        },
        {
            "type": "forecast",

            "title":
                "Demand forecast updated",

            "message":
                "The latest meal-demand forecast "
                "is ready for review.",
        },
        {
            "type": "response",

            "title":
                "Student responses received",

            "message":
                "Today's student attending and "
                "skipping responses are available.",
        },
        {
            "type": "waste",

            "title":
                "Waste summary updated",

            "message":
                "Today's food-waste records have "
                "been updated.",
        },
    ]

    for index, item in enumerate(
        notifications,
        start=1,
    ):

        notification = (
            Notification.query
            .filter_by(
                manager_user_id=
                    manager.id,

                title=
                    item["title"],
            )
            .first()
        )

        created_time = (
            datetime.utcnow()
            - timedelta(
                minutes=
                    index * 10
            )
        )

        if notification is None:

            notification = (
                Notification(
                    manager_user_id=
                        manager.id,

                    notification_type=
                        item["type"],

                    title=
                        item["title"],

                    message=
                        item["message"],

                    is_read=False,

                    created_at=
                        created_time,
                )
            )

            db.session.add(
                notification
            )

        else:

            notification.notification_type = (
                item["type"]
            )

            notification.message = (
                item["message"]
            )

            notification.is_read = (
                False
            )

    db.session.flush()


# ============================================================
# VERIFICATION
# ============================================================

def verify_seed(
    manager,
    hostels,
):
    print()
    print("=" * 72)
    print("HOSTEL MESS MANAGEMENT PORTAL - DEMO DATA")
    print("=" * 72)

    print(
        f"Manager: {manager.name}"
    )

    print(
        f"Email:   {manager.email}"
    )

    print()

    total_students = 0
    total_staff = 0
    total_mess = 0

    for item in HOSTEL_DEFINITIONS:

        code = item["code"]

        hostel = (
            hostels[code]
        )

        student_count = (
            User.query
            .filter(
                User.role == "student",

                User.hostel_id ==
                    hostel.id,

                User.email.like(
                    f"{item['slug']}"
                    ".student%"
                    "@hostel.test"
                ),
            )
            .count()
        )

        staff_count = (
            User.query
            .filter(
                User.role == "staff",

                User.hostel_id ==
                    hostel.id,

                User.email.like(
                    f"{item['slug']}"
                    ".staff%"
                    "@hostel.test"
                ),
            )
            .count()
        )

        mess_count = (
            MessUnit.query
            .filter_by(
                hostel_id=
                    hostel.id,

                status=
                    "active",
            )
            .count()
        )

        total_students += (
            student_count
        )

        total_staff += (
            staff_count
        )

        total_mess += (
            mess_count
        )

        print(
            f"{hostel.name:<18} | "
            f"Students: {student_count:<3} | "
            f"Staff: {staff_count:<2} | "
            f"Mess Units: {mess_count}"
        )

    print()
    print("-" * 72)

    print(
        f"Total seeded Students : "
        f"{total_students}"
    )

    print(
        f"Total seeded Staff    : "
        f"{total_staff}"
    )

    print(
        f"Active Mess Units     : "
        f"{total_mess}"
    )

    print("-" * 72)

    print()
    print("Expected:")
    print("Students   = 100")
    print("Staff      = 28")
    print("Mess Units = 8")

    print()

    print("Student test account:")
    print(
        "  Email    : "
        "krishna.student01@hostel.test"
    )
    print(
        "  Password : "
        "Mess@123"
    )

    print()

    print("Staff test account:")
    print(
        "  Email    : "
        "krishna.staff01@hostel.test"
    )
    print(
        "  Password : "
        "Mess@123"
    )

    print()
    print(
        "The seed is idempotent: "
        "running it again will update the "
        "same demo records instead of "
        "creating duplicates."
    )

    print("=" * 72)


# ============================================================
# MAIN SEED
# ============================================================

def seed(manager_email=None):

    with app.app_context():

        manager = get_manager(
            manager_email
        )

        print()
        print(
            "Using Manager:"
        )

        print(
            f"  {manager.name}"
        )

        print(
            f"  {manager.email}"
        )

        print()

        try:

            print(
                "1. Seeding Hostels..."
            )

            hostels = (
                seed_hostels(
                    manager
                )
            )


            print(
                "2. Seeding Hostel Blocks..."
            )

            blocks = (
                seed_blocks(
                    hostels
                )
            )


            print(
                "3. Seeding Mess Units..."
            )

            mess_units = (
                seed_mess_units(
                    hostels
                )
            )


            print(
                "4. Seeding 100 Students..."
            )

            students = (
                seed_students(
                    hostels,
                    blocks,
                    mess_units,
                )
            )


            print(
                "5. Seeding 28 Staff..."
            )

            staff = (
                seed_staff(
                    hostels,
                    blocks,
                    mess_units,
                )
            )


            print(
                "6. Assigning Mess supervisors..."
            )

            assign_mess_supervisors(
                mess_units,
                staff,
            )


            print(
                "7. Seeding 7 days of Menus..."
            )

            menus = (
                seed_menus(
                    manager,
                    hostels,
                    mess_units,
                )
            )


            print(
                "8. Seeding Student Responses..."
            )

            seed_meal_responses(
                students,
                menus,
            )


            print(
                "9. Seeding Forecasts..."
            )

            seed_forecasts(
                hostels,
                mess_units,
                students,
            )


            print(
                "10. Seeding Waste Records..."
            )

            seed_waste_records(
                hostels,
                mess_units,
                students,
            )


            print(
                "11. Seeding Notifications..."
            )

            seed_notifications(
                manager
            )


            db.session.commit()


            verify_seed(
                manager,
                hostels,
            )

        except Exception as error:

            db.session.rollback()

            print()
            print(
                "Seed failed."
            )

            print(
                f"Reason: {error}"
            )

            raise


# ============================================================
# COMMAND LINE
# ============================================================

if __name__ == "__main__":

    parser = argparse.ArgumentParser(
        description=(
            "Seed Hostel Mess Management "
            "Portal demo data."
        )
    )

    parser.add_argument(
        "--manager-email",
        default=None,
        help=(
            "Optional Manager email. "
            "If omitted, the first active "
            "Manager is used."
        ),
    )

    args = parser.parse_args()

    seed(
        manager_email=
            args.manager_email
    )