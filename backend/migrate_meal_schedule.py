
"""Add meal schedule columns without dropping or resetting existing data.

Run from the backend directory:
    python migrate_meal_schedule.py
"""

from app import app, db
from sqlalchemy import inspect, text


def migrate_meal_schedule():
    with app.app_context():
        inspector = inspect(db.engine)

        existing_columns = {
            column["name"]
            for column in inspector.get_columns("menus")
        }

        with db.engine.begin() as connection:

            if "start_time" not in existing_columns:
                connection.execute(
                    text(
                        "ALTER TABLE menus "
                        "ADD COLUMN start_time TIME NULL"
                    )
                )
                print("Added menus.start_time")
            else:
                print("menus.start_time already exists")

            if "end_time" not in existing_columns:
                connection.execute(
                    text(
                        "ALTER TABLE menus "
                        "ADD COLUMN end_time TIME NULL"
                    )
                )
                print("Added menus.end_time")
            else:
                print("menus.end_time already exists")

        print("Meal schedule migration completed.")
        print("Existing menu records and data were preserved.")


if __name__ == "__main__":
    migrate_meal_schedule()
