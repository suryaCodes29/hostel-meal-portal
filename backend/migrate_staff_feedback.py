"""Create the approved staff_feedback table without changing existing data.

Run only after reviewing/approving the migration plan:
    python migrate_staff_feedback.py --dry-run
    python migrate_staff_feedback.py --apply

Rollback:
    DROP TABLE staff_feedback

Only this table is created. Existing tables and records are not changed.
"""

import argparse

from app import app, db
from models import StaffFeedback
from sqlalchemy import inspect


def migrate(apply=False):
    with app.app_context():
        inspector = inspect(db.engine)
        exists = inspector.has_table("staff_feedback")
        if exists:
            print("already-applied")
            return
        print("planned:create staff_feedback")
        if apply:
            StaffFeedback.__table__.create(db.engine, checkfirst=True)
            print("created")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    migrate(apply=args.apply)
