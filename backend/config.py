import os
from urllib.parse import quote_plus

try:
    from dotenv import load_dotenv  # type: ignore[import-not-found]
except ModuleNotFoundError:  # pragma: no cover - optional dependency in production
    def load_dotenv(*args, **kwargs):
        return False


load_dotenv()


class Config:

    DB_USER = os.getenv(
        "DB_USER",
        "root"
    )

    DB_PASSWORD = os.getenv(
        "DB_PASSWORD",
        ""
    )

    DB_HOST = os.getenv(
        "DB_HOST",
        "localhost"
    )

    DB_NAME = os.getenv(
        "DB_NAME",
        "hostel_meal_portal"
    )

    ENCODED_PASSWORD = quote_plus(
        DB_PASSWORD
    )

    SQLALCHEMY_DATABASE_URI = (
        f"mysql+pymysql://"
        f"{DB_USER}:"
        f"{ENCODED_PASSWORD}"
        f"@{DB_HOST}/"
        f"{DB_NAME}"
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY = os.getenv(
        "JWT_SECRET_KEY",
        "change-this-secret-key"
    )