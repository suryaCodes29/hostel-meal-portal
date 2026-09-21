import sys
import unittest

from datetime import date
from pathlib import Path


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


# ============================================================
# IMPORT APPLICATION COMPONENTS
# ============================================================

from flask import Flask

from flask_jwt_extended import (
    JWTManager,
    create_access_token,
)

from werkzeug.security import (
    generate_password_hash,
)


from models import (
    db,
    Forecast,
    Hostel,
    HostelBlock,
    MealResponse,
    Menu,
    MessUnit,
    Notification,
    User,
    WasteRecord,
)

from routes.manager_routes import (
    manager_bp,
)


# ============================================================
# MANAGER TENANT ISOLATION INTEGRATION TESTS
# ============================================================

class ManagerTenantIsolationTestCase(
    unittest.TestCase
):

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

            JWT_SECRET_KEY=
                "tenant-isolation-test-secret",

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


        self.client = (
            self.app.test_client()
        )


        with self.app.app_context():

            db.create_all()


            self._seed_data()


            self.tokens = {

                "a":
                    create_access_token(
                        identity=str(
                            self.manager_a_id
                        )
                    ),

                "b":
                    create_access_token(
                        identity=str(
                            self.manager_b_id
                        )
                    ),

                "c":
                    create_access_token(
                        identity=str(
                            self.manager_c_id
                        )
                    ),

                "student":
                    create_access_token(
                        identity=str(
                            self.student_a_id
                        )
                    ),
            }


    # ========================================================
    # TEARDOWN
    # ========================================================

    def tearDown(self):

        with self.app.app_context():

            db.session.remove()

            db.drop_all()


    # ========================================================
    # USER FACTORIES
    # ========================================================

    def _manager(
        self,
        name,
        manager_code,
        email,
        mobile,
    ):

        return User(

            name=
                name,

            manager_id=
                manager_code,

            student_id=
                None,

            staff_id=
                None,

            email=
                email,

            mobile=
                mobile,

            password_hash=
                generate_password_hash(
                    "Manager@123"
                ),

            role=
                "manager",

            staff_role=
                None,

            hostel=
                None,

            hostel_block=
                None,

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
                False,
        )


    def _student(
        self,
        name,
        student_code,
        email,
        mobile,
        hostel,
        block,
        mess,
        category,
    ):

        return User(

            name=
                name,

            manager_id=
                None,

            student_id=
                student_code,

            staff_id=
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

            staff_role=
                None,

            hostel=
                hostel.name,

            hostel_block=
                block.name,

            mess_unit=
                mess.name,

            meal_category=
                category,

            hostel_id=
                hostel.id,

            block_id=
                block.id,

            mess_unit_id=
                mess.id,

            is_active=
                True,

            must_change_password=
                False,
        )


    def _staff(
        self,
        name,
        staff_code,
        email,
        mobile,
        hostel,
        block,
        mess,
    ):

        return User(

            name=
                name,

            manager_id=
                None,

            student_id=
                None,

            staff_id=
                staff_code,

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
                "Cook",

            hostel=
                hostel.name,

            hostel_block=
                block.name,

            mess_unit=
                mess.name,

            meal_category=
                None,

            hostel_id=
                hostel.id,

            block_id=
                block.id,

            mess_unit_id=
                mess.id,

            is_active=
                True,

            must_change_password=
                False,
        )


    # ========================================================
    # SEED THREE INDEPENDENT TENANTS
    # ========================================================

    def _seed_data(self):

        # ----------------------------------------------------
        # MANAGERS
        # ----------------------------------------------------

        manager_a = self._manager(

            "Manager A",

            "MGR-A",

            "manager.a@test.local",

            "9000000001",
        )


        manager_b = self._manager(

            "Manager B",

            "MGR-B",

            "manager.b@test.local",

            "9000000002",
        )


        manager_c = self._manager(

            "Manager C",

            "MGR-C",

            "manager.c@test.local",

            "9000000003",
        )


        db.session.add_all([
            manager_a,
            manager_b,
            manager_c,
        ])


        db.session.flush()


        self.manager_a_id = (
            manager_a.id
        )


        self.manager_b_id = (
            manager_b.id
        )


        self.manager_c_id = (
            manager_c.id
        )


        # ----------------------------------------------------
        # HOSTELS
        # ----------------------------------------------------

        hostel_a = Hostel(

            manager_user_id=
                manager_a.id,

            name=
                "Krishna Hostel",

            code=
                "KRI-A",

            address=
                "Manager A Campus",

            contact_number=
                "9000000011",

            status=
                "active",
        )


        hostel_b = Hostel(

            manager_user_id=
                manager_b.id,

            name=
                "Chandu Hostel",

            code=
                "CHA-B",

            address=
                "Manager B Campus",

            contact_number=
                "9000000012",

            status=
                "active",
        )


        db.session.add_all([
            hostel_a,
            hostel_b,
        ])


        db.session.flush()


        self.hostel_a_id = (
            hostel_a.id
        )


        self.hostel_b_id = (
            hostel_b.id
        )


        # ----------------------------------------------------
        # HOSTEL BLOCKS
        # ----------------------------------------------------

        block_a = HostelBlock(

            hostel_id=
                hostel_a.id,

            name=
                "A Block",

            code=
                "A",

            status=
                "active",
        )


        block_b = HostelBlock(

            hostel_id=
                hostel_b.id,

            name=
                "B Block",

            code=
                "B",

            status=
                "active",
        )


        db.session.add_all([
            block_a,
            block_b,
        ])


        db.session.flush()


        self.block_a_id = (
            block_a.id
        )


        self.block_b_id = (
            block_b.id
        )


        # ----------------------------------------------------
        # MESS UNITS
        # ----------------------------------------------------

        mess_a = MessUnit(

            hostel_id=
                hostel_a.id,

            block_id=
                block_a.id,

            name=
                "Krishna North Mess",

            unit_type=
                "north",

            supported_categories=
                "both",

            capacity=
                300,

            supervisor_user_id=
                None,

            status=
                "active",
        )


        mess_b = MessUnit(

            hostel_id=
                hostel_b.id,

            block_id=
                block_b.id,

            name=
                "Chandu South Mess",

            unit_type=
                "south",

            supported_categories=
                "both",

            capacity=
                250,

            supervisor_user_id=
                None,

            status=
                "active",
        )


        db.session.add_all([
            mess_a,
            mess_b,
        ])


        db.session.flush()


        self.mess_a_id = (
            mess_a.id
        )


        self.mess_b_id = (
            mess_b.id
        )


        # ----------------------------------------------------
        # STUDENTS
        # ----------------------------------------------------

        student_a = self._student(

            "Alpha Student",

            "STU-A-001",

            "alpha.student@test.local",

            "9000000021",

            hostel_a,

            block_a,

            mess_a,

            "veg",
        )


        student_b = self._student(

            "Beta Student",

            "STU-B-001",

            "beta.student@test.local",

            "9000000022",

            hostel_b,

            block_b,

            mess_b,

            "non-veg",
        )


        db.session.add_all([
            student_a,
            student_b,
        ])


        db.session.flush()


        self.student_a_id = (
            student_a.id
        )


        self.student_b_id = (
            student_b.id
        )


        # ----------------------------------------------------
        # STAFF
        # ----------------------------------------------------

        staff_a = self._staff(

            "Alpha Cook",

            "STF-A-001",

            "alpha.staff@test.local",

            "9000000031",

            hostel_a,

            block_a,

            mess_a,
        )


        staff_b = self._staff(

            "Beta Cook",

            "STF-B-001",

            "beta.staff@test.local",

            "9000000032",

            hostel_b,

            block_b,

            mess_b,
        )


        db.session.add_all([
            staff_a,
            staff_b,
        ])


        db.session.flush()


        self.staff_a_id = (
            staff_a.id
        )


        self.staff_b_id = (
            staff_b.id
        )


        # ----------------------------------------------------
        # MENUS
        # ----------------------------------------------------

        menu_a = Menu(

            hostel_id=
                hostel_a.id,

            mess_unit_id=
                mess_a.id,

            menu_date=
                date.today(),

            meal=
                "lunch",

            meal_category=
                "veg",

            menu_items=
                "Rice, Dal, Curry",

            status=
                "published",

            created_by=
                manager_a.id,
        )


        menu_b = Menu(

            hostel_id=
                hostel_b.id,

            mess_unit_id=
                mess_b.id,

            menu_date=
                date.today(),

            meal=
                "dinner",

            meal_category=
                "non-veg",

            menu_items=
                "Rice, Chicken Curry",

            status=
                "published",

            created_by=
                manager_b.id,
        )


        db.session.add_all([
            menu_a,
            menu_b,
        ])


        db.session.flush()


        self.menu_a_id = (
            menu_a.id
        )


        self.menu_b_id = (
            menu_b.id
        )


        # ----------------------------------------------------
        # OPERATIONAL DATA
        # ----------------------------------------------------

        db.session.add_all([

            MealResponse(

                menu_id=
                    menu_a.id,

                student_user_id=
                    student_a.id,

                mess_unit_id=
                    mess_a.id,

                response=
                    "attending",
            ),


            MealResponse(

                menu_id=
                    menu_b.id,

                student_user_id=
                    student_b.id,

                mess_unit_id=
                    mess_b.id,

                response=
                    "skipping",
            ),


            Forecast(

                hostel_id=
                    hostel_a.id,

                mess_unit_id=
                    mess_a.id,

                forecast_date=
                    date.today(),

                meal=
                    "lunch",

                meal_category=
                    "veg",

                predicted_students=
                    11,

                actual_students=
                    10,

                preparation_status=
                    "planned",
            ),


            Forecast(

                hostel_id=
                    hostel_b.id,

                mess_unit_id=
                    mess_b.id,

                forecast_date=
                    date.today(),

                meal=
                    "dinner",

                meal_category=
                    "non-veg",

                predicted_students=
                    21,

                actual_students=
                    20,

                preparation_status=
                    "planned",
            ),


            WasteRecord(

                hostel_id=
                    hostel_a.id,

                mess_unit_id=
                    mess_a.id,

                record_date=
                    date.today(),

                meal=
                    "lunch",

                meal_category=
                    "veg",

                quantity_prepared=
                    12,

                quantity_served=
                    10,

                waste_kg=
                    1.25,

                students_served=
                    10,

                shortage_occurred=
                    False,
            ),


            WasteRecord(

                hostel_id=
                    hostel_b.id,

                mess_unit_id=
                    mess_b.id,

                record_date=
                    date.today(),

                meal=
                    "dinner",

                meal_category=
                    "non-veg",

                quantity_prepared=
                    22,

                quantity_served=
                    20,

                waste_kg=
                    2.50,

                students_served=
                    20,

                shortage_occurred=
                    False,
            ),


            Notification(

                manager_user_id=
                    manager_a.id,

                notification_type=
                    "menu",

                title=
                    "Manager A Menu",

                message=
                    "Krishna Hostel menu was published.",

                is_read=
                    False,
            ),


            Notification(

                manager_user_id=
                    manager_b.id,

                notification_type=
                    "forecast",

                title=
                    "Manager B Forecast",

                message=
                    "Chandu Hostel forecast was updated.",

                is_read=
                    False,
            ),
        ])


        db.session.commit()


    # ========================================================
    # REQUEST HELPERS
    # ========================================================

    def _headers(
        self,
        key,
    ):

        return {
            "Authorization":
                f"Bearer {self.tokens[key]}"
        }


    def _get(
        self,
        key,
        path,
    ):

        return self.client.get(

            path,

            headers=
                self._headers(
                    key
                ),
        )


    def _post(
        self,
        key,
        path,
        payload,
    ):

        return self.client.post(

            path,

            json=
                payload,

            headers=
                self._headers(
                    key
                ),
        )


    def _put(
        self,
        key,
        path,
        payload,
    ):

        return self.client.put(

            path,

            json=
                payload,

            headers=
                self._headers(
                    key
                ),
        )


    def _patch(
        self,
        key,
        path,
        payload,
    ):

        return self.client.patch(

            path,

            json=
                payload,

            headers=
                self._headers(
                    key
                ),
        )


    def _delete(
        self,
        key,
        path,
    ):

        return self.client.delete(

            path,

            headers=
                self._headers(
                    key
                ),
        )


    def assert_forbidden_or_not_found(
        self,
        response,
    ):

        self.assertIn(

            response.status_code,

            (
                403,
                404,
            ),

            msg=(
                "Cross-tenant access must return "
                "403 or 404. "
                f"Received {response.status_code}: "
                f"{response.get_data(as_text=True)}"
            ),
        )


    # ========================================================
    # TEST 1
    # MANAGER A CAN SEE ONLY MANAGER A DATA
    # ========================================================

    def test_manager_a_only_sees_manager_a_data(
        self
    ):

        hostels = (
            self._get(
                "a",
                "/api/manager/hostels",
            )
            .get_json()[
                "hostels"
            ]
        )


        students = (
            self._get(
                "a",
                "/api/manager/students?limit=100",
            )
            .get_json()[
                "students"
            ]
        )


        staff = (
            self._get(
                "a",
                "/api/manager/staff",
            )
            .get_json()[
                "staff"
            ]
        )


        mess_units = (
            self._get(
                "a",
                "/api/manager/mess-units",
            )
            .get_json()[
                "messUnits"
            ]
        )


        self.assertEqual(
            {
                row["id"]
                for row
                in hostels
            },
            {
                self.hostel_a_id
            },
        )


        self.assertEqual(
            {
                row["id"]
                for row
                in students
            },
            {
                self.student_a_id
            },
        )


        self.assertEqual(
            {
                row["id"]
                for row
                in staff
            },
            {
                self.staff_a_id
            },
        )


        self.assertEqual(
            {
                row["id"]
                for row
                in mess_units
            },
            {
                self.mess_a_id
            },
        )


    # ========================================================
    # TEST 2
    # MANAGER B CAN SEE ONLY MANAGER B DATA
    # ========================================================

    def test_manager_b_only_sees_manager_b_data(
        self
    ):

        hostels = (
            self._get(
                "b",
                "/api/manager/hostels",
            )
            .get_json()[
                "hostels"
            ]
        )


        students = (
            self._get(
                "b",
                "/api/manager/students?limit=100",
            )
            .get_json()[
                "students"
            ]
        )


        staff = (
            self._get(
                "b",
                "/api/manager/staff",
            )
            .get_json()[
                "staff"
            ]
        )


        mess_units = (
            self._get(
                "b",
                "/api/manager/mess-units",
            )
            .get_json()[
                "messUnits"
            ]
        )


        self.assertEqual(
            {
                row["id"]
                for row
                in hostels
            },
            {
                self.hostel_b_id
            },
        )


        self.assertEqual(
            {
                row["id"]
                for row
                in students
            },
            {
                self.student_b_id
            },
        )


        self.assertEqual(
            {
                row["id"]
                for row
                in staff
            },
            {
                self.staff_b_id
            },
        )


        self.assertEqual(
            {
                row["id"]
                for row
                in mess_units
            },
            {
                self.mess_b_id
            },
        )


    # ========================================================
    # TEST 3
    # MANAGER C HAS NO HOSTELS
    # ========================================================

    def test_manager_c_receives_empty_data_and_zero_overview(
        self
    ):

        collection_endpoints = [

            (
                "/api/manager/hostels",
                "hostels",
            ),

            (
                "/api/manager/mess-units",
                "messUnits",
            ),

            (
                "/api/manager/students?limit=100",
                "students",
            ),

            (
                "/api/manager/staff",
                "staff",
            ),

            (
                "/api/manager/menus",
                "menus",
            ),

            (
                "/api/manager/forecasts",
                "forecasts",
            ),

            (
                "/api/manager/notifications",
                "notifications",
            ),
        ]


        for (
            path,
            key,
        ) in collection_endpoints:

            with self.subTest(
                path=path
            ):

                response = (
                    self._get(
                        "c",
                        path,
                    )
                )


                self.assertEqual(
                    response.status_code,
                    200,
                    response.get_data(
                        as_text=True
                    ),
                )


                self.assertEqual(
                    response
                    .get_json()
                    .get(
                        key,
                        []
                    ),
                    [],
                )


        overview = (
            self._get(
                "c",
                "/api/manager/overview",
            )
        )


        self.assertEqual(
            overview.status_code,
            200,
            overview.get_data(
                as_text=True
            ),
        )


        summary = (
            overview
            .get_json()
            .get(
                "summary",
                {}
            )
        )


        for key in (

            "totalStudents",

            "activeStaff",

            "activeMessUnits",

            "mealsServedToday",

            "todayResponses",

            "todayWaste",
        ):

            self.assertEqual(
                float(
                    summary.get(
                        key,
                        0
                    )
                ),
                0.0,
                key,
            )


    # ========================================================
    # TEST 4
    # SEARCH MUST REMAIN MANAGER-SCOPED
    # ========================================================

    def test_search_is_scoped_to_current_manager(
        self
    ):

        manager_a_search = (
            self._get(
                "a",
                (
                    "/api/manager/students"
                    "?search=Beta"
                    "&limit=100"
                ),
            )
        )


        manager_b_search = (
            self._get(
                "b",
                (
                    "/api/manager/students"
                    "?search=Alpha"
                    "&limit=100"
                ),
            )
        )


        self.assertEqual(
            manager_a_search.status_code,
            200,
        )


        self.assertEqual(
            manager_b_search.status_code,
            200,
        )


        self.assertEqual(
            manager_a_search
            .get_json()[
                "students"
            ],
            [],
        )


        self.assertEqual(
            manager_b_search
            .get_json()[
                "students"
            ],
            [],
        )


    # ========================================================
    # TEST 5
    # "ALL" FILTERS ARE STILL TENANT-SCOPED
    # ========================================================

    def test_all_filters_stay_inside_current_manager_scope(
        self
    ):

        students = (
            self._get(
                "a",
                (
                    "/api/manager/students"
                    "?meal_category=all"
                    "&limit=100"
                ),
            )
            .get_json()[
                "students"
            ]
        )


        menus = (
            self._get(
                "a",
                (
                    "/api/manager/menus"
                    "?meal_category=all"
                ),
            )
            .get_json()[
                "menus"
            ]
        )


        forecasts = (
            self._get(
                "a",
                (
                    "/api/manager/forecasts"
                    "?meal_category=all"
                ),
            )
            .get_json()[
                "forecasts"
            ]
        )


        self.assertEqual(
            {
                row["id"]
                for row
                in students
            },
            {
                self.student_a_id
            },
        )


        self.assertEqual(
            {
                row["id"]
                for row
                in menus
            },
            {
                self.menu_a_id
            },
        )


        self.assertEqual(
            len(
                forecasts
            ),
            1,
        )


        self.assertEqual(
            forecasts[0][
                "hostel"
            ],
            "Krishna Hostel",
        )


    # ========================================================
    # TEST 6
    # STUDENT IDOR PROTECTION
    # ========================================================

    def test_direct_student_idor_returns_403_or_404(
        self
    ):

        assign_response = (
            self._put(

                "a",

                (
                    "/api/manager/students/"
                    f"{self.student_b_id}"
                    "/assign"
                ),

                {
                    "hostelId":
                        self.hostel_a_id,

                    "blockId":
                        self.block_a_id,

                    "messUnitId":
                        self.mess_a_id,

                    "mealCategory":
                        "veg",
                },
            )
        )


        self.assert_forbidden_or_not_found(
            assign_response
        )


        status_response = (
            self._patch(

                "a",

                (
                    "/api/manager/students/"
                    f"{self.student_b_id}"
                    "/status"
                ),

                {
                    "isActive":
                        False
                },
            )
        )


        self.assert_forbidden_or_not_found(
            status_response
        )


        with self.app.app_context():

            student_b = (
                db.session.get(
                    User,
                    self.student_b_id
                )
            )


            self.assertEqual(
                student_b.hostel_id,
                self.hostel_b_id,
            )


            self.assertEqual(
                student_b.mess_unit_id,
                self.mess_b_id,
            )


            self.assertTrue(
                student_b.is_active
            )


    # ========================================================
    # TEST 7
    # CREATE APIS REJECT FOREIGN IDS
    # ========================================================

    def test_create_student_staff_and_menu_reject_foreign_ids(
        self
    ):

        cases = [

            (
                "/api/manager/students",

                {
                    "name":
                        "Cross Student",

                    "email":
                        "cross.student@test.local",

                    "mobile":
                        "9000000091",

                    "hostelId":
                        self.hostel_b_id,

                    "blockId":
                        self.block_b_id,

                    "messUnitId":
                        self.mess_b_id,

                    "mealCategory":
                        "veg",
                },
            ),


            (
                "/api/manager/staff",

                {
                    "name":
                        "Cross Staff",

                    "email":
                        "cross.staff@test.local",

                    "mobile":
                        "9000000092",

                    "staffRole":
                        "Cook",

                    "hostelId":
                        self.hostel_b_id,

                    "blockId":
                        self.block_b_id,

                    "messUnitId":
                        self.mess_b_id,
                },
            ),


            (
                "/api/manager/menus",

                {
                    "hostelId":
                        self.hostel_b_id,

                    "messUnitId":
                        self.mess_b_id,

                    "date":
                        date.today()
                        .isoformat(),

                    "meal":
                        "breakfast",

                    "mealCategory":
                        "veg",

                    "menuItems":
                        "Idli, Sambar",

                    "status":
                        "published",
                },
            ),
        ]


        for (
            path,
            payload,
        ) in cases:

            with self.subTest(
                path=path
            ):

                response = (
                    self._post(
                        "a",
                        path,
                        payload,
                    )
                )


                self.assert_forbidden_or_not_found(
                    response
                )


    # ========================================================
    # TEST 8
    # QUERY PARAMETER IDOR
    # ========================================================

    def test_cross_manager_query_filter_ids_return_403_or_404(
        self
    ):

        paths = [

            (
                "/api/manager/students"
                f"?hostel_id={self.hostel_b_id}"
                "&limit=100"
            ),

            (
                "/api/manager/staff"
                f"?hostel_id={self.hostel_b_id}"
            ),

            (
                "/api/manager/menus"
                f"?hostel_id={self.hostel_b_id}"
            ),

            (
                "/api/manager/forecasts"
                f"?hostel_id={self.hostel_b_id}"
            ),
        ]


        for path in paths:

            with self.subTest(
                path=path
            ):

                response = (
                    self._get(
                        "a",
                        path,
                    )
                )


                self.assert_forbidden_or_not_found(
                    response
                )


    # ========================================================
    # TEST 9
    # MENU IDOR
    # ========================================================

    def test_manager_cannot_delete_other_managers_menu(
        self
    ):

        response = (
            self._delete(

                "a",

                (
                    "/api/manager/menus/"
                    f"{self.menu_b_id}"
                ),
            )
        )


        self.assert_forbidden_or_not_found(
            response
        )


        with self.app.app_context():

            menu_b = (
                db.session.get(
                    Menu,
                    self.menu_b_id
                )
            )


            self.assertIsNotNone(
                menu_b
            )


    # ========================================================
    # TEST 10
    # MENU / FORECAST / NOTIFICATION ISOLATION
    # ========================================================

    def test_operational_pages_are_manager_scoped(
        self
    ):

        menus = (
            self._get(
                "a",
                "/api/manager/menus",
            )
            .get_json()[
                "menus"
            ]
        )


        forecasts = (
            self._get(
                "a",
                "/api/manager/forecasts",
            )
            .get_json()[
                "forecasts"
            ]
        )


        notifications = (
            self._get(
                "a",
                "/api/manager/notifications",
            )
            .get_json()[
                "notifications"
            ]
        )


        self.assertEqual(
            {
                row["id"]
                for row
                in menus
            },
            {
                self.menu_a_id
            },
        )


        self.assertEqual(
            len(
                forecasts
            ),
            1,
        )


        self.assertEqual(
            forecasts[0][
                "hostel"
            ],
            "Krishna Hostel",
        )


        self.assertEqual(
            [
                item["title"]
                for item
                in notifications
            ],
            [
                "Manager A Menu"
            ],
        )


    # ========================================================
    # TEST 11
    # REPORTS + DASHBOARD COUNTS
    # ========================================================

    def test_reports_and_dashboard_counts_match_current_manager(
        self
    ):

        report_a = (
            self._get(
                "a",
                "/api/manager/reports/summary",
            )
        )


        report_b = (
            self._get(
                "b",
                "/api/manager/reports/summary",
            )
        )


        report_c = (
            self._get(
                "c",
                "/api/manager/reports/summary",
            )
        )


        self.assertEqual(
            report_a.status_code,
            200,
            report_a.get_data(
                as_text=True
            ),
        )


        self.assertEqual(
            report_b.status_code,
            200,
            report_b.get_data(
                as_text=True
            ),
        )


        self.assertEqual(
            report_c.status_code,
            200,
            report_c.get_data(
                as_text=True
            ),
        )


        summary_a = (
            report_a
            .get_json()[
                "summary"
            ]
        )


        summary_b = (
            report_b
            .get_json()[
                "summary"
            ]
        )


        summary_c = (
            report_c
            .get_json()[
                "summary"
            ]
        )


        self.assertEqual(
            summary_a[
                "totalMealsServed"
            ],
            10,
        )


        self.assertAlmostEqual(
            float(
                summary_a[
                    "totalFoodWaste"
                ]
            ),
            1.25,
            places=2,
        )


        self.assertEqual(
            summary_b[
                "totalMealsServed"
            ],
            20,
        )


        self.assertAlmostEqual(
            float(
                summary_b[
                    "totalFoodWaste"
                ]
            ),
            2.50,
            places=2,
        )


        self.assertEqual(
            summary_c[
                "totalMealsServed"
            ],
            0,
        )


        self.assertAlmostEqual(
            float(
                summary_c[
                    "totalFoodWaste"
                ]
            ),
            0.0,
            places=2,
        )


        overview_a = (
            self._get(
                "a",
                "/api/manager/overview",
            )
        )


        overview_b = (
            self._get(
                "b",
                "/api/manager/overview",
            )
        )


        self.assertEqual(
            overview_a.status_code,
            200,
        )


        self.assertEqual(
            overview_b.status_code,
            200,
        )


        data_a = (
            overview_a
            .get_json()[
                "summary"
            ]
        )


        data_b = (
            overview_b
            .get_json()[
                "summary"
            ]
        )


        self.assertEqual(
            data_a[
                "totalStudents"
            ],
            1,
        )


        self.assertEqual(
            data_a[
                "activeStaff"
            ],
            1,
        )


        self.assertEqual(
            data_a[
                "activeMessUnits"
            ],
            1,
        )


        self.assertEqual(
            data_a[
                "mealsServedToday"
            ],
            10,
        )


        self.assertEqual(
            data_a[
                "todayResponses"
            ],
            1,
        )


        self.assertAlmostEqual(
            float(
                data_a[
                    "todayWaste"
                ]
            ),
            1.25,
            places=2,
        )


        self.assertEqual(
            data_b[
                "totalStudents"
            ],
            1,
        )


        self.assertEqual(
            data_b[
                "activeStaff"
            ],
            1,
        )


        self.assertEqual(
            data_b[
                "activeMessUnits"
            ],
            1,
        )


        self.assertEqual(
            data_b[
                "mealsServedToday"
            ],
            20,
        )


        self.assertEqual(
            data_b[
                "todayResponses"
            ],
            1,
        )


        self.assertAlmostEqual(
            float(
                data_b[
                    "todayWaste"
                ]
            ),
            2.50,
            places=2,
        )


    # ========================================================
    # TEST 12
    # FILTER OPTIONS
    # ========================================================

    def test_filter_options_are_manager_scoped(
        self
    ):

        manager_a_response = (
            self._get(
                "a",
                "/api/manager/filter-options",
            )
        )


        manager_c_response = (
            self._get(
                "c",
                "/api/manager/filter-options",
            )
        )


        self.assertEqual(
            manager_a_response.status_code,
            200,
        )


        self.assertEqual(
            manager_c_response.status_code,
            200,
        )


        manager_a_payload = (
            manager_a_response
            .get_json()
        )


        manager_c_payload = (
            manager_c_response
            .get_json()
        )


        self.assertEqual(

            {
                row["id"]
                for row
                in manager_a_payload.get(
                    "hostels",
                    []
                )
            },

            {
                self.hostel_a_id
            },
        )


        self.assertEqual(

            {
                row["id"]
                for row
                in manager_a_payload.get(
                    "messUnits",
                    []
                )
            },

            {
                self.mess_a_id
            },
        )


        self.assertEqual(
            manager_c_payload.get(
                "hostels",
                []
            ),
            [],
        )


        self.assertEqual(
            manager_c_payload.get(
                "messUnits",
                []
            ),
            [],
        )

# ========================================================
# TEST 13
# STAFF EDIT / REASSIGN / STATUS MUTATIONS
# ========================================================

def test_staff_mutations_are_functional_and_manager_scoped(
    self
):
    with self.app.app_context():
        second_hostel = Hostel(
            manager_user_id=self.manager_a_id,
            name="Manager A Annex Hostel",
            code="ANN-A",
            status="active",
        )
        db.session.add(second_hostel)
        db.session.flush()

        second_block = HostelBlock(
            hostel_id=second_hostel.id,
            name="Annex Block",
            code="ANN",
            status="active",
        )
        db.session.add(second_block)
        db.session.flush()

        second_mess = MessUnit(
            hostel_id=second_hostel.id,
            block_id=second_block.id,
            name="Annex North Mess",
            unit_type="north",
            supported_categories="both",
            capacity=300,
            status="active",
        )
        db.session.add(second_mess)
        db.session.commit()

        second_hostel_id = second_hostel.id
        second_block_id = second_block.id
        second_mess_id = second_mess.id

    # Test Staff profile editing.
    edit_response = self._put(
        "a",
        f"/api/manager/staff/{self.staff_a_id}",
        {
            "name": "Alpha Supervisor",
            "email": "alpha.supervisor@test.local",
            "mobile": "9000000091",
            "staffRole": "Supervisor",
        },
    )

    self.assertEqual(
        edit_response.status_code,
        200,
        edit_response.get_data(as_text=True),
    )

    # Test Staff reassignment.
    assignment_response = self._put(
        "a",
        f"/api/manager/staff/{self.staff_a_id}/assign",
        {
            "hostelId": second_hostel_id,
            "blockId": second_block_id,
            "messUnitId": second_mess_id,
        },
    )

    self.assertEqual(
        assignment_response.status_code,
        200,
        assignment_response.get_data(as_text=True),
    )

    # Test Staff activation/deactivation.
    status_response = self._patch(
        "a",
        f"/api/manager/staff/{self.staff_a_id}/status",
        {
            "isActive": False
        },
    )

    self.assertEqual(
        status_response.status_code,
        200,
        status_response.get_data(as_text=True),
    )

    # Verify that all changes were saved.
    with self.app.app_context():
        updated_staff = db.session.get(
            User,
            self.staff_a_id
        )

        self.assertEqual(
            updated_staff.name,
            "Alpha Supervisor"
        )
        self.assertEqual(
            updated_staff.staff_role,
            "Supervisor"
        )
        self.assertEqual(
            updated_staff.hostel_id,
            second_hostel_id
        )
        self.assertEqual(
            updated_staff.block_id,
            second_block_id
        )
        self.assertEqual(
            updated_staff.mess_unit_id,
            second_mess_id
        )
        self.assertEqual(
            updated_staff.hostel,
            "Manager A Annex Hostel"
        )
        self.assertEqual(
            updated_staff.hostel_block,
            "Annex Block"
        )
        self.assertEqual(
            updated_staff.mess_unit,
            "Annex North Mess"
        )
        self.assertFalse(
            updated_staff.is_active
        )

    # Manager A must not modify Manager B's Staff.
    foreign_requests = [
        (
            f"/api/manager/staff/{self.staff_b_id}",
            {
                "name": "Not Allowed",
                "email": "not.allowed@test.local",
                "mobile": "9000000092",
                "staffRole": "Cook",
            },
            "put",
        ),
        (
            f"/api/manager/staff/"
            f"{self.staff_b_id}/assign",
            {
                "hostelId": second_hostel_id,
                "blockId": second_block_id,
                "messUnitId": second_mess_id,
            },
            "put",
        ),
        (
            f"/api/manager/staff/"
            f"{self.staff_b_id}/status",
            {
                "isActive": False
            },
            "patch",
        ),
    ]

    for path, payload, method in foreign_requests:
        with self.subTest(path=path):
            response = (
                self._put(
                    "a",
                    path,
                    payload
                )
                if method == "put"
                else self._patch(
                    "a",
                    path,
                    payload
                )
            )

            self.assert_forbidden_or_not_found(
                response
            )
    # ========================================================
    # TEST 13
    # ROLE AUTHORIZATION
    # ========================================================

    def test_student_role_cannot_access_manager_api(
        self
    ):

        response = (
            self._get(
                "student",
                "/api/manager/students",
            )
        )


        self.assertEqual(
            response.status_code,
            403,
        )


# ============================================================
# DIRECT EXECUTION
# ============================================================

if __name__ == "__main__":

    unittest.main(
        verbosity=2
    )