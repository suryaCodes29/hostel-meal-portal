from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from functools import wraps
import csv
import io
import os
import uuid
from config import Config
from flask import Blueprint, current_app, jsonify, request, Response
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import or_, and_, func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from werkzeug.utils import secure_filename
from services.meal_qr_service import generate_meal_qr_token
from models import (
    Announcement,
    AnnouncementRead,
    Hostel,
    HostelBlock,
    MealResponse,
    MealQRToken,
    MealQRVerification,
    Menu,
    MenuMenuItem,
    MenuNotification,
    MessUnit,
    StudentFeedback,
    StudentSettings,
    User,
    db,
)


student_bp = Blueprint("student", __name__, url_prefix="/api/student")

ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png"}
FEEDBACK_CATEGORIES = {"Food Quality", "Taste", "Hygiene", "Quantity", "Service", "Other"}
MEALS = {"breakfast", "lunch", "snacks", "dinner"}
RESPONSES = {"attending", "skipping"}


# ============================================================
# SECURITY
# ============================================================

def get_current_student():
    raw_identity = get_jwt_identity()
    try:
        user_id = int(raw_identity)
    except (TypeError, ValueError):
        return None
    return db.session.get(User, user_id)


def student_required(function):
    @wraps(function)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        student = get_current_student()
        if not student or student.role != "student":
            return jsonify({"message": "Student access required."}), 403
        if not student.is_active:
            return jsonify({"message": "Your account is inactive. Please contact the Manager."}), 403
        if student.must_change_password:
            return jsonify({"message": "Password change required."}), 403
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
APP_TZ = ZoneInfo(Config.APP_TIMEZONE)


def get_local_now():
    """Get the current time in the application timezone."""
    return datetime.now(APP_TZ)


def get_meal_schedule(menu):
    """
    Central meal schedule in the configured application timezone.
    Response deadline is exactly two hours before meal start.
    """

    schedule = {
        "breakfast": ("07:00", "09:00"),
        "lunch": ("12:00", "14:00"),
        "snacks": ("16:00", "17:00"),
        "dinner": ("19:00", "21:00"),
    }

    meal_times = schedule.get(
        str(menu.meal or "").lower()
    )

    if not meal_times:
        return None, None, None

    start_text, end_text = meal_times

    start_time = datetime.strptime(
        start_text,
        "%H:%M"
    ).time()

    end_time = datetime.strptime(
        end_text,
        "%H:%M"
    ).time()

    meal_start = datetime.combine(
        menu.menu_date,
        start_time
    ).replace(tzinfo=APP_TZ)

    meal_end = datetime.combine(
        menu.menu_date,
        end_time
    ).replace(tzinfo=APP_TZ)

    response_deadline = meal_start - timedelta(hours=3)

    return meal_start, response_deadline, meal_end
def parse_rating(value, field_name, required=False):
    if value is None or value == "":
        if required:
            return None, f"{field_name} is required."
        return None, None

    try:
        rating = float(value)
    except (TypeError, ValueError):
        return None, f"{field_name} must be a number between 1 and 5."

    if not (1 <= rating <= 5):
        return None, f"{field_name} must be between 1 and 5."

    return round(rating, 1), None


def student_has_assignment(student):
    return bool(student.hostel_id and student.mess_unit_id and student.meal_category)


def get_student_hostel(student):
    return db.session.get(Hostel, student.hostel_id) if student.hostel_id else None


def get_student_block(student):
    return db.session.get(HostelBlock, student.block_id) if student.block_id else None


def get_student_mess_unit(student):
    return db.session.get(MessUnit, student.mess_unit_id) if student.mess_unit_id else None


def assignment_payload(student):
    hostel = get_student_hostel(student)
    block = get_student_block(student)
    mess = get_student_mess_unit(student)
    return {
        "hostel": {"id": hostel.id, "name": hostel.name, "code": hostel.code} if hostel else None,
        "block": {"id": block.id, "name": block.name, "code": block.code} if block else None,
        "messUnit": {"id": mess.id, "name": mess.name, "type": mess.unit_type} if mess else None,
        "mealCategory": student.meal_category,
        "complete": student_has_assignment(student),
    }


def student_menu_query(student):
    """
    Return only published menus assigned to this student's
    hostel and mess unit.

    This preserves student access restrictions.
    """

    if not student or not student.hostel_id or not student.mess_unit_id:
        return Menu.query.filter(Menu.id == -1)

    query = Menu.query.filter(
        Menu.hostel_id == student.hostel_id,
        Menu.mess_unit_id == student.mess_unit_id,
        Menu.status.in_(["published", "completed"]),
    )

    category = str(student.meal_category or "").strip().lower()

    if category in {"veg", "vegetarian"}:
        query = query.filter(
            Menu.meal_category.in_(["veg", "vegetarian"])
        )

    elif category in {"non-veg", "non vegetarian", "nonvegetarian"}:
        query = query.filter(
            Menu.meal_category.in_(
                ["non-veg", "non vegetarian", "nonvegetarian"]
            )
        )

    return query

def get_accessible_menu(student, menu_id, published_only=True):
    """
    Fetch a menu only if it belongs to the student's
    assigned hostel and mess unit.
    """

    if not student_has_assignment(student):
        return None

    query = Menu.query.filter(
        Menu.id == menu_id,
        Menu.hostel_id == student.hostel_id,
        Menu.mess_unit_id == student.mess_unit_id,
    )

    if published_only:
        query = query.filter(
            Menu.status.in_(["published", "completed"])
        )

        category = str(student.meal_category or "").strip().lower()

        if category in {"veg", "vegetarian"}:
            query = query.filter(
                Menu.meal_category.in_(["veg", "vegetarian"])
            )

        elif category in {"non-veg", "non vegetarian", "nonvegetarian"}:
            query = query.filter(
                Menu.meal_category.in_(
                    ["non-veg", "non vegetarian", "nonvegetarian"]
                )
            )

    return query.first()


def response_is_open(menu):
    if menu.status != "published":
        return False, "Responses are closed for this menu."

    meal_start, response_deadline, meal_end = get_meal_schedule(menu)

    if not meal_start or not response_deadline or not meal_end:
        return False, "Meal start and end times have not been configured."

    now = get_local_now()

    if now.date() > menu.menu_date:
        return False, "Responses are closed for past meals."

    if now >= response_deadline:
        return False, "The 3-hour meal response deadline has passed."

    return True, None

def response_is_open_deadline(menu):
    _, response_deadline, _ = get_meal_schedule(menu)
    return response_deadline

def serialize_menu_item(link):
    item = link.menu_item
    return {
        "id": item.id if item else None,
        "name": item.name if item else "Unavailable item",
        "type": item.item_type if item else "Other",
        "mealCategory": item.meal_category if item else None,
        "imageUrl": item.image_url if item else None,
        "quantityPerStudent": float(link.quantity_per_student or 0),
        "unit": link.unit,
        "caloriesPerServing": float(item.calories_per_serving or 0) if item else 0,
    }


def menu_item_names(menu):
    structured = [link.menu_item.name for link in menu.item_links if link.menu_item]
    if structured:
        return structured
    return [x.strip() for x in str(menu.menu_items or "").split(",") if x.strip()]


def serialize_menu(menu, student):
    meal_response = MealResponse.query.filter_by(menu_id=menu.id, student_user_id=student.id).first()
    qr_verification = (
        MealQRVerification.query
        .filter_by(
            menu_id=menu.id,
            student_user_id=student.id,
            verification_status="approved",
        )
        .order_by(MealQRVerification.verified_at.desc())
        .first()
    )
    response_open, closed_reason = response_is_open(menu)
    meal_start, response_deadline, meal_end = get_meal_schedule(menu)
    now = get_local_now()
    qr_verified_at = qr_verification.verified_at if qr_verification else None
    if qr_verified_at:
        if qr_verified_at.tzinfo is None:
            qr_verified_at = qr_verified_at.replace(tzinfo=timezone.utc)
        qr_verified_at = qr_verified_at.astimezone(APP_TZ)
    if now >= meal_end:
        session_status = "completed"
    elif now < meal_start:
        session_status = "upcoming"
    else:
        session_status = "active"
    return {
        "id": menu.id,
        "date": menu.menu_date.isoformat(),
        "meal": menu.meal,
        "mealCategory": menu.meal_category,
        "status": menu.status,
        "items": [serialize_menu_item(link) for link in menu.item_links],
        "menuItems": menu.menu_items or "",
        "itemNames": menu_item_names(menu),
        "hostel": {"id": menu.hostel.id, "name": menu.hostel.name, "code": menu.hostel.code} if menu.hostel else None,
        "messUnit": {"id": menu.mess_unit.id, "name": menu.mess_unit.name, "type": menu.mess_unit.unit_type} if menu.mess_unit else None,
        "startTime": meal_start.strftime("%H:%M") if meal_start else None,
        "endTime": meal_end.strftime("%H:%M") if meal_end else None,
        "qrOpenTime": (
            (meal_start - timedelta(minutes=10)).isoformat()
            if meal_start else None
        ),

        "responseDeadline": (
            response_deadline.isoformat()
            if response_deadline else None
        ),

        "responseCutoff": (
            response_deadline.isoformat()
            if response_deadline else None
        ),
        "responseOpen": response_open,
        "responseClosedReason": closed_reason,
        "mealStart": meal_start.isoformat() if meal_start else None,
        "mealEnd": meal_end.isoformat() if meal_end else None,
        "sessionStatus": session_status,
        "myResponse": meal_response.response if meal_response else None,
        "respondedAt": meal_response.updated_at.isoformat() if meal_response and meal_response.updated_at else None,
        "qrAttendance": {
            "status": "scanned",
            "verifiedAt": qr_verified_at.isoformat(),
        } if qr_verification else None,
    }


def active_student_menu(menu):
    meal_start, _, meal_end = get_meal_schedule(menu)
    if not meal_end:
        return False
    return get_local_now() < meal_end


def serialize_notification(notification):
    return {
        "id": notification.id,
        "menuId": notification.menu_id,
        "type": notification.notification_type,
        "title": notification.title,
        "message": notification.message,
        "isRead": bool(notification.is_read),
        "createdAt": notification.created_at.isoformat() if notification.created_at else None,
    }


def serialize_announcement(announcement, student, read_ids=None):
    read_ids = read_ids or set()
    return {
        "id": announcement.id,
        "title": announcement.title,
        "message": announcement.message,
        "sender": announcement.sender_name or (announcement.manager.name if announcement.manager else "Manager"),
        "publishedAt": announcement.published_at.isoformat() if announcement.published_at else None,
        "priority": announcement.priority,
        "attachmentUrl": announcement.attachment_url,
        "isRead": announcement.id in read_ids,
        "scope": {
            "general": bool(announcement.is_general),
            "hostelId": announcement.hostel_id,
            "messUnitId": announcement.mess_unit_id,
            "mealCategory": announcement.meal_category,
            "recipientUserId": announcement.recipient_user_id,
        },
    }


def serialize_feedback(feedback):
    return {
        "id": feedback.id,
        "date": (
            feedback.meal_date.isoformat()
            if feedback.meal_date else None
        ),
        "meal": feedback.meal,
        "category": feedback.category,
        "overallRating": feedback.overall_rating,
        "tasteRating": feedback.taste_rating,
        "hygieneRating": feedback.hygiene_rating,
        "quantityRating": feedback.quantity_rating,
        "comments": feedback.comments or "",
        "photoUrl": feedback.photo_path,
        "status": feedback.status,
        "staffReply": feedback.staff_reply,
        "replyDate": feedback.replied_at.isoformat() if feedback.replied_at else None,
        "createdAt": feedback.created_at.isoformat() if feedback.created_at else None,
    }


def serialize_student(student):
    assignment = assignment_payload(student)
    return {
        "id": student.id,
        "studentId": student.student_id,
        "name": student.name,
        "email": student.email,
        "mobile": student.mobile,
        "role": student.role,
        "isActive": bool(student.is_active),
        "accountStatus": "Active" if student.is_active else "Inactive",
        "createdAt": student.created_at.isoformat() if student.created_at else None,
        "assignment": assignment,
        "hostel": assignment["hostel"],
        "block": assignment["block"],
        "messUnit": assignment["messUnit"],
        "mealCategory": assignment["mealCategory"],
    }


def ensure_settings(student):
    settings = StudentSettings.query.filter_by(student_user_id=student.id).first()
    if settings:
        return settings
    settings = StudentSettings(student_user_id=student.id)
    db.session.add(settings)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        settings = StudentSettings.query.filter_by(student_user_id=student.id).first()
    return settings


def serialize_settings(settings):
    return {
        "notificationsEnabled": bool(settings.notifications_enabled),
        "menuPublicationNotifications": bool(settings.menu_publication_notifications),
        "responseCutoffReminders": bool(settings.response_cutoff_reminders),
        "announcementNotifications": bool(settings.announcement_notifications),
        "theme": settings.theme,
    }

def announcement_scope_filter(student):
    """Return only announcements intended for this student."""

    hostel = (
        db.session.get(Hostel, student.hostel_id)
        if student.hostel_id
        else None
    )

    # Do not expose announcements when the student's manager
    # cannot be established.
    if not hostel or not hostel.manager_user_id:
        return Announcement.id == -1

    return and_(
        Announcement.manager_user_id == hostel.manager_user_id,
        or_(
            # General announcements from this manager
            Announcement.is_general.is_(True),

            # Direct announcements for this student
            Announcement.recipient_user_id == student.id,

            # Announcements for the entire hostel
            and_(
                Announcement.is_general.is_(False),
                Announcement.recipient_user_id.is_(None),
                Announcement.hostel_id == student.hostel_id,
                Announcement.mess_unit_id.is_(None),
                Announcement.meal_category.is_(None),
            ),

            # Announcements for the student's mess
            and_(
                Announcement.is_general.is_(False),
                Announcement.recipient_user_id.is_(None),
                Announcement.hostel_id == student.hostel_id,
                Announcement.mess_unit_id == student.mess_unit_id,
                Announcement.meal_category.is_(None),
            ),

            # Announcements for the student's meal category
            and_(
                Announcement.is_general.is_(False),
                Announcement.recipient_user_id.is_(None),
                Announcement.hostel_id == student.hostel_id,
                Announcement.mess_unit_id.is_(None),
                Announcement.meal_category == student.meal_category,
            ),
        ),
    )

# ============================================================
# DASHBOARD
# ============================================================

@student_bp.route("/dashboard", methods=["GET"])
@student_required
def student_dashboard():
    student = get_current_student()
    if not student_has_assignment(student):
        return jsonify({
            "student": serialize_student(student),
            "assignmentRequired": True,
            "menus": [],
            "summary": {"availableMenus": 0, "attending": 0, "skipping": 0, "pending": 0, "unreadNotifications": 0, "unreadAnnouncements": 0},
        }), 200

    today = get_local_now().date()
    menus = student_menu_query(student).filter(Menu.menu_date == today).order_by(Menu.meal.asc()).all()
    menus = [menu for menu in menus if active_student_menu(menu)]
    response_rows = MealResponse.query.filter(
        MealResponse.student_user_id == student.id,
        MealResponse.menu_id.in_([m.id for m in menus]) if menus else False,
    ).all() if menus else []
    response_map = {r.menu_id: r.response for r in response_rows}
    unread_notifications = MenuNotification.query.filter_by(recipient_user_id=student.id, is_read=False).count()
    announcements = Announcement.query.filter(
        Announcement.status == "published",
        announcement_scope_filter(student),
    ).order_by(Announcement.published_at.desc()).limit(20).all()
    read_ids = {r.announcement_id for r in AnnouncementRead.query.filter_by(student_user_id=student.id).all()}
    unread_announcements = sum(1 for a in announcements if a.id not in read_ids)
    upcoming = student_menu_query(student).filter(Menu.menu_date >= today).order_by(Menu.response_cutoff.asc()).all()
    next_cutoff = next((m.response_cutoff for m in upcoming if m.response_cutoff and m.status == "published" and m.response_cutoff >= datetime.utcnow()), None)

    return jsonify({
        "student": serialize_student(student),
        "assignmentRequired": False,
        "today": today.isoformat(),
        "menus": [serialize_menu(m, student) for m in menus],
        "summary": {
            "availableMenus": len(menus),
            "attending": sum(1 for v in response_map.values() if v == "attending"),
            "skipping": sum(1 for v in response_map.values() if v == "skipping"),
            "pending": len(menus) - len(response_map),
            "unreadNotifications": unread_notifications,
            "unreadAnnouncements": unread_announcements,
        },
        "nextResponseCutoff": next_cutoff.isoformat() if next_cutoff else None,
        "recentAnnouncement": serialize_announcement(announcements[0], student, read_ids) if announcements else None,
    }), 200


# ============================================================
# PROFILE
# ============================================================

@student_bp.route("/profile", methods=["GET"])
@student_required
def get_student_profile():
    return jsonify({"student": serialize_student(get_current_student())}), 200


@student_bp.route("/profile", methods=["PATCH"])
@student_required
def update_student_profile():
    student = get_current_student()
    data = request.get_json(silent=True) or {}
    if "studentId" in data or "email" in data or "role" in data or "managerId" in data or "hostelId" in data or "blockId" in data or "messUnitId" in data or "mealCategory" in data:
        return jsonify({"message": "Student ID, email, role and assignment fields cannot be changed here."}), 400
    if "name" in data:
        name = str(data.get("name") or "").strip()
        if not name or len(name) > 100:
            return jsonify({"message": "Name is invalid."}), 400
        student.name = name
    if "mobile" in data:
        mobile = str(data.get("mobile") or "").strip()
        if len(mobile) > 15:
            return jsonify({"message": "Mobile number is too long."}), 400
        student.mobile = mobile or None
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"message": "Unable to update profile."}), 500
    return jsonify({"message": "Profile updated successfully.", "student": serialize_student(student)}), 200


# ============================================================
# MENUS
# ============================================================

@student_bp.route("/menus", methods=["GET"])
@student_required
def list_student_menus():
    student = get_current_student()
    if not student_has_assignment(student):
        return jsonify({"message": "Your hostel or mess assignment is incomplete. Please contact your Manager.", "assignmentRequired": True, "menus": []}), 200
    start_date = parse_iso_date(request.args.get("dateFrom", get_local_now().date().isoformat()))
    end_date = parse_iso_date(request.args.get("dateTo", (get_local_now().date() + timedelta(days=7)).isoformat()))
    if not start_date or not end_date:
        return jsonify({"message": "Dates must use YYYY-MM-DD format."}), 400
    if end_date < start_date:
        return jsonify({"message": "dateTo cannot be earlier than dateFrom."}), 400
    if (end_date - start_date).days > 31:
        return jsonify({"message": "You can request a maximum range of 31 days."}), 400
    menus = student_menu_query(student).filter(Menu.menu_date.between(start_date, end_date)).order_by(Menu.menu_date.asc(), Menu.meal.asc()).all()
    scanned_menu_ids = set()
    menu_ids = [menu.id for menu in menus]
    if menu_ids:
        scanned_menu_ids = {
            row[0]
            for row in db.session.query(MealQRVerification.menu_id)
            .filter(
                MealQRVerification.student_user_id == student.id,
                MealQRVerification.verification_status == "approved",
                MealQRVerification.menu_id.in_(menu_ids),
            )
            .distinct()
            .all()
        }
    menus = [
        menu for menu in menus
        if menu.menu_date > get_local_now().date()
        or active_student_menu(menu)
        or menu.id in scanned_menu_ids
    ]
    return jsonify({"menus": [serialize_menu(m, student) for m in menus], "dateFrom": start_date.isoformat(), "dateTo": end_date.isoformat()}), 200


@student_bp.route("/menus/today", methods=["GET"])
@student_required
def today_menus():
    student = get_current_student()
    if not student_has_assignment(student):
        return jsonify({"assignmentRequired": True, "date": get_local_now().date().isoformat(), "menus": []}), 200
    menus = student_menu_query(student).filter(Menu.menu_date == get_local_now().date()).order_by(Menu.meal.asc()).all()
    menus = [menu for menu in menus if active_student_menu(menu)]
    return jsonify({"date": get_local_now().date().isoformat(), "menus": [serialize_menu(m, student) for m in menus]}), 200


@student_bp.route("/menus/calendar", methods=["GET"])
@student_required
def menu_calendar():
    student = get_current_student()
    if not student_has_assignment(student):
        return jsonify({"assignmentRequired": True, "menus": []}), 200
    month = request.args.get("month")
    year = request.args.get("year")
    selected = parse_iso_date(request.args.get("date")) or get_local_now().date()
    try:
        year = int(year) if year else selected.year
        month = int(month) if month else selected.month
        if month < 1 or month > 12:
            raise ValueError
    except ValueError:
        return jsonify({"message": "Invalid month or year."}), 400
    start = date(year, month, 1)
    next_month = date(year + (1 if month == 12 else 0), 1 if month == 12 else month + 1, 1)
    end = next_month - timedelta(days=1)
    menus = student_menu_query(student).filter(Menu.menu_date.between(start, end)).order_by(Menu.menu_date.asc(), Menu.meal.asc()).all()
    grouped = {}
    for menu in menus:
        grouped.setdefault(menu.menu_date.isoformat(), []).append(serialize_menu(menu, student))
    selected_menus = grouped.get(selected.isoformat(), [])
    return jsonify({"year": year, "month": month, "selectedDate": selected.isoformat(), "menusByDate": grouped, "selectedMenus": selected_menus}), 200


@student_bp.route("/menus/<int:menu_id>/response", methods=["PUT"])
@student_required
def save_meal_response(menu_id):
    student = get_current_student()

    menu = get_accessible_menu(student, menu_id)

    if not menu:
        return jsonify({
            "message": "Menu not found."
        }), 404

    # Check the response deadline.
    open_state, reason = response_is_open(menu)

    if not open_state:
        return jsonify({
            "message": reason
        }), 409

    data = request.get_json(silent=True) or {}

    value = str(
        data.get("response", "")
    ).strip().lower()

    if value not in RESPONSES:
        return jsonify({
            "message": "Response must be attending or skipping."
        }), 400

    note = str(data.get("note") or "").strip()

    if len(note) > 200:
        return jsonify({
            "message": "Note cannot exceed 200 characters."
        }), 400

    if get_local_now() >= response_is_open_deadline(menu):
        return jsonify({
            "message": "The 3-hour meal response deadline has passed."
        }), 409

    existing_response = (
        MealResponse.query
        .filter_by(menu_id=menu.id, student_user_id=student.id)
        .with_for_update()
        .first()
    )

    try:
        if existing_response:
            if get_local_now() >= response_is_open_deadline(menu):
                db.session.rollback()
                return jsonify({"message": "The 3-hour meal response deadline has passed."}), 409
            existing_response.response = value
            existing_response.updated_at = datetime.utcnow()
            row = existing_response
        else:
            row = MealResponse(
                menu_id=menu.id,
                student_user_id=student.id,
                mess_unit_id=student.mess_unit_id,
                response=value,
            )
            if hasattr(row, "menu_date_snapshot"):
                row.menu_date_snapshot = menu.menu_date
                row.meal_snapshot = menu.meal
                row.meal_category_snapshot = menu.meal_category
                row.menu_items_snapshot = ", ".join(menu_item_names(menu))
            db.session.add(row)

        db.session.commit()

    except IntegrityError:
        db.session.rollback()

        return jsonify({
            "message": "Your meal response has already been submitted."
        }), 409

    except Exception:
        db.session.rollback()

        return jsonify({
            "message": "Unable to save your response. No changes were saved."
        }), 500

    return jsonify({
        "message": "Meal response submitted successfully.",
        "response": {
            "id": row.id,
            "menuId": row.menu_id,
            "value": row.response,
            "updatedAt": (
                row.updated_at.isoformat()
                if row.updated_at else None
            )
        }
    }), 201
# ============================================================
# STUDENT MEAL QR GENERATION
# ============================================================

@student_bp.route(
    "/menus/<int:menu_id>/qr-token",
    methods=["POST"]
)
@student_required
def generate_student_meal_qr(menu_id):
    student = get_current_student()

    menu = get_accessible_menu(
        student,
        menu_id
    )

    if not menu:
        return jsonify({
            "message": "Menu not found."
        }), 404

    meal_start, _, meal_end = get_meal_schedule(menu)

    if not meal_start or not meal_end:
        return jsonify({
            "message": "Meal start and end times have not been configured."
        }), 409

    now = get_local_now()

    # QR opens exactly 10 minutes before meal start.
    qr_open_time = meal_start - timedelta(minutes=10)

    if now < qr_open_time:
        return jsonify({
            "message": "Meal QR will become available 10 minutes before meal start.",
            "qrAvailableAt": qr_open_time.isoformat()
        }), 409

    # QR expires at meal end.
    if now >= meal_end:
        return jsonify({
            "message": "Meal QR has expired because the meal has ended."
        }), 409

    meal_response = MealResponse.query.filter_by(
        menu_id=menu.id,
        student_user_id=student.id
    ).first()

    if not meal_response:
        return jsonify({
            "message": "Please submit your meal response first."
        }), 400

    if meal_response.response != "attending":
        return jsonify({
            "message": "QR is available only for attending students."
        }), 403

    # Convert meal end to naive UTC for database storage.
    expires_at_utc = (
        meal_end
        .astimezone(timezone.utc)
        .replace(tzinfo=None)
    )

    try:
        qr_data = generate_meal_qr_token(
            meal_response,
            expires_at=expires_at_utc
        )

    except ValueError as error:
        return jsonify({
            "code": "qr_unavailable",
            "message": str(error)
        }), 409

    except Exception:
        db.session.rollback()

        return jsonify({
            "message": "Unable to generate meal QR."
        }), 500

    return jsonify({
        "message": (
            "Active meal QR reused."
            if qr_data.get("reused")
            else "Meal QR generated successfully."
        ),
        "qr": {
            "token": qr_data["token"],
            "expiresAt": qr_data["expires_at"],
            "expiresInMinutes": qr_data["expires_in_minutes"],
            "menuId": menu.id,
            "mealResponseId": meal_response.id
        }
    }), 200
# ============================================================
# RESPONSES
# ============================================================

@student_bp.route("/responses", methods=["GET"])
@student_required
def list_my_responses():
    student = get_current_student()
    start = parse_iso_date(request.args.get("dateFrom"))
    end = parse_iso_date(request.args.get("dateTo"))
    query = MealResponse.query.filter(MealResponse.student_user_id == student.id)
    if start or end:
        if start:
            query = query.filter(or_(MealResponse.menu_date_snapshot >= start, MealResponse.menu.has(Menu.menu_date >= start)))
        if end:
            query = query.filter(or_(MealResponse.menu_date_snapshot <= end, MealResponse.menu.has(Menu.menu_date <= end)))
    rows = query.order_by(MealResponse.updated_at.desc()).limit(500).all()
    result = []
    for row in rows:
        menu = row.menu
        meal_date = menu.menu_date if menu else row.menu_date_snapshot
        meal = menu.meal if menu else row.meal_snapshot
        category = menu.meal_category if menu else row.meal_category_snapshot
        cutoff = menu.response_cutoff if menu else None
        locked = not menu or not response_is_open(menu)[0]
        result.append({"id": row.id, "menuId": row.menu_id, "date": meal_date.isoformat() if meal_date else None, "meal": meal, "mealCategory": category, "response": row.response, "cutoff": cutoff.isoformat() if cutoff else None, "locked": locked, "updatedAt": row.updated_at.isoformat() if row.updated_at else None})
    submitted = len(result)
    pending = 0
    if student_has_assignment(student):
        today = get_local_now().date()
        future = student_menu_query(student).filter(Menu.menu_date >= today).all()
        existing = {r.menu_id for r in rows}
        pending = sum(1 for m in future if m.id not in existing and response_is_open(m)[0])
    return jsonify({"responses": result, "submittedCount": submitted, "pendingCount": pending}), 200


# ============================================================
# MEAL HISTORY
# ============================================================

@student_bp.route("/meal-history", methods=["GET"])
@student_required
def meal_history():
    student = get_current_student()
    start = parse_iso_date(request.args.get("dateFrom"))
    end = parse_iso_date(request.args.get("dateTo"))
    meal = str(request.args.get("meal") or "").strip().lower()
    status = str(request.args.get("status") or "").strip().lower()
    page = max(int(request.args.get("page", 1) or 1), 1)
    per_page = min(max(int(request.args.get("perPage", 6) or 6), 1), 100)

    query = MealResponse.query.filter(MealResponse.student_user_id == student.id)
    rows = query.order_by(MealResponse.updated_at.desc()).all()
    records = []
    for row in rows:
        menu = row.menu
        record_date = menu.menu_date if menu else row.menu_date_snapshot
        record_meal = menu.meal if menu else row.meal_snapshot
        items = menu_item_names(menu) if menu else [x.strip() for x in str(row.menu_items_snapshot or "").split(",") if x.strip()]
        if not record_date:
            continue
        if start and record_date < start:
            continue
        if end and record_date > end:
            continue
        if meal and record_meal != meal:
            continue
        record_status = "Attended" if row.response == "attending" else "Skipped"
        if status and status not in {record_status.lower(), row.response}:
            continue
        records.append({"id": row.id, "date": record_date.isoformat(), "meal": record_meal, "menu": ", ".join(items), "status": record_status})

    # A response row represents a recorded meal. Unrecorded meals are derived from published menus.
    if student_has_assignment(student):
        menu_query = student_menu_query(student).filter(Menu.menu_date < get_local_now().date())
        if start:
            menu_query = menu_query.filter(Menu.menu_date >= start)
        if end:
            menu_query = menu_query.filter(Menu.menu_date <= end)
        menus = menu_query.order_by(Menu.menu_date.desc()).all()
        recorded_keys = {(r["date"], r["meal"]) for r in records}
        for menu in menus:
            key = (menu.menu_date.isoformat(), menu.meal)
            if key in recorded_keys:
                continue
            if meal and menu.meal != meal:
                continue
            if status and status not in {"not recorded", "not_recorded"}:
                continue
            records.append({"id": f"menu-{menu.id}", "date": menu.menu_date.isoformat(), "meal": menu.meal, "menu": ", ".join(menu_item_names(menu)), "status": "Not recorded"})

    records.sort(key=lambda r: (r["date"], r["meal"]), reverse=True)
    counts = {"Attended": 0, "Skipped": 0, "Not recorded": 0}
    for r in records:
        counts[r["status"]] += 1
    total_recorded = counts["Attended"] + counts["Skipped"]
    attendance_percentage = round((counts["Attended"] / total_recorded) * 100, 1) if total_recorded else 0
    total = len(records)
    offset = (page - 1) * per_page
    page_records = records[offset:offset + per_page]

    weekly = {}
    for r in records:
        d = date.fromisoformat(r["date"])
        monday = d - timedelta(days=d.weekday())
        key = monday.isoformat()
        weekly.setdefault(key, {"weekStart": key, "attended": 0, "skipped": 0, "notRecorded": 0})
        if r["status"] == "Attended": weekly[key]["attended"] += 1
        elif r["status"] == "Skipped": weekly[key]["skipped"] += 1
        else: weekly[key]["notRecorded"] += 1

    return jsonify({"records": page_records, "total": total, "page": page, "perPage": per_page, "totalPages": (total + per_page - 1) // per_page, "summary": {"attended": counts["Attended"], "skipped": counts["Skipped"], "notRecorded": counts["Not recorded"], "attendancePercentage": attendance_percentage}, "weeklyAttendance": sorted(weekly.values(), key=lambda x: x["weekStart"])}), 200


@student_bp.route("/meal-history/export", methods=["GET"])
@student_required
def export_meal_history():
    student = get_current_student()
    start = parse_iso_date(request.args.get("dateFrom"))
    end = parse_iso_date(request.args.get("dateTo"))
    query = MealResponse.query.filter(MealResponse.student_user_id == student.id).order_by(MealResponse.updated_at.asc())
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Meal", "Menu", "Status"])
    for row in query.all():
        menu = row.menu
        record_date = menu.menu_date if menu else row.menu_date_snapshot
        if not record_date or (start and record_date < start) or (end and record_date > end):
            continue
        record_meal = menu.meal if menu else row.meal_snapshot
        items = menu_item_names(menu) if menu else [x.strip() for x in str(row.menu_items_snapshot or "").split(",") if x.strip()]
        writer.writerow([record_date.isoformat(), record_meal, ", ".join(items), "Attended" if row.response == "attending" else "Skipped"])
    return Response(output.getvalue(), mimetype="text/csv", headers={"Content-Disposition": "attachment; filename=meal-history.csv"})


# ============================================================
# FEEDBACK
# ============================================================

@student_bp.route("/feedback", methods=["GET"])
@student_required
def list_feedback():
    student = get_current_student()
    page = max(int(request.args.get("page", 1) or 1), 1)
    per_page = min(max(int(request.args.get("perPage", 6) or 6), 1), 50)
    query = StudentFeedback.query.filter_by(student_user_id=student.id).order_by(StudentFeedback.created_at.desc())
    total = query.count()
    rows = query.offset((page - 1) * per_page).limit(per_page).all()
    return jsonify({"feedback": [serialize_feedback(r) for r in rows], "total": total, "page": page, "perPage": per_page, "totalPages": (total + per_page - 1) // per_page}), 200


@student_bp.route("/feedback", methods=["POST"])
@student_required
def create_feedback():
    student = get_current_student()
    if not student_has_assignment(student):
        return jsonify({"message": "Your hostel or mess assignment is incomplete."}), 409
    data = request.form.to_dict() if request.form else (request.get_json(silent=True) or {})
    meal_date = parse_iso_date(data.get("mealDate") or data.get("date"))
    meal = str(data.get("meal") or "").strip().lower()
    category = str(data.get("category") or "").strip()
    if not meal_date or meal not in MEALS:
        return jsonify({"message": "A valid meal date and meal are required."}), 400
    if meal_date > get_local_now().date():
        return jsonify({"message": "Feedback cannot be submitted for a future meal."}), 400
    if category not in FEEDBACK_CATEGORIES:
        return jsonify({"message": "Invalid feedback category."}), 400
    overall, error = parse_rating(data.get("overallRating"), "Overall rating", True)
    if error: return jsonify({"message": error}), 400
    taste, error = parse_rating(data.get("tasteRating"), "Taste rating")
    if error: return jsonify({"message": error}), 400
    hygiene, error = parse_rating(data.get("hygieneRating"), "Hygiene rating")
    if error: return jsonify({"message": error}), 400
    quantity, error = parse_rating(data.get("quantityRating"), "Quantity rating")
    if error: return jsonify({"message": error}), 400
    comments = str(data.get("comments") or "").strip()
    if len(comments) > 2000:
        return jsonify({"message": "Comments cannot exceed 2000 characters."}), 400

    menu = Menu.query.filter(
        Menu.menu_date == meal_date,
        Menu.meal == meal,
        Menu.hostel_id == student.hostel_id,
        Menu.mess_unit_id == student.mess_unit_id,
        Menu.status == "published",
        Menu.meal_category == student.meal_category,
    ).first()
    if not menu:
        return jsonify({"message": "Published meal not found for your assignment."}), 404

    photo_path = None
    file = request.files.get("photo") if request.files else None
    if file and file.filename:
        original = secure_filename(file.filename)
        extension = original.rsplit(".", 1)[-1].lower() if "." in original else ""
        if extension not in ALLOWED_IMAGE_EXTENSIONS:
            return jsonify({"message": "Only JPG, JPEG and PNG images are allowed."}), 400
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)
        if size > 5 * 1024 * 1024:
            return jsonify({"message": "Photo must be 5 MB or smaller."}), 400
        upload_dir = os.path.join(os.getcwd(), "uploads", "student-feedback")
        os.makedirs(upload_dir, exist_ok=True)
        filename = f"feedback-{student.id}-{uuid.uuid4().hex}.{extension}"
        file.save(os.path.join(upload_dir, filename))
        photo_path = f"/uploads/student-feedback/{filename}"

    row = StudentFeedback(
        student_user_id=student.id,
        menu_id=menu.id,
        hostel_id=student.hostel_id,
        mess_unit_id=student.mess_unit_id,
        meal_date=meal_date,
        meal=meal,
        meal_category=menu.meal_category,
        category=category,
        overall_rating=overall,
        taste_rating=taste,
        hygiene_rating=hygiene,
        quantity_rating=quantity,
        comments=comments or None,
        photo_path=photo_path,
        status="pending",
    )
    db.session.add(row)
    try:
        db.session.commit()
    except SQLAlchemyError as error:
        db.session.rollback()
        current_app.logger.exception(
            "Failed to submit Student feedback at endpoint=%s: %s",
            request.endpoint,
            error,
        )
        return jsonify({"message": "Unable to submit feedback."}), 500
    return jsonify({"message": "Feedback submitted successfully.", "feedback": serialize_feedback(row)}), 201


# ============================================================
# ANNOUNCEMENTS
# ============================================================

@student_bp.route("/announcements", methods=["GET"])
@student_required
def list_announcements():
    student = get_current_student()
    unread_only = str(request.args.get("filter", "all")).lower() == "unread"
    rows = Announcement.query.filter(Announcement.status == "published", announcement_scope_filter(student)).order_by(Announcement.published_at.desc(), Announcement.created_at.desc()).limit(200).all()
    read_ids = {r.announcement_id for r in AnnouncementRead.query.filter_by(student_user_id=student.id).all()}
    if unread_only:
        rows = [r for r in rows if r.id not in read_ids]
    return jsonify({"announcements": [serialize_announcement(r, student, read_ids) for r in rows], "unreadCount": sum(1 for r in rows if r.id not in read_ids)}), 200


@student_bp.route("/announcements/<int:announcement_id>/read", methods=["PATCH"])
@student_required
def mark_announcement_read(announcement_id):
    student = get_current_student()
    announcement = Announcement.query.filter(Announcement.id == announcement_id, Announcement.status == "published", announcement_scope_filter(student)).first()
    if not announcement:
        return jsonify({"message": "Announcement not found."}), 404
    existing = AnnouncementRead.query.filter_by(announcement_id=announcement.id, student_user_id=student.id).first()
    if not existing:
        db.session.add(AnnouncementRead(announcement_id=announcement.id, student_user_id=student.id))
        try:
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
    return jsonify({"message": "Announcement marked as read."}), 200


# ============================================================
# NOTIFICATIONS
# ============================================================

@student_bp.route("/notifications", methods=["GET"])
@student_required
def list_student_notifications():
    student = get_current_student()
    rows = MenuNotification.query.filter_by(recipient_user_id=student.id).order_by(MenuNotification.created_at.desc()).limit(100).all()
    return jsonify({"notifications": [serialize_notification(r) for r in rows], "unreadCount": sum(1 for r in rows if not r.is_read)}), 200


@student_bp.route("/notifications/<int:notification_id>/read", methods=["PATCH"])
@student_required
def mark_student_notification_read(notification_id):
    student = get_current_student()
    row = MenuNotification.query.filter_by(id=notification_id, recipient_user_id=student.id).first()
    if not row:
        return jsonify({"message": "Notification not found."}), 404
    row.is_read = True
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"message": "Unable to update notification."}), 500
    return jsonify({"message": "Notification marked as read."}), 200


@student_bp.route("/notifications/read-all", methods=["PATCH"])
@student_required
def mark_all_student_notifications_read():
    student = get_current_student()
    try:
        count = MenuNotification.query.filter_by(recipient_user_id=student.id, is_read=False).update({"is_read": True}, synchronize_session=False)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"message": "Unable to update notifications."}), 500
    return jsonify({"message": "All notifications marked as read.", "updatedCount": int(count or 0)}), 200


# ============================================================
# SETTINGS
# ============================================================

@student_bp.route("/settings", methods=["GET"])
@student_required
def get_student_settings():
    student = get_current_student()
    settings = ensure_settings(student)
    return jsonify({"settings": serialize_settings(settings)}), 200


@student_bp.route("/settings", methods=["PATCH"])
@student_required
def update_student_settings():
    student = get_current_student()
    settings = ensure_settings(student)
    data = request.get_json(silent=True) or {}
    mapping = {
        "notificationsEnabled": "notifications_enabled",
        "menuPublicationNotifications": "menu_publication_notifications",
        "responseCutoffReminders": "response_cutoff_reminders",
        "announcementNotifications": "announcement_notifications",
    }
    for key, attr in mapping.items():
        if key in data:
            if not isinstance(data[key], bool):
                return jsonify({"message": f"{key} must be true or false."}), 400
            setattr(settings, attr, data[key])
    if "theme" in data:
        theme = str(data.get("theme") or "").lower()
        if theme not in {"system", "light", "dark"}:
            return jsonify({"message": "Theme must be system, light or dark."}), 400
        settings.theme = theme
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"message": "Unable to update settings."}), 500
    return jsonify({"message": "Settings updated successfully.", "settings": serialize_settings(settings)}), 200
