import sys
import unittest

from datetime import (
    date,
    datetime,
    timezone,
)

from pathlib import Path

from flask import Flask

from sqlalchemy import event

# ============================================================
# BACKEND IMPORT PATH
# ============================================================

BACKEND_DIR = (
    Path(__file__)
    .resolve()
    .parents[1]
)

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(
        0,
        str(BACKEND_DIR)
    )


from models import (
    CleanupAudit,
    Forecast,
    Hostel,
    MealResponse,
    Menu,
    MenuItem,
    MenuMenuItem,
    MenuNotification,
    MenuTemplate,
    MenuTemplateItem,
    MessUnit,
    User,
    WasteRecord,
    db,
)

from services.menu_history_cleanup import (
    MenuHistoryCleanupError,
    calculate_cutoff_date,
    cleanup_old_menu_history,
)


# ============================================================
# FROZEN UTC CLOCK
# ============================================================

FIXED_NOW_UTC = datetime(
    2026,
    9,
    12,
    12,
    0,
    0,
    tzinfo=timezone.utc,
)

FIXED_TODAY = date(
    2026,
    9,
    12,
)

EXPECTED_CUTOFF = date(
    2026,
    8,
    3,
)


# ============================================================
# TEST SUITE
# ============================================================

class MenuHistoryCleanupTests(
    unittest.TestCase
):
    """
    Integration tests for the automatic Menu History cleanup
    service.

    Safety:
    - Uses an isolated SQLite in-memory database.
    - Never connects to the project's real MySQL database.
    - Never changes development or production records.
    - All retention tests use a fixed UTC clock.
    """

    # ========================================================
    # SETUP
    # ========================================================

    def setUp(self):

        self.app = Flask(
            __name__
        )

        self.app.config.update(
            TESTING=True,

            SQLALCHEMY_DATABASE_URI=
                "sqlite:///:memory:",

            SQLALCHEMY_TRACK_MODIFICATIONS=
                False,
        )

        db.init_app(
            self.app
        )

        with self.app.app_context():

            engine = db.engine

            @event.listens_for(
                engine,
                "connect"
            )
            def _enable_sqlite_foreign_keys(
                dbapi_connection,
                _connection_record,
            ):

                cursor = (
                    dbapi_connection.cursor()
                )

                cursor.execute(
                    "PRAGMA foreign_keys=ON"
                )

                cursor.close()

            db.create_all()

            self._seed_base_data()

    # ========================================================
    # TEARDOWN
    # ========================================================

    def tearDown(self):

        with self.app.app_context():

            db.session.remove()

            # Disposing the SQLite in-memory engine destroys
            # the complete test database.
            #
            # We deliberately avoid db.drop_all() because this
            # project contains circular foreign-key
            # relationships between Users, Hostels and
            # Mess Units.
            db.engine.dispose()

    # ========================================================
    # BASE FIXTURES
    # ========================================================

    def _seed_base_data(self):

        # ----------------------------------------------------
        # MANAGER
        # ----------------------------------------------------

        manager = User(
            name=
                "Cleanup Test Manager",

            manager_id=
                "MGR-CLEANUP",

            email=
                "cleanup.manager@test.local",

            mobile=
                "9000000101",

            password_hash=
                "test-hash",

            role=
                "manager",

            is_active=
                True,

            must_change_password=
                False,
        )

        db.session.add(
            manager
        )

        db.session.flush()

        self.manager_id = (
            manager.id
        )

        # ----------------------------------------------------
        # HOSTEL
        # ----------------------------------------------------

        hostel = Hostel(
            manager_user_id=
                manager.id,

            name=
                "Cleanup Hostel",

            code=
                "CLEAN",

            status=
                "active",
        )

        db.session.add(
            hostel
        )

        db.session.flush()

        self.hostel_id = (
            hostel.id
        )

        # ----------------------------------------------------
        # MESS UNIT
        # ----------------------------------------------------

        mess = MessUnit(
            hostel_id=
                hostel.id,

            name=
                "Cleanup North Mess",

            unit_type=
                "north",

            supported_categories=
                "both",

            capacity=
                300,

            status=
                "active",
        )

        db.session.add(
            mess
        )

        db.session.flush()

        self.mess_unit_id = (
            mess.id
        )

        # ----------------------------------------------------
        # STUDENT
        # ----------------------------------------------------

        student = User(
            name=
                "Cleanup Student",

            student_id=
                "STU-CLEANUP",

            email=
                "cleanup.student@test.local",

            mobile=
                "9100000101",

            password_hash=
                "test-hash",

            role=
                "student",

            meal_category=
                "veg",

            hostel_id=
                hostel.id,

            mess_unit_id=
                mess.id,

            is_active=
                True,

            must_change_password=
                False,
        )

        db.session.add(
            student
        )

        db.session.flush()

        self.student_id = (
            student.id
        )

        # ----------------------------------------------------
        # FOOD MASTER
        # ----------------------------------------------------

        food_item = MenuItem(
            manager_user_id=
                None,

            name=
                "Cleanup Dal",

            item_type=
                "Curry",

            meal_category=
                "veg",

            default_quantity=
                150,

            default_unit=
                "g",

            calories_per_serving=
                180,

            is_active=
                True,
        )

        db.session.add(
            food_item
        )

        db.session.flush()

        self.food_item_id = (
            food_item.id
        )

        # ----------------------------------------------------
        # TEMPLATE
        # ----------------------------------------------------

        template = MenuTemplate(
            manager_user_id=
                manager.id,

            name=
                "Permanent Cleanup Template",

            meal=
                "lunch",

            meal_category=
                "veg",

            description=
                "Templates must never be removed by history cleanup.",

            is_active=
                True,
        )

        db.session.add(
            template
        )

        db.session.flush()

        template_item = MenuTemplateItem(
            template_id=
                template.id,

            menu_item_id=
                food_item.id,

            quantity_per_student=
                150,

            unit=
                "g",

            display_order=
                0,
        )

        db.session.add(
            template_item
        )

        db.session.commit()

        self.template_id = (
            template.id
        )

        self.template_item_id = (
            template_item.id
        )

    # ========================================================
    # MENU FIXTURE
    # ========================================================

    def _create_menu(
        self,
        *,
        menu_date,
        status="draft",
        meal="lunch",
        meal_category="veg",
        with_item_link=True,
        with_response=False,
        with_notification=False,
    ):

        menu = Menu(
            hostel_id=
                self.hostel_id,

            mess_unit_id=
                self.mess_unit_id,

            menu_date=
                menu_date,

            meal=
                meal,

            meal_category=
                meal_category,

            menu_items=
                (
                    "Cleanup Dal"
                    if with_item_link
                    else "Legacy Menu"
                ),

            status=
                status,

            created_by=
                self.manager_id,
        )

        if status == "published":

            menu.published_at = datetime(
                2026,
                7,
                1,
                12,
                0,
                0,
            )

            menu.published_by = (
                self.manager_id
            )

        db.session.add(
            menu
        )

        db.session.flush()

        menu_id = (
            menu.id
        )

        link_id = None
        response_id = None
        notification_id = None

        # ----------------------------------------------------
        # STRUCTURED ITEM
        # ----------------------------------------------------

        if with_item_link:

            link = MenuMenuItem(
                menu_id=
                    menu.id,

                menu_item_id=
                    self.food_item_id,

                quantity_per_student=
                    150,

                unit=
                    "g",

                display_order=
                    0,
            )

            db.session.add(
                link
            )

            db.session.flush()

            link_id = (
                link.id
            )

        # ----------------------------------------------------
        # MEAL RESPONSE
        # ----------------------------------------------------

        if with_response:

            response = MealResponse(
                menu_id=
                    menu.id,

                student_user_id=
                    self.student_id,

                mess_unit_id=
                    self.mess_unit_id,

                response=
                    "attending",
            )

            db.session.add(
                response
            )

            db.session.flush()

            response_id = (
                response.id
            )

        # ----------------------------------------------------
        # MENU AUDIENCE NOTIFICATION
        # ----------------------------------------------------

        if with_notification:

            notification = MenuNotification(
                menu_id=
                    menu.id,

                recipient_user_id=
                    self.student_id,

                notification_type=
                    "menu_published",

                title=
                    "Lunch menu published",

                message=
                    "Lunch menu is available.",

                is_read=
                    False,
            )

            db.session.add(
                notification
            )

            db.session.flush()

            notification_id = (
                notification.id
            )

        db.session.commit()

        return {
            "menu_id":
                menu_id,

            "link_id":
                link_id,

            "response_id":
                response_id,

            "notification_id":
                notification_id,
        }

    # ========================================================
    # EXACT CUTOFF
    # ========================================================

    def test_cutoff_is_exactly_utc_today_minus_40_days(
        self
    ):

        cutoff = (
            calculate_cutoff_date(
                now_utc=
                    FIXED_NOW_UTC,

                retention_days=
                    40,
            )
        )

        self.assertEqual(
            cutoff,
            EXPECTED_CUTOFF,
        )

        self.assertEqual(
            cutoff,
            date(
                2026,
                8,
                3,
            ),
        )

    # ========================================================
    # 39 / 40 / 41 DAY BOUNDARY
    # ========================================================

    def test_39_and_40_day_menus_stay_but_41_day_menu_is_deleted(
        self
    ):

        with self.app.app_context():

            menu_39 = (
                self._create_menu(
                    menu_date=
                        date(
                            2026,
                            8,
                            4,
                        )
                )
            )

            menu_40 = (
                self._create_menu(
                    menu_date=
                        date(
                            2026,
                            8,
                            3,
                        )
                )
            )

            menu_41 = (
                self._create_menu(
                    menu_date=
                        date(
                            2026,
                            8,
                            2,
                        )
                )
            )

            result = (
                cleanup_old_menu_history(
                    now_utc=
                        FIXED_NOW_UTC,

                    retention_days=
                        40,

                    batch_size=
                        100,

                    dry_run=
                        False,
                )
            )

            self.assertEqual(
                result[
                    "cutoffDate"
                ],
                "2026-08-03",
            )

            self.assertEqual(
                result[
                    "menusDeleted"
                ],
                1,
            )

            # -----------------------------------------------
            # 39 days old -> KEEP
            # -----------------------------------------------

            self.assertIsNotNone(
                db.session.get(
                    Menu,
                    menu_39[
                        "menu_id"
                    ],
                )
            )

            # -----------------------------------------------
            # exactly 40 days old -> KEEP
            # -----------------------------------------------

            self.assertIsNotNone(
                db.session.get(
                    Menu,
                    menu_40[
                        "menu_id"
                    ],
                )
            )

            # -----------------------------------------------
            # 41 days old -> DELETE
            # -----------------------------------------------

            self.assertIsNone(
                db.session.get(
                    Menu,
                    menu_41[
                        "menu_id"
                    ],
                )
            )

    # ========================================================
    # CURRENT / FUTURE SAFETY
    # ========================================================

    def test_current_future_future_draft_and_recent_records_are_preserved(
        self
    ):

        with self.app.app_context():

            current_menu = (
                self._create_menu(
                    menu_date=
                        FIXED_TODAY,

                    status=
                        "draft",

                    meal=
                        "breakfast",
                )
            )

            future_scheduled = (
                self._create_menu(
                    menu_date=
                        date(
                            2026,
                            9,
                            13,
                        ),

                    status=
                        "scheduled",

                    meal=
                        "lunch",
                )
            )

            future_draft = (
                self._create_menu(
                    menu_date=
                        date(
                            2026,
                            9,
                            14,
                        ),

                    status=
                        "draft",

                    meal=
                        "dinner",
                )
            )

            recent_past = (
                self._create_menu(
                    menu_date=
                        date(
                            2026,
                            8,
                            4,
                        ),

                    status=
                        "completed",

                    meal=
                        "snacks",
                )
            )

            result = (
                cleanup_old_menu_history(
                    now_utc=
                        FIXED_NOW_UTC,

                    dry_run=
                        False,
                )
            )

            self.assertEqual(
                result[
                    "menusDeleted"
                ],
                0,
            )

            for fixture in [
                current_menu,
                future_scheduled,
                future_draft,
                recent_past,
            ]:

                self.assertIsNotNone(
                    db.session.get(
                        Menu,
                        fixture[
                            "menu_id"
                        ],
                    )
                )

    # ========================================================
    # TEMPLATE + FOOD MASTER SAFETY
    # ========================================================

    def test_cleanup_never_deletes_templates_or_food_master_records(
        self
    ):

        with self.app.app_context():

            old_menu = (
                self._create_menu(
                    menu_date=
                        date(
                            2026,
                            7,
                            1,
                        ),

                    status=
                        "completed",
                )
            )

            result = (
                cleanup_old_menu_history(
                    now_utc=
                        FIXED_NOW_UTC,

                    dry_run=
                        False,
                )
            )

            self.assertEqual(
                result[
                    "menusDeleted"
                ],
                1,
            )

            self.assertIsNone(
                db.session.get(
                    Menu,
                    old_menu[
                        "menu_id"
                    ],
                )
            )

            # Food master survives.
            self.assertIsNotNone(
                db.session.get(
                    MenuItem,
                    self.food_item_id,
                )
            )

            # Template survives.
            self.assertIsNotNone(
                db.session.get(
                    MenuTemplate,
                    self.template_id,
                )
            )

            # Template item survives.
            self.assertIsNotNone(
                db.session.get(
                    MenuTemplateItem,
                    self.template_item_id,
                )
            )

    # ========================================================
    # MENU DEPENDENCIES
    # ========================================================

    def test_old_menu_and_direct_dependencies_are_deleted_without_fk_errors(
        self
    ):

        with self.app.app_context():

            fixture = (
                self._create_menu(
                    menu_date=
                        date(
                            2026,
                            7,
                            10,
                        ),

                    status=
                        "published",

                    with_item_link=
                        True,

                    with_response=
                        True,

                    with_notification=
                        True,
                )
            )

            self.assertIsNotNone(
                db.session.get(
                    MenuMenuItem,
                    fixture[
                        "link_id"
                    ],
                )
            )

            self.assertIsNotNone(
                db.session.get(
                    MealResponse,
                    fixture[
                        "response_id"
                    ],
                )
            )

            self.assertIsNotNone(
                db.session.get(
                    MenuNotification,
                    fixture[
                        "notification_id"
                    ],
                )
            )

            result = (
                cleanup_old_menu_history(
                    now_utc=
                        FIXED_NOW_UTC,

                    batch_size=
                        10,

                    dry_run=
                        False,
                )
            )

            self.assertEqual(
                result[
                    "menusDeleted"
                ],
                1,
            )

            self.assertEqual(
                result[
                    "dependentRowsDeleted"
                ],
                3,
            )

            self.assertEqual(
                result[
                    "details"
                ][
                    "mealResponsesDeleted"
                ],
                1,
            )

            self.assertEqual(
                result[
                    "details"
                ][
                    "menuItemLinksDeleted"
                ],
                1,
            )

            self.assertEqual(
                result[
                    "details"
                ][
                    "menuNotificationsDeleted"
                ],
                1,
            )

            self.assertIsNone(
                db.session.get(
                    Menu,
                    fixture[
                        "menu_id"
                    ],
                )
            )

            self.assertIsNone(
                db.session.get(
                    MenuMenuItem,
                    fixture[
                        "link_id"
                    ],
                )
            )

            self.assertIsNone(
                db.session.get(
                    MealResponse,
                    fixture[
                        "response_id"
                    ],
                )
            )

            self.assertIsNone(
                db.session.get(
                    MenuNotification,
                    fixture[
                        "notification_id"
                    ],
                )
            )

            # Food master must remain.
            self.assertIsNotNone(
                db.session.get(
                    MenuItem,
                    self.food_item_id,
                )
            )

    # ========================================================
    # REPORT HISTORY PRESERVATION
    # ========================================================

    def test_forecast_and_waste_report_history_are_preserved(
        self
    ):

        with self.app.app_context():

            old_date = date(
                2026,
                7,
                15,
            )

            menu_fixture = (
                self._create_menu(
                    menu_date=
                        old_date,

                    status=
                        "completed",
                )
            )

            forecast = Forecast(
                hostel_id=
                    self.hostel_id,

                mess_unit_id=
                    self.mess_unit_id,

                forecast_date=
                    old_date,

                meal=
                    "lunch",

                meal_category=
                    "veg",

                predicted_students=
                    180,

                actual_students=
                    175,

                preparation_status=
                    "completed",
            )

            waste = WasteRecord(
                hostel_id=
                    self.hostel_id,

                mess_unit_id=
                    self.mess_unit_id,

                record_date=
                    old_date,

                meal=
                    "lunch",

                meal_category=
                    "veg",

                quantity_prepared=
                    200,

                quantity_served=
                    175,

                waste_kg=
                    4.5,

                students_served=
                    175,

                shortage_occurred=
                    False,
            )

            db.session.add_all(
                [
                    forecast,
                    waste,
                ]
            )

            db.session.commit()

            forecast_id = (
                forecast.id
            )

            waste_id = (
                waste.id
            )

            cleanup_old_menu_history(
                now_utc=
                    FIXED_NOW_UTC,

                dry_run=
                    False,
            )

            # Menu is gone.
            self.assertIsNone(
                db.session.get(
                    Menu,
                    menu_fixture[
                        "menu_id"
                    ],
                )
            )

            # Forecast/report history remains.
            remaining_forecast = (
                db.session.get(
                    Forecast,
                    forecast_id,
                )
            )

            self.assertIsNotNone(
                remaining_forecast
            )

            self.assertEqual(
                remaining_forecast
                .predicted_students,
                180,
            )

            self.assertEqual(
                remaining_forecast
                .actual_students,
                175,
            )

            # Waste/report history remains.
            remaining_waste = (
                db.session.get(
                    WasteRecord,
                    waste_id,
                )
            )

            self.assertIsNotNone(
                remaining_waste
            )

            self.assertEqual(
                remaining_waste
                .waste_kg,
                4.5,
            )

            self.assertEqual(
                remaining_waste
                .students_served,
                175,
            )

    # ========================================================
    # DRY RUN
    # ========================================================

    def test_dry_run_reports_eligible_rows_but_changes_nothing(
        self
    ):

        with self.app.app_context():

            fixture = (
                self._create_menu(
                    menu_date=
                        date(
                            2026,
                            7,
                            20,
                        ),

                    status=
                        "published",

                    with_item_link=
                        True,

                    with_response=
                        True,

                    with_notification=
                        True,
                )
            )

            before = {
                "menus":
                    Menu.query.count(),

                "links":
                    MenuMenuItem.query.count(),

                "responses":
                    MealResponse.query.count(),

                "notifications":
                    MenuNotification.query.count(),

                "audits":
                    CleanupAudit.query.count(),
            }

            result = (
                cleanup_old_menu_history(
                    now_utc=
                        FIXED_NOW_UTC,

                    dry_run=
                        True,
                )
            )

            after = {
                "menus":
                    Menu.query.count(),

                "links":
                    MenuMenuItem.query.count(),

                "responses":
                    MealResponse.query.count(),

                "notifications":
                    MenuNotification.query.count(),

                "audits":
                    CleanupAudit.query.count(),
            }

            self.assertEqual(
                result[
                    "dryRun"
                ],
                True,
            )

            self.assertEqual(
                result[
                    "status"
                ],
                "dry-run",
            )

            self.assertEqual(
                result[
                    "eligibleMenus"
                ],
                1,
            )

            self.assertEqual(
                result[
                    "menusDeleted"
                ],
                0,
            )

            self.assertEqual(
                result[
                    "dependentRowsEligible"
                ],
                3,
            )

            self.assertEqual(
                result[
                    "dependentRowsDeleted"
                ],
                0,
            )

            # Absolutely no database changes.
            self.assertEqual(
                before,
                after,
            )

            self.assertIsNotNone(
                db.session.get(
                    Menu,
                    fixture[
                        "menu_id"
                    ],
                )
            )

            self.assertIsNotNone(
                db.session.get(
                    MenuMenuItem,
                    fixture[
                        "link_id"
                    ],
                )
            )

            self.assertIsNotNone(
                db.session.get(
                    MealResponse,
                    fixture[
                        "response_id"
                    ],
                )
            )

            self.assertIsNotNone(
                db.session.get(
                    MenuNotification,
                    fixture[
                        "notification_id"
                    ],
                )
            )

    # ========================================================
    # ROLLBACK
    # ========================================================

    def test_failure_before_first_batch_rolls_back_and_preserves_menu(
        self
    ):

        with self.app.app_context():

            fixture = (
                self._create_menu(
                    menu_date=
                        date(
                            2026,
                            7,
                            5,
                        ),

                    with_item_link=
                        True,

                    with_response=
                        True,
                )
            )

            def fail_before_delete(
                _menu_ids,
                _batch_number,
            ):

                raise RuntimeError(
                    "Intentional cleanup test failure"
                )

            with self.assertRaises(
                MenuHistoryCleanupError
            ):

                cleanup_old_menu_history(
                    now_utc=
                        FIXED_NOW_UTC,

                    batch_size=
                        100,

                    dry_run=
                        False,

                    before_delete_batch=
                        fail_before_delete,
                )

            # Failed batch must not remove anything.
            self.assertIsNotNone(
                db.session.get(
                    Menu,
                    fixture[
                        "menu_id"
                    ],
                )
            )

            self.assertIsNotNone(
                db.session.get(
                    MenuMenuItem,
                    fixture[
                        "link_id"
                    ],
                )
            )

            self.assertIsNotNone(
                db.session.get(
                    MealResponse,
                    fixture[
                        "response_id"
                    ],
                )
            )

            audit = (
                CleanupAudit.query
                .order_by(
                    CleanupAudit.id.desc()
                )
                .first()
            )

            self.assertIsNotNone(
                audit
            )

            self.assertEqual(
                audit.status,
                "failed",
            )

            self.assertEqual(
                audit.menus_deleted,
                0,
            )

            self.assertEqual(
                audit.dependent_rows_deleted,
                0,
            )

            self.assertFalse(
                audit.dry_run
            )

            self.assertIsNotNone(
                audit.completed_at
            )

            # Error logging must be sanitized.
            self.assertIsNotNone(
                audit.error_message
            )

            self.assertIn(
                "RuntimeError",
                audit.error_message,
            )

            self.assertNotIn(
                "Intentional cleanup test failure",
                audit.error_message,
            )

    # ========================================================
    # IDEMPOTENCY
    # ========================================================

    def test_running_cleanup_twice_is_safe_and_idempotent(
        self
    ):

        with self.app.app_context():

            fixture = (
                self._create_menu(
                    menu_date=
                        date(
                            2026,
                            7,
                            2,
                        ),

                    with_item_link=
                        True,
                )
            )

            first = (
                cleanup_old_menu_history(
                    now_utc=
                        FIXED_NOW_UTC,

                    dry_run=
                        False,
                )
            )

            second = (
                cleanup_old_menu_history(
                    now_utc=
                        FIXED_NOW_UTC,

                    dry_run=
                        False,
                )
            )

            self.assertEqual(
                first[
                    "menusDeleted"
                ],
                1,
            )

            self.assertEqual(
                second[
                    "menusDeleted"
                ],
                0,
            )

            self.assertEqual(
                second[
                    "dependentRowsDeleted"
                ],
                0,
            )

            self.assertIsNone(
                db.session.get(
                    Menu,
                    fixture[
                        "menu_id"
                    ],
                )
            )

            successful_audits = (
                CleanupAudit.query
                .filter_by(
                    status=
                        "success",

                    dry_run=
                        False,
                )
                .count()
            )

            self.assertEqual(
                successful_audits,
                2,
            )

    # ========================================================
    # BATCH LIMIT
    # ========================================================

    def test_max_batches_limits_work_without_deleting_newer_records(
        self
    ):

        with self.app.app_context():

            oldest = (
                self._create_menu(
                    menu_date=
                        date(
                            2026,
                            6,
                            1,
                        ),

                    meal=
                        "breakfast",
                )
            )

            second_oldest = (
                self._create_menu(
                    menu_date=
                        date(
                            2026,
                            6,
                            2,
                        ),

                    meal=
                        "lunch",
                )
            )

            recent = (
                self._create_menu(
                    menu_date=
                        date(
                            2026,
                            8,
                            4,
                        ),

                    meal=
                        "dinner",
                )
            )

            result = (
                cleanup_old_menu_history(
                    now_utc=
                        FIXED_NOW_UTC,

                    batch_size=
                        1,

                    max_batches=
                        1,

                    dry_run=
                        False,
                )
            )

            self.assertEqual(
                result[
                    "batchesCompleted"
                ],
                1,
            )

            self.assertEqual(
                result[
                    "menusDeleted"
                ],
                1,
            )

            # Cleanup orders by menu_date then id,
            # therefore the oldest eligible Menu goes first.
            self.assertIsNone(
                db.session.get(
                    Menu,
                    oldest[
                        "menu_id"
                    ],
                )
            )

            self.assertIsNotNone(
                db.session.get(
                    Menu,
                    second_oldest[
                        "menu_id"
                    ],
                )
            )

            # Recent record remains regardless of batch limit.
            self.assertIsNotNone(
                db.session.get(
                    Menu,
                    recent[
                        "menu_id"
                    ],
                )
            )

    # ========================================================
    # AUDIT SUCCESS
    # ========================================================

    def test_successful_cleanup_creates_sanitized_audit_record(
        self
    ):

        with self.app.app_context():

            fixture = (
                self._create_menu(
                    menu_date=
                        date(
                            2026,
                            7,
                            25,
                        ),

                    with_item_link=
                        True,
                )
            )

            result = (
                cleanup_old_menu_history(
                    now_utc=
                        FIXED_NOW_UTC,

                    dry_run=
                        False,
                )
            )

            audit = (
                CleanupAudit.query
                .filter_by(
                    job_id=
                        result[
                            "jobId"
                        ]
                )
                .first()
            )

            self.assertIsNotNone(
                audit
            )

            self.assertEqual(
                audit.status,
                "success",
            )

            self.assertEqual(
                audit.cutoff_date,
                EXPECTED_CUTOFF,
            )

            self.assertEqual(
                audit.menus_deleted,
                1,
            )

            self.assertEqual(
                audit.dependent_rows_deleted,
                1,
            )

            self.assertFalse(
                audit.dry_run
            )

            self.assertIsNone(
                audit.error_message
            )

            self.assertIsNotNone(
                audit.executed_at
            )

            self.assertIsNotNone(
                audit.completed_at
            )

            self.assertIsNone(
                db.session.get(
                    Menu,
                    fixture[
                        "menu_id"
                    ],
                )
            )


# ============================================================
# RUN DIRECTLY
# ============================================================

if __name__ == "__main__":

    unittest.main(
        verbosity=2
    )