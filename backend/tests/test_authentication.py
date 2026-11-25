import unittest

from flask import Flask
from flask_jwt_extended import JWTManager, decode_token
from werkzeug.security import generate_password_hash

from models import User, db
from routes.auth_routes import auth_bp


class AuthenticationTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(
            TESTING=True,
            SQLALCHEMY_DATABASE_URI="sqlite:///:memory:",
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
            JWT_SECRET_KEY="authentication-test-secret-key-at-least-32-bytes",
            JWT_ACCESS_TOKEN_EXPIRES=False,
        )
        db.init_app(self.app)
        JWTManager(self.app)
        self.app.register_blueprint(auth_bp)
        self.client = self.app.test_client()

        with self.app.app_context():
            db.create_all()
            self.users = {}
            for role in ("manager", "staff", "student"):
                user = User(
                    name=f"Test {role.title()}",
                    email=f"{role}@authentication.test",
                    password_hash=generate_password_hash("ValidPassword1!"),
                    role=role,
                    is_active=True,
                    must_change_password=False,
                )
                db.session.add(user)
                self.users[role] = user
            db.session.commit()
            self.user_ids = {
                role: user.id for role, user in self.users.items()
            }

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def test_each_role_receives_a_jwt_for_its_database_identity(self):
        for role, user_id in self.user_ids.items():
            with self.subTest(role=role):
                response = self.client.post(
                    "/api/auth/login",
                    json={
                        "email": f"{role}@authentication.test",
                        "password": "ValidPassword1!",
                        "role": role,
                    },
                )

                self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
                payload = response.get_json()
                self.assertEqual(payload["user"]["role"], role)
                with self.app.app_context():
                    decoded = decode_token(payload["access_token"])
                self.assertEqual(decoded["sub"], str(user_id))
                self.assertEqual(decoded["role"], role)

    def test_login_forbidden_responses_explain_inactive_and_role_mismatch(self):
        with self.app.app_context():
            staff = User.query.filter_by(email="staff@authentication.test").one()
            staff.is_active = False
            db.session.commit()

        inactive = self.client.post(
            "/api/auth/login",
            json={
                "email": "staff@authentication.test",
                "password": "ValidPassword1!",
                "role": "staff",
            },
        )
        self.assertEqual(inactive.status_code, 403)
        self.assertIn("inactive", inactive.get_json()["message"].lower())

        mismatch = self.client.post(
            "/api/auth/login",
            json={
                "email": "student@authentication.test",
                "password": "ValidPassword1!",
                "role": "staff",
            },
        )
        self.assertEqual(mismatch.status_code, 403)
        self.assertIn("role", mismatch.get_json()["message"].lower())

    def test_wrong_password_is_unauthorized_not_forbidden(self):
        response = self.client.post(
            "/api/auth/login",
            json={
                "email": "student@authentication.test",
                "password": "WrongPassword1!",
                "role": "student",
            },
        )

        self.assertEqual(response.status_code, 401)
        self.assertIn("password", response.get_json()["message"].lower())


if __name__ == "__main__":
    unittest.main()
