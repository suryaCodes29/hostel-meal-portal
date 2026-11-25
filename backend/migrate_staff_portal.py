"""Approved Staff Portal persistence migration.

Dry run:
    python migrate_staff_portal.py --dry-run

Apply:
    python migrate_staff_portal.py --apply

Creates staff_settings and adds nullable expires_at/recipient_user_id columns.
No existing rows are deleted or overwritten.

Rollback:
    ALTER TABLE notifications DROP COLUMN recipient_user_id;
    ALTER TABLE announcements DROP COLUMN expires_at;
    DROP TABLE staff_settings;
"""

import argparse
from sqlalchemy import inspect, text
from app import app, db
from models import StaffSettings


def migrate(apply=False):
    with app.app_context():
        inspector = inspect(db.engine)
        announcement_columns = {c["name"] for c in inspector.get_columns("announcements")}
        notification_columns = {c["name"] for c in inspector.get_columns("notifications")}

        actions = []
        if "expires_at" not in announcement_columns:
            actions.append("ALTER TABLE announcements ADD COLUMN expires_at DATETIME NULL")
        else:
            print("already-present: announcements.expires_at")
        if "recipient_user_id" not in notification_columns:
            actions.append(
                "ALTER TABLE notifications ADD COLUMN recipient_user_id INTEGER NULL,"
                " ADD INDEX ix_notifications_recipient (recipient_user_id),"
                " ADD CONSTRAINT fk_notifications_recipient FOREIGN KEY"
                " (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE"
            )
        else:
            print("already-present: notifications.recipient_user_id")

        if not inspector.has_table("staff_settings"):
            actions.append("CREATE TABLE staff_settings")
        else:
            print("already-applied: staff_settings")

        if not actions:
            print("all-approved-changes-already-applied")
            return

        for action in actions:
            print("planned:" + action)

        if apply:
            with db.engine.begin() as connection:
                if "expires_at" not in announcement_columns:
                    connection.execute(text("ALTER TABLE announcements ADD COLUMN expires_at DATETIME NULL"))
                if "recipient_user_id" not in notification_columns:
                    connection.execute(text("ALTER TABLE notifications ADD COLUMN recipient_user_id INTEGER NULL"))
                    connection.execute(text("CREATE INDEX ix_notifications_recipient ON notifications(recipient_user_id)"))
                    connection.execute(
                        text(
                            "ALTER TABLE notifications ADD CONSTRAINT fk_notifications_recipient "
                            "FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE"
                        )
                    )
                if not inspector.has_table("staff_settings"):
                    StaffSettings.__table__.create(db.engine, checkfirst=True)
            print("migration-applied")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    migrate(apply=args.apply)
