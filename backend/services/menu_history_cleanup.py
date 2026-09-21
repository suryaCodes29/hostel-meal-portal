"""
Menu History Cleanup Service
============================

Safely removes Menu records older than 40 complete UTC days.

Exact retention rule:

    cutoff_date = utc_today - timedelta(days=40)
    eligible = menu.menu_date < cutoff_date

Therefore:

- 39 days old  -> KEEP
- exactly 40 days old -> KEEP
- 41+ days old -> DELETE

Important behaviour:

- Dry-run never changes the database.
- Actual cleanup runs in small batches.
- Each batch is committed independently.
- A failed batch is rolled back.
- Completed batches are not repeated on the next run.
- The service is idempotent.
- Menu templates are never deleted.
- Food-item master records are never deleted.
- Students are never deleted.
- Staff are never deleted.
- Hostels are never deleted.
- Mess Units are never deleted.
- Manager accounts are never deleted.
- Forecast and Waste records are preserved.
- Only Menu records and their direct menu-specific
  dependent rows are removed.

This module is intentionally reusable by:

1. Automatic scheduler
2. Manual CLI cleanup command
3. Backend tests
"""

from __future__ import annotations

import logging
import uuid

from datetime import date
from datetime import datetime
from datetime import timedelta
from datetime import timezone
from typing import Any
from typing import Callable
from typing import Dict
from typing import Optional
from typing import Union


from models import (
    CleanupAudit,
    MealResponse,
    Menu,
    MenuMenuItem,
    MenuNotification,
    db,
)


# ============================================================
# CONFIGURATION
# ============================================================

DEFAULT_RETENTION_DAYS = 40

DEFAULT_BATCH_SIZE = 100

MAX_BATCH_SIZE = 1000


logger = logging.getLogger(
    __name__
)


class MenuHistoryCleanupError(RuntimeError):
    """Raised when a menu-history cleanup run cannot complete safely."""




# ============================================================
# DATE / TIME HELPERS
# ============================================================

UtcNowValue = Union[
    datetime,
    date,
]

UtcNowProvider = Union[
    UtcNowValue,
    Callable[
        [],
        UtcNowValue,
    ],
]


def get_utc_now(
    now_utc: Optional[
        UtcNowProvider
    ] = None,
) -> datetime:
    """
    Return a naive UTC datetime suitable for the project's
    MySQL DATETIME columns.

    `now_utc` is injectable so retention tests can freeze time.

    Accepted values:

    - None
    - datetime
    - date
    - callable returning datetime
    - callable returning date
    """

    value = (
        now_utc()
        if callable(now_utc)
        else now_utc
    )

    if value is None:
        value = datetime.now(
            timezone.utc
        )

    if isinstance(
        value,
        date,
    ) and not isinstance(
        value,
        datetime,
    ):
        value = datetime.combine(
            value,
            datetime.min.time(),
        )

    if not isinstance(
        value,
        datetime,
    ):
        raise TypeError(
            "now_utc must be a datetime, "
            "date, callable returning one, "
            "or None."
        )

    if value.tzinfo is not None:
        value = (
            value
            .astimezone(
                timezone.utc
            )
            .replace(
                tzinfo=None
            )
        )

    return value


def get_cleanup_cutoff_date(
    now_utc: Optional[
        UtcNowProvider
    ] = None,
    retention_days: int = (
        DEFAULT_RETENTION_DAYS
    ),
) -> date:
    """
    Calculate the strict cleanup cutoff date.

    Eligibility is:

        Menu.menu_date < cutoff_date

    NOT:

        Menu.menu_date <= cutoff_date
    """

    if (
        not isinstance(
            retention_days,
            int,
        )
        or retention_days < 1
    ):
        raise ValueError(
            "retention_days must be "
            "a positive integer."
        )

    utc_today = (
        get_utc_now(
            now_utc
        ).date()
    )

    return (
        utc_today
        - timedelta(
            days=retention_days
        )
    )


# ============================================================
# BATCH SIZE
# ============================================================

def normalize_batch_size(
    batch_size: int,
) -> int:
    """
    Validate cleanup batch size.
    """

    try:
        value = int(
            batch_size
        )
    except (
        TypeError,
        ValueError,
    ) as error:
        raise ValueError(
            "batch_size must be "
            "a positive integer."
        ) from error

    if value < 1:
        raise ValueError(
            "batch_size must be "
            "greater than zero."
        )

    return min(
        value,
        MAX_BATCH_SIZE,
    )


# ============================================================
# ELIGIBLE MENU QUERY
# ============================================================

def eligible_menu_query(
    cutoff_date: date,
):
    """
    Base query used by dry-run and real cleanup.

    Do not add a status restriction here.

    The agreed retention rule is based strictly on menu_date.

    A future Draft/Scheduled Menu cannot satisfy this condition,
    therefore current and future records remain protected.
    """

    return Menu.query.filter(
        Menu.menu_date
        < cutoff_date
    )


def count_eligible_menus(
    cutoff_date: date,
) -> int:
    """
    Count Menu records eligible for automatic cleanup.
    """

    return int(
        eligible_menu_query(
            cutoff_date
        ).count()
        or 0
    )


# ============================================================
# DEPENDENT ROW COUNTS
# ============================================================

def count_menu_item_links(
    cutoff_date: date,
) -> int:
    """
    Count MenuMenuItem association rows that belong to
    automatically eligible menus.

    MenuItem master records themselves are NOT deleted.
    """

    return int(
        db.session.query(
            MenuMenuItem.id
        )
        .join(
            Menu,
            MenuMenuItem.menu_id
            == Menu.id,
        )
        .filter(
            Menu.menu_date
            < cutoff_date
        )
        .count()
        or 0
    )


def count_meal_responses(
    cutoff_date: date,
) -> int:
    """
    Count MealResponse rows attached to eligible menus.
    """

    return int(
        db.session.query(
            MealResponse.id
        )
        .join(
            Menu,
            MealResponse.menu_id
            == Menu.id,
        )
        .filter(
            Menu.menu_date
            < cutoff_date
        )
        .count()
        or 0
    )


def count_menu_notifications(
    cutoff_date: date,
) -> int:
    """
    Count audience MenuNotification rows attached to
    eligible menus.
    """

    return int(
        db.session.query(
            MenuNotification.id
        )
        .join(
            Menu,
            MenuNotification.menu_id
            == Menu.id,
        )
        .filter(
            Menu.menu_date
            < cutoff_date
        )
        .count()
        or 0
    )


def count_all_dependent_rows(
    cutoff_date: date,
) -> Dict[str, int]:
    """
    Return detailed dependent-row counts.

    Forecast and Waste records are intentionally absent because
    the current project schema does not link them to Menu by
    menu_id.
    """

    item_links = (
        count_menu_item_links(
            cutoff_date
        )
    )

    meal_responses = (
        count_meal_responses(
            cutoff_date
        )
    )

    menu_notifications = (
        count_menu_notifications(
            cutoff_date
        )
    )

    total = (
        item_links
        + meal_responses
        + menu_notifications
    )

    return {
        "menuItemLinks":
            item_links,

        "mealResponses":
            meal_responses,

        "menuNotifications":
            menu_notifications,

        "total":
            total,
    }


# ============================================================
# DRY RUN
# ============================================================

def preview_menu_history_cleanup(
    *,
    now_utc: Optional[
        UtcNowProvider
    ] = None,
    retention_days: int = (
        DEFAULT_RETENTION_DAYS
    ),
) -> Dict[str, Any]:
    """
    Calculate what automatic cleanup WOULD remove.

    IMPORTANT:
    This function performs no INSERT, UPDATE or DELETE.

    In particular, it does NOT insert CleanupAudit because
    dry-run must leave the database unchanged.
    """

    cutoff_date = (
        get_cleanup_cutoff_date(
            now_utc=
                now_utc,
            retention_days=
                retention_days,
        )
    )

    eligible_count = (
        count_eligible_menus(
            cutoff_date
        )
    )

    dependent_counts = (
        count_all_dependent_rows(
            cutoff_date
        )
    )

    result = {
        "jobId":
            None,

        "dryRun":
            True,

        "status":
            "dry-run",

        "retentionDays":
            retention_days,

        "cutoffDate":
            cutoff_date.isoformat(),

        "eligibleMenus":
            eligible_count,

        "menusDeleted":
            0,

        "dependentRowsEligible":
            dependent_counts[
                "total"
            ],

        "dependentRowsDeleted":
            0,

        "dependencies":
            dependent_counts,
    }

    logger.info(
        (
            "Menu history cleanup dry-run: "
            "cutoff=%s eligible_menus=%s "
            "dependent_rows=%s"
        ),
        cutoff_date.isoformat(),
        eligible_count,
        dependent_counts[
            "total"
        ],
    )

    return result


# ============================================================
# AUDIT HELPERS
# ============================================================

def create_cleanup_audit(
    *,
    job_id: str,
    executed_at: datetime,
    cutoff_date: date,
) -> int:
    """
    Create an audit row before actual deletion starts.

    This audit transaction is committed separately so a later
    failed cleanup batch can still be recorded as failed.
    """

    audit = CleanupAudit(
        job_id=
            job_id,

        executed_at=
            executed_at,

        completed_at=
            None,

        cutoff_date=
            cutoff_date,

        menus_deleted=
            0,

        dependent_rows_deleted=
            0,

        status=
            "running",

        dry_run=
            False,

        error_message=
            None,
    )

    db.session.add(
        audit
    )

    db.session.commit()

    return int(
        audit.id
    )


def update_cleanup_audit(
    *,
    audit_id: int,
    status: str,
    menus_deleted: int,
    dependent_rows_deleted: int,
    completed_at: datetime,
    error_message: Optional[
        str
    ] = None,
) -> None:
    """
    Update a cleanup audit record.

    Errors are intentionally re-raised to the caller so the
    caller can decide whether to log an audit persistence issue.
    """

    audit = db.session.get(
        CleanupAudit,
        audit_id,
    )

    if audit is None:
        raise RuntimeError(
            "Cleanup audit record "
            "could not be found."
        )

    audit.status = status

    audit.menus_deleted = int(
        menus_deleted
        or 0
    )

    audit.dependent_rows_deleted = int(
        dependent_rows_deleted
        or 0
    )

    audit.completed_at = (
        completed_at
    )

    audit.error_message = (
        error_message
    )

    db.session.commit()


def safely_mark_audit_failed(
    *,
    audit_id: Optional[int],
    menus_deleted: int,
    dependent_rows_deleted: int,
    error_message: str,
    completed_at: datetime,
) -> None:
    """
    Best-effort audit failure update.

    Cleanup failure must never be hidden just because the audit
    update itself also fails.
    """

    if audit_id is None:
        return

    try:
        db.session.rollback()

        update_cleanup_audit(
            audit_id=
                audit_id,

            status=
                "failed",

            menus_deleted=
                menus_deleted,

            dependent_rows_deleted=
                dependent_rows_deleted,

            completed_at=
                completed_at,

            error_message=
                error_message,
        )

    except Exception:
        db.session.rollback()

        logger.exception(
            (
                "Menu history cleanup failed "
                "and CleanupAudit could not "
                "be updated. audit_id=%s"
            ),
            audit_id,
        )


# ============================================================
# BATCH HELPERS
# ============================================================

def get_next_cleanup_batch(
    *,
    cutoff_date: date,
    batch_size: int,
):
    """
    Load the next oldest eligible Menu batch.

    Returning full Menu objects rather than only IDs makes the
    batch deterministic and keeps test inspection straightforward.
    """

    return (
        eligible_menu_query(
            cutoff_date
        )
        .order_by(
            Menu.menu_date.asc(),
            Menu.id.asc(),
        )
        .limit(
            batch_size
        )
        .all()
    )


def count_batch_dependencies(
    menu_ids,
) -> Dict[str, int]:
    """
    Count direct dependencies for one cleanup batch.
    """

    if not menu_ids:
        return {
            "menuItemLinks":
                0,

            "mealResponses":
                0,

            "menuNotifications":
                0,

            "total":
                0,
        }

    item_links = int(
        MenuMenuItem.query
        .filter(
            MenuMenuItem.menu_id.in_(
                menu_ids
            )
        )
        .count()
        or 0
    )

    meal_responses = int(
        MealResponse.query
        .filter(
            MealResponse.menu_id.in_(
                menu_ids
            )
        )
        .count()
        or 0
    )

    menu_notifications = int(
        MenuNotification.query
        .filter(
            MenuNotification.menu_id.in_(
                menu_ids
            )
        )
        .count()
        or 0
    )

    total = (
        item_links
        + meal_responses
        + menu_notifications
    )

    return {
        "menuItemLinks":
            item_links,

        "mealResponses":
            meal_responses,

        "menuNotifications":
            menu_notifications,

        "total":
            total,
    }


def delete_cleanup_batch(
    menus,
) -> Dict[str, int]:
    """
    Delete one Menu-history batch.

    This method does NOT commit.

    The calling function controls the transaction boundary.

    Direct dependencies are deleted explicitly before Menu so
    the behaviour remains safe even if database cascade settings
    differ between development databases.

    Food-item master records are intentionally not deleted.
    """

    menu_ids = [
        int(
            menu.id
        )
        for menu in menus
    ]

    if not menu_ids:
        return {
            "menus":
                0,

            "menuItemLinks":
                0,

            "mealResponses":
                0,

            "menuNotifications":
                0,

            "dependentRows":
                0,
        }

    deleted_item_links = (
        MenuMenuItem.query
        .filter(
            MenuMenuItem.menu_id.in_(
                menu_ids
            )
        )
        .delete(
            synchronize_session=False
        )
    )

    deleted_meal_responses = (
        MealResponse.query
        .filter(
            MealResponse.menu_id.in_(
                menu_ids
            )
        )
        .delete(
            synchronize_session=False
        )
    )

    deleted_menu_notifications = (
        MenuNotification.query
        .filter(
            MenuNotification.menu_id.in_(
                menu_ids
            )
        )
        .delete(
            synchronize_session=False
        )
    )

    deleted_menus = (
        Menu.query
        .filter(
            Menu.id.in_(
                menu_ids
            )
        )
        .delete(
            synchronize_session=False
        )
    )

    item_link_count = int(
        deleted_item_links
        or 0
    )

    meal_response_count = int(
        deleted_meal_responses
        or 0
    )

    notification_count = int(
        deleted_menu_notifications
        or 0
    )

    dependent_total = (
        item_link_count
        + meal_response_count
        + notification_count
    )

    return {
        "menus":
            int(
                deleted_menus
                or 0
            ),

        "menuItemLinks":
            item_link_count,

        "mealResponses":
            meal_response_count,

        "menuNotifications":
            notification_count,

        "dependentRows":
            dependent_total,
    }


# ============================================================
# MAIN CLEANUP SERVICE
# ============================================================

def run_menu_history_cleanup(
    *,
    dry_run: bool = False,
    now_utc: Optional[
        UtcNowProvider
    ] = None,
    retention_days: int = (
        DEFAULT_RETENTION_DAYS
    ),
    batch_size: int = (
        DEFAULT_BATCH_SIZE
    ),
    max_batches: Optional[int] = None,
    before_delete_batch: Optional[Callable[[list, int], None]] = None,
) -> Dict[str, Any]:
    """
    Shared Menu-history cleanup entry point.

    This is the function that both:

    - the daily scheduler
    - the manual CLI command

    must call.

    Do not duplicate deletion logic elsewhere.
    """

    batch_size = (
        normalize_batch_size(
            batch_size
        )
    )

    if max_batches is not None:
        try:
            max_batches = int(max_batches)
        except (TypeError, ValueError) as error:
            raise ValueError("max_batches must be a positive integer or None.") from error
        if max_batches < 1:
            raise ValueError("max_batches must be at least 1.")

    started_at = (
        get_utc_now(
            now_utc
        )
    )

    cutoff_date = (
        get_cleanup_cutoff_date(
            now_utc=
                started_at,
            retention_days=
                retention_days,
        )
    )

    # --------------------------------------------------------
    # DRY RUN
    # --------------------------------------------------------

    if dry_run:
        return (
            preview_menu_history_cleanup(
                now_utc=
                    started_at,

                retention_days=
                    retention_days,
            )
        )

    # --------------------------------------------------------
    # ACTUAL RUN
    # --------------------------------------------------------

    job_id = str(
        uuid.uuid4()
    )

    audit_id: Optional[
        int
    ] = None

    menus_deleted = 0

    dependent_rows_deleted = 0

    batches_completed = 0

    deleted_breakdown = {
        "menuItemLinks":
            0,

        "mealResponses":
            0,

        "menuNotifications":
            0,
    }

    logger.info(
        (
            "Menu history cleanup started: "
            "job_id=%s cutoff=%s "
            "batch_size=%s"
        ),
        job_id,
        cutoff_date.isoformat(),
        batch_size,
    )

    try:
        # ----------------------------------------------------
        # AUDIT START
        # ----------------------------------------------------

        audit_id = (
            create_cleanup_audit(
                job_id=
                    job_id,

                executed_at=
                    started_at,

                cutoff_date=
                    cutoff_date,
            )
        )

        # ----------------------------------------------------
        # SAFE BATCH LOOP
        # ----------------------------------------------------

        while True:
            if max_batches is not None and batches_completed >= max_batches:
                logger.info(
                    "Menu history cleanup reached max_batches: job_id=%s max_batches=%s",
                    job_id,
                    max_batches,
                )
                break

            menus = (
                get_next_cleanup_batch(
                    cutoff_date=
                        cutoff_date,

                    batch_size=
                        batch_size,
                )
            )

            if not menus:
                break

            menu_ids = [
                int(
                    menu.id
                )
                for menu in menus
            ]

            logger.info(
                (
                    "Menu history cleanup batch "
                    "started: job_id=%s "
                    "batch=%s menus=%s"
                ),
                job_id,
                batches_completed
                + 1,
                len(
                    menu_ids
                ),
            )

            try:
                if before_delete_batch is not None:
                    before_delete_batch(
                        menu_ids,
                        batches_completed + 1,
                    )

                batch_result = (
                    delete_cleanup_batch(
                        menus
                    )
                )

                # Commit ONLY this batch.
                db.session.commit()

            except Exception:
                # Roll back the complete current batch.
                db.session.rollback()

                logger.exception(
                    (
                        "Menu history cleanup batch "
                        "failed: job_id=%s "
                        "batch=%s"
                    ),
                    job_id,
                    batches_completed
                    + 1,
                )

                raise

            menus_deleted += (
                batch_result[
                    "menus"
                ]
            )

            dependent_rows_deleted += (
                batch_result[
                    "dependentRows"
                ]
            )

            deleted_breakdown[
                "menuItemLinks"
            ] += (
                batch_result[
                    "menuItemLinks"
                ]
            )

            deleted_breakdown[
                "mealResponses"
            ] += (
                batch_result[
                    "mealResponses"
                ]
            )

            deleted_breakdown[
                "menuNotifications"
            ] += (
                batch_result[
                    "menuNotifications"
                ]
            )

            batches_completed += 1

            logger.info(
                (
                    "Menu history cleanup batch "
                    "completed: job_id=%s "
                    "batch=%s menus_deleted=%s "
                    "dependent_rows_deleted=%s"
                ),
                job_id,
                batches_completed,
                batch_result[
                    "menus"
                ],
                batch_result[
                    "dependentRows"
                ],
            )

        # ----------------------------------------------------
        # SUCCESS AUDIT
        # ----------------------------------------------------

        completed_at = (
            get_utc_now()
        )

        update_cleanup_audit(
            audit_id=
                audit_id,

            status=
                "success",

            menus_deleted=
                menus_deleted,

            dependent_rows_deleted=
                dependent_rows_deleted,

            completed_at=
                completed_at,

            error_message=
                None,
        )

        result = {
            "jobId":
                job_id,

            "auditId":
                audit_id,

            "dryRun":
                False,

            "status":
                "success",

            "retentionDays":
                retention_days,

            "cutoffDate":
                cutoff_date.isoformat(),

            "menusDeleted":
                menus_deleted,

            "dependentRowsDeleted":
                dependent_rows_deleted,

            "batchesCompleted":
                batches_completed,

            "batchSize":
                batch_size,

            "dependenciesDeleted": {
                "menuItemLinks":
                    deleted_breakdown[
                        "menuItemLinks"
                    ],

                "mealResponses":
                    deleted_breakdown[
                        "mealResponses"
                    ],

                "menuNotifications":
                    deleted_breakdown[
                        "menuNotifications"
                    ],
            },

            "startedAt":
                started_at.isoformat(),

            "completedAt":
                completed_at.isoformat(),
        }

        logger.info(
            (
                "Menu history cleanup completed: "
                "job_id=%s cutoff=%s "
                "menus_deleted=%s "
                "dependent_rows_deleted=%s "
                "batches=%s"
            ),
            job_id,
            cutoff_date.isoformat(),
            menus_deleted,
            dependent_rows_deleted,
            batches_completed,
        )

        return result

    except Exception as error:
        # ----------------------------------------------------
        # FAILURE
        # ----------------------------------------------------

        db.session.rollback()

        completed_at = (
            get_utc_now()
        )

        # Store only the exception class in the audit record.
        # Callback/database messages can contain sensitive or oversized
        # implementation details, so they are deliberately not persisted.
        safe_error_message = (
            error.__class__.__name__
        )

        safely_mark_audit_failed(
            audit_id=
                audit_id,

            menus_deleted=
                menus_deleted,

            dependent_rows_deleted=
                dependent_rows_deleted,

            error_message=
                safe_error_message,

            completed_at=
                completed_at,
        )

        logger.exception(
            (
                "Menu history cleanup failed: "
                "job_id=%s cutoff=%s "
                "menus_deleted_before_failure=%s "
                "dependent_rows_deleted_before_failure=%s"
            ),
            job_id,
            cutoff_date.isoformat(),
            menus_deleted,
            dependent_rows_deleted,
        )

        raise MenuHistoryCleanupError(
            f"{error.__class__.__name__}: {safe_error_message}"
        ) from error


# ============================================================
# BACKWARD-COMPATIBILITY API
# ============================================================

def calculate_cutoff_date(
    now_utc: Optional[UtcNowProvider] = None,
    retention_days: int = DEFAULT_RETENTION_DAYS,
) -> date:
    """Compatibility wrapper used by cleanup tests and maintenance scripts."""
    return get_cleanup_cutoff_date(
        now_utc=now_utc,
        retention_days=retention_days,
    )


def cleanup_old_menu_history(
    *,
    dry_run: bool = False,
    now_utc: Optional[UtcNowProvider] = None,
    retention_days: int = DEFAULT_RETENTION_DAYS,
    batch_size: int = DEFAULT_BATCH_SIZE,
    max_batches: Optional[int] = None,
    before_delete_batch: Optional[Callable[[list, int], None]] = None,
) -> Dict[str, Any]:
    """Public compatibility entry point shared by scheduler, CLI and tests."""
    try:
        return run_menu_history_cleanup(
            dry_run=dry_run,
            now_utc=now_utc,
            retention_days=retention_days,
            batch_size=batch_size,
            max_batches=max_batches,
            before_delete_batch=before_delete_batch,
        )
    except MenuHistoryCleanupError:
        raise
    except Exception as error:
        raise MenuHistoryCleanupError(
            f"{error.__class__.__name__}: {str(error)[:1000]}"
        ) from error


# ============================================================
# AUDIT LOG QUERY HELPER
# ============================================================

def get_recent_cleanup_audits(
    limit: int = 20,
):
    """
    Return recent actual cleanup audit records.

    This helper is intended for the future CLI command.

    It does not expose Menu contents or sensitive food data.
    """

    try:
        safe_limit = int(
            limit
        )
    except (
        TypeError,
        ValueError,
    ):
        safe_limit = 20

    safe_limit = max(
        1,
        min(
            safe_limit,
            100,
        ),
    )

    return (
        CleanupAudit.query
        .order_by(
            CleanupAudit.executed_at.desc(),
            CleanupAudit.id.desc(),
        )
        .limit(
            safe_limit
        )
        .all()
    )


def serialize_cleanup_audit(
    audit: CleanupAudit,
) -> Dict[str, Any]:
    """
    Convert CleanupAudit into safe CLI/API-friendly data.

    No Menu content is exposed.
    """

    return {
        "id":
            audit.id,

        "jobId":
            audit.job_id,

        "executedAt": (
            audit.executed_at.isoformat()
            if audit.executed_at
            else None
        ),

        "completedAt": (
            audit.completed_at.isoformat()
            if audit.completed_at
            else None
        ),

        "cutoffDate": (
            audit.cutoff_date.isoformat()
            if audit.cutoff_date
            else None
        ),

        "menusDeleted":
            int(
                audit.menus_deleted
                or 0
            ),

        "dependentRowsDeleted":
            int(
                audit.dependent_rows_deleted
                or 0
            ),

        "status":
            audit.status,

        "dryRun":
            bool(
                audit.dry_run
            ),

        "errorMessage":
            audit.error_message,
    }