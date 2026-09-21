# pyright: reportMissingImports=false
import re
import secrets
import smtplib

from datetime import datetime, timedelta
from email.message import EmailMessage

from flask import (
    Blueprint,
    current_app,
    jsonify,
    request
)

from werkzeug.security import (
    check_password_hash,
    generate_password_hash
)

from models import (
    db,
    User,
    EmailOTP
)


setup_bp = Blueprint(
    "setup",
    __name__,
    url_prefix="/api/setup"
)


EMAIL_PATTERN = (
    r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
)

MAX_OTP_ATTEMPTS = 5
OTP_EXPIRY_MINUTES = 5
OTP_RESEND_SECONDS = 60
VERIFICATION_VALID_MINUTES = 10


def manager_exists():

    return (
        User.query
        .filter_by(role="manager")
        .first()
        is not None
    )


def send_email_otp(
    recipient_email,
    otp
):

    smtp_host = current_app.config.get(
        "SMTP_HOST"
    )

    smtp_port = current_app.config.get(
        "SMTP_PORT"
    )

    smtp_user = current_app.config.get(
        "SMTP_USER"
    )

    smtp_password = current_app.config.get(
        "SMTP_PASSWORD"
    )

    from_email = current_app.config.get(
        "SMTP_FROM_EMAIL"
    )

    use_tls = current_app.config.get(
        "SMTP_USE_TLS",
        True
    )


    if not all([
        smtp_host,
        smtp_port,
        smtp_user,
        smtp_password,
        from_email
    ]):

        raise RuntimeError(
            "Email service is not configured."
        )


    message = EmailMessage()

    message["Subject"] = (
        "Hostel Mess Portal - Email Verification OTP"
    )

    message["From"] = from_email

    message["To"] = recipient_email

    message.set_content(
        "Your Hostel Mess Management Portal "
        f"verification OTP is {otp}.\n\n"
        "This OTP will expire in 5 minutes.\n"
        "Do not share this OTP with anyone."
    )


    with smtplib.SMTP(
        smtp_host,
        smtp_port,
        timeout=20
    ) as server:

        server.ehlo()

        if use_tls:
            server.starttls()
            server.ehlo()

        server.login(
            smtp_user,
            smtp_password
        )

        server.send_message(
            message
        )


# ==========================================
# SETUP STATUS
# ==========================================

@setup_bp.route(
    "/status",
    methods=["GET"]
)
def setup_status():

    exists = manager_exists()

    return jsonify({
        "managerExists":
            exists,

        "registrationAllowed":
            not exists
    }), 200


# ==========================================
# SEND OTP
# ==========================================

@setup_bp.route(
    "/send-otp",
    methods=["POST"]
)
def send_otp():

    # First check from backend.
    if manager_exists():

        return jsonify({
            "message":
            "Manager registration is closed. "
            "Please contact the existing manager."
        }), 403


    data = request.get_json() or {}

    email = data.get(
        "email",
        ""
    ).strip().lower()


    if not email:

        return jsonify({
            "message":
            "Please enter your official email address."
        }), 400


    if not re.match(
        EMAIL_PATTERN,
        email
    ):

        return jsonify({
            "message":
            "Please enter a valid official email address."
        }), 400


    # Existing account check.
    existing_user = (
        User.query
        .filter_by(email=email)
        .first()
    )

    if existing_user:

        return jsonify({
            "message":
            "This email is already registered."
        }), 409


    now = datetime.utcnow()

    otp_record = (
        EmailOTP.query
        .filter_by(email=email)
        .first()
    )


    # Resend timer.
    if (
        otp_record
        and otp_record.resend_available_at
        and now < otp_record.resend_available_at
    ):

        seconds_remaining = int(
            (
                otp_record.resend_available_at
                - now
            ).total_seconds()
        )

        return jsonify({
            "message":
            "Please wait before requesting another OTP.",

            "retryAfter":
            max(
                seconds_remaining,
                1
            )
        }), 429


    # Secure random 6 digit OTP.
    otp = (
        f"{secrets.randbelow(1000000):06d}"
    )


    try:

        send_email_otp(
            email,
            otp
        )

    except Exception as error:

        current_app.logger.exception(
            "OTP email sending failed"
        )

        return jsonify({
            "message":
            "Unable to send OTP. "
            "Please check the email configuration."
        }), 500


    otp_hash = generate_password_hash(
        otp
    )


    if otp_record is None:

        otp_record = EmailOTP(
            email=email,

            otp_hash=otp_hash,

            expires_at=(
                now
                + timedelta(
                    minutes=
                    OTP_EXPIRY_MINUTES
                )
            ),

            resend_available_at=(
                now
                + timedelta(
                    seconds=
                    OTP_RESEND_SECONDS
                )
            ),

            attempts=0,

            is_verified=False,

            verification_token_hash=None,

            verified_until=None
        )

        db.session.add(
            otp_record
        )

    else:

        otp_record.otp_hash = (
            otp_hash
        )

        otp_record.expires_at = (
            now
            + timedelta(
                minutes=
                OTP_EXPIRY_MINUTES
            )
        )

        otp_record.resend_available_at = (
            now
            + timedelta(
                seconds=
                OTP_RESEND_SECONDS
            )
        )

        otp_record.attempts = 0

        otp_record.is_verified = False

        otp_record.verification_token_hash = (
            None
        )

        otp_record.verified_until = None


    db.session.commit()


    return jsonify({
        "message":
        "OTP sent successfully. "
        "Please check your email.",

        "resendAfter":
        OTP_RESEND_SECONDS
    }), 200


# ==========================================
# VERIFY OTP
# ==========================================

@setup_bp.route(
    "/verify-otp",
    methods=["POST"]
)
def verify_otp():

    if manager_exists():

        return jsonify({
            "message":
            "Manager registration is closed. "
            "Please contact the existing manager."
        }), 403


    data = request.get_json() or {}

    email = data.get(
        "email",
        ""
    ).strip().lower()

    otp = data.get(
        "otp",
        ""
    ).strip()


    if not email or not otp:

        return jsonify({
            "message":
            "Email and OTP are required."
        }), 400


    if (
        not otp.isdigit()
        or len(otp) != 6
    ):

        return jsonify({
            "message":
            "Invalid OTP. Please try again."
        }), 400


    otp_record = (
        EmailOTP.query
        .filter_by(email=email)
        .first()
    )


    if otp_record is None:

        return jsonify({
            "message":
            "OTP expired. "
            "Please request a new OTP."
        }), 400


    now = datetime.utcnow()


    if now > otp_record.expires_at:

        return jsonify({
            "message":
            "OTP expired. "
            "Please request a new OTP."
        }), 400


    if (
        otp_record.attempts
        >= MAX_OTP_ATTEMPTS
    ):

        return jsonify({
            "message":
            "Too many incorrect OTP attempts. "
            "Please request a new OTP."
        }), 429


    if not check_password_hash(
        otp_record.otp_hash,
        otp
    ):

        otp_record.attempts += 1

        db.session.commit()

        return jsonify({
            "message":
            "Invalid OTP. Please try again.",

            "attemptsRemaining":
            max(
                MAX_OTP_ATTEMPTS
                - otp_record.attempts,
                0
            )
        }), 400


    # OTP is correct.
    verification_token = (
        secrets.token_urlsafe(32)
    )

    otp_record.is_verified = True

    otp_record.verification_token_hash = (
        generate_password_hash(
            verification_token
        )
    )

    otp_record.verified_until = (
        now
        + timedelta(
            minutes=
            VERIFICATION_VALID_MINUTES
        )
    )

    # The OTP cannot be reused.
    otp_record.otp_hash = (
        generate_password_hash(
            secrets.token_urlsafe(32)
        )
    )

    db.session.commit()


    return jsonify({
        "message":
            "Email verified successfully.",

        "verificationToken":
            verification_token
    }), 200