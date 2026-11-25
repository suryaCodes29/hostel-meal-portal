from datetime import (
    date,
    datetime,
    timedelta,
    timezone,
    time
)
from zoneinfo import ZoneInfo
from config import Config
import re
import secrets

from functools import wraps

from flask import (  # type: ignore[import-not-found]
    Blueprint,
    current_app,
    jsonify,
    request
)

from flask_jwt_extended import (  # type: ignore[import-not-found]
    get_jwt_identity,
    jwt_required
)

from sqlalchemy import (  # type: ignore[import-not-found]
    and_,
    case,
    func,
    or_
)

from sqlalchemy.exc import (  # type: ignore[import-not-found]
    IntegrityError,
    SQLAlchemyError
)
from sqlalchemy.orm import joinedload

from werkzeug.security import (  # type: ignore[import-not-found]
    generate_password_hash
)

from models import (
    db,
    Announcement,
    Forecast,
    Hostel,
    HostelBlock,
    MealResponse,
    Menu,
    MenuItem,
    MenuMenuItem,
    MenuNotification,
    MenuTemplate,
    MenuTemplateItem,
    MessUnit,
    MealQRVerification,
    Notification,
    StaffFeedback,
    StudentFeedback,
    User,
    WasteRecord,
)

manager_bp = Blueprint(
    "manager",
    __name__,
    url_prefix="/api/manager"
)


EMAIL_PATTERN = (
    r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
)

MOBILE_PATTERN = (
    r"^[6-9]\d{9}$"
)


# ============================================================
# SECURITY
# ============================================================

def get_current_user():

    user_id = get_jwt_identity()

    try:
        user_id = int(user_id)

    except (
        TypeError,
        ValueError
    ):

        return None

    return db.session.get(
        User,
        user_id
    )


def manager_required(function):

    @wraps(function)
    @jwt_required()
    def decorated_function(
        *args,
        **kwargs
    ):

        manager = get_current_user()

        if not manager:

            return jsonify({
                "message":
                    "Manager access required."
            }), 403


        if not manager.is_active:

            return jsonify({
                "message":
                    "Your account is inactive."
            }), 403


        if manager.role != "manager":

            return jsonify({
                "message":
                    "Manager access required."
            }), 403


        if manager.must_change_password:

            return jsonify({
                "message":
                    "Password change required."
            }), 403


        return function(
            *args,
            **kwargs
        )

    return decorated_function


# ============================================================
# HELPERS
# ============================================================

def get_integer_query(
    name
):

    value = request.args.get(
        name
    )

    if not value:
        return None

    try:
        return int(value)

    except ValueError:
        return None


def normalize_category(
    value
):

    if not value:
        return None

    value = (
        str(value)
        .strip()
        .lower()
    )

    if value in [
        "all",
        ""
    ]:
        return None

    if value in [
        "veg",
        "vegetarian"
    ]:
        return "veg"

    if value in [
        "non-veg",
        "nonveg",
        "non_veg",
        "non vegetarian"
    ]:
        return "non-veg"

    return None


def normalize_staff_category(value):
    normalized = str(value or "").strip().lower()
    if normalized in {"veg", "vegetarian"}:
        return "veg"
    if normalized in {"non-veg", "nonveg", "non_veg", "non vegetarian"}:
        return "non-veg"
    if normalized == "both":
        return "both"
    return None


def normalize_mess_unit_type(
    value
):

    if not value:
        return None

    value = (
        str(value)
        .strip()
        .lower()
    )

    if value in [
        "all",
        ""
    ]:
        return None

    if value in [
        "north",
        "north mess"
    ]:
        return "north"

    if value in [
        "south",
        "south mess"
    ]:
        return "south"

    return None


def filtered_mess_unit_ids(
    manager_id,
    hostel_id=None,
    mess_unit_type=None
):

    if not mess_unit_type:
        return None

    query = (
        MessUnit.query
        .join(
            Hostel,
            MessUnit.hostel_id
            == Hostel.id
        )
        .filter(
            Hostel.manager_user_id
            == manager_id,

            func.lower(
                MessUnit.unit_type
            )
            == mess_unit_type
        )
    )

    if hostel_id:
        query = query.filter(
            MessUnit.hostel_id
            == hostel_id
        )

    return [
        item.id
        for item
        in query.all()
    ]


def parse_date(
    value
):

    if not value:
        return None

    try:

        return datetime.strptime(
            value,
            "%Y-%m-%d"
        ).date()

    except ValueError:

        return None

def parse_menu_time(value):
    """
    Parse a meal time supplied by the frontend in HH:MM format.
    Returns datetime.time or None when invalid.
    """
    if not value:
        return None

    try:
        return datetime.strptime(
            str(value).strip(),
            "%H:%M"
        ).time()

    except ValueError:
        return None
    
def manager_hostel_ids(
    manager_id
):

    rows = (
        Hostel.query
        .with_entities(
            Hostel.id
        )
        .filter_by(
            manager_user_id=
                manager_id
        )
        .all()
    )

    return [
        row[0]
        for row in rows
    ]


def get_owned_hostel(
    manager_id,
    hostel_id
):

    if not hostel_id:
        return None

    return (
        Hostel.query
        .filter_by(
            id=hostel_id,
            manager_user_id=
                manager_id
        )
        .first()
    )


def manager_owns_mess(
    manager_id,
    mess_unit_id
):

    if not mess_unit_id:
        return None

    return (
        MessUnit.query
        .join(
            Hostel,
            MessUnit.hostel_id
            == Hostel.id
        )
        .filter(
            MessUnit.id
            == mess_unit_id,

            Hostel.manager_user_id
            == manager_id
        )
        .first()
    )


def manager_owned_user_query(
    manager_id,
    role
):
    """
    Return a User query restricted to the authenticated manager's tenant.

    Student and Staff ownership is derived exclusively from:
    User.hostel_id -> Hostel.manager_user_id.

    Users without a valid Hostel are intentionally excluded.  An orphaned
    account must be repaired by the audit/backfill process before a Manager
    can see or mutate it.
    """

    return (
        User.query
        .join(
            Hostel,
            User.hostel_id
            == Hostel.id
        )
        .filter(
            User.role
            == role,

            Hostel.manager_user_id
            == manager_id
        )
    )


def get_owned_user(
    manager_id,
    user_id,
    role
):
    """Return one Student/Staff only when it belongs to this Manager."""

    if not user_id:
        return None

    return (
        manager_owned_user_query(
            manager_id,
            role
        )
        .filter(
            User.id
            == user_id
        )
        .first()
    )


def get_permanent_delete_confirmation():
    """Return the raw permanent-delete confirmation from JSON.

    Intentionally do not trim, uppercase, or otherwise normalize the value.
    Only the exact case-sensitive string DELETE is accepted.
    """

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    return data.get(
        "confirmation"
    )


def permanent_delete_confirmed():
    return (
        get_permanent_delete_confirmation()
        == "DELETE"
    )


def get_owned_block(
    manager_id,
    block_id,
    hostel_id=None
):
    if not block_id:
        return None

    query = (
        HostelBlock.query
        .join(
            Hostel,
            HostelBlock.hostel_id
            == Hostel.id
        )
        .filter(
            HostelBlock.id
            == block_id,

            Hostel.manager_user_id
            == manager_id
        )
    )

    if hostel_id:
        query = query.filter(
            HostelBlock.hostel_id
            == hostel_id
        )

    return query.first()


def validate_global_filters(
    manager_id,
    hostel_id=None,
    block_id=None,
    mess_unit_id=None
):

    if hostel_id:

        hostel = get_owned_hostel(
            manager_id,
            hostel_id
        )

        if not hostel:

            return (
                False,
                "Invalid hostel selection."
            )


    if block_id:

        block = (
            HostelBlock.query
            .join(
                Hostel,
                HostelBlock.hostel_id
                == Hostel.id
            )
            .filter(
                HostelBlock.id
                == block_id,

                Hostel.manager_user_id
                == manager_id
            )
            .first()
        )

        if not block:

            return (
                False,
                "Invalid hostel block selection."
            )


        if (
            hostel_id
            and block.hostel_id
            != hostel_id
        ):

            return (
                False,
                "Selected block does not belong "
                "to the selected hostel."
            )


    if mess_unit_id:

        mess = manager_owns_mess(
            manager_id,
            mess_unit_id
        )

        if not mess:

            return (
                False,
                "Invalid mess unit selection."
            )


        if (
            hostel_id
            and mess.hostel_id
            != hostel_id
        ):

            return (
                False,
                "Selected mess unit does not belong "
                "to the selected hostel."
            )


        if (
            block_id
            and mess.block_id
            and mess.block_id
            != block_id
        ):

            return (
                False,
                "Selected mess unit does not belong "
                "to the selected block."
            )


    return (
        True,
        None
    )


def next_student_id():

    latest = (
        User.query
        .filter(
            User.student_id
            .isnot(None)
        )
        .order_by(
            User.id.desc()
        )
        .first()
    )

    next_number = 1

    if (
        latest
        and latest.student_id
    ):

        try:

            next_number = (
                int(
                    latest.student_id
                    .split("-")[-1]
                )
                + 1
            )

        except (
            ValueError,
            IndexError
        ):

            next_number = (
                secrets.randbelow(
                    9000
                )
                + 1000
            )

    return (
        f"STU-{next_number:04d}"
    )


def next_staff_id():

    latest = (
        User.query
        .filter(
            User.staff_id
            .isnot(None)
        )
        .order_by(
            User.id.desc()
        )
        .first()
    )

    next_number = 1

    if (
        latest
        and latest.staff_id
    ):

        try:

            next_number = (
                int(
                    latest.staff_id
                    .split("-")[-1]
                )
                + 1
            )

        except (
            ValueError,
            IndexError
        ):

            next_number = (
                secrets.randbelow(
                    9000
                )
                + 1000
            )

    return (
        f"STF-{next_number:04d}"
    )


def create_notification(
    manager_id,
    notification_type,
    title,
    message,
    recipient_user_id=None,
):

    notification = Notification(

        manager_user_id=
            manager_id,

        notification_type=
            notification_type,

        title=
            title,

        message=
            message,

        recipient_user_id=
            recipient_user_id,

        is_read=
            False
    )

    db.session.add(
        notification
    )


def create_staff_assignment_notification(manager_id, staff_member, title, message):
    existing = Notification.query.filter_by(
        manager_user_id=manager_id,
        recipient_user_id=staff_member.id,
        notification_type="staff_assignment",
        title=title,
        message=message,
    ).first()
    if not existing:
        create_notification(
            manager_id,
            "staff_assignment",
            title,
            message,
            recipient_user_id=staff_member.id,
        )

# ============================================================
# MANAGER PROFILE
# ============================================================

@manager_bp.route(
    "/profile",
    methods=["GET", "PUT"]
)
@manager_required
def manager_profile():

    manager = get_current_user()

    if request.method == "GET":

        profile = {

            "id":
                manager.id,

            "managerId":
                manager.manager_id,

            "name":
                manager.name,

            "email":
                manager.email,

            "mobile":
                manager.mobile,

            "role":
                manager.role,

            "isActive":
                bool(
                    manager.is_active
                ),

            "hostel":
                manager.hostel,

            "hostelBlock":
                manager.hostel_block

        }

        return jsonify({

            "profile":
                profile,

            "manager":
                profile

        }), 200


    data = (
        request.get_json(
            silent=True
        )
        or {}
    )

    name = (
        str(
            data.get(
                "name",
                manager.name or ""
            )
        )
        .strip()
    )

    email = (
        str(
            data.get(
                "email",
                manager.email or ""
            )
        )
        .strip()
        .lower()
    )

    mobile = (
        str(
            data.get(
                "mobile",
                manager.mobile or ""
            )
        )
        .strip()
    )


    if not name:

        return jsonify({
            "message":
                "Manager name is required."
        }), 400


    if not re.match(
        EMAIL_PATTERN,
        email
    ):

        return jsonify({
            "message":
                "Please enter a valid email address."
        }), 400


    if (
        mobile
        and not re.match(
            MOBILE_PATTERN,
            mobile
        )
    ):

        return jsonify({
            "message":
                "Please enter a valid 10-digit mobile number."
        }), 400


    duplicate_email = (
        User.query

        .filter(
            func.lower(
                User.email
            )
            == email.lower(),

            User.id
            != manager.id
        )

        .first()
    )


    if duplicate_email:

        return jsonify({
            "message":
                "Another account already uses this email address."
        }), 409


    manager.name = name

    manager.email = email

    manager.mobile = (
        mobile
        or None
    )


    try:

        db.session.commit()


    except IntegrityError:

        db.session.rollback()

        return jsonify({
            "message":
                "Unable to update profile because the email "
                "or mobile number is already in use."
        }), 409


    except Exception as error:

        db.session.rollback()

        print(
            "Manager profile update error:",
            error
        )

        return jsonify({
            "message":
                "Unable to update Manager profile."
        }), 500


    profile = {

        "id":
            manager.id,

        "managerId":
            manager.manager_id,

        "name":
            manager.name,

        "email":
            manager.email,

        "mobile":
            manager.mobile,

        "role":
            manager.role,

        "isActive":
            bool(
                manager.is_active
            ),

        "hostel":
            manager.hostel,

        "hostelBlock":
            manager.hostel_block

    }


    return jsonify({

        "message":
            "Manager profile updated successfully.",

        "profile":
            profile,

        "manager":
            profile

    }), 200


# ============================================================
# FILTER OPTIONS
# ============================================================

@manager_bp.route(
    "/filter-options",
    methods=["GET"]
)
@manager_required
def filter_options():

    manager = get_current_user()

    hostels = (
        Hostel.query
        .filter_by(
            manager_user_id=
                manager.id
        )
        .order_by(
            Hostel.name.asc()
        )
        .all()
    )


    hostel_id = get_integer_query(
        "hostel_id"
    )


    if (
        hostel_id
        and not get_owned_hostel(
            manager.id,
            hostel_id
        )
    ):
        return jsonify({
            "message":
                "Hostel not found."
        }), 404


    mess_query = (
        MessUnit.query
        .join(
            Hostel,
            MessUnit.hostel_id
            == Hostel.id
        )
        .filter(
            Hostel.manager_user_id
            == manager.id
        )
    )


    if hostel_id:

        mess_query = mess_query.filter(
            MessUnit.hostel_id
            == hostel_id
        )


    mess_units = (
        mess_query
        .order_by(
            MessUnit.name.asc()
        )
        .all()
    )


    return jsonify({

        "hostels": [

            {
                "id":
                    hostel.id,

                "name":
                    hostel.name,

                "code":
                    hostel.code,

                "status":
                    hostel.status
            }

            for hostel
            in hostels
        ],

        "messUnits": [

            {
                "id":
                    mess.id,

                "hostelId":
                    mess.hostel_id,

                "blockId":
                    mess.block_id,

                "name":
                    mess.name,

                "unitType":
                    mess.unit_type,

                "supportedCategories":
                    mess.supported_categories,

                "status":
                    mess.status
            }

            for mess
            in mess_units
        ],

        "mealCategories": [
            "veg",
            "non-veg"
        ]

    }), 200


# ============================================================
# HOSTELS / MESS UNIT SERIALIZATION HELPERS
# ============================================================

def mess_support_flags(
    supported_categories
):

    value = (
        str(
            supported_categories
            or "both"
        )
        .strip()
        .lower()
    )

    return {
        "supportsVeg":
            value in [
                "veg",
                "both"
            ],

        "supportsNonVeg":
            value in [
                "non-veg",
                "both"
            ]
    }


def build_supported_categories(
    supports_veg,
    supports_non_veg
):

    if (
        supports_veg
        and supports_non_veg
    ):
        return "both"

    if supports_veg:
        return "veg"

    if supports_non_veg:
        return "non-veg"

    return None


def serialize_mess_unit(
    mess,
    include_counts=False
):

    support_flags = (
        mess_support_flags(
            mess.supported_categories
        )
    )

    data = {
        "id":
            mess.id,

        "hostelId":
            mess.hostel_id,

        "name":
            mess.name,

        "type":
            mess.unit_type,

        "unitType":
            mess.unit_type,

        "capacity":
            mess.capacity,

        "supportsVeg":
            support_flags[
                "supportsVeg"
            ],

        "supportsNonVeg":
            support_flags[
                "supportsNonVeg"
            ],

        "supportedCategories":
            mess.supported_categories,

        "status":
            mess.status,

        "block": (
            {
                "id":
                    mess.block.id,

                "name":
                    mess.block.name
            }
            if (
                mess.block
                and mess.block.hostel_id
                == mess.hostel_id
            )
            else None
        ),

        "hostel": (
            {
                "id":
                    mess.hostel.id,

                "name":
                    mess.hostel.name
            }
            if mess.hostel
            else None
        ),

        "supervisor": (
            {
                "id":
                    mess.supervisor.id,

                "name":
                    mess.supervisor.name
            }
            if (
                mess.supervisor
                and mess.supervisor.role
                == "staff"
                and mess.supervisor.hostel_id
                == mess.hostel_id
            )
            else None
        )
    }


    if include_counts:

        data[
            "assignedStudents"
        ] = (
            User.query
            .filter_by(
                role="student",
                hostel_id=mess.hostel_id,
                mess_unit_id=mess.id,
                is_active=True
            )
            .count()
        )


        data[
            "assignedStaff"
        ] = (
            User.query
            .filter_by(
                role="staff",
                hostel_id=mess.hostel_id,
                mess_unit_id=mess.id,
                is_active=True
            )
            .count()
        )


    return data


def serialize_hostel(
    hostel
):

    return {
        "id":
            hostel.id,

        "name":
            hostel.name,

        "code":
            hostel.code,

        "address":
            hostel.address,

        "contactNumber":
            hostel.contact_number,

        "status":
            hostel.status,

        "blocks": [
            {
                "id":
                    block.id,

                "name":
                    block.name,

                "code":
                    block.code,

                "status":
                    block.status
            }

            for block
            in sorted(
                hostel.blocks,
                key=lambda item:
                    item.name.lower()
            )
        ],

        "messUnits": [
            serialize_mess_unit(
                mess
            )

            for mess
            in sorted(
                hostel.mess_units,
                key=lambda item:
                    (
                        item.unit_type,
                        item.name.lower()
                    )
            )
        ],

        "messUnitCount":
            len(
                hostel.mess_units
            ),

        "studentCount":
            (
                User.query
                .filter(
                    User.role
                    == "student",

                    User.hostel_id
                    == hostel.id
                )
                .count()
            ),

        "staffCount":
            (
                User.query
                .filter(
                    User.role
                    == "staff",

                    User.hostel_id
                    == hostel.id
                )
                .count()
            ),

        "menuCount":
            (
                Menu.query
                .filter(
                    Menu.hostel_id
                    == hostel.id
                )
                .count()
            )
    }


def normalize_hostel_mess_unit_payload(
    raw_item
):

    raw_item = (
        raw_item
        if isinstance(
            raw_item,
            dict
        )
        else {}
    )


    name = (
        str(
            raw_item.get(
                "name",
                raw_item.get(
                    "unitName",
                    ""
                )
            )
        )
        .strip()
    )


    unit_type = (
        str(
            raw_item.get(
                "type",
                raw_item.get(
                    "unitType",
                    raw_item.get(
                        "unit_type",
                        ""
                    )
                )
            )
        )
        .strip()
        .lower()
    )


    if (
        not name
        and unit_type
    ):

        if unit_type == "north":
            name = "North Mess"

        elif unit_type == "south":
            name = "South Mess"

        else:
            name = (
                unit_type
                .replace(
                    "_",
                    " "
                )
                .title()
            )


    supports_veg = raw_item.get(
        "supportsVeg",
        raw_item.get(
            "supports_veg",
            True
        )
    )


    supports_non_veg = raw_item.get(
        "supportsNonVeg",
        raw_item.get(
            "supports_non_veg",
            True
        )
    )


    supports_veg = bool(
        supports_veg
    )

    supports_non_veg = bool(
        supports_non_veg
    )


    supported_categories = (
        build_supported_categories(
            supports_veg,
            supports_non_veg
        )
    )


    capacity = raw_item.get(
        "capacity",
        300
    )


    try:

        capacity = int(
            capacity
        )

    except (
        TypeError,
        ValueError
    ):

        capacity = None


    status = (
        str(
            raw_item.get(
                "status",
                "active"
            )
        )
        .strip()
        .lower()
    )


    return {
        "name":
            name,

        "unit_type":
            unit_type,

        "capacity":
            capacity,

        "supports_veg":
            supports_veg,

        "supports_non_veg":
            supports_non_veg,

        "supported_categories":
            supported_categories,

        "status":
            status
    }


def validate_hostel_mess_unit_data(
    item
):

    if item[
        "unit_type"
    ] not in [
        "north",
        "south"
    ]:

        return (
            False,
            "Mess Unit type must be north or south."
        )


    if not item[
        "name"
    ]:

        return (
            False,
            "Mess Unit name is required."
        )


    if (
        item[
            "capacity"
        ]
        is None
        or item[
            "capacity"
        ]
        <= 0
    ):

        return (
            False,
            "Mess Unit capacity must be a positive number."
        )


    if not item[
        "supported_categories"
    ]:

        return (
            False,
            "Each Mess Unit must support Veg, Non-Veg, or both."
        )


    if item[
        "status"
    ] not in [
        "active",
        "inactive"
    ]:

        return (
            False,
            "Invalid Mess Unit status."
        )


    return (
        True,
        None
    )


# ============================================================
# HOSTELS
# ============================================================

@manager_bp.route(
    "/hostels",
    methods=["GET"]
)
@manager_required
def get_hostels():

    manager = get_current_user()


    hostels = (
        Hostel.query
        .filter_by(
            manager_user_id=
                manager.id
        )
        .order_by(
            Hostel.created_at.desc()
        )
        .all()
    )


    return jsonify({
        "hostels": [
            serialize_hostel(
                hostel
            )

            for hostel
            in hostels
        ]
    }), 200


@manager_bp.route(
    "/hostels",
    methods=["POST"]
)
@manager_required
def add_hostel():

    manager = get_current_user()

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    name = (
        str(
            data.get(
                "name",
                ""
            )
        )
        .strip()
    )


    code = (
        str(
            data.get(
                "code",
                ""
            )
        )
        .strip()
        .upper()
    )


    address = (
        str(
            data.get(
                "address",
                ""
            )
        )
        .strip()
    )


    contact_number = (
        str(
            data.get(
                "contactNumber",
                data.get(
                    "contact_number",
                    ""
                )
            )
        )
        .strip()
    )


    status = (
        str(
            data.get(
                "status",
                "active"
            )
        )
        .strip()
        .lower()
    )


    raw_blocks = data.get(
        "blockNames",
        data.get(
            "blocks",
            []
        )
    )


    raw_mess_units = data.get(
        "messUnits",
        data.get(
            "mess_units",
            []
        )
    )


    if not name or not code:

        return jsonify({
            "message":
                "Hostel name and code are required."
        }), 400


    if status not in [
        "active",
        "inactive"
    ]:

        return jsonify({
            "message":
                "Invalid hostel status."
        }), 400


    if (
        contact_number
        and not re.match(
            MOBILE_PATTERN,
            contact_number
        )
    ):

        return jsonify({
            "message":
                "Please enter a valid 10-digit contact number."
        }), 400


    if not isinstance(
        raw_blocks,
        list
    ):

        return jsonify({
            "message":
                "Blocks must be provided as a list."
        }), 400


    if (
        not isinstance(
            raw_mess_units,
            list
        )
        or len(
            raw_mess_units
        )
        == 0
    ):

        return jsonify({
            "message":
                "Please select at least one Mess Unit."
        }), 400


    normalized_mess_units = []

    seen_types = set()


    for raw_item in raw_mess_units:

        item = (
            normalize_hostel_mess_unit_payload(
                raw_item
            )
        )


        valid, message = (
            validate_hostel_mess_unit_data(
                item
            )
        )


        if not valid:

            return jsonify({
                "message":
                    message
            }), 400


        if (
            item[
                "unit_type"
            ]
            in seen_types
        ):

            return jsonify({
                "message":
                    (
                        "A Hostel cannot contain duplicate "
                        f"{item['unit_type'].title()} Mess Units."
                    )
            }), 409


        seen_types.add(
            item[
                "unit_type"
            ]
        )


        normalized_mess_units.append(
            item
        )


    existing = (
        Hostel.query
        .filter_by(
            manager_user_id=
                manager.id,

            code=
                code
        )
        .first()
    )


    if existing:

        return jsonify({
            "message":
                "A Hostel with this code already exists."
        }), 409


    cleaned_blocks = []


    for raw_block in raw_blocks:

        if isinstance(
            raw_block,
            dict
        ):

            block_name = (
                str(
                    raw_block.get(
                        "name",
                        ""
                    )
                )
                .strip()
            )

        else:

            block_name = (
                str(
                    raw_block
                )
                .strip()
            )


        if (
            block_name
            and block_name
            not in cleaned_blocks
        ):

            cleaned_blocks.append(
                block_name
            )


    try:

        hostel = Hostel(
            manager_user_id=
                manager.id,

            name=
                name,

            code=
                code,

            address=
                address or None,

            contact_number=
                contact_number or None,

            status=
                status
        )


        db.session.add(
            hostel
        )


        db.session.flush()


        for index, block_name in enumerate(
            cleaned_blocks,
            start=1
        ):

            block = HostelBlock(
                hostel_id=
                    hostel.id,

                name=
                    block_name,

                code=
                    f"{code}-B{index}",

                status=
                    "active"
            )


            db.session.add(
                block
            )


        for item in normalized_mess_units:

            mess_unit = MessUnit(
                hostel_id=
                    hostel.id,

                block_id=
                    None,

                name=
                    item[
                        "name"
                    ],

                unit_type=
                    item[
                        "unit_type"
                    ],

                supported_categories=
                    item[
                        "supported_categories"
                    ],

                capacity=
                    item[
                        "capacity"
                    ],

                supervisor_user_id=
                    None,

                status=
                    item[
                        "status"
                    ]
            )


            db.session.add(
                mess_unit
            )


        create_notification(
            manager.id,
            "hostel",
            "Hostel added",
            (
                f"{name} and "
                f"{len(normalized_mess_units)} Mess Unit(s) "
                "were created successfully."
            )
        )


        db.session.commit()


        db.session.refresh(
            hostel
        )


    except IntegrityError as error:

        db.session.rollback()


        print(
            "Hostel creation integrity error:",
            error
        )


        return jsonify({
            "message":
                (
                    "Unable to create Hostel because the Hostel code "
                    "or Mess Unit type already exists."
                )
        }), 409


    except Exception as error:

        db.session.rollback()


        print(
            "Hostel creation error:",
            error
        )


        return jsonify({
            "message":
                (
                    "Unable to create Hostel and selected Mess Units. "
                    "No changes were saved."
                )
        }), 500


    return jsonify({
        "message":
            "Hostel and selected Mess Units created successfully.",

        "hostel":
            serialize_hostel(
                hostel
            )
    }), 201


@manager_bp.route(
    "/hostels/<int:hostel_id>",
    methods=["PUT"]
)
@manager_required
def update_hostel(
    hostel_id
):

    manager = get_current_user()


    hostel = get_owned_hostel(
        manager.id,
        hostel_id
    )


    if not hostel:

        return jsonify({
            "message":
                "Hostel not found."
        }), 404


    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    name = (
        str(
            data.get(
                "name",
                hostel.name
            )
        )
        .strip()
    )


    code = (
        str(
            data.get(
                "code",
                hostel.code
            )
        )
        .strip()
        .upper()
    )


    address = (
        str(
            data.get(
                "address",
                hostel.address
                or ""
            )
        )
        .strip()
    )


    contact_number = (
        str(
            data.get(
                "contactNumber",
                data.get(
                    "contact_number",
                    hostel.contact_number
                    or ""
                )
            )
        )
        .strip()
    )


    status = (
        str(
            data.get(
                "status",
                hostel.status
            )
        )
        .strip()
        .lower()
    )


    if not name or not code:

        return jsonify({
            "message":
                "Hostel name and code are required."
        }), 400


    if status not in [
        "active",
        "inactive"
    ]:

        return jsonify({
            "message":
                "Invalid Hostel status."
        }), 400


    if (
        contact_number
        and not re.match(
            MOBILE_PATTERN,
            contact_number
        )
    ):

        return jsonify({
            "message":
                "Please enter a valid 10-digit contact number."
        }), 400


    duplicate_code = (
        Hostel.query
        .filter(
            Hostel.manager_user_id
            == manager.id,

            func.lower(
                Hostel.code
            )
            == code.lower(),

            Hostel.id
            != hostel.id
        )
        .first()
    )


    if duplicate_code:

        return jsonify({
            "message":
                "Another Hostel already uses this code."
        }), 409


    hostel.name = name
    hostel.code = code
    hostel.address = (
        address or None
    )
    hostel.contact_number = (
        contact_number or None
    )
    hostel.status = status


    try:

        db.session.commit()


    except IntegrityError:

        db.session.rollback()


        return jsonify({
            "message":
                "Unable to update Hostel because the code already exists."
        }), 409


    except Exception as error:

        db.session.rollback()


        print(
            "Hostel update error:",
            error
        )


        return jsonify({
            "message":
                "Unable to update Hostel."
        }), 500


    return jsonify({
        "message":
            "Hostel updated successfully.",

        "hostel":
            serialize_hostel(
                hostel
            )
    }), 200


# ============================================================
# PERMANENT DELETE HOSTEL
# ============================================================

@manager_bp.route(
    "/hostels/<int:hostel_id>",
    methods=["DELETE"]
)
@manager_required
def permanently_delete_hostel(
    hostel_id
):

    manager = get_current_user()

    hostel = get_owned_hostel(
        manager.id,
        hostel_id
    )

    if not hostel:
        return jsonify({
            "message":
                "Hostel not found."
        }), 404

    if not permanent_delete_confirmed():
        return jsonify({
            "message":
                "Type exact uppercase DELETE to permanently delete this Hostel."
        }), 400

    hostel_name = hostel.name

    student_ids = [
        row[0]
        for row in (
            db.session.query(
                User.id
            )
            .filter(
                User.role
                == "student",
                User.hostel_id
                == hostel.id
            )
            .all()
        )
    ]

    staff_ids = [
        row[0]
        for row in (
            db.session.query(
                User.id
            )
            .filter(
                User.role
                == "staff",
                User.hostel_id
                == hostel.id
            )
            .all()
        )
    ]

    mess_unit_ids = [
        row[0]
        for row in (
            db.session.query(
                MessUnit.id
            )
            .filter(
                MessUnit.hostel_id
                == hostel.id
            )
            .all()
        )
    ]

    menu_ids = [
        row[0]
        for row in (
            db.session.query(
                Menu.id
            )
            .filter(
                Menu.hostel_id
                == hostel.id
            )
            .all()
        )
    ]

    block_count = (
        HostelBlock.query
        .filter(
            HostelBlock.hostel_id
            == hostel.id
        )
        .count()
    )

    forecast_count = (
        Forecast.query
        .filter(
            Forecast.hostel_id
            == hostel.id
        )
        .count()
    )

    waste_count = (
        WasteRecord.query
        .filter(
            WasteRecord.hostel_id
            == hostel.id
        )
        .count()
    )

    response_conditions = []

    if menu_ids:
        response_conditions.append(
            MealResponse.menu_id.in_(
                menu_ids
            )
        )

    if mess_unit_ids:
        response_conditions.append(
            MealResponse.mess_unit_id.in_(
                mess_unit_ids
            )
        )

    if student_ids:
        response_conditions.append(
            MealResponse.student_user_id.in_(
                student_ids
            )
        )

    try:
        deleted_responses = 0

        if response_conditions:
            deleted_responses = (
                MealResponse.query
                .filter(
                    or_(
                        *response_conditions
                    )
                )
                .delete(
                    synchronize_session=False
                )
            )

        if staff_ids:
            (
                MessUnit.query
                .filter(
                    MessUnit.supervisor_user_id.in_(
                        staff_ids
                    )
                )
                .update(
                    {
                        MessUnit.supervisor_user_id:
                            None
                    },
                    synchronize_session=False
                )
            )

        related_user_ids = (
            student_ids
            + staff_ids
        )

        if related_user_ids:
            (
                Menu.query
                .filter(
                    Menu.created_by.in_(
                        related_user_ids
                    )
                )
                .update(
                    {
                        Menu.created_by:
                            None
                    },
                    synchronize_session=False
                )
            )

        Forecast.query.filter(
            Forecast.hostel_id
            == hostel.id
        ).delete(
            synchronize_session=False
        )

        WasteRecord.query.filter(
            WasteRecord.hostel_id
            == hostel.id
        ).delete(
            synchronize_session=False
        )

        Menu.query.filter(
            Menu.hostel_id
            == hostel.id
        ).delete(
            synchronize_session=False
        )

        if related_user_ids:
            User.query.filter(
                User.id.in_(
                    related_user_ids
                )
            ).delete(
                synchronize_session=False
            )

        MessUnit.query.filter(
            MessUnit.hostel_id
            == hostel.id
        ).delete(
            synchronize_session=False
        )

        HostelBlock.query.filter(
            HostelBlock.hostel_id
            == hostel.id
        ).delete(
            synchronize_session=False
        )

        deleted_hostels = (
            Hostel.query
            .filter(
                Hostel.id
                == hostel.id,
                Hostel.manager_user_id
                == manager.id
            )
            .delete(
                synchronize_session=False
            )
        )

        if deleted_hostels != 1:
            raise RuntimeError(
                "Hostel ownership changed during deletion."
            )

        db.session.commit()

    except Exception as error:
        db.session.rollback()

        print(
            "Permanent Hostel deletion error:",
            error
        )

        return jsonify({
            "message":
                "Unable to permanently delete the Hostel. No changes were saved."
        }), 500

    return jsonify({
        "message":
            "Hostel and all related data deleted permanently.",
        "deleted": {
            "id":
                hostel_id,
            "name":
                hostel_name,
            "students":
                len(student_ids),
            "staff":
                len(staff_ids),
            "messUnits":
                len(mess_unit_ids),
            "blocks":
                block_count,
            "menus":
                len(menu_ids),
            "mealResponses":
                deleted_responses,
            "forecasts":
                forecast_count,
            "wasteRecords":
                waste_count
        }
    }), 200


# ============================================================
# HOSTEL BLOCKS
# ============================================================

@manager_bp.route(
    "/hostels/<int:hostel_id>/blocks",
    methods=["GET"]
)
@manager_required
def get_hostel_blocks(
    hostel_id
):

    manager = get_current_user()


    hostel = get_owned_hostel(
        manager.id,
        hostel_id
    )


    if not hostel:

        return jsonify({
            "message":
                "Hostel not found."
        }), 404


    blocks = (
        HostelBlock.query
        .filter_by(
            hostel_id=
                hostel.id
        )
        .order_by(
            HostelBlock.name.asc()
        )
        .all()
    )


    return jsonify({
        "blocks": [
            {
                "id":
                    block.id,

                "name":
                    block.name,

                "code":
                    block.code,

                "status":
                    block.status
            }

            for block
            in blocks
        ]
    }), 200


# ============================================================
# HOSTEL-SPECIFIC MESS UNITS
# ============================================================

@manager_bp.route(
    "/hostels/<int:hostel_id>/mess-units",
    methods=["POST"]
)
@manager_required
def add_hostel_mess_units(
    hostel_id
):

    manager = get_current_user()


    hostel = get_owned_hostel(
        manager.id,
        hostel_id
    )


    if not hostel:

        return jsonify({
            "message":
                "Hostel not found."
        }), 404


    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    raw_mess_units = data.get(
        "messUnits",
        data.get(
            "mess_units",
            []
        )
    )


    if (
        not isinstance(
            raw_mess_units,
            list
        )
        or len(
            raw_mess_units
        )
        == 0
    ):

        return jsonify({
            "message":
                "Please select at least one Mess Unit."
        }), 400


    normalized_items = []

    request_types = set()


    for raw_item in raw_mess_units:

        item = (
            normalize_hostel_mess_unit_payload(
                raw_item
            )
        )


        valid, message = (
            validate_hostel_mess_unit_data(
                item
            )
        )


        if not valid:

            return jsonify({
                "message":
                    message
            }), 400


        if (
            item[
                "unit_type"
            ]
            in request_types
        ):

            return jsonify({
                "message":
                    (
                        "Duplicate Mess Unit type in request: "
                        f"{item['unit_type']}."
                    )
            }), 409


        request_types.add(
            item[
                "unit_type"
            ]
        )


        existing = (
            MessUnit.query
            .filter_by(
                hostel_id=
                    hostel.id,

                unit_type=
                    item[
                        "unit_type"
                    ]
            )
            .first()
        )


        if existing:

            return jsonify({
                "message":
                    (
                        f"{existing.name} already exists "
                        f"for {hostel.name}."
                    )
            }), 409


        normalized_items.append(
            item
        )


    created_units = []


    try:

        for item in normalized_items:

            mess = MessUnit(
                hostel_id=
                    hostel.id,

                block_id=
                    None,

                name=
                    item[
                        "name"
                    ],

                unit_type=
                    item[
                        "unit_type"
                    ],

                supported_categories=
                    item[
                        "supported_categories"
                    ],

                capacity=
                    item[
                        "capacity"
                    ],

                supervisor_user_id=
                    None,

                status=
                    item[
                        "status"
                    ]
            )


            db.session.add(
                mess
            )


            db.session.flush()


            created_units.append(
                mess
            )


        create_notification(
            manager.id,
            "mess_unit",
            "Mess Units added",
            (
                f"{len(created_units)} Mess Unit(s) "
                f"were added to {hostel.name}."
            )
        )


        db.session.commit()


    except IntegrityError as error:

        db.session.rollback()


        print(
            "Hostel Mess Unit integrity error:",
            error
        )


        return jsonify({
            "message":
                "A Mess Unit with this type already exists for the Hostel."
        }), 409


    except Exception as error:

        db.session.rollback()


        print(
            "Hostel Mess Unit creation error:",
            error
        )


        return jsonify({
            "message":
                "Unable to add Mess Units. No changes were saved."
        }), 500


    return jsonify({
        "message":
            "Selected Mess Units added successfully.",

        "hostel":
            serialize_hostel(
                hostel
            ),

        "messUnits": [
            serialize_mess_unit(
                mess
            )

            for mess
            in created_units
        ]
    }), 201


# ============================================================
# MESS UNITS
# ============================================================

@manager_bp.route(
    "/mess-units",
    methods=["GET"]
)
@manager_required
def get_mess_units():

    manager = get_current_user()


    hostel_id = get_integer_query(
        "hostel_id"
    )


    mess_unit_id = get_integer_query(
        "mess_unit_id"
    )


    valid, message = validate_global_filters(
        manager.id,
        hostel_id,
        None,
        mess_unit_id
    )

    if not valid:
        return jsonify({
            "message":
                message
        }), 404


    query = (
        MessUnit.query
        .join(
            Hostel,
            MessUnit.hostel_id
            == Hostel.id
        )
        .filter(
            Hostel.manager_user_id
            == manager.id
        )
    )


    if hostel_id:

        query = query.filter(
            MessUnit.hostel_id
            == hostel_id
        )


    if mess_unit_id:

        query = query.filter(
            MessUnit.id
            == mess_unit_id
        )


    mess_units = (
        query
        .order_by(
            Hostel.name.asc(),
            MessUnit.unit_type.asc(),
            MessUnit.name.asc()
        )
        .all()
    )


    return jsonify({
        "messUnits": [
            serialize_mess_unit(
                mess,
                include_counts=True
            )

            for mess
            in mess_units
        ]
    }), 200


@manager_bp.route(
    "/mess-units",
    methods=["POST"]
)
@manager_required
def add_mess_unit():

    manager = get_current_user()


    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    hostel_id = data.get(
        "hostelId",
        data.get(
            "hostel_id"
        )
    )


    hostel = get_owned_hostel(
        manager.id,
        hostel_id
    )


    if not hostel:

        return jsonify({
            "message":
                "Invalid Hostel."
        }), 400


    item = (
        normalize_hostel_mess_unit_payload(
            data
        )
    )


    valid, message = (
        validate_hostel_mess_unit_data(
            item
        )
    )


    if not valid:

        return jsonify({
            "message":
                message
        }), 400


    block_id = data.get(
        "blockId",
        data.get(
            "block_id"
        )
    )


    if block_id:

        block = (
            HostelBlock.query
            .filter_by(
                id=
                    block_id,

                hostel_id=
                    hostel.id
            )
            .first()
        )


        if not block:

            return jsonify({
                "message":
                    "Invalid Hostel block."
            }), 400


    existing = (
        MessUnit.query
        .filter_by(
            hostel_id=
                hostel.id,

            unit_type=
                item[
                    "unit_type"
                ]
        )
        .first()
    )


    if existing:

        return jsonify({
            "message":
                (
                    f"{existing.name} already exists "
                    f"for {hostel.name}."
                )
        }), 409


    supervisor_user_id = data.get(
        "supervisorUserId",
        data.get(
            "supervisor_user_id"
        )
    )


    if supervisor_user_id:

        supervisor = get_owned_user(
            manager.id,
            supervisor_user_id,
            "staff"
        )


        if (
            not supervisor
            or supervisor.hostel_id
            != hostel.id
        ):

            return jsonify({
                "message":
                    "Supervisor does not belong to this Hostel."
            }), 404


    try:

        mess = MessUnit(
            hostel_id=
                hostel.id,

            block_id=
                block_id or None,

            name=
                item[
                    "name"
                ],

            unit_type=
                item[
                    "unit_type"
                ],

            supported_categories=
                item[
                    "supported_categories"
                ],

            capacity=
                item[
                    "capacity"
                ],

            supervisor_user_id=
                supervisor_user_id
                or None,

            status=
                item[
                    "status"
                ]
        )


        db.session.add(
            mess
        )


        create_notification(
            manager.id,
            "mess_unit",
            "Mess Unit added",
            (
                f"{item['name']} was added "
                f"to {hostel.name}."
            )
        )


        db.session.commit()


    except IntegrityError:

        db.session.rollback()


        return jsonify({
            "message":
                "A Mess Unit with this type already exists for the Hostel."
        }), 409


    except Exception as error:

        db.session.rollback()


        print(
            "Mess Unit creation error:",
            error
        )


        return jsonify({
            "message":
                "Unable to create Mess Unit."
        }), 500


    return jsonify({
        "message":
            "Mess Unit added successfully.",

        "messUnit":
            serialize_mess_unit(
                mess,
                include_counts=True
            )
    }), 201


@manager_bp.route(
    "/mess-units/<int:mess_unit_id>",
    methods=["PUT"]
)
@manager_required
def update_mess_unit(
    mess_unit_id
):

    manager = get_current_user()


    mess = manager_owns_mess(
        manager.id,
        mess_unit_id
    )


    if not mess:

        return jsonify({
            "message":
                "Mess Unit not found."
        }), 404


    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    current_support = (
        mess_support_flags(
            mess.supported_categories
        )
    )


    name = (
        str(
            data.get(
                "name",
                mess.name
            )
        )
        .strip()
    )


    unit_type = (
        str(
            data.get(
                "type",
                data.get(
                    "unitType",
                    mess.unit_type
                )
            )
        )
        .strip()
        .lower()
    )


    capacity = data.get(
        "capacity",
        mess.capacity
    )


    supports_veg = data.get(
        "supportsVeg",
        data.get(
            "supports_veg",
            current_support[
                "supportsVeg"
            ]
        )
    )


    supports_non_veg = data.get(
        "supportsNonVeg",
        data.get(
            "supports_non_veg",
            current_support[
                "supportsNonVeg"
            ]
        )
    )


    status = (
        str(
            data.get(
                "status",
                mess.status
            )
        )
        .strip()
        .lower()
    )


    normalized = (
        normalize_hostel_mess_unit_payload({
            "name":
                name,

            "type":
                unit_type,

            "capacity":
                capacity,

            "supportsVeg":
                supports_veg,

            "supportsNonVeg":
                supports_non_veg,

            "status":
                status
        })
    )


    valid, message = (
        validate_hostel_mess_unit_data(
            normalized
        )
    )


    if not valid:

        return jsonify({
            "message":
                message
        }), 400


    duplicate_type = (
        MessUnit.query
        .filter(
            MessUnit.hostel_id
            == mess.hostel_id,

            MessUnit.unit_type
            == normalized[
                "unit_type"
            ],

            MessUnit.id
            != mess.id
        )
        .first()
    )


    if duplicate_type:

        return jsonify({
            "message":
                (
                    "Another Mess Unit with this type already "
                    "exists for the Hostel."
                )
        }), 409


    mess.name = normalized[
        "name"
    ]

    mess.unit_type = normalized[
        "unit_type"
    ]

    mess.capacity = normalized[
        "capacity"
    ]

    mess.supported_categories = normalized[
        "supported_categories"
    ]

    mess.status = normalized[
        "status"
    ]


    try:

        db.session.commit()


    except IntegrityError:

        db.session.rollback()


        return jsonify({
            "message":
                "A Mess Unit with this type already exists for the Hostel."
        }), 409


    except Exception as error:

        db.session.rollback()


        print(
            "Mess Unit update error:",
            error
        )


        return jsonify({
            "message":
                "Unable to update Mess Unit."
        }), 500


    return jsonify({
        "message":
            "Mess Unit updated successfully.",

        "messUnit":
            serialize_mess_unit(
                mess,
                include_counts=True
            )
    }), 200


# ============================================================
# OVERVIEW
# ============================================================

@manager_bp.route(
    "/overview",
    methods=["GET"]
)
@manager_required
def manager_overview():

    manager = get_current_user()

    hostel_id = get_integer_query(
        "hostel_id"
    )

    mess_unit_id = get_integer_query(
        "mess_unit_id"
    )

    mess_unit_type = normalize_mess_unit_type(
        request.args.get(
            "mess_unit_type"
        )
    )

    meal_category = normalize_category(
        request.args.get(
            "meal_category"
        )
    )

    valid, message = validate_global_filters(
        manager.id,
        hostel_id,
        None,
        mess_unit_id
    )

    if not valid:
        return jsonify({
            "message": message
        }), 400

    mess_type_ids = filtered_mess_unit_ids(
        manager.id,
        hostel_id,
        mess_unit_type
    )

    owned_hostel_ids = manager_hostel_ids(
        manager.id
    )

    today = date.today()

    # --------------------------------------------------------
    # STUDENTS
    # --------------------------------------------------------

    student_query = (
        User.query
        .filter(
            User.role == "student",
            User.is_active.is_(True)
        )
    )

    if owned_hostel_ids:
        student_query = student_query.filter(
            User.hostel_id.in_(
                owned_hostel_ids
            )
        )
    else:
        student_query = student_query.filter(
            User.id == -1
        )

    if hostel_id:
        student_query = student_query.filter(
            User.hostel_id
            == hostel_id
        )

    if mess_unit_id:
        student_query = student_query.filter(
            User.mess_unit_id
            == mess_unit_id
        )

    elif mess_type_ids is not None:
        student_query = student_query.filter(
            User.mess_unit_id.in_(
                mess_type_ids
            )
        )

    if meal_category:
        student_query = student_query.filter(
            func.lower(
                User.meal_category
            )
            == meal_category
        )

    total_students = student_query.count()

    # --------------------------------------------------------
    # STAFF
    # --------------------------------------------------------

    staff_query = (
        User.query
        .filter(
            User.role == "staff",
            User.is_active.is_(True)
        )
    )

    if owned_hostel_ids:
        staff_query = staff_query.filter(
            User.hostel_id.in_(
                owned_hostel_ids
            )
        )
    else:
        staff_query = staff_query.filter(
            User.id == -1
        )

    if hostel_id:
        staff_query = staff_query.filter(
            User.hostel_id
            == hostel_id
        )

    if mess_unit_id:
        staff_query = staff_query.filter(
            User.mess_unit_id
            == mess_unit_id
        )

    elif mess_type_ids is not None:
        staff_query = staff_query.filter(
            User.mess_unit_id.in_(
                mess_type_ids
            )
        )

    active_staff = staff_query.count()

    # --------------------------------------------------------
    # ACTIVE MESS UNITS
    # --------------------------------------------------------

    mess_query = (
        MessUnit.query
        .join(
            Hostel,
            MessUnit.hostel_id
            == Hostel.id
        )
        .filter(
            Hostel.manager_user_id
            == manager.id,

            MessUnit.status
            == "active"
        )
    )

    if hostel_id:
        mess_query = mess_query.filter(
            MessUnit.hostel_id
            == hostel_id
        )

    if mess_unit_id:
        mess_query = mess_query.filter(
            MessUnit.id
            == mess_unit_id
        )

    elif mess_unit_type:
        mess_query = mess_query.filter(
            func.lower(
                MessUnit.unit_type
            )
            == mess_unit_type
        )

    if meal_category:
        mess_query = mess_query.filter(
            or_(
                func.lower(
                    MessUnit.supported_categories
                )
                == meal_category,

                func.lower(
                    MessUnit.supported_categories
                )
                == "both"
            )
        )

    active_mess_units = mess_query.count()

    # --------------------------------------------------------
    # TODAY'S WASTE / MEALS SERVED
    # --------------------------------------------------------

    waste_query = (
        WasteRecord.query
        .join(
            Hostel,
            WasteRecord.hostel_id
            == Hostel.id
        )
        .filter(
            Hostel.manager_user_id
            == manager.id,

            WasteRecord.record_date
            == today
        )
    )

    if hostel_id:
        waste_query = waste_query.filter(
            WasteRecord.hostel_id
            == hostel_id
        )

    if mess_unit_id:
        waste_query = waste_query.filter(
            WasteRecord.mess_unit_id
            == mess_unit_id
        )

    elif mess_type_ids is not None:
        waste_query = waste_query.filter(
            WasteRecord.mess_unit_id.in_(
                mess_type_ids
            )
        )

    if meal_category:
        waste_query = waste_query.filter(
            WasteRecord.meal_category
            == meal_category
        )

    waste_rows = waste_query.all()

    meals_served_today = sum(
        int(record.students_served or 0)
        for record in waste_rows
    )

    today_waste = sum(
        float(record.waste_kg or 0)
        for record in waste_rows
    )

    meal_totals = {
        "breakfast": 0,
        "lunch": 0,
        "snacks": 0,
        "dinner": 0
    }

    for record in waste_rows:
        meal_name = (
            str(record.meal or "")
            .strip()
            .lower()
        )

        if meal_name in meal_totals:
            meal_totals[meal_name] += int(
                record.students_served
                or 0
            )

    meal_demand = [
        {
            "meal": "Breakfast",
            "count": meal_totals["breakfast"]
        },
        {
            "meal": "Lunch",
            "count": meal_totals["lunch"]
        },
        {
            "meal": "Snacks",
            "count": meal_totals["snacks"]
        },
        {
            "meal": "Dinner",
            "count": meal_totals["dinner"]
        }
    ]

    # --------------------------------------------------------
    # TODAY'S STUDENT RESPONSES
    # --------------------------------------------------------

    menu_query = (
        Menu.query
        .join(
            Hostel,
            Menu.hostel_id
            == Hostel.id
        )
        .filter(
            Hostel.manager_user_id
            == manager.id,

            Menu.menu_date
            == today
        )
    )

    if hostel_id:
        menu_query = menu_query.filter(
            Menu.hostel_id
            == hostel_id
        )

    if mess_unit_id:
        menu_query = menu_query.filter(
            Menu.mess_unit_id
            == mess_unit_id
        )

    elif mess_type_ids is not None:
        menu_query = menu_query.filter(
            Menu.mess_unit_id.in_(
                mess_type_ids
            )
        )

    if meal_category:
        menu_query = menu_query.filter(
            Menu.meal_category
            == meal_category
        )

    menu_ids = [
        item.id
        for item in menu_query.all()
    ]

    today_responses = 0

    if menu_ids:
        today_responses = (
            MealResponse.query
            .filter(
                MealResponse.menu_id.in_(
                    menu_ids
                )
            )
            .count()
        )

    # --------------------------------------------------------
    # NEXT FORECAST
    # --------------------------------------------------------

    forecast_query = (
        Forecast.query
        .join(
            Hostel,
            Forecast.hostel_id
            == Hostel.id
        )
        .filter(
            Hostel.manager_user_id
            == manager.id,

            Forecast.forecast_date
            >= today
        )
    )

    if hostel_id:
        forecast_query = forecast_query.filter(
            Forecast.hostel_id
            == hostel_id
        )

    if mess_unit_id:
        forecast_query = forecast_query.filter(
            Forecast.mess_unit_id
            == mess_unit_id
        )

    elif mess_type_ids is not None:
        forecast_query = forecast_query.filter(
            Forecast.mess_unit_id.in_(
                mess_type_ids
            )
        )

    if meal_category:
        forecast_query = forecast_query.filter(
            Forecast.meal_category
            == meal_category
        )

    next_forecast = (
        forecast_query
        .order_by(
            Forecast.forecast_date.asc(),
            Forecast.meal.asc()
        )
        .first()
    )

    forecast_data = {
        "predictedCount": 0,
        "meal": None,
        "confidence": 0,
        "date": None
    }

    if next_forecast:
        predicted = int(
            next_forecast.predicted_students
            or 0
        )

        actual = next_forecast.actual_students

        confidence = 0

        if predicted > 0 and actual is not None:
            confidence = max(
                0,
                min(
                    100,
                    round(
                        (
                            1
                            - abs(
                                int(actual)
                                - predicted
                            )
                            / predicted
                        )
                        * 100,
                        1
                    )
                )
            )

        forecast_data = {
            "predictedCount": predicted,
            "meal": (
                next_forecast.meal.title()
                if next_forecast.meal
                else None
            ),
            "confidence": confidence,
            "date": (
                next_forecast.forecast_date
                .isoformat()
            )
        }

    # --------------------------------------------------------
    # ALERTS
    # --------------------------------------------------------

    notifications = (
        Notification.query
        .filter_by(
            manager_user_id=manager.id,
            is_read=False
        )
        .order_by(
            Notification.created_at.desc()
        )
        .limit(
            4
        )
        .all()
    )

    alerts = [
        {
            "id": item.id,
            "title": item.title,
            "message": item.message,
            "type": item.notification_type,
            "createdAt": item.created_at.isoformat()
        }
        for item in notifications
    ]

    return jsonify({
        "summary": {
            "totalStudents": total_students,
            "activeStaff": active_staff,
            "activeMessUnits": active_mess_units,
            "mealsServedToday": meals_served_today,
            "todayResponses": today_responses,
            "todayWaste": round(
                today_waste,
                2
            )
        },

        "mealDemand": meal_demand,

        "todaySummary": {
            "breakfast": meal_totals["breakfast"],
            "lunch": meal_totals["lunch"],
            "snacks": meal_totals["snacks"],
            "dinner": meal_totals["dinner"]
        },

        "forecast": forecast_data,

        "alerts": alerts
    }), 200


# ============================================================
# DASHBOARD SUMMARY
# ============================================================

@manager_bp.route(
    "/dashboard/summary",
    methods=["GET"]
)
@manager_required
def dashboard_summary():

    manager = get_current_user()

    hostel_id = get_integer_query(
        "hostel_id"
    )

    block_id = get_integer_query(
        "block_id"
    )

    mess_unit_id = get_integer_query(
        "mess_unit_id"
    )

    mess_unit_type = normalize_mess_unit_type(
        request.args.get(
            "mess_unit_type"
        )
    )

    meal_category = normalize_category(
        request.args.get(
            "meal_category"
        )
    )

    valid, message = validate_global_filters(
        manager.id,
        hostel_id,
        block_id,
        mess_unit_id
    )

    if not valid:
        return jsonify({
            "message": message
        }), 400

    mess_type_ids = filtered_mess_unit_ids(
        manager.id,
        hostel_id,
        mess_unit_type
    )

    student_query = (
        User.query
        .filter_by(
            role="student",
            is_active=True
        )
        .filter(
            User.hostel_id.in_(
                manager_hostel_ids(
                    manager.id
                )
            )
        )
    )

    if hostel_id:
        student_query = student_query.filter(
            User.hostel_id
            == hostel_id
        )

    if block_id:
        student_query = student_query.filter(
            User.block_id
            == block_id
        )

    if mess_unit_id:
        student_query = student_query.filter(
            User.mess_unit_id
            == mess_unit_id
        )

    elif mess_type_ids is not None:
        student_query = student_query.filter(
            User.mess_unit_id.in_(
                mess_type_ids
            )
        )

    if meal_category:
        student_query = student_query.filter(
            func.lower(
                User.meal_category
            )
            == meal_category
        )

    assigned_students = student_query.count()

    today = date.today()

    menu_query = (
        Menu.query
        .join(
            Hostel,
            Menu.hostel_id
            == Hostel.id
        )
        .filter(
            Hostel.manager_user_id
            == manager.id,

            Menu.menu_date
            == today
        )
    )

    if hostel_id:
        menu_query = menu_query.filter(
            Menu.hostel_id
            == hostel_id
        )

    if mess_unit_id:
        menu_query = menu_query.filter(
            Menu.mess_unit_id
            == mess_unit_id
        )

    elif mess_type_ids is not None:
        menu_query = menu_query.filter(
            Menu.mess_unit_id.in_(
                mess_type_ids
            )
        )

    if meal_category:
        menu_query = menu_query.filter(
            Menu.meal_category
            == meal_category
        )

    menu_ids = [
        item.id
        for item in menu_query.all()
    ]

    attending = 0
    skipping = 0

    if menu_ids:
        attending = (
            MealResponse.query
            .filter(
                MealResponse.menu_id.in_(
                    menu_ids
                ),
                MealResponse.response
                == "attending"
            )
            .count()
        )

        skipping = (
            MealResponse.query
            .filter(
                MealResponse.menu_id.in_(
                    menu_ids
                ),
                MealResponse.response
                == "skipping"
            )
            .count()
        )

    responded_students = attending + skipping

    unanswered = max(
        assigned_students
        - responded_students,
        0
    )

    forecast_query = (
        Forecast.query
        .join(
            Hostel,
            Forecast.hostel_id
            == Hostel.id
        )
        .filter(
            Hostel.manager_user_id
            == manager.id,
            Forecast.forecast_date
            == today
        )
    )

    if hostel_id:
        forecast_query = forecast_query.filter(
            Forecast.hostel_id
            == hostel_id
        )

    if mess_unit_id:
        forecast_query = forecast_query.filter(
            Forecast.mess_unit_id
            == mess_unit_id
        )

    elif mess_type_ids is not None:
        forecast_query = forecast_query.filter(
            Forecast.mess_unit_id.in_(
                mess_type_ids
            )
        )

    if meal_category:
        forecast_query = forecast_query.filter(
            Forecast.meal_category
            == meal_category
        )

    predicted = (
        forecast_query
        .with_entities(
            func.sum(
                Forecast.predicted_students
            )
        )
        .scalar()
        or 0
    )

    waste_query = (
        WasteRecord.query
        .join(
            Hostel,
            WasteRecord.hostel_id
            == Hostel.id
        )
        .filter(
            Hostel.manager_user_id
            == manager.id,
            WasteRecord.record_date
            == today
        )
    )

    if hostel_id:
        waste_query = waste_query.filter(
            WasteRecord.hostel_id
            == hostel_id
        )

    if mess_unit_id:
        waste_query = waste_query.filter(
            WasteRecord.mess_unit_id
            == mess_unit_id
        )

    elif mess_type_ids is not None:
        waste_query = waste_query.filter(
            WasteRecord.mess_unit_id.in_(
                mess_type_ids
            )
        )

    if meal_category:
        waste_query = waste_query.filter(
            WasteRecord.meal_category
            == meal_category
        )

    expected_waste = (
        waste_query
        .with_entities(
            func.sum(
                WasteRecord.waste_kg
            )
        )
        .scalar()
        or 0
    )

    return jsonify({
        "assignedStudents": assigned_students,
        "responses": responded_students,
        "attending": attending,
        "skipping": skipping,
        "unanswered": unanswered,
        "mlDemandForecast": int(
            predicted
        ),
        "expectedWaste": round(
            float(
                expected_waste
            ),
            2
        )
    }), 200


# ============================================================
# RESPONSE SUMMARY
# ============================================================

@manager_bp.route(
    "/dashboard/response-summary",
    methods=["GET"]
)
@manager_required
def response_summary():

    manager = get_current_user()

    hostel_id = get_integer_query(
        "hostel_id"
    )

    mess_unit_id = get_integer_query(
        "mess_unit_id"
    )

    mess_unit_type = normalize_mess_unit_type(
        request.args.get(
            "mess_unit_type"
        )
    )

    meal_category = normalize_category(
        request.args.get(
            "meal_category"
        )
    )

    valid, message = validate_global_filters(
        manager.id,
        hostel_id,
        None,
        mess_unit_id
    )

    if not valid:
        return jsonify({
            "message": message
        }), 400

    mess_type_ids = filtered_mess_unit_ids(
        manager.id,
        hostel_id,
        mess_unit_type
    )

    student_query = (
        User.query
        .filter_by(
            role="student",
            is_active=True
        )
        .filter(
            User.hostel_id.in_(
                manager_hostel_ids(
                    manager.id
                )
            )
        )
    )

    if hostel_id:
        student_query = student_query.filter(
            User.hostel_id
            == hostel_id
        )

    if mess_unit_id:
        student_query = student_query.filter(
            User.mess_unit_id
            == mess_unit_id
        )

    elif mess_type_ids is not None:
        student_query = student_query.filter(
            User.mess_unit_id.in_(
                mess_type_ids
            )
        )

    if meal_category:
        student_query = student_query.filter(
            func.lower(
                User.meal_category
            )
            == meal_category
        )

    total_students = student_query.count()

    today = date.today()

    menu_query = (
        Menu.query
        .join(
            Hostel,
            Menu.hostel_id
            == Hostel.id
        )
        .filter(
            Hostel.manager_user_id
            == manager.id,
            Menu.menu_date
            == today
        )
    )

    if hostel_id:
        menu_query = menu_query.filter(
            Menu.hostel_id
            == hostel_id
        )

    if mess_unit_id:
        menu_query = menu_query.filter(
            Menu.mess_unit_id
            == mess_unit_id
        )

    elif mess_type_ids is not None:
        menu_query = menu_query.filter(
            Menu.mess_unit_id.in_(
                mess_type_ids
            )
        )

    if meal_category:
        menu_query = menu_query.filter(
            Menu.meal_category
            == meal_category
        )

    menu_ids = [
        menu.id
        for menu in menu_query.all()
    ]

    attending = 0
    skipping = 0

    if menu_ids:
        attending = (
            MealResponse.query
            .filter(
                MealResponse.menu_id.in_(
                    menu_ids
                ),
                MealResponse.response
                == "attending"
            )
            .count()
        )

        skipping = (
            MealResponse.query
            .filter(
                MealResponse.menu_id.in_(
                    menu_ids
                ),
                MealResponse.response
                == "skipping"
            )
            .count()
        )

    unanswered = max(
        total_students
        - attending
        - skipping,
        0
    )

    denominator = max(
        total_students,
        1
    )

    return jsonify({
        "total": total_students,
        "attending": {
            "count": attending,
            "percentage": round(
                attending
                / denominator
                * 100,
                1
            )
        },
        "skipping": {
            "count": skipping,
            "percentage": round(
                skipping
                / denominator
                * 100,
                1
            )
        },
        "unanswered": {
            "count": unanswered,
            "percentage": round(
                unanswered
                / denominator
                * 100,
                1
            )
        }
    }), 200


# ============================================================
# SEVEN-DAY MEALS GRAPH
# ============================================================

@manager_bp.route(
    "/dashboard/seven-day",
    methods=["GET"]
)
@manager_required
def seven_day_graph():

    manager = get_current_user()

    hostel_id = get_integer_query(
        "hostel_id"
    )

    mess_unit_id = get_integer_query(
        "mess_unit_id"
    )

    mess_unit_type = normalize_mess_unit_type(
        request.args.get(
            "mess_unit_type"
        )
    )

    meal_category = normalize_category(
        request.args.get(
            "meal_category"
        )
    )

    valid, message = validate_global_filters(
        manager.id,
        hostel_id,
        None,
        mess_unit_id
    )

    if not valid:
        return jsonify({
            "message": message
        }), 400

    mess_type_ids = filtered_mess_unit_ids(
        manager.id,
        hostel_id,
        mess_unit_type
    )

    today = date.today()

    start_date = (
        today
        - timedelta(
            days=6
        )
    )

    query = (
        WasteRecord.query
        .join(
            Hostel,
            WasteRecord.hostel_id
            == Hostel.id
        )
        .filter(
            Hostel.manager_user_id
            == manager.id,
            WasteRecord.record_date
            >= start_date,
            WasteRecord.record_date
            <= today
        )
    )

    if hostel_id:
        query = query.filter(
            WasteRecord.hostel_id
            == hostel_id
        )

    if mess_unit_id:
        query = query.filter(
            WasteRecord.mess_unit_id
            == mess_unit_id
        )

    elif mess_type_ids is not None:
        query = query.filter(
            WasteRecord.mess_unit_id.in_(
                mess_type_ids
            )
        )

    if meal_category:
        query = query.filter(
            WasteRecord.meal_category
            == meal_category
        )

    rows = (
        query
        .with_entities(
            WasteRecord.record_date,
            func.sum(
                WasteRecord.students_served
            )
        )
        .group_by(
            WasteRecord.record_date
        )
        .all()
    )

    served_by_date = {
        row[0]: int(
            row[1]
            or 0
        )
        for row in rows
    }

    graph = []

    for offset in range(
        7
    ):
        current_date = (
            start_date
            + timedelta(
                days=offset
            )
        )

        graph.append({
            "date": current_date.isoformat(),
            "label": current_date.strftime(
                "%a"
            ),
            "mealsServed": served_by_date.get(
                current_date,
                0
            )
        })

    return jsonify({
        "data": graph
    }), 200


# ============================================================
# STUDENTS
# ============================================================

@manager_bp.route(
    "/students",
    methods=["GET"]
)
@manager_required
def get_students():

    manager = get_current_user()


    hostel_id = get_integer_query(
        "hostel_id"
    )

    block_id = get_integer_query(
        "block_id"
    )

    mess_unit_id = get_integer_query(
        "mess_unit_id"
    )

    meal_category = normalize_category(
        request.args.get(
            "meal_category"
        )
    )

    status = (
        request.args.get(
            "status",
            ""
        )
        .strip()
        .lower()
    )

    search = (
        request.args.get(
            "search",
            ""
        )
        .strip()
    )


    try:

        page = max(
            int(
                request.args.get(
                    "page",
                    1
                )
            ),
            1
        )

        limit = min(
            max(
                int(
                    request.args.get(
                        "limit",
                        10
                    )
                ),
                1
            ),
            100
        )

    except ValueError:

        page = 1
        limit = 10


    valid, message = validate_global_filters(
        manager.id,
        hostel_id,
        block_id,
        mess_unit_id
    )


    if not valid:
        return jsonify({
            "message":
                message
        }), 404


    query = manager_owned_user_query(
        manager.id,
        "student"
    )


    if hostel_id:

        query = query.filter(
            User.hostel_id
            == hostel_id
        )


    if block_id:

        query = query.filter(
            User.block_id
            == block_id
        )


    if mess_unit_id:

        query = query.filter(
            User.mess_unit_id
            == mess_unit_id
        )


    if meal_category:

        query = query.filter(
            func.lower(
                User.meal_category
            )
            == meal_category
        )


    if status == "active":

        query = query.filter(
            User.is_active.is_(
                True
            )
        )


    elif status == "inactive":

        query = query.filter(
            User.is_active.is_(
                False
            )
        )


    if search:

        search_term = (
            f"%{search}%"
        )

        query = query.filter(

            or_(

                User.student_id.ilike(
                    search_term
                ),

                User.name.ilike(
                    search_term
                ),

                User.email.ilike(
                    search_term
                )
            )

        )


    total = query.count()


    students = (

        query

        .order_by(
            User.name.asc()
        )

        .offset(
            (
                page - 1
            )
            * limit
        )

        .limit(
            limit
        )

        .all()

    )


    return jsonify({

        "students": [

            {

                "id":
                    user.id,

                "studentId":
                    user.student_id,

                "name":
                    user.name,

                "email":
                    user.email,

                "mobile":
                    user.mobile,

                "hostel": {
                    "id":
                        user.hostel_relation.id,

                    "name":
                        user.hostel_relation.name

                } if user.hostel_relation else None,

                "block": {
                    "id":
                        user.block_relation.id,

                    "name":
                        user.block_relation.name

                } if (
                    user.block_relation
                    and user.block_relation.hostel_id
                    == user.hostel_id
                ) else None,

                "messUnit": {
                    "id":
                        user.mess_unit_relation.id,

                    "name":
                        user.mess_unit_relation.name

                } if (
                    user.mess_unit_relation
                    and user.mess_unit_relation.hostel_id
                    == user.hostel_id
                ) else None,

                "mealCategory":
                    (
                        "both"
                        if str(user.meal_category or "").lower() == "both"
                        else "veg"
                        if str(user.meal_category or "").lower() in {"veg", "vegetarian"}
                        else "non-veg"
                        if str(user.meal_category or "").lower() in {"non-veg", "non vegetarian", "nonvegetarian"}
                        else None
                    ),

                "status":
                    (
                        "active"
                        if user.is_active
                        else "inactive"
                    ),

                "mustChangePassword":
                    user.must_change_password
            }

            for user
            in students
        ],

        "pagination": {

            "page":
                page,

            "limit":
                limit,

            "total":
                total,

            "pages":
                (
                    (
                        total
                        + limit
                        - 1
                    )
                    // limit
                )
        }

    }), 200


@manager_bp.route(
    "/students",
    methods=["POST"]
)
@manager_required
def create_student():

    manager = get_current_user()

    data = request.get_json() or {}


    name = data.get(
        "name",
        ""
    ).strip()

    email = data.get(
        "email",
        ""
    ).strip().lower()

    mobile = data.get(
        "mobile",
        ""
    ).strip()

    hostel_id = data.get(
        "hostelId"
    )

    block_id = data.get(
        "blockId"
    )

    mess_unit_id = data.get(
        "messUnitId"
    )

    meal_category = normalize_category(
        data.get(
            "mealCategory"
        )
    )


    if not all([
        name,
        email,
        mobile,
        hostel_id,
        mess_unit_id,
        meal_category
    ]):

        return jsonify({
            "message":
                "Name, email, mobile, Hostel, Mess Unit and meal category are required."
        }), 400


    if not re.match(
        EMAIL_PATTERN,
        email
    ):

        return jsonify({
            "message":
                "Please enter a valid email address."
        }), 400


    if not re.match(
        MOBILE_PATTERN,
        mobile
    ):

        return jsonify({
            "message":
                "Please enter a valid 10-digit "
                "mobile number."
        }), 400


    if (
        User.query
        .filter_by(
            email=email
        )
        .first()
    ):

        return jsonify({
            "message":
                "This email is already registered."
        }), 409


    valid, message = validate_global_filters(
        manager.id,
        hostel_id,
        block_id,
        mess_unit_id
    )


    if not valid:
        return jsonify({
            "message":
                message
        }), 404


    hostel = get_owned_hostel(
        manager.id,
        hostel_id
    )

    mess = manager_owns_mess(
        manager.id,
        mess_unit_id
    )

    block = get_owned_block(
        manager.id,
        block_id,
        hostel_id
    ) if block_id else None


    student = User(

        name=
            name,

        student_id=
            next_student_id(),

        staff_id=
            None,

        manager_id=
            None,

        email=
            email,

        mobile=
            mobile,

        password_hash=
            generate_password_hash(
                "Mess@123"
            ),

        role=
            "student",

        hostel_id=
            hostel_id or None,

        block_id=
            block_id or None,

        mess_unit_id=
            mess_unit_id or None,

        meal_category=
            meal_category,

        hostel=
            None,

        hostel_block=
            None,

        mess_unit=
            None,

        is_active=
            True,

        must_change_password=
            True
    )


    student.hostel = hostel.name

    student.hostel_block = (
        block.name
        if block
        else None
    )

    student.mess_unit = mess.name


    db.session.add(
        student
    )


    create_notification(

        manager.id,

        "student",

        "Student added",

        f"{name} was added "
        "to the portal."
    )


    db.session.commit()


    return jsonify({

        "message":
            "Student added successfully.",

        "student": {

            "id":
                student.id,

            "studentId":
                student.student_id,

            "email":
                student.email,

            "temporaryPassword":
                "Mess@123"
        }

    }), 201


# ============================================================
# ASSIGN / REASSIGN STUDENT
# ============================================================

@manager_bp.route(
    "/students/<int:user_id>/assign",
    methods=["PUT"]
)
@manager_required
def assign_student(
    user_id
):

    manager = get_current_user()

    student = get_owned_user(
        manager.id,
        user_id,
        "student"
    )


    if not student:

        return jsonify({
            "message":
                "Student not found."
        }), 404


    data = request.get_json() or {}


    hostel_id = data.get(
        "hostelId"
    )

    block_id = data.get(
        "blockId"
    )

    mess_unit_id = data.get(
        "messUnitId"
    )

    meal_category = normalize_category(
        data.get(
            "mealCategory"
        )
    )


    if not all([
        hostel_id,
        mess_unit_id,
        meal_category
    ]):

        return jsonify({
            "message":
                "Hostel, mess unit and meal "
                "category are required."
        }), 400


    valid, message = (
        validate_global_filters(

            manager.id,

            hostel_id,

            block_id,

            mess_unit_id
        )
    )


    if not valid:

        return jsonify({
            "message":
                message
        }), 400


    hostel = get_owned_hostel(
        manager.id,
        hostel_id
    )

    block = get_owned_block(
        manager.id,
        block_id,
        hostel_id
    ) if block_id else None

    mess = manager_owns_mess(
        manager.id,
        mess_unit_id
    )


    student.hostel_id = (
        hostel_id
    )

    student.block_id = (
        block_id or None
    )

    student.mess_unit_id = (
        mess_unit_id
    )

    student.meal_category = (
        meal_category
    )


    # Keep old text fields synced
    # for existing Student UI.
    student.hostel = (
        hostel.name
    )

    student.hostel_block = (
        block.name
        if block
        else None
    )

    student.mess_unit = (
        mess.name
    )


    create_notification(

        manager.id,

        "student",

        "Student assigned",

        f"{student.name} was assigned to "
        f"{hostel.name} / {mess.name}."
    )


    db.session.commit()


    return jsonify({
        "message":
            "Student assigned successfully."
    }), 200


# ============================================================
# STUDENT STATUS
# ============================================================

@manager_bp.route(
    "/students/<int:user_id>/status",
    methods=["PATCH"]
)
@manager_required
def change_student_status(
    user_id
):

    manager = get_current_user()

    student = get_owned_user(
        manager.id,
        user_id,
        "student"
    )


    if not student:

        return jsonify({
            "message":
                "Student not found."
        }), 404


    data = request.get_json() or {}


    is_active = data.get(
        "isActive"
    )


    if not isinstance(
        is_active,
        bool
    ):

        return jsonify({
            "message":
                "isActive must be true or false."
        }), 400


    student.is_active = (
        is_active
    )

    db.session.commit()


    return jsonify({

        "message":
            (
                "Student activated successfully."
                if is_active
                else
                "Student deactivated successfully."
            )

    }), 200


# ============================================================
# PERMANENT DELETE STUDENT
# ============================================================

@manager_bp.route(
    "/students/<int:user_id>",
    methods=["DELETE"]
)
@manager_required
def permanently_delete_student(
    user_id
):

    manager = get_current_user()

    student = get_owned_user(
        manager.id,
        user_id,
        "student"
    )

    if not student:
        return jsonify({
            "message":
                "Student not found."
        }), 404

    if not permanent_delete_confirmed():
        return jsonify({
            "message":
                "Type exact uppercase DELETE to permanently delete this Student."
        }), 400

    deleted_student = {
        "id": student.id,
        "studentId": student.student_id,
        "name": student.name,
        "email": student.email,
        "hostel": (
            student.hostel_relation.name
            if student.hostel_relation
            else student.hostel
        ),
        "messUnit": (
            student.mess_unit_relation.name
            if student.mess_unit_relation
            else student.mess_unit
        )
    }

    try:
        deleted_responses = (
            MealResponse.query
            .filter(
                MealResponse.student_user_id
                == student.id
            )
            .delete(
                synchronize_session=False
            )
        )

        Menu.query.filter(
            Menu.created_by
            == student.id
        ).update(
            {
                Menu.created_by:
                    None
            },
            synchronize_session=False
        )

        db.session.delete(
            student
        )

        db.session.commit()

    except Exception as error:
        db.session.rollback()

        print(
            "Permanent Student deletion error:",
            error
        )

        return jsonify({
            "message":
                "Unable to permanently delete the Student. No changes were saved."
        }), 500

    return jsonify({
        "message":
            "Student deleted permanently.",
        "deleted":
            deleted_student,
        "deletedMealResponses":
            deleted_responses
    }), 200


# ============================================================
# STAFF
# ============================================================

@manager_bp.route(
    "/staff",
    methods=["GET"]
)
@manager_required
def get_staff():

    manager = get_current_user()


    hostel_id = get_integer_query(
        "hostel_id"
    )

    mess_unit_id = get_integer_query(
        "mess_unit_id"
    )

    search = (
        request.args.get(
            "search",
            ""
        )
        .strip()
    )


    valid, message = validate_global_filters(
        manager.id,
        hostel_id,
        None,
        mess_unit_id
    )


    if not valid:
        return jsonify({
            "message":
                message
        }), 404


    query = manager_owned_user_query(
        manager.id,
        "staff"
    )


    if hostel_id:

        query = query.filter(
            User.hostel_id
            == hostel_id
        )


    if mess_unit_id:

        query = query.filter(
            User.mess_unit_id
            == mess_unit_id
        )


    if search:

        term = (
            f"%{search}%"
        )

        query = query.filter(

            or_(

                User.staff_id.ilike(
                    term
                ),

                User.name.ilike(
                    term
                ),

                User.email.ilike(
                    term
                )
            )

        )


    staff_members = (
        query
        .order_by(
            User.name.asc()
        )
        .all()
    )


    return jsonify({

        "staff": [

            {

                "id":
                    user.id,

                "staffId":
                    user.staff_id,

                "name":
                    user.name,

                "staffRole":
                    user.staff_role,

                "mealCategory":
                    user.meal_category,

                "email":
                    user.email,

                "mobile":
                    user.mobile,

                "hostel": {
                    "id":
                        user.hostel_relation.id,

                    "name":
                        user.hostel_relation.name

                } if user.hostel_relation else None,

                "block": {
                    "id":
                        user.block_relation.id,

                    "name":
                        user.block_relation.name

                } if (
                    user.block_relation
                    and user.block_relation.hostel_id
                    == user.hostel_id
                ) else None,

                "messUnit": {
                    "id":
                        user.mess_unit_relation.id,

                    "name":
                        user.mess_unit_relation.name

                } if (
                    user.mess_unit_relation
                    and user.mess_unit_relation.hostel_id
                    == user.hostel_id
                ) else None,

                "status":
                    (
                        "active"
                        if user.is_active
                        else "inactive"
                    ),

                "mustChangePassword":
                    user.must_change_password

            }

            for user
            in staff_members
        ]

    }), 200


@manager_bp.route(
    "/staff",
    methods=["POST"]
)
@manager_required
def create_staff():

    manager = get_current_user()

    data = request.get_json() or {}


    name = data.get(
        "name",
        ""
    ).strip()

    email = data.get(
        "email",
        ""
    ).strip().lower()

    mobile = data.get(
        "mobile",
        ""
    ).strip()

    staff_role = data.get(
        "staffRole",
        ""
    ).strip()

    hostel_id = data.get(
        "hostelId"
    )

    block_id = data.get(
        "blockId"
    )

    mess_unit_id = data.get(
        "messUnitId"
    )

    meal_category = normalize_staff_category(
        data.get("mealCategory")
    )


    if not all([
        name,
        email,
        mobile,
        staff_role,
        hostel_id,
        mess_unit_id,
        meal_category
    ]):

        return jsonify({
            "message":
                "Name, email, mobile, Staff role, Hostel, Mess Unit and meal category are required."
        }), 400


    allowed_roles = [
        "Cook",
        "Helper",
        "Supervisor",
        "Cleaner",
        "Store Manager",
        "Mess Staff"
    ]


    if staff_role not in allowed_roles:

        return jsonify({
            "message":
                "Invalid Staff role."
        }), 400


    if not re.match(
        EMAIL_PATTERN,
        email
    ):

        return jsonify({
            "message":
                "Please enter a valid email address."
        }), 400


    if not re.match(
        MOBILE_PATTERN,
        mobile
    ):

        return jsonify({
            "message":
                "Please enter a valid "
                "10-digit mobile number."
        }), 400


    if (
        User.query
        .filter(
            func.lower(
                func.trim(
                    User.email
                )
            ) == email
        )
        .first()
    ):

        return jsonify({
            "message":
                "This email is already registered."
        }), 409


    valid, message = validate_global_filters(
        manager.id,
        hostel_id,
        block_id,
        mess_unit_id
    )


    if not valid:
        return jsonify({
            "message":
                message
        }), 404


    hostel = get_owned_hostel(
        manager.id,
        hostel_id
    )

    mess = manager_owns_mess(
        manager.id,
        mess_unit_id
    )

    block = get_owned_block(
        manager.id,
        block_id,
        hostel_id
    ) if block_id else None

    staff_id = next_staff_id()

    if User.query.filter_by(staff_id=staff_id).first():
        return jsonify({
            "message":
                "Unable to generate a unique Staff ID. Please try again."
        }), 409


    staff = User(

        name=
            name,

        staff_id=
            staff_id,

        student_id=
            None,

        manager_id=
            None,

        email=
            email,

        mobile=
            mobile,

        password_hash=
            generate_password_hash(
                "Mess@123"
            ),

        role=
            "staff",

        staff_role=
            staff_role,

        hostel_id=
            hostel_id or None,

        block_id=
            block_id or None,

        mess_unit_id=
            mess_unit_id or None,

        meal_category=
            meal_category,

        is_active=
            True,

        must_change_password=
            True
    )


    staff.hostel = hostel.name

    staff.hostel_block = (
        block.name
        if block
        else None
    )

    staff.mess_unit = mess.name


    db.session.add(
        staff
    )

    try:
        db.session.flush()

        create_notification(

            manager.id,

            "staff",

            "Staff added",

            f"{name} was added "
            "to the Staff list."
        )
        create_staff_assignment_notification(
            manager.id,
            staff,
            "Staff account created",
            "Your Staff account and hostel, mess-unit and category assignment are ready.",
        )

        db.session.commit()

    except IntegrityError:
        db.session.rollback()

        if (
            User.query
            .filter(
                func.lower(
                    func.trim(
                        User.email
                    )
                ) == email
            )
            .first()
        ):
            return jsonify({
                "message":
                    "This email is already registered."
            }), 409

        if User.query.filter_by(staff_id=staff_id).first():
            return jsonify({
                "message":
                    "This Staff ID is already in use. Please try again."
            }), 409

        return jsonify({
            "message":
                "A Staff account with one of these unique values already exists."
        }), 409

    return jsonify({

        "message":
            "Staff added successfully.",

        "staff": {

            "id":
                staff.id,

            "staffId":
                staff.staff_id,

            "name":
                staff.name,

            "email":
                staff.email,

            "mobile":
                staff.mobile,

            "staffRole":
                staff.staff_role,

            "hostel": {
                "id": staff.hostel_id,
                "name": staff.hostel,
            },

            "block": {
                "id": staff.block_id,
                "name": staff.hostel_block,
            } if staff.block_id else None,

            "messUnit": {
                "id": staff.mess_unit_id,
                "name": staff.mess_unit,
            },

            "mealCategory":
                staff.meal_category,

            "status":
                "active" if staff.is_active else "inactive",

            "mustChangePassword":
                staff.must_change_password,

            "temporaryPassword":
                "Mess@123"
        }

    }), 201


@manager_bp.route(
    "/staff/<int:user_id>",
    methods=["PATCH", "PUT"]
)
@manager_required
def update_staff(user_id):
    manager = get_current_user()
    staff_member = get_owned_user(manager.id, user_id, "staff")
    if not staff_member:
        return jsonify({"message": "Staff member not found."}), 404

    data = request.get_json(silent=True) or {}
    name = str(data.get("name", staff_member.name)).strip()
    email = str(data.get("email", staff_member.email)).strip().lower()
    mobile = str(data.get("mobile", staff_member.mobile or "")).strip()
    staff_role = str(data.get("staffRole", staff_member.staff_role or "")).strip()
    meal_category = normalize_staff_category(
        data.get("mealCategory", staff_member.meal_category)
    )

    if not name or len(name) > 100:
        return jsonify({"message": "Name is required and must be at most 100 characters."}), 400
    if not re.match(EMAIL_PATTERN, email):
        return jsonify({"message": "Please enter a valid email address."}), 400
    if not re.match(MOBILE_PATTERN, mobile):
        return jsonify({"message": "Please enter a valid 10-digit mobile number."}), 400

    allowed_roles = ["Cook", "Helper", "Supervisor", "Cleaner", "Store Manager", "Mess Staff"]
    if staff_role not in allowed_roles:
        return jsonify({"message": "Invalid Staff role."}), 400
    if not meal_category:
        return jsonify({"message": "Select Veg, Non-Veg or Both responsibility."}), 400

    duplicate = User.query.filter(User.email == email, User.id != staff_member.id).first()
    if duplicate:
        return jsonify({"message": "This email is already registered."}), 409

    staff_member.name = name
    staff_member.email = email
    staff_member.mobile = mobile
    staff_member.staff_role = staff_role
    staff_member.meal_category = meal_category
    try:
        create_staff_assignment_notification(
            manager.id,
            staff_member,
            "Staff details updated",
            "Your Staff details or food category assignment have been updated by your Manager.",
        )
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"message": "Unable to update Staff."}), 500
    return jsonify({"message": "Staff details updated successfully."}), 200


@manager_bp.route("/staff/<int:user_id>/assign", methods=["PUT"])
@manager_required
def assign_staff(user_id):
    manager = get_current_user()
    staff_member = get_owned_user(manager.id, user_id, "staff")
    if not staff_member:
        return jsonify({"message": "Staff member not found."}), 404

    data = request.get_json(silent=True) or {}
    try:
        hostel_id = int(data["hostelId"])
        mess_unit_id = int(data["messUnitId"])
        block_id = int(data["blockId"]) if data.get("blockId") else None
    except (KeyError, TypeError, ValueError):
        return jsonify({"message": "Hostel and Mess Unit are required."}), 400

    meal_category = normalize_staff_category(
        data.get("mealCategory", staff_member.meal_category)
    )
    if not meal_category:
        return jsonify({"message": "Select Veg, Non-Veg or Both responsibility."}), 400

    valid, message = validate_global_filters(manager.id, hostel_id, block_id, mess_unit_id)
    if not valid:
        return jsonify({"message": message}), 404

    hostel = get_owned_hostel(manager.id, hostel_id)
    mess = manager_owns_mess(manager.id, mess_unit_id)
    block = get_owned_block(manager.id, block_id, hostel_id) if block_id else None
    if not hostel or not mess or mess.hostel_id != hostel_id:
        return jsonify({"message": "Invalid hostel or mess-unit assignment."}), 400

    staff_member.hostel_id = hostel_id
    staff_member.block_id = block_id
    staff_member.mess_unit_id = mess_unit_id
    staff_member.meal_category = meal_category
    staff_member.hostel = hostel.name
    staff_member.hostel_block = block.name if block else None
    staff_member.mess_unit = mess.name
    create_staff_assignment_notification(
        manager.id,
        staff_member,
        "Mess assignment updated",
        f"Your hostel, mess unit or food category assignment changed to {meal_category.upper()}.",
    )
    db.session.commit()
    return jsonify({"message": "Staff assignment updated successfully."}), 200


@manager_bp.route("/staff/<int:user_id>/status", methods=["PATCH"])
@manager_required
def set_staff_status(user_id):
    manager = get_current_user()
    staff_member = get_owned_user(manager.id, user_id, "staff")
    if not staff_member:
        return jsonify({"message": "Staff member not found."}), 404
    data = request.get_json(silent=True) or {}
    if "isActive" not in data:
        return jsonify({"message": "isActive is required."}), 400
    staff_member.is_active = bool(data["isActive"])
    create_staff_assignment_notification(
        manager.id,
        staff_member,
        "Staff account status updated",
        "Your Staff account is now active." if staff_member.is_active else "Your Staff account is now inactive.",
    )
    db.session.commit()
    return jsonify({
        "message": "Staff activated successfully." if staff_member.is_active else "Staff deactivated successfully.",
        "status": "active" if staff_member.is_active else "inactive",
    }), 200


@manager_bp.route("/staff/<int:user_id>/reset-password", methods=["POST"])
@manager_required
def reset_staff_password(user_id):
    manager = get_current_user()
    staff_member = get_owned_user(manager.id, user_id, "staff")
    if not staff_member:
        return jsonify({"message": "Staff member not found."}), 404
    staff_member.password_hash = generate_password_hash("Mess@123")
    staff_member.must_change_password = True
    create_staff_assignment_notification(
        manager.id,
        staff_member,
        "Staff password reset",
        "Your Manager reset your password. A secure password change is required at next login.",
    )
    db.session.commit()
    return jsonify({
        "message": "Staff password reset successfully.",
        "temporaryPassword": "Mess@123",
    }), 200


@manager_bp.route("/attendance/summary", methods=["GET"])
@manager_required
def manager_attendance_summary():
    manager = get_current_user()
    menu_id = request.args.get("menuId", type=int)
    if not menu_id:
        return jsonify({"message": "menuId is required."}), 400
    menu = get_owned_menu(manager.id, menu_id)
    if not menu:
        return jsonify({"message": "Menu not found."}), 404

    expected = (
        MealResponse.query
        .filter(
            MealResponse.menu_id == menu.id,
            MealResponse.response == "attending",
        )
        .with_entities(MealResponse.student_user_id)
        .distinct()
        .count()
    )
    attended = (
        MealQRVerification.query
        .filter(
            MealQRVerification.menu_id == menu.id,
            MealQRVerification.verification_status == "approved",
        )
        .with_entities(MealQRVerification.student_user_id)
        .distinct()
        .count()
    )
    remaining = max(expected - attended, 0)
    percentage = round(attended / expected * 100, 2) if expected else 0
    return jsonify({
        "menuId": menu.id,
        "meal": menu.meal,
        "mealDate": menu.menu_date.isoformat(),
        "mealCategory": menu.meal_category,
        "expectedAttending": expected,
        "successfullyScanned": attended,
        "remainingToScan": remaining,
        "attendancePercentage": percentage,
    }), 200


@manager_bp.route("/staff-feedback", methods=["GET"])
@manager_required
def list_staff_feedback():
    manager = get_current_user()
    owned_staff_ids = [
        user.id
        for user in manager_owned_user_query(manager.id, "staff").all()
    ]
    rows = (
        StaffFeedback.query
        .filter(StaffFeedback.manager_user_id == manager.id)
        .filter(StaffFeedback.staff_user_id.in_(owned_staff_ids) if owned_staff_ids else False)
        .order_by(StaffFeedback.created_at.desc())
        .all()
    )
    return jsonify({
        "feedback": [
            {
                "id": row.id,
                "staffId": row.staff.staff_id if row.staff else None,
                "staffName": row.staff.name if row.staff else "Staff",
                "hostel": row.hostel.name if row.hostel else None,
                "messUnit": row.mess_unit.name if row.mess_unit else None,
                "mealCategory": row.meal_category,
                "category": row.category,
                "subject": row.subject,
                "description": row.description,
                "status": row.status,
                "managerReply": row.manager_reply,
                "repliedAt": row.replied_at.isoformat() if row.replied_at else None,
                "createdAt": row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ]
    }), 200


@manager_bp.route("/staff-feedback/<int:feedback_id>", methods=["PATCH"])
@manager_required
def reply_staff_feedback(feedback_id):
    manager = get_current_user()
    row = StaffFeedback.query.filter_by(id=feedback_id, manager_user_id=manager.id).first()
    if not row:
        return jsonify({"message": "Staff feedback not found."}), 404
    data = request.get_json(silent=True) or {}
    reply = str(data.get("reply") or "").strip()
    status = str(data.get("status") or row.status).strip().lower()
    if status not in {"pending", "reviewed", "resolved"}:
        return jsonify({"message": "Invalid feedback status."}), 400
    if reply and len(reply) > 5000:
        return jsonify({"message": "Reply must be at most 5000 characters."}), 400
    if reply:
        row.manager_reply = reply
        row.replied_by = manager.id
        row.replied_at = datetime.utcnow()
    row.status = status
    db.session.commit()
    return jsonify({"message": "Staff feedback updated successfully."}), 200


# ============================================================
# PERMANENT DELETE STAFF
# ============================================================

@manager_bp.route(
    "/staff/<int:user_id>",
    methods=["DELETE"]
)
@manager_required
def permanently_delete_staff(
    user_id
):

    manager = get_current_user()

    staff_member = get_owned_user(
        manager.id,
        user_id,
        "staff"
    )

    if not staff_member:
        return jsonify({
            "message":
                "Staff member not found."
        }), 404

    if not permanent_delete_confirmed():
        return jsonify({
            "message":
                "Type exact uppercase DELETE to permanently delete this Staff member."
        }), 400

    deleted_staff = {
        "id": staff_member.id,
        "staffId": staff_member.staff_id,
        "name": staff_member.name,
        "email": staff_member.email,
        "hostel": (
            staff_member.hostel_relation.name
            if staff_member.hostel_relation
            else staff_member.hostel
        ),
        "messUnit": (
            staff_member.mess_unit_relation.name
            if staff_member.mess_unit_relation
            else staff_member.mess_unit
        )
    }

    try:
        supervised_mess_units = (
            MessUnit.query
            .filter(
                MessUnit.supervisor_user_id
                == staff_member.id
            )
            .update(
                {
                    MessUnit.supervisor_user_id:
                        None
                },
                synchronize_session=False
            )
        )

        Menu.query.filter(
            Menu.created_by
            == staff_member.id
        ).update(
            {
                Menu.created_by:
                    None
            },
            synchronize_session=False
        )

        db.session.delete(
            staff_member
        )

        db.session.commit()

    except Exception as error:
        db.session.rollback()

        print(
            "Permanent Staff deletion error:",
            error
        )

        return jsonify({
            "message":
                "Unable to permanently delete the Staff member. No changes were saved."
        }), 500

    return jsonify({
        "message":
            "Staff member deleted permanently.",
        "deleted":
            deleted_staff,
        "supervisorAssignmentsCleared":
            supervised_mess_units
    }), 200


# ============================================================
# MENU MANAGEMENT
# ============================================================

VALID_MENU_MEALS = {
    "breakfast",
    "lunch",
    "snacks",
    "dinner",
}

VALID_MENU_STATUSES = {
    "draft",
    "scheduled",
    "published",
    "unpublished",
    "completed",
}

VALID_MENU_ITEM_CATEGORIES = {
    "veg",
    "non-veg",
    "both",
}

VALID_MENU_ITEM_TYPES = {
    "Main Course",
    "Side Dish",
    "Rice",
    "Bread",
    "Curry",
    "Beverage",
    "Dessert",
    "Salad",
    "Other",
}

APP_TZ = ZoneInfo(Config.APP_TIMEZONE)

MEAL_SCHEDULE = {
    "breakfast": ("07:00", "09:00"),
    "lunch": ("12:00", "14:00"),
    "snacks": ("16:00", "17:00"),
    "dinner": ("19:00", "21:00"),
}


def menu_utc_today():
    return datetime.now(APP_TZ).date()


def get_central_meal_schedule(menu_date, meal):
    """
    Return the centrally configured meal start, end and response
    deadline. Database DateTime values are stored as naive UTC.
    """
    schedule = MEAL_SCHEDULE.get(str(meal or "").lower())

    if not schedule:
        raise ValueError("Invalid meal type.")

    start_text, end_text = schedule

    start_time = datetime.strptime(start_text, "%H:%M").time()
    end_time = datetime.strptime(end_text, "%H:%M").time()

    meal_start = datetime.combine(
        menu_date,
        start_time
    ).replace(tzinfo=APP_TZ)

    response_deadline = meal_start - timedelta(hours=3)

    response_cutoff_utc = (
        response_deadline
        .astimezone(ZoneInfo("UTC"))
        .replace(tzinfo=None)
    )

    return start_time, end_time, response_cutoff_utc

def normalize_menu_meal(value):
    value = str(value or "").strip().lower()
    return value if value in VALID_MENU_MEALS else None


def normalize_menu_status(value):
    value = str(value or "").strip().lower()
    return value if value in VALID_MENU_STATUSES else None


def normalize_menu_item_category(value):
    value = str(value or "").strip().lower()
    if value in {"nonveg", "non_veg", "non vegetarian"}:
        value = "non-veg"
    return value if value in VALID_MENU_ITEM_CATEGORIES else None


def parse_positive_float(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def parse_nonnegative_float(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number >= 0 else None


def parse_iso_datetime(value):
    if not value:
        return None
    text_value = str(value).strip()
    if text_value.endswith("Z"):
        text_value = text_value[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text_value)
    except ValueError:
        return None
    # The project stores MySQL DATETIME values without timezone metadata.
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def get_owned_menu(manager_id, menu_id):
    if not menu_id:
        return None
    return (
        Menu.query
        .join(Hostel, Menu.hostel_id == Hostel.id)
        .join(MessUnit, Menu.mess_unit_id == MessUnit.id)
        .filter(
            Menu.id == menu_id,
            Hostel.manager_user_id == manager_id,
            MessUnit.hostel_id == Hostel.id,
        )
        .first()
    )


def get_owned_template(manager_id, template_id):
    if not template_id:
        return None
    return (
        MenuTemplate.query
        .filter(
            MenuTemplate.id == template_id,
            MenuTemplate.manager_user_id == manager_id,
        )
        .first()
    )


def accessible_menu_item_query(manager_id, include_inactive=False):
    query = MenuItem.query.filter(
        or_(
            MenuItem.manager_user_id.is_(None),
            MenuItem.manager_user_id == manager_id,
        )
    )
    if not include_inactive:
        query = query.filter(MenuItem.is_active.is_(True))
    return query


def get_accessible_menu_item(manager_id, item_id):
    if not item_id:
        return None
    return (
        accessible_menu_item_query(manager_id)
        .filter(MenuItem.id == item_id)
        .first()
    )



def menu_duplicate_query(
    manager_id,
    hostel_id,
    mess_unit_id,
    menu_date,
    meal,
    meal_category,
    start_time=None,
    end_time=None,
    exclude_menu_id=None,
):
    query = (
        Menu.query
        .join(Hostel, Menu.hostel_id == Hostel.id)
        .join(MessUnit, Menu.mess_unit_id == MessUnit.id)
        .filter(
            Hostel.manager_user_id == manager_id,
            MessUnit.hostel_id == Hostel.id,
            Menu.hostel_id == hostel_id,
            Menu.mess_unit_id == mess_unit_id,
            Menu.menu_date == menu_date,
            Menu.meal == meal,
            Menu.meal_category == meal_category,
        )
    )

    if exclude_menu_id:
        query = query.filter(Menu.id != exclude_menu_id)

    return query



def serialize_food_item(item):
    return {
        "id": item.id,
        "name": item.name,
        "type": item.item_type,
        "mealCategory": item.meal_category,
        "imageUrl": item.image_url,
        "defaultQuantity": float(item.default_quantity or 0),
        "defaultUnit": item.default_unit,
        "caloriesPerServing": float(item.calories_per_serving or 0),
        "isCustom": item.manager_user_id is not None,
        "isActive": bool(item.is_active),
    }


def menu_link_calories(link):
    item = link.menu_item
    if not item:
        return 0.0
    calories = float(item.calories_per_serving or 0)
    default_quantity = float(item.default_quantity or 0)
    selected_quantity = float(link.quantity_per_student or 0)
    if (
        calories > 0
        and default_quantity > 0
        and str(link.unit or "").strip().lower()
        == str(item.default_unit or "").strip().lower()
    ):
        return calories * selected_quantity / default_quantity
    return calories


def serialize_menu_link(link):
    item = link.menu_item
    return {
        "linkId": link.id,
        "menuItemId": link.menu_item_id,
        "name": item.name if item else "Unavailable item",
        "type": item.item_type if item else "Other",
        "mealCategory": item.meal_category if item else None,
        "imageUrl": item.image_url if item else None,
        "quantityPerStudent": float(link.quantity_per_student or 0),
        "unit": link.unit,
        "caloriesPerServing": float(item.calories_per_serving or 0) if item else 0,
        "estimatedCalories": round(menu_link_calories(link), 1),
        "displayOrder": link.display_order,
    }


def estimated_students_for_menu(menu):
    query = User.query.filter(
        User.role == "student",
        User.is_active.is_(True),
        User.hostel_id == menu.hostel_id,
        User.mess_unit_id == menu.mess_unit_id,
    )
    # Students with a configured meal category should only be counted for
    # their matching category. Legacy students without a category remain
    # eligible so existing records do not disappear from estimates.
    query = query.filter(
        or_(
            User.meal_category.is_(None),
            User.meal_category == "",
            func.lower(User.meal_category) == menu.meal_category,
        )
    )
    return query.count()


def serialize_menu(menu, include_items=True):
    links = list(menu.item_links) if include_items else []
    structured_items = [serialize_menu_link(link) for link in links]
    calories = round(sum(menu_link_calories(link) for link in links), 1)
    try:
        central_start, central_end, central_cutoff = get_central_meal_schedule(
            menu.menu_date,
            menu.meal,
        )
    except ValueError:
        central_start = menu.start_time
        central_end = menu.end_time
        central_cutoff = menu.response_cutoff

    if links:
        legacy_snapshot = ", ".join(
            link.menu_item.name
            for link in links
            if link.menu_item
        )
    else:
        legacy_snapshot = menu.menu_items or ""

    return {
        "id": menu.id,
        "date": menu.menu_date.isoformat(),
        "meal": menu.meal,
        "mealCategory": menu.meal_category,
        "menuItems": legacy_snapshot,
        "items": structured_items,
        "itemCount": len(links) if links else (
            len([item for item in legacy_snapshot.split(",") if item.strip()])
            if legacy_snapshot else 0
        ),
        "approximateCalories": calories,
        "estimatedStudents": estimated_students_for_menu(menu),
        "hostel": {
            "id": menu.hostel.id,
            "name": menu.hostel.name,
            "code": menu.hostel.code,
        } if menu.hostel else None,
        "messUnit": {
            "id": menu.mess_unit.id,
            "name": menu.mess_unit.name,
            "type": menu.mess_unit.unit_type,
        } if menu.mess_unit else None,
        "startTime": central_start.strftime("%H:%M") if central_start else None,
        "endTime": central_end.strftime("%H:%M") if central_end else None,
        "responseCutoff": central_cutoff.isoformat() if central_cutoff else None,
        "status": menu.status,
        "publishedAt": (
            menu.published_at.isoformat()
            if menu.published_at else None
        ),
        "publishedBy": (
            {
                "id": menu.publisher.id,
                "name": menu.publisher.name,
            }
            if menu.publisher else None
        ),
        "createdAt": (
            menu.created_at.isoformat()
            if menu.created_at else None
        ),
        "updatedAt": (
            menu.updated_at.isoformat()
            if menu.updated_at else None
        ),
    }


def validate_menu_item_payloads(manager_id, raw_items, meal_category):
    if not isinstance(raw_items, list) or not raw_items:
        return None, "Select at least one menu item."

    normalized = []
    seen_item_ids = set()

    for index, raw_item in enumerate(raw_items):
        if not isinstance(raw_item, dict):
            return None, f"Invalid menu item at position {index + 1}."

        item_id = raw_item.get("menuItemId", raw_item.get("id"))
        try:
            item_id = int(item_id)
        except (TypeError, ValueError):
            return None, f"Invalid food item at position {index + 1}."

        if item_id in seen_item_ids:
            return None, "The same food item cannot be selected twice."

        item = get_accessible_menu_item(manager_id, item_id)
        if not item:
            return None, "One or more selected food items are unavailable."

        if item.meal_category not in {"both", meal_category}:
            return None, f"{item.name} does not match the selected meal category."

        quantity = parse_positive_float(
            raw_item.get(
                "quantityPerStudent",
                raw_item.get("quantity"),
            )
        )
        if quantity is None:
            return None, f"Enter a valid quantity for {item.name}."

        unit = str(
            raw_item.get("unit")
            or item.default_unit
            or "serving"
        ).strip()
        if not unit or len(unit) > 30:
            return None, f"Enter a valid unit for {item.name}."

        normalized.append({
            "item": item,
            "quantity": quantity,
            "unit": unit,
            "display_order": index,
        })
        seen_item_ids.add(item_id)

    return normalized, None


def replace_menu_links(menu, normalized_items):
    MenuMenuItem.query.filter(
        MenuMenuItem.menu_id == menu.id
    ).delete(synchronize_session=False)
    db.session.flush()

    names = []
    for entry in normalized_items:
        item = entry["item"]
        names.append(item.name)
        db.session.add(
            MenuMenuItem(
                menu_id=menu.id,
                menu_item_id=item.id,
                quantity_per_student=entry["quantity"],
                unit=entry["unit"],
                display_order=entry["display_order"],
            )
        )

    # Keep legacy consumers working until all Student/Staff pages migrate.
    menu.menu_items = ", ".join(names)


def audience_users_for_menu(menu):
    # Publication visibility is determined by the manager-owned hostel and
    # mess-unit assignment.  Do not use meal_category as an access-control
    # condition: every active student/staff member assigned to this unit must
    # be eligible to receive the published menu notification.
    return (
        User.query
        .filter(
            User.is_active.is_(True),
            User.hostel_id == menu.hostel_id,
            User.mess_unit_id == menu.mess_unit_id,
            User.role.in_(["student", "staff"]),
        )
        .all()
    )


def create_menu_audience_notifications(menu):
    users = audience_users_for_menu(menu)
    if not users:
        return 0

    user_ids = [user.id for user in users]
    existing_ids = {
        row[0]
        for row in (
            db.session.query(MenuNotification.recipient_user_id)
            .filter(
                MenuNotification.menu_id == menu.id,
                MenuNotification.notification_type == "menu_published",
                MenuNotification.recipient_user_id.in_(user_ids),
            )
            .all()
        )
    }

    created = 0
    for user in users:
        if user.id in existing_ids:
            continue
        db.session.add(
            MenuNotification(
                menu_id=menu.id,
                recipient_user_id=user.id,
                notification_type="menu_published",
                title=f"{menu.meal.title()} menu published",
                message=(
                    f"{menu.meal.title()} menu for "
                    f"{menu.menu_date.isoformat()} is now available."
                ),
                is_read=False,
            )
        )
        created += 1
    return created


def clear_menu_audience_notifications(menu_id):
    return (
        MenuNotification.query
        .filter(
            MenuNotification.menu_id == menu_id,
            MenuNotification.notification_type == "menu_published",
        )
        .delete(synchronize_session=False)
    )


def parse_menu_scope_payload(manager_id, data, existing_menu=None):
    hostel_id = data.get(
        "hostelId",
        existing_menu.hostel_id if existing_menu else None,
    )

    mess_unit_id = data.get(
        "messUnitId",
        existing_menu.mess_unit_id if existing_menu else None,
    )

    menu_date = parse_date(
        data.get(
            "date",
            existing_menu.menu_date.isoformat() if existing_menu else None,
        )
    )

    meal = normalize_menu_meal(
        data.get(
            "meal",
            existing_menu.meal if existing_menu else None,
        )
    )

    meal_category = normalize_category(
        data.get(
            "mealCategory",
            existing_menu.meal_category if existing_menu else None,
        )
    )

    try:
        hostel_id = int(hostel_id)
        mess_unit_id = int(mess_unit_id)
    except (TypeError, ValueError):
        return None, "Required menu information is missing."

    if not all([
        hostel_id,
        mess_unit_id,
        menu_date,
        meal,
        meal_category,
    ]):
        return None, "Required menu information is missing."

    try:
        default_start_time, default_end_time, _ = get_central_meal_schedule(
            menu_date,
            meal,
        )
    except ValueError as error:
        return None, str(error)

    # Frontend-provided meal times are intentionally ignored. The central
    # application schedule is the only source of truth.
    start_time = default_start_time
    end_time = default_end_time

    valid, message = validate_global_filters(
        manager_id,
        hostel_id,
        None,
        mess_unit_id,
    )

    if not valid:
        return None, message

    mess = manager_owns_mess(manager_id, mess_unit_id)

    if not mess or mess.hostel_id != hostel_id:
        return None, "Selected Mess Unit does not belong to the selected Hostel."

    return {
        "hostel_id": hostel_id,
        "mess_unit_id": mess_unit_id,
        "menu_date": menu_date,
        "meal": meal,
        "meal_category": meal_category,
        "start_time": start_time,
        "end_time": end_time,
    }, None

def menu_query_for_manager(manager_id):
    return (
        Menu.query
        .join(Hostel, Menu.hostel_id == Hostel.id)
        .join(MessUnit, Menu.mess_unit_id == MessUnit.id)
        .filter(
            Hostel.manager_user_id == manager_id,
            MessUnit.hostel_id == Hostel.id,
        )
    )


def apply_menu_filters(query, manager_id):
    hostel_id = get_integer_query("hostel_id")
    mess_unit_id = get_integer_query("mess_unit_id")

    valid, message = validate_global_filters(
        manager_id,
        hostel_id,
        None,
        mess_unit_id,
    )
    if not valid:
        return None, (jsonify({"message": message}), 404)

    if hostel_id:
        query = query.filter(Menu.hostel_id == hostel_id)
    if mess_unit_id:
        query = query.filter(Menu.mess_unit_id == mess_unit_id)

    category_raw = request.args.get("meal_category")
    if category_raw and str(category_raw).strip().lower() not in {"all", ""}:
        category = normalize_category(category_raw)
        if not category:
            return None, (jsonify({"message": "Invalid meal category."}), 400)
        query = query.filter(Menu.meal_category == category)

    meal_raw = request.args.get("meal")
    if meal_raw and str(meal_raw).strip().lower() not in {"all", ""}:
        meal = normalize_menu_meal(meal_raw)
        if not meal:
            return None, (jsonify({"message": "Invalid meal."}), 400)
        query = query.filter(Menu.meal == meal)

    status_raw = request.args.get("status")
    if status_raw and str(status_raw).strip().lower() not in {"all", ""}:
        status = normalize_menu_status(status_raw)
        if not status:
            return None, (jsonify({"message": "Invalid menu status."}), 400)
        query = query.filter(Menu.status == status)

    selected_date_text = request.args.get("date")
    if selected_date_text:
        selected_date = parse_date(selected_date_text)
        if not selected_date:
            return None, (jsonify({"message": "Invalid menu date."}), 400)
        query = query.filter(Menu.menu_date == selected_date)

    start_text = request.args.get("start_date")
    if start_text:
        start_date = parse_date(start_text)
        if not start_date:
            return None, (jsonify({"message": "Invalid start date."}), 400)
        query = query.filter(Menu.menu_date >= start_date)

    end_text = request.args.get("end_date")
    if end_text:
        end_date = parse_date(end_text)
        if not end_date:
            return None, (jsonify({"message": "Invalid end date."}), 400)
        query = query.filter(Menu.menu_date <= end_date)

    search = str(request.args.get("search", "")).strip()
    if search:
        term = f"%{search}%"
        item_menu_ids = (
            db.session.query(MenuMenuItem.menu_id)
            .join(MenuItem, MenuMenuItem.menu_item_id == MenuItem.id)
            .filter(MenuItem.name.ilike(term))
        )
        query = query.join(MessUnit, Menu.mess_unit_id == MessUnit.id).filter(
            or_(
                Menu.menu_items.ilike(term),
                Hostel.name.ilike(term),
                MessUnit.name.ilike(term),
                Menu.id.in_(item_menu_ids),
            )
        )

    return query, None


@manager_bp.route("/menu-items", methods=["GET"])
@manager_required
def get_menu_items():
    manager = get_current_user()
    query = accessible_menu_item_query(manager.id)

    category_raw = request.args.get("meal_category")
    if category_raw and str(category_raw).strip().lower() not in {"all", ""}:
        category = normalize_category(category_raw)
        if not category:
            return jsonify({"message": "Invalid meal category."}), 400
        query = query.filter(MenuItem.meal_category.in_([category, "both"]))

    search = str(request.args.get("search", "")).strip()
    if search:
        query = query.filter(MenuItem.name.ilike(f"%{search}%"))

    items = query.order_by(MenuItem.name.asc()).all()
    return jsonify({"items": [serialize_food_item(item) for item in items]}), 200


@manager_bp.route("/menu-items", methods=["POST"])
@manager_required
def create_custom_menu_item():
    manager = get_current_user()
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()
    item_type = str(data.get("type", data.get("itemType", ""))).strip()
    category = normalize_menu_item_category(data.get("mealCategory"))
    default_quantity = parse_positive_float(data.get("defaultQuantity", 1))
    default_unit = str(data.get("defaultUnit", "serving")).strip()
    calories = parse_nonnegative_float(data.get("caloriesPerServing", 0))
    image_url = str(data.get("imageUrl") or "").strip() or None

    if not name or len(name) > 150:
        return jsonify({"message": "Enter a valid food item name."}), 400
    if item_type not in VALID_MENU_ITEM_TYPES:
        return jsonify({"message": "Select a valid food item type."}), 400
    if not category:
        return jsonify({"message": "Select a valid food item category."}), 400
    if default_quantity is None:
        return jsonify({"message": "Default quantity must be greater than 0."}), 400
    if not default_unit or len(default_unit) > 30:
        return jsonify({"message": "Enter a valid default unit."}), 400
    if calories is None:
        return jsonify({"message": "Calories per serving cannot be negative."}), 400
    if image_url and len(image_url) > 500:
        return jsonify({"message": "Food image URL is too long."}), 400

    existing = (
        accessible_menu_item_query(manager.id, include_inactive=True)
        .filter(func.lower(MenuItem.name) == name.lower())
        .first()
    )
    if existing:
        return jsonify({
            "message": "A food item with this name already exists.",
            "item": serialize_food_item(existing),
        }), 409

    item = MenuItem(
        manager_user_id=manager.id,
        name=name,
        item_type=item_type,
        meal_category=category,
        image_url=image_url,
        default_quantity=default_quantity,
        default_unit=default_unit,
        calories_per_serving=calories,
        is_active=True,
    )

    try:
        db.session.add(item)
        db.session.commit()
        if item.status == "published":
            notify_staff_for_announcement(manager, item)
            db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "A food item with this name already exists."}), 409
    except Exception as error:
        db.session.rollback()
        print("Custom Menu Item creation error:", error)
        return jsonify({"message": "Unable to create the custom food item."}), 500

    return jsonify({
        "message": "Custom food item created successfully.",
        "item": serialize_food_item(item),
    }), 201


@manager_bp.route("/menus", methods=["GET"])
@manager_required
def get_menus():
    manager = get_current_user()
    query, error_response = apply_menu_filters(
        menu_query_for_manager(manager.id),
        manager.id,
    )
    if error_response:
        return error_response

    menus = (
        query
        .order_by(Menu.menu_date.desc(), Menu.meal.asc(), Menu.id.desc())
        .all()
    )
    return jsonify({"menus": [serialize_menu(menu) for menu in menus]}), 200


@manager_bp.route("/menus/<int:menu_id>", methods=["GET"])
@manager_required
def get_menu(menu_id):
    manager = get_current_user()
    menu = get_owned_menu(manager.id, menu_id)
    if not menu:
        return jsonify({"message": "Menu not found."}), 404
    return jsonify({"menu": serialize_menu(menu)}), 200


@manager_bp.route("/menus", methods=["POST"])
@manager_required
def create_menu():
    manager = get_current_user()
    data = request.get_json(silent=True) or {}

    scope, scope_error = parse_menu_scope_payload(manager.id, data)
    if scope_error:
        return jsonify({"message": scope_error}), 403 if "Invalid" in scope_error or "does not belong" in scope_error else 400

    duplicate = menu_duplicate_query(manager.id, **scope).first()
    if duplicate:
        return jsonify({
            "message": "A menu already exists for this Hostel, Mess Unit, date, meal and category. Edit the existing menu instead.",
            "existingMenuId": duplicate.id,
            "menu": serialize_menu(duplicate),
        }), 409

    structured_items_supplied = "items" in data
    normalized_items = None
    legacy_items = str(data.get("menuItems") or "").strip()

    if structured_items_supplied:
        normalized_items, item_error = validate_menu_item_payloads(
            manager.id,
            data.get("items"),
            scope["meal_category"],
        )
        if item_error:
            return jsonify({"message": item_error}), 400
    elif not legacy_items:
        return jsonify({"message": "Select at least one menu item."}), 400

    _, _, response_cutoff = get_central_meal_schedule(
        scope["menu_date"],
        scope["meal"],
    )
    # New structured Menu Management saves as Draft for today/past or
    # Scheduled for a future date. Legacy clients that explicitly send a
    # status remain compatible until their page is replaced.
    requested_status = normalize_menu_status(data.get("status"))
    if structured_items_supplied or "status" not in data:
        status = "scheduled" if scope["menu_date"] > menu_utc_today() else "draft"
    else:
        status = requested_status or "draft"
        if status == "unpublished":
            status = "draft"

    menu = Menu(
    hostel_id=scope["hostel_id"],
    mess_unit_id=scope["mess_unit_id"],
    menu_date=scope["menu_date"],
    meal=scope["meal"],
    meal_category=scope["meal_category"],
    start_time=scope["start_time"],
    end_time=scope["end_time"],
    menu_items=legacy_items,
    response_cutoff=response_cutoff,
    status=status,
    created_by=manager.id,
)

    try:
        db.session.add(menu)
        db.session.flush()

        if normalized_items is not None:
            replace_menu_links(menu, normalized_items)

        audience_count = 0
        if status == "published":
            menu.published_at = datetime.utcnow()
            menu.published_by = manager.id
            audience_count = create_menu_audience_notifications(menu)

        create_notification(
            manager.id,
            "menu",
            "Menu created",
            f"{menu.meal.title()} menu was created for {menu.menu_date.isoformat()}.",
        )
        db.session.commit()

    except IntegrityError:
        db.session.rollback()
        existing = menu_duplicate_query(manager.id, **scope).first()
        return jsonify({
            "message": "A menu already exists for this Hostel, Mess Unit, date, meal and category. Edit the existing menu instead.",
            "existingMenuId": existing.id if existing else None,
        }), 409
    except Exception as error:
        db.session.rollback()
        print("Menu creation error:", error)
        return jsonify({"message": "Unable to create the Menu. No changes were saved."}), 500

    return jsonify({
        "message": "Menu saved successfully.",
        "menu": serialize_menu(menu),
        "audienceNotificationsCreated": audience_count,
    }), 201


@manager_bp.route("/menus/<int:menu_id>", methods=["PUT"])
@manager_required
def update_menu(menu_id):
    manager = get_current_user()
    menu = get_owned_menu(manager.id, menu_id)
    if not menu:
        return jsonify({"message": "Menu not found."}), 404

    data = request.get_json(silent=True) or {}
    scope, scope_error = parse_menu_scope_payload(manager.id, data, existing_menu=menu)
    if scope_error:
        return jsonify({"message": scope_error}), 403 if "Invalid" in scope_error or "does not belong" in scope_error else 400

    duplicate = menu_duplicate_query(
        manager.id,
        exclude_menu_id=menu.id,
        **scope,
    ).first()
    if duplicate:
        return jsonify({
            "message": "Another menu already exists for this Hostel, Mess Unit, date, meal and category.",
            "existingMenuId": duplicate.id,
        }), 409

    normalized_items = None
    if "items" in data:
        normalized_items, item_error = validate_menu_item_payloads(
            manager.id,
            data.get("items"),
            scope["meal_category"],
        )
        if item_error:
            return jsonify({"message": item_error}), 400

    _, _, response_cutoff = get_central_meal_schedule(
        scope["menu_date"],
        scope["meal"],
    )

    was_published = menu.status == "published"

    try:
        menu.hostel_id = scope["hostel_id"]
        menu.mess_unit_id = scope["mess_unit_id"]
        menu.menu_date = scope["menu_date"]
        menu.meal = scope["meal"]
        menu.meal_category = scope["meal_category"]

        menu.start_time = scope["start_time"]
        menu.end_time = scope["end_time"]

        menu.response_cutoff = response_cutoff

        if normalized_items is not None:
            replace_menu_links(menu, normalized_items)
        elif "menuItems" in data:
            legacy_items = str(data.get("menuItems") or "").strip()
            if not legacy_items:
                return jsonify({"message": "Menu items cannot be empty."}), 400
            menu.menu_items = legacy_items

        audience_count = 0
        if was_published:
            clear_menu_audience_notifications(menu.id)
            audience_count = create_menu_audience_notifications(menu)

        create_notification(
            manager.id,
            "menu",
            "Menu updated",
            f"{menu.meal.title()} menu for {menu.menu_date.isoformat()} was updated.",
        )
        db.session.commit()

    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "Another menu already exists for the selected scope."}), 409
    except Exception as error:
        db.session.rollback()
        print("Menu update error:", error)
        return jsonify({"message": "Unable to update the Menu. No changes were saved."}), 500

    return jsonify({
        "message": "Menu updated successfully.",
        "menu": serialize_menu(menu),
        "audienceNotificationsCreated": audience_count,
    }), 200


@manager_bp.route("/menus/<int:menu_id>/publish", methods=["POST"])
@manager_required
def publish_menu(menu_id):
    manager = get_current_user()
    menu = get_owned_menu(manager.id, menu_id)
    if not menu:
        return jsonify({"message": "Menu not found."}), 404

    has_items = bool(menu.item_links) or bool(str(menu.menu_items or "").strip())
    if not has_items:
        return jsonify({"message": "Add at least one menu item before publishing."}), 400

    if menu.status == "published":
        return jsonify({
            "message": "Menu is already published.",
            "menu": serialize_menu(menu),
        }), 200

    try:
        menu.status = "published"
        menu.published_at = datetime.utcnow()
        menu.published_by = manager.id
        audience_count = create_menu_audience_notifications(menu)
        create_notification(
            manager.id,
            "menu",
            "Menu published",
            f"{menu.meal.title()} menu for {menu.menu_date.isoformat()} was published.",
        )
        db.session.commit()
    except Exception as error:
        db.session.rollback()
        print("Menu publish error:", error)
        return jsonify({"message": "Unable to publish the Menu. No changes were saved."}), 500

    return jsonify({
        "message": "Menu published successfully.",
        "menu": serialize_menu(menu),
        "audienceNotificationsCreated": audience_count,
    }), 200


@manager_bp.route("/menus/<int:menu_id>/unpublish", methods=["POST"])
@manager_required
def unpublish_menu(menu_id):
    manager = get_current_user()
    menu = get_owned_menu(manager.id, menu_id)
    if not menu:
        return jsonify({"message": "Menu not found."}), 404
    if menu.status != "published":
        return jsonify({"message": "Only a published Menu can be unpublished."}), 400

    try:
        menu.status = "unpublished"
        removed_notifications = clear_menu_audience_notifications(menu.id)
        create_notification(
            manager.id,
            "menu",
            "Menu unpublished",
            f"{menu.meal.title()} menu for {menu.menu_date.isoformat()} was unpublished.",
        )
        db.session.commit()
    except Exception as error:
        db.session.rollback()
        print("Menu unpublish error:", error)
        return jsonify({"message": "Unable to unpublish the Menu. No changes were saved."}), 500

    return jsonify({
        "message": "Menu unpublished successfully.",
        "menu": serialize_menu(menu),
        "audienceNotificationsRemoved": int(removed_notifications or 0),
    }), 200


@manager_bp.route("/menus/<int:menu_id>/copy", methods=["POST"])
@manager_required
def copy_menu(menu_id):
    manager = get_current_user()
    source = get_owned_menu(manager.id, menu_id)
    if not source:
        return jsonify({"message": "Menu not found."}), 404

    data = request.get_json(silent=True) or {}
    scope, scope_error = parse_menu_scope_payload(
        manager.id,
        {
            "hostelId": data.get("hostelId", source.hostel_id),
            "messUnitId": data.get("messUnitId", source.mess_unit_id),
            "date": data.get("date"),
            "meal": data.get("meal", source.meal),
            "mealCategory": data.get("mealCategory", source.meal_category),
        },
    )
    if scope_error:
        return jsonify({"message": scope_error}), 403 if "Invalid" in scope_error or "does not belong" in scope_error else 400

    duplicate = menu_duplicate_query(manager.id, **scope).first()
    if duplicate:
        return jsonify({
            "message": "A menu already exists for the selected target date and scope.",
            "existingMenuId": duplicate.id,
        }), 409

    source_links = list(source.item_links)
    if not source_links and not str(source.menu_items or "").strip():
        return jsonify({"message": "The source Menu has no items to copy."}), 400

    start_time, end_time, response_cutoff = get_central_meal_schedule(
        scope["menu_date"],
        scope["meal"],
    )

    target = Menu(
        hostel_id=scope["hostel_id"],
        mess_unit_id=scope["mess_unit_id"],
        menu_date=scope["menu_date"],
        meal=scope["meal"],
        meal_category=scope["meal_category"],
        start_time=start_time,
        end_time=end_time,
        menu_items=source.menu_items or "",
        response_cutoff=response_cutoff,
        status="draft",
        created_by=manager.id,
    )

    try:
        db.session.add(target)
        db.session.flush()
        for index, source_link in enumerate(source_links):
            item = get_accessible_menu_item(manager.id, source_link.menu_item_id)
            if not item:
                raise ValueError("Source Menu contains an unavailable food item.")
            db.session.add(
                MenuMenuItem(
                    menu_id=target.id,
                    menu_item_id=item.id,
                    quantity_per_student=source_link.quantity_per_student,
                    unit=source_link.unit,
                    display_order=index,
                )
            )
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "A menu already exists for the selected target scope."}), 409
    except Exception as error:
        db.session.rollback()
        print("Menu copy error:", error)
        return jsonify({"message": "Unable to copy the Menu. No changes were saved."}), 500

    return jsonify({
        "message": "Previous Menu copied as a new draft.",
        "menu": serialize_menu(target),
    }), 201


@manager_bp.route("/menus/<int:menu_id>/items/<int:link_id>", methods=["PUT"])
@manager_required
def update_menu_item_link(menu_id, link_id):
    manager = get_current_user()
    menu = get_owned_menu(manager.id, menu_id)
    if not menu:
        return jsonify({"message": "Menu not found."}), 404

    link = MenuMenuItem.query.filter_by(id=link_id, menu_id=menu.id).first()
    if not link:
        return jsonify({"message": "Menu item not found."}), 404

    data = request.get_json(silent=True) or {}
    quantity = parse_positive_float(data.get("quantityPerStudent"))
    unit = str(data.get("unit") or link.unit or "").strip()
    if quantity is None:
        return jsonify({"message": "Quantity must be greater than 0."}), 400
    if not unit or len(unit) > 30:
        return jsonify({"message": "Enter a valid unit."}), 400

    try:
        link.quantity_per_student = quantity
        link.unit = unit
        db.session.commit()
    except Exception as error:
        db.session.rollback()
        print("Menu item update error:", error)
        return jsonify({"message": "Unable to update the Menu item."}), 500

    return jsonify({
        "message": "Menu item updated successfully.",
        "menu": serialize_menu(menu),
    }), 200


@manager_bp.route("/menus/<int:menu_id>/items/<int:link_id>", methods=["DELETE"])
@manager_required
def delete_menu_item_link(menu_id, link_id):
    manager = get_current_user()
    menu = get_owned_menu(manager.id, menu_id)
    if not menu:
        return jsonify({"message": "Menu not found."}), 404

    link = MenuMenuItem.query.filter_by(id=link_id, menu_id=menu.id).first()
    if not link:
        return jsonify({"message": "Menu item not found."}), 404

    if MenuMenuItem.query.filter_by(menu_id=menu.id).count() <= 1:
        return jsonify({"message": "A Menu must contain at least one item."}), 400

    try:
        db.session.delete(link)
        db.session.flush()
        remaining_links = (
            MenuMenuItem.query
            .filter(MenuMenuItem.menu_id == menu.id)
            .order_by(MenuMenuItem.display_order.asc(), MenuMenuItem.id.asc())
            .all()
        )
        menu.menu_items = ", ".join(
            item_link.menu_item.name
            for item_link in remaining_links
            if item_link.menu_item
        )
        db.session.commit()
    except Exception as error:
        db.session.rollback()
        print("Menu item deletion error:", error)
        return jsonify({"message": "Unable to remove the Menu item."}), 500

    return jsonify({
        "message": "Menu item removed successfully.",
        "menu": serialize_menu(menu),
    }), 200


@manager_bp.route("/menus/recent", methods=["GET"])
@manager_required
def recent_menus():
    manager = get_current_user()
    try:
        limit = int(request.args.get("limit", 6))
    except (TypeError, ValueError):
        limit = 6
    limit = max(1, min(limit, 20))

    menus = (
        menu_query_for_manager(manager.id)
        .order_by(Menu.menu_date.desc(), Menu.id.desc())
        .limit(limit)
        .all()
    )
    return jsonify({"menus": [serialize_menu(menu) for menu in menus]}), 200


@manager_bp.route("/menus/calendar", methods=["GET"])
@manager_required
def menu_calendar():
    manager = get_current_user()
    try:
        year = int(request.args.get("year", menu_utc_today().year))
        month = int(request.args.get("month", menu_utc_today().month))
    except (TypeError, ValueError):
        return jsonify({"message": "Invalid calendar month or year."}), 400

    if month < 1 or month > 12 or year < 2000 or year > 2200:
        return jsonify({"message": "Invalid calendar month or year."}), 400

    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)
    month_start = date(year, month, 1)

    query = menu_query_for_manager(manager.id).filter(
        Menu.menu_date >= month_start,
        Menu.menu_date < next_month,
    )
    query, error_response = apply_menu_filters(query, manager.id)
    if error_response:
        return error_response

    menus = query.order_by(Menu.menu_date.asc(), Menu.meal.asc()).all()
    by_date = {}
    for menu in menus:
        key = menu.menu_date.isoformat()
        by_date.setdefault(key, []).append(serialize_menu(menu))

    return jsonify({
        "year": year,
        "month": month,
        "days": [
            {"date": date_key, "menus": date_menus}
            for date_key, date_menus in sorted(by_date.items())
        ],
    }), 200


@manager_bp.route("/menus/history", methods=["GET"])
@manager_required
def menu_history():
    manager = get_current_user()
    query = menu_query_for_manager(manager.id).filter(
        Menu.menu_date < menu_utc_today()
    )
    query, error_response = apply_menu_filters(query, manager.id)
    if error_response:
        return error_response

    try:
        page = max(int(request.args.get("page", 1)), 1)
        limit = max(1, min(int(request.args.get("limit", 10)), 100))
    except (TypeError, ValueError):
        return jsonify({"message": "Invalid pagination values."}), 400

    total = query.count()
    pages = max((total + limit - 1) // limit, 1)
    menus = (
        query
        .order_by(Menu.menu_date.desc(), Menu.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return jsonify({
        "menus": [serialize_menu(menu) for menu in menus],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": pages,
        },
        "retentionDays": 40,
        "retentionMessage": "Menu history is retained for 40 days. Older menu records are deleted automatically.",
    }), 200


@manager_bp.route("/menus/<int:menu_id>", methods=["DELETE"])
@manager_required
def permanently_delete_menu(menu_id):
    manager = get_current_user()
    menu = get_owned_menu(manager.id, menu_id)
    if not menu:
        return jsonify({"message": "Menu not found."}), 404
    if not permanent_delete_confirmed():
        return jsonify({"message": "Type exact uppercase DELETE to permanently delete this Menu."}), 400

    deleted_menu = {
        "id": menu.id,
        "date": menu.menu_date.isoformat(),
        "meal": menu.meal,
        "mealCategory": menu.meal_category,
        "hostel": {"id": menu.hostel.id, "name": menu.hostel.name},
        "messUnit": {"id": menu.mess_unit.id, "name": menu.mess_unit.name},
    }

    try:
        deleted_responses = MealResponse.query.filter(
            MealResponse.menu_id == menu.id
        ).delete(synchronize_session=False)
        deleted_item_links = MenuMenuItem.query.filter(
            MenuMenuItem.menu_id == menu.id
        ).delete(synchronize_session=False)
        deleted_audience_notifications = MenuNotification.query.filter(
            MenuNotification.menu_id == menu.id
        ).delete(synchronize_session=False)
        db.session.delete(menu)
        db.session.commit()
    except Exception as error:
        db.session.rollback()
        print("Permanent Menu deletion error:", error)
        return jsonify({"message": "Unable to permanently delete the Menu. No changes were saved."}), 500

    return jsonify({
        "message": "Menu deleted permanently.",
        "deleted": deleted_menu,
        "deletedMealResponses": int(deleted_responses or 0),
        "deletedItemLinks": int(deleted_item_links or 0),
        "deletedAudienceNotifications": int(deleted_audience_notifications or 0),
    }), 200


# ============================================================
# MENU TEMPLATES
# ============================================================


def serialize_template(template):
    return {
        "id": template.id,
        "name": template.name,
        "meal": template.meal,
        "mealCategory": template.meal_category,
        "description": template.description or "",
        "isActive": bool(template.is_active),
        "items": [
            {
                **serialize_food_item(link.menu_item),
                "templateItemId": link.id,
                "quantityPerStudent": float(link.quantity_per_student or 0),
                "unit": link.unit,
                "displayOrder": link.display_order,
            }
            for link in template.items
            if link.menu_item
        ],
        "itemCount": len(template.items),
        "createdAt": template.created_at.isoformat() if template.created_at else None,
        "updatedAt": template.updated_at.isoformat() if template.updated_at else None,
    }


def validate_template_items(manager_id, raw_items, meal_category):
    normalized, error = validate_menu_item_payloads(
        manager_id,
        raw_items,
        meal_category,
    )
    return normalized, error


def replace_template_items(template, normalized_items):
    MenuTemplateItem.query.filter(
        MenuTemplateItem.template_id == template.id
    ).delete(synchronize_session=False)
    db.session.flush()
    for entry in normalized_items:
        db.session.add(
            MenuTemplateItem(
                template_id=template.id,
                menu_item_id=entry["item"].id,
                quantity_per_student=entry["quantity"],
                unit=entry["unit"],
                display_order=entry["display_order"],
            )
        )


@manager_bp.route("/menu-templates", methods=["GET"])
@manager_required
def get_menu_templates():
    manager = get_current_user()
    query = MenuTemplate.query.filter(MenuTemplate.manager_user_id == manager.id)

    active_raw = str(request.args.get("active", "all")).strip().lower()
    if active_raw in {"true", "1", "active"}:
        query = query.filter(MenuTemplate.is_active.is_(True))
    elif active_raw in {"false", "0", "inactive"}:
        query = query.filter(MenuTemplate.is_active.is_(False))

    search = str(request.args.get("search", "")).strip()
    if search:
        query = query.filter(MenuTemplate.name.ilike(f"%{search}%"))

    templates = query.order_by(MenuTemplate.name.asc()).all()
    return jsonify({"templates": [serialize_template(template) for template in templates]}), 200


@manager_bp.route("/menu-templates", methods=["POST"])
@manager_required
def create_menu_template():
    manager = get_current_user()
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()
    meal = normalize_menu_meal(data.get("meal"))
    category = normalize_category(data.get("mealCategory"))
    description = str(data.get("description") or "").strip()
    is_active = data.get("isActive", True) is not False

    if not name or len(name) > 150:
        return jsonify({"message": "Template name is required."}), 400
    if not meal or not category:
        return jsonify({"message": "Select a valid meal and meal category."}), 400

    normalized_items, item_error = validate_template_items(
        manager.id,
        data.get("items"),
        category,
    )
    if item_error:
        return jsonify({"message": item_error}), 400

    existing = MenuTemplate.query.filter(
        MenuTemplate.manager_user_id == manager.id,
        func.lower(MenuTemplate.name) == name.lower(),
    ).first()
    if existing:
        return jsonify({"message": "A Menu Template with this name already exists."}), 409

    template = MenuTemplate(
        manager_user_id=manager.id,
        name=name,
        meal=meal,
        meal_category=category,
        description=description or None,
        is_active=is_active,
    )

    try:
        db.session.add(template)
        db.session.flush()
        replace_template_items(template, normalized_items)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "A Menu Template with this name already exists."}), 409
    except Exception as error:
        db.session.rollback()
        print("Menu Template creation error:", error)
        return jsonify({"message": "Unable to create the Menu Template."}), 500

    return jsonify({
        "message": "Menu Template created successfully.",
        "template": serialize_template(template),
    }), 201


@manager_bp.route("/menu-templates/<int:template_id>", methods=["GET"])
@manager_required
def get_menu_template(template_id):
    manager = get_current_user()
    template = get_owned_template(manager.id, template_id)
    if not template:
        return jsonify({"message": "Menu Template not found."}), 404
    return jsonify({"template": serialize_template(template)}), 200


@manager_bp.route("/menu-templates/<int:template_id>", methods=["PUT"])
@manager_required
def update_menu_template(template_id):
    manager = get_current_user()
    template = get_owned_template(manager.id, template_id)
    if not template:
        return jsonify({"message": "Menu Template not found."}), 404

    data = request.get_json(silent=True) or {}
    name = str(data.get("name", template.name)).strip()
    meal = normalize_menu_meal(data.get("meal", template.meal))
    category = normalize_category(data.get("mealCategory", template.meal_category))
    description = str(data.get("description", template.description or "")).strip()
    is_active = bool(data.get("isActive", template.is_active))

    if not name or len(name) > 150:
        return jsonify({"message": "Template name is required."}), 400
    if not meal or not category:
        return jsonify({"message": "Select a valid meal and meal category."}), 400

    normalized_items = None
    if "items" in data:
        normalized_items, item_error = validate_template_items(
            manager.id,
            data.get("items"),
            category,
        )
        if item_error:
            return jsonify({"message": item_error}), 400

    duplicate = MenuTemplate.query.filter(
        MenuTemplate.manager_user_id == manager.id,
        MenuTemplate.id != template.id,
        func.lower(MenuTemplate.name) == name.lower(),
    ).first()
    if duplicate:
        return jsonify({"message": "Another Menu Template with this name already exists."}), 409

    try:
        template.name = name
        template.meal = meal
        template.meal_category = category
        template.description = description or None
        template.is_active = is_active
        if normalized_items is not None:
            replace_template_items(template, normalized_items)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "Another Menu Template with this name already exists."}), 409
    except Exception as error:
        db.session.rollback()
        print("Menu Template update error:", error)
        return jsonify({"message": "Unable to update the Menu Template."}), 500

    return jsonify({
        "message": "Menu Template updated successfully.",
        "template": serialize_template(template),
    }), 200


@manager_bp.route("/menu-templates/<int:template_id>/use", methods=["POST"])
@manager_required
def use_menu_template(template_id):
    manager = get_current_user()
    template = get_owned_template(manager.id, template_id)
    if not template:
        return jsonify({"message": "Menu Template not found."}), 404
    if not template.is_active:
        return jsonify({"message": "This Menu Template is inactive."}), 400

    data = request.get_json(silent=True) or {}
    scope, scope_error = parse_menu_scope_payload(
        manager.id,
        {
            "hostelId": data.get("hostelId"),
            "messUnitId": data.get("messUnitId"),
            "date": data.get("date"),
            "meal": data.get("meal", template.meal),
            "mealCategory": data.get("mealCategory", template.meal_category),
        },
    )
    if scope_error:
        return jsonify({"message": scope_error}), 403 if "Invalid" in scope_error or "does not belong" in scope_error else 400

    duplicate = menu_duplicate_query(manager.id, **scope).first()
    if duplicate:
        return jsonify({
            "message": "A menu already exists for the selected target date and scope.",
            "existingMenuId": duplicate.id,
        }), 409

    if not template.items:
        return jsonify({"message": "This Menu Template has no food items."}), 400

    start_time, end_time, response_cutoff = get_central_meal_schedule(
        scope["menu_date"],
        scope["meal"],
    )

    menu = Menu(
        hostel_id=scope["hostel_id"],
        mess_unit_id=scope["mess_unit_id"],
        menu_date=scope["menu_date"],
        meal=scope["meal"],
        meal_category=scope["meal_category"],
        start_time=start_time,
        end_time=end_time,
        response_cutoff=response_cutoff,
        menu_items=", ".join(
            link.menu_item.name for link in template.items if link.menu_item
        ),
        status="scheduled" if scope["menu_date"] > menu_utc_today() else "draft",
        created_by=manager.id,
    )

    try:
        db.session.add(menu)
        db.session.flush()
        for index, template_link in enumerate(template.items):
            item = get_accessible_menu_item(manager.id, template_link.menu_item_id)
            if not item:
                raise ValueError("Template contains an unavailable food item.")
            db.session.add(
                MenuMenuItem(
                    menu_id=menu.id,
                    menu_item_id=item.id,
                    quantity_per_student=template_link.quantity_per_student,
                    unit=template_link.unit,
                    display_order=index,
                )
            )
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "A menu already exists for the selected scope."}), 409
    except Exception as error:
        db.session.rollback()
        print("Use Menu Template error:", error)
        return jsonify({"message": "Unable to create a Menu from this Template."}), 500

    return jsonify({
        "message": "Menu created from Template successfully.",
        "menu": serialize_menu(menu),
    }), 201


@manager_bp.route("/menu-templates/<int:template_id>", methods=["DELETE"])
@manager_required
def permanently_delete_menu_template(template_id):
    manager = get_current_user()
    template = get_owned_template(manager.id, template_id)
    if not template:
        return jsonify({"message": "Menu Template not found."}), 404
    if not permanent_delete_confirmed():
        return jsonify({"message": "Type exact uppercase DELETE to permanently delete this Menu Template."}), 400

    deleted_template = {
        "id": template.id,
        "name": template.name,
        "meal": template.meal,
        "mealCategory": template.meal_category,
    }

    try:
        deleted_items = MenuTemplateItem.query.filter(
            MenuTemplateItem.template_id == template.id
        ).delete(synchronize_session=False)
        db.session.delete(template)
        db.session.commit()
    except Exception as error:
        db.session.rollback()
        print("Permanent Menu Template deletion error:", error)
        return jsonify({"message": "Unable to permanently delete the Menu Template. No changes were saved."}), 500

    return jsonify({
        "message": "Menu Template deleted permanently.",
        "deleted": deleted_template,
        "deletedTemplateItems": int(deleted_items or 0),
    }), 200


# ============================================================
# FORECASTS
# ============================================================

@manager_bp.route(
    "/forecasts",
    methods=["GET"]
)
@manager_required
def get_forecasts():

    manager = get_current_user()


    hostel_id = get_integer_query(
        "hostel_id"
    )

    mess_unit_id = get_integer_query(
        "mess_unit_id"
    )

    meal_category = normalize_category(
        request.args.get(
            "meal_category"
        )
    )

    start_date = parse_date(
        request.args.get(
            "start_date"
        )
    )

    end_date = parse_date(
        request.args.get(
            "end_date"
        )
    )


    valid, message = validate_global_filters(
        manager.id,
        hostel_id,
        None,
        mess_unit_id
    )

    if not valid:
        return jsonify({
            "message":
                message
        }), 404


    query = (
        Forecast.query
        .join(
            Hostel,
            Forecast.hostel_id
            == Hostel.id
        )
        .filter(
            Hostel.manager_user_id
            == manager.id
        )
    )


    if hostel_id:

        query = query.filter(
            Forecast.hostel_id
            == hostel_id
        )


    if mess_unit_id:

        query = query.filter(
            Forecast.mess_unit_id
            == mess_unit_id
        )


    if meal_category:

        query = query.filter(
            Forecast.meal_category
            == meal_category
        )


    if start_date:

        query = query.filter(
            Forecast.forecast_date
            >= start_date
        )


    if end_date:

        query = query.filter(
            Forecast.forecast_date
            <= end_date
        )


    forecasts = (
        query
        .order_by(
            Forecast.forecast_date.asc(),
            Forecast.meal.asc()
        )
        .all()
    )


    return jsonify({

        "forecasts": [

            {

                "id":
                    forecast.id,

                "date":
                    forecast.forecast_date.isoformat(),

                "meal":
                    forecast.meal,

                "mealCategory":
                    forecast.meal_category,

                "predictedStudents":
                    forecast.predicted_students,

                "actualStudents":
                    forecast.actual_students,

                "difference":
                    (
                        forecast.actual_students
                        - forecast.predicted_students

                        if forecast.actual_students
                        is not None

                        else None
                    ),

                "preparationStatus":
                    forecast.preparation_status,

                "messUnit":
                    forecast.mess_unit.name,

                "hostel":
                    forecast.hostel.name,

                "lastUpdated":
                    forecast.updated_at.isoformat()

            }

            for forecast
            in forecasts
        ]

    }), 200


# ============================================================
# REPORT HELPERS
# ============================================================

def get_report_filters():
    """
    Read and normalize common Reports filters.

    Default report range:
        end_date   = today
        start_date = 6 days before end_date

    This produces a 7-day inclusive reporting period.
    """

    hostel_id = get_integer_query(
        "hostel_id"
    )

    mess_unit_id = get_integer_query(
        "mess_unit_id"
    )

    meal_category = normalize_category(
        request.args.get(
            "meal_category"
        )
    )

    start_date = parse_date(
        request.args.get(
            "start_date"
        )
    )

    end_date = parse_date(
        request.args.get(
            "end_date"
        )
    )


    if not end_date:
        end_date = date.today()


    if not start_date:
        start_date = (
            end_date
            - timedelta(
                days=6
            )
        )


    return {
        "hostel_id":
            hostel_id,

        "mess_unit_id":
            mess_unit_id,

        "meal_category":
            meal_category,

        "start_date":
            start_date,

        "end_date":
            end_date,
    }


def validate_report_filters(
    manager,
    filters
):
    """
    Validate:
    - Date range
    - Manager ownership
    - Hostel / Mess relationship
    """

    start_date = (
        filters[
            "start_date"
        ]
    )

    end_date = (
        filters[
            "end_date"
        ]
    )


    if (
        start_date
        > end_date
    ):
        return (
            False,
            "Start Date cannot be later than End Date."
        )


    hostel_id = (
        filters[
            "hostel_id"
        ]
    )

    mess_unit_id = (
        filters[
            "mess_unit_id"
        ]
    )


    valid, message = (
        validate_global_filters(
            manager.id,
            hostel_id,
            None,
            mess_unit_id
        )
    )


    if not valid:
        return (
            False,
            message
        )


    return (
        True,
        ""
    )


# ============================================================
# REPORT SUMMARY
# ============================================================

@manager_bp.route(
    "/reports/summary",
    methods=["GET"]
)
@manager_required
def report_summary():

    manager = get_current_user()


    filters = (
        get_report_filters()
    )


    valid, message = (
        validate_report_filters(
            manager,
            filters
        )
    )


    if not valid:
        return jsonify({
            "message":
                message
        }), 400


    hostel_id = (
        filters[
            "hostel_id"
        ]
    )

    mess_unit_id = (
        filters[
            "mess_unit_id"
        ]
    )

    meal_category = (
        filters[
            "meal_category"
        ]
    )

    start_date = (
        filters[
            "start_date"
        ]
    )

    end_date = (
        filters[
            "end_date"
        ]
    )


    # --------------------------------------------------------
    # WASTE / MEAL SERVICE RECORDS
    # --------------------------------------------------------

    query = (
        WasteRecord.query

        .join(
            Hostel,
            WasteRecord.hostel_id
            == Hostel.id
        )

        .filter(
            Hostel.manager_user_id
            == manager.id,

            WasteRecord.record_date
            >= start_date,

            WasteRecord.record_date
            <= end_date
        )
    )


    if hostel_id:

        query = query.filter(
            WasteRecord.hostel_id
            == hostel_id
        )


    if mess_unit_id:

        query = query.filter(
            WasteRecord.mess_unit_id
            == mess_unit_id
        )


    if meal_category:

        query = query.filter(
            WasteRecord.meal_category
            == meal_category
        )


    rows = (
        query.all()
    )


    # --------------------------------------------------------
    # TOTAL MEALS SERVED
    # --------------------------------------------------------

    total_meals_served = sum(

        record.students_served
        or 0

        for record
        in rows
    )


    # --------------------------------------------------------
    # TOTAL FOOD WASTE
    # --------------------------------------------------------

    total_waste = sum(

        float(
            record.waste_kg
            or 0
        )

        for record
        in rows
    )


    # --------------------------------------------------------
    # AVERAGE DAILY STUDENTS
    # --------------------------------------------------------

    number_of_days = max(
        (
            end_date
            - start_date
        ).days
        + 1,

        1
    )


    average_daily = round(
        total_meals_served
        / number_of_days,
        1
    )


    # --------------------------------------------------------
    # SATISFACTION
    #
    # There is currently no feedback/rating model in the
    # existing project, so do not invent satisfaction data.
    # --------------------------------------------------------

    satisfaction_rate = 0


    return jsonify({

        "filters": {

            "hostelId":
                hostel_id,

            "messUnitId":
                mess_unit_id,

            "mealCategory":
                meal_category,

            "startDate":
                start_date.isoformat(),

            "endDate":
                end_date.isoformat()
        },


        "summary": {

            "totalMealsServed":
                total_meals_served,

            "averageDailyStudents":
                average_daily,

            "totalFoodWaste":
                round(
                    total_waste,
                    2
                ),

            "satisfactionRate":
                satisfaction_rate
        }

    }), 200


# ============================================================
# REPORT CHART DATA
# ============================================================

@manager_bp.route(
    "/reports/charts",
    methods=["GET"]
)
@manager_required
def report_charts():

    manager = get_current_user()


    filters = (
        get_report_filters()
    )


    valid, message = (
        validate_report_filters(
            manager,
            filters
        )
    )


    if not valid:
        return jsonify({
            "message":
                message
        }), 400


    hostel_id = (
        filters[
            "hostel_id"
        ]
    )

    mess_unit_id = (
        filters[
            "mess_unit_id"
        ]
    )

    meal_category = (
        filters[
            "meal_category"
        ]
    )

    start_date = (
        filters[
            "start_date"
        ]
    )

    end_date = (
        filters[
            "end_date"
        ]
    )


    # --------------------------------------------------------
    # IMPORTANT FIX
    #
    # Previously this endpoint did NOT apply start_date /
    # end_date.
    #
    # Now every chart uses exactly the selected reporting
    # period.
    # --------------------------------------------------------

    query = (
        WasteRecord.query

        .join(
            Hostel,
            WasteRecord.hostel_id
            == Hostel.id
        )

        .filter(
            Hostel.manager_user_id
            == manager.id,

            WasteRecord.record_date
            >= start_date,

            WasteRecord.record_date
            <= end_date
        )
    )


    if hostel_id:

        query = query.filter(
            WasteRecord.hostel_id
            == hostel_id
        )


    if mess_unit_id:

        query = query.filter(
            WasteRecord.mess_unit_id
            == mess_unit_id
        )


    if meal_category:

        query = query.filter(
            WasteRecord.meal_category
            == meal_category
        )


    rows = (
        query

        .order_by(
            WasteRecord.record_date.asc()
        )

        .all()
    )


    # --------------------------------------------------------
    # MEAL-WISE CONSUMPTION
    # --------------------------------------------------------

    meals = {
        "breakfast": 0,
        "lunch": 0,
        "snacks": 0,
        "dinner": 0
    }


    # --------------------------------------------------------
    # CATEGORY COMPARISON
    # --------------------------------------------------------

    categories = {
        "veg": 0,
        "non-veg": 0
    }


    # --------------------------------------------------------
    # WASTE TREND
    # --------------------------------------------------------

    waste_trend = {}


    for record in rows:

        meal_name = (
            str(
                record.meal
                or ""
            )
            .strip()
            .lower()
        )


        category_name = (
            normalize_category(
                record.meal_category
            )
        )


        students_served = (
            int(
                record.students_served
                or 0
            )
        )


        # ----------------------------------------------------
        # MEAL
        # ----------------------------------------------------

        if (
            meal_name
            in meals
        ):
            meals[
                meal_name
            ] += (
                students_served
            )


        # ----------------------------------------------------
        # CATEGORY
        # ----------------------------------------------------

        if (
            category_name
            in categories
        ):
            categories[
                category_name
            ] += (
                students_served
            )


        # ----------------------------------------------------
        # WASTE BY DATE
        # ----------------------------------------------------

        if (
            record.record_date
        ):

            date_key = (
                record.record_date
                .isoformat()
            )


            waste_trend[
                date_key
            ] = (
                waste_trend.get(
                    date_key,
                    0.0
                )
                +
                float(
                    record.waste_kg
                    or 0
                )
            )


    return jsonify({

        "filters": {

            "hostelId":
                hostel_id,

            "messUnitId":
                mess_unit_id,

            "mealCategory":
                meal_category,

            "startDate":
                start_date.isoformat(),

            "endDate":
                end_date.isoformat()
        },


        "mealWiseConsumption": [

            {
                "meal":
                    meal,

                "value":
                    value
            }

            for meal, value
            in meals.items()
        ],


        "categoryComparison": [

            {
                "category":
                    category,

                "value":
                    value
            }

            for category, value
            in categories.items()
        ],


        "wasteTrend": [

            {
                "date":
                    date_key,

                "waste":
                    round(
                        waste_value,
                        2
                    )
            }

            for (
                date_key,
                waste_value
            )
            in sorted(
                waste_trend.items()
            )
        ]

    }), 200


# ============================================================
# REPORT STUDENT RESPONSE BREAKDOWN
# ============================================================

@manager_bp.route(
    "/reports/responses",
    methods=["GET"]
)
@manager_required
def report_response_breakdown():
    """
    Reporting-period version of the Dashboard
    response-summary API.

    The dashboard endpoint remains Today-only.

    This endpoint calculates response opportunities across
    every matching Menu in the selected reporting period.
    """

    manager = get_current_user()


    filters = (
        get_report_filters()
    )


    valid, message = (
        validate_report_filters(
            manager,
            filters
        )
    )


    if not valid:
        return jsonify({
            "message":
                message
        }), 400


    hostel_id = (
        filters[
            "hostel_id"
        ]
    )

    mess_unit_id = (
        filters[
            "mess_unit_id"
        ]
    )

    meal_category = (
        filters[
            "meal_category"
        ]
    )

    start_date = (
        filters[
            "start_date"
        ]
    )

    end_date = (
        filters[
            "end_date"
        ]
    )


    # --------------------------------------------------------
    # MENUS INSIDE SELECTED REPORTING PERIOD
    # --------------------------------------------------------

    menu_query = (
        Menu.query

        .join(
            Hostel,
            Menu.hostel_id
            == Hostel.id
        )

        .filter(
            Hostel.manager_user_id
            == manager.id,

            Menu.menu_date
            >= start_date,

            Menu.menu_date
            <= end_date
        )
    )


    if hostel_id:

        menu_query = (
            menu_query.filter(
                Menu.hostel_id
                == hostel_id
            )
        )


    if mess_unit_id:

        menu_query = (
            menu_query.filter(
                Menu.mess_unit_id
                == mess_unit_id
            )
        )


    if meal_category:

        menu_query = (
            menu_query.filter(
                Menu.meal_category
                == meal_category
            )
        )


    menus = (
        menu_query

        .order_by(
            Menu.menu_date.asc(),
            Menu.meal.asc()
        )

        .all()
    )


    attending = 0

    skipping = 0

    unanswered = 0

    expected_responses = 0


    # --------------------------------------------------------
    # CALCULATE RESPONSE OPPORTUNITIES MENU BY MENU
    #
    # A Student is eligible only when:
    #
    # - role = student
    # - account is active
    # - same Hostel
    # - same Mess Unit
    # - same Meal Category
    # --------------------------------------------------------

    for menu in menus:

        student_query = (
            User.query

            .filter_by(
                role="student",
                is_active=True
            )

            .filter(
                User.hostel_id
                == menu.hostel_id,

                User.mess_unit_id
                == menu.mess_unit_id
            )
        )


        if (
            menu.meal_category
        ):

            student_query = (
                student_query.filter(
                    User.meal_category
                    == menu.meal_category
                )
            )


        eligible_students = (
            student_query.count()
        )


        expected_responses += (
            eligible_students
        )


        # ----------------------------------------------------
        # ATTENDING
        # ----------------------------------------------------

        menu_attending = (
            MealResponse.query

            .filter(
                MealResponse.menu_id
                == menu.id,

                MealResponse.response
                == "attending"
            )

            .count()
        )


        # ----------------------------------------------------
        # SKIPPING
        # ----------------------------------------------------

        menu_skipping = (
            MealResponse.query

            .filter(
                MealResponse.menu_id
                == menu.id,

                MealResponse.response
                == "skipping"
            )

            .count()
        )


        attending += (
            menu_attending
        )


        skipping += (
            menu_skipping
        )


        menu_unanswered = max(
            eligible_students
            - menu_attending
            - menu_skipping,

            0
        )


        unanswered += (
            menu_unanswered
        )


    # --------------------------------------------------------
    # SAFE DENOMINATOR
    # --------------------------------------------------------

    denominator = max(
        expected_responses,
        1
    )


    return jsonify({

        "filters": {

            "hostelId":
                hostel_id,

            "messUnitId":
                mess_unit_id,

            "mealCategory":
                meal_category,

            "startDate":
                start_date.isoformat(),

            "endDate":
                end_date.isoformat()
        },


        "menuCount":
            len(
                menus
            ),


        "total":
            expected_responses,


        "attending": {

            "count":
                attending,

            "percentage":
                round(
                    attending
                    / denominator
                    * 100,
                    1
                )
        },


        "skipping": {

            "count":
                skipping,

            "percentage":
                round(
                    skipping
                    / denominator
                    * 100,
                    1
                )
        },


        "unanswered": {

            "count":
                unanswered,

            "percentage":
                round(
                    unanswered
                    / denominator
                    * 100,
                    1
                )
        }

    }), 200
# ============================================================
# NOTIFICATIONS
# ============================================================

@manager_bp.route(
    "/notifications",
    methods=["GET"]
)
@manager_required
def get_notifications():

    manager = get_current_user()


    notifications = (
        Notification.query
        .filter_by(
            manager_user_id=manager.id
        )
        .order_by(
            Notification.created_at.desc()
        )
        .limit(30)
        .all()
    )


    unread_count = (
        Notification.query
        .filter_by(
            manager_user_id=manager.id,
            is_read=False
        )
        .count()
    )


    return jsonify({

        "unreadCount":
            unread_count,

        "notifications": [

            {
                "id":
                    item.id,

                "type":
                    item.notification_type,

                "title":
                    item.title,

                "message":
                    item.message,

                "isRead":
                    item.is_read,

                "createdAt":
                    (
                        item.created_at.isoformat()
                        if item.created_at
                        else None
                    )
            }

            for item
            in notifications
        ]

    }), 200


# ============================================================
# MARK ONE NOTIFICATION AS READ
# ============================================================

@manager_bp.route(
    "/notifications/<int:notification_id>/read",
    methods=["POST"]
)
@manager_required
def mark_notification_read(
    notification_id
):

    manager = get_current_user()


    notification = (
        Notification.query
        .filter_by(
            id=notification_id,
            manager_user_id=manager.id
        )
        .first()
    )


    if not notification:

        return jsonify({
            "message":
                "Notification not found."
        }), 404


    if notification.is_read:

        return jsonify({

            "message":
                "Notification is already marked as read.",

            "notification": {

                "id":
                    notification.id,

                "type":
                    notification.notification_type,

                "title":
                    notification.title,

                "message":
                    notification.message,

                "isRead":
                    True,

                "createdAt":
                    (
                        notification.created_at.isoformat()
                        if notification.created_at
                        else None
                    )
            }

        }), 200


    notification.is_read = True


    try:

        db.session.commit()


    except Exception as error:

        db.session.rollback()


        print(
            "Notification read update error:",
            error
        )


        return jsonify({
            "message":
                "Unable to update notification."
        }), 500


    return jsonify({

        "message":
            "Notification marked as read.",

        "notification": {

            "id":
                notification.id,

            "type":
                notification.notification_type,

            "title":
                notification.title,

            "message":
                notification.message,

            "isRead":
                notification.is_read,

            "createdAt":
                (
                    notification.created_at.isoformat()
                    if notification.created_at
                    else None
                )
        }

    }), 200


# ============================================================
# MARK ALL NOTIFICATIONS AS READ
# ============================================================

@manager_bp.route(
    "/notifications/mark-all-read",
    methods=["POST"]
)
@manager_required
def mark_notifications_read():

    manager = get_current_user()


    try:

        updated_count = (
            Notification.query
            .filter_by(
                manager_user_id=manager.id,
                is_read=False
            )
            .update(
                {
                    "is_read": True
                },
                synchronize_session=False
            )
        )


        db.session.commit()


    except Exception as error:

        db.session.rollback()


        print(
            "Mark all notifications error:",
            error
        )


        return jsonify({
            "message":
                "Unable to mark notifications as read."
        }), 500


    return jsonify({

        "message":
            "All notifications marked as read.",

        "updatedCount":
            updated_count

    }), 200
# ============================================================
# BASIC DASHBOARD ACCESS
# ============================================================

@manager_bp.route(
    "/dashboard",
    methods=["GET"]
)
@manager_required
def manager_dashboard():

    manager = get_current_user()


    return jsonify({

        "message":
            "Manager dashboard access granted.",

        "manager": {

            "id":
                manager.id,

            "managerId":
                manager.manager_id,

            "name":
                manager.name,

            "email":
                manager.email

        }

    }), 200

    
# ============================================================
# STUDENT FEEDBACK — MANAGER PORTAL
# ============================================================

@manager_bp.route("/feedback", methods=["GET"])
@manager_required
def list_manager_feedback():
    manager = get_current_user()

    # Only include feedback from hostels owned by this manager.
    owned_hostel_ids = manager_hostel_ids(manager.id)

    try:
        query = StudentFeedback.query.options(
            joinedload(StudentFeedback.student)
        ).filter(
            StudentFeedback.hostel_id.in_(owned_hostel_ids)
        )

        status = (request.args.get("status") or "").strip().lower()
        if status in {"pending", "reviewed"}:
            query = query.filter(StudentFeedback.status == status)

        rows = query.order_by(
            StudentFeedback.created_at.desc()
        ).limit(200).all()
    except SQLAlchemyError as error:
        db.session.rollback()
        current_app.logger.exception(
            "Failed to list Manager feedback at endpoint=%s: %s",
            request.endpoint,
            error,
        )
        return jsonify({
            "message": "Unable to load feedback."
        }), 500

    feedback_items = []

    for item in rows:
        student = item.student

        feedback_items.append({
            "id": item.id,
            "studentName": student.name if student else "Student",
            "studentId": student.student_id if student else None,
            "mealDate": item.meal_date.isoformat() if item.meal_date else None,
            "meal": item.meal,
            "category": item.category,
            "overallRating": item.overall_rating,
            "tasteRating": item.taste_rating,
            "hygieneRating": item.hygiene_rating,
            "quantityRating": item.quantity_rating,
            "comments": item.comments or "",
            "photoUrl": item.photo_path,
            "status": item.status,
            "staffReply": item.staff_reply,
            "createdAt": item.created_at.isoformat() if item.created_at else None,
            "repliedAt": item.replied_at.isoformat() if item.replied_at else None,
        })

    return jsonify({
        "feedback": feedback_items,
        "total": len(feedback_items),
    }), 200


@manager_bp.route("/feedback/<int:feedback_id>/reply", methods=["PATCH"])
@manager_required
def reply_to_student_feedback(feedback_id):
    manager = get_current_user()

    owned_hostel_ids = manager_hostel_ids(manager.id)

    feedback = StudentFeedback.query.filter(
        StudentFeedback.id == feedback_id,
        StudentFeedback.hostel_id.in_(owned_hostel_ids),
    ).first()

    if not feedback:
        return jsonify({
            "message": "Feedback not found."
        }), 404

    data = request.get_json(silent=True) or {}
    reply = str(data.get("reply") or "").strip()

    if not reply:
        return jsonify({
            "message": "Reply cannot be empty."
        }), 400

    if len(reply) > 2000:
        return jsonify({
            "message": "Reply cannot exceed 2000 characters."
        }), 400

    feedback.staff_reply = reply
    feedback.replied_by = manager.id
    feedback.replied_at = datetime.utcnow()
    feedback.status = "reviewed"

    try:
        db.session.commit()
    except SQLAlchemyError as error:
        db.session.rollback()
        current_app.logger.exception(
            "Failed to save Student feedback reply at endpoint=%s: %s",
            request.endpoint,
            error,
        )
        return jsonify({
            "message": "Unable to save the reply."
        }), 500

    return jsonify({
        "message": "Reply saved successfully.",
        "feedback": {
            "id": feedback.id,
            "status": feedback.status,
            "staffReply": feedback.staff_reply,
            "repliedAt": feedback.replied_at.isoformat() if feedback.replied_at else None,
        },
    }), 200

# ============================================================
# MANAGER ANNOUNCEMENTS
# ============================================================

def serialize_manager_announcement(item):
    published_at = (
        item.published_at.isoformat()
        if item.published_at else None
    )
    created_at = (
        item.created_at.isoformat()
        if item.created_at else None
    )
    updated_at = (
        item.updated_at.isoformat()
        if item.updated_at else None
    )

    return {
        "id": item.id,
        "title": item.title,
        "message": item.message,
        "priority": item.priority,
        "status": item.status,
        "is_general": item.is_general,
        "hostel_id": item.hostel_id,
        "mess_unit_id": item.mess_unit_id,
        "meal_category": item.meal_category,
        "recipient_user_id": item.recipient_user_id,
        "attachment_url": item.attachment_url,
        "expires_at": item.expires_at.isoformat() if item.expires_at else None,
        "sender_name": item.sender_name,
        "published_at": published_at,
        "created_at": created_at,
        "updated_at": updated_at,
        "isGeneral": item.is_general,
        "hostelId": item.hostel_id,
        "hostelName": item.hostel.name if item.hostel else None,
        "messUnitId": item.mess_unit_id,
        "messUnitName": item.mess_unit.name if item.mess_unit else None,
        "mealCategory": item.meal_category,
        "recipientUserId": item.recipient_user_id,
        "attachmentUrl": item.attachment_url,
        "expiresAt": item.expires_at.isoformat() if item.expires_at else None,
        "publishedAt": published_at,
        "createdAt": created_at,
        "updatedAt": updated_at,
    }


def notify_staff_for_announcement(manager, announcement):
    staff_query = manager_owned_user_query(manager.id, "staff").filter(
        User.is_active.is_(True)
    )

    staff_members = staff_query.all()
    for staff_member in staff_members:
        eligible = False

        if announcement.is_general:
            eligible = True
        elif announcement.recipient_user_id == staff_member.id:
            eligible = True
        elif (
            announcement.recipient_user_id is None
            and announcement.hostel_id == staff_member.hostel_id
        ):
            if (
                announcement.mess_unit_id is None
                or announcement.mess_unit_id == staff_member.mess_unit_id
            ):
                eligible = True

            if announcement.meal_category:
                announcement_category = normalize_staff_category(
                    announcement.meal_category
                )
                staff_category = str(
                    staff_member.meal_category or ""
                ).strip().lower()
                if (
                    staff_category != "both"
                    and staff_category != announcement_category
                ):
                    eligible = False

        if not eligible:
            continue

        create_staff_assignment_notification(
            manager.id,
            staff_member,
            "New announcement published",
            announcement.title,
        )


def validate_announcement_payload(manager, data):
    title = str(data.get("title") or "").strip()
    message = str(data.get("message") or "").strip()
    priority = str(data.get("priority") or "normal").strip().lower()
    status = str(data.get("status") or "draft").strip().lower()

    if not title or len(title) > 200:
        return None, "Title is required and must be at most 200 characters."

    if not message or len(message) > 10000:
        return None, "Message is required and must be at most 10000 characters."

    if priority not in {"normal", "important", "urgent"}:
        return None, "Invalid priority."

    if status not in {"draft", "published", "unpublished"}:
        return None, "Invalid announcement status."

    def optional_int(key):
        value = data.get(key)
        if value in (None, ""):
            return None
        try:
            number = int(value)
            return number if number > 0 else None
        except (TypeError, ValueError):
            return None

    hostel_id = optional_int("hostel_id")
    mess_unit_id = optional_int("mess_unit_id")
    recipient_user_id = optional_int("recipient_user_id")
    meal_category = str(data.get("meal_category") or "").strip()
    attachment_url = str(data.get("attachment_url") or "").strip() or None
    expires_at = parse_iso_datetime(data.get("expires_at") or data.get("expiresAt"))

    if attachment_url and len(attachment_url) > 500:
        return None, "Attachment URL must be at most 500 characters."
    if (data.get("expires_at") or data.get("expiresAt")) and expires_at is None:
        return None, "Expiry date must be a valid date and time."

    is_general = data.get("is_general") is True

    # General announcements are visible only within this manager's tenant.
    if is_general:
        hostel_id = None
        mess_unit_id = None
        recipient_user_id = None
        meal_category = None

    else:
        # An individual recipient must be a student owned by this manager.
        if recipient_user_id:
            recipient = get_owned_user(
                manager.id,
                recipient_user_id,
                "student",
            )
            if not recipient:
                recipient = get_owned_user(
                    manager.id,
                    recipient_user_id,
                    "staff",
                )
            if not recipient:
                return None, "Student or Staff member not found in your assigned hostels."

            hostel_id = recipient.hostel_id
            mess_unit_id = None
            meal_category = None

        elif mess_unit_id:
            mess = manager_owns_mess(manager.id, mess_unit_id)
            if not mess:
                return None, "Mess unit not found in your assigned hostels."

            if hostel_id and mess.hostel_id != hostel_id:
                return None, "The selected mess unit does not belong to that hostel."

            hostel_id = mess.hostel_id
            meal_category = None

        elif hostel_id:
            if not get_owned_hostel(manager.id, hostel_id):
                return None, "Hostel not found in your account."

        elif meal_category:
            return None, "Select a hostel when targeting a meal category."

        else:
            return None, "Select a valid announcement audience."

        if meal_category and meal_category.lower() not in {
            "veg", "non-veg"
        }:
            return None, "Meal category must be Veg or Non-Veg."

        if meal_category:
            meal_category = (
                "Veg" if meal_category.lower() == "veg"
                else "Non-Veg"
            )

    return {
        "title": title,
        "message": message,
        "priority": priority,
        "status": status,
        "is_general": is_general,
        "hostel_id": hostel_id,
        "mess_unit_id": mess_unit_id,
        "meal_category": meal_category or None,
        "recipient_user_id": recipient_user_id,
        "attachment_url": attachment_url,
        "expires_at": expires_at,
    }, None


@manager_bp.route("/announcements", methods=["GET"])
@manager_required
def list_manager_announcements():
    manager = get_current_user()

    query = Announcement.query.filter_by(
        manager_user_id=manager.id
    )

    status = (request.args.get("status") or "").strip().lower()

    if status == "unpublished":
        query = query.filter(
            Announcement.status == "unpublished"
        )
    elif status in {"draft", "published"}:
        query = query.filter(
            Announcement.status == status
        )
    elif status and status != "all":
        return jsonify({"message": "Invalid status filter."}), 400

    rows = query.order_by(
        Announcement.created_at.desc()
    ).limit(200).all()

    return jsonify({
        "announcements": [
            serialize_manager_announcement(item)
            for item in rows
        ],
        "total": len(rows),
    }), 200


@manager_bp.route("/announcements", methods=["POST"])
@manager_required
def create_manager_announcement():
    manager = get_current_user()
    data = request.get_json(silent=True) or {}

    payload, error = validate_announcement_payload(manager, data)

    if error:
        return jsonify({"message": error}), 400

    now = datetime.utcnow()

    item = Announcement(
        manager_user_id=manager.id,
        sender_name=manager.name,
        published_at=now if payload["status"] == "published" else None,
        **payload,
    )

    try:
        db.session.add(item)
        db.session.commit()
    except Exception as error:
        db.session.rollback()
        current_app.logger.exception(
            "Failed to create manager announcement at endpoint=%s (%s: %s)",
            request.endpoint,
            type(error).__name__,
            error,
        )
        return jsonify({
            "message": "Unable to save the announcement."
        }), 500

    return jsonify({
        "message": (
            "Announcement published successfully."
            if item.status == "published"
            else "Announcement draft saved successfully."
        ),
        "announcement": serialize_manager_announcement(item),
    }), 201


@manager_bp.route("/announcements/<int:announcement_id>", methods=["PATCH"])
@manager_required
def update_manager_announcement(announcement_id):
    manager = get_current_user()

    item = Announcement.query.filter_by(
        id=announcement_id,
        manager_user_id=manager.id,
    ).first()

    if not item:
        return jsonify({"message": "Announcement not found."}), 404

    data = request.get_json(silent=True) or {}

    # Merge partial updates with the existing announcement.
    merged = {
        "title": item.title,
        "message": item.message,
        "priority": item.priority,
        "status": item.status,
        "is_general": item.is_general,
        "hostel_id": item.hostel_id,
        "mess_unit_id": item.mess_unit_id,
        "meal_category": item.meal_category,
        "recipient_user_id": item.recipient_user_id,
        "attachment_url": item.attachment_url,
    }
    merged.update(data)

    payload, error = validate_announcement_payload(manager, merged)

    if error:
        return jsonify({"message": error}), 400

    was_published = item.status == "published"

    try:
        for key, value in payload.items():
            setattr(item, key, value)

        if item.status == "published" and not was_published:
            item.published_at = datetime.utcnow()
        elif item.status != "published":
            item.published_at = None

        item.sender_name = manager.name
        db.session.commit()
        if item.status == "published":
            notify_staff_for_announcement(manager, item)
            db.session.commit()

    except Exception as error:
        db.session.rollback()
        current_app.logger.exception(
            "Failed to update manager announcement at endpoint=%s (%s: %s)",
            request.endpoint,
            type(error).__name__,
            error,
        )
        return jsonify({
            "message": "Unable to update the announcement."
        }), 500

    return jsonify({
        "message": "Announcement updated successfully.",
        "announcement": serialize_manager_announcement(item),
    }), 200


@manager_bp.route("/announcements/<int:announcement_id>", methods=["DELETE"])
@manager_required
def delete_manager_announcement(announcement_id):
    manager = get_current_user()
    item = Announcement.query.filter_by(
        id=announcement_id,
        manager_user_id=manager.id,
    ).first()
    if not item:
        return jsonify({"message": "Announcement not found."}), 404
    db.session.delete(item)
    db.session.commit()
    return jsonify({"message": "Announcement deleted successfully."}), 200
# ============================================================
# SMART FORECAST INSIGHTS API
# Add this at the bottom of manager_routes.py
# ============================================================

@manager_bp.route(
    "/forecasts/insights",
    methods=["GET"]
)
@manager_required
def get_forecast_insights():

    manager = get_current_user()

    forecast_date = parse_date(
        request.args.get("date")
    ) or date.today()

    hostel_id = get_integer_query("hostel_id")
    mess_unit_id = get_integer_query("mess_unit_id")

    meal_category = normalize_category(
        request.args.get("meal_category")
    )

    valid, message = validate_global_filters(
        manager.id,
        hostel_id,
        None,
        mess_unit_id
    )

    if not valid:
        return jsonify({
            "message": message
        }), 400

    # --------------------------------------------------------
    # MANAGER-OWNED HOSTELS
    # --------------------------------------------------------

    hostel_query = Hostel.query.filter(
        Hostel.manager_user_id == manager.id
    )

    if hostel_id:
        hostel_query = hostel_query.filter(
            Hostel.id == hostel_id
        )

    owned_hostels = hostel_query.all()

    owned_hostel_ids = [
        hostel.id for hostel in owned_hostels
    ]

    if not owned_hostel_ids:
        return jsonify({
            "date": forecast_date.isoformat(),
            "forecasts": [],
            "summary": {
                "expectedStudents": 0,
                "confirmedYes": 0,
                "confirmedNo": 0,
                "noResponse": 0,
                "recommendedPreparation": 0
            },
            "message": "No hostel data found."
        }), 200

    # --------------------------------------------------------
    # TARGET MENUS
    # --------------------------------------------------------

    menu_query = (
        Menu.query
        .filter(
            Menu.hostel_id.in_(owned_hostel_ids),
            Menu.menu_date == forecast_date
        )
    )

    if mess_unit_id:
        menu_query = menu_query.filter(
            Menu.mess_unit_id == mess_unit_id
        )

    if meal_category:
        menu_query = menu_query.filter(
            Menu.meal_category == meal_category
        )

    menus = (
        menu_query
        .order_by(
            Menu.meal.asc(),
            Menu.meal_category.asc()
        )
        .all()
    )

    # --------------------------------------------------------
    # FORECAST EACH MENU SEPARATELY
    # --------------------------------------------------------

    forecast_rows = []

    for menu in menus:

        # Population assigned to this hostel/mess unit
        student_query = User.query.filter(
            User.role == "student",
            User.is_active == True,
            User.hostel_id == menu.hostel_id,
            User.mess_unit_id == menu.mess_unit_id
        )

        population = student_query.count()

        # ----------------------------------------------------
        # RESPONSES
        # ----------------------------------------------------

        responses = MealResponse.query.filter(
            MealResponse.menu_id == menu.id
        ).all()

        yes_count = sum(
            1 for response in responses
            if response.response == "attending"
        )

        no_count = sum(
            1 for response in responses
            if response.response == "skipping"
        )

        response_count = yes_count + no_count

        no_response_count = max(
            population - response_count,
            0
        )

        response_coverage = (
            response_count / population
            if population > 0
            else 0
        )

        # ----------------------------------------------------
        # HISTORICAL ACTUAL ATTENDANCE
        # Same meal + category + mess unit
        # Same weekday, previous 8 weeks
        # ----------------------------------------------------

        history_start = (
            forecast_date - timedelta(days=56)
        )

        history_query = (
            WasteRecord.query
            .join(
                Hostel,
                WasteRecord.hostel_id == Hostel.id
            )
            .filter(
                Hostel.manager_user_id == manager.id,
                WasteRecord.hostel_id == menu.hostel_id,
                WasteRecord.mess_unit_id == menu.mess_unit_id,
                WasteRecord.meal == menu.meal,
                WasteRecord.meal_category == menu.meal_category,
                WasteRecord.record_date >= history_start,
                WasteRecord.record_date < forecast_date
            )
        )

        historical_records = history_query.all()

        # Keep only records matching target weekday
        same_weekday_records = [
            record
            for record in historical_records
            if record.record_date.weekday()
            == forecast_date.weekday()
        ]

        if not same_weekday_records:
            same_weekday_records = historical_records

        historical_attendance_values = [
            int(record.students_served or 0)
            for record in same_weekday_records
        ]

        historical_average = (
            sum(historical_attendance_values)
            / len(historical_attendance_values)
            if historical_attendance_values
            else 0
        )

        historical_attendance_rate = (
            historical_average / population
            if population > 0
            else 0
        )

        historical_attendance_rate = max(
            0,
            min(
                historical_attendance_rate,
                1
            )
        )

        # ----------------------------------------------------
        # ESTIMATE NON-RESPONDERS
        # ----------------------------------------------------

        estimated_non_responder_attendance = round(
            no_response_count
            * historical_attendance_rate
        )

        expected_students = (
            yes_count
            + estimated_non_responder_attendance
        )

        expected_students = max(
            0,
            min(
                expected_students,
                population
            )
        )

        # ----------------------------------------------------
        # CONFIDENCE
        # ----------------------------------------------------

        history_count = len(
            same_weekday_records
        )

        if (
            history_count >= 6
            and response_coverage >= 0.60
        ):
            confidence = "High"

        elif (
            history_count >= 3
            or response_coverage >= 0.40
        ):
            confidence = "Medium"

        else:
            confidence = "Low"

        confidence_reasons = []

        if history_count < 3:
            confidence_reasons.append(
                "Limited historical attendance data"
            )

        if response_coverage < 0.40:
            confidence_reasons.append(
                "Low student response coverage"
            )

        if history_count >= 6:
            confidence_reasons.append(
                "Sufficient historical records"
            )

        if response_coverage >= 0.60:
            confidence_reasons.append(
                "Good response coverage"
            )

        # ----------------------------------------------------
        # FOOD ITEM QUANTITY CALCULATION
        # Uses configured quantity per student.
        # No invented portion sizes.
        # ----------------------------------------------------

        food_items = []

        for link in menu.item_links:

            item = link.menu_item

            quantity_per_student = float(
                link.quantity_per_student or 0
            )

            recommended_quantity = round(
                expected_students
                * quantity_per_student,
                2
            )

            food_items.append({
                "menuItemId": item.id,
                "name": item.name,
                "quantityPerStudent": quantity_per_student,
                "unit": link.unit,
                "expectedPortions": expected_students,
                "recommendedQuantity": recommended_quantity
            })

        # ----------------------------------------------------
        # HISTORICAL WASTE ANALYSIS
        # ----------------------------------------------------

        historical_waste = sum(
            float(record.waste_kg or 0)
            for record in same_weekday_records
        )

        average_waste = (
            historical_waste / history_count
            if history_count > 0
            else 0
        )

        waste_recommendation = None

        if average_waste >= 5:
            waste_recommendation = (
                "Historical food waste is relatively high. "
                "Review preparation quantities after serving."
            )

        elif average_waste > 0:
            waste_recommendation = (
                "Use historical waste records when adjusting "
                "preparation quantities."
            )

        # ----------------------------------------------------
        # EXISTING FORECAST RECORD
        # ----------------------------------------------------

        existing_forecast = Forecast.query.filter(
            Forecast.hostel_id == menu.hostel_id,
            Forecast.mess_unit_id == menu.mess_unit_id,
            Forecast.forecast_date == forecast_date,
            Forecast.meal == menu.meal,
            Forecast.meal_category == menu.meal_category
        ).first()

        actual_students = (
            existing_forecast.actual_students
            if existing_forecast
            else None
        )

        forecast_rows.append({

            "menuId": menu.id,

            "forecastId": (
                existing_forecast.id
                if existing_forecast
                else None
            ),

            "date": forecast_date.isoformat(),

            "meal": menu.meal,

            "mealCategory": menu.meal_category,

            "hostelId": menu.hostel_id,

            "hostel": menu.hostel.name,

            "messUnitId": menu.mess_unit_id,

            "messUnit": menu.mess_unit.name,

            "population": population,

            "confirmedYes": yes_count,

            "confirmedNo": no_count,

            "responded": response_count,

            "noResponse": no_response_count,

            "responseCoverage": round(
                response_coverage * 100,
                1
            ),

            "historicalRecords": history_count,

            "historicalAverageAttendance": round(
                historical_average,
                1
            ),

            "historicalAttendanceRate": round(
                historical_attendance_rate * 100,
                1
            ),

            "estimatedNonResponderAttendance":
                estimated_non_responder_attendance,

            "expectedStudents": expected_students,

            "actualStudents": actual_students,

            "confidence": confidence,

            "confidenceReasons": confidence_reasons,

            "foodItems": food_items,

            "historicalAverageWasteKg": round(
                average_waste,
                2
            ),

            "recommendation": waste_recommendation,

            "preparationStatus": (
                existing_forecast.preparation_status
                if existing_forecast
                else "not_saved"
            )
        })

    # --------------------------------------------------------
    # SUMMARY
    # --------------------------------------------------------

    summary = {
        "expectedStudents": sum(
            row["expectedStudents"]
            for row in forecast_rows
        ),

        "confirmedYes": sum(
            row["confirmedYes"]
            for row in forecast_rows
        ),

        "confirmedNo": sum(
            row["confirmedNo"]
            for row in forecast_rows
        ),

        "noResponse": sum(
            row["noResponse"]
            for row in forecast_rows
        ),

        "menuCount": len(forecast_rows),

        "highConfidence": sum(
            1 for row in forecast_rows
            if row["confidence"] == "High"
        ),

        "mediumConfidence": sum(
            1 for row in forecast_rows
            if row["confidence"] == "Medium"
        ),

        "lowConfidence": sum(
            1 for row in forecast_rows
            if row["confidence"] == "Low"
        )
    }

    return jsonify({
        "date": forecast_date.isoformat(),
        "summary": summary,
        "forecasts": forecast_rows
    }), 200