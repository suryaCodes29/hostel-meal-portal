from datetime import datetime, timedelta, timezone
from functools import wraps
from zoneinfo import ZoneInfo

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import or_, and_, func, false
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.security import check_password_hash, generate_password_hash

from config import Config
from models import (
    Announcement,
    AnnouncementRead,
    MealQRToken,
    MealQRVerification,
    MealResponse,
    MenuNotification,
    Notification,
    StaffSettings,
    Menu,
    User,
    db,
)
from services.meal_qr_service import get_qr_token_record, hash_qr_token


staff_bp = Blueprint("staff", __name__, url_prefix="/api/staff")
APP_TZ = ZoneInfo(Config.APP_TIMEZONE)

MEAL_SCHEDULE = {
    "breakfast": ("07:00", "09:00"),
    "lunch": ("12:00", "14:00"),
    "snacks": ("16:00", "17:00"),
    "dinner": ("19:00", "21:00"),
}


def get_current_staff():
    try:
        staff_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        return None
    return db.session.get(User, staff_id)


def staff_required(function):
    @wraps(function)
    @jwt_required()
    def decorated(*args, **kwargs):
        staff = get_current_staff()
        if not staff or staff.role != "staff":
            return jsonify({"message": "Staff access required."}), 403
        if not staff.is_active:
            return jsonify({
                "code": "staff_inactive",
                "title": "Staff Account Inactive",
                "message": "Your staff account is inactive. Please contact the Manager.",
                "approved": False,
            }), 403
        return function(*args, **kwargs)
    return decorated


def staff_category_allows(staff, menu_category):
    staff_category = str(staff.meal_category or "").strip().lower()
    menu_category = str(menu_category or "").strip().lower()
    if staff_category == "both":
        return menu_category in {"veg", "non-veg"}
    return bool(staff_category and staff_category == menu_category)


def authorized_staff_menu_query(staff):
    query = Menu.query.filter(
        Menu.hostel_id == staff.hostel_id,
        Menu.mess_unit_id == staff.mess_unit_id,
        Menu.status.in_(["published", "completed"]),
    )
    category = str(staff.meal_category or "").strip().lower()
    if category in {"veg", "non-veg"}:
        query = query.filter(Menu.meal_category == category)
    elif category != "both":
        query = query.filter(false())
    return query


def eligible_staff_students_query(menu):
    query = User.query.filter(
        User.role == "student",
        User.is_active.is_(True),
        User.hostel_id == menu.hostel_id,
        User.mess_unit_id == menu.mess_unit_id,
    )
    category = str(menu.meal_category or "").strip().lower()
    if category:
        query = query.filter(
            or_(
                User.meal_category.is_(None),
                User.meal_category == "",
                func.lower(User.meal_category) == category,
            )
        )
    return query


def get_meal_end(menu):
    schedule = MEAL_SCHEDULE.get(str(menu.meal or "").lower())
    end_time = menu.end_time or (
        datetime.strptime(schedule[1], "%H:%M").time() if schedule else None
    )
    if not end_time:
        return None
    return datetime.combine(menu.menu_date, end_time).replace(tzinfo=APP_TZ)


def get_meal_start(menu):
    schedule = MEAL_SCHEDULE.get(str(menu.meal or "").lower())
    start_time = menu.start_time or (
        datetime.strptime(schedule[0], "%H:%M").time() if schedule else None
    )
    if not start_time:
        return None
    return datetime.combine(menu.menu_date, start_time).replace(tzinfo=APP_TZ)


def attendance_counts(menu):
    eligible_student_ids = eligible_staff_students_query(menu).with_entities(User.id)
    expected = (
        MealResponse.query
        .filter(
            MealResponse.menu_id == menu.id,
            MealResponse.mess_unit_id == menu.mess_unit_id,
            MealResponse.response == "attending",
            MealQRVerification.student_user_id == MealResponse.student_user_id,
            MealResponse.student_user_id.in_(eligible_student_ids),
        )
        .with_entities(MealResponse.student_user_id)
        .distinct()
        .count()
    )
    attended = (
        MealQRVerification.query
        .join(
            MealResponse,
            MealQRVerification.meal_response_id == MealResponse.id,
        )
        .filter(
            MealQRVerification.menu_id == menu.id,
            MealQRVerification.mess_unit_id == menu.mess_unit_id,
            MealQRVerification.verification_status == "approved",
            MealResponse.menu_id == menu.id,
            MealResponse.mess_unit_id == menu.mess_unit_id,
            MealResponse.response == "attending",
            MealResponse.student_user_id.in_(eligible_student_ids),
        )
        .with_entities(MealQRVerification.student_user_id)
        .distinct()
        .count()
    )
    remaining = max(expected - attended, 0)
    percentage = round((attended / expected * 100), 2) if expected else 0
    return {
        "expected": expected,
        "attended": attended,
        "remaining": remaining,
        "percentage": percentage,
    }


@staff_bp.route("/profile", methods=["GET"])
@staff_required
def staff_profile():
    staff = get_current_staff()
    return jsonify({
        "profile": {
            "id": staff.id,
            "staffId": staff.staff_id,
            "name": staff.name,
            "email": staff.email,
            "mobile": staff.mobile,
            "staffRole": staff.staff_role,
            "hostel": staff.hostel_relation.name if staff.hostel_relation else staff.hostel,
            "hostelId": staff.hostel_id,
            "messUnit": staff.mess_unit_relation.name if staff.mess_unit_relation else staff.mess_unit,
            "messUnitId": staff.mess_unit_id,
            "mealCategory": staff.meal_category,
            "isActive": staff.is_active,
            "createdAt": staff.created_at.isoformat() if staff.created_at else None,
        }
    }), 200


@staff_bp.route("/sessions/today", methods=["GET"])
@staff_required
def staff_today_sessions():
    staff = get_current_staff()
    if not staff.hostel_id or not staff.mess_unit_id:
        return jsonify({"sessions": [], "assignmentRequired": True}), 200

    today = datetime.now(APP_TZ).date()
    menus = (
        authorized_staff_menu_query(staff)
        .filter(Menu.menu_date == today)
        .order_by(Menu.meal.asc())
        .all()
    )

    sessions = []
    for menu in menus:
        meal_start = get_meal_start(menu)
        meal_end = get_meal_end(menu)
        counts = attendance_counts(menu)
        sessions.append({
            "menuId": menu.id,
            "meal": menu.meal,
            "mealCategory": menu.meal_category,
            "date": menu.menu_date.isoformat(),
            "startTime": meal_start.isoformat() if meal_start else None,
            "endTime": meal_end.isoformat() if meal_end else None,
            **counts,
        })
    return jsonify({"sessions": sessions, "date": today.isoformat()}), 200


@staff_bp.route("/dashboard", methods=["GET"])
@staff_required
def staff_dashboard():
    staff = get_current_staff()
    today = datetime.now(APP_TZ).date()
    menus = (
        authorized_staff_menu_query(staff)
        .filter(Menu.menu_date == today)
        .all()
    ) if staff.hostel_id and staff.mess_unit_id else []

    now = datetime.now(APP_TZ)
    current = None
    for menu in menus:
        meal_start = get_meal_start(menu)
        meal_end = get_meal_end(menu)
        if meal_start and meal_end and meal_start <= now < meal_end:
            current = menu
            break

    current_payload = None
    if current:
        counts = attendance_counts(current)
        current_payload = {
            "menuId": current.id,
            "meal": current.meal,
            "mealCategory": current.meal_category,
            "hostel": staff.hostel_relation.name if staff.hostel_relation else staff.hostel,
            "messUnit": staff.mess_unit_relation.name if staff.mess_unit_relation else staff.mess_unit,
            "startTime": get_meal_start(current).isoformat(),
            "endTime": get_meal_end(current).isoformat(),
            **counts,
        }

    hour = now.hour
    greeting = "Good Morning" if 5 <= hour < 12 else "Good Afternoon" if 12 <= hour < 17 else "Good Evening"
    return jsonify({
        "greeting": greeting,
        "staff": {
            "name": staff.name,
            "staffId": staff.staff_id,
            "hostel": staff.hostel_relation.name if staff.hostel_relation else staff.hostel,
            "messUnit": staff.mess_unit_relation.name if staff.mess_unit_relation else staff.mess_unit,
            "mealCategory": staff.meal_category,
        },
        "currentSession": current_payload,
        "sessions": [serialize_staff_session(menu) for menu in menus],
        "recentScans": recent_staff_scans(staff, limit=5),
    }), 200


def serialize_staff_session(menu):
    counts = attendance_counts(menu)
    start_time = get_meal_start(menu)
    end_time = get_meal_end(menu)
    now = datetime.now(APP_TZ)
    if menu.status == "completed" or (end_time and now >= end_time):
        session_status = "completed"
    elif start_time and now < start_time:
        session_status = "upcoming"
    elif start_time and end_time:
        session_status = "active"
    else:
        session_status = "unavailable"
    return {
        "menuId": menu.id,
        "meal": menu.meal,
        "mealCategory": menu.meal_category,
        "date": menu.menu_date.isoformat(),
        "startTime": start_time.isoformat() if start_time else None,
        "endTime": end_time.isoformat() if end_time else None,
        "sessionStatus": session_status,
        **counts,
    }


def recent_staff_scans(staff, menu=None, limit=5):
    rows = (
        MealQRVerification.query
        .join(Menu, MealQRVerification.menu_id == Menu.id)
        .filter(
            MealQRVerification.verification_status == "approved",
            Menu.hostel_id == staff.hostel_id,
            Menu.mess_unit_id == staff.mess_unit_id,
        )
    )
    category = str(staff.meal_category or "").strip().lower()
    if category in {"veg", "non-veg"}:
        rows = rows.filter(Menu.meal_category == category)
    if menu:
        rows = rows.filter(MealQRVerification.menu_id == menu.id)
    records = rows.order_by(MealQRVerification.verified_at.desc()).limit(limit).all()
    result = []
    for record in records:
        student = db.session.get(User, record.student_user_id)
        record_menu = db.session.get(Menu, record.menu_id)
        if student and record_menu:
            result.append({
                "studentName": student.name,
                "studentId": student.student_id,
                "meal": record_menu.meal,
                "mealCategory": record_menu.meal_category,
                "scanTime": record.verified_at.isoformat(),
                "verificationStatus": record.verification_status,
            })
    return result


@staff_bp.route("/meal-sessions", methods=["GET"])
@staff_required
def staff_meal_sessions():
    staff = get_current_staff()
    if (
        not staff.hostel_id
        or not staff.mess_unit_id
        or str(staff.meal_category or "").strip().lower()
        not in {"veg", "non-veg", "both"}
    ):
        return jsonify({"assignmentRequired": True, "sessions": []}), 200
    today = datetime.now(APP_TZ).date()
    requested_date = request.args.get("date")
    date_value = parse_staff_iso_date(requested_date) if requested_date else today
    if requested_date and not date_value:
        return jsonify({"message": "date must be a valid ISO date."}), 400
    menus = (
        authorized_staff_menu_query(staff)
        .filter(Menu.menu_date == date_value)
        .order_by(Menu.meal.asc())
        .all()
    )
    return jsonify({
        "date": date_value.isoformat(),
        "assignmentRequired": False,
        "sessions": [serialize_staff_session(menu) for menu in menus],
    }), 200


def parse_staff_iso_date(value):
    if not value:
        return None
    try:
        from datetime import date
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


@staff_bp.route("/attendance/summary", methods=["GET"])
@staff_required
def staff_attendance_summary():
    staff = get_current_staff()
    menu_id = request.args.get("menuId", type=int)
    if not menu_id:
        return jsonify({"message": "menuId is required."}), 400
    menu = authorized_staff_menu_query(staff).filter(Menu.id == menu_id).first()
    if not menu:
        return jsonify({"message": "Meal session not found."}), 404
    counts = attendance_counts(menu)
    return jsonify({
        "menuId": menu.id,
        "meal": menu.meal,
        "mealDate": menu.menu_date.isoformat(),
        "mealCategory": menu.meal_category,
        "hostel": {"id": menu.hostel_id},
        "messUnit": {"id": menu.mess_unit_id},
        "expectedAttending": counts["expected"],
        "successfullyScanned": counts["attended"],
        "remainingToScan": counts["remaining"],
        "attendancePercentage": counts["percentage"],
    }), 200


@staff_bp.route("/attendance/recent", methods=["GET"])
@staff_required
def staff_recent_attendance():
    staff = get_current_staff()
    menu_id = request.args.get("menuId", type=int)
    rows = (
        MealQRVerification.query
        .join(Menu, MealQRVerification.menu_id == Menu.id)
        .filter(
            MealQRVerification.verification_status == "approved",
            Menu.hostel_id == staff.hostel_id,
            Menu.mess_unit_id == staff.mess_unit_id,
        )
    )
    category = str(staff.meal_category or "").strip().lower()
    if category in {"veg", "non-veg"}:
        rows = rows.filter(Menu.meal_category == category)
    if menu_id:
        rows = rows.filter(MealQRVerification.menu_id == menu_id)
    records = rows.order_by(MealQRVerification.verified_at.desc()).limit(20).all()
    result = []
    for record in records:
        student = db.session.get(User, record.student_user_id)
        menu = db.session.get(Menu, record.menu_id)
        if student and menu:
            result.append({
                "studentName": student.name,
                "studentId": student.student_id,
                "meal": menu.meal,
                "mealCategory": menu.meal_category,
                "scanTime": record.verified_at.isoformat(),
                "verificationStatus": record.verification_status,
            })
    return jsonify({"recentScans": result}), 200


@staff_bp.route("/attendance/history", methods=["GET"])
@staff_required
def staff_attendance_history():
    staff = get_current_staff()
    meal = str(request.args.get("meal") or "").strip().lower()
    search = str(request.args.get("search") or "").strip().lower()

    rows = MealQRVerification.query.filter(
        MealQRVerification.mess_unit_id == staff.mess_unit_id,
        MealQRVerification.verification_status == "approved",
    )
    rows = rows.join(Menu, MealQRVerification.menu_id == Menu.id).filter(
        Menu.hostel_id == staff.hostel_id
    )
    staff_category = str(staff.meal_category or "").strip().lower()
    if staff_category in {"veg", "non-veg"}:
        rows = rows.filter(Menu.meal_category == staff_category)
    if meal:
        rows = rows.filter(Menu.meal == meal)
    if not search:
        records = rows.order_by(MealQRVerification.verified_at.desc()).limit(500).all()
    else:
        records = rows.order_by(MealQRVerification.verified_at.desc()).limit(500).all()

    result = []
    for record in records:
        student = db.session.get(User, record.student_user_id)
        menu = db.session.get(Menu, record.menu_id)
        if student and menu:
            haystack = f"{student.name} {student.student_id or ''}".lower()
            if search and search not in haystack:
                continue
            result.append({
                "verificationId": record.id,
                "studentId": student.student_id,
                "studentName": student.name,
                "hostel": student.hostel_relation.name if student.hostel_relation else student.hostel,
                "messUnit": student.mess_unit_relation.name if student.mess_unit_relation else student.mess_unit,
                "menuId": menu.id,
                "meal": menu.meal,
                "mealDate": menu.menu_date.isoformat(),
                "mealCategory": menu.meal_category,
                "scanTime": record.verified_at.isoformat(),
            })
    return jsonify({"records": result}), 200


@staff_bp.route("/profile", methods=["PATCH"])
@staff_required
def update_staff_profile():
    staff = get_current_staff()
    data = request.get_json(silent=True) or {}
    if any(key in data for key in ("staffId", "role", "hostelId", "messUnitId", "mealCategory", "isActive")):
        return jsonify({"message": "Staff identity and assignment fields cannot be changed here."}), 400
    if "name" in data:
        name = str(data["name"]).strip()
        if not name or len(name) > 100:
            return jsonify({"message": "Name is invalid."}), 400
        staff.name = name
    if "mobile" in data:
        mobile = str(data["mobile"] or "").strip()
        if len(mobile) > 15:
            return jsonify({"message": "Mobile number is too long."}), 400
        staff.mobile = mobile or None
    db.session.commit()
    return jsonify({"message": "Staff profile updated successfully."}), 200


@staff_bp.route("/settings", methods=["GET"])
@staff_required
def get_staff_settings():
    staff = get_current_staff()
    settings = StaffSettings.query.filter_by(staff_user_id=staff.id).first()
    if not settings:
        settings = StaffSettings(staff_user_id=staff.id)
        db.session.add(settings)
        db.session.commit()
    return jsonify({
        "settings": {
            "notificationsEnabled": settings.notifications_enabled,
            "announcementNotifications": settings.announcement_notifications,
            "managerNotifications": settings.manager_notifications,
            "mealUpdateNotifications": settings.meal_update_notifications,
            "systemNotifications": settings.system_notifications,
            "timezone": settings.timezone,
            "language": settings.language,
            "theme": settings.theme,
            "compactLayout": settings.compact_layout,
        }
    }), 200


@staff_bp.route("/settings", methods=["PATCH"])
@staff_required
def update_staff_settings():
    staff = get_current_staff()
    settings = StaffSettings.query.filter_by(staff_user_id=staff.id).first()
    if not settings:
        settings = StaffSettings(staff_user_id=staff.id)
        db.session.add(settings)
    data = request.get_json(silent=True) or {}
    boolean_fields = {
        "notificationsEnabled": "notifications_enabled",
        "announcementNotifications": "announcement_notifications",
        "managerNotifications": "manager_notifications",
        "mealUpdateNotifications": "meal_update_notifications",
        "systemNotifications": "system_notifications",
        "compactLayout": "compact_layout",
    }
    for key, attribute in boolean_fields.items():
        if key in data:
            if not isinstance(data[key], bool):
                return jsonify({"message": f"{key} must be true or false."}), 400
            setattr(settings, attribute, data[key])
    if "timezone" in data:
        if str(data["timezone"]) != "Asia/Kolkata":
            return jsonify({"message": "Timezone must be Asia/Kolkata."}), 400
        settings.timezone = "Asia/Kolkata"
    if "language" in data:
        language = str(data["language"]).strip()
        if language not in {"en", "hi"}:
            return jsonify({"message": "Unsupported language."}), 400
        settings.language = language
    if "theme" in data:
        theme = str(data["theme"]).strip().lower()
        if theme not in {"light", "dark", "system"}:
            return jsonify({"message": "Invalid theme."}), 400
        settings.theme = theme
    db.session.commit()
    return jsonify({"message": "Staff settings updated successfully."}), 200


@staff_bp.route("/settings/password", methods=["PATCH"])
@staff_bp.route("/change-password", methods=["POST"])
@staff_required
def change_staff_password():
    staff = get_current_staff()
    data = request.get_json(silent=True) or {}
    current_password = str(data.get("currentPassword") or "")
    new_password = str(data.get("newPassword") or "")
    if not current_password or not new_password:
        return jsonify({"message": "Current password and new password are required."}), 400
    if not check_password_hash(staff.password_hash, current_password):
        return jsonify({"message": "Current password is incorrect."}), 400
    if len(new_password) < 8:
        return jsonify({"message": "New password must be at least 8 characters."}), 400
    staff.password_hash = generate_password_hash(new_password)
    staff.must_change_password = False
    db.session.commit()
    return jsonify({"message": "Password changed successfully."}), 200


@staff_bp.route("/responses", methods=["GET"])
@staff_required
def staff_student_responses():
    staff = get_current_staff()
    if (
        not staff.hostel_id
        or not staff.mess_unit_id
        or str(staff.meal_category or "").strip().lower()
        not in {"veg", "non-veg", "both"}
    ):
        return jsonify({"assignmentRequired": True, "responses": []}), 200
    raw_menu_id = request.args.get("menuId")
    menu_id = request.args.get("menuId", type=int)
    if raw_menu_id and not menu_id:
        return jsonify({"message": "menuId must be a valid integer."}), 400
    menu_query = authorized_staff_menu_query(staff)
    if menu_id:
        menu_query = menu_query.filter(Menu.id == menu_id)
    menus = menu_query.order_by(Menu.menu_date.asc(), Menu.meal.asc()).all()
    if menu_id and not menus:
        return jsonify({"message": "Meal session not found."}), 404

    result = []
    for menu in menus:
        student_rows = eligible_staff_students_query(menu).order_by(User.name.asc()).all()
        response_by_student = {
            row.student_user_id: row
            for row in MealResponse.query.filter(
                MealResponse.menu_id == menu.id
            ).all()
        }
        scan_by_student = {}
        scans = (
            MealQRVerification.query
            .join(
                MealResponse,
                MealQRVerification.meal_response_id == MealResponse.id,
            )
            .filter(
                MealQRVerification.menu_id == menu.id,
                MealQRVerification.verification_status == "approved",
                MealQRVerification.student_user_id == MealResponse.student_user_id,
                MealResponse.menu_id == menu.id,
                MealResponse.mess_unit_id == menu.mess_unit_id,
                MealResponse.response == "attending",
            )
            .order_by(MealQRVerification.verified_at.asc())
            .all()
        )
        for scan in scans:
            scan_by_student.setdefault(scan.student_user_id, scan)
        deadline = get_meal_start(menu) - timedelta(hours=3) if get_meal_start(menu) else None
        for student in student_rows:
            response_row = response_by_student.get(student.id)
            scan = scan_by_student.get(student.id)
            response_value = response_row.response if response_row else None
            has_attended = response_value == "attending"
            result.append({
                "menuId": menu.id,
                "studentId": student.student_id,
                "studentName": student.name,
                "email": student.email,
                "hostel": student.hostel_relation.name if student.hostel_relation else student.hostel,
                "messUnit": student.mess_unit_relation.name if student.mess_unit_relation else student.mess_unit,
                "mealDate": menu.menu_date.isoformat(),
                "meal": menu.meal,
                "mealCategory": menu.meal_category,
                "foodCategory": student.meal_category or menu.meal_category,
                "response": response_value,
                "responseStatus": response_value.upper() if response_value else "NO RESPONSE",
                "qrAttendance": "SCANNED" if has_attended and scan else "NOT SCANNED",
                "scanTime": qr_scan_time_ist(scan.verified_at) if has_attended and scan else None,
                "attendanceStatus": (
                    "Verified" if has_attended and scan
                    else "Pending" if has_attended
                    else "Skipped" if response_value == "skipping"
                    else "No Response"
                ),
                "responseDeadline": deadline.isoformat() if deadline else None,
                "respondedAt": response_row.updated_at.isoformat() if response_row else None,
            })
    return jsonify({"assignmentRequired": False, "responses": result}), 200


@staff_bp.route("/announcements", methods=["GET"])
@staff_required
def staff_announcements():
    staff = get_current_staff()
    manager_id = (
        staff.hostel_relation.manager_user_id
        if staff.hostel_relation
        else None
    )
    staff_category = str(staff.meal_category or "").strip().lower()
    if staff_category == "both":
        category_filter = func.lower(Announcement.meal_category).in_(
            ("veg", "non-veg")
        )
    elif staff_category:
        category_filter = (
            func.lower(Announcement.meal_category) == staff_category
        )
    else:
        category_filter = false()

    rows = Announcement.query.filter(
        Announcement.status == "published",
        or_(Announcement.expires_at.is_(None), Announcement.expires_at >= datetime.utcnow()),
        Announcement.manager_user_id == manager_id if manager_id else False,
        or_(
            Announcement.is_general.is_(True),
            Announcement.recipient_user_id == staff.id,
            and_(
                Announcement.recipient_user_id.is_(None),
                Announcement.hostel_id == staff.hostel_id,
                Announcement.mess_unit_id.is_(None),
                Announcement.meal_category.is_(None),
            ),
            and_(
                Announcement.recipient_user_id.is_(None),
                Announcement.hostel_id == staff.hostel_id,
                Announcement.mess_unit_id == staff.mess_unit_id,
                Announcement.meal_category.is_(None),
            ),
            and_(
                Announcement.recipient_user_id.is_(None),
                Announcement.hostel_id == staff.hostel_id,
                Announcement.mess_unit_id.is_(None),
                category_filter,
            ),
        ),
    ).order_by(Announcement.published_at.desc(), Announcement.created_at.desc()).limit(200).all()
    read_ids = {row.announcement_id for row in AnnouncementRead.query.filter_by(student_user_id=staff.id).all()}
    return jsonify({
        "announcements": [
            {
                "id": row.id,
                "title": row.title,
                "message": row.message,
                "priority": row.priority,
                "publishedAt": row.published_at.isoformat() if row.published_at else None,
                "isRead": row.id in read_ids,
            }
            for row in rows
        ]
    }), 200


@staff_bp.route("/announcements/<int:announcement_id>/read", methods=["PATCH"])
@staff_required
def mark_staff_announcement_read(announcement_id):
    staff = get_current_staff()
    announcement = Announcement.query.filter_by(id=announcement_id, status="published").first()
    if not announcement:
        return jsonify({"message": "Announcement not found."}), 404
    if not AnnouncementRead.__table__.c.student_user_id:
        return jsonify({"message": "Announcement read state is unavailable."}), 500
    existing = AnnouncementRead.query.filter_by(announcement_id=announcement.id, student_user_id=staff.id).first()
    if not existing:
        db.session.add(AnnouncementRead(announcement_id=announcement.id, student_user_id=staff.id))
        db.session.commit()
    return jsonify({"message": "Announcement marked as read."}), 200


@staff_bp.route("/notifications", methods=["GET"])
@staff_required
def staff_notifications():
    staff = get_current_staff()
    menu_rows = (
        MenuNotification.query
        .filter_by(recipient_user_id=staff.id)
        .order_by(MenuNotification.created_at.desc())
        .limit(200)
        .all()
    )
    general_rows = (
        Notification.query
        .filter_by(recipient_user_id=staff.id)
        .order_by(Notification.created_at.desc())
        .limit(200)
        .all()
    )
    notifications = [
        {
            "id": f"menu-{row.id}",
            "type": row.notification_type,
            "title": row.title,
            "message": row.message,
            "isRead": row.is_read,
            "createdAt": row.created_at.isoformat() if row.created_at else None,
            "menuId": row.menu_id,
        }
        for row in menu_rows
    ] + [
        {
            "id": f"general-{row.id}",
            "type": row.notification_type,
            "title": row.title,
            "message": row.message,
            "isRead": row.is_read,
            "createdAt": row.created_at.isoformat() if row.created_at else None,
            "menuId": None,
        }
        for row in general_rows
    ]
    notifications.sort(key=lambda item: item["createdAt"] or "", reverse=True)
    return jsonify({
        "notifications": notifications,
        "unreadCount": sum(1 for item in notifications if not item["isRead"]),
    }), 200


@staff_bp.route("/notifications/<string:notification_id>/read", methods=["PATCH"])
@staff_required
def mark_staff_notification_read(notification_id):
    staff = get_current_staff()
    raw_id = str(notification_id)
    if raw_id.startswith("menu-"):
        row = MenuNotification.query.filter_by(
            id=int(raw_id.split("-", 1)[1]),
            recipient_user_id=staff.id,
        ).first()
    elif raw_id.startswith("general-"):
        row = Notification.query.filter_by(
            id=int(raw_id.split("-", 1)[1]),
            recipient_user_id=staff.id,
        ).first()
    else:
        row = None
    if not row:
        return jsonify({"message": "Notification not found."}), 404
    row.is_read = True
    db.session.commit()
    return jsonify({"message": "Notification marked as read."}), 200


@staff_bp.route("/notifications/read-all", methods=["PATCH"])
@staff_required
def mark_all_staff_notifications_read():
    staff = get_current_staff()
    menu_count = (
        MenuNotification.query
        .filter_by(recipient_user_id=staff.id, is_read=False)
        .update({"is_read": True}, synchronize_session=False)
    )
    general_count = (
        Notification.query
        .filter_by(recipient_user_id=staff.id, is_read=False)
        .update({"is_read": True}, synchronize_session=False)
    )
    db.session.commit()
    return jsonify({
        "message": "All notifications marked as read.",
        "updatedCount": int((menu_count or 0) + (general_count or 0)),
    }), 200


def qr_verification_error(code, title, message, status_code):
    return jsonify({
        "approved": False,
        "code": code,
        "title": title,
        "message": message,
        "status": code,
    }), status_code


def qr_scan_time_ist(value):
    if not value:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(APP_TZ).isoformat()


def serialize_qr_scan(student, menu, scan_time):
    return {
        "student": {
            "name": student.name,
            "studentId": student.student_id,
            "email": student.email,
            "hostel": student.hostel_relation.name if student.hostel_relation else student.hostel,
            "messUnit": student.mess_unit_relation.name if student.mess_unit_relation else student.mess_unit,
        },
        "menu": {
            "id": menu.id,
            "meal": menu.meal,
            "date": menu.menu_date.isoformat(),
            "category": menu.meal_category,
            "mealCategory": menu.meal_category,
        },
        "scanTime": qr_scan_time_ist(scan_time),
        "attendanceStatus": "VERIFIED",
    }


def already_scanned_response(token, student, menu, existing_scan):
    scan_time = existing_scan.verified_at if existing_scan else token.redeemed_at
    details = serialize_qr_scan(student, menu, scan_time)
    return jsonify({
        **details,
        "approved": False,
        "code": "already_scanned",
        "message": "This meal QR has already been successfully scanned.",
        "status": "already_served",
        "originalScanTime": details["scanTime"],
        "attendanceStatus": "QR SCANNED",
    }), 409


@staff_bp.route("/qr/verify", methods=["POST"])
@staff_required
def verify_meal_qr():
    staff = get_current_staff()
    data = request.get_json(silent=True) or {}
    raw_token = str(data.get("token") or data.get("qrToken") or "").strip()
    if not raw_token or len(raw_token) > 512:
        return qr_verification_error(
            "invalid_qr", "Invalid QR Code", "The QR code is invalid.", 400
        )

    token = get_qr_token_record(raw_token)
    if not token:
        return qr_verification_error(
            "invalid_qr", "Invalid QR Code", "The QR code is invalid.", 404
        )

    token = db.session.get(MealQRToken, token.id)
    response = db.session.get(MealResponse, token.meal_response_id) if token else None
    menu = db.session.get(Menu, token.menu_id) if token else None
    student = db.session.get(User, token.student_user_id) if token else None

    if token and menu and student and not response:
        return qr_verification_error(
            "meal_response_missing",
            "Student Has Not Submitted Meal Response",
            "The student must submit an ATTENDING response before scanning.",
            403,
        )

    if (
        not token
        or not menu
        or not student
        or token.student_user_id != (response.student_user_id if response else None)
        or token.menu_id != (response.menu_id if response else None)
        or token.mess_unit_id != menu.mess_unit_id
        or response.mess_unit_id != menu.mess_unit_id
        or student.role != "student"
        or not student.is_active
    ):
        return qr_verification_error(
            "invalid_qr", "Invalid QR Code", "The QR code is invalid or no longer eligible.", 403
        )

    if staff.hostel_id != menu.hostel_id or student.hostel_id != menu.hostel_id:
        return qr_verification_error(
            "hostel_mismatch",
            "Not Your Hostel",
            "This student does not belong to your assigned hostel.",
            403,
        )

    if (
        staff.mess_unit_id != menu.mess_unit_id
        or student.mess_unit_id != menu.mess_unit_id
    ):
        return qr_verification_error(
            "mess_mismatch",
            "Wrong Mess Unit",
            "This student is not assigned to your mess unit.",
            403,
        )

    student_category = str(student.meal_category or "").strip().lower()
    if (
        not staff_category_allows(staff, menu.meal_category)
        or (student_category and student_category != str(menu.meal_category).lower())
    ):
        return qr_verification_error(
            "category_mismatch",
            "Category Mismatch",
            "You are not authorized to scan this student's meal category.",
            403,
        )

    existing_scan = (
        MealQRVerification.query
        .filter_by(
            meal_response_id=response.id,
            verification_status="approved",
        )
        .order_by(MealQRVerification.verified_at.asc())
        .first()
    )
    if token.redeemed_at is not None or existing_scan:
        return already_scanned_response(token, student, menu, existing_scan)

    if response.response == "skipping":
        return qr_verification_error(
            "meal_skipped",
            "Student Has Skipped This Meal",
            "This student submitted a SKIPPING response for this meal.",
            403,
        )
    if response.response != "attending":
        return qr_verification_error(
            "meal_response_missing",
            "Student Has Not Submitted Meal Response",
            "The student must submit an ATTENDING response before scanning.",
            403,
        )

    if menu.status not in {"published", "completed"}:
        return qr_verification_error(
            "meal_session_unavailable",
            "Meal Session Not Available",
            "This meal session is not available for attendance.",
            409,
        )

    now_utc = datetime.utcnow()
    now_local = datetime.now(APP_TZ)
    if token.expires_at <= now_utc:
        return qr_verification_error(
            "qr_expired", "QR Code Expired", "This meal QR code has expired.", 409
        )

    meal_start = get_meal_start(menu)
    meal_end = get_meal_end(menu)
    if not meal_start or not meal_end:
        return qr_verification_error(
            "meal_session_unavailable",
            "Meal Session Not Available",
            "The meal session schedule is unavailable.",
            409,
        )
    if now_local < meal_start - timedelta(minutes=10):
        return qr_verification_error(
            "meal_session_unavailable",
            "Meal Session Not Available",
            "This meal QR is not available yet.",
            409,
        )
    if now_local >= meal_end:
        return qr_verification_error(
            "qr_expired", "QR Code Expired", "This meal QR code has expired.", 409
        )

    token_hash = hash_qr_token(raw_token)
    try:
        claimed = (
            MealQRToken.query
            .filter(
                MealQRToken.id == token.id,
                MealQRToken.token_hash == token_hash,
                MealQRToken.redeemed_at.is_(None),
                MealQRToken.expires_at > now_utc,
            )
            .update(
                {
                    MealQRToken.redeemed_at: now_utc,
                    MealQRToken.redeemed_by_staff_id: staff.id,
                },
                synchronize_session=False,
            )
        )
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Failed to claim Staff QR attendance token")
        return qr_verification_error(
            "attendance_save_failed",
            "Attendance Could Not Be Saved",
            "The attendance record could not be saved. Please try again.",
            500,
        )
    if claimed != 1:
        db.session.rollback()
        current_token = db.session.get(MealQRToken, token.id)
        current_scan = (
            MealQRVerification.query
            .filter_by(
                meal_response_id=response.id,
                verification_status="approved",
            )
            .order_by(MealQRVerification.verified_at.asc())
            .first()
        )
        if current_token and (current_token.redeemed_at or current_scan):
            return already_scanned_response(current_token, student, menu, current_scan)
        if current_token and current_token.expires_at <= datetime.utcnow():
            return qr_verification_error(
                "qr_expired", "QR Code Expired", "This meal QR code has expired.", 409
            )
        return qr_verification_error(
            "invalid_qr", "Invalid QR Code", "The QR code is no longer valid.", 409
        )

    db.session.add(MealQRVerification(
        meal_response_id=response.id,
        student_user_id=student.id,
        menu_id=menu.id,
        mess_unit_id=menu.mess_unit_id,
        verified_by_staff_id=staff.id,
        verification_status="approved",
        verified_at=now_utc,
    ))
    try:
        db.session.commit()
    except SQLAlchemyError:
        db.session.rollback()
        current_app.logger.exception("Failed to commit Staff QR attendance verification")
        return qr_verification_error(
            "attendance_save_failed",
            "Attendance Could Not Be Saved",
            "The attendance record could not be saved. Please try again.",
            500,
        )

    return jsonify({
        **serialize_qr_scan(student, menu, now_utc),
        "message": "Meal QR approved.",
        "approved": True,
        "status": "approved",
        "code": "approved",
    }), 200
