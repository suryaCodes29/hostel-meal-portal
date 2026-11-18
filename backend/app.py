# pyright: reportMissingImports=false

import logging
import os
import threading
import time
from datetime import datetime, timedelta, timezone

from flask import (
    Flask,
    jsonify,
)

from flask_jwt_extended import (
    JWTManager,
)

from flask_limiter import Limiter
from flask_limiter.util import (
    get_remote_address,
)

from config import Config
from models import db

from routes.auth_routes import (
    auth_bp,
)

from routes.manager_routes import (
    manager_bp,
)

from routes.student_routes import (
    student_bp,
)

from services.menu_history_cleanup import (
    DEFAULT_RETENTION_DAYS,
    cleanup_old_menu_history,
)


# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=os.getenv(
        "LOG_LEVEL",
        "INFO",
    ).upper()
)

logger = logging.getLogger(
    __name__
)


# ============================================================
# APPLICATION
# ============================================================

app = Flask(
    __name__
)

app.config.from_object(
    Config
)


# ============================================================
# CORS
# ============================================================

@app.after_request
def add_cors_headers(
    response
):
    response.headers[
        "Access-Control-Allow-Origin"
    ] = "http://localhost:5173"

    response.headers[
        "Access-Control-Allow-Headers"
    ] = (
        "Content-Type, Authorization"
    )

    response.headers[
        "Access-Control-Allow-Methods"
    ] = (
        "GET, POST, PUT, PATCH, "
        "DELETE, OPTIONS"
    )

    return response


# ============================================================
# DATABASE
# ============================================================

db.init_app(
    app
)


# ============================================================
# JWT
# ============================================================

jwt = JWTManager(
    app
)


# ============================================================
# RATE LIMITER
# ============================================================

limiter = Limiter(

    key_func=
        get_remote_address,

    app=
        app,

    default_limits=[
        "500 per day",
        "100 per hour",
    ],

    storage_uri=
        "memory://",
)


# ============================================================
# ROUTES
# ============================================================

app.register_blueprint(
    auth_bp
)

app.register_blueprint(
    manager_bp
)

app.register_blueprint(
    student_bp
)


# ============================================================
# HOME
# ============================================================

@app.route("/")
def home():

    return jsonify({

        "message":
            "Hostel Meal Portal Backend Running",

        "status":
            "success",

    }), 200


# ============================================================
# DATABASE TEST
# ============================================================

@app.route(
    "/api/test-db"
)
def test_database():

    try:

        db.session.execute(
            db.text(
                "SELECT 1"
            )
        )

        return jsonify({

            "message":
                "Database connected successfully.",

        }), 200

    except Exception as error:

        logger.exception(
            "Database connection test failed."
        )

        return jsonify({

            "message":
                "Database connection failed.",

            "error":
                str(error),

        }), 500


# ============================================================
# MENU HISTORY CLEANUP CONFIGURATION
# ============================================================

MENU_CLEANUP_RETENTION_DAYS = int(
    os.getenv(
        "MENU_CLEANUP_RETENTION_DAYS",
        str(
            DEFAULT_RETENTION_DAYS
        ),
    )
)

MENU_CLEANUP_HOUR_UTC = int(
    os.getenv(
        "MENU_CLEANUP_HOUR_UTC",
        "2",
    )
)

MENU_CLEANUP_MINUTE_UTC = int(
    os.getenv(
        "MENU_CLEANUP_MINUTE_UTC",
        "0",
    )
)

MENU_CLEANUP_LOCK_NAME = os.getenv(
    "MENU_CLEANUP_LOCK_NAME",
    "hostel_meal_portal_menu_history_cleanup",
)

MENU_CLEANUP_STARTUP_DELAY_SECONDS = int(
    os.getenv(
        "MENU_CLEANUP_STARTUP_DELAY_SECONDS",
        "30",
    )
)


# ============================================================
# MENU HISTORY CLEANUP
# ============================================================

def _next_cleanup_time_utc():
    """
    Return the next scheduled menu-history cleanup time.

    Cleanup runs once every day at the configured UTC hour
    and minute.
    """

    now = datetime.now(
        timezone.utc
    )

    next_run = now.replace(
        hour=MENU_CLEANUP_HOUR_UTC,
        minute=MENU_CLEANUP_MINUTE_UTC,
        second=0,
        microsecond=0,
    )

    if next_run <= now:

        next_run += timedelta(
            days=1
        )

    return next_run


def _acquire_cleanup_lock():
    """
    Acquire a MySQL advisory lock.

    Multiple Flask/Gunicorn workers may start the scheduler.
    GET_LOCK ensures that only one worker performs the actual
    cleanup at a time.

    Returns
    -------
    connection or None
        The connection holding the advisory lock.
    """

    connection = None

    try:

        connection = db.engine.connect()

        result = connection.execute(

            db.text(
                """
                SELECT GET_LOCK(
                    :lock_name,
                    0
                )
                """
            ),

            {
                "lock_name":
                    MENU_CLEANUP_LOCK_NAME,
            },

        ).scalar()

        if int(result or 0) != 1:

            connection.close()

            return None

        return connection

    except Exception:

        if connection is not None:

            try:
                connection.close()

            except Exception:
                pass

        logger.exception(
            "Unable to acquire menu cleanup lock."
        )

        return None


def _release_cleanup_lock(
    connection
):
    """
    Release the MySQL advisory lock and close
    the associated connection.
    """

    if connection is None:
        return

    try:

        connection.execute(

            db.text(
                """
                SELECT RELEASE_LOCK(
                    :lock_name
                )
                """
            ),

            {
                "lock_name":
                    MENU_CLEANUP_LOCK_NAME,
            },

        )

    except Exception:

        logger.exception(
            "Unable to release menu cleanup lock."
        )

    finally:

        try:

            connection.close()

        except Exception:

            logger.exception(
                "Unable to close menu cleanup lock connection."
            )


def _run_menu_history_cleanup():
    """
    Execute the existing shared cleanup service.

    All deletion logic remains inside
    services.menu_history_cleanup so the scheduled worker,
    manual cleanup command, and tests use the same rules.
    """

    lock_connection = None

    try:

        # Flask-SQLAlchemy requires an application context before
        # accessing db.engine. Keep lock acquisition and cleanup in
        # the same app context for scheduled/background execution.

        with app.app_context():

            lock_connection = (
                _acquire_cleanup_lock()
            )

            if lock_connection is None:

                logger.info(
                    (
                        "Menu history cleanup skipped because "
                        "another backend worker owns the cleanup lock."
                    )
                )

                return

            logger.info(
                (
                    "Starting scheduled menu history cleanup. "
                    "retention_days=%s"
                ),
                MENU_CLEANUP_RETENTION_DAYS,
            )

            result = cleanup_old_menu_history(
                retention_days=
                    MENU_CLEANUP_RETENTION_DAYS,
            )

            # The cleanup service stores dependent deletion counts
            # inside result["dependenciesDeleted"].
            dependencies_deleted = (
                result.get(
                    "dependenciesDeleted",
                    {}
                )
            )

            logger.info(
                (
                    "Scheduled menu history cleanup completed. "
                    "job_id=%s cutoff_date=%s "
                    "menus_deleted=%s "
                    "meal_responses_deleted=%s "
                    "menu_item_links_deleted=%s "
                    "menu_notifications_deleted=%s"
                ),
                result.get(
                    "jobId"
                ),
                result.get(
                    "cutoffDate"
                ),
                result.get(
                    "menusDeleted",
                    0
                ),
                dependencies_deleted.get(
                    "mealResponses",
                    0
                ),
                dependencies_deleted.get(
                    "menuItemLinks",
                    0
                ),
                dependencies_deleted.get(
                    "menuNotifications",
                    0
                ),
            )

            # Release the advisory lock before leaving the application
            # context. The connection remains valid until this point.

            _release_cleanup_lock(
                lock_connection
            )

            lock_connection = None

    except Exception:

        logger.exception(
            "Scheduled menu history cleanup failed."
        )

    finally:

        if lock_connection is not None:

            _release_cleanup_lock(
                lock_connection
            )


def _menu_history_cleanup_worker():
    """
    Background scheduler for Menu History cleanup.

    The worker sleeps until the next configured UTC run time,
    executes cleanup, and then waits for the following day.

    It is intentionally a daemon thread so it never prevents
    Flask from shutting down.
    """

    if (
        MENU_CLEANUP_HOUR_UTC < 0
        or MENU_CLEANUP_HOUR_UTC > 23
    ):

        logger.error(
            (
                "Invalid MENU_CLEANUP_HOUR_UTC=%s. "
                "Expected 0-23. Scheduler disabled."
            ),
            MENU_CLEANUP_HOUR_UTC,
        )

        return

    if (
        MENU_CLEANUP_MINUTE_UTC < 0
        or MENU_CLEANUP_MINUTE_UTC > 59
    ):

        logger.error(
            (
                "Invalid MENU_CLEANUP_MINUTE_UTC=%s. "
                "Expected 0-59. Scheduler disabled."
            ),
            MENU_CLEANUP_MINUTE_UTC,
        )

        return

    if MENU_CLEANUP_RETENTION_DAYS <= 0:

        logger.error(
            (
                "Invalid MENU_CLEANUP_RETENTION_DAYS=%s. "
                "Expected a positive integer. "
                "Scheduler disabled."
            ),
            MENU_CLEANUP_RETENTION_DAYS,
        )

        return

    if (
        MENU_CLEANUP_STARTUP_DELAY_SECONDS > 0
    ):

        time.sleep(
            MENU_CLEANUP_STARTUP_DELAY_SECONDS
        )

    logger.info(
        (
            "Menu history cleanup scheduler started. "
            "Daily UTC time=%02d:%02d retention_days=%d"
        ),
        MENU_CLEANUP_HOUR_UTC,
        MENU_CLEANUP_MINUTE_UTC,
        MENU_CLEANUP_RETENTION_DAYS,
    )

    while True:

        try:

            next_run = (
                _next_cleanup_time_utc()
            )

            now = datetime.now(
                timezone.utc
            )

            wait_seconds = max(
                (
                    next_run - now
                ).total_seconds(),
                0,
            )

            logger.info(
                (
                    "Next menu history cleanup scheduled "
                    "for %s UTC."
                ),
                next_run.isoformat(),
            )

            time.sleep(
                wait_seconds
            )

            _run_menu_history_cleanup()

            # Prevent an accidental immediate second execution
            # if the system clock changes around the scheduled time.

            time.sleep(
                5
            )

        except Exception:

            logger.exception(
                "Unexpected menu cleanup scheduler error."
            )

            # Keep the scheduler alive after an unexpected
            # scheduler-level failure.

            time.sleep(
                60
            )


def _start_menu_history_cleanup_scheduler():
    """
    Start exactly one scheduler thread per Python process.

    When Flask's development reloader is enabled, the parent
    process must not start a second scheduler thread.
    """

    if os.getenv(
        "DISABLE_MENU_CLEANUP_SCHEDULER",
        "0",
    ).lower() in {
        "1",
        "true",
        "yes",
    }:

        logger.info(
            "Menu history cleanup scheduler is disabled by environment."
        )

        return None

    if (
        app.debug
        and os.getenv(
            "WERKZEUG_RUN_MAIN"
        ) != "true"
    ):

        return None

    existing_thread = getattr(
        app,
        "_menu_cleanup_thread",
        None,
    )

    if (
        existing_thread is not None
        and existing_thread.is_alive()
    ):

        return existing_thread

    thread = threading.Thread(

        target=
            _menu_history_cleanup_worker,

        name=
            "menu-history-cleanup",

        daemon=
            True,
    )

    thread.start()

    app._menu_cleanup_thread = (
        thread
    )

    return thread


# ============================================================
# START SCHEDULED CLEANUP
# ============================================================

_start_menu_history_cleanup_scheduler()


# ============================================================
# APPLICATION ENTRY POINT
# ============================================================

if __name__ == "__main__":

    app.run(
        debug=True
    )