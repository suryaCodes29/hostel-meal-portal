from datetime import datetime

from flask_sqlalchemy import SQLAlchemy  # type: ignore[import-not-found]


db = SQLAlchemy()


# ============================================================
# USER
# ============================================================

class User(db.Model):

    __tablename__ = "users"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    name = db.Column(
        db.String(100),
        nullable=False
    )

    manager_id = db.Column(
        db.String(50),
        unique=True,
        nullable=True
    )

    student_id = db.Column(
        db.String(50),
        unique=True,
        nullable=True
    )

    staff_id = db.Column(
        db.String(50),
        unique=True,
        nullable=True
    )

    email = db.Column(
        db.String(150),
        nullable=False,
        unique=True
    )

    mobile = db.Column(
        db.String(15),
        nullable=True
    )

    password_hash = db.Column(
        db.String(255),
        nullable=False
    )

    role = db.Column(
        db.Enum(
            "manager",
            "staff",
            "student"
        ),
        nullable=False
    )

    staff_role = db.Column(
        db.String(50),
        nullable=True
    )

    hostel = db.Column(
        db.String(100),
        nullable=True
    )

    hostel_block = db.Column(
        db.String(100),
        nullable=True
    )

    mess_unit = db.Column(
        db.String(100),
        nullable=True
    )

    meal_category = db.Column(
        db.String(50),
        nullable=True
    )

    hostel_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "hostels.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    block_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "hostel_blocks.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    mess_unit_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "mess_units.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    is_active = db.Column(
        db.Boolean,
        default=True,
        nullable=False
    )

    must_change_password = db.Column(
        db.Boolean,
        default=True,
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    hostel_relation = db.relationship(
        "Hostel",
        foreign_keys=[hostel_id],
        back_populates="users"
    )

    block_relation = db.relationship(
        "HostelBlock",
        foreign_keys=[block_id],
        back_populates="users"
    )

    mess_unit_relation = db.relationship(
        "MessUnit",
        foreign_keys=[mess_unit_id],
        back_populates="users"
    )

    managed_hostels = db.relationship(
        "Hostel",
        foreign_keys="Hostel.manager_user_id",
        back_populates="manager",
        cascade="all, delete-orphan",
        passive_deletes=True
    )


# ============================================================
# HOSTEL
# ============================================================

class Hostel(db.Model):

    __tablename__ = "hostels"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    manager_user_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    name = db.Column(
        db.String(120),
        nullable=False
    )

    code = db.Column(
        db.String(30),
        nullable=False
    )

    address = db.Column(
        db.String(255),
        nullable=True
    )

    contact_number = db.Column(
        db.String(15),
        nullable=True
    )

    status = db.Column(
        db.Enum(
            "active",
            "inactive"
        ),
        default="active",
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint(
            "manager_user_id",
            "code",
            name="uq_manager_hostel_code"
        ),
    )

    blocks = db.relationship(
        "HostelBlock",
        back_populates="hostel",
        cascade="all, delete-orphan"
    )

    mess_units = db.relationship(
        "MessUnit",
        back_populates="hostel",
        cascade="all, delete-orphan"
    )

    users = db.relationship(
        "User",
        foreign_keys=[User.hostel_id],
        back_populates="hostel_relation"
    )

    manager = db.relationship(
        "User",
        foreign_keys=[manager_user_id],
        back_populates="managed_hostels"
    )

    menus = db.relationship(
        "Menu",
        back_populates="hostel"
    )

    forecasts = db.relationship(
        "Forecast",
        back_populates="hostel"
    )

    waste_records = db.relationship(
        "WasteRecord",
        back_populates="hostel"
    )


# ============================================================
# HOSTEL BLOCK
# ============================================================

class HostelBlock(db.Model):

    __tablename__ = "hostel_blocks"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    hostel_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "hostels.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    name = db.Column(
        db.String(80),
        nullable=False
    )

    code = db.Column(
        db.String(30),
        nullable=True
    )

    status = db.Column(
        db.Enum(
            "active",
            "inactive"
        ),
        default="active",
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint(
            "hostel_id",
            "name",
            name="uq_hostel_block_name"
        ),
    )

    hostel = db.relationship(
        "Hostel",
        back_populates="blocks"
    )

    users = db.relationship(
        "User",
        foreign_keys=[User.block_id],
        back_populates="block_relation"
    )

    mess_units = db.relationship(
        "MessUnit",
        back_populates="block"
    )


# ============================================================
# MESS UNIT
# ============================================================

class MessUnit(db.Model):

    __tablename__ = "mess_units"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    hostel_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "hostels.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    block_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "hostel_blocks.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    name = db.Column(
        db.String(120),
        nullable=False
    )

    unit_type = db.Column(
        db.Enum(
            "north",
            "south",
            "other"
        ),
        nullable=False
    )

    supported_categories = db.Column(
        db.String(50),
        nullable=False,
        default="both"
    )

    capacity = db.Column(
        db.Integer,
        nullable=True
    )

    supervisor_user_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    status = db.Column(
        db.Enum(
            "active",
            "inactive"
        ),
        default="active",
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint(
            "hostel_id",
            "unit_type",
            name="uq_hostel_mess_unit_type"
        ),
    )

    hostel = db.relationship(
        "Hostel",
        back_populates="mess_units"
    )

    block = db.relationship(
        "HostelBlock",
        back_populates="mess_units"
    )

    supervisor = db.relationship(
        "User",
        foreign_keys=[supervisor_user_id]
    )

    users = db.relationship(
        "User",
        foreign_keys=[User.mess_unit_id],
        back_populates="mess_unit_relation"
    )

    menus = db.relationship(
        "Menu",
        back_populates="mess_unit"
    )

    responses = db.relationship(
        "MealResponse",
        back_populates="mess_unit"
    )

    forecasts = db.relationship(
        "Forecast",
        back_populates="mess_unit"
    )

    waste_records = db.relationship(
        "WasteRecord",
        back_populates="mess_unit"
    )


# ============================================================
# MENU
# ============================================================

class Menu(db.Model):

    __tablename__ = "menus"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    hostel_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "hostels.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    mess_unit_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "mess_units.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    menu_date = db.Column(
        db.Date,
        nullable=False
    )

    meal = db.Column(
        db.Enum(
            "breakfast",
            "lunch",
            "snacks",
            "dinner"
        ),
        nullable=False
    )

    meal_category = db.Column(
        db.Enum(
            "veg",
            "non-veg"
        ),
        nullable=False
    )
    start_time = db.Column(
        db.Time,
        nullable=True
    )

    end_time = db.Column(
        db.Time,
        nullable=True
    )

    # Legacy snapshot retained for existing routes/pages.
    # New Menu Management APIs will also maintain structured item links.
    menu_items = db.Column(
        db.Text,
        nullable=False,
        default=""
    )

    response_cutoff = db.Column(
        db.DateTime,
        nullable=True
    )

    status = db.Column(
        db.Enum(
            "draft",
            "scheduled",
            "published",
            "unpublished",
            "completed"
        ),
        default="draft",
        nullable=False
    )

    created_by = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    published_at = db.Column(
        db.DateTime,
        nullable=True
    )

    published_by = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint(
            "hostel_id",
            "mess_unit_id",
            "menu_date",
            "meal",
            "meal_category",
            name="uq_menu_scope_date_meal_category"
        ),
        db.Index(
            "ix_menus_menu_date",
            "menu_date"
        ),
        db.Index(
            "ix_menus_status_date",
            "status",
            "menu_date"
        ),
    )

    hostel = db.relationship(
        "Hostel",
        back_populates="menus"
    )

    mess_unit = db.relationship(
        "MessUnit",
        back_populates="menus"
    )

    creator = db.relationship(
        "User",
        foreign_keys=[created_by]
    )

    publisher = db.relationship(
        "User",
        foreign_keys=[published_by]
    )

    responses = db.relationship(
        "MealResponse",
        back_populates="menu",
        cascade="all, delete-orphan"
    )

    item_links = db.relationship(
        "MenuMenuItem",
        back_populates="menu",
        cascade="all, delete-orphan",
        order_by="MenuMenuItem.display_order"
    )

    audience_notifications = db.relationship(
        "MenuNotification",
        back_populates="menu",
        cascade="all, delete-orphan"
    )


# ============================================================
# MENU ITEM MASTER
# ============================================================

class MenuItem(db.Model):

    __tablename__ = "menu_items"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    # NULL = global seeded catalog item.
    # Non-NULL = custom item owned by a specific Manager.
    manager_user_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=True
    )

    name = db.Column(
        db.String(150),
        nullable=False
    )

    item_type = db.Column(
        db.String(50),
        nullable=False
    )

    meal_category = db.Column(
        db.Enum(
            "veg",
            "non-veg",
            "both"
        ),
        nullable=False,
        default="veg"
    )

    image_url = db.Column(
        db.String(500),
        nullable=True
    )

    default_quantity = db.Column(
        db.Float,
        nullable=False,
        default=1.0
    )

    default_unit = db.Column(
        db.String(30),
        nullable=False,
        default="serving"
    )

    calories_per_serving = db.Column(
        db.Float,
        nullable=False,
        default=0.0
    )

    is_active = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint(
            "manager_user_id",
            "name",
            name="uq_menu_item_manager_name"
        ),
        db.Index(
            "ix_menu_items_manager_active",
            "manager_user_id",
            "is_active"
        ),
        db.Index(
            "ix_menu_items_name",
            "name"
        ),
    )

    manager = db.relationship(
        "User",
        foreign_keys=[manager_user_id]
    )

    menu_links = db.relationship(
        "MenuMenuItem",
        back_populates="menu_item"
    )

    template_links = db.relationship(
        "MenuTemplateItem",
        back_populates="menu_item"
    )


# ============================================================
# MENU <-> MENU ITEM ASSOCIATION
# ============================================================

class MenuMenuItem(db.Model):

    __tablename__ = "menu_menu_items"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    menu_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "menus.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    menu_item_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "menu_items.id",
            ondelete="RESTRICT"
        ),
        nullable=False
    )

    quantity_per_student = db.Column(
        db.Float,
        nullable=False
    )

    unit = db.Column(
        db.String(30),
        nullable=False
    )

    display_order = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint(
            "menu_id",
            "menu_item_id",
            name="uq_menu_menu_item"
        ),
        db.Index(
            "ix_menu_menu_items_menu_order",
            "menu_id",
            "display_order"
        ),
    )

    menu = db.relationship(
        "Menu",
        back_populates="item_links"
    )

    menu_item = db.relationship(
        "MenuItem",
        back_populates="menu_links"
    )


# ============================================================
# MENU TEMPLATE
# ============================================================

class MenuTemplate(db.Model):

    __tablename__ = "menu_templates"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    manager_user_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    name = db.Column(
        db.String(150),
        nullable=False
    )

    meal = db.Column(
        db.Enum(
            "breakfast",
            "lunch",
            "snacks",
            "dinner"
        ),
        nullable=False
    )

    meal_category = db.Column(
        db.Enum(
            "veg",
            "non-veg"
        ),
        nullable=False
    )

    description = db.Column(
        db.Text,
        nullable=True
    )

    is_active = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint(
            "manager_user_id",
            "name",
            name="uq_menu_template_manager_name"
        ),
        db.Index(
            "ix_menu_templates_manager_active",
            "manager_user_id",
            "is_active"
        ),
    )

    manager = db.relationship(
        "User",
        foreign_keys=[manager_user_id]
    )

    items = db.relationship(
        "MenuTemplateItem",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="MenuTemplateItem.display_order"
    )


# ============================================================
# MENU TEMPLATE ITEM
# ============================================================

class MenuTemplateItem(db.Model):

    __tablename__ = "menu_template_items"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    template_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "menu_templates.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    menu_item_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "menu_items.id",
            ondelete="RESTRICT"
        ),
        nullable=False
    )

    quantity_per_student = db.Column(
        db.Float,
        nullable=False
    )

    unit = db.Column(
        db.String(30),
        nullable=False
    )

    display_order = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint(
            "template_id",
            "menu_item_id",
            name="uq_menu_template_item"
        ),
        db.Index(
            "ix_menu_template_items_template_order",
            "template_id",
            "display_order"
        ),
    )

    template = db.relationship(
        "MenuTemplate",
        back_populates="items"
    )

    menu_item = db.relationship(
        "MenuItem",
        back_populates="template_links"
    )


# ============================================================
# MENU AUDIENCE NOTIFICATION
# ============================================================

class MenuNotification(db.Model):

    __tablename__ = "menu_notifications"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    menu_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "menus.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    recipient_user_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    notification_type = db.Column(
        db.String(50),
        nullable=False,
        default="menu_published"
    )

    title = db.Column(
        db.String(150),
        nullable=False
    )

    message = db.Column(
        db.String(500),
        nullable=False
    )

    is_read = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint(
            "menu_id",
            "recipient_user_id",
            "notification_type",
            name="uq_menu_recipient_notification"
        ),
        db.Index(
            "ix_menu_notifications_recipient_read",
            "recipient_user_id",
            "is_read"
        ),
    )

    menu = db.relationship(
        "Menu",
        back_populates="audience_notifications"
    )

    recipient = db.relationship(
        "User",
        foreign_keys=[recipient_user_id]
    )


# ============================================================
# MEAL RESPONSE
# ============================================================

class MealResponse(db.Model):

    __tablename__ = "meal_responses"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    menu_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "menus.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    student_user_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    mess_unit_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "mess_units.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    response = db.Column(
        db.Enum(
            "attending",
            "skipping"
        ),
        nullable=False
    )

    # Immutable menu snapshot retained for Student Meal History.
    # These fields allow historical response records to remain useful
    # even when the 40-day Menu cleanup removes the original Menu row.
    menu_date_snapshot = db.Column(
        db.Date,
        nullable=True
    )

    meal_snapshot = db.Column(
        db.String(30),
        nullable=True
    )

    meal_category_snapshot = db.Column(
        db.String(30),
        nullable=True
    )

    menu_items_snapshot = db.Column(
        db.Text,
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint(
            "menu_id",
            "student_user_id",
            name="uq_menu_student_response"
        ),
    )

    menu = db.relationship(
        "Menu",
        back_populates="responses"
    )

    mess_unit = db.relationship(
        "MessUnit",
        back_populates="responses"
    )

    student = db.relationship(
        "User",
        foreign_keys=[student_user_id]
    )


# ============================================================
# STAFF SETTINGS
# ============================================================

class StaffSettings(db.Model):

    __tablename__ = "staff_settings"

    id = db.Column(db.Integer, primary_key=True)
    staff_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    notifications_enabled = db.Column(db.Boolean, nullable=False, default=True)
    announcement_notifications = db.Column(db.Boolean, nullable=False, default=True)
    manager_notifications = db.Column(db.Boolean, nullable=False, default=True)
    meal_update_notifications = db.Column(db.Boolean, nullable=False, default=True)
    system_notifications = db.Column(db.Boolean, nullable=False, default=True)
    timezone = db.Column(db.String(50), nullable=False, default="Asia/Kolkata")
    language = db.Column(db.String(20), nullable=False, default="en")
    theme = db.Column(
        db.Enum("light", "dark", "system"),
        nullable=False,
        default="system",
    )
    compact_layout = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    staff = db.relationship("User", foreign_keys=[staff_user_id])


# ============================================================
# QR MEAL VERIFICATION
# ============================================================

class MealQRToken(db.Model):

    __tablename__ = "meal_qr_tokens"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    # The QR token itself is never stored.
    # Only its SHA-256 hash is stored in the database.
    token_hash = db.Column(
        db.String(64),
        unique=True,
        nullable=False,
        index=True
    )

    meal_response_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "meal_responses.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        unique=True
    )

    student_user_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    menu_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "menus.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    mess_unit_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "mess_units.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    expires_at = db.Column(
        db.DateTime,
        nullable=False
    )

    redeemed_at = db.Column(
        db.DateTime,
        nullable=True
    )

    redeemed_by_staff_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    __table_args__ = (
        db.Index(
            "ix_meal_qr_student_menu",
            "student_user_id",
            "menu_id"
        ),
    )


# ============================================================
# QR MEAL VERIFICATION AUDIT
# ============================================================

class MealQRVerification(db.Model):

    __tablename__ = "meal_qr_verifications"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    meal_response_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "meal_responses.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    student_user_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    menu_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "menus.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    mess_unit_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "mess_units.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    verified_by_staff_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    counter_category = db.Column(
        db.String(30),
        nullable=True
    )

    verification_status = db.Column(
        db.Enum(
            "approved",
            "denied",
            "already_served"
        ),
        nullable=False
    )

    denial_reason = db.Column(
        db.String(255),
        nullable=True
    )

    verified_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

# ============================================================
# STUDENT FEEDBACK
# ============================================================

class StudentFeedback(db.Model):

    __tablename__ = "student_feedback"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    student_user_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    menu_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "menus.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    hostel_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "hostels.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    mess_unit_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "mess_units.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    meal_date = db.Column(
        db.Date,
        nullable=False
    )

    meal = db.Column(
        db.String(30),
        nullable=False
    )

    meal_category = db.Column(
        db.String(30),
        nullable=True
    )

    category = db.Column(
        db.String(50),
        nullable=False
    )

    overall_rating = db.Column(
        db.Integer,
        nullable=False
    )

    taste_rating = db.Column(
        db.Integer,
        nullable=True
    )

    hygiene_rating = db.Column(
        db.Integer,
        nullable=True
    )

    quantity_rating = db.Column(
        db.Integer,
        nullable=True
    )

    comments = db.Column(
        db.String(2000),
        nullable=True
    )

    photo_path = db.Column(
        db.String(500),
        nullable=True
    )

    status = db.Column(
        db.Enum(
            "pending",
            "reviewed"
        ),
        nullable=False,
        default="pending"
    )

    staff_reply = db.Column(
        db.String(2000),
        nullable=True
    )

    replied_by = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="SET NULL"
        ),
        nullable=True
    )

    replied_at = db.Column(
        db.DateTime,
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    __table_args__ = (
        db.Index(
            "ix_student_feedback_student_date",
            "student_user_id",
            "meal_date"
        ),
        db.Index(
            "ix_student_feedback_scope",
            "hostel_id",
            "mess_unit_id",
            "meal_date"
        ),
        db.Index(
            "ix_student_feedback_status",
            "status"
        ),
    )

    student = db.relationship(
        "User",
        foreign_keys=[student_user_id]
    )

    menu = db.relationship(
        "Menu",
        foreign_keys=[menu_id]
    )

    hostel = db.relationship(
        "Hostel",
        foreign_keys=[hostel_id]
    )

    mess_unit = db.relationship(
        "MessUnit",
        foreign_keys=[mess_unit_id]
    )

    replier = db.relationship(
        "User",
        foreign_keys=[replied_by]
    )


# ============================================================
# STAFF FEEDBACK
# ============================================================

class StaffFeedback(db.Model):

    __tablename__ = "staff_feedback"

    id = db.Column(db.Integer, primary_key=True)
    staff_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    manager_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    hostel_id = db.Column(
        db.Integer,
        db.ForeignKey("hostels.id", ondelete="SET NULL"),
        nullable=True,
    )
    mess_unit_id = db.Column(
        db.Integer,
        db.ForeignKey("mess_units.id", ondelete="SET NULL"),
        nullable=True,
    )
    menu_id = db.Column(
        db.Integer,
        db.ForeignKey("menus.id", ondelete="SET NULL"),
        nullable=True,
    )
    meal_category = db.Column(db.String(30), nullable=True)
    category = db.Column(db.String(50), nullable=False)
    subject = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    status = db.Column(
        db.Enum("pending", "reviewed", "resolved"),
        nullable=False,
        default="pending",
    )
    manager_reply = db.Column(db.Text, nullable=True)
    replied_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    replied_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    __table_args__ = (
        db.Index("ix_staff_feedback_staff_date", "staff_user_id", "created_at"),
        db.Index("ix_staff_feedback_scope", "hostel_id", "mess_unit_id", "status"),
    )

    staff = db.relationship("User", foreign_keys=[staff_user_id])
    manager = db.relationship("User", foreign_keys=[manager_user_id])
    hostel = db.relationship("Hostel", foreign_keys=[hostel_id])
    mess_unit = db.relationship("MessUnit", foreign_keys=[mess_unit_id])
    menu = db.relationship("Menu", foreign_keys=[menu_id])
    replier = db.relationship("User", foreign_keys=[replied_by])


# ============================================================
# ANNOUNCEMENT
# ============================================================

class Announcement(db.Model):

    __tablename__ = "announcements"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    manager_user_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    recipient_user_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=True
    )

    hostel_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "hostels.id",
            ondelete="CASCADE"
        ),
        nullable=True
    )

    mess_unit_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "mess_units.id",
            ondelete="CASCADE"
        ),
        nullable=True
    )

    meal_category = db.Column(
        db.String(30),
        nullable=True
    )

    is_general = db.Column(
        db.Boolean,
        nullable=False,
        default=False
    )

    title = db.Column(
        db.String(200),
        nullable=False
    )

    message = db.Column(
        db.Text,
        nullable=False
    )

    sender_name = db.Column(
        db.String(120),
        nullable=True
    )

    priority = db.Column(
        db.Enum(
            "normal",
            "important",
            "urgent"
        ),
        nullable=False,
        default="normal"
    )

    attachment_url = db.Column(
        db.String(500),
        nullable=True
    )

    expires_at = db.Column(
        db.DateTime,
        nullable=True
    )

    status = db.Column(
        db.Enum(
            "draft",
            "published",
            "unpublished"
        ),
        nullable=False,
        default="draft"
    )

    published_at = db.Column(
        db.DateTime,
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    __table_args__ = (
        db.Index(
            "ix_announcements_manager_status",
            "manager_user_id",
            "status"
        ),
        db.Index(
            "ix_announcements_recipient",
            "recipient_user_id",
            "status"
        ),
        db.Index(
            "ix_announcements_scope",
            "hostel_id",
            "mess_unit_id",
            "meal_category",
            "status"
        ),
        db.Index(
            "ix_announcements_published_at",
            "published_at"
        ),
    )

    manager = db.relationship(
        "User",
        foreign_keys=[manager_user_id]
    )

    recipient = db.relationship(
        "User",
        foreign_keys=[recipient_user_id]
    )

    hostel = db.relationship(
        "Hostel",
        foreign_keys=[hostel_id]
    )

    mess_unit = db.relationship(
        "MessUnit",
        foreign_keys=[mess_unit_id]
    )

    read_records = db.relationship(
        "AnnouncementRead",
        back_populates="announcement",
        cascade="all, delete-orphan",
        passive_deletes=True
    )


# ============================================================
# ANNOUNCEMENT READ STATE
# ============================================================

class AnnouncementRead(db.Model):

    __tablename__ = "announcement_reads"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    announcement_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "announcements.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    student_user_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    read_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint(
            "announcement_id",
            "student_user_id",
            name="uq_announcement_student_read"
        ),
        db.Index(
            "ix_announcement_reads_student",
            "student_user_id",
            "read_at"
        ),
    )

    announcement = db.relationship(
        "Announcement",
        back_populates="read_records"
    )

    student = db.relationship(
        "User",
        foreign_keys=[student_user_id]
    )


# ============================================================
# STUDENT SETTINGS
# ============================================================

class StudentSettings(db.Model):

    __tablename__ = "student_settings"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    student_user_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False,
        unique=True
    )

    notifications_enabled = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    menu_publication_notifications = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    response_cutoff_reminders = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    announcement_notifications = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    theme = db.Column(
        db.Enum(
            "system",
            "light",
            "dark"
        ),
        nullable=False,
        default="light"
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    student = db.relationship(
        "User",
        foreign_keys=[student_user_id]
    )


# ============================================================
# FORECAST
# ============================================================

class Forecast(db.Model):

    __tablename__ = "forecasts"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    hostel_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "hostels.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    mess_unit_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "mess_units.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    forecast_date = db.Column(
        db.Date,
        nullable=False
    )

    meal = db.Column(
        db.Enum(
            "breakfast",
            "lunch",
            "snacks",
            "dinner"
        ),
        nullable=False
    )

    meal_category = db.Column(
        db.Enum(
            "veg",
            "non-veg"
        ),
        nullable=False
    )

    predicted_students = db.Column(
        db.Integer,
        nullable=False
    )

    actual_students = db.Column(
        db.Integer,
        nullable=True
    )

    preparation_status = db.Column(
        db.Enum(
            "planned",
            "in_progress",
            "completed"
        ),
        default="planned",
        nullable=False
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    hostel = db.relationship(
        "Hostel",
        back_populates="forecasts"
    )

    mess_unit = db.relationship(
        "MessUnit",
        back_populates="forecasts"
    )


# ============================================================
# WASTE RECORD
# ============================================================

class WasteRecord(db.Model):

    __tablename__ = "waste_records"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    hostel_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "hostels.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    mess_unit_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "mess_units.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    record_date = db.Column(
        db.Date,
        nullable=False
    )

    meal = db.Column(
        db.Enum(
            "breakfast",
            "lunch",
            "snacks",
            "dinner"
        ),
        nullable=False
    )

    meal_category = db.Column(
        db.Enum(
            "veg",
            "non-veg"
        ),
        nullable=False
    )

    quantity_prepared = db.Column(
        db.Float,
        nullable=True
    )

    quantity_served = db.Column(
        db.Float,
        nullable=True
    )

    waste_kg = db.Column(
        db.Float,
        nullable=False,
        default=0
    )

    students_served = db.Column(
        db.Integer,
        nullable=True
    )

    shortage_occurred = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    hostel = db.relationship(
        "Hostel",
        back_populates="waste_records"
    )

    mess_unit = db.relationship(
        "MessUnit",
        back_populates="waste_records"
    )


# ============================================================
# NOTIFICATION
# ============================================================

class Notification(db.Model):

    __tablename__ = "notifications"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    manager_user_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=False
    )

    recipient_user_id = db.Column(
        db.Integer,
        db.ForeignKey(
            "users.id",
            ondelete="CASCADE"
        ),
        nullable=True
    )

    notification_type = db.Column(
        db.String(50),
        nullable=False
    )

    title = db.Column(
        db.String(150),
        nullable=False
    )

    message = db.Column(
        db.String(500),
        nullable=False
    )

    is_read = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    manager = db.relationship(
        "User",
        foreign_keys=[manager_user_id]
    )


# ============================================================
# MENU HISTORY CLEANUP AUDIT
# ============================================================

class CleanupAudit(db.Model):

    __tablename__ = "cleanup_audits"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    job_id = db.Column(
        db.String(64),
        nullable=False,
        unique=True
    )

    executed_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    completed_at = db.Column(
        db.DateTime,
        nullable=True
    )

    cutoff_date = db.Column(
        db.Date,
        nullable=False
    )

    menus_deleted = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    dependent_rows_deleted = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    status = db.Column(
        db.String(20),
        nullable=False
    )

    dry_run = db.Column(
        db.Boolean,
        nullable=False,
        default=False
    )

    error_message = db.Column(
        db.String(500),
        nullable=True
    )

    __table_args__ = (
        db.Index(
            "ix_cleanup_audits_executed_at",
            "executed_at"
        ),
        db.Index(
            "ix_cleanup_audits_status",
            "status"
        ),
    )