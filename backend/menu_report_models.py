"""Attendance totals retained after menu-history cleanup.

Import this module in the migration, cleanup service and reporting routes.
Importing it only registers a model; it never creates or changes tables.
"""

from datetime import datetime, timezone

from models import db


def utc_now():
    """Return naive UTC for the project's MySQL DATETIME columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class MenuAttendanceSummary(db.Model):
    """One retained attendance summary per manager-owned meal slot.

    The cleanup service must save this summary in the same transaction
    that deletes the menu. The menu foreign key becomes NULL on deletion.

    No student names, student IDs, menu items or individual responses
    are stored here. This table is not subject to 40-day menu retention.

    Expected responses are captured when the summary is created; they
    are not evidence of the student roster on the original meal date.

    Later report reads must use these saved totals without recalculating
    them from the current student roster.
    """

    __tablename__ = "menu_attendance_summaries"

    id = db.Column(
        db.Integer,
        primary_key=True,
    )

    manager_user_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    hostel_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "hostels.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    mess_unit_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "mess_units.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    menu_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "menus.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    menu_date = db.Column(
        db.Date,
        nullable=False,
    )

    meal = db.Column(
        db.Enum(
            "breakfast",
            "lunch",
            "snacks",
            "dinner",
        ),
        nullable=False,
    )

    meal_category = db.Column(
        db.Enum(
            "veg",
            "non-veg",
        ),
        nullable=False,
    )

    expected_responses = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    attending_count = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    skipping_count = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    unanswered_count = db.Column(
        db.Integer,
        nullable=False,
        default=0,
    )

    captured_at = db.Column(
        db.DateTime,
        nullable=False,
        default=utc_now,
    )

    __table_args__ = (
        db.UniqueConstraint(
            "manager_user_id",
            "hostel_id",
            "mess_unit_id",
            "menu_date",
            "meal",
            "meal_category",
            name="uq_attendance_summary_scope",
        ),
        db.UniqueConstraint(
            "menu_id",
            name="uq_attendance_summary_menu",
        ),
        db.Index(
            "ix_attendance_summary_manager_date",
            "manager_user_id",
            "menu_date",
        ),
        db.Index(
            "ix_attendance_summary_mess_date",
            "mess_unit_id",
            "menu_date",
        ),
        db.CheckConstraint(
            "expected_responses >= 0 AND attending_count >= 0 "
            "AND skipping_count >= 0 AND unanswered_count >= 0",
            name="ck_attendance_summary_nonnegative",
        ),
        db.CheckConstraint(
            "expected_responses = attending_count "
            "+ skipping_count + unanswered_count",
            name="ck_attendance_summary_total",
        ),
    )