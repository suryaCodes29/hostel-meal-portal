import os
import unittest


os.environ["DISABLE_MENU_CLEANUP_SCHEDULER"] = "1"

from app import app


def _raise_test_server_error():
    raise RuntimeError("private test-only server failure")


def _return_test_forbidden():
    return {"message": "Test access denied."}, 403


if "cors_test_server_error" not in app.view_functions:
    app.add_url_rule(
        "/api/__cors_test_server_error",
        endpoint="cors_test_server_error",
        view_func=_raise_test_server_error,
    )

if "cors_test_forbidden" not in app.view_functions:
    app.add_url_rule(
        "/api/__cors_test_forbidden",
        endpoint="cors_test_forbidden",
        view_func=_return_test_forbidden,
    )


class CorsConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_manager_staff_preflight_allows_both_vite_origins(self):
        for origin in (
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ):
            with self.subTest(origin=origin):
                response = self.client.options(
                    "/api/manager/staff",
                    headers={
                        "Origin": origin,
                        "Access-Control-Request-Method": "POST",
                        "Access-Control-Request-Headers": "authorization,content-type",
                    },
                )

                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    response.headers.get("Access-Control-Allow-Origin"),
                    origin,
                )
                methods = {
                    method.strip()
                    for method in response.headers[
                        "Access-Control-Allow-Methods"
                    ].split(",")
                }
                self.assertTrue(
                    {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}
                    .issubset(methods)
                )
                allowed_headers = {
                    header.strip().lower()
                    for header in response.headers[
                        "Access-Control-Allow-Headers"
                    ].split(",")
                }
                self.assertTrue(
                    {"content-type", "authorization"}.issubset(allowed_headers)
                )
                self.assertNotIn("Access-Control-Allow-Credentials", response.headers)

    def test_cors_does_not_bypass_manager_authentication(self):
        response = self.client.post(
            "/api/manager/staff",
            json={},
            headers={"Origin": "http://localhost:5173"},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.headers.get("Access-Control-Allow-Origin"),
            "http://localhost:5173",
        )

    def test_portal_preflights_allow_authorized_api_headers(self):
        paths = (
            "/api/student/announcements",
            "/api/student/dashboard",
            "/api/student/settings",
            "/api/staff/announcements",
            "/api/staff/settings",
        )
        for origin in (
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ):
            for path in paths:
                with self.subTest(origin=origin, path=path):
                    response = self.client.options(
                        path,
                        headers={
                            "Origin": origin,
                            "Access-Control-Request-Method": "GET",
                            "Access-Control-Request-Headers": "authorization,content-type",
                        },
                    )

                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(
                        response.headers.get("Access-Control-Allow-Origin"),
                        origin,
                    )
                    self.assertIn(
                        "authorization",
                        response.headers.get(
                            "Access-Control-Allow-Headers", ""
                        ).lower(),
                    )

    def test_api_error_statuses_keep_cors_and_safe_json(self):
        origin = "http://localhost:5173"
        requests = (
            ("post", "/api/auth/login", {"json": {}}, 400),
            ("get", "/api/staff/profile", {}, 401),
            ("get", "/api/__cors_test_forbidden", {}, 403),
            ("get", "/api/not-a-real-endpoint", {}, 404),
            ("get", "/api/__cors_test_server_error", {}, 500),
        )

        for method, path, kwargs, expected_status in requests:
            with self.subTest(path=path):
                response = getattr(self.client, method)(
                    path,
                    headers={"Origin": origin},
                    **kwargs,
                )
                self.assertEqual(response.status_code, expected_status)
                self.assertEqual(
                    response.headers.get("Access-Control-Allow-Origin"),
                    origin,
                )
                self.assertNotIn(
                    "private test-only server failure",
                    response.get_data(as_text=True),
                )

                if expected_status in {404, 500}:
                    self.assertEqual(
                        response.mimetype,
                        "application/json",
                    )

    def test_unlisted_origin_is_not_allowed(self):
        response = self.client.options(
            "/api/manager/staff",
            headers={
                "Origin": "http://untrusted.example",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )

        self.assertNotIn("Access-Control-Allow-Origin", response.headers)


if __name__ == "__main__":
    unittest.main()
