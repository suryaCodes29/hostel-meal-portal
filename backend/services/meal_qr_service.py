
# backend/services/meal_qr_service.py

import base64
import hashlib
import hmac

from datetime import datetime, timedelta, timezone

from flask import current_app
from models import db, MealQRToken
from sqlalchemy.exc import IntegrityError


# ============================================================
# TOKEN HASHING
# ============================================================

def hash_qr_token(raw_token):
    """
    Convert raw QR token into SHA-256 hash.
    """
    return hashlib.sha256(
        raw_token.encode("utf-8")
    ).hexdigest()


def _normalize_utc(value):
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value.replace(microsecond=0)


def _derive_qr_token(meal_response, expires_at):
    secret = (
        current_app.config.get("QR_TOKEN_SECRET_KEY")
        or current_app.config.get("JWT_SECRET_KEY")
    )
    if not secret:
        raise RuntimeError("A QR token signing key is not configured.")

    message = (
        f"hostel-meal-qr:v1:{meal_response.id}:"
        f"{meal_response.student_user_id}:{meal_response.menu_id}:"
        f"{expires_at.isoformat()}"
    ).encode("utf-8")
    signature = hmac.new(
        str(secret).encode("utf-8"),
        message,
        hashlib.sha256,
    ).digest()
    return base64.urlsafe_b64encode(signature).rstrip(b"=").decode("ascii")


def _qr_result(raw_token, expires_at, now, reused=False):
    remaining_seconds = max(0, int((expires_at - now).total_seconds()))
    return {
        "token": raw_token,
        "expires_at": f"{expires_at.isoformat()}Z",
        "expires_in_minutes": (remaining_seconds + 59) // 60,
        "reused": reused,
    }


# ============================================================
# GENERATE QR TOKEN
# ============================================================

def generate_meal_qr_token(
    meal_response,
    expires_minutes=5,
    expires_at=None
):
    """
    Generate a secure QR token.

    Raw token:
        Returned to frontend for QR generation.

    Database:
        Only token hash is stored.

    expires_at:
        Optional explicit expiry datetime.
        When supplied, the QR expires at the meal end time.
    """

    now = datetime.utcnow().replace(microsecond=0)
    final_expiry = _normalize_utc(
        expires_at or now + timedelta(minutes=expires_minutes)
    )

    # Check existing token for this meal response.
    existing_token = MealQRToken.query.filter_by(
        meal_response_id=meal_response.id
    ).first()

    if existing_token:
        # Do not regenerate an already redeemed token.
        if existing_token.redeemed_at is not None:
            raise ValueError(
                "This meal has already been verified."
            )
        existing_expiry = _normalize_utc(existing_token.expires_at)
        if existing_expiry > now:
            raw_token = _derive_qr_token(meal_response, existing_expiry)
            if hmac.compare_digest(
                hash_qr_token(raw_token),
                existing_token.token_hash,
            ):
                return _qr_result(raw_token, existing_expiry, now, reused=True)
            raise ValueError(
                "A meal QR is already active, but its original value cannot be "
                "recovered. Continue using the QR already displayed; it expires "
                "at the end of this meal."
            )

        # An expired record may only be replaced after its expiry window.
        raw_token = _derive_qr_token(meal_response, final_expiry)
        existing_token.token_hash = hash_qr_token(raw_token)
        existing_token.expires_at = final_expiry

    else:
        raw_token = _derive_qr_token(meal_response, final_expiry)
        token_hash = hash_qr_token(raw_token)
        new_token = MealQRToken(
            token_hash=token_hash,
            meal_response_id=meal_response.id,
            student_user_id=meal_response.student_user_id,
            menu_id=meal_response.menu_id,
            mess_unit_id=meal_response.mess_unit_id,
            expires_at=final_expiry
        )

        db.session.add(new_token)

    if final_expiry <= now:
        db.session.rollback()
        raise ValueError("This meal QR has expired.")

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raced_token = MealQRToken.query.filter_by(
            meal_response_id=meal_response.id
        ).first()
        if raced_token and raced_token.redeemed_at is None:
            raced_expiry = _normalize_utc(raced_token.expires_at)
            raced_raw_token = _derive_qr_token(meal_response, raced_expiry)
            if (
                raced_expiry > datetime.utcnow()
                and hmac.compare_digest(
                    hash_qr_token(raced_raw_token),
                    raced_token.token_hash,
                )
            ):
                return _qr_result(
                    raced_raw_token,
                    raced_expiry,
                    datetime.utcnow().replace(microsecond=0),
                    reused=True,
                )
        raise

    return _qr_result(raw_token, final_expiry, now)


# ============================================================
# FIND QR TOKEN
# ============================================================

def get_qr_token_record(raw_token):
    """
    Find QR token using its hash.
    """
    token_hash = hash_qr_token(raw_token)

    return MealQRToken.query.filter_by(
        token_hash=token_hash
    ).first()


# ============================================================
# CHECK TOKEN VALIDITY
# ============================================================

def is_qr_token_valid(token_record):
    """
    Check whether QR token is valid.
    """

    if token_record is None:
        return False

    if token_record.redeemed_at is not None:
        return False

    if token_record.expires_at <= datetime.utcnow():
        return False

    return True
