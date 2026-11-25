from app import app, db

from models import MealQRToken, MealQRVerification

from sqlalchemy import inspect


with app.app_context():

    print("=" * 50)
    print("QR MEAL VERIFICATION DATABASE MIGRATION")
    print("=" * 50)

    # Create only missing tables.
    # Existing database tables and data will NOT be deleted.
    db.create_all()

    inspector = inspect(db.engine)

    tables = inspector.get_table_names()

    required_tables = [
        "meal_qr_tokens",
        "meal_qr_verifications"
    ]

    print("\nChecking QR tables...\n")

    for table in required_tables:

        if table in tables:
            print(f"SUCCESS: {table} created/existing")
        else:
            print(f"ERROR: {table} missing")

    print("\nMigration completed!")