import unittest
from datetime import datetime, time, timedelta, timezone
from unittest.mock import patch
from zoneinfo import ZoneInfo

from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token

from config import Config
from models import (
    Hostel,
    MealQRToken,
    MealQRVerification,
    MealResponse,
    Menu,
    MessUnit,
    User,
    db,
)
from routes.staff_routes import staff_bp
from routes.student_routes import student_bp
from services.meal_qr_service import hash_qr_token


APP_TZ = ZoneInfo(Config.APP_TIMEZONE)


class StaffQrVerificationTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(
            TESTING=True,
            SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
            JWT_SECRET_KEY="staff-qr-test-secret-32-bytes-minimum",
            JWT_ACCESS_TOKEN_EXPIRES=False,
        )
        db.init_app(self.app)
        JWTManager(self.app)
        self.app.register_blueprint(staff_bp)
        self.app.register_blueprint(student_bp)

        with self.app.app_context():
            db.create_all()
            self.manager = User(
                name="Test Manager",
                email="manager-qr@example.test",
                password_hash="test",
                role="manager",
                must_change_password=False,
            )
            db.session.add(self.manager)
            db.session.flush()
            self.manager_id = self.manager.id

            self.hostel = self._add_hostel("North Hostel", "NH-QR")
            self.mess = self._add_mess(self.hostel, "North Mess", "north")
            self.staff = User(
                name="Test Staff",
                email="staff-qr@example.test",
                password_hash="test",
                role="staff",
                staff_id="STAFF-QR",
                hostel=self.hostel.name,
                hostel_id=self.hostel.id,
                mess_unit=self.mess.name,
                mess_unit_id=self.mess.id,
                meal_category="veg",
                must_change_password=False,
            )
            self.student = User(
                name="Test Student",
                email="student-qr@example.test",
                password_hash="test",
                role="student",
                student_id="STUDENT-QR",
                hostel=self.hostel.name,
                hostel_id=self.hostel.id,
                mess_unit=self.mess.name,
                mess_unit_id=self.mess.id,
                meal_category="veg",
                must_change_password=False,
            )
            db.session.add_all([self.staff, self.student])
            db.session.commit()

            self.manager_id = self.manager.id
            self.hostel_id = self.hostel.id
            self.mess_id = self.mess.id
            self.staff_id = self.staff.id
            self.student_id = self.student.id
            self.staff_token = create_access_token(identity=str(self.staff.id))
            self.student_token = create_access_token(identity=str(self.student.id))

        self.client = self.app.test_client()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def _add_hostel(self, name, code):
        hostel = Hostel(
            manager_user_id=self.manager_id,
            name=name,
            code=code,
        )
        db.session.add(hostel)
        db.session.flush()
        return hostel

    @staticmethod
    def _add_mess(hostel, name, unit_type):
        mess = MessUnit(
            hostel_id=hostel.id,
            name=name,
            unit_type=unit_type,
            supported_categories="both",
        )
        db.session.add(mess)
        db.session.flush()
        return mess

    def _make_qr(self, meal="breakfast", response="attending", category="veg",
                 student=None, hostel=None, mess=None, expires_delta=timedelta(hours=1)):
        now = datetime.now(APP_TZ)
        student = student or db.session.get(User, self.student_id)
        hostel = hostel or db.session.get(Hostel, self.hostel_id)
        mess = mess or db.session.get(MessUnit, self.mess_id)
        menu = Menu(
            hostel_id=hostel.id,
            mess_unit_id=mess.id,
            menu_date=now.date(),
            meal=meal,
            meal_category=category,
            start_time=time(0, 0),
            end_time=time(23, 59, 59),
            menu_items="Test meal",
            status="published",
        )
        db.session.add(menu)
        db.session.flush()
        meal_response = MealResponse(
            menu_id=menu.id,
            student_user_id=student.id,
            mess_unit_id=mess.id,
            response=response,
        )
        db.session.add(meal_response)
        db.session.flush()

        raw_token = f"test-qr-{menu.id}-{student.id}"
        token = MealQRToken(
            token_hash=hash_qr_token(raw_token),
            meal_response_id=meal_response.id,
            student_user_id=student.id,
            menu_id=menu.id,
            mess_unit_id=mess.id,
            expires_at=datetime.utcnow() + expires_delta,
        )
        db.session.add(token)
        db.session.commit()
        return raw_token, menu.id, meal_response.id, token.id

    def _scan(self, raw_token, staff_token=None):
        return self.client.post(
            "/api/staff/qr/verify",
            json={"token": raw_token},
            headers={"Authorization": f"Bearer {staff_token or self.staff_token}"},
        )

    def test_success_returns_database_details_and_my_meals_scan_status(self):
        with self.app.app_context():
            raw_token, menu_id, response_id, _ = self._make_qr()

        response = self._scan(raw_token)
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        payload = response.get_json()
        self.assertTrue(payload["approved"])
        self.assertEqual(payload["student"]["email"], "student-qr@example.test")
        self.assertEqual(payload["student"]["hostel"], "North Hostel")
        self.assertEqual(payload["student"]["messUnit"], "North Mess")
        self.assertEqual(payload["attendanceStatus"], "VERIFIED")
        self.assertIn("+05:30", payload["scanTime"])

        with self.app.app_context():
            self.assertEqual(
                MealQRVerification.query.filter_by(
                    meal_response_id=response_id,
                    verification_status="approved",
                ).count(),
                1,
            )

        menu_response = self.client.get(
            "/api/student/menus",
            query_string={
                "dateFrom": datetime.now(APP_TZ).date().isoformat(),
                "dateTo": datetime.now(APP_TZ).date().isoformat(),
            },
            headers={"Authorization": f"Bearer {self.student_token}"},
        )
        self.assertEqual(menu_response.status_code, 200, menu_response.get_data(as_text=True))
        menu_payload = next(
            menu for menu in menu_response.get_json()["menus"] if menu["id"] == menu_id
        )
        self.assertEqual(menu_payload["qrAttendance"]["status"], "scanned")
        self.assertIn("+05:30", menu_payload["qrAttendance"]["verifiedAt"])

    def test_repeated_qr_generation_reuses_the_active_token(self):
        with self.app.app_context():
            now = datetime.now(APP_TZ)
            menu = Menu(
                hostel_id=self.hostel_id,
                mess_unit_id=self.mess_id,
                menu_date=now.date(),
                meal="lunch",
                meal_category="veg",
                start_time=time(0, 0),
                end_time=time(23, 59, 59),
                menu_items="Test meal",
                status="published",
            )
            db.session.add(menu)
            db.session.flush()
            meal_response = MealResponse(
                menu_id=menu.id,
                student_user_id=self.student_id,
                mess_unit_id=self.mess_id,
                response="attending",
            )
            db.session.add(meal_response)
            db.session.commit()
            menu_id = menu.id

        headers = {"Authorization": f"Bearer {self.student_token}"}
        qr_now = datetime.combine(now.date(), time(12, 0), tzinfo=APP_TZ)
        qr_now_utc = qr_now.astimezone(timezone.utc).replace(tzinfo=None)
        with (
            patch("routes.student_routes.get_local_now", return_value=qr_now),
            patch("services.meal_qr_service.datetime") as qr_datetime,
        ):
            qr_datetime.utcnow.return_value = qr_now_utc
            first = self.client.post(
                f"/api/student/menus/{menu_id}/qr-token",
                headers=headers,
            )
            second = self.client.post(
                f"/api/student/menus/{menu_id}/qr-token",
                headers=headers,
            )

        self.assertEqual(first.status_code, 200, first.get_data(as_text=True))
        self.assertEqual(second.status_code, 200, second.get_data(as_text=True))
        self.assertEqual(second.get_json()["message"], "Active meal QR reused.")
        self.assertEqual(
            first.get_json()["qr"]["token"],
            second.get_json()["qr"]["token"],
        )
        self.assertTrue(first.get_json()["qr"]["expiresAt"].endswith("Z"))

        with self.app.app_context():
            self.assertEqual(
                MealQRToken.query.filter_by(menu_id=menu_id).count(),
                1,
            )
            token_record = MealQRToken.query.filter_by(menu_id=menu_id).one()
            self.assertEqual(
                token_record.token_hash,
                hash_qr_token(first.get_json()["qr"]["token"]),
            )

    def test_legacy_active_token_returns_a_clear_conflict_without_rotating_it(self):
        with self.app.app_context():
            raw_token, menu_id, _, token_id = self._make_qr(
                meal="lunch",
                expires_delta=timedelta(days=1),
            )

        qr_now = datetime.combine(
            datetime.now(APP_TZ).date(),
            time(12, 0),
            tzinfo=APP_TZ,
        )
        qr_now_utc = qr_now.astimezone(timezone.utc).replace(tzinfo=None)
        with (
            patch("routes.student_routes.get_local_now", return_value=qr_now),
            patch("services.meal_qr_service.datetime") as qr_datetime,
        ):
            qr_datetime.utcnow.return_value = qr_now_utc
            response = self.client.post(
                f"/api/student/menus/{menu_id}/qr-token",
                headers={"Authorization": f"Bearer {self.student_token}"},
            )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["code"], "qr_unavailable")
        self.assertIn(
            "original value cannot be recovered",
            response.get_json()["message"],
        )
        with self.app.app_context():
            token_record = db.session.get(MealQRToken, token_id)
            self.assertEqual(token_record.token_hash, hash_qr_token(raw_token))

    def test_repeat_scan_returns_original_time_without_duplicate_attendance(self):
        with self.app.app_context():
            raw_token, _, response_id, _ = self._make_qr()
            second_staff = User(
                name="Second Test Staff",
                email="staff-qr-second@example.test",
                password_hash="test",
                role="staff",
                staff_id="STAFF-QR-2",
                hostel="North Hostel",
                hostel_id=self.hostel_id,
                mess_unit="North Mess",
                mess_unit_id=self.mess_id,
                meal_category="veg",
                must_change_password=False,
            )
            db.session.add(second_staff)
            db.session.flush()
            second_staff_token = create_access_token(identity=str(second_staff.id))
            db.session.commit()

        first = self._scan(raw_token)
        second = self._scan(raw_token, second_staff_token)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.get_json()["code"], "already_scanned")
        self.assertEqual(
            second.get_json()["originalScanTime"],
            first.get_json()["scanTime"],
        )
        with self.app.app_context():
            self.assertEqual(
                MealQRVerification.query.filter_by(
                    meal_response_id=response_id,
                    verification_status="approved",
                ).count(),
                1,
            )

    def test_student_category_mismatch_is_rejected_without_attendance(self):
        with self.app.app_context():
            student = db.session.get(User, self.student_id)
            student.meal_category = "non-veg"
            db.session.commit()
            raw_token, _, response_id, token_id = self._make_qr(category="veg", student=student)

        response = self._scan(raw_token)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.get_json()["code"], "category_mismatch")
        with self.app.app_context():
            self.assertEqual(
                MealQRVerification.query.filter_by(meal_response_id=response_id).count(),
                0,
            )
            self.assertIsNone(db.session.get(MealQRToken, token_id).redeemed_at)

            student = db.session.get(User, self.student_id)
            staff_mismatch_token, _, staff_mismatch_response_id, _ = self._make_qr(
                meal="lunch",
                category="non-veg",
                student=student,
            )

        staff_mismatch = self._scan(staff_mismatch_token)
        self.assertEqual(staff_mismatch.status_code, 403)
        self.assertEqual(staff_mismatch.get_json()["code"], "category_mismatch")
        with self.app.app_context():
            self.assertEqual(
                MealQRVerification.query.filter_by(
                    meal_response_id=staff_mismatch_response_id
                ).count(),
                0,
            )

    def test_wrong_hostel_and_mess_are_rejected_without_attendance(self):
        with self.app.app_context():
            other_hostel = self._add_hostel("South Hostel", "SH-QR")
            other_mess = self._add_mess(other_hostel, "South Mess", "south")
            same_hostel_other_mess = self._add_mess(
                db.session.get(Hostel, self.hostel_id),
                "South Unit",
                "south",
            )
            other_student = User(
                name="Other Student",
                email="other-student-qr@example.test",
                password_hash="test",
                role="student",
                student_id="STUDENT-OTHER",
                hostel=other_hostel.name,
                hostel_id=other_hostel.id,
                mess_unit=other_mess.name,
                mess_unit_id=other_mess.id,
                meal_category="veg",
                must_change_password=False,
            )
            wrong_mess_student = User(
                name="Wrong Mess Student",
                email="wrong-mess-qr@example.test",
                password_hash="test",
                role="student",
                student_id="STUDENT-WRONG-MESS",
                hostel=self.hostel.name,
                hostel_id=self.hostel.id,
                mess_unit=same_hostel_other_mess.name,
                mess_unit_id=same_hostel_other_mess.id,
                meal_category="veg",
                must_change_password=False,
            )
            db.session.add_all([other_student, wrong_mess_student])
            db.session.commit()
            wrong_hostel_token, _, hostel_response_id, _ = self._make_qr(
                meal="lunch",
                student=other_student,
                hostel=other_hostel,
                mess=other_mess,
            )
            wrong_mess_token, _, mess_response_id, _ = self._make_qr(
                meal="dinner",
                student=wrong_mess_student,
                hostel=db.session.get(Hostel, self.hostel_id),
                mess=same_hostel_other_mess,
            )

        wrong_hostel = self._scan(wrong_hostel_token)
        self.assertEqual(wrong_hostel.get_json()["code"], "hostel_mismatch")
        wrong_mess = self._scan(wrong_mess_token)
        self.assertEqual(wrong_mess.get_json()["code"], "mess_mismatch")
        with self.app.app_context():
            self.assertEqual(
                MealQRVerification.query.filter(
                    MealQRVerification.meal_response_id.in_(
                        [hostel_response_id, mess_response_id]
                    )
                ).count(),
                0,
            )

    def test_skipped_and_expired_qrs_are_not_marked(self):
        with self.app.app_context():
            skipped_token, _, skipped_response_id, _ = self._make_qr(
                meal="lunch",
                response="skipping",
            )
            expired_token, _, expired_response_id, expired_id = self._make_qr(
                meal="dinner",
                expires_delta=-timedelta(minutes=1),
            )

        skipped = self._scan(skipped_token)
        expired = self._scan(expired_token)
        self.assertEqual(skipped.get_json()["code"], "meal_skipped")
        self.assertEqual(expired.get_json()["code"], "qr_expired")
        with self.app.app_context():
            self.assertEqual(
                MealQRVerification.query.filter(
                    MealQRVerification.meal_response_id.in_(
                        [skipped_response_id, expired_response_id]
                    )
                ).count(),
                0,
            )
            self.assertIsNone(db.session.get(MealQRToken, expired_id).redeemed_at)

    def test_inactive_staff_cannot_verify_a_qr(self):
        with self.app.app_context():
            raw_token, _, response_id, _ = self._make_qr()
            db.session.get(User, self.staff_id).is_active = False
            db.session.commit()

        response = self._scan(raw_token)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.get_json()["code"], "staff_inactive")
        with self.app.app_context():
            self.assertEqual(
                MealQRVerification.query.filter_by(meal_response_id=response_id).count(),
                0,
            )

    def test_missing_meal_response_is_rejected(self):
        with self.app.app_context():
            raw_token, _, response_id, _ = self._make_qr()
            db.session.delete(db.session.get(MealResponse, response_id))
            db.session.commit()

        response = self._scan(raw_token)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.get_json()["code"], "meal_response_missing")

    def test_attendance_roster_and_summary_respect_staff_assignment(self):
        with self.app.app_context():
            _, menu_id, response_id, _ = self._make_qr()
            menu = db.session.get(Menu, menu_id)
            attending_response = db.session.get(MealResponse, response_id)
            scan = MealQRVerification(
                meal_response_id=response_id,
                student_user_id=self.student_id,
                menu_id=menu_id,
                mess_unit_id=self.mess_id,
                verified_by_staff_id=self.staff_id,
                verification_status="approved",
            )

            no_response_student = User(
                name="No Response Student",
                email="no-response@example.test",
                password_hash="test",
                role="student",
                student_id="STUDENT-NO-RESPONSE",
                hostel=self.hostel.name,
                hostel_id=self.hostel_id,
                mess_unit=self.mess.name,
                mess_unit_id=self.mess_id,
                meal_category="veg",
                must_change_password=False,
            )
            skipped_student = User(
                name="Skipped Student",
                email="skipped@example.test",
                password_hash="test",
                role="student",
                student_id="STUDENT-SKIPPED",
                hostel=self.hostel.name,
                hostel_id=self.hostel_id,
                mess_unit=self.mess.name,
                mess_unit_id=self.mess_id,
                meal_category="veg",
                must_change_password=False,
            )
            other_category_student = User(
                name="Other Category Student",
                email="other-category@example.test",
                password_hash="test",
                role="student",
                student_id="STUDENT-OTHER-CATEGORY",
                hostel=self.hostel.name,
                hostel_id=self.hostel_id,
                mess_unit=self.mess.name,
                mess_unit_id=self.mess_id,
                meal_category="non-veg",
                must_change_password=False,
            )
            db.session.add_all([
                no_response_student,
                skipped_student,
                other_category_student,
                scan,
            ])
            db.session.flush()
            db.session.add_all([
                MealResponse(
                    menu_id=menu.id,
                    student_user_id=skipped_student.id,
                    mess_unit_id=self.mess_id,
                    response="skipping",
                ),
                MealResponse(
                    menu_id=menu.id,
                    student_user_id=other_category_student.id,
                    mess_unit_id=self.mess_id,
                    response="attending",
                ),
            ])
            db.session.flush()
            db.session.add(MealQRVerification(
                meal_response_id=MealResponse.query.filter_by(
                    menu_id=menu.id,
                    student_user_id=other_category_student.id,
                ).one().id,
                student_user_id=other_category_student.id,
                menu_id=menu.id,
                mess_unit_id=self.mess_id,
                verification_status="approved",
            ))
            db.session.commit()

        headers = {"Authorization": f"Bearer {self.staff_token}"}
        roster_response = self.client.get(
            "/api/staff/responses",
            query_string={"menuId": menu_id},
            headers=headers,
        )
        self.assertEqual(roster_response.status_code, 200, roster_response.get_data(as_text=True))
        roster = roster_response.get_json()["responses"]
        self.assertEqual(
            {row["studentId"] for row in roster},
            {"STUDENT-QR", "STUDENT-NO-RESPONSE", "STUDENT-SKIPPED"},
        )
        by_student = {row["studentId"]: row for row in roster}
        self.assertEqual(by_student["STUDENT-QR"]["qrAttendance"], "SCANNED")
        self.assertEqual(by_student["STUDENT-QR"]["attendanceStatus"], "Verified")
        self.assertIn("+05:30", by_student["STUDENT-QR"]["scanTime"])
        self.assertEqual(by_student["STUDENT-NO-RESPONSE"]["responseStatus"], "NO RESPONSE")
        self.assertEqual(by_student["STUDENT-SKIPPED"]["attendanceStatus"], "Skipped")
        self.assertEqual(by_student["STUDENT-SKIPPED"]["qrAttendance"], "NOT SCANNED")

        summary_response = self.client.get(
            "/api/staff/attendance/summary",
            query_string={"menuId": menu_id},
            headers=headers,
        )
        self.assertEqual(summary_response.status_code, 200)
        summary = summary_response.get_json()
        self.assertEqual(summary["expectedAttending"], 1)
        self.assertEqual(summary["successfullyScanned"], 1)
        self.assertEqual(summary["remainingToScan"], 0)
        self.assertEqual(summary["attendancePercentage"], 100)

    def test_attendance_endpoints_reject_out_of_assignment_sessions_and_bad_dates(self):
        with self.app.app_context():
            _, menu_id, _, _ = self._make_qr()
            staff = db.session.get(User, self.staff_id)
            staff.meal_category = "non-veg"
            db.session.commit()

        headers = {"Authorization": f"Bearer {self.staff_token}"}
        roster_response = self.client.get(
            "/api/staff/responses",
            query_string={"menuId": menu_id},
            headers=headers,
        )
        summary_response = self.client.get(
            "/api/staff/attendance/summary",
            query_string={"menuId": menu_id},
            headers=headers,
        )
        invalid_date_response = self.client.get(
            "/api/staff/meal-sessions",
            query_string={"date": "not-a-date"},
            headers=headers,
        )
        self.assertEqual(roster_response.status_code, 404)
        self.assertEqual(summary_response.status_code, 404)
        self.assertEqual(invalid_date_response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
