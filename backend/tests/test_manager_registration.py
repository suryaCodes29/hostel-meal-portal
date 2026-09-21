import unittest
from unittest.mock import patch

from flask import Flask

from models import Hostel, HostelBlock, User, db
from routes.auth_routes import auth_bp


class ManagerRegistrationTests(unittest.TestCase):

    def setUp(self):
        self.app = Flask(__name__)

        self.app.config.update(
            TESTING=True,
            SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
        )

        db.init_app(self.app)
        self.app.register_blueprint(auth_bp)

        with self.app.app_context():
            db.create_all()

        self.client = self.app.test_client()

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    @staticmethod
    def registration_payload(**overrides):
        payload = {
            "name": "Krishna Hostel Manager",
            "managerId": "MGR900",
            "email": "manager900@example.com",
            "mobile": "9876543210",
            "hostelName": "Krishna Boys Hostel",
            "hostelBlock": "Block A",
            "password": "Strong@123",
            "confirmPassword": "Strong@123",
            "termsAccepted": True,
        }

        payload.update(overrides)
        return payload

    def test_registration_creates_and_links_manager_hostel_and_block(
        self
    ):
        response = self.client.post(
            "/api/auth/manager-register",
            json=self.registration_payload(),
        )

        self.assertEqual(
            response.status_code,
            201,
            response.get_data(as_text=True),
        )

        with self.app.app_context():
            manager = User.query.filter_by(
                email="manager900@example.com"
            ).one()

            hostel = Hostel.query.filter_by(
                manager_user_id=manager.id
            ).one()

            block = HostelBlock.query.filter_by(
                hostel_id=hostel.id
            ).one()

            self.assertEqual(
                manager.role,
                "manager"
            )

            self.assertEqual(
                manager.hostel,
                "Krishna Boys Hostel"
            )

            self.assertEqual(
                manager.hostel_block,
                "Block A"
            )

            self.assertEqual(
                manager.hostel_id,
                hostel.id
            )

            self.assertEqual(
                manager.block_id,
                block.id
            )

            self.assertEqual(
                hostel.name,
                "Krishna Boys Hostel"
            )

            self.assertEqual(
                hostel.code,
                "KRISHNA-BOYS-HOSTEL"
            )

            self.assertEqual(
                hostel.contact_number,
                "9876543210"
            )

            self.assertEqual(
                hostel.status,
                "active"
            )

            self.assertEqual(
                block.name,
                "Block A"
            )

            self.assertEqual(
                block.code,
                "KRISHNA-BOYS-HOSTEL-B1"
            )

            self.assertEqual(
                block.status,
                "active"
            )

    def test_registration_failure_rolls_back_all_three_records(
        self
    ):
        with patch.object(
            db.session,
            "commit",
            side_effect=RuntimeError(
                "forced registration failure"
            ),
        ):
            response = self.client.post(
                "/api/auth/manager-register",
                json=self.registration_payload(),
            )

        self.assertEqual(
            response.status_code,
            500
        )

        with self.app.app_context():
            self.assertEqual(
                User.query.count(),
                0
            )

            self.assertEqual(
                Hostel.query.count(),
                0
            )

            self.assertEqual(
                HostelBlock.query.count(),
                0
            )


if __name__ == "__main__":
    unittest.main(
        verbosity=2
    )