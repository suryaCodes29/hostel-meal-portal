import importlib
import sys

from pathlib import Path

from sqlalchemy import (
    func,
    inspect,
)


# ============================================================
# BACKEND IMPORT PATH
# ============================================================

BACKEND_DIR = (
    Path(__file__)
    .resolve()
    .parent
)

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(
        0,
        str(BACKEND_DIR)
    )


from models import (
    MenuItem,
    db,
)


# ============================================================
# FOOD ITEM MASTER DATA
# ============================================================

MENU_ITEMS = [
    {
        "name": "Chicken Biryani",
        "item_type": "Main Course",
        "meal_category": "non-veg",
        "default_quantity": 1.0,
        "default_unit": "serving",
        "calories_per_serving": 420.0,
    },
    {
        "name": "Chicken Curry",
        "item_type": "Curry",
        "meal_category": "non-veg",
        "default_quantity": 150.0,
        "default_unit": "g",
        "calories_per_serving": 260.0,
    },
    {
        "name": "Mutton Curry",
        "item_type": "Curry",
        "meal_category": "non-veg",
        "default_quantity": 150.0,
        "default_unit": "g",
        "calories_per_serving": 310.0,
    },
    {
        "name": "Fish Curry",
        "item_type": "Curry",
        "meal_category": "non-veg",
        "default_quantity": 150.0,
        "default_unit": "g",
        "calories_per_serving": 240.0,
    },
    {
        "name": "Egg Curry",
        "item_type": "Curry",
        "meal_category": "non-veg",
        "default_quantity": 1.0,
        "default_unit": "serving",
        "calories_per_serving": 210.0,
    },
    {
        "name": "Boiled Egg",
        "item_type": "Side Dish",
        "meal_category": "non-veg",
        "default_quantity": 1.0,
        "default_unit": "piece",
        "calories_per_serving": 78.0,
    },
    {
        "name": "Dal Tadka",
        "item_type": "Curry",
        "meal_category": "veg",
        "default_quantity": 150.0,
        "default_unit": "g",
        "calories_per_serving": 180.0,
    },
    {
        "name": "Sambar",
        "item_type": "Curry",
        "meal_category": "veg",
        "default_quantity": 150.0,
        "default_unit": "ml",
        "calories_per_serving": 120.0,
    },
    {
        "name": "Rasam",
        "item_type": "Curry",
        "meal_category": "veg",
        "default_quantity": 120.0,
        "default_unit": "ml",
        "calories_per_serving": 70.0,
    },
    {
        "name": "Vegetable Curry",
        "item_type": "Curry",
        "meal_category": "veg",
        "default_quantity": 120.0,
        "default_unit": "g",
        "calories_per_serving": 145.0,
    },
    {
        "name": "Paneer Curry",
        "item_type": "Curry",
        "meal_category": "veg",
        "default_quantity": 150.0,
        "default_unit": "g",
        "calories_per_serving": 280.0,
    },
    {
        "name": "Jeera Rice",
        "item_type": "Rice",
        "meal_category": "veg",
        "default_quantity": 200.0,
        "default_unit": "g",
        "calories_per_serving": 260.0,
    },
    {
        "name": "Plain Rice",
        "item_type": "Rice",
        "meal_category": "veg",
        "default_quantity": 200.0,
        "default_unit": "g",
        "calories_per_serving": 260.0,
    },
    {
        "name": "Curd Rice",
        "item_type": "Rice",
        "meal_category": "veg",
        "default_quantity": 200.0,
        "default_unit": "g",
        "calories_per_serving": 230.0,
    },
    {
        "name": "Chapati",
        "item_type": "Bread",
        "meal_category": "veg",
        "default_quantity": 2.0,
        "default_unit": "piece",
        "calories_per_serving": 240.0,
    },
    {
        "name": "Poori",
        "item_type": "Bread",
        "meal_category": "veg",
        "default_quantity": 3.0,
        "default_unit": "piece",
        "calories_per_serving": 300.0,
    },
    {
        "name": "Parotta",
        "item_type": "Bread",
        "meal_category": "veg",
        "default_quantity": 2.0,
        "default_unit": "piece",
        "calories_per_serving": 320.0,
    },
    {
        "name": "Idli",
        "item_type": "Main Course",
        "meal_category": "veg",
        "default_quantity": 3.0,
        "default_unit": "piece",
        "calories_per_serving": 175.0,
    },
    {
        "name": "Dosa",
        "item_type": "Main Course",
        "meal_category": "veg",
        "default_quantity": 2.0,
        "default_unit": "piece",
        "calories_per_serving": 260.0,
    },
    {
        "name": "Upma",
        "item_type": "Main Course",
        "meal_category": "veg",
        "default_quantity": 200.0,
        "default_unit": "g",
        "calories_per_serving": 240.0,
    },
    {
        "name": "Pongal",
        "item_type": "Main Course",
        "meal_category": "veg",
        "default_quantity": 200.0,
        "default_unit": "g",
        "calories_per_serving": 280.0,
    },
    {
        "name": "Lemon Rice",
        "item_type": "Rice",
        "meal_category": "veg",
        "default_quantity": 200.0,
        "default_unit": "g",
        "calories_per_serving": 270.0,
    },
    {
        "name": "Tomato Rice",
        "item_type": "Rice",
        "meal_category": "veg",
        "default_quantity": 200.0,
        "default_unit": "g",
        "calories_per_serving": 260.0,
    },
    {
        "name": "Vegetable Biryani",
        "item_type": "Main Course",
        "meal_category": "veg",
        "default_quantity": 1.0,
        "default_unit": "serving",
        "calories_per_serving": 350.0,
    },
    {
        "name": "Raita",
        "item_type": "Side Dish",
        "meal_category": "veg",
        "default_quantity": 80.0,
        "default_unit": "g",
        "calories_per_serving": 70.0,
    },
    {
        "name": "Curd",
        "item_type": "Side Dish",
        "meal_category": "veg",
        "default_quantity": 100.0,
        "default_unit": "g",
        "calories_per_serving": 95.0,
    },
    {
        "name": "Salad",
        "item_type": "Salad",
        "meal_category": "veg",
        "default_quantity": 80.0,
        "default_unit": "g",
        "calories_per_serving": 45.0,
    },
    {
        "name": "Pickle",
        "item_type": "Side Dish",
        "meal_category": "veg",
        "default_quantity": 20.0,
        "default_unit": "g",
        "calories_per_serving": 30.0,
    },
    {
        "name": "Papad",
        "item_type": "Side Dish",
        "meal_category": "veg",
        "default_quantity": 1.0,
        "default_unit": "piece",
        "calories_per_serving": 45.0,
    },
    {
        "name": "Tea",
        "item_type": "Beverage",
        "meal_category": "veg",
        "default_quantity": 150.0,
        "default_unit": "ml",
        "calories_per_serving": 90.0,
    },
    {
        "name": "Coffee",
        "item_type": "Beverage",
        "meal_category": "veg",
        "default_quantity": 150.0,
        "default_unit": "ml",
        "calories_per_serving": 95.0,
    },
    {
        "name": "Milk",
        "item_type": "Beverage",
        "meal_category": "veg",
        "default_quantity": 200.0,
        "default_unit": "ml",
        "calories_per_serving": 125.0,
    },
    {
        "name": "Buttermilk",
        "item_type": "Beverage",
        "meal_category": "veg",
        "default_quantity": 200.0,
        "default_unit": "ml",
        "calories_per_serving": 70.0,
    },
    {
        "name": "Fruit Juice",
        "item_type": "Beverage",
        "meal_category": "veg",
        "default_quantity": 200.0,
        "default_unit": "ml",
        "calories_per_serving": 110.0,
    },
    {
        "name": "Banana",
        "item_type": "Dessert",
        "meal_category": "veg",
        "default_quantity": 1.0,
        "default_unit": "piece",
        "calories_per_serving": 105.0,
    },
    {
        "name": "Gulab Jamun",
        "item_type": "Dessert",
        "meal_category": "veg",
        "default_quantity": 2.0,
        "default_unit": "piece",
        "calories_per_serving": 300.0,
    },
    {
        "name": "Payasam",
        "item_type": "Dessert",
        "meal_category": "veg",
        "default_quantity": 120.0,
        "default_unit": "ml",
        "calories_per_serving": 220.0,
    },
    {
        "name": "Ice Cream",
        "item_type": "Dessert",
        "meal_category": "veg",
        "default_quantity": 1.0,
        "default_unit": "serving",
        "calories_per_serving": 180.0,
    },
]


# ============================================================
# FLASK APP LOADER
# ============================================================

def load_flask_app():
    """
    Load the project's existing Flask application.

    Database credentials remain inside the existing project
    configuration. They are not duplicated in this seed file.
    """

    candidates = [
        "app",
        "run",
        "main",
    ]

    errors = []

    for module_name in candidates:

        try:
            module = importlib.import_module(
                module_name
            )

        except ModuleNotFoundError as error:

            if error.name == module_name:
                errors.append(
                    (
                        f"{module_name}: "
                        "module not found"
                    )
                )
                continue

            raise

        create_app = getattr(
            module,
            "create_app",
            None
        )

        if callable(create_app):

            app = create_app()

            if hasattr(
                app,
                "app_context"
            ):
                return app

        app = getattr(
            module,
            "app",
            None
        )

        if (
            app is not None
            and hasattr(
                app,
                "app_context"
            )
        ):
            return app

        errors.append(
            (
                f"{module_name}: "
                "no Flask app or create_app() found"
            )
        )

    raise RuntimeError(
        (
            "Unable to load the existing Flask application.\n"
            "Tried:\n- "
            + "\n- ".join(
                errors
            )
        )
    )


# ============================================================
# SCHEMA CHECK
# ============================================================

def verify_menu_item_schema():

    inspector = inspect(
        db.engine
    )

    existing_tables = set(
        inspector.get_table_names()
    )

    if (
        "menu_items"
        not in existing_tables
    ):
        raise RuntimeError(
            (
                "menu_items table does not exist. "
                "Run "
                "'python "
                "migrate_menu_management_schema.py "
                "--apply' first."
            )
        )

    columns = {
        column["name"]
        for column
        in inspector.get_columns(
            "menu_items"
        )
    }

    required_columns = {
        "id",
        "manager_user_id",
        "name",
        "item_type",
        "meal_category",
        "image_url",
        "default_quantity",
        "default_unit",
        "calories_per_serving",
        "is_active",
    }

    missing_columns = (
        required_columns
        - columns
    )

    if missing_columns:
        raise RuntimeError(
            (
                "menu_items table is incomplete. "
                "Missing column(s): "
                + ", ".join(
                    sorted(
                        missing_columns
                    )
                )
            )
        )


# ============================================================
# VALIDATION
# ============================================================

def validate_seed_catalog():

    seen_names = set()

    allowed_categories = {
        "veg",
        "non-veg",
        "both",
    }

    allowed_units = {
        "g",
        "ml",
        "piece",
        "serving",
    }

    for index, item in enumerate(
        MENU_ITEMS,
        start=1,
    ):

        name = str(
            item.get(
                "name",
                ""
            )
        ).strip()

        item_type = str(
            item.get(
                "item_type",
                ""
            )
        ).strip()

        category = str(
            item.get(
                "meal_category",
                ""
            )
        ).strip()

        unit = str(
            item.get(
                "default_unit",
                ""
            )
        ).strip()

        quantity = item.get(
            "default_quantity"
        )

        calories = item.get(
            "calories_per_serving"
        )

        if not name:
            raise ValueError(
                (
                    "Seed item "
                    f"#{index} has no name."
                )
            )

        normalized_name = (
            name.casefold()
        )

        if normalized_name in seen_names:
            raise ValueError(
                (
                    "Duplicate seed item name: "
                    f"{name}"
                )
            )

        seen_names.add(
            normalized_name
        )

        if not item_type:
            raise ValueError(
                (
                    f"{name}: item_type "
                    "is required."
                )
            )

        if category not in allowed_categories:
            raise ValueError(
                (
                    f"{name}: invalid "
                    "meal_category."
                )
            )

        if unit not in allowed_units:
            raise ValueError(
                (
                    f"{name}: invalid "
                    "default_unit."
                )
            )

        try:
            quantity = float(
                quantity
            )

        except (
            TypeError,
            ValueError,
        ) as error:
            raise ValueError(
                (
                    f"{name}: invalid "
                    "default_quantity."
                )
            ) from error

        if quantity <= 0:
            raise ValueError(
                (
                    f"{name}: "
                    "default_quantity "
                    "must be positive."
                )
            )

        try:
            calories = float(
                calories
            )

        except (
            TypeError,
            ValueError,
        ) as error:
            raise ValueError(
                (
                    f"{name}: invalid "
                    "calories_per_serving."
                )
            ) from error

        if calories < 0:
            raise ValueError(
                (
                    f"{name}: calories "
                    "cannot be negative."
                )
            )


# ============================================================
# SEED
# ============================================================

def seed_global_menu_items():

    created = 0
    updated = 0
    unchanged = 0

    for seed_item in MENU_ITEMS:

        name = (
            seed_item["name"]
            .strip()
        )

        existing = (
            MenuItem.query
            .filter(
                MenuItem.manager_user_id
                .is_(None),

                func.lower(
                    MenuItem.name
                )
                == name.lower(),
            )
            .first()
        )

        desired_values = {
            "name":
                name,

            "item_type":
                seed_item[
                    "item_type"
                ],

            "meal_category":
                seed_item[
                    "meal_category"
                ],

            "image_url":
                None,

            "default_quantity":
                float(
                    seed_item[
                        "default_quantity"
                    ]
                ),

            "default_unit":
                seed_item[
                    "default_unit"
                ],

            "calories_per_serving":
                float(
                    seed_item[
                        "calories_per_serving"
                    ]
                ),

            "is_active":
                True,
        }

        if existing is None:

            item = MenuItem(
                manager_user_id=None,
                **desired_values,
            )

            db.session.add(
                item
            )

            created += 1

            continue

        changed = False

        for (
            field_name,
            expected_value,
        ) in desired_values.items():

            current_value = getattr(
                existing,
                field_name
            )

            if field_name in {
                "default_quantity",
                "calories_per_serving",
            }:
                current_value = float(
                    current_value or 0
                )

                expected_value = float(
                    expected_value
                )

            if (
                current_value
                != expected_value
            ):

                setattr(
                    existing,
                    field_name,
                    expected_value,
                )

                changed = True

        if changed:
            updated += 1

        else:
            unchanged += 1

    db.session.commit()

    return {
        "created":
            created,

        "updated":
            updated,

        "unchanged":
            unchanged,

        "total":
            len(
                MENU_ITEMS
            ),
    }


# ============================================================
# VERIFY
# ============================================================

def verify_seed():

    missing_items = []

    duplicate_items = []

    for seed_item in MENU_ITEMS:

        name = (
            seed_item["name"]
            .strip()
        )

        matches = (
            MenuItem.query
            .filter(
                MenuItem.manager_user_id
                .is_(None),

                func.lower(
                    MenuItem.name
                )
                == name.lower(),
            )
            .all()
        )

        if not matches:
            missing_items.append(
                name
            )

        elif len(matches) > 1:
            duplicate_items.append(
                {
                    "name":
                        name,

                    "ids": [
                        item.id
                        for item
                        in matches
                    ],
                }
            )

    if missing_items:

        raise RuntimeError(
            (
                "Menu catalog verification failed. "
                "Missing item(s): "
                + ", ".join(
                    missing_items
                )
            )
        )

    if duplicate_items:

        print()

        print(
            (
                "WARNING: Existing duplicate "
                "global Menu Items were found."
            )
        )

        print(
            (
                "This seed script does not "
                "silently delete existing rows."
            )
        )

        for duplicate in duplicate_items:

            print(
                (
                    "  - "
                    f"{duplicate['name']} "
                    "IDs: "
                    + ", ".join(
                        str(item_id)
                        for item_id
                        in duplicate["ids"]
                    )
                )
            )

    global_item_count = (
        MenuItem.query
        .filter(
            MenuItem.manager_user_id
            .is_(None)
        )
        .count()
    )

    active_global_item_count = (
        MenuItem.query
        .filter(
            MenuItem.manager_user_id
            .is_(None),

            MenuItem.is_active
            .is_(True),
        )
        .count()
    )

    return {
        "globalItemCount":
            int(
                global_item_count
            ),

        "activeGlobalItemCount":
            int(
                active_global_item_count
            ),

        "requiredSeedItems":
            len(
                MENU_ITEMS
            ),

        "missingSeedItems":
            len(
                missing_items
            ),

        "duplicateSeedNames":
            len(
                duplicate_items
            ),
    }


# ============================================================
# OUTPUT
# ============================================================

def print_heading(
    title
):

    print()

    print(
        "=" * 72
    )

    print(
        title
    )

    print(
        "=" * 72
    )


# ============================================================
# MAIN
# ============================================================

def main():

    print_heading(
        "MENU ITEM MASTER SEED"
    )

    try:

        validate_seed_catalog()

        app = load_flask_app()

        with app.app_context():

            verify_menu_item_schema()

            result = (
                seed_global_menu_items()
            )

            verification = (
                verify_seed()
            )

        print(
            (
                "Menu Item catalog seed "
                "completed successfully."
            )
        )

        print()

        print(
            (
                "Created:   "
                f"{result['created']}"
            )
        )

        print(
            (
                "Updated:   "
                f"{result['updated']}"
            )
        )

        print(
            (
                "Unchanged: "
                f"{result['unchanged']}"
            )
        )

        print(
            (
                "Required:  "
                f"{result['total']}"
            )
        )

        print()

        print(
            (
                "Global Menu Items in DB: "
                f"{verification['globalItemCount']}"
            )
        )

        print(
            (
                "Active Global Items:     "
                f"{verification['activeGlobalItemCount']}"
            )
        )

        print(
            (
                "Missing Required Items:  "
                f"{verification['missingSeedItems']}"
            )
        )

        print(
            (
                "Duplicate Seed Names:    "
                f"{verification['duplicateSeedNames']}"
            )
        )

        print()

        print(
            (
                "Running this script again "
                "is safe and will not create "
                "a second copy of the normal "
                "seed catalog."
            )
        )

    except Exception as error:

        db.session.rollback()

        print()

        print(
            (
                "MENU CATALOG SEED FAILED: "
                f"{type(error).__name__}: "
                f"{error}"
            )
        )

        sys.exit(1)


if __name__ == "__main__":
    main()