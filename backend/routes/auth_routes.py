import re
import secrets

from flask import (
    Blueprint,
    current_app,
    jsonify,
    request,
)
from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    jwt_required,
)
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from werkzeug.security import (
    check_password_hash,
    generate_password_hash,
)

from models import Hostel, HostelBlock, User, db


# ============================================================
# BLUEPRINTS
# ============================================================

auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/api/auth"
)


setup_bp = Blueprint(
    "setup",
    __name__,
    url_prefix="/api/setup"
)


# ============================================================
# VALIDATION
# ============================================================

EMAIL_PATTERN = re.compile(
    r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
)


MOBILE_PATTERN = re.compile(
    r"^[6-9]\d{9}$"
)


PASSWORD_PATTERN = re.compile(
    r"^(?=.*[a-z])"
    r"(?=.*[A-Z])"
    r"(?=.*\d)"
    r"(?=.*[@$!%*?&#])"
    r"[A-Za-z\d@$!%*?&#]{8,}$"
)


# ============================================================
# NORMALIZATION HELPERS
# ============================================================

def normalize_email(
    value
):
    return (
        str(
            value or ""
        )
        .strip()
        .lower()
    )


def normalize_mobile(
    value
):
    return (
        str(
            value or ""
        )
        .strip()
    )


def normalize_manager_id(
    value
):
    return (
        str(
            value or ""
        )
        .strip()
        .upper()
    )


# ============================================================
# EXACT USER LOOKUPS
# ============================================================

def find_user_by_email(
    email
):
    """
    Perform an exact comparison after normalization.

    Examples treated as the same:
        NewManager@Example.com
        newmanager@example.com
         newmanager@example.com

    This is NOT a partial email search.
    """

    normalized_email = (
        normalize_email(
            email
        )
    )


    if not normalized_email:
        return None


    return (
        User.query
        .filter(
            func.lower(
                func.trim(
                    User.email
                )
            )
            == normalized_email
        )
        .first()
    )


def find_user_by_mobile(
    mobile
):
    normalized_mobile = (
        normalize_mobile(
            mobile
        )
    )


    if not normalized_mobile:
        return None


    return (
        User.query
        .filter(
            func.trim(
                User.mobile
            )
            == normalized_mobile
        )
        .first()
    )


def find_user_by_manager_id(
    manager_id
):
    normalized_id = (
        normalize_manager_id(
            manager_id
        )
    )


    if not normalized_id:
        return None


    return (
        User.query
        .filter(
            func.upper(
                func.trim(
                    User.manager_id
                )
            )
            == normalized_id
        )
        .first()
    )


# ============================================================
# MANAGER INFORMATION
# ============================================================

def manager_exists():
    """
    Informational only.

    Existing Managers must NEVER disable registration.
    """

    return (
        User.query
        .filter(
            User.role
            == "manager"
        )
        .first()
        is not None
    )


# ============================================================
# MANAGER ID GENERATION
# ============================================================

def generate_manager_id():
    """
    Generate a unique Manager ID when the frontend does not
    explicitly provide one.
    """

    for _ in range(
        25
    ):

        random_part = (
            secrets.token_hex(
                3
            )
            .upper()
        )


        manager_id = (
            f"MGR-{random_part}"
        )


        if not find_user_by_manager_id(
            manager_id
        ):
            return manager_id


    raise RuntimeError(
        "Unable to generate a unique Manager ID."
    )


# ============================================================
# DUPLICATE RESPONSE HELPERS
# ============================================================

def duplicate_email_response():
    return jsonify({
        "field":
            "email",

        "message":
            "This email is already registered."
    }), 409


def duplicate_mobile_response():
    return jsonify({
        "field":
            "mobileNumber",

        "message":
            "This mobile number is already registered."
    }), 409


def duplicate_manager_id_response():
    return jsonify({
        "field":
            "managerId",

        "message":
            "This Manager ID is already registered."
    }), 409


# ============================================================
# SETUP STATUS
# ============================================================

@setup_bp.route(
    "/status",
    methods=["GET"]
)
def setup_status():
    """
    Multiple Manager accounts are supported.

    managerExists is informational.
    registrationAllowed must not depend on it.
    """

    return jsonify({

        "managerExists":
            manager_exists(),

        "registrationAllowed":
            True

    }), 200


# ============================================================
# MANAGER REGISTRATION
# ============================================================

@auth_bp.route(
    "/manager-register",
    methods=["POST"]
)
def manager_register():

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    # --------------------------------------------------------
    # NORMALIZE INPUT
    # --------------------------------------------------------

    name = (
        str(
            data.get(
                "name",
                ""
            )
            or ""
        )
        .strip()
    )


    normalized_email = (
        normalize_email(
            data.get(
                "email",
                ""
            )
        )
    )


    mobile = (
        normalize_mobile(
            data.get(
                "mobile",
                data.get(
                    "mobileNumber",
                    ""
                )
            )
        )
    )


    submitted_manager_id = (
        normalize_manager_id(
            data.get(
                "managerId",
                ""
            )
        )
    )


    hostel_name = (
        str(
            data.get(
                "hostelName",
                ""
            )
            or ""
        )
        .strip()
    )


    hostel_block = (
        str(
            data.get(
                "hostelBlock",
                ""
            )
            or ""
        )
        .strip()
    )


    password = (
        str(
            data.get(
                "password",
                ""
            )
            or ""
        )
    )


    confirm_password = (
        str(
            data.get(
                "confirmPassword",
                ""
            )
            or ""
        )
    )


    terms_accepted = (
        data.get(
            "termsAccepted",
            False
        )
        is True
    )


    # --------------------------------------------------------
    # REQUIRED FIELDS
    # --------------------------------------------------------

    if not name:

        return jsonify({
            "field":
                "name",

            "message":
                "Manager name is required."
        }), 400


    if not normalized_email:

        return jsonify({
            "field":
                "email",

            "message":
                "Email address is required."
        }), 400


    if not mobile:

        return jsonify({
            "field":
                "mobileNumber",

            "message":
                "Mobile number is required."
        }), 400


    if not hostel_name:

        return jsonify({
            "field":
                "hostelName",

            "message":
                "Hostel name is required."
        }), 400


    if not hostel_block:

        return jsonify({
            "field":
                "hostelBlock",

            "message":
                "Hostel block is required."
        }), 400


    if not password:

        return jsonify({
            "field":
                "password",

            "message":
                "Password is required."
        }), 400


    if not confirm_password:

        return jsonify({
            "field":
                "confirmPassword",

            "message":
                "Confirm Password is required."
        }), 400


    # --------------------------------------------------------
    # TERMS
    # --------------------------------------------------------

    if not terms_accepted:

        return jsonify({
            "field":
                "termsAccepted",

            "message":
                "Please accept the Terms and Conditions."
        }), 400


    # --------------------------------------------------------
    # EMAIL FORMAT
    # --------------------------------------------------------

    if not EMAIL_PATTERN.fullmatch(
        normalized_email
    ):

        return jsonify({
            "field":
                "email",

            "message":
                "Please enter a valid official email address."
        }), 400


    # --------------------------------------------------------
    # MOBILE FORMAT
    # --------------------------------------------------------

    if not MOBILE_PATTERN.fullmatch(
        mobile
    ):

        return jsonify({
            "field":
                "mobileNumber",

            "message":
                "Please enter a valid 10-digit mobile number."
        }), 400


    # --------------------------------------------------------
    # EXACT DUPLICATE EMAIL CHECK
    # --------------------------------------------------------

    existing_email = (
        find_user_by_email(
            normalized_email
        )
    )


    if existing_email:

        return (
            duplicate_email_response()
        )


    # --------------------------------------------------------
    # DUPLICATE MOBILE CHECK
    # --------------------------------------------------------

    existing_mobile = (
        find_user_by_mobile(
            mobile
        )
    )


    if existing_mobile:

        return (
            duplicate_mobile_response()
        )


    # --------------------------------------------------------
    # MANAGER ID
    # --------------------------------------------------------

    if submitted_manager_id:

        existing_manager_id = (
            find_user_by_manager_id(
                submitted_manager_id
            )
        )


        if existing_manager_id:

            return (
                duplicate_manager_id_response()
            )


        manager_id = (
            submitted_manager_id
        )

    else:

        try:

            manager_id = (
                generate_manager_id()
            )

        except Exception:

            current_app.logger.exception(
                "Unable to generate Manager ID."
            )


            return jsonify({
                "message":
                    "Unable to create Manager account. "
                    "Please try again."
            }), 500


    # --------------------------------------------------------
    # PASSWORD VALIDATION
    # --------------------------------------------------------

    if not PASSWORD_PATTERN.fullmatch(
        password
    ):

        return jsonify({
            "field":
                "password",

            "message":
                "Password must contain at least "
                "8 characters, one uppercase letter, "
                "one lowercase letter, one number "
                "and one special character."
        }), 400


    if (
        password
        != confirm_password
    ):

        return jsonify({
            "field":
                "confirmPassword",

            "message":
                "Password and Confirm Password "
                "do not match."
        }), 400


    # --------------------------------------------------------
    # CREATE MANAGER
    # --------------------------------------------------------

    manager = User(

        name=
            name,

        manager_id=
            manager_id,

        student_id=
            None,

        staff_id=
            None,

        email=
            normalized_email,

        mobile=
            mobile,

        password_hash=
            generate_password_hash(
                password
            ),

        role=
            "manager",

        staff_role=
            None,

        hostel=
            hostel_name,

        hostel_block=
            hostel_block,

        mess_unit=
            None,

        meal_category=
            None,

        hostel_id=
            None,

        block_id=
            None,

        mess_unit_id=
            None,

        is_active=
            True,

        must_change_password=
            False

    )


    # --------------------------------------------------------
    # SAVE MANAGER
    # --------------------------------------------------------

    try:
        db.session.add(
            manager
        )

        # Create the Manager first inside the current transaction.
        # This obtains manager.id without permanently committing.
        db.session.flush()

        # Generate a database-safe Hostel code from its name.
        hostel_code = (
            re.sub(
                r"[^A-Z0-9]+",
                "-",
                hostel_name.upper()
            )
            .strip("-")[:24]
            or "HOSTEL"
        )

        # Create the normalized Hostel record owned by this Manager.
        hostel = Hostel(
            manager_user_id=
                manager.id,

            name=
                hostel_name,

            code=
                hostel_code,

            address=
                None,

            contact_number=
                mobile,

            status=
                "active"
        )

        db.session.add(
            hostel
        )

        db.session.flush()

        # Create the initial Hostel Block.
        block = HostelBlock(
            hostel_id=
                hostel.id,

            name=
                hostel_block,

            code=
                f"{hostel_code}-B1",

            status=
                "active"
        )

        db.session.add(
            block
        )

        db.session.flush()

        # Connect the Manager profile to the normalized records.
        manager.hostel_id = hostel.id
        manager.block_id = block.id

        # Manager, Hostel and Block are committed together.
        db.session.commit()


    except IntegrityError:

        db.session.rollback()


        # ----------------------------------------------------
        # IDENTIFY THE ACTUAL UNIQUE FIELD
        # ----------------------------------------------------

        try:

            if find_user_by_email(
                normalized_email
            ):

                return (
                    duplicate_email_response()
                )


            if find_user_by_mobile(
                mobile
            ):

                return (
                    duplicate_mobile_response()
                )


            if find_user_by_manager_id(
                manager_id
            ):

                return (
                    duplicate_manager_id_response()
                )


        except Exception:

            current_app.logger.exception(
                "Unable to identify registration "
                "IntegrityError field."
            )


        current_app.logger.exception(
            "Unexpected unique constraint failure "
            "during Manager registration."
        )


        return jsonify({
            "message":
                "Unable to create Manager account "
                "because of a database constraint."
        }), 500


    except Exception:

        db.session.rollback()


        current_app.logger.exception(
            "Unexpected Manager registration error."
        )


        return jsonify({
            "message":
                "Unable to create Manager account. "
                "Please try again."
        }), 500


    # --------------------------------------------------------
    # SUCCESS
    # --------------------------------------------------------

    return jsonify({

        "message":
            "Manager account created successfully. "
            "Please sign in.",

        "managerId":
            manager.manager_id

    }), 201


# ============================================================
# LOGIN
# ============================================================

@auth_bp.route(
    "/login",
    methods=["POST"]
)
def login():

    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    email = (
        normalize_email(
            data.get(
                "email",
                ""
            )
        )
    )


    password = (
        str(
            data.get(
                "password",
                ""
            )
            or ""
        )
    )


    role = (
        str(
            data.get(
                "role",
                ""
            )
            or ""
        )
        .strip()
        .lower()
    )


    # --------------------------------------------------------
    # EMAIL
    # --------------------------------------------------------

    if not email:

        return jsonify({
            "message":
                "Please enter your registered email address."
        }), 400


    if not EMAIL_PATTERN.fullmatch(
        email
    ):

        return jsonify({
            "message":
                "Please enter a valid email address."
        }), 400


    # --------------------------------------------------------
    # PASSWORD
    # --------------------------------------------------------

    if not password:

        return jsonify({
            "message":
                "Please enter your password."
        }), 400


    # --------------------------------------------------------
    # ROLE
    # --------------------------------------------------------

    if role not in [
        "manager",
        "staff",
        "student"
    ]:

        return jsonify({
            "message":
                "Please select a valid role."
        }), 400


    # --------------------------------------------------------
    # USER LOOKUP
    # --------------------------------------------------------

    user = (
        find_user_by_email(
            email
        )
    )


    if not user:

        return jsonify({
            "message":
                "This email is not registered. "
                "Please contact your hostel manager."
        }), 404


    # --------------------------------------------------------
    # ACTIVE STATUS
    # --------------------------------------------------------

    if not user.is_active:

        return jsonify({
            "message":
                "Your account is inactive. "
                "Please contact the manager."
        }), 403


    # --------------------------------------------------------
    # ROLE MATCH
    # --------------------------------------------------------

    if (
        user.role
        != role
    ):

        return jsonify({
            "message":
                "The selected role does not match "
                "this account."
        }), 403


    # --------------------------------------------------------
    # PASSWORD CHECK
    # --------------------------------------------------------

    if not check_password_hash(
        user.password_hash,
        password
    ):

        return jsonify({
            "message":
                "Incorrect password. Please try again."
        }), 401


    # --------------------------------------------------------
    # JWT
    # --------------------------------------------------------

    access_token = (
        create_access_token(

            identity=
                str(
                    user.id
                ),

            additional_claims={
                "role":
                    user.role,

                "mustChangePassword":
                    bool(
                        user.must_change_password
                    )
            }

        )
    )


    # --------------------------------------------------------
    # LOGIN RESPONSE
    # --------------------------------------------------------

    return jsonify({

        "message":
            "Login successful.",

        "access_token":
            access_token,

        "mustChangePassword":
            bool(
                user.must_change_password
            ),

        "user": {

            "id":
                user.id,

            "name":
                user.name,

            "email":
                user.email,

            "role":
                user.role,

            "managerId":
                user.manager_id,

            "studentId":
                user.student_id,

            "staffId":
                user.staff_id,

            "hostel":
                user.hostel,

            "hostelBlock":
                user.hostel_block,

            "messUnit":
                user.mess_unit,

            "mealCategory":
                user.meal_category

        }

    }), 200


# ============================================================
# CHANGE PASSWORD
# ============================================================

@auth_bp.route(
    "/change-password",
    methods=["POST"]
)
@jwt_required()
def change_password():

    user_id = (
        get_jwt_identity()
    )


    try:

        user_id = int(
            user_id
        )

    except (
        TypeError,
        ValueError
    ):

        return jsonify({
            "message":
                "Invalid user session."
        }), 401


    user = (
        db.session.get(
            User,
            user_id
        )
    )


    if not user:

        return jsonify({
            "message":
                "User account not found."
        }), 404


    data = (
        request.get_json(
            silent=True
        )
        or {}
    )


    current_password = (
        str(
            data.get(
                "currentPassword",
                ""
            )
            or ""
        )
    )


    new_password = (
        str(
            data.get(
                "newPassword",
                ""
            )
            or ""
        )
    )


    confirm_password = (
        str(
            data.get(
                "confirmPassword",
                ""
            )
            or ""
        )
    )


    # --------------------------------------------------------
    # CURRENT PASSWORD
    # --------------------------------------------------------

    if not current_password:

        return jsonify({
            "message":
                "Please enter your current password."
        }), 400


    if not check_password_hash(
        user.password_hash,
        current_password
    ):

        return jsonify({
            "message":
                "Current password is incorrect."
        }), 401


    # --------------------------------------------------------
    # NEW PASSWORD
    # --------------------------------------------------------

    if not new_password:

        return jsonify({
            "message":
                "Please enter a new password."
        }), 400


    if (
        new_password
        != confirm_password
    ):

        return jsonify({
            "message":
                "New password and confirm password "
                "do not match."
        }), 400


    if (
        new_password
        == "Mess@123"
    ):

        return jsonify({
            "message":
                "You cannot reuse the default password."
        }), 400


    if not PASSWORD_PATTERN.fullmatch(
        new_password
    ):

        return jsonify({
            "message":
                "New password must contain at least "
                "8 characters, one uppercase letter, "
                "one lowercase letter, one number "
                "and one special character."
        }), 400


    if check_password_hash(
        user.password_hash,
        new_password
    ):

        return jsonify({
            "message":
                "New password cannot be the same "
                "as your current password."
        }), 400


    # --------------------------------------------------------
    # SAVE PASSWORD
    # --------------------------------------------------------

    user.password_hash = (
        generate_password_hash(
            new_password
        )
    )


    user.must_change_password = (
        False
    )


    try:

        db.session.commit()


    except Exception:

        db.session.rollback()


        current_app.logger.exception(
            "Password update failed."
        )


        return jsonify({
            "message":
                "Unable to change password. "
                "Please try again."
        }), 500


    return jsonify({
        "message":
            "Password changed successfully."
    }), 200