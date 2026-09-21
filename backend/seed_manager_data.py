from datetime import (
    date,
    datetime,
    time,
    timedelta
)

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
    WasteRecord
)


# ============================================================
# HELPERS
# ============================================================

def get_or_create_hostel(
    manager,
    name,
    code,
    address,
    contact_number
):

    hostel = (
        Hostel.query
        .filter_by(
            manager_user_id=manager.id,
            code=code
        )
        .first()
    )

    if hostel:
        return hostel


    hostel = Hostel(
        manager_user_id=manager.id,
        name=name,
        code=code,
        address=address,
        contact_number=contact_number,
        status="active"
    )

    db.session.add(hostel)
    db.session.flush()

    print(
        f"CREATED HOSTEL: {name}"
    )

    return hostel


def get_or_create_block(
    hostel,
    name,
    code
):

    block = (
        HostelBlock.query
        .filter_by(
            hostel_id=hostel.id,
            name=name
        )
        .first()
    )

    if block:
        return block


    block = HostelBlock(
        hostel_id=hostel.id,
        name=name,
        code=code,
        status="active"
    )

    db.session.add(block)
    db.session.flush()

    print(
        f"CREATED BLOCK: "
        f"{hostel.name} / {name}"
    )

    return block


def get_or_create_mess_unit(
    hostel,
    block,
    name,
    unit_type,
    supported_categories,
    capacity,
    supervisor=None
):

    mess = (
        MessUnit.query
        .filter_by(
            hostel_id=hostel.id,
            name=name
        )
        .first()
    )

    if mess:

        # Keep seed data updated.
        mess.block_id = (
            block.id
            if block
            else None
        )

        mess.unit_type = (
            unit_type
        )

        mess.supported_categories = (
            supported_categories
        )

        mess.capacity = (
            capacity
        )

        if supervisor:

            mess.supervisor_user_id = (
                supervisor.id
            )

        mess.status = "active"

        return mess


    mess = MessUnit(
        hostel_id=hostel.id,

        block_id=(
            block.id
            if block
            else None
        ),

        name=name,

        unit_type=unit_type,

        supported_categories=
            supported_categories,

        capacity=capacity,

        supervisor_user_id=(
            supervisor.id
            if supervisor
            else None
        ),

        status="active"
    )


    db.session.add(mess)
    db.session.flush()


    print(
        f"CREATED MESS UNIT: "
        f"{hostel.name} / {name}"
    )


    return mess


def assign_user(
    user,
    hostel,
    block,
    mess,
    meal_category=None,
    staff_role=None
):

    if not user:
        return


    user.hostel_id = (
        hostel.id
    )

    user.block_id = (
        block.id
    )

    user.mess_unit_id = (
        mess.id
    )


    # Keep original text fields synced.
    user.hostel = (
        hostel.name
    )

    user.hostel_block = (
        block.name
    )

    user.mess_unit = (
        mess.name
    )


    if meal_category is not None:

        user.meal_category = (
            meal_category
        )


    if staff_role is not None:

        user.staff_role = (
            staff_role
        )


def get_or_create_menu(
    manager,
    hostel,
    mess,
    menu_date,
    meal,
    category,
    menu_items,
    status="published"
):

    menu = (
        Menu.query
        .filter_by(
            hostel_id=hostel.id,

            mess_unit_id=mess.id,

            menu_date=menu_date,

            meal=meal,

            meal_category=category
        )
        .first()
    )


    cutoff = datetime.combine(
        menu_date,
        time(
            hour=21,
            minute=0
        )
    )


    if menu:

        menu.menu_items = (
            menu_items
        )

        menu.response_cutoff = (
            cutoff
        )

        menu.status = (
            status
        )

        return menu


    menu = Menu(
        hostel_id=hostel.id,

        mess_unit_id=mess.id,

        menu_date=menu_date,

        meal=meal,

        meal_category=category,

        menu_items=menu_items,

        response_cutoff=cutoff,

        status=status,

        created_by=manager.id
    )


    db.session.add(menu)
    db.session.flush()

    return menu


def get_or_create_response(
    menu,
    student,
    mess,
    response
):

    existing = (
        MealResponse.query
        .filter_by(
            menu_id=menu.id,
            student_user_id=student.id
        )
        .first()
    )


    if existing:

        existing.response = (
            response
        )

        existing.mess_unit_id = (
            mess.id
        )

        return existing


    result = MealResponse(
        menu_id=menu.id,

        student_user_id=student.id,

        mess_unit_id=mess.id,

        response=response
    )


    db.session.add(result)

    return result


def get_or_create_forecast(
    hostel,
    mess,
    forecast_date,
    meal,
    category,
    predicted,
    actual,
    status
):

    forecast = (
        Forecast.query
        .filter_by(
            hostel_id=hostel.id,

            mess_unit_id=mess.id,

            forecast_date=
                forecast_date,

            meal=meal,

            meal_category=
                category
        )
        .first()
    )


    if forecast:

        forecast.predicted_students = (
            predicted
        )

        forecast.actual_students = (
            actual
        )

        forecast.preparation_status = (
            status
        )

        return forecast


    forecast = Forecast(
        hostel_id=hostel.id,

        mess_unit_id=mess.id,

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
            status
    )


    db.session.add(forecast)

    return forecast


def get_or_create_waste_record(
    hostel,
    mess,
    record_date,
    meal,
    category,
    prepared,
    served_quantity,
    waste,
    students_served,
    shortage=False
):

    record = (
        WasteRecord.query
        .filter_by(
            hostel_id=hostel.id,

            mess_unit_id=mess.id,

            record_date=
                record_date,

            meal=meal,

            meal_category=
                category
        )
        .first()
    )


    if record:

        record.quantity_prepared = (
            prepared
        )

        record.quantity_served = (
            served_quantity
        )

        record.waste_kg = (
            waste
        )

        record.students_served = (
            students_served
        )

        record.shortage_occurred = (
            shortage
        )

        return record


    record = WasteRecord(
        hostel_id=hostel.id,

        mess_unit_id=mess.id,

        record_date=
            record_date,

        meal=meal,

        meal_category=
            category,

        quantity_prepared=
            prepared,

        quantity_served=
            served_quantity,

        waste_kg=waste,

        students_served=
            students_served,

        shortage_occurred=
            shortage
    )


    db.session.add(record)

    return record


def create_notification_if_missing(
    manager,
    notification_type,
    title,
    message
):

    notification = (
        Notification.query
        .filter_by(
            manager_user_id=
                manager.id,

            notification_type=
                notification_type,

            title=
                title,

            message=
                message
        )
        .first()
    )


    if notification:
        return notification


    notification = Notification(
        manager_user_id=
            manager.id,

        notification_type=
            notification_type,

        title=
            title,

        message=
            message,

        is_read=
            False
    )


    db.session.add(notification)

    return notification


# ============================================================
# MAIN SEED
# ============================================================

with app.app_context():

    print()
    print(
        "========================================"
    )

    print(
        "HOSTEL MEAL PORTAL - MANAGER DATA SEED"
    )

    print(
        "========================================"
    )

    print()


    # ========================================================
    # FIND MANAGER
    # ========================================================

    manager = (
        User.query
        .filter_by(
            role="manager"
        )
        .order_by(
            User.id.asc()
        )
        .first()
    )


    if manager is None:

        print(
            "ERROR: No Manager account exists."
        )

        print(
            "Create or register a Manager first, "
            "then run this seed script."
        )

        raise SystemExit(1)


    print(
        f"Using Manager: "
        f"{manager.name} "
        f"({manager.email})"
    )


    # ========================================================
    # SAMPLE USERS
    # ========================================================

    ananya = (
        User.query
        .filter_by(
            email=
                "ananya.student@hostel.test"
        )
        .first()
    )

    rahul = (
        User.query
        .filter_by(
            email=
                "rahul.student@hostel.test"
        )
        .first()
    )

    priya = (
        User.query
        .filter_by(
            email=
                "priya.student@hostel.test"
        )
        .first()
    )

    ramesh = (
        User.query
        .filter_by(
            email=
                "ramesh.staff@hostel.test"
        )
        .first()
    )

    kavitha = (
        User.query
        .filter_by(
            email=
                "kavitha.staff@hostel.test"
        )
        .first()
    )


    # ========================================================
    # PROPER USER IDS
    # ========================================================

    if ananya:

        ananya.student_id = (
            ananya.student_id
            or "STU-0001"
        )


    if rahul:

        rahul.student_id = (
            rahul.student_id
            or "STU-0002"
        )


    if priya:

        priya.student_id = (
            priya.student_id
            or "STU-0003"
        )


    if ramesh:

        ramesh.staff_id = (
            ramesh.staff_id
            or "STF-0001"
        )


    if kavitha:

        kavitha.staff_id = (
            kavitha.staff_id
            or "STF-0002"
        )


    # ========================================================
    # HOSTEL 1 - KRISHNA
    # ========================================================

    krishna = get_or_create_hostel(
        manager=manager,

        name=
            "Krishna Hostel",

        code=
            "KRH",

        address=
            "Kalasalingam Campus, "
            "Krishnankovil",

        contact_number=
            "9000010001"
    )


    krishna_block_a = (
        get_or_create_block(
            krishna,
            "Block A",
            "KRH-A"
        )
    )


    krishna_block_b = (
        get_or_create_block(
            krishna,
            "Block B",
            "KRH-B"
        )
    )


    # ========================================================
    # HOSTEL 2 - GANGA
    # ========================================================

    ganga = get_or_create_hostel(
        manager=manager,

        name=
            "Ganga Hostel",

        code=
            "GAH",

        address=
            "Kalasalingam Campus, "
            "Krishnankovil",

        contact_number=
            "9000010002"
    )


    ganga_block_a = (
        get_or_create_block(
            ganga,
            "Block A",
            "GAH-A"
        )
    )


    ganga_block_c = (
        get_or_create_block(
            ganga,
            "Block C",
            "GAH-C"
        )
    )


    # ========================================================
    # INITIAL ASSIGN STAFF BEFORE USING AS SUPERVISOR
    # ========================================================

    if ramesh:

        ramesh.staff_role = (
            "Supervisor"
        )


    if kavitha:

        kavitha.staff_role = (
            "Store Manager"
        )


    db.session.flush()


    # ========================================================
    # MESS UNITS
    # ========================================================

    krishna_north = (
        get_or_create_mess_unit(

            hostel=
                krishna,

            block=
                krishna_block_a,

            name=
                "North Mess",

            unit_type=
                "north",

            supported_categories=
                "both",

            capacity=
                350,

            supervisor=
                None
        )
    )


    krishna_south = (
        get_or_create_mess_unit(

            hostel=
                krishna,

            block=
                krishna_block_b,

            name=
                "South Mess",

            unit_type=
                "south",

            supported_categories=
                "both",

            capacity=
                400,

            supervisor=
                ramesh
        )
    )


    ganga_north = (
        get_or_create_mess_unit(

            hostel=
                ganga,

            block=
                ganga_block_a,

            name=
                "North Mess",

            unit_type=
                "north",

            supported_categories=
                "veg",

            capacity=
                250,

            supervisor=
                kavitha
        )
    )


    ganga_south = (
        get_or_create_mess_unit(

            hostel=
                ganga,

            block=
                ganga_block_c,

            name=
                "South Mess",

            unit_type=
                "south",

            supported_categories=
                "both",

            capacity=
                300,

            supervisor=
                None
        )
    )


    # ========================================================
    # ASSIGN SAMPLE STUDENTS
    # ========================================================

    if ananya:

        assign_user(

            ananya,

            krishna,

            krishna_block_b,

            krishna_south,

            meal_category=
                "non-veg"
        )


    if rahul:

        assign_user(

            rahul,

            krishna,

            krishna_block_a,

            krishna_north,

            meal_category=
                "veg"
        )


    if priya:

        assign_user(

            priya,

            ganga,

            ganga_block_a,

            ganga_north,

            meal_category=
                "veg"
        )


    # ========================================================
    # ASSIGN SAMPLE STAFF
    # ========================================================

    if ramesh:

        assign_user(

            ramesh,

            krishna,

            krishna_block_b,

            krishna_south,

            staff_role=
                "Supervisor"
        )


    if kavitha:

        assign_user(

            kavitha,

            ganga,

            ganga_block_a,

            ganga_north,

            staff_role=
                "Store Manager"
        )


    db.session.flush()


    # ========================================================
    # MENU DEFINITIONS
    # ========================================================

    MENU_ITEMS = {

        "breakfast": {

            "veg":
                "Idli, Sambar, Coconut Chutney, Tea",

            "non-veg":
                "Idli, Egg Omelette, Sambar, Tea"
        },

        "lunch": {

            "veg":
                "Vegetable Biryani, Dal, Raita, Curd",

            "non-veg":
                "Chicken Biryani, Egg, Raita, Curd"
        },

        "snacks": {

            "veg":
                "Samosa, Tea",

            "non-veg":
                "Egg Puff, Tea"
        },

        "dinner": {

            "veg":
                "Chapati, Vegetable Kurma, Rice, Curd",

            "non-veg":
                "Chapati, Chicken Curry, Rice, Curd"
        }

    }


    MEALS = [
        "breakfast",
        "lunch",
        "snacks",
        "dinner"
    ]


    # ========================================================
    # SEED SEVEN DAYS
    # ========================================================

    today = date.today()

    start_date = (
        today
        - timedelta(
            days=6
        )
    )


    for day_index in range(
        7
    ):

        current_date = (
            start_date
            + timedelta(
                days=day_index
            )
        )


        for meal_index, meal in enumerate(
            MEALS
        ):

            # ------------------------------------------------
            # KRISHNA SOUTH - NON VEG
            # Primary filter demonstration data.
            # ------------------------------------------------

            ks_nonveg_menu = (
                get_or_create_menu(

                    manager,

                    krishna,

                    krishna_south,

                    current_date,

                    meal,

                    "non-veg",

                    MENU_ITEMS[
                        meal
                    ][
                        "non-veg"
                    ],

                    status=
                        "published"
                )
            )


            predicted = (
                260
                + (
                    day_index
                    * 4
                )
                + (
                    meal_index
                    * 5
                )
            )


            actual = (
                predicted
                - 7
                + (
                    day_index
                    % 4
                )
            )


            preparation_status = (
                "completed"
                if current_date
                < today
                else "planned"
            )


            get_or_create_forecast(

                krishna,

                krishna_south,

                current_date,

                meal,

                "non-veg",

                predicted,

                actual,

                preparation_status
            )


            waste_value = round(
                4.8
                + (
                    day_index
                    * 0.25
                )
                + (
                    meal_index
                    * 0.15
                ),
                2
            )


            get_or_create_waste_record(

                krishna,

                krishna_south,

                current_date,

                meal,

                "non-veg",

                prepared=
                    round(
                        actual
                        * 0.42,
                        2
                    ),

                served_quantity=
                    round(
                        actual
                        * 0.39,
                        2
                    ),

                waste=
                    waste_value,

                students_served=
                    actual,

                shortage=
                    False
            )


            if ananya:

                response = (
                    "skipping"
                    if (
                        day_index == 2
                        and meal
                        == "dinner"
                    )
                    else "attending"
                )


                get_or_create_response(

                    ks_nonveg_menu,

                    ananya,

                    krishna_south,

                    response
                )


            # ------------------------------------------------
            # KRISHNA SOUTH - VEG
            # ------------------------------------------------

            get_or_create_menu(

                manager,

                krishna,

                krishna_south,

                current_date,

                meal,

                "veg",

                MENU_ITEMS[
                    meal
                ][
                    "veg"
                ],

                status=
                    "published"
            )


            veg_predicted = (
                135
                + (
                    day_index
                    * 3
                )
                + meal_index
            )


            veg_actual = (
                veg_predicted
                - 4
            )


            get_or_create_forecast(

                krishna,

                krishna_south,

                current_date,

                meal,

                "veg",

                veg_predicted,

                veg_actual,

                preparation_status
            )


            get_or_create_waste_record(

                krishna,

                krishna_south,

                current_date,

                meal,

                "veg",

                prepared=
                    round(
                        veg_actual
                        * 0.40,
                        2
                    ),

                served_quantity=
                    round(
                        veg_actual
                        * 0.38,
                        2
                    ),

                waste=
                    round(
                        2.5
                        + day_index
                        * 0.15,
                        2
                    ),

                students_served=
                    veg_actual,

                shortage=
                    False
            )


            # ------------------------------------------------
            # KRISHNA NORTH - VEG
            # ------------------------------------------------

            kn_menu = (
                get_or_create_menu(

                    manager,

                    krishna,

                    krishna_north,

                    current_date,

                    meal,

                    "veg",

                    MENU_ITEMS[
                        meal
                    ][
                        "veg"
                    ],

                    status=
                        "published"
                )
            )


            north_predicted = (
                185
                + day_index
                * 2
                + meal_index
            )


            north_actual = (
                north_predicted
                - 5
                + (
                    day_index
                    % 2
                )
            )


            get_or_create_forecast(

                krishna,

                krishna_north,

                current_date,

                meal,

                "veg",

                north_predicted,

                north_actual,

                preparation_status
            )


            get_or_create_waste_record(

                krishna,

                krishna_north,

                current_date,

                meal,

                "veg",

                prepared=
                    round(
                        north_actual
                        * 0.41,
                        2
                    ),

                served_quantity=
                    round(
                        north_actual
                        * 0.39,
                        2
                    ),

                waste=
                    round(
                        3.1
                        + (
                            day_index
                            * 0.12
                        ),
                        2
                    ),

                students_served=
                    north_actual,

                shortage=
                    False
            )


            if rahul:

                get_or_create_response(

                    kn_menu,

                    rahul,

                    krishna_north,

                    (
                        "skipping"
                        if (
                            day_index == 4
                            and meal
                            == "lunch"
                        )
                        else
                        "attending"
                    )
                )


            # ------------------------------------------------
            # GANGA NORTH - VEG
            # ------------------------------------------------

            gn_menu = (
                get_or_create_menu(

                    manager,

                    ganga,

                    ganga_north,

                    current_date,

                    meal,

                    "veg",

                    MENU_ITEMS[
                        meal
                    ][
                        "veg"
                    ],

                    status=
                        "published"
                )
            )


            ganga_predicted = (
                150
                + day_index
                * 3
                + meal_index
            )


            ganga_actual = (
                ganga_predicted
                - 3
            )


            get_or_create_forecast(

                ganga,

                ganga_north,

                current_date,

                meal,

                "veg",

                ganga_predicted,

                ganga_actual,

                preparation_status
            )


            get_or_create_waste_record(

                ganga,

                ganga_north,

                current_date,

                meal,

                "veg",

                prepared=
                    round(
                        ganga_actual
                        * 0.40,
                        2
                    ),

                served_quantity=
                    round(
                        ganga_actual
                        * 0.38,
                        2
                    ),

                waste=
                    round(
                        2.8
                        + day_index
                        * 0.10,
                        2
                    ),

                students_served=
                    ganga_actual,

                shortage=
                    False
            )


            if priya:

                get_or_create_response(

                    gn_menu,

                    priya,

                    ganga_north,

                    "attending"
                )


    # ========================================================
    # NEXT THREE DAYS FORECAST
    # ========================================================

    for day_offset in range(
        1,
        4
    ):

        future_date = (
            today
            + timedelta(
                days=day_offset
            )
        )


        for meal_index, meal in enumerate(
            MEALS
        ):

            predicted = (
                278
                + (
                    day_offset
                    * 4
                )
                + (
                    meal_index
                    * 3
                )
            )


            get_or_create_forecast(

                krishna,

                krishna_south,

                future_date,

                meal,

                "non-veg",

                predicted,

                None,

                "planned"
            )


    # ========================================================
    # SPECIAL DRAFT MENU
    # Demonstrates Menu Management draft.
    # ========================================================

    tomorrow = (
        today
        + timedelta(
            days=1
        )
    )


    get_or_create_menu(

        manager,

        krishna,

        krishna_south,

        tomorrow,

        "dinner",

        "veg",

        "Chapati, Paneer Curry, Rice, Curd",

        status=
            "draft"
    )


    # ========================================================
    # NOTIFICATIONS
    # ========================================================

    create_notification_if_missing(

        manager,

        "menu",

        "Menu published",

        "Tomorrow's South Mess "
        "menu has been published."
    )


    create_notification_if_missing(

        manager,

        "student_response",

        "Student responses updated",

        "New meal responses were "
        "received from students."
    )


    create_notification_if_missing(

        manager,

        "waste_alert",

        "Food waste alert",

        "South Mess Non-Veg waste "
        "is above the recent average."
    )


    create_notification_if_missing(

        manager,

        "forecast",

        "Demand forecast updated",

        "The latest ML demand forecast "
        "is now available."
    )


    create_notification_if_missing(

        manager,

        "staff",

        "Staff assignment updated",

        "Ramesh Kumar is assigned "
        "as South Mess Supervisor."
    )


    # ========================================================
    # SAVE
    # ========================================================

    try:

        db.session.commit()

    except Exception as error:

        db.session.rollback()

        print()
        print(
            "SEED FAILED:"
        )

        print(
            str(error)
        )

        raise


    # ========================================================
    # FINAL COUNTS
    # ========================================================

    print()
    print(
        "========================================"
    )

    print(
        "MANAGER DATA SEED COMPLETED"
    )

    print(
        "========================================"
    )

    print()


    print(
        "Hostels:",
        Hostel.query.filter_by(
            manager_user_id=
                manager.id
        ).count()
    )


    print(
        "Blocks:",
        HostelBlock.query.count()
    )


    print(
        "Mess Units:",
        MessUnit.query.count()
    )


    print(
        "Menus:",
        Menu.query.count()
    )


    print(
        "Responses:",
        MealResponse.query.count()
    )


    print(
        "Forecasts:",
        Forecast.query.count()
    )


    print(
        "Waste Records:",
        WasteRecord.query.count()
    )


    print(
        "Notifications:",
        Notification.query.filter_by(
            manager_user_id=
                manager.id
        ).count()
    )


    print()
    print(
        "PRIMARY TEST FILTER:"
    )

    print(
        "Krishna Hostel "
        "→ South Mess "
        "→ Non-Veg"
    )

    print()