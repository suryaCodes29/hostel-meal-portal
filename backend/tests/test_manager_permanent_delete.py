import sys
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch


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


from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token
from sqlalchemy import event

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
from routes.manager_routes import manager_bp


class ManagerPermanentDeleteTests(unittest.TestCase):
    """
    Integration tests for Manager permanent-delete endpoints.

    IMPORTANT:
    - Uses an isolated in-memory SQLite database.
    - Never connects to the project's real MySQL database.
    - Never deletes or modifies development/production records.
    - Every test creates a fresh database and disposes it afterward.
    """

    def setUp(self):
        self.app = Flask(__name__)

        self.app.config.update(
            TESTING=True,
            SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
            JWT_SECRET_KEY="permanent-delete-test-secret-32-bytes-minimum-key",
            JWT_ACCESS_TOKEN_EXPIRES=False,
        )

        db.init_app(self.app)
        JWTManager(self.app)
        self.app.register_blueprint(manager_bp)

        with self.app.app_context():
            engine = db.engine

            @event.listens_for(engine, "connect")
            def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record):
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.close()

            db.create_all()
            self._seed_database()

        self.client = self.app.test_client()

    def tearDown(self):
        # Each test uses its own in-memory SQLite engine. Do not call
        # db.drop_all() here: the project schema contains intentional
        # circular foreign keys between users / hostels / mess units, and
        # SQLite cannot safely sort those tables for DROP while FK checking
        # is enabled. Disposing this test-only engine destroys the complete
        # in-memory database and cannot touch the real MySQL database.
        with self.app.app_context():
            db.session.remove()
            db.engine.dispose()

    # =========================================================
    # FIXTURE HELPERS
    # =========================================================

    def _seed_database(self):
        # -----------------------------------------------------
        # Managers
        # -----------------------------------------------------
        manager_a = User(
            name="Manager A",
            manager_id="MGR-A",
            email="manager.a@test.local",
            mobile="9000000001",
            password_hash="test-hash",
            role="manager",
            is_active=True,
            must_change_password=False,
        )

        manager_b = User(
            name="Manager B",
            manager_id="MGR-B",
            email="manager.b@test.local",
            mobile="9000000002",
            password_hash="test-hash",
            role="manager",
            is_active=True,
            must_change_password=False,
        )

        db.session.add_all(
            [
                manager_a,
                manager_b,
            ]
        )
        db.session.flush()

        self.manager_a_id = manager_a.id
        self.manager_b_id = manager_b.id

        # -----------------------------------------------------
        # Hostels
        # Manager A owns A1 and A2.
        # Manager B owns B1.
        # -----------------------------------------------------
        hostel_a1 = Hostel(
            manager_user_id=manager_a.id,
            name="Manager A Primary Hostel",
            code="A1",
            address="A1 address",
            contact_number="9000000101",
            status="active",
        )

        hostel_a2 = Hostel(
            manager_user_id=manager_a.id,
            name="Manager A Secondary Hostel",
            code="A2",
            address="A2 address",
            contact_number="9000000102",
            status="active",
        )

        hostel_b1 = Hostel(
            manager_user_id=manager_b.id,
            name="Manager B Hostel",
            code="B1",
            address="B1 address",
            contact_number="9000000201",
            status="active",
        )

        db.session.add_all(
            [
                hostel_a1,
                hostel_a2,
                hostel_b1,
            ]
        )
        db.session.flush()

        self.hostel_a1_id = hostel_a1.id
        self.hostel_a2_id = hostel_a2.id
        self.hostel_b1_id = hostel_b1.id

        # -----------------------------------------------------
        # Blocks
        # -----------------------------------------------------
        block_a1 = HostelBlock(
            hostel_id=hostel_a1.id,
            name="Block A",
            code="A",
            status="active",
        )

        block_a2 = HostelBlock(
            hostel_id=hostel_a2.id,
            name="Block A",
            code="A",
            status="active",
        )

        block_b1 = HostelBlock(
            hostel_id=hostel_b1.id,
            name="Block A",
            code="A",
            status="active",
        )

        db.session.add_all(
            [
                block_a1,
                block_a2,
                block_b1,
            ]
        )
        db.session.flush()

        self.block_a1_id = block_a1.id
        self.block_a2_id = block_a2.id
        self.block_b1_id = block_b1.id

        # -----------------------------------------------------
        # Mess Units
        # -----------------------------------------------------
        mess_a1 = MessUnit(
            hostel_id=hostel_a1.id,
            block_id=block_a1.id,
            name="North Mess",
            unit_type="north",
            supported_categories="both",
            capacity=300,
            status="active",
        )

        mess_a2 = MessUnit(
            hostel_id=hostel_a2.id,
            block_id=block_a2.id,
            name="North Mess",
            unit_type="north",
            supported_categories="both",
            capacity=300,
            status="active",
        )

        mess_b1 = MessUnit(
            hostel_id=hostel_b1.id,
            block_id=block_b1.id,
            name="North Mess",
            unit_type="north",
            supported_categories="both",
            capacity=300,
            status="active",
        )

        db.session.add_all(
            [
                mess_a1,
                mess_a2,
                mess_b1,
            ]
        )
        db.session.flush()

        self.mess_a1_id = mess_a1.id
        self.mess_a2_id = mess_a2.id
        self.mess_b1_id = mess_b1.id

        # -----------------------------------------------------
        # Students
        # Two students in A1 allow us to prove that deleting
        # one student does not delete another student's data.
        # -----------------------------------------------------
        student_a1 = User(
            name="Student A1",
            student_id="A1-STU-001",
            email="a1.student1@test.local",
            mobile="9100000001",
            password_hash="test-hash",
            role="student",
            hostel="Manager A Primary Hostel",
            hostel_block="Block A",
            mess_unit="North Mess",
            meal_category="veg",
            hostel_id=hostel_a1.id,
            block_id=block_a1.id,
            mess_unit_id=mess_a1.id,
            is_active=True,
            must_change_password=False,
        )

        student_a1_other = User(
            name="Student A1 Other",
            student_id="A1-STU-002",
            email="a1.student2@test.local",
            mobile="9100000002",
            password_hash="test-hash",
            role="student",
            hostel="Manager A Primary Hostel",
            hostel_block="Block A",
            mess_unit="North Mess",
            meal_category="veg",
            hostel_id=hostel_a1.id,
            block_id=block_a1.id,
            mess_unit_id=mess_a1.id,
            is_active=True,
            must_change_password=False,
        )

        student_a2 = User(
            name="Student A2",
            student_id="A2-STU-001",
            email="a2.student1@test.local",
            mobile="9100000011",
            password_hash="test-hash",
            role="student",
            hostel="Manager A Secondary Hostel",
            hostel_block="Block A",
            mess_unit="North Mess",
            meal_category="veg",
            hostel_id=hostel_a2.id,
            block_id=block_a2.id,
            mess_unit_id=mess_a2.id,
            is_active=True,
            must_change_password=False,
        )

        student_b1 = User(
            name="Student B1",
            student_id="B1-STU-001",
            email="b1.student1@test.local",
            mobile="9200000001",
            password_hash="test-hash",
            role="student",
            hostel="Manager B Hostel",
            hostel_block="Block A",
            mess_unit="North Mess",
            meal_category="veg",
            hostel_id=hostel_b1.id,
            block_id=block_b1.id,
            mess_unit_id=mess_b1.id,
            is_active=True,
            must_change_password=False,
        )

        db.session.add_all(
            [
                student_a1,
                student_a1_other,
                student_a2,
                student_b1,
            ]
        )
        db.session.flush()

        self.student_a1_id = student_a1.id
        self.student_a1_other_id = student_a1_other.id
        self.student_a2_id = student_a2.id
        self.student_b1_id = student_b1.id

        # -----------------------------------------------------
        # Staff
        # -----------------------------------------------------
        staff_a1 = User(
            name="Staff A1",
            staff_id="A1-STF-001",
            email="a1.staff1@test.local",
            mobile="9300000001",
            password_hash="test-hash",
            role="staff",
            staff_role="Supervisor",
            hostel="Manager A Primary Hostel",
            hostel_block="Block A",
            mess_unit="North Mess",
            hostel_id=hostel_a1.id,
            block_id=block_a1.id,
            mess_unit_id=mess_a1.id,
            is_active=True,
            must_change_password=False,
        )

        staff_a2 = User(
            name="Staff A2",
            staff_id="A2-STF-001",
            email="a2.staff1@test.local",
            mobile="9300000011",
            password_hash="test-hash",
            role="staff",
            staff_role="Cook",
            hostel="Manager A Secondary Hostel",
            hostel_block="Block A",
            mess_unit="North Mess",
            hostel_id=hostel_a2.id,
            block_id=block_a2.id,
            mess_unit_id=mess_a2.id,
            is_active=True,
            must_change_password=False,
        )

        staff_b1 = User(
            name="Staff B1",
            staff_id="B1-STF-001",
            email="b1.staff1@test.local",
            mobile="9400000001",
            password_hash="test-hash",
            role="staff",
            staff_role="Supervisor",
            hostel="Manager B Hostel",
            hostel_block="Block A",
            mess_unit="North Mess",
            hostel_id=hostel_b1.id,
            block_id=block_b1.id,
            mess_unit_id=mess_b1.id,
            is_active=True,
            must_change_password=False,
        )

        db.session.add_all(
            [
                staff_a1,
                staff_a2,
                staff_b1,
            ]
        )
        db.session.flush()

        self.staff_a1_id = staff_a1.id
        self.staff_a2_id = staff_a2.id
        self.staff_b1_id = staff_b1.id

        # Staff A1 supervises the A1 Mess Unit.
        mess_a1.supervisor_user_id = staff_a1.id

        # Manager B's staff supervises Manager B's Mess Unit.
        mess_b1.supervisor_user_id = staff_b1.id

        # -----------------------------------------------------
        # Menus
        # A1 gets two menus so deleting one menu can prove the
        # unrelated menu stays intact.
        # -----------------------------------------------------
        menu_a1 = Menu(
            hostel_id=hostel_a1.id,
            mess_unit_id=mess_a1.id,
            menu_date=date(2026, 9, 12),
            meal="breakfast",
            meal_category="veg",
            menu_items="Idli, Sambar",
            status="published",
            created_by=manager_a.id,
        )

        menu_a1_other = Menu(
            hostel_id=hostel_a1.id,
            mess_unit_id=mess_a1.id,
            menu_date=date(2026, 9, 12),
            meal="dinner",
            meal_category="veg",
            menu_items="Rice, Dal",
            status="completed",
            created_by=manager_a.id,
        )

        menu_a2 = Menu(
            hostel_id=hostel_a2.id,
            mess_unit_id=mess_a2.id,
            menu_date=date(2026, 9, 12),
            meal="breakfast",
            meal_category="veg",
            menu_items="Dosa",
            status="published",
            created_by=manager_a.id,
        )

        menu_b1 = Menu(
            hostel_id=hostel_b1.id,
            mess_unit_id=mess_b1.id,
            menu_date=date(2026, 9, 12),
            meal="breakfast",
            meal_category="veg",
            menu_items="Pongal",
            status="published",
            created_by=manager_b.id,
        )

        db.session.add_all(
            [
                menu_a1,
                menu_a1_other,
                menu_a2,
                menu_b1,
            ]
        )
        db.session.flush()

        self.menu_a1_id = menu_a1.id
        self.menu_a1_other_id = menu_a1_other.id
        self.menu_a2_id = menu_a2.id
        self.menu_b1_id = menu_b1.id

        # -----------------------------------------------------
        # Meal Responses
        # -----------------------------------------------------
        response_a1 = MealResponse(
            menu_id=menu_a1.id,
            student_user_id=student_a1.id,
            mess_unit_id=mess_a1.id,
            response="attending",
        )

        response_a1_other = MealResponse(
            menu_id=menu_a1.id,
            student_user_id=student_a1_other.id,
            mess_unit_id=mess_a1.id,
            response="skipping",
        )

        response_a2 = MealResponse(
            menu_id=menu_a2.id,
            student_user_id=student_a2.id,
            mess_unit_id=mess_a2.id,
            response="attending",
        )

        response_b1 = MealResponse(
            menu_id=menu_b1.id,
            student_user_id=student_b1.id,
            mess_unit_id=mess_b1.id,
            response="attending",
        )

        db.session.add_all(
            [
                response_a1,
                response_a1_other,
                response_a2,
                response_b1,
            ]
        )
        db.session.flush()

        self.response_a1_id = response_a1.id
        self.response_a1_other_id = response_a1_other.id
        self.response_a2_id = response_a2.id
        self.response_b1_id = response_b1.id

        # -----------------------------------------------------
        # Forecasts
        # -----------------------------------------------------
        forecast_a1 = Forecast(
            hostel_id=hostel_a1.id,
            mess_unit_id=mess_a1.id,
            forecast_date=date(2026, 9, 13),
            meal="breakfast",
            meal_category="veg",
            predicted_students=100,
            actual_students=95,
            preparation_status="completed",
        )

        forecast_a2 = Forecast(
            hostel_id=hostel_a2.id,
            mess_unit_id=mess_a2.id,
            forecast_date=date(2026, 9, 13),
            meal="breakfast",
            meal_category="veg",
            predicted_students=80,
            actual_students=78,
            preparation_status="completed",
        )

        forecast_b1 = Forecast(
            hostel_id=hostel_b1.id,
            mess_unit_id=mess_b1.id,
            forecast_date=date(2026, 9, 13),
            meal="breakfast",
            meal_category="veg",
            predicted_students=90,
            actual_students=88,
            preparation_status="completed",
        )

        db.session.add_all(
            [
                forecast_a1,
                forecast_a2,
                forecast_b1,
            ]
        )
        db.session.flush()

        self.forecast_a1_id = forecast_a1.id
        self.forecast_a2_id = forecast_a2.id
        self.forecast_b1_id = forecast_b1.id

        # -----------------------------------------------------
        # Waste records
        # -----------------------------------------------------
        waste_a1 = WasteRecord(
            hostel_id=hostel_a1.id,
            mess_unit_id=mess_a1.id,
            record_date=date(2026, 9, 12),
            meal="breakfast",
            meal_category="veg",
            quantity_prepared=100.0,
            quantity_served=95.0,
            waste_kg=5.0,
            students_served=95,
            shortage_occurred=False,
        )

        waste_a2 = WasteRecord(
            hostel_id=hostel_a2.id,
            mess_unit_id=mess_a2.id,
            record_date=date(2026, 9, 12),
            meal="breakfast",
            meal_category="veg",
            quantity_prepared=80.0,
            quantity_served=78.0,
            waste_kg=2.0,
            students_served=78,
            shortage_occurred=False,
        )

        waste_b1 = WasteRecord(
            hostel_id=hostel_b1.id,
            mess_unit_id=mess_b1.id,
            record_date=date(2026, 9, 12),
            meal="breakfast",
            meal_category="veg",
            quantity_prepared=90.0,
            quantity_served=88.0,
            waste_kg=2.0,
            students_served=88,
            shortage_occurred=False,
        )

        db.session.add_all(
            [
                waste_a1,
                waste_a2,
                waste_b1,
            ]
        )
        db.session.flush()

        self.waste_a1_id = waste_a1.id
        self.waste_a2_id = waste_a2.id
        self.waste_b1_id = waste_b1.id

        # Manager-scoped notifications have no Student/Staff/
        # Hostel/Menu FK in the current model. They intentionally
        # remain Manager-level historical notifications.
        notification_a = Notification(
            manager_user_id=manager_a.id,
            notification_type="test",
            title="Manager A notification",
            message="Manager A notification",
            is_read=False,
        )

        notification_b = Notification(
            manager_user_id=manager_b.id,
            notification_type="test",
            title="Manager B notification",
            message="Manager B notification",
            is_read=False,
        )

        db.session.add_all(
            [
                notification_a,
                notification_b,
            ]
        )

        db.session.commit()

        self.manager_a_token = create_access_token(
            identity=str(manager_a.id)
        )

        self.manager_b_token = create_access_token(
            identity=str(manager_b.id)
        )

    def _headers(self, token):
        return {
            "Authorization": f"Bearer {token}"
        }

    def _delete(self, path, token, confirmation="DELETE"):
        return self.client.delete(
            path,
            headers=self._headers(token),
            json={
                "confirmation":
                    confirmation
            },
        )

    def _assert_exists(self, model, record_id):
        self.assertIsNotNone(
            db.session.get(
                model,
                record_id
            )
        )

    def _assert_missing(self, model, record_id):
        self.assertIsNone(
            db.session.get(
                model,
                record_id
            )
        )

    def _assert_no_foreign_key_violations(self):
        rows = db.session.execute(
            db.text(
                "PRAGMA foreign_key_check"
            )
        ).fetchall()

        self.assertEqual(
            rows,
            [],
            msg=(
                "SQLite foreign_key_check found orphaned "
                f"references: {rows}"
            ),
        )

    # =========================================================
    # AUTHENTICATION / CONFIRMATION TESTS
    # =========================================================

    def test_delete_requires_authentication(self):
        response = self.client.delete(
            f"/api/manager/students/{self.student_a1_id}",
            json={
                "confirmation":
                    "DELETE"
            },
        )

        self.assertEqual(
            response.status_code,
            401
        )

        with self.app.app_context():
            self._assert_exists(
                User,
                self.student_a1_id
            )

    def test_confirmation_must_be_exact_case_sensitive_delete(self):
        invalid_values = [
            "",
            "delete",
            "Delete",
            " DELETE",
            "DELETE ",
            " DELETE ",
            "delete ",
        ]

        for invalid_value in invalid_values:
            with self.subTest(
                confirmation=invalid_value
            ):
                response = self._delete(
                    f"/api/manager/students/{self.student_a1_id}",
                    self.manager_a_token,
                    invalid_value,
                )

                self.assertEqual(
                    response.status_code,
                    400
                )

                with self.app.app_context():
                    self._assert_exists(
                        User,
                        self.student_a1_id
                    )

                    self._assert_exists(
                        MealResponse,
                        self.response_a1_id
                    )

    def test_missing_confirmation_does_not_delete_record(self):
        response = self.client.delete(
            f"/api/manager/students/{self.student_a1_id}",
            headers=self._headers(
                self.manager_a_token
            ),
            json={},
        )

        self.assertEqual(
            response.status_code,
            400
        )

        with self.app.app_context():
            self._assert_exists(
                User,
                self.student_a1_id
            )

    # =========================================================
    # CROSS-MANAGER / IDOR TESTS
    # =========================================================

    def test_manager_a_cannot_delete_manager_b_records(self):
        targets = [
            (
                "student",
                f"/api/manager/students/{self.student_b1_id}",
            ),
            (
                "staff",
                f"/api/manager/staff/{self.staff_b1_id}",
            ),
            (
                "menu",
                f"/api/manager/menus/{self.menu_b1_id}",
            ),
            (
                "hostel",
                f"/api/manager/hostels/{self.hostel_b1_id}",
            ),
        ]

        for resource_name, path in targets:
            with self.subTest(
                resource=resource_name
            ):
                response = self._delete(
                    path,
                    self.manager_a_token,
                    "DELETE",
                )

                self.assertIn(
                    response.status_code,
                    (403, 404)
                )

        with self.app.app_context():
            self._assert_exists(
                User,
                self.student_b1_id
            )
            self._assert_exists(
                User,
                self.staff_b1_id
            )
            self._assert_exists(
                Menu,
                self.menu_b1_id
            )
            self._assert_exists(
                Hostel,
                self.hostel_b1_id
            )
            self._assert_exists(
                MessUnit,
                self.mess_b1_id
            )
            self._assert_exists(
                MealResponse,
                self.response_b1_id
            )
            self._assert_no_foreign_key_violations()

    # =========================================================
    # STUDENT DELETE
    # =========================================================

    def test_student_delete_removes_only_student_and_owned_responses(self):
        response = self._delete(
            f"/api/manager/students/{self.student_a1_id}",
            self.manager_a_token,
            "DELETE",
        )

        self.assertEqual(
            response.status_code,
            200
        )

        payload = response.get_json()

        self.assertEqual(
            payload["message"],
            "Student deleted permanently."
        )

        with self.app.app_context():
            self._assert_missing(
                User,
                self.student_a1_id
            )

            self._assert_missing(
                MealResponse,
                self.response_a1_id
            )

            # Another student in the same Hostel survives.
            self._assert_exists(
                User,
                self.student_a1_other_id
            )

            self._assert_exists(
                MealResponse,
                self.response_a1_other_id
            )

            # Shared resources survive.
            self._assert_exists(
                Hostel,
                self.hostel_a1_id
            )

            self._assert_exists(
                MessUnit,
                self.mess_a1_id
            )

            self._assert_exists(
                Menu,
                self.menu_a1_id
            )

            self._assert_exists(
                User,
                self.staff_a1_id
            )

            # Other Hostels/managers survive.
            self._assert_exists(
                User,
                self.student_a2_id
            )

            self._assert_exists(
                User,
                self.student_b1_id
            )

            self._assert_no_foreign_key_violations()

    # =========================================================
    # STAFF DELETE
    # =========================================================

    def test_staff_delete_clears_supervisor_reference_but_keeps_shared_data(self):
        response = self._delete(
            f"/api/manager/staff/{self.staff_a1_id}",
            self.manager_a_token,
            "DELETE",
        )

        self.assertEqual(
            response.status_code,
            200
        )

        payload = response.get_json()

        self.assertEqual(
            payload["message"],
            "Staff member deleted permanently."
        )

        with self.app.app_context():
            self._assert_missing(
                User,
                self.staff_a1_id
            )

            mess = db.session.get(
                MessUnit,
                self.mess_a1_id
            )

            self.assertIsNotNone(
                mess
            )

            self.assertIsNone(
                mess.supervisor_user_id
            )

            # Shared Hostel, students, menu, forecast and waste
            # records must not be deleted with one Staff account.
            self._assert_exists(
                Hostel,
                self.hostel_a1_id
            )

            self._assert_exists(
                User,
                self.student_a1_id
            )

            self._assert_exists(
                Menu,
                self.menu_a1_id
            )

            self._assert_exists(
                Forecast,
                self.forecast_a1_id
            )

            self._assert_exists(
                WasteRecord,
                self.waste_a1_id
            )

            self._assert_exists(
                User,
                self.staff_a2_id
            )

            self._assert_exists(
                User,
                self.staff_b1_id
            )

            self._assert_no_foreign_key_violations()

    # =========================================================
    # MENU DELETE
    # =========================================================

    def test_menu_delete_removes_only_selected_menu_and_its_responses(self):
        response = self._delete(
            f"/api/manager/menus/{self.menu_a1_id}",
            self.manager_a_token,
            "DELETE",
        )

        self.assertEqual(
            response.status_code,
            200
        )

        payload = response.get_json()

        self.assertEqual(
            payload["message"],
            "Menu deleted permanently."
        )

        with self.app.app_context():
            self._assert_missing(
                Menu,
                self.menu_a1_id
            )

            self._assert_missing(
                MealResponse,
                self.response_a1_id
            )

            self._assert_missing(
                MealResponse,
                self.response_a1_other_id
            )

            # Unrelated menus are preserved.
            self._assert_exists(
                Menu,
                self.menu_a1_other_id
            )

            self._assert_exists(
                Menu,
                self.menu_a2_id
            )

            self._assert_exists(
                Menu,
                self.menu_b1_id
            )

            # Historical operational records are not Menu-owned
            # in the current schema and therefore remain.
            self._assert_exists(
                Forecast,
                self.forecast_a1_id
            )

            self._assert_exists(
                WasteRecord,
                self.waste_a1_id
            )

            self._assert_exists(
                Hostel,
                self.hostel_a1_id
            )

            self._assert_exists(
                MessUnit,
                self.mess_a1_id
            )

            self._assert_no_foreign_key_violations()

    def test_published_and_completed_menus_can_be_permanently_deleted(self):
        # Published menu.
        first_response = self._delete(
            f"/api/manager/menus/{self.menu_a1_id}",
            self.manager_a_token,
            "DELETE",
        )

        self.assertEqual(
            first_response.status_code,
            200
        )

        # Completed menu.
        second_response = self._delete(
            f"/api/manager/menus/{self.menu_a1_other_id}",
            self.manager_a_token,
            "DELETE",
        )

        self.assertEqual(
            second_response.status_code,
            200
        )

        with self.app.app_context():
            self._assert_missing(
                Menu,
                self.menu_a1_id
            )

            self._assert_missing(
                Menu,
                self.menu_a1_other_id
            )

            self._assert_exists(
                Menu,
                self.menu_a2_id
            )

            self._assert_exists(
                Menu,
                self.menu_b1_id
            )

            self._assert_no_foreign_key_violations()

    # =========================================================
    # HOSTEL DELETE
    # =========================================================

    def test_hostel_delete_removes_all_target_hostel_data_only(self):
        response = self._delete(
            f"/api/manager/hostels/{self.hostel_a1_id}",
            self.manager_a_token,
            "DELETE",
        )

        self.assertEqual(
            response.status_code,
            200
        )

        payload = response.get_json()

        self.assertEqual(
            payload["message"],
            "Hostel and all related data deleted permanently."
        )

        with self.app.app_context():
            # Target Hostel.
            self._assert_missing(
                Hostel,
                self.hostel_a1_id
            )

            self._assert_missing(
                HostelBlock,
                self.block_a1_id
            )

            self._assert_missing(
                MessUnit,
                self.mess_a1_id
            )

            self._assert_missing(
                User,
                self.student_a1_id
            )

            self._assert_missing(
                User,
                self.student_a1_other_id
            )

            self._assert_missing(
                User,
                self.staff_a1_id
            )

            self._assert_missing(
                Menu,
                self.menu_a1_id
            )

            self._assert_missing(
                Menu,
                self.menu_a1_other_id
            )

            self._assert_missing(
                MealResponse,
                self.response_a1_id
            )

            self._assert_missing(
                MealResponse,
                self.response_a1_other_id
            )

            self._assert_missing(
                Forecast,
                self.forecast_a1_id
            )

            self._assert_missing(
                WasteRecord,
                self.waste_a1_id
            )

            # Logged-in Manager survives.
            self._assert_exists(
                User,
                self.manager_a_id
            )

            # Manager A's other Hostel survives.
            self._assert_exists(
                Hostel,
                self.hostel_a2_id
            )

            self._assert_exists(
                HostelBlock,
                self.block_a2_id
            )

            self._assert_exists(
                MessUnit,
                self.mess_a2_id
            )

            self._assert_exists(
                User,
                self.student_a2_id
            )

            self._assert_exists(
                User,
                self.staff_a2_id
            )

            self._assert_exists(
                Menu,
                self.menu_a2_id
            )

            self._assert_exists(
                MealResponse,
                self.response_a2_id
            )

            self._assert_exists(
                Forecast,
                self.forecast_a2_id
            )

            self._assert_exists(
                WasteRecord,
                self.waste_a2_id
            )

            # Manager B's entire tenant survives.
            self._assert_exists(
                User,
                self.manager_b_id
            )

            self._assert_exists(
                Hostel,
                self.hostel_b1_id
            )

            self._assert_exists(
                HostelBlock,
                self.block_b1_id
            )

            self._assert_exists(
                MessUnit,
                self.mess_b1_id
            )

            self._assert_exists(
                User,
                self.student_b1_id
            )

            self._assert_exists(
                User,
                self.staff_b1_id
            )

            self._assert_exists(
                Menu,
                self.menu_b1_id
            )

            self._assert_exists(
                MealResponse,
                self.response_b1_id
            )

            self._assert_exists(
                Forecast,
                self.forecast_b1_id
            )

            self._assert_exists(
                WasteRecord,
                self.waste_b1_id
            )

            # Manager-level notifications remain because the
            # current schema has no Hostel FK on Notification.
            self.assertEqual(
                Notification.query.filter_by(
                    manager_user_id=
                        self.manager_a_id
                ).count(),
                1,
            )

            self.assertEqual(
                Notification.query.filter_by(
                    manager_user_id=
                        self.manager_b_id
                ).count(),
                1,
            )

            self._assert_no_foreign_key_violations()

    # =========================================================
    # TRANSACTION / ROLLBACK TEST
    # =========================================================

    def test_backend_error_rolls_back_entire_student_delete(self):
        with self.app.app_context():
            session = db.session

            with patch.object(
                session,
                "commit",
                side_effect=RuntimeError(
                    "forced commit failure"
                ),
            ):
                response = self._delete(
                    f"/api/manager/students/{self.student_a1_id}",
                    self.manager_a_token,
                    "DELETE",
                )

        self.assertEqual(
            response.status_code,
            500
        )

        with self.app.app_context():
            # Both the User and dependent MealResponse must still
            # exist because the backend rolled back everything.
            self._assert_exists(
                User,
                self.student_a1_id
            )

            self._assert_exists(
                MealResponse,
                self.response_a1_id
            )

            self._assert_exists(
                Hostel,
                self.hostel_a1_id
            )

            self._assert_exists(
                MessUnit,
                self.mess_a1_id
            )

            self._assert_exists(
                Menu,
                self.menu_a1_id
            )

            self._assert_no_foreign_key_violations()

    # =========================================================
    # SERIALIZATION SUPPORT FOR HOSTEL DELETE MODAL
    # =========================================================

    def test_hostel_list_contains_dependency_counts_for_delete_modal(self):
        response = self.client.get(
            "/api/manager/hostels",
            headers=self._headers(
                self.manager_a_token
            ),
        )

        self.assertEqual(
            response.status_code,
            200
        )

        payload = response.get_json()

        hostel_a1 = next(
            item
            for item in payload["hostels"]
            if item["id"]
            == self.hostel_a1_id
        )

        self.assertEqual(
            hostel_a1["studentCount"],
            2
        )

        self.assertEqual(
            hostel_a1["staffCount"],
            1
        )

        self.assertEqual(
            hostel_a1["messUnitCount"],
            1
        )

        self.assertEqual(
            hostel_a1["menuCount"],
            2
        )


if __name__ == "__main__":
    unittest.main(
        verbosity=2
    )
