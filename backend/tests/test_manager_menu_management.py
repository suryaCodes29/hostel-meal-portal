import sys
import unittest
from datetime import date, datetime
from pathlib import Path
from unittest.mock import patch


# ============================================================
# BACKEND IMPORT PATH
# ============================================================

BACKEND_DIR = Path(__file__).resolve().parents[1]

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(
        0,
        str(BACKEND_DIR)
    )


from flask import Flask

from flask_jwt_extended import (
    JWTManager,
    create_access_token,
)

from sqlalchemy import event

from models import (
    db,
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
)

from routes.manager_routes import (
    manager_bp,
)


# ============================================================
# FIXED TEST DATE
# ============================================================

FIXED_TODAY = date(
    2026,
    9,
    12,
)


class ManagerMenuManagementTests(
    unittest.TestCase
):
    """
    Integration tests for Manager Menu Management.

    Safety:
    - Uses a fresh in-memory SQLite database for every test.
    - Never connects to the project's real MySQL database.
    - Never changes development or production data.
    - Menu Management's current date is frozen for
      deterministic status/history tests.
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

            JWT_SECRET_KEY=(
                "menu-management-test-secret-"
                "32-bytes-minimum-key"
            ),

            JWT_ACCESS_TOKEN_EXPIRES=
                False,
        )

        db.init_app(
            self.app
        )

        JWTManager(
            self.app
        )

        self.app.register_blueprint(
            manager_bp
        )

        # ----------------------------------------------------
        # Freeze Menu Management's concept of today.
        # ----------------------------------------------------

        self.today_patch = patch(
            (
                "routes.manager_routes."
                "menu_utc_today"
            ),
            return_value=
                FIXED_TODAY,
        )

        self.today_patch.start()

        with self.app.app_context():

            engine = db.engine

            @event.listens_for(
                engine,
                "connect"
            )
            def _enable_sqlite_foreign_keys(
                dbapi_connection,
                _record,
            ):

                cursor = (
                    dbapi_connection.cursor()
                )

                cursor.execute(
                    "PRAGMA foreign_keys=ON"
                )

                cursor.close()

            db.create_all()

            self._seed_database()

            self.manager_a_token = (
                create_access_token(
                    identity=str(
                        self.manager_a_id
                    )
                )
            )

            self.manager_b_token = (
                create_access_token(
                    identity=str(
                        self.manager_b_id
                    )
                )
            )

        self.client = (
            self.app.test_client()
        )

    # ========================================================
    # TEARDOWN
    # ========================================================

    def tearDown(self):

        self.today_patch.stop()

        with self.app.app_context():

            db.session.remove()

            # Dispose the test-only in-memory database.
            #
            # Do not use db.drop_all() here because this
            # project intentionally contains circular foreign
            # keys between users / hostels / mess units.
            db.engine.dispose()

    # ========================================================
    # DATABASE FIXTURES
    # ========================================================

    def _seed_database(self):

        # ----------------------------------------------------
        # MANAGERS
        # ----------------------------------------------------

        manager_a = User(
            name=
                "Manager A",

            manager_id=
                "MGR-A",

            email=
                "manager.a@test.local",

            mobile=
                "9000000001",

            password_hash=
                "test-hash",

            role=
                "manager",

            is_active=
                True,

            must_change_password=
                False,
        )

        manager_b = User(
            name=
                "Manager B",

            manager_id=
                "MGR-B",

            email=
                "manager.b@test.local",

            mobile=
                "9000000002",

            password_hash=
                "test-hash",

            role=
                "manager",

            is_active=
                True,

            must_change_password=
                False,
        )

        db.session.add_all(
            [
                manager_a,
                manager_b,
            ]
        )

        db.session.flush()

        self.manager_a_id = (
            manager_a.id
        )

        self.manager_b_id = (
            manager_b.id
        )

        # ----------------------------------------------------
        # HOSTELS
        # ----------------------------------------------------

        hostel_a = Hostel(
            manager_user_id=
                manager_a.id,

            name=
                "Manager A Hostel",

            code=
                "HA",

            status=
                "active",
        )

        hostel_b = Hostel(
            manager_user_id=
                manager_b.id,

            name=
                "Manager B Hostel",

            code=
                "HB",

            status=
                "active",
        )

        db.session.add_all(
            [
                hostel_a,
                hostel_b,
            ]
        )

        db.session.flush()

        self.hostel_a_id = (
            hostel_a.id
        )

        self.hostel_b_id = (
            hostel_b.id
        )

        # ----------------------------------------------------
        # MESS UNITS
        # ----------------------------------------------------

        mess_a = MessUnit(
            hostel_id=
                hostel_a.id,

            name=
                "North Mess A",

            unit_type=
                "north",

            supported_categories=
                "both",

            capacity=
                250,

            status=
                "active",
        )

        mess_b = MessUnit(
            hostel_id=
                hostel_b.id,

            name=
                "North Mess B",

            unit_type=
                "north",

            supported_categories=
                "both",

            capacity=
                250,

            status=
                "active",
        )

        db.session.add_all(
            [
                mess_a,
                mess_b,
            ]
        )

        db.session.flush()

        self.mess_a_id = (
            mess_a.id
        )

        self.mess_b_id = (
            mess_b.id
        )

        # ----------------------------------------------------
        # MANAGER A AUDIENCE
        # ----------------------------------------------------

        student_a_veg = User(
            name=
                "Student A Veg",

            student_id=
                "STU-A-VEG",

            email=
                "student.a.veg@test.local",

            mobile=
                "9100000001",

            password_hash=
                "test-hash",

            role=
                "student",

            meal_category=
                "veg",

            hostel_id=
                hostel_a.id,

            mess_unit_id=
                mess_a.id,

            is_active=
                True,

            must_change_password=
                False,
        )

        student_a_nonveg = User(
            name=
                "Student A NonVeg",

            student_id=
                "STU-A-NONVEG",

            email=
                "student.a.nonveg@test.local",

            mobile=
                "9100000002",

            password_hash=
                "test-hash",

            role=
                "student",

            meal_category=
                "non-veg",

            hostel_id=
                hostel_a.id,

            mess_unit_id=
                mess_a.id,

            is_active=
                True,

            must_change_password=
                False,
        )

        staff_a = User(
            name=
                "Staff A",

            staff_id=
                "STAFF-A",

            email=
                "staff.a@test.local",

            mobile=
                "9200000001",

            password_hash=
                "test-hash",

            role=
                "staff",

            staff_role=
                "Cook",

            hostel_id=
                hostel_a.id,

            mess_unit_id=
                mess_a.id,

            is_active=
                True,

            must_change_password=
                False,
        )

        # ----------------------------------------------------
        # MANAGER B AUDIENCE
        # ----------------------------------------------------

        student_b_veg = User(
            name=
                "Student B Veg",

            student_id=
                "STU-B-VEG",

            email=
                "student.b.veg@test.local",

            mobile=
                "9300000001",

            password_hash=
                "test-hash",

            role=
                "student",

            meal_category=
                "veg",

            hostel_id=
                hostel_b.id,

            mess_unit_id=
                mess_b.id,

            is_active=
                True,

            must_change_password=
                False,
        )

        staff_b = User(
            name=
                "Staff B",

            staff_id=
                "STAFF-B",

            email=
                "staff.b@test.local",

            mobile=
                "9400000001",

            password_hash=
                "test-hash",

            role=
                "staff",

            staff_role=
                "Cook",

            hostel_id=
                hostel_b.id,

            mess_unit_id=
                mess_b.id,

            is_active=
                True,

            must_change_password=
                False,
        )

        db.session.add_all(
            [
                student_a_veg,
                student_a_nonveg,
                staff_a,
                student_b_veg,
                staff_b,
            ]
        )

        db.session.flush()

        self.student_a_veg_id = (
            student_a_veg.id
        )

        self.student_a_nonveg_id = (
            student_a_nonveg.id
        )

        self.staff_a_id = (
            staff_a.id
        )

        self.student_b_veg_id = (
            student_b_veg.id
        )

        self.staff_b_id = (
            staff_b.id
        )

        # ----------------------------------------------------
        # GLOBAL FOOD ITEMS
        # ----------------------------------------------------

        global_veg = MenuItem(
            manager_user_id=
                None,

            name=
                "Dal Tadka",

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

        global_nonveg = MenuItem(
            manager_user_id=
                None,

            name=
                "Chicken Curry",

            item_type=
                "Curry",

            meal_category=
                "non-veg",

            default_quantity=
                150,

            default_unit=
                "g",

            calories_per_serving=
                260,

            is_active=
                True,
        )

        # ----------------------------------------------------
        # MANAGER B PRIVATE FOOD ITEM
        # ----------------------------------------------------

        manager_b_private_item = (
            MenuItem(
                manager_user_id=
                    manager_b.id,

                name=
                    "Manager B Special",

                item_type=
                    "Main Course",

                meal_category=
                    "veg",

                default_quantity=
                    1,

                default_unit=
                    "serving",

                calories_per_serving=
                    350,

                is_active=
                    True,
            )
        )

        db.session.add_all(
            [
                global_veg,
                global_nonveg,
                manager_b_private_item,
            ]
        )

        db.session.flush()

        self.global_veg_item_id = (
            global_veg.id
        )

        self.global_nonveg_item_id = (
            global_nonveg.id
        )

        self.manager_b_private_item_id = (
            manager_b_private_item.id
        )

        # ----------------------------------------------------
        # MANAGER A HISTORICAL MENU - VEG
        # ----------------------------------------------------

        history_a_veg = Menu(
            hostel_id=
                hostel_a.id,

            mess_unit_id=
                mess_a.id,

            menu_date=
                date(
                    2026,
                    9,
                    10,
                ),

            meal=
                "breakfast",

            meal_category=
                "veg",

            menu_items=
                "Dal Tadka",

            status=
                "draft",

            created_by=
                manager_a.id,
        )

        # ----------------------------------------------------
        # MANAGER A HISTORICAL MENU - NON VEG
        # ----------------------------------------------------

        history_a_nonveg = Menu(
            hostel_id=
                hostel_a.id,

            mess_unit_id=
                mess_a.id,

            menu_date=
                date(
                    2026,
                    9,
                    9,
                ),

            meal=
                "dinner",

            meal_category=
                "non-veg",

            menu_items=
                "Chicken Curry",

            status=
                "published",

            created_by=
                manager_a.id,

            published_at=
                datetime(
                    2026,
                    9,
                    8,
                    18,
                    0,
                    0,
                ),

            published_by=
                manager_a.id,
        )

        # ----------------------------------------------------
        # MANAGER B MENU
        # ----------------------------------------------------

        menu_b = Menu(
            hostel_id=
                hostel_b.id,

            mess_unit_id=
                mess_b.id,

            menu_date=
                date(
                    2026,
                    9,
                    10,
                ),

            meal=
                "lunch",

            meal_category=
                "veg",

            menu_items=
                "Dal Tadka",

            status=
                "draft",

            created_by=
                manager_b.id,
        )

        db.session.add_all(
            [
                history_a_veg,
                history_a_nonveg,
                menu_b,
            ]
        )

        db.session.flush()

        self.history_a_veg_id = (
            history_a_veg.id
        )

        self.history_a_nonveg_id = (
            history_a_nonveg.id
        )

        self.menu_b_id = (
            menu_b.id
        )

        # ----------------------------------------------------
        # STRUCTURED MENU LINKS
        # ----------------------------------------------------

        db.session.add_all(
            [
                MenuMenuItem(
                    menu_id=
                        history_a_veg.id,

                    menu_item_id=
                        global_veg.id,

                    quantity_per_student=
                        150,

                    unit=
                        "g",

                    display_order=
                        0,
                ),

                MenuMenuItem(
                    menu_id=
                        history_a_nonveg.id,

                    menu_item_id=
                        global_nonveg.id,

                    quantity_per_student=
                        150,

                    unit=
                        "g",

                    display_order=
                        0,
                ),

                MenuMenuItem(
                    menu_id=
                        menu_b.id,

                    menu_item_id=
                        global_veg.id,

                    quantity_per_student=
                        150,

                    unit=
                        "g",

                    display_order=
                        0,
                ),
            ]
        )

        # ----------------------------------------------------
        # MANAGER B PRIVATE TEMPLATE
        # ----------------------------------------------------

        template_b = MenuTemplate(
            manager_user_id=
                manager_b.id,

            name=
                "Manager B Template",

            meal=
                "breakfast",

            meal_category=
                "veg",

            description=
                "Private template",

            is_active=
                True,
        )

        db.session.add(
            template_b
        )

        db.session.flush()

        db.session.add(
            MenuTemplateItem(
                template_id=
                    template_b.id,

                menu_item_id=
                    global_veg.id,

                quantity_per_student=
                    150,

                unit=
                    "g",

                display_order=
                    0,
            )
        )

        db.session.commit()

        self.template_b_id = (
            template_b.id
        )

    # ========================================================
    # HTTP HELPERS
    # ========================================================

    def _headers(
        self,
        token
    ):

        return {
            "Authorization":
                f"Bearer {token}"
        }

    def _manager_a_headers(self):

        return self._headers(
            self.manager_a_token
        )

    def _menu_payload(
        self,
        *,
        menu_date="2026-09-12",
        meal="lunch",
        category="veg",
        item_id=None,
        quantity=150,
        unit="g",
        hostel_id=None,
        mess_unit_id=None,
    ):

        return {
            "hostelId": (
                hostel_id
                or self.hostel_a_id
            ),

            "messUnitId": (
                mess_unit_id
                or self.mess_a_id
            ),

            "date":
                menu_date,

            "meal":
                meal,

            "mealCategory":
                category,

            "items": [
                {
                    "menuItemId": (
                        item_id
                        or self.global_veg_item_id
                    ),

                    "quantityPerStudent":
                        quantity,

                    "unit":
                        unit,
                }
            ],
        }

    # ========================================================
    # VALID STRUCTURED MENU
    # ========================================================

    def test_manager_can_create_valid_structured_menu(
        self
    ):

        response = (
            self.client.post(
                "/api/manager/menus",

                headers=
                    self._manager_a_headers(),

                json=
                    self._menu_payload(),
            )
        )

        self.assertEqual(
            response.status_code,
            201,
            response.get_json(),
        )

        body = (
            response.get_json()
        )

        menu = (
            body["menu"]
        )

        self.assertEqual(
            menu["status"],
            "draft",
        )

        self.assertEqual(
            menu["meal"],
            "lunch",
        )

        self.assertEqual(
            menu["mealCategory"],
            "veg",
        )

        self.assertEqual(
            menu["itemCount"],
            1,
        )

        self.assertEqual(
            menu["items"][0]["name"],
            "Dal Tadka",
        )

        self.assertEqual(
            (
                menu[
                    "items"
                ][0][
                    "quantityPerStudent"
                ]
            ),
            150.0,
        )

        with self.app.app_context():

            saved = (
                db.session.get(
                    Menu,
                    menu["id"],
                )
            )

            self.assertIsNotNone(
                saved
            )

            self.assertEqual(
                saved.created_by,
                self.manager_a_id,
            )

            self.assertEqual(
                saved.menu_items,
                "Dal Tadka",
            )

            self.assertEqual(
                (
                    MenuMenuItem.query
                    .filter_by(
                        menu_id=
                            saved.id
                    )
                    .count()
                ),
                1,
            )

    # ========================================================
    # FUTURE STATUS / DUPLICATE PROTECTION
    # ========================================================

    def test_future_menu_is_scheduled_and_duplicate_is_prevented(
        self
    ):

        payload = (
            self._menu_payload(
                menu_date=
                    "2026-09-13",

                meal=
                    "breakfast",
            )
        )

        first = (
            self.client.post(
                "/api/manager/menus",

                headers=
                    self._manager_a_headers(),

                json=
                    payload,
            )
        )

        self.assertEqual(
            first.status_code,
            201,
            first.get_json(),
        )

        self.assertEqual(
            (
                first.get_json()[
                    "menu"
                ][
                    "status"
                ]
            ),
            "scheduled",
        )

        second = (
            self.client.post(
                "/api/manager/menus",

                headers=
                    self._manager_a_headers(),

                json=
                    payload,
            )
        )

        self.assertEqual(
            second.status_code,
            409,
            second.get_json(),
        )

        self.assertIn(
            "existingMenuId",
            second.get_json(),
        )

        with self.app.app_context():

            count = (
                Menu.query
                .filter_by(
                    hostel_id=
                        self.hostel_a_id,

                    mess_unit_id=
                        self.mess_a_id,

                    menu_date=
                        date(
                            2026,
                            9,
                            13,
                        ),

                    meal=
                        "breakfast",

                    meal_category=
                        "veg",
                )
                .count()
            )

            self.assertEqual(
                count,
                1,
            )

    # ========================================================
    # MANAGER MENU ISOLATION
    # ========================================================

    def test_manager_lists_only_own_menus(
        self
    ):

        response = (
            self.client.get(
                "/api/manager/menus",

                headers=
                    self._manager_a_headers(),
            )
        )

        self.assertEqual(
            response.status_code,
            200,
            response.get_json(),
        )

        menu_ids = {
            item["id"]
            for item
            in response.get_json()[
                "menus"
            ]
        }

        self.assertIn(
            self.history_a_veg_id,
            menu_ids,
        )

        self.assertIn(
            self.history_a_nonveg_id,
            menu_ids,
        )

        self.assertNotIn(
            self.menu_b_id,
            menu_ids,
        )

    # ========================================================
    # CROSS MANAGER / IDOR
    # ========================================================

    def test_cross_manager_menu_and_template_access_is_denied(
        self
    ):

        headers = (
            self._manager_a_headers()
        )

        menu_requests = [
            self.client.get(
                (
                    "/api/manager/menus/"
                    f"{self.menu_b_id}"
                ),
                headers=headers,
            ),

            self.client.put(
                (
                    "/api/manager/menus/"
                    f"{self.menu_b_id}"
                ),
                headers=headers,
                json={
                    "date":
                        "2026-09-10",
                },
            ),

            self.client.post(
                (
                    "/api/manager/menus/"
                    f"{self.menu_b_id}"
                    "/publish"
                ),
                headers=headers,
                json={},
            ),

            self.client.post(
                (
                    "/api/manager/menus/"
                    f"{self.menu_b_id}"
                    "/copy"
                ),
                headers=headers,
                json={
                    "date":
                        "2026-09-14",
                },
            ),

            self.client.delete(
                (
                    "/api/manager/menus/"
                    f"{self.menu_b_id}"
                ),
                headers=headers,
                json={
                    "confirmation":
                        "DELETE",
                },
            ),
        ]

        for response in menu_requests:

            self.assertEqual(
                response.status_code,
                404,
                response.get_json(),
            )

        template_requests = [
            self.client.get(
                (
                    "/api/manager/"
                    "menu-templates/"
                    f"{self.template_b_id}"
                ),
                headers=headers,
            ),

            self.client.put(
                (
                    "/api/manager/"
                    "menu-templates/"
                    f"{self.template_b_id}"
                ),
                headers=headers,
                json={
                    "name":
                        "Changed",
                },
            ),

            self.client.post(
                (
                    "/api/manager/"
                    "menu-templates/"
                    f"{self.template_b_id}"
                    "/use"
                ),
                headers=headers,
                json={
                    "hostelId":
                        self.hostel_a_id,

                    "messUnitId":
                        self.mess_a_id,

                    "date":
                        "2026-09-15",
                },
            ),

            self.client.delete(
                (
                    "/api/manager/"
                    "menu-templates/"
                    f"{self.template_b_id}"
                ),
                headers=headers,
                json={
                    "confirmation":
                        "DELETE",
                },
            ),
        ]

        for response in template_requests:

            self.assertEqual(
                response.status_code,
                404,
                response.get_json(),
            )

        with self.app.app_context():

            self.assertIsNotNone(
                db.session.get(
                    Menu,
                    self.menu_b_id,
                )
            )

            self.assertIsNotNone(
                db.session.get(
                    MenuTemplate,
                    self.template_b_id,
                )
            )

    # ========================================================
    # CUSTOM FOOD ITEM ISOLATION
    # ========================================================

    def test_custom_food_item_is_private_to_creating_manager(
        self
    ):

        create_response = (
            self.client.post(
                "/api/manager/menu-items",

                headers=
                    self._manager_a_headers(),

                json={
                    "name":
                        "Manager A Special Curry",

                    "type":
                        "Curry",

                    "mealCategory":
                        "veg",

                    "defaultQuantity":
                        120,

                    "defaultUnit":
                        "g",

                    "caloriesPerServing":
                        190,
                },
            )
        )

        self.assertEqual(
            create_response.status_code,
            201,
            create_response.get_json(),
        )

        custom_id = (
            create_response
            .get_json()[
                "item"
            ][
                "id"
            ]
        )

        manager_a_response = (
            self.client.get(
                "/api/manager/menu-items",

                headers=
                    self._manager_a_headers(),
            )
        )

        manager_b_response = (
            self.client.get(
                "/api/manager/menu-items",

                headers=
                    self._headers(
                        self.manager_b_token
                    ),
            )
        )

        self.assertEqual(
            manager_a_response.status_code,
            200,
        )

        self.assertEqual(
            manager_b_response.status_code,
            200,
        )

        manager_a_ids = {
            item["id"]
            for item
            in manager_a_response
            .get_json()[
                "items"
            ]
        }

        manager_b_ids = {
            item["id"]
            for item
            in manager_b_response
            .get_json()[
                "items"
            ]
        }

        self.assertIn(
            custom_id,
            manager_a_ids,
        )

        self.assertNotIn(
            custom_id,
            manager_b_ids,
        )

        # Global food items are visible to both Managers.
        self.assertIn(
            self.global_veg_item_id,
            manager_a_ids,
        )

        self.assertIn(
            self.global_veg_item_id,
            manager_b_ids,
        )

        # Manager A cannot see Manager B's private item.
        self.assertNotIn(
            self.manager_b_private_item_id,
            manager_a_ids,
        )

    # ========================================================
    # PUBLISH / UNPUBLISH
    # ========================================================

    def test_publish_targets_only_assigned_audience_and_does_not_duplicate(
        self
    ):

        create_response = (
            self.client.post(
                "/api/manager/menus",

                headers=
                    self._manager_a_headers(),

                json=
                    self._menu_payload(
                        menu_date=
                            "2026-09-12",

                        meal=
                            "snacks",
                    ),
            )
        )

        self.assertEqual(
            create_response.status_code,
            201,
            create_response.get_json(),
        )

        menu_id = (
            create_response
            .get_json()[
                "menu"
            ][
                "id"
            ]
        )

        # ----------------------------------------------------
        # Publish
        # ----------------------------------------------------

        publish_response = (
            self.client.post(
                (
                    "/api/manager/menus/"
                    f"{menu_id}/publish"
                ),

                headers=
                    self._manager_a_headers(),

                json={},
            )
        )

        self.assertEqual(
            publish_response.status_code,
            200,
            publish_response.get_json(),
        )

        self.assertEqual(
            (
                publish_response
                .get_json()[
                    "menu"
                ][
                    "status"
                ]
            ),
            "published",
        )

        with self.app.app_context():

            menu = (
                db.session.get(
                    Menu,
                    menu_id,
                )
            )

            self.assertEqual(
                menu.published_by,
                self.manager_a_id,
            )

            self.assertIsNotNone(
                menu.published_at
            )

            notifications = (
                MenuNotification.query
                .filter_by(
                    menu_id=
                        menu_id,

                    notification_type=
                        "menu_published",
                )
                .all()
            )

            recipient_ids = {
                item.recipient_user_id
                for item
                in notifications
            }

            # Veg Student + all Staff assigned to this
            # Hostel/Mess Unit should receive this Veg Menu.
            self.assertEqual(
                recipient_ids,
                {
                    self.student_a_veg_id,
                    self.staff_a_id,
                },
            )

            # Non-Veg Student in same Mess should not receive
            # the Veg Menu.
            self.assertNotIn(
                self.student_a_nonveg_id,
                recipient_ids,
            )

            # Manager B's audience must never receive it.
            self.assertNotIn(
                self.student_b_veg_id,
                recipient_ids,
            )

            self.assertNotIn(
                self.staff_b_id,
                recipient_ids,
            )

        # ----------------------------------------------------
        # Publish same Menu again.
        #
        # It must not create duplicate audience notifications.
        # ----------------------------------------------------

        second_publish = (
            self.client.post(
                (
                    "/api/manager/menus/"
                    f"{menu_id}/publish"
                ),

                headers=
                    self._manager_a_headers(),

                json={},
            )
        )

        self.assertEqual(
            second_publish.status_code,
            200,
            second_publish.get_json(),
        )

        with self.app.app_context():

            notification_count = (
                MenuNotification.query
                .filter_by(
                    menu_id=
                        menu_id,

                    notification_type=
                        "menu_published",
                )
                .count()
            )

            self.assertEqual(
                notification_count,
                2,
            )

        # ----------------------------------------------------
        # Unpublish
        # ----------------------------------------------------

        unpublish_response = (
            self.client.post(
                (
                    "/api/manager/menus/"
                    f"{menu_id}/unpublish"
                ),

                headers=
                    self._manager_a_headers(),

                json={},
            )
        )

        self.assertEqual(
            unpublish_response.status_code,
            200,
            unpublish_response.get_json(),
        )

        self.assertEqual(
            (
                unpublish_response
                .get_json()[
                    "menu"
                ][
                    "status"
                ]
            ),
            "unpublished",
        )

        with self.app.app_context():

            self.assertEqual(
                (
                    MenuNotification.query
                    .filter_by(
                        menu_id=
                            menu_id,

                        notification_type=
                            "menu_published",
                    )
                    .count()
                ),
                0,
            )

    # ========================================================
    # MENU HISTORY
    # ========================================================

    def test_menu_history_filters_and_pagination_are_tenant_scoped(
        self
    ):

        response = (
            self.client.get(
                (
                    "/api/manager/menus/history"
                    "?meal=breakfast"
                    "&meal_category=veg"
                    "&status=draft"
                    "&page=1"
                    "&limit=1"
                ),

                headers=
                    self._manager_a_headers(),
            )
        )

        self.assertEqual(
            response.status_code,
            200,
            response.get_json(),
        )

        body = (
            response.get_json()
        )

        self.assertEqual(
            body[
                "retentionDays"
            ],
            40,
        )

        self.assertEqual(
            body[
                "pagination"
            ][
                "total"
            ],
            1,
        )

        self.assertEqual(
            len(
                body["menus"]
            ),
            1,
        )

        self.assertEqual(
            body[
                "menus"
            ][0][
                "id"
            ],
            self.history_a_veg_id,
        )

        self.assertNotEqual(
            body[
                "menus"
            ][0][
                "id"
            ],
            self.menu_b_id,
        )

    # ========================================================
    # COPY PREVIOUS MENU
    # ========================================================

    def test_copy_previous_menu_creates_new_draft_without_changing_source(
        self
    ):

        response = (
            self.client.post(
                (
                    "/api/manager/menus/"
                    f"{self.history_a_veg_id}"
                    "/copy"
                ),

                headers=
                    self._manager_a_headers(),

                json={
                    "date":
                        "2026-09-14",

                    "hostelId":
                        self.hostel_a_id,

                    "messUnitId":
                        self.mess_a_id,
                },
            )
        )

        self.assertEqual(
            response.status_code,
            201,
            response.get_json(),
        )

        copied = (
            response.get_json()[
                "menu"
            ]
        )

        self.assertNotEqual(
            copied["id"],
            self.history_a_veg_id,
        )

        self.assertEqual(
            copied["status"],
            "draft",
        )

        self.assertEqual(
            copied["date"],
            "2026-09-14",
        )

        self.assertEqual(
            copied["itemCount"],
            1,
        )

        self.assertEqual(
            copied["items"][0]["name"],
            "Dal Tadka",
        )

        with self.app.app_context():

            source = (
                db.session.get(
                    Menu,
                    self.history_a_veg_id,
                )
            )

            self.assertIsNotNone(
                source
            )

            self.assertEqual(
                source.menu_date,
                date(
                    2026,
                    9,
                    10,
                ),
            )

            self.assertEqual(
                source.status,
                "draft",
            )

    # ========================================================
    # TEMPLATE CREATE / UPDATE / USE / DELETE
    # ========================================================

    def test_template_create_update_use_and_secure_delete(
        self
    ):

        # ----------------------------------------------------
        # Create Template
        # ----------------------------------------------------

        create_response = (
            self.client.post(
                "/api/manager/menu-templates",

                headers=
                    self._manager_a_headers(),

                json={
                    "name":
                        "Veg Breakfast Standard",

                    "meal":
                        "breakfast",

                    "mealCategory":
                        "veg",

                    "description":
                        "Reusable breakfast",

                    "isActive":
                        True,

                    "items": [
                        {
                            "menuItemId":
                                self.global_veg_item_id,

                            "quantityPerStudent":
                                150,

                            "unit":
                                "g",
                        }
                    ],
                },
            )
        )

        self.assertEqual(
            create_response.status_code,
            201,
            create_response.get_json(),
        )

        template_id = (
            create_response
            .get_json()[
                "template"
            ][
                "id"
            ]
        )

        # ----------------------------------------------------
        # Manager's Template list
        # ----------------------------------------------------

        list_response = (
            self.client.get(
                "/api/manager/menu-templates",

                headers=
                    self._manager_a_headers(),
            )
        )

        self.assertEqual(
            list_response.status_code,
            200,
            list_response.get_json(),
        )

        listed_ids = {
            item["id"]
            for item
            in list_response
            .get_json()[
                "templates"
            ]
        }

        self.assertIn(
            template_id,
            listed_ids,
        )

        self.assertNotIn(
            self.template_b_id,
            listed_ids,
        )

        # ----------------------------------------------------
        # Update quantity
        # ----------------------------------------------------

        update_response = (
            self.client.put(
                (
                    "/api/manager/"
                    "menu-templates/"
                    f"{template_id}"
                ),

                headers=
                    self._manager_a_headers(),

                json={
                    "description":
                        "Updated breakfast template",

                    "items": [
                        {
                            "menuItemId":
                                self.global_veg_item_id,

                            "quantityPerStudent":
                                175,

                            "unit":
                                "g",
                        }
                    ],
                },
            )
        )

        self.assertEqual(
            update_response.status_code,
            200,
            update_response.get_json(),
        )

        self.assertEqual(
            (
                update_response
                .get_json()[
                    "template"
                ][
                    "items"
                ][0][
                    "quantityPerStudent"
                ]
            ),
            175.0,
        )

        # ----------------------------------------------------
        # Use Template
        # ----------------------------------------------------

        use_response = (
            self.client.post(
                (
                    "/api/manager/"
                    "menu-templates/"
                    f"{template_id}"
                    "/use"
                ),

                headers=
                    self._manager_a_headers(),

                json={
                    "hostelId":
                        self.hostel_a_id,

                    "messUnitId":
                        self.mess_a_id,

                    "date":
                        "2026-09-15",
                },
            )
        )

        self.assertEqual(
            use_response.status_code,
            201,
            use_response.get_json(),
        )

        created_menu_id = (
            use_response
            .get_json()[
                "menu"
            ][
                "id"
            ]
        )

        self.assertEqual(
            (
                use_response
                .get_json()[
                    "menu"
                ][
                    "status"
                ]
            ),
            "scheduled",
        )

        # ----------------------------------------------------
        # Incorrect DELETE confirmation
        # ----------------------------------------------------

        invalid_delete = (
            self.client.delete(
                (
                    "/api/manager/"
                    "menu-templates/"
                    f"{template_id}"
                ),

                headers=
                    self._manager_a_headers(),

                json={
                    "confirmation":
                        "delete",
                },
            )
        )

        self.assertEqual(
            invalid_delete.status_code,
            400,
            invalid_delete.get_json(),
        )

        with self.app.app_context():

            self.assertIsNotNone(
                db.session.get(
                    MenuTemplate,
                    template_id,
                )
            )

        # ----------------------------------------------------
        # Exact uppercase DELETE
        # ----------------------------------------------------

        valid_delete = (
            self.client.delete(
                (
                    "/api/manager/"
                    "menu-templates/"
                    f"{template_id}"
                ),

                headers=
                    self._manager_a_headers(),

                json={
                    "confirmation":
                        "DELETE",
                },
            )
        )

        self.assertEqual(
            valid_delete.status_code,
            200,
            valid_delete.get_json(),
        )

        with self.app.app_context():

            self.assertIsNone(
                db.session.get(
                    MenuTemplate,
                    template_id,
                )
            )

            # Menu created from Template must remain.
            self.assertIsNotNone(
                db.session.get(
                    Menu,
                    created_menu_id,
                )
            )

    # ========================================================
    # MANUAL MENU DELETE
    # ========================================================

    def test_menu_delete_requires_exact_delete_and_removes_direct_dependencies(
        self
    ):

        # ----------------------------------------------------
        # Add one direct MealResponse dependency.
        # ----------------------------------------------------

        with self.app.app_context():

            meal_response = (
                MealResponse(
                    menu_id=
                        self.history_a_veg_id,

                    student_user_id=
                        self.student_a_veg_id,

                    mess_unit_id=
                        self.mess_a_id,

                    response=
                        "attending",
                )
            )

            db.session.add(
                meal_response
            )

            db.session.commit()

            response_id = (
                meal_response.id
            )

        # ----------------------------------------------------
        # Trailing space must be rejected.
        # ----------------------------------------------------

        invalid_response = (
            self.client.delete(
                (
                    "/api/manager/menus/"
                    f"{self.history_a_veg_id}"
                ),

                headers=
                    self._manager_a_headers(),

                json={
                    "confirmation":
                        "DELETE ",
                },
            )
        )

        self.assertEqual(
            invalid_response.status_code,
            400,
            invalid_response.get_json(),
        )

        with self.app.app_context():

            self.assertIsNotNone(
                db.session.get(
                    Menu,
                    self.history_a_veg_id,
                )
            )

            self.assertIsNotNone(
                db.session.get(
                    MealResponse,
                    response_id,
                )
            )

        # ----------------------------------------------------
        # Exact confirmation deletes Menu + direct dependencies.
        # ----------------------------------------------------

        valid_response = (
            self.client.delete(
                (
                    "/api/manager/menus/"
                    f"{self.history_a_veg_id}"
                ),

                headers=
                    self._manager_a_headers(),

                json={
                    "confirmation":
                        "DELETE",
                },
            )
        )

        self.assertEqual(
            valid_response.status_code,
            200,
            valid_response.get_json(),
        )

        with self.app.app_context():

            self.assertIsNone(
                db.session.get(
                    Menu,
                    self.history_a_veg_id,
                )
            )

            self.assertIsNone(
                db.session.get(
                    MealResponse,
                    response_id,
                )
            )

            self.assertEqual(
                (
                    MenuMenuItem.query
                    .filter_by(
                        menu_id=
                            self.history_a_veg_id
                    )
                    .count()
                ),
                0,
            )

            # Food-item master record must survive Menu deletion.
            self.assertIsNotNone(
                db.session.get(
                    MenuItem,
                    self.global_veg_item_id,
                )
            )

            # Another Manager's Menu must remain untouched.
            self.assertIsNotNone(
                db.session.get(
                    Menu,
                    self.menu_b_id,
                )
            )


if __name__ == "__main__":

    unittest.main(
        verbosity=2
    )