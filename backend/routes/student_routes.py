from datetime import date, datetime, timedelta
from functools import wraps

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy.exc import IntegrityError

from models import (
    Hostel,
    HostelBlock,
    MealResponse,
    Menu,
    MenuNotification,
    MessUnit,
    User,
    db,
)


student_bp = Blueprint(
    "student",
    __name__,
    url_prefix="/api/student",
)


# ============================================================
# SECURITY
# ============================================================

def get_current_student():
    user_id = get_jwt_identity()

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return None

    return db.session.get(User, user_id)


def student_required(function):
    @wraps(function)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        student = get_current_student()

        if not student or student.role != "student":
            return jsonify({
                "message": "Student access required."
            }), 403

        if not student.is_active:
            return jsonify({
                "message":
                    "Your account is inactive. "
                    "Please contact the Manager."
            }), 403

        if student.must_change_password:
            return jsonify({
                "message": "Password change required."
            }), 403

        return function(*args, **kwargs)

    return decorated_function


# ============================================================
# HELPERS
# ============================================================

def parse_iso_date(value):
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def student_has_assignment(student):
    return bool(
        student.hostel_id
        and student.mess_unit_id
    )


def get_student_hostel(student):
    if not student.hostel_id:
        return None

    return db.session.get(
        Hostel,
        student.hostel_id
    )


def get_student_block(student):
    if not student.block_id:
        return None

    return db.session.get(
        HostelBlock,
        student.block_id
    )


def get_student_mess_unit(student):
    if not student.mess_unit_id:
        return None

    return db.session.get(
        MessUnit,
        student.mess_unit_id
    )


def student_menu_query(student):
    query = Menu.query.filter(
        Menu.hostel_id == student.hostel_id,
        Menu.mess_unit_id == student.mess_unit_id,
        Menu.status.in_([
            "published",
            "completed",
        ]),
    )

    meal_category = str(
        student.meal_category or ""
    ).strip().lower()

    if meal_category in {
        "veg",
        "non-veg",
    }:
        query = query.filter(
            Menu.meal_category == meal_category
        )

    return query


def get_accessible_menu(student, menu_id):
    if not student_has_assignment(student):
        return None

    return student_menu_query(student).filter(
        Menu.id == menu_id
    ).first()


def response_is_open(menu):
    if menu.status != "published":
        return (
            False,
            "Responses are closed for this Menu."
        )

    if menu.menu_date < date.today():
        return (
            False,
            "Responses are closed for past Menus."
        )

    if (
        menu.response_cutoff
        and datetime.utcnow()
        > menu.response_cutoff
    ):
        return (
            False,
            "The response cutoff time has passed."
        )

    return True, None


def serialize_menu_item(link):
    item = link.menu_item

    return {
        "id":
            item.id if item else None,

        "name":
            item.name
            if item
            else "Unavailable item",

        "type":
            item.item_type
            if item
            else "Other",

        "mealCategory":
            item.meal_category
            if item
            else None,

        "imageUrl":
            item.image_url
            if item
            else None,

        "quantityPerStudent":
            float(
                link.quantity_per_student
                or 0
            ),

        "unit":
            link.unit,

        "caloriesPerServing":
            (
                float(
                    item.calories_per_serving
                    or 0
                )
                if item
                else 0
            ),
    }


def serialize_menu(menu, student):
    meal_response = (
        MealResponse.query
        .filter_by(
            menu_id=menu.id,
            student_user_id=student.id,
        )
        .first()
    )

    items = [
        serialize_menu_item(link)
        for link in menu.item_links
    ]

    legacy_items = [
        value.strip()
        for value
        in str(
            menu.menu_items or ""
        ).split(",")
        if value.strip()
    ]

    response_open, closed_reason = (
        response_is_open(menu)
    )

    return {
        "id":
            menu.id,

        "date":
            menu.menu_date.isoformat(),

        "meal":
            menu.meal,

        "mealCategory":
            menu.meal_category,

        "status":
            menu.status,

        "items":
            items,

        "legacyItems":
            legacy_items,

        "menuItems":
            menu.menu_items or "",

        "hostel":
            (
                {
                    "id":
                        menu.hostel.id,

                    "name":
                        menu.hostel.name,

                    "code":
                        menu.hostel.code,
                }
                if menu.hostel
                else None
            ),

        "messUnit":
            (
                {
                    "id":
                        menu.mess_unit.id,

                    "name":
                        menu.mess_unit.name,

                    "type":
                        menu.mess_unit.unit_type,
                }
                if menu.mess_unit
                else None
            ),

        "responseCutoff":
            (
                menu.response_cutoff.isoformat()
                if menu.response_cutoff
                else None
            ),

        "responseOpen":
            response_open,

        "responseClosedReason":
            closed_reason,

        "myResponse":
            (
                meal_response.response
                if meal_response
                else None
            ),

        "respondedAt":
            (
                meal_response.updated_at.isoformat()
                if (
                    meal_response
                    and meal_response.updated_at
                )
                else None
            ),
    }


def serialize_notification(notification):
    return {
        "id":
            notification.id,

        "menuId":
            notification.menu_id,

        "type":
            notification.notification_type,

        "title":
            notification.title,

        "message":
            notification.message,

        "isRead":
            bool(notification.is_read),

        "createdAt":
            (
                notification.created_at.isoformat()
                if notification.created_at
                else None
            ),
    }


# ============================================================
# STUDENT DASHBOARD
# ============================================================

@student_bp.route(
    "/dashboard",
    methods=["GET"]
)
@student_required
def student_dashboard():
    student = get_current_student()

    hostel = get_student_hostel(
        student
    )

    block = get_student_block(
        student
    )

    mess_unit = get_student_mess_unit(
        student
    )

    if not student_has_assignment(student):
        return jsonify({
            "message":
                "Your Hostel and Mess Unit "
                "assignment is incomplete.",

            "assignmentRequired":
                True,

            "student": {
                "id":
                    student.id,

                "studentId":
                    student.student_id,

                "name":
                    student.name,

                "email":
                    student.email,

                "mealCategory":
                    student.meal_category,
            },

            "menus":
                [],

            "summary": {
                "availableMenus":
                    0,

                "attending":
                    0,

                "skipping":
                    0,

                "pending":
                    0,

                "unreadNotifications":
                    0,
            },
        }), 200

    today = date.today()
    end_date = today + timedelta(days=7)

    menus = (
        student_menu_query(student)
        .filter(
            Menu.menu_date >= today,
            Menu.menu_date <= end_date,
        )
        .order_by(
            Menu.menu_date.asc(),
            Menu.meal.asc(),
        )
        .all()
    )

    menu_ids = [
        menu.id
        for menu in menus
    ]

    if menu_ids:
        responses = {
            row.menu_id: row.response
            for row
            in MealResponse.query.filter(
                MealResponse.student_user_id
                == student.id,

                MealResponse.menu_id.in_(
                    menu_ids
                ),
            ).all()
        }
    else:
        responses = {}

    attending = sum(
        1
        for value in responses.values()
        if value == "attending"
    )

    skipping = sum(
        1
        for value in responses.values()
        if value == "skipping"
    )

    unread_notifications = (
        MenuNotification.query
        .filter_by(
            recipient_user_id=student.id,
            is_read=False,
        )
        .count()
    )

    return jsonify({
        "student": {
            "id":
                student.id,

            "studentId":
                student.student_id,

            "name":
                student.name,

            "email":
                student.email,

            "mobile":
                student.mobile,

            "mealCategory":
                student.meal_category,

            "hostel":
                (
                    {
                        "id":
                            hostel.id,

                        "name":
                            hostel.name,
                    }
                    if hostel
                    else None
                ),

            "block":
                (
                    {
                        "id":
                            block.id,

                        "name":
                            block.name,
                    }
                    if block
                    else None
                ),

            "messUnit":
                (
                    {
                        "id":
                            mess_unit.id,

                        "name":
                            mess_unit.name,

                        "type":
                            mess_unit.unit_type,
                    }
                    if mess_unit
                    else None
                ),
        },

        "menus": [
            serialize_menu(
                menu,
                student
            )
            for menu in menus
        ],

        "summary": {
            "availableMenus":
                len(menus),

            "attending":
                attending,

            "skipping":
                skipping,

            "pending":
                len(menus) - len(responses),

            "unreadNotifications":
                unread_notifications,
        },
    }), 200


# ============================================================
# STUDENT MENUS
# ============================================================

@student_bp.route(
    "/menus",
    methods=["GET"]
)
@student_required
def list_student_menus():
    student = get_current_student()

    if not student_has_assignment(student):
        return jsonify({
            "message":
                "Your Hostel and Mess Unit "
                "assignment is incomplete.",

            "menus":
                [],
        }), 200

    start_date = parse_iso_date(
        request.args.get(
            "dateFrom",
            date.today().isoformat()
        )
    )

    end_date = parse_iso_date(
        request.args.get(
            "dateTo",
            (
                date.today()
                + timedelta(days=7)
            ).isoformat(),
        )
    )

    if not start_date or not end_date:
        return jsonify({
            "message":
                "Dates must use YYYY-MM-DD format."
        }), 400

    if end_date < start_date:
        return jsonify({
            "message":
                "dateTo cannot be earlier than dateFrom."
        }), 400

    if (
        end_date - start_date
    ).days > 31:
        return jsonify({
            "message":
                "You can request a maximum "
                "range of 31 days."
        }), 400

    menus = (
        student_menu_query(student)
        .filter(
            Menu.menu_date >= start_date,
            Menu.menu_date <= end_date,
        )
        .order_by(
            Menu.menu_date.asc(),
            Menu.meal.asc(),
        )
        .all()
    )

    return jsonify({
        "menus": [
            serialize_menu(
                menu,
                student
            )
            for menu in menus
        ],

        "dateFrom":
            start_date.isoformat(),

        "dateTo":
            end_date.isoformat(),
    }), 200


# ============================================================
# SAVE OR UPDATE MEAL RESPONSE
# ============================================================

@student_bp.route(
    "/menus/<int:menu_id>/response",
    methods=["PUT"]
)
@student_required
def save_meal_response(menu_id):
    student = get_current_student()

    if not student_has_assignment(student):
        return jsonify({
            "message":
                "Your Hostel and Mess Unit "
                "assignment is incomplete."
        }), 409

    menu = get_accessible_menu(
        student,
        menu_id
    )

    if not menu:
        return jsonify({
            "message":
                "Menu not found."
        }), 404

    response_open, closed_reason = (
        response_is_open(menu)
    )

    if not response_open:
        return jsonify({
            "message":
                closed_reason
        }), 409

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    response_value = (
        str(
            data.get(
                "response",
                ""
            )
        )
        .strip()
        .lower()
    )

    if response_value not in {
        "attending",
        "skipping",
    }:
        return jsonify({
            "message":
                "Response must be "
                "attending or skipping."
        }), 400

    meal_response = (
        MealResponse.query
        .filter_by(
            menu_id=menu.id,
            student_user_id=student.id,
        )
        .first()
    )

    created = meal_response is None

    if created:
        meal_response = MealResponse(
            menu_id=
                menu.id,

            student_user_id=
                student.id,

            mess_unit_id=
                student.mess_unit_id,

            response=
                response_value,
        )

        db.session.add(
            meal_response
        )

    else:
        meal_response.response = (
            response_value
        )

        meal_response.mess_unit_id = (
            student.mess_unit_id
        )

    try:
        db.session.commit()

    except IntegrityError:
        db.session.rollback()

        return jsonify({
            "message":
                "Your response was already updated. "
                "Please refresh."
        }), 409

    except Exception as error:
        db.session.rollback()

        print(
            "Student meal response error:",
            error
        )

        return jsonify({
            "message":
                "Unable to save your response. "
                "No changes were saved."
        }), 500

    return jsonify({
        "message":
            (
                "Meal response submitted successfully."
                if created
                else "Meal response updated successfully."
            ),

        "response": {
            "id":
                meal_response.id,

            "menuId":
                meal_response.menu_id,

            "value":
                meal_response.response,

            "updatedAt":
                (
                    meal_response.updated_at.isoformat()
                    if meal_response.updated_at
                    else None
                ),
        },
    }), 201 if created else 200


# ============================================================
# RESPONSE HISTORY
# ============================================================

@student_bp.route(
    "/responses",
    methods=["GET"]
)
@student_required
def list_my_responses():
    student = get_current_student()

    responses = (
        MealResponse.query
        .join(
            Menu,
            MealResponse.menu_id == Menu.id,
        )
        .filter(
            MealResponse.student_user_id
            == student.id,
        )
        .order_by(
            Menu.menu_date.desc(),
            Menu.meal.asc(),
        )
        .limit(100)
        .all()
    )

    return jsonify({
        "responses": [
            {
                "id":
                    row.id,

                "menuId":
                    row.menu_id,

                "date":
                    row.menu.menu_date.isoformat(),

                "meal":
                    row.menu.meal,

                "mealCategory":
                    row.menu.meal_category,

                "response":
                    row.response,

                "updatedAt":
                    (
                        row.updated_at.isoformat()
                        if row.updated_at
                        else None
                    ),
            }
            for row in responses
        ]
    }), 200


# ============================================================
# NOTIFICATIONS
# ============================================================

@student_bp.route(
    "/notifications",
    methods=["GET"]
)
@student_required
def list_student_notifications():
    student = get_current_student()

    notifications = (
        MenuNotification.query
        .filter_by(
            recipient_user_id=student.id
        )
        .order_by(
            MenuNotification.created_at.desc()
        )
        .limit(100)
        .all()
    )

    return jsonify({
        "notifications": [
            serialize_notification(
                notification
            )
            for notification in notifications
        ],

        "unreadCount":
            sum(
                1
                for notification
                in notifications
                if not notification.is_read
            ),
    }), 200


@student_bp.route(
    "/notifications/<int:notification_id>/read",
    methods=["PATCH"],
)
@student_required
def mark_student_notification_read(
    notification_id
):
    student = get_current_student()

    notification = (
        MenuNotification.query
        .filter_by(
            id=notification_id,
            recipient_user_id=student.id,
        )
        .first()
    )

    if not notification:
        return jsonify({
            "message":
                "Notification not found."
        }), 404

    try:
        notification.is_read = True
        db.session.commit()

    except Exception as error:
        db.session.rollback()

        print(
            "Student notification update error:",
            error
        )

        return jsonify({
            "message":
                "Unable to update the Notification."
        }), 500

    return jsonify({
        "message":
            "Notification marked as read."
    }), 200


@student_bp.route(
    "/notifications/read-all",
    methods=["PATCH"]
)
@student_required
def mark_all_student_notifications_read():
    student = get_current_student()

    try:
        updated_count = (
            MenuNotification.query
            .filter_by(
                recipient_user_id=student.id,
                is_read=False,
            )
            .update(
                {
                    MenuNotification.is_read:
                        True
                },
                synchronize_session=False,
            )
        )

        db.session.commit()

    except Exception as error:
        db.session.rollback()

        print(
            "Student notifications update error:",
            error
        )

        return jsonify({
            "message":
                "Unable to update Notifications."
        }), 500

    return jsonify({
        "message":
            "All Notifications marked as read.",

        "updatedCount":
            int(
                updated_count
                or 0
            ),
    }), 200