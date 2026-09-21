import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Clock3,
  Copy,
  Edit3,
  Eye,
  ImageIcon,
  LayoutTemplate,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createPortal,
} from "react-dom";

import {
  useManager,
} from "../../context/ManagerContext";

import {
  buildPermanentDeleteBody,
  createPermanentDeleteRequestGuard,
  getPermanentDeleteErrorMessage,
  isPermanentDeleteConfirmationValid,
} from "../../utils/permanentDelete";

import "./menuManagement.css";


/* ============================================================
   CONSTANTS
============================================================ */

const MEALS = [
  {
    value: "breakfast",
    label: "Breakfast",
  },
  {
    value: "lunch",
    label: "Lunch",
  },
  {
    value: "snacks",
    label: "Snacks",
  },
  {
    value: "dinner",
    label: "Dinner",
  },
];


const CATEGORIES = [
  {
    value: "veg",
    label: "Veg",
  },
  {
    value: "non-veg",
    label: "Non-Veg",
  },
];


const FOOD_CATEGORIES = [
  {
    value: "veg",
    label: "Veg",
  },
  {
    value: "non-veg",
    label: "Non-Veg",
  },
  {
    value: "both",
    label: "Both",
  },
];


const ITEM_TYPES = [
  "Main Course",
  "Side Dish",
  "Rice",
  "Bread",
  "Curry",
  "Beverage",
  "Dessert",
  "Salad",
  "Other",
];


const UNITS = [
  "g",
  "ml",
  "piece",
  "serving",
];


const HISTORY_PAGE_SIZE = 10;


const RETENTION_MESSAGE =
  "Menu history is retained for 40 days. Older menu records are deleted automatically.";


/* ============================================================
   DATE HELPERS
============================================================ */

function padNumber(value) {
  return String(value).padStart(
    2,
    "0"
  );
}


function getTodayInputValue() {
  const now = new Date();

  return [
    now.getFullYear(),
    padNumber(
      now.getMonth() + 1
    ),
    padNumber(
      now.getDate()
    ),
  ].join("-");
}


function toInputDate(
  value
) {
  if (!value) {
    return "";
  }

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      String(value)
    )
  ) {
    return String(value);
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "";
  }

  return [
    parsed.getFullYear(),
    padNumber(
      parsed.getMonth() + 1
    ),
    padNumber(
      parsed.getDate()
    ),
  ].join("-");
}


function formatDate(
  value,
  options = {}
) {
  if (!value) {
    return "—";
  }

  const parsed =
    /^\d{4}-\d{2}-\d{2}$/.test(
      String(value)
    )
      ? new Date(
          `${value}T00:00:00`
        )
      : new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return String(value);
  }

  return parsed.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      ...options,
    }
  );
}


function formatMenuHeadingDate(
  value
) {
  if (!value) {
    return "";
  }

  const parsed =
    new Date(
      `${value}T00:00:00`
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return value;
  }

  const datePart =
    parsed.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );

  const weekday =
    parsed.toLocaleDateString(
      "en-IN",
      {
        weekday: "long",
      }
    );

  return `${datePart} (${weekday})`;
}


function formatDateTime(
  value
) {
  if (!value) {
    return "—";
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return String(value);
  }

  return parsed.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}


/* ============================================================
   DISPLAY HELPERS
============================================================ */

function titleCase(
  value
) {
  return String(
    value || ""
  )
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(
      (part) =>
        part.charAt(0).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}


function formatMeal(
  value
) {
  return titleCase(value);
}


function formatCategory(
  value
) {
  if (
    String(value).toLowerCase() ===
    "non-veg"
  ) {
    return "Non-Veg";
  }

  if (
    String(value).toLowerCase() ===
    "veg"
  ) {
    return "Veg";
  }

  if (
    String(value).toLowerCase() ===
    "both"
  ) {
    return "Both";
  }

  return titleCase(value);
}


function statusLabel(
  value
) {
  return titleCase(
    value || "draft"
  );
}


function getMessHostelId(
  mess
) {
  return (
    mess?.hostelId ??
    mess?.hostel_id ??
    mess?.hostel?.id ??
    null
  );
}


function getMenuItemsText(
  menu
) {
  if (
    Array.isArray(menu?.items) &&
    menu.items.length > 0
  ) {
    return menu.items
      .map(
        (item) =>
          item.name
      )
      .filter(Boolean)
      .join(", ");
  }

  return (
    menu?.menuItems ||
    "—"
  );
}


function getMenuItemCount(
  menu
) {
  if (
    Number.isFinite(
      Number(
        menu?.itemCount
      )
    )
  ) {
    return Number(
      menu.itemCount
    );
  }

  if (
    Array.isArray(
      menu?.items
    )
  ) {
    return menu.items.length;
  }

  return 0;
}


function getErrorMessage(
  error,
  fallback
) {
  if (
    typeof error ===
      "string" &&
    error.trim()
  ) {
    return error.trim();
  }

  if (
    typeof error?.message ===
      "string" &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  return fallback;
}


function buildQueryString(
  values
) {
  const params =
    new URLSearchParams();

  Object.entries(
    values
  ).forEach(
    ([
      key,
      value,
    ]) => {
      if (
        value ===
          undefined ||
        value ===
          null ||
        value === "" ||
        value === "all"
      ) {
        return;
      }

      params.set(
        key,
        String(value)
      );
    }
  );

  const text =
    params.toString();

  return text
    ? `?${text}`
    : "";
}


function calculateSelectedItemCalories(
  item
) {
  const calories =
    Number(
      item?.caloriesPerServing ||
        0
    );

  const defaultQuantity =
    Number(
      item?.defaultQuantity ||
        0
    );

  const selectedQuantity =
    Number(
      item?.quantityPerStudent ||
        0
    );

  const selectedUnit =
    String(
      item?.unit || ""
    )
      .trim()
      .toLowerCase();

  const defaultUnit =
    String(
      item?.defaultUnit || ""
    )
      .trim()
      .toLowerCase();

  if (
    calories > 0 &&
    defaultQuantity > 0 &&
    selectedQuantity > 0 &&
    selectedUnit &&
    defaultUnit &&
    selectedUnit ===
      defaultUnit
  ) {
    return (
      calories *
      selectedQuantity /
      defaultQuantity
    );
  }

  return calories;
}


function calculateSelectedCalories(
  items
) {
  return items.reduce(
    (
      total,
      item
    ) =>
      total +
      calculateSelectedItemCalories(
        item
      ),
    0
  );
}


/* ============================================================
   EMPTY STATE FACTORIES
============================================================ */

function createDailyFilters() {
  return {
    date:
      getTodayInputValue(),

    hostelId:
      "all",

    messUnitId:
      "all",

    meal:
      "breakfast",

    mealCategory:
      "veg",
  };
}


function createMenuForm() {
  return {
    date:
      getTodayInputValue(),

    hostelId:
      "",

    messUnitId:
      "",

    meal:
      "breakfast",

    mealCategory:
      "veg",
  };
}


function createHistoryFilters() {
  return {
    startDate:
      "",

    endDate:
      "",

    hostelId:
      "all",

    messUnitId:
      "all",

    meal:
      "all",

    mealCategory:
      "all",

    status:
      "all",

    search:
      "",
  };
}


function createTemplateForm() {
  return {
    name:
      "",

    meal:
      "breakfast",

    mealCategory:
      "veg",

    description:
      "",

    isActive:
      true,
  };
}


function createCustomFoodForm(
  mealCategory =
    "veg"
) {
  return {
    name:
      "",

    type:
      "Main Course",

    mealCategory:
      mealCategory ===
        "non-veg"
        ? "non-veg"
        : "veg",

    defaultQuantity:
      "1",

    defaultUnit:
      "serving",

    caloriesPerServing:
      "0",

    imageUrl:
      "",
  };
}


/* ============================================================
   SELECTED FOOD HELPERS
============================================================ */

function normalizeSelectedFood(
  item
) {
  return {
    id:
      item.id ??
      item.menuItemId,

    menuItemId:
      item.menuItemId ??
      item.id,

    linkId:
      item.linkId ??
      null,

    name:
      item.name ||
      "Food Item",

    type:
      item.type ||
      "Other",

    mealCategory:
      item.mealCategory ||
      "both",

    imageUrl:
      item.imageUrl ||
      "",

    defaultQuantity:
      Number(
        item.defaultQuantity ||
          item.quantityPerStudent ||
          1
      ),

    defaultUnit:
      item.defaultUnit ||
      item.unit ||
      "serving",

    caloriesPerServing:
      Number(
        item.caloriesPerServing ||
          0
      ),

    quantityPerStudent:
      Number(
        item.quantityPerStudent ||
          item.defaultQuantity ||
          1
      ),

    unit:
      item.unit ||
      item.defaultUnit ||
      "serving",

    isCustom:
      Boolean(
        item.isCustom
      ),
  };
}


function buildItemPayload(
  items
) {
  return items.map(
    (item) => ({
      menuItemId:
        Number(
          item.menuItemId ??
            item.id
        ),

      quantityPerStudent:
        Number(
          item.quantityPerStudent
        ),

      unit:
        item.unit,
    })
  );
}


/* ============================================================
   FOOD IMAGE
============================================================ */

function FoodImage({
  item,
  size = "medium",
}) {
  const [
    failed,
    setFailed,
  ] = useState(false);

  const imageUrl =
    item?.imageUrl;

  if (
    !imageUrl ||
    failed
  ) {
    return (
      <div
        className={`mm-food-image mm-food-image--${size} mm-food-image--fallback`}
        aria-hidden="true"
      >
        <UtensilsCrossed
          size={
            size ===
            "small"
              ? 16
              : 21
          }
        />
      </div>
    );
  }

  return (
    <div
      className={`mm-food-image mm-food-image--${size}`}
    >
      <img
        src={
          imageUrl
        }
        alt={
          item?.name ||
          "Food"
        }
        onError={() =>
          setFailed(
            true
          )
        }
      />
    </div>
  );
}


/* ============================================================
   SECURE DELETE DIALOG
============================================================ */

function SecureDeleteDialog({
  target,
  confirmation,
  setConfirmation,
  error,
  busy,
  onClose,
  onConfirm,
}) {
  const dialogRef =
    useRef(null);

  const inputRef =
    useRef(null);

  const previousFocusRef =
    useRef(null);

  useEffect(() => {
    if (!target) {
      return undefined;
    }

    previousFocusRef.current =
      document.activeElement;

    window.setTimeout(
      () => {
        inputRef.current?.focus();
      },
      0
    );

    const handleKeyDown =
      (event) => {
        if (
          event.key ===
            "Escape" &&
          !busy
        ) {
          event.preventDefault();

          onClose();
          return;
        }

        if (
          event.key !==
            "Tab" ||
          !dialogRef.current
        ) {
          return;
        }

        const focusable =
          Array.from(
            dialogRef.current.querySelectorAll(
              [
                "button:not([disabled])",
                "input:not([disabled])",
                "select:not([disabled])",
                "textarea:not([disabled])",
                '[tabindex]:not([tabindex="-1"])',
              ].join(",")
            )
          );

        if (
          focusable.length ===
          0
        ) {
          return;
        }

        const first =
          focusable[0];

        const last =
          focusable[
            focusable.length -
              1
          ];

        if (
          event.shiftKey &&
          document.activeElement ===
            first
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement ===
            last
        ) {
          event.preventDefault();
          first.focus();
        }
      };

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      if (
        previousFocusRef.current &&
        typeof previousFocusRef
          .current.focus ===
          "function"
      ) {
        previousFocusRef.current.focus();
      }
    };
  }, [
    target,
    busy,
    onClose,
  ]);

  if (!target) {
    return null;
  }

  const isTemplate =
    target.kind ===
    "template";

  const record =
    target.record;

  const recordName =
    isTemplate
      ? record?.name
      : `${formatMeal(
          record?.meal
        )} – ${formatDate(
          record?.date
        )}`;

  return (
    <div
      className="mm-dialog-backdrop"
      onMouseDown={
        (event) => {
          if (
            event.target ===
              event.currentTarget &&
            !busy
          ) {
            onClose();
          }
        }
      }
    >
      <div
        ref={
          dialogRef
        }
        className="mm-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mm-delete-title"
      >
        <div className="mm-delete-dialog__icon">
          <AlertTriangle
            size={26}
          />
        </div>

        <div className="mm-delete-dialog__heading">
          <div>
            <h2
              id="mm-delete-title"
            >
              Permanently delete this record?
            </h2>

            <p>
              This action cannot be undone.
            </p>
          </div>

          <button
            type="button"
            className="mm-icon-button"
            onClick={
              onClose
            }
            disabled={
              busy
            }
            aria-label="Close permanent delete dialog"
          >
            <X
              size={20}
            />
          </button>
        </div>

        <div className="mm-delete-record">
          <strong>
            {recordName}
          </strong>

          {isTemplate ? (
            <span>
              {formatMeal(
                record?.meal
              )}
              {" • "}
              {formatCategory(
                record
                  ?.mealCategory
              )}
              {" • "}
              {record
                ?.itemCount ??
                record
                  ?.items
                  ?.length ??
                0}{" "}
              items
            </span>
          ) : (
            <span>
              {record
                ?.hostel
                ?.name ||
                "Hostel"}
              {" • "}
              {record
                ?.messUnit
                ?.name ||
                "Mess Unit"}
              {" • "}
              {formatCategory(
                record
                  ?.mealCategory
              )}
            </span>
          )}
        </div>

        <div className="mm-delete-warning">
          <AlertCircle
            size={18}
          />

          <span>
            {isTemplate
              ? "The template and its saved template-item associations will be permanently removed. Food master records will remain."
              : "The selected menu and its directly dependent menu-item links and menu notifications will be permanently removed."}
          </span>
        </div>

        <label className="mm-delete-confirmation">
          <span>
            Type{" "}
            <strong>
              DELETE
            </strong>{" "}
            in uppercase to confirm
          </span>

          <input
            ref={
              inputRef
            }
            type="text"
            value={
              confirmation
            }
            onChange={
              (event) =>
                setConfirmation(
                  event.target
                    .value
                )
            }
            autoComplete="off"
            spellCheck="false"
            disabled={
              busy
            }
            placeholder="DELETE"
          />
        </label>

        {error && (
          <div className="mm-form-error">
            <AlertCircle
              size={17}
            />

            <span>
              {error}
            </span>
          </div>
        )}

        <div className="mm-dialog-actions">
          <button
            type="button"
            className="mm-button mm-button--secondary"
            onClick={
              onClose
            }
            disabled={
              busy
            }
          >
            Cancel
          </button>

          <button
            type="button"
            className="mm-button mm-button--danger"
            onClick={
              onConfirm
            }
            disabled={
              busy ||
              !isPermanentDeleteConfirmationValid(
                confirmation
              )
            }
          >
            {busy ? (
              <Loader2
                size={17}
                className="mm-spin"
              />
            ) : (
              <Trash2
                size={17}
              />
            )}

            {busy
              ? "Deleting..."
              : "Permanently Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ============================================================
   MENU MANAGEMENT
============================================================ */

function MenuManagement() {
  const {
    apiFetch,
    hostels =
      [],
    messUnits =
      [],
    invalidateManagerData,
  } = useManager();


  /* =========================================================
     GLOBAL PAGE STATE
  ========================================================= */

  const [
    activeTab,
    setActiveTab,
  ] = useState(
    "daily"
  );

  const [
    successMessage,
    setSuccessMessage,
  ] = useState(
    ""
  );

  const [
    pageError,
    setPageError,
  ] = useState(
    ""
  );


  /* =========================================================
     DAILY MENU
  ========================================================= */

  const [
    dailyFilters,
    setDailyFilters,
  ] = useState(
    createDailyFilters
  );

  const [
    appliedDailyFilters,
    setAppliedDailyFilters,
  ] = useState(
    createDailyFilters
  );

  const [
    dailyMenus,
    setDailyMenus,
  ] = useState(
    []
  );

  const [
    selectedDailyMenuId,
    setSelectedDailyMenuId,
  ] = useState(
    null
  );

  const [
    dailyLoading,
    setDailyLoading,
  ] = useState(
    true
  );

  const [
    dailyError,
    setDailyError,
  ] = useState(
    ""
  );


  /* =========================================================
     RECENT MENUS
  ========================================================= */

  const [
    recentMenus,
    setRecentMenus,
  ] = useState(
    []
  );

  const [
    recentLoading,
    setRecentLoading,
  ] = useState(
    false
  );


  /* =========================================================
     CREATE / EDIT DRAWER
  ========================================================= */

  const [
    drawerOpen,
    setDrawerOpen,
  ] = useState(
    false
  );

  const [
    drawerMode,
    setDrawerMode,
  ] = useState(
    "create"
  );

  const [
    editingMenu,
    setEditingMenu,
  ] = useState(
    null
  );

  const [
    menuForm,
    setMenuForm,
  ] = useState(
    createMenuForm
  );

  const [
    selectedItems,
    setSelectedItems,
  ] = useState(
    []
  );

  const [
    drawerError,
    setDrawerError,
  ] = useState(
    ""
  );

  const [
    savingMenu,
    setSavingMenu,
  ] = useState(
    false
  );


  /* =========================================================
     FOOD CATALOG
  ========================================================= */

  const [
    foodSearch,
    setFoodSearch,
  ] = useState(
    ""
  );

  const [
    catalogItems,
    setCatalogItems,
  ] = useState(
    []
  );

  const [
    catalogLoading,
    setCatalogLoading,
  ] = useState(
    false
  );

  const [
    catalogError,
    setCatalogError,
  ] = useState(
    ""
  );


  /* =========================================================
     CUSTOM FOOD
  ========================================================= */

  const [
    customFoodOpen,
    setCustomFoodOpen,
  ] = useState(
    false
  );

  const [
    customFoodForm,
    setCustomFoodForm,
  ] = useState(
    () =>
      createCustomFoodForm()
  );

  const [
    customFoodError,
    setCustomFoodError,
  ] = useState(
    ""
  );

  const [
    customFoodSaving,
    setCustomFoodSaving,
  ] = useState(
    false
  );


  /* =========================================================
     MENU ITEM EDIT
  ========================================================= */

  const [
    editingMenuItem,
    setEditingMenuItem,
  ] = useState(
    null
  );

  const [
    itemEditForm,
    setItemEditForm,
  ] = useState({
    quantityPerStudent:
      "",

    unit:
      "serving",
  });

  const [
    itemEditError,
    setItemEditError,
  ] = useState(
    ""
  );

  const [
    itemSaving,
    setItemSaving,
  ] = useState(
    false
  );

  const [
    removingItemId,
    setRemovingItemId,
  ] = useState(
    null
  );


  /* =========================================================
     HISTORY
  ========================================================= */

  const [
    historyFilters,
    setHistoryFilters,
  ] = useState(
    createHistoryFilters
  );

  const [
    appliedHistoryFilters,
    setAppliedHistoryFilters,
  ] = useState(
    createHistoryFilters
  );

  const [
    historyMenus,
    setHistoryMenus,
  ] = useState(
    []
  );

  const [
    historyLoading,
    setHistoryLoading,
  ] = useState(
    false
  );

  const [
    historyError,
    setHistoryError,
  ] = useState(
    ""
  );

  const [
    retentionMessage,
    setRetentionMessage,
  ] = useState(
    RETENTION_MESSAGE
  );

  const [
    historyPagination,
    setHistoryPagination,
  ] = useState({
    page:
      1,

    limit:
      HISTORY_PAGE_SIZE,

    total:
      0,

    pages:
      1,
  });


  /* =========================================================
     TEMPLATES
  ========================================================= */

  const [
    templates,
    setTemplates,
  ] = useState(
    []
  );

  const [
    templatesLoading,
    setTemplatesLoading,
  ] = useState(
    false
  );

  const [
    templatesError,
    setTemplatesError,
  ] = useState(
    ""
  );

  const [
    templateSearch,
    setTemplateSearch,
  ] = useState(
    ""
  );

  const [
    templateEditorOpen,
    setTemplateEditorOpen,
  ] = useState(
    false
  );

  const [
    editingTemplate,
    setEditingTemplate,
  ] = useState(
    null
  );

  const [
    templateForm,
    setTemplateForm,
  ] = useState(
    createTemplateForm
  );

  const [
    templateItems,
    setTemplateItems,
  ] = useState(
    []
  );

  const [
    templateEditorError,
    setTemplateEditorError,
  ] = useState(
    ""
  );

  const [
    templateSaving,
    setTemplateSaving,
  ] = useState(
    false
  );

  const [
    templateFoodSearch,
    setTemplateFoodSearch,
  ] = useState(
    ""
  );

  const [
    templateCatalog,
    setTemplateCatalog,
  ] = useState(
    []
  );

  const [
    templateCatalogLoading,
    setTemplateCatalogLoading,
  ] = useState(
    false
  );


  /* =========================================================
     USE TEMPLATE
  ========================================================= */

  const [
    useTemplateTarget,
    setUseTemplateTarget,
  ] = useState(
    null
  );

  const [
    useTemplateForm,
    setUseTemplateForm,
  ] = useState({
    date:
      getTodayInputValue(),

    hostelId:
      "",

    messUnitId:
      "",
  });

  const [
    useTemplateError,
    setUseTemplateError,
  ] = useState(
    ""
  );

  const [
    usingTemplate,
    setUsingTemplate,
  ] = useState(
    false
  );


  /* =========================================================
     COPY MENU
  ========================================================= */

  const [
    copyTarget,
    setCopyTarget,
  ] = useState(
    null
  );

  const [
    copyForm,
    setCopyForm,
  ] = useState({
    date:
      getTodayInputValue(),

    hostelId:
      "",

    messUnitId:
      "",
  });

  const [
    copyError,
    setCopyError,
  ] = useState(
    ""
  );

  const [
    copying,
    setCopying,
  ] = useState(
    false
  );


  /* =========================================================
     CALENDAR
  ========================================================= */

  const today =
    new Date();

  const [
    calendarOpen,
    setCalendarOpen,
  ] = useState(
    false
  );

  const [
    calendarYear,
    setCalendarYear,
  ] = useState(
    today.getFullYear()
  );

  const [
    calendarMonth,
    setCalendarMonth,
  ] = useState(
    today.getMonth() +
      1
  );

  const [
    calendarDays,
    setCalendarDays,
  ] = useState(
    []
  );

  const [
    calendarLoading,
    setCalendarLoading,
  ] = useState(
    false
  );

  const [
    calendarError,
    setCalendarError,
  ] = useState(
    ""
  );

  const [
    selectedCalendarDate,
    setSelectedCalendarDate,
  ] = useState(
    getTodayInputValue()
  );

  const calendarDialogRef = useRef(null);
  const calendarCloseButtonRef = useRef(null);
  const calendarLastTriggerRef = useRef(null);


  /* =========================================================
     SECURE DELETE
  ========================================================= */

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState(
    null
  );

  const [
    deleteConfirmation,
    setDeleteConfirmation,
  ] = useState(
    ""
  );

  const [
    deleteError,
    setDeleteError,
  ] = useState(
    ""
  );

  const [
    deleting,
    setDeleting,
  ] = useState(
    false
  );

  const deleteGuardRef =
    useRef(
      createPermanentDeleteRequestGuard()
    );


  /* =========================================================
     DERIVED MESS UNIT OPTIONS
  ========================================================= */

  const dailyMessOptions =
    useMemo(() => {
      if (
        dailyFilters.hostelId ===
          "all"
      ) {
        return messUnits;
      }

      return messUnits.filter(
        (mess) =>
          String(
            getMessHostelId(
              mess
            )
          ) ===
          String(
            dailyFilters.hostelId
          )
      );
    }, [
      messUnits,
      dailyFilters.hostelId,
    ]);


  const drawerMessOptions =
    useMemo(() => {
      if (
        !menuForm.hostelId
      ) {
        return [];
      }

      return messUnits.filter(
        (mess) =>
          String(
            getMessHostelId(
              mess
            )
          ) ===
          String(
            menuForm.hostelId
          )
      );
    }, [
      messUnits,
      menuForm.hostelId,
    ]);


  const historyMessOptions =
    useMemo(() => {
      if (
        historyFilters.hostelId ===
          "all"
      ) {
        return messUnits;
      }

      return messUnits.filter(
        (mess) =>
          String(
            getMessHostelId(
              mess
            )
          ) ===
          String(
            historyFilters
              .hostelId
          )
      );
    }, [
      messUnits,
      historyFilters.hostelId,
    ]);


  const copyMessOptions =
    useMemo(() => {
      if (
        !copyForm.hostelId
      ) {
        return [];
      }

      return messUnits.filter(
        (mess) =>
          String(
            getMessHostelId(
              mess
            )
          ) ===
          String(
            copyForm.hostelId
          )
      );
    }, [
      messUnits,
      copyForm.hostelId,
    ]);


  const useTemplateMessOptions =
    useMemo(() => {
      if (
        !useTemplateForm
          .hostelId
      ) {
        return [];
      }

      return messUnits.filter(
        (mess) =>
          String(
            getMessHostelId(
              mess
            )
          ) ===
          String(
            useTemplateForm
              .hostelId
          )
      );
    }, [
      messUnits,
      useTemplateForm.hostelId,
    ]);


  /* =========================================================
     CURRENT MENU
  ========================================================= */

  const currentMenu =
    useMemo(() => {
      if (
        dailyMenus.length ===
        0
      ) {
        return null;
      }

      const selected =
        dailyMenus.find(
          (menu) =>
            String(menu.id) ===
            String(
              selectedDailyMenuId
            )
        );

      return (
        selected ||
        dailyMenus[0]
      );
    }, [
      dailyMenus,
      selectedDailyMenuId,
    ]);


  /* =========================================================
     DAILY FILTER SAFETY
  ========================================================= */

  useEffect(() => {
    if (
      dailyFilters
        .messUnitId ===
      "all"
    ) {
      return;
    }

    const exists =
      dailyMessOptions.some(
        (mess) =>
          String(mess.id) ===
          String(
            dailyFilters
              .messUnitId
          )
      );

    if (!exists) {
      setDailyFilters(
        (current) => ({
          ...current,
          messUnitId:
            "all",
        })
      );
    }
  }, [
    dailyFilters.messUnitId,
    dailyMessOptions,
  ]);


  useEffect(() => {
    if (
      historyFilters
        .messUnitId ===
      "all"
    ) {
      return;
    }

    const exists =
      historyMessOptions.some(
        (mess) =>
          String(mess.id) ===
          String(
            historyFilters
              .messUnitId
          )
      );

    if (!exists) {
      setHistoryFilters(
        (current) => ({
          ...current,
          messUnitId:
            "all",
        })
      );
    }
  }, [
    historyFilters.messUnitId,
    historyMessOptions,
  ]);


  /* =========================================================
     LOAD DAILY MENU
  ========================================================= */

  const loadDailyMenus =
    useCallback(
      async (
        filters =
          appliedDailyFilters
      ) => {
        setDailyLoading(
          true
        );

        setDailyError(
          ""
        );

        try {
          const query =
            buildQueryString({
              date:
                filters.date,

              hostel_id:
                filters
                  .hostelId,

              mess_unit_id:
                filters
                  .messUnitId,

              meal:
                filters.meal,

              meal_category:
                filters
                  .mealCategory,
            });

          const data =
            await apiFetch(
              `/api/manager/menus${query}`
            );

          const menus =
            Array.isArray(
              data?.menus
            )
              ? data.menus
              : [];

          setDailyMenus(
            menus
          );

          setSelectedDailyMenuId(
            (currentId) => {
              if (
                menus.some(
                  (menu) =>
                    String(
                      menu.id
                    ) ===
                    String(
                      currentId
                    )
                )
              ) {
                return currentId;
              }

              return (
                menus[0]?.id ??
                null
              );
            }
          );
        } catch (error) {
          setDailyMenus(
            []
          );

          setSelectedDailyMenuId(
            null
          );

          setDailyError(
            getErrorMessage(
              error,
              "Unable to load the selected Menu."
            )
          );
        } finally {
          setDailyLoading(
            false
          );
        }
      },
      [
        apiFetch,
        appliedDailyFilters,
      ]
    );


  /* =========================================================
     LOAD RECENT MENUS
  ========================================================= */

  const loadRecentMenus =
    useCallback(
      async () => {
        setRecentLoading(
          true
        );

        try {
          const data =
            await apiFetch(
              "/api/manager/menus/recent?limit=6"
            );

          setRecentMenus(
            Array.isArray(
              data?.menus
            )
              ? data.menus
              : []
          );
        } catch (error) {
          console.error(
            "Unable to load recent menus:",
            error
          );

          setRecentMenus(
            []
          );
        } finally {
          setRecentLoading(
            false
          );
        }
      },
      [apiFetch]
    );


  /* =========================================================
     LOAD HISTORY
  ========================================================= */

  const loadHistory =
    useCallback(
      async (
        page =
          historyPagination.page,
        filters =
          appliedHistoryFilters
      ) => {
        setHistoryLoading(
          true
        );

        setHistoryError(
          ""
        );

        try {
          const query =
            buildQueryString({
              page,
              limit:
                HISTORY_PAGE_SIZE,

              start_date:
                filters
                  .startDate,

              end_date:
                filters
                  .endDate,

              hostel_id:
                filters
                  .hostelId,

              mess_unit_id:
                filters
                  .messUnitId,

              meal:
                filters.meal,

              meal_category:
                filters
                  .mealCategory,

              status:
                filters.status,

              search:
                filters.search
                  ?.trim(),
            });

          const data =
            await apiFetch(
              `/api/manager/menus/history${query}`
            );

          setHistoryMenus(
            Array.isArray(
              data?.menus
            )
              ? data.menus
              : []
          );

          setRetentionMessage(
            data?.retentionMessage ||
              RETENTION_MESSAGE
          );

          const pagination =
            data?.pagination ||
            {};

          setHistoryPagination({
            page:
              Number(
                pagination.page ||
                  page
              ),

            limit:
              Number(
                pagination.limit ||
                  HISTORY_PAGE_SIZE
              ),

            total:
              Number(
                pagination.total ||
                  0
              ),

            pages:
              Math.max(
                Number(
                  pagination.pages ||
                    1
                ),
                1
              ),
          });
        } catch (error) {
          setHistoryMenus(
            []
          );

          setHistoryError(
            getErrorMessage(
              error,
              "Unable to load Menu History."
            )
          );
        } finally {
          setHistoryLoading(
            false
          );
        }
      },
      [
        apiFetch,
        historyPagination.page,
        appliedHistoryFilters,
      ]
    );


  /* =========================================================
     LOAD TEMPLATES
  ========================================================= */

  const loadTemplates =
    useCallback(
      async () => {
        setTemplatesLoading(
          true
        );

        setTemplatesError(
          ""
        );

        try {
          const query =
            buildQueryString({
              search:
                templateSearch
                  .trim(),
            });

          const data =
            await apiFetch(
              `/api/manager/menu-templates${query}`
            );

          setTemplates(
            Array.isArray(
              data?.templates
            )
              ? data.templates
              : []
          );
        } catch (error) {
          setTemplates(
            []
          );

          setTemplatesError(
            getErrorMessage(
              error,
              "Unable to load Menu Templates."
            )
          );
        } finally {
          setTemplatesLoading(
            false
          );
        }
      },
      [
        apiFetch,
        templateSearch,
      ]
    );


  /* =========================================================
     LOAD FOOD CATALOG
  ========================================================= */

  const loadFoodCatalog =
    useCallback(
      async (
        mealCategory,
        searchText,
        {
          templateMode =
            false,
        } = {}
      ) => {
        if (
          templateMode
        ) {
          setTemplateCatalogLoading(
            true
          );
        } else {
          setCatalogLoading(
            true
          );

          setCatalogError(
            ""
          );
        }

        try {
          const query =
            buildQueryString({
              meal_category:
                mealCategory,

              search:
                searchText
                  ?.trim(),
            });

          const data =
            await apiFetch(
              `/api/manager/menu-items${query}`
            );

          const items =
            Array.isArray(
              data?.items
            )
              ? data.items
              : [];

          if (
            templateMode
          ) {
            setTemplateCatalog(
              items
            );
          } else {
            setCatalogItems(
              items
            );
          }
        } catch (error) {
          if (
            templateMode
          ) {
            setTemplateCatalog(
              []
            );
          } else {
            setCatalogItems(
              []
            );

            setCatalogError(
              getErrorMessage(
                error,
                "Unable to load food items."
              )
            );
          }
        } finally {
          if (
            templateMode
          ) {
            setTemplateCatalogLoading(
              false
            );
          } else {
            setCatalogLoading(
              false
            );
          }
        }
      },
      [apiFetch]
    );


  /* =========================================================
     LOAD CALENDAR
  ========================================================= */

  const loadCalendar =
    useCallback(
      async () => {
        if (
          !calendarOpen
        ) {
          return;
        }

        setCalendarLoading(
          true
        );

        setCalendarError(
          ""
        );

        try {
          const query =
            buildQueryString({
              year:
                calendarYear,

              month:
                calendarMonth,
            });

          const data =
            await apiFetch(
              `/api/manager/menus/calendar${query}`
            );

          setCalendarDays(
            Array.isArray(
              data?.days
            )
              ? data.days
              : []
          );
        } catch (error) {
          setCalendarDays(
            []
          );

          setCalendarError(
            getErrorMessage(
              error,
              "Unable to load Menu Calendar."
            )
          );
        } finally {
          setCalendarLoading(
            false
          );
        }
      },
      [
        apiFetch,
        calendarOpen,
        calendarYear,
        calendarMonth,
      ]
    );


  /* =========================================================
     INITIAL DATA
  ========================================================= */

  useEffect(() => {
    loadDailyMenus(
      appliedDailyFilters
    );

    loadRecentMenus();
  }, []);


  useEffect(() => {
    if (
      activeTab ===
      "history"
    ) {
      loadHistory(
        historyPagination.page,
        appliedHistoryFilters
      );
    }
  }, [
    activeTab,
    historyPagination.page,
    appliedHistoryFilters,
  ]);


  useEffect(() => {
    if (
      activeTab ===
      "templates"
    ) {
      loadTemplates();
    }
  }, [
    activeTab,
  ]);


  useEffect(() => {
    if (
      drawerOpen
    ) {
      loadFoodCatalog(
        menuForm.mealCategory,
        foodSearch
      );
    }
  }, [
    drawerOpen,
    menuForm.mealCategory,
    foodSearch,
    loadFoodCatalog,
  ]);


  useEffect(() => {
    if (
      templateEditorOpen
    ) {
      loadFoodCatalog(
        templateForm.mealCategory,
        templateFoodSearch,
        {
          templateMode:
            true,
        }
      );
    }
  }, [
    templateEditorOpen,
    templateForm.mealCategory,
    templateFoodSearch,
    loadFoodCatalog,
  ]);


  useEffect(() => {
    loadCalendar();
  }, [
    loadCalendar,
  ]);


  /* =========================================================
     REFRESH AFTER MUTATION
  ========================================================= */

  const refreshManagerMenuData =
    useCallback(
      async () => {
        await Promise.all([
          loadDailyMenus(
            appliedDailyFilters
          ),
          loadRecentMenus(),
        ]);

        if (
          activeTab ===
          "history"
        ) {
          await loadHistory(
            historyPagination.page,
            appliedHistoryFilters
          );
        }

        if (
          activeTab ===
          "templates"
        ) {
          await loadTemplates();
        }

        if (
          calendarOpen
        ) {
          await loadCalendar();
        }

        if (
          invalidateManagerData
        ) {
          await invalidateManagerData();
        }
      },
      [
        activeTab,
        appliedDailyFilters,
        appliedHistoryFilters,
        calendarOpen,
        historyPagination.page,
        invalidateManagerData,
        loadCalendar,
        loadDailyMenus,
        loadHistory,
        loadRecentMenus,
        loadTemplates,
      ]
    );


  /* =========================================================
     DAILY FILTER EVENTS
  ========================================================= */

  const handleDailyFilterChange =
    (event) => {
      const {
        name,
        value,
      } =
        event.target;

      setDailyFilters(
        (current) => ({
          ...current,
          [name]:
            value,
        })
      );
    };


  const handleDailyHostelChange =
    (event) => {
      const hostelId =
        event.target.value;

      setDailyFilters(
        (current) => ({
          ...current,

          hostelId,

          messUnitId:
            "all",
        })
      );
    };


  const applyDailySelection =
    async () => {
      setSuccessMessage(
        ""
      );

      setPageError(
        ""
      );

      const next = {
        ...dailyFilters,
      };

      setAppliedDailyFilters(
        next
      );

      await loadDailyMenus(
        next
      );
    };


  /* =========================================================
     OPEN CREATE DRAWER
  ========================================================= */

  const openCreateMenu =
    useCallback(
      (
        overrides = {}
      ) => {
        const preferredHostel =
          overrides.hostelId ??
          (
            dailyFilters
              .hostelId !==
            "all"
              ? dailyFilters
                  .hostelId
              : hostels[0]
                  ?.id ??
                ""
          );

        const availableMess =
          messUnits.filter(
            (mess) =>
              String(
                getMessHostelId(
                  mess
                )
              ) ===
              String(
                preferredHostel
              )
          );

        const preferredMess =
          overrides.messUnitId ??
          (
            dailyFilters
              .messUnitId !==
              "all" &&
            availableMess.some(
              (mess) =>
                String(
                  mess.id
                ) ===
                String(
                  dailyFilters
                    .messUnitId
                )
            )
              ? dailyFilters
                  .messUnitId
              : availableMess[0]
                  ?.id ??
                ""
          );

        setDrawerMode(
          "create"
        );

        setEditingMenu(
          null
        );

        setMenuForm({
          date:
            overrides.date ??
            dailyFilters.date ??
            getTodayInputValue(),

          hostelId:
            preferredHostel
              ? String(
                  preferredHostel
                )
              : "",

          messUnitId:
            preferredMess
              ? String(
                  preferredMess
                )
              : "",

          meal:
            overrides.meal ??
            dailyFilters.meal ??
            "breakfast",

          mealCategory:
            overrides
              .mealCategory ??
            dailyFilters
              .mealCategory ??
            "veg",
        });

        setSelectedItems(
          []
        );

        setFoodSearch(
          ""
        );

        setDrawerError(
          ""
        );

        setCustomFoodOpen(
          false
        );

        setDrawerOpen(
          true
        );
      },
      [
        dailyFilters,
        hostels,
        messUnits,
      ]
    );


  /* =========================================================
     OPEN EDIT DRAWER
  ========================================================= */

  const openEditMenu =
    (menu) => {
      if (!menu) {
        return;
      }

      setDrawerMode(
        "edit"
      );

      setEditingMenu(
        menu
      );

      setMenuForm({
        date:
          toInputDate(
            menu.date
          ),

        hostelId:
          String(
            menu.hostel
              ?.id ??
              ""
          ),

        messUnitId:
          String(
            menu.messUnit
              ?.id ??
              ""
          ),

        meal:
          menu.meal ||
          "breakfast",

        mealCategory:
          menu.mealCategory ||
          "veg",
      });

      setSelectedItems(
        Array.isArray(
          menu.items
        )
          ? menu.items.map(
              normalizeSelectedFood
            )
          : []
      );

      setFoodSearch(
        ""
      );

      setDrawerError(
        ""
      );

      setCustomFoodOpen(
        false
      );

      setDrawerOpen(
        true
      );
    };


  const closeDrawer =
    () => {
      if (
        savingMenu
      ) {
        return;
      }

      setDrawerOpen(
        false
      );

      setEditingMenu(
        null
      );

      setDrawerError(
        ""
      );

      setCustomFoodOpen(
        false
      );
    };


  const handleMenuFormChange =
    (event) => {
      const {
        name,
        value,
      } =
        event.target;

      setMenuForm(
        (current) => ({
          ...current,
          [name]:
            value,
        })
      );
    };


  const handleDrawerHostelChange =
    (event) => {
      const hostelId =
        event.target.value;

      const available =
        messUnits.filter(
          (mess) =>
            String(
              getMessHostelId(
                mess
              )
            ) ===
            String(
              hostelId
            )
        );

      setMenuForm(
        (current) => ({
          ...current,

          hostelId,

          messUnitId:
            available[0]
              ?.id
              ? String(
                  available[0]
                    .id
                )
              : "",
        })
      );
    };


  const handleDrawerCategoryChange =
    (event) => {
      const category =
        event.target.value;

      setMenuForm(
        (current) => ({
          ...current,

          mealCategory:
            category,
        })
      );

      setSelectedItems(
        (current) =>
          current.filter(
            (item) =>
              item.mealCategory ===
                "both" ||
              item.mealCategory ===
                category
          )
      );
    };


  /* =========================================================
     FOOD SELECTION
  ========================================================= */

  const addFoodItem =
    (food) => {
      setSelectedItems(
        (current) => {
          const exists =
            current.some(
              (item) =>
                String(
                  item.menuItemId ??
                    item.id
                ) ===
                String(
                  food.id
                )
            );

          if (exists) {
            return current;
          }

          return [
            ...current,
            normalizeSelectedFood(
              food
            ),
          ];
        }
      );
    };


  const removeSelectedFoodItem =
    (foodId) => {
      setSelectedItems(
        (current) =>
          current.filter(
            (item) =>
              String(
                item.menuItemId ??
                  item.id
              ) !==
              String(foodId)
          )
      );
    };


  const updateSelectedFoodItem =
    (
      foodId,
      field,
      value
    ) => {
      setSelectedItems(
        (current) =>
          current.map(
            (item) =>
              String(
                item.menuItemId ??
                  item.id
              ) ===
              String(foodId)
                ? {
                    ...item,
                    [field]:
                      value,
                  }
                : item
          )
      );
    };


  const selectedFoodIds =
    useMemo(
      () =>
        new Set(
          selectedItems.map(
            (item) =>
              String(
                item.menuItemId ??
                  item.id
              )
          )
        ),
      [selectedItems]
    );


  const selectedCalories =
    useMemo(
      () =>
        calculateSelectedCalories(
          selectedItems
        ),
      [selectedItems]
    );


  /* =========================================================
     CREATE CUSTOM FOOD ITEM
  ========================================================= */

  const openCustomFood =
    () => {
      setCustomFoodForm(
        createCustomFoodForm(
          menuForm.mealCategory
        )
      );

      setCustomFoodError(
        ""
      );

      setCustomFoodOpen(
        true
      );
    };


  const saveCustomFoodItem =
    async (
      event
    ) => {
      event.preventDefault();

      const name =
        customFoodForm.name
          .trim();

      const quantity =
        Number(
          customFoodForm
            .defaultQuantity
        );

      const calories =
        Number(
          customFoodForm
            .caloriesPerServing
        );

      if (!name) {
        setCustomFoodError(
          "Enter a food item name."
        );

        return;
      }

      if (
        !Number.isFinite(
          quantity
        ) ||
        quantity <= 0
      ) {
        setCustomFoodError(
          "Default quantity must be greater than 0."
        );

        return;
      }

      if (
        !Number.isFinite(
          calories
        ) ||
        calories < 0
      ) {
        setCustomFoodError(
          "Calories per serving cannot be negative."
        );

        return;
      }

      setCustomFoodSaving(
        true
      );

      setCustomFoodError(
        ""
      );

      try {
        const response =
          await apiFetch(
            "/api/manager/menu-items",
            {
              method:
                "POST",

              body:
                JSON.stringify({
                  name,

                  type:
                    customFoodForm.type,

                  mealCategory:
                    customFoodForm
                      .mealCategory,

                  defaultQuantity:
                    quantity,

                  defaultUnit:
                    customFoodForm
                      .defaultUnit,

                  caloriesPerServing:
                    calories,

                  imageUrl:
                    customFoodForm
                      .imageUrl
                      .trim() ||
                    null,
                }),
            }
          );

        if (
          response?.item
        ) {
          addFoodItem(
            response.item
          );
        }

        setCustomFoodOpen(
          false
        );

        await loadFoodCatalog(
          menuForm.mealCategory,
          foodSearch
        );
      } catch (error) {
        setCustomFoodError(
          getErrorMessage(
            error,
            "Unable to create the custom food item."
          )
        );
      } finally {
        setCustomFoodSaving(
          false
        );
      }
    };


  /* =========================================================
     VALIDATE MENU DRAWER
  ========================================================= */

  const validateMenuDrawer =
    () => {
      if (
        !menuForm.date
      ) {
        return "Select a Menu date.";
      }

      if (
        !menuForm.hostelId
      ) {
        return "Select a Hostel.";
      }

      if (
        !menuForm.messUnitId
      ) {
        return "Select a Mess Unit.";
      }

      if (
        !menuForm.meal
      ) {
        return "Select a Meal.";
      }

      if (
        !menuForm
          .mealCategory
      ) {
        return "Select a Meal Category.";
      }

      if (
        selectedItems.length ===
        0
      ) {
        return "Select at least one food item.";
      }

      for (
        const item of
        selectedItems
      ) {
        const quantity =
          Number(
            item.quantityPerStudent
          );

        if (
          !Number.isFinite(
            quantity
          ) ||
          quantity <= 0
        ) {
          return `Enter a valid quantity for ${item.name}.`;
        }

        if (
          !String(
            item.unit || ""
          ).trim()
        ) {
          return `Select a unit for ${item.name}.`;
        }
      }

      return "";
    };


  /* =========================================================
     SAVE MENU
  ========================================================= */

  const saveMenu =
    async (
      event
    ) => {
      event.preventDefault();

      const validationError =
        validateMenuDrawer();

      if (
        validationError
      ) {
        setDrawerError(
          validationError
        );

        return;
      }

      setSavingMenu(
        true
      );

      setDrawerError(
        ""
      );

      setSuccessMessage(
        ""
      );

      const payload = {
        hostelId:
          Number(
            menuForm.hostelId
          ),

        messUnitId:
          Number(
            menuForm.messUnitId
          ),

        date:
          menuForm.date,

        meal:
          menuForm.meal,

        mealCategory:
          menuForm
            .mealCategory,

        items:
          buildItemPayload(
            selectedItems
          ),
      };

      try {
        const endpoint =
          drawerMode ===
            "edit" &&
          editingMenu
            ? `/api/manager/menus/${editingMenu.id}`
            : "/api/manager/menus";

        const method =
          drawerMode ===
            "edit"
            ? "PUT"
            : "POST";

        const response =
          await apiFetch(
            endpoint,
            {
              method,

              body:
                JSON.stringify(
                  payload
                ),
            }
          );

        const savedMenu =
          response?.menu;

        setDrawerOpen(
          false
        );

        setEditingMenu(
          null
        );

        setSuccessMessage(
          response?.message ||
            (
              method ===
              "POST"
                ? "Menu saved successfully."
                : "Menu updated successfully."
            )
        );

        const nextFilters = {
          date:
            savedMenu?.date ||
            menuForm.date,

          hostelId:
            String(
              savedMenu
                ?.hostel
                ?.id ??
                menuForm.hostelId
            ),

          messUnitId:
            String(
              savedMenu
                ?.messUnit
                ?.id ??
                menuForm.messUnitId
            ),

          meal:
            savedMenu?.meal ||
            menuForm.meal,

          mealCategory:
            savedMenu
              ?.mealCategory ||
            menuForm
              .mealCategory,
        };

        setDailyFilters(
          nextFilters
        );

        setAppliedDailyFilters(
          nextFilters
        );

        setActiveTab(
          "daily"
        );

        await Promise.all([
          loadDailyMenus(
            nextFilters
          ),
          loadRecentMenus(),
        ]);

        if (
          invalidateManagerData
        ) {
          await invalidateManagerData();
        }
      } catch (error) {
        setDrawerError(
          getErrorMessage(
            error,
            "Unable to save the Menu."
          )
        );
      } finally {
        setSavingMenu(
          false
        );
      }
    };


  /* =========================================================
     PUBLISH / UNPUBLISH
  ========================================================= */

  const changePublicationStatus =
    async (
      menu,
      action
    ) => {
      if (!menu) {
        return;
      }

      setPageError(
        ""
      );

      setSuccessMessage(
        ""
      );

      try {
        const response =
          await apiFetch(
            `/api/manager/menus/${menu.id}/${action}`,
            {
              method:
                "POST",
            }
          );

        setSuccessMessage(
          response?.message ||
            (
              action ===
              "publish"
                ? "Menu published successfully."
                : "Menu unpublished successfully."
            )
        );

        await refreshManagerMenuData();
      } catch (error) {
        setPageError(
          getErrorMessage(
            error,
            action ===
              "publish"
              ? "Unable to publish the Menu."
              : "Unable to unpublish the Menu."
          )
        );
      }
    };


  /* =========================================================
     EDIT CURRENT MENU ITEM
  ========================================================= */

  const openMenuItemEdit =
    (item) => {
      setEditingMenuItem(
        item
      );

      setItemEditForm({
        quantityPerStudent:
          String(
            item.quantityPerStudent ??
              ""
          ),

        unit:
          item.unit ||
          "serving",
      });

      setItemEditError(
        ""
      );
    };


  const saveCurrentMenuItem =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        !currentMenu ||
        !editingMenuItem
      ) {
        return;
      }

      const quantity =
        Number(
          itemEditForm
            .quantityPerStudent
        );

      if (
        !Number.isFinite(
          quantity
        ) ||
        quantity <= 0
      ) {
        setItemEditError(
          "Quantity must be greater than 0."
        );

        return;
      }

      if (
        !itemEditForm.unit
          .trim()
      ) {
        setItemEditError(
          "Select a valid unit."
        );

        return;
      }

      setItemSaving(
        true
      );

      setItemEditError(
        ""
      );

      try {
        const response =
          await apiFetch(
            `/api/manager/menus/${currentMenu.id}/items/${editingMenuItem.linkId}`,
            {
              method:
                "PUT",

              body:
                JSON.stringify({
                  quantityPerStudent:
                    quantity,

                  unit:
                    itemEditForm.unit,
                }),
            }
          );

        if (
          response?.menu
        ) {
          setDailyMenus(
            (current) =>
              current.map(
                (menu) =>
                  menu.id ===
                  response.menu.id
                    ? response.menu
                    : menu
              )
          );
        } else {
          await loadDailyMenus(
            appliedDailyFilters
          );
        }

        setEditingMenuItem(
          null
        );

        setSuccessMessage(
          response?.message ||
            "Menu item updated successfully."
        );
      } catch (error) {
        setItemEditError(
          getErrorMessage(
            error,
            "Unable to update the Menu item."
          )
        );
      } finally {
        setItemSaving(
          false
        );
      }
    };


  const removeCurrentMenuItem =
    async (
      item
    ) => {
      if (
        !currentMenu ||
        !item?.linkId
      ) {
        return;
      }

      setRemovingItemId(
        item.linkId
      );

      setPageError(
        ""
      );

      try {
        const response =
          await apiFetch(
            `/api/manager/menus/${currentMenu.id}/items/${item.linkId}`,
            {
              method:
                "DELETE",
            }
          );

        if (
          response?.menu
        ) {
          setDailyMenus(
            (current) =>
              current.map(
                (menu) =>
                  menu.id ===
                  response.menu.id
                    ? response.menu
                    : menu
              )
          );
        } else {
          await loadDailyMenus(
            appliedDailyFilters
          );
        }

        setSuccessMessage(
          response?.message ||
            "Menu item removed successfully."
        );
      } catch (error) {
        setPageError(
          getErrorMessage(
            error,
            "Unable to remove the Menu item."
          )
        );
      } finally {
        setRemovingItemId(
          null
        );
      }
    };


  /* =========================================================
     VIEW MENU IN DAILY TAB
  ========================================================= */

  const viewMenuInDaily =
    async (
      menu
    ) => {
      if (!menu) {
        return;
      }

      const filters = {
        date:
          menu.date,

        hostelId:
          String(
            menu.hostel
              ?.id ??
              "all"
          ),

        messUnitId:
          String(
            menu.messUnit
              ?.id ??
              "all"
          ),

        meal:
          menu.meal,

        mealCategory:
          menu.mealCategory,
      };

      setDailyFilters(
        filters
      );

      setAppliedDailyFilters(
        filters
      );

      setActiveTab(
        "daily"
      );

      setSelectedDailyMenuId(
        menu.id
      );

      await loadDailyMenus(
        filters
      );
    };


  /* =========================================================
     HISTORY FILTERS
  ========================================================= */

  const handleHistoryFilterChange =
    (event) => {
      const {
        name,
        value,
      } =
        event.target;

      setHistoryFilters(
        (current) => ({
          ...current,
          [name]:
            value,
        })
      );
    };


  const handleHistoryHostelChange =
    (event) => {
      setHistoryFilters(
        (current) => ({
          ...current,

          hostelId:
            event.target
              .value,

          messUnitId:
            "all",
        })
      );
    };


  const applyHistory =
    () => {
      setHistoryPagination(
        (current) => ({
          ...current,
          page:
            1,
        })
      );

      setAppliedHistoryFilters({
        ...historyFilters,
      });
    };


  const clearHistoryFilters =
    () => {
      const next =
        createHistoryFilters();

      setHistoryFilters(
        next
      );

      setAppliedHistoryFilters(
        next
      );

      setHistoryPagination(
        (current) => ({
          ...current,
          page:
            1,
        })
      );
    };


  /* =========================================================
     COPY MENU
  ========================================================= */

  const openCopyMenu =
    (menu) => {
      if (!menu) {
        return;
      }

      const hostelId =
        menu.hostel?.id ||
        hostels[0]?.id ||
        "";

      const availableMess =
        messUnits.filter(
          (mess) =>
            String(
              getMessHostelId(
                mess
              )
            ) ===
            String(
              hostelId
            )
        );

      const preferredMess =
        menu.messUnit?.id &&
        availableMess.some(
          (mess) =>
            String(
              mess.id
            ) ===
            String(
              menu.messUnit
                .id
            )
        )
          ? menu.messUnit
              .id
          : availableMess[0]
              ?.id ||
            "";

      setCopyTarget(
        menu
      );

      setCopyForm({
        date:
          getTodayInputValue(),

        hostelId:
          hostelId
            ? String(
                hostelId
              )
            : "",

        messUnitId:
          preferredMess
            ? String(
                preferredMess
              )
            : "",
      });

      setCopyError(
        ""
      );
    };


  const handleCopyHostelChange =
    (event) => {
      const hostelId =
        event.target.value;

      const available =
        messUnits.filter(
          (mess) =>
            String(
              getMessHostelId(
                mess
              )
            ) ===
            String(
              hostelId
            )
        );

      setCopyForm(
        (current) => ({
          ...current,

          hostelId,

          messUnitId:
            available[0]
              ?.id
              ? String(
                  available[0]
                    .id
                )
              : "",
        })
      );
    };


  const submitCopyMenu =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        !copyTarget
      ) {
        return;
      }

      if (
        !copyForm.date ||
        !copyForm.hostelId ||
        !copyForm.messUnitId
      ) {
        setCopyError(
          "Select the target date, Hostel and Mess Unit."
        );

        return;
      }

      setCopying(
        true
      );

      setCopyError(
        ""
      );

      try {
        const response =
          await apiFetch(
            `/api/manager/menus/${copyTarget.id}/copy`,
            {
              method:
                "POST",

              body:
                JSON.stringify({
                  date:
                    copyForm.date,

                  hostelId:
                    Number(
                      copyForm.hostelId
                    ),

                  messUnitId:
                    Number(
                      copyForm.messUnitId
                    ),

                  meal:
                    copyTarget.meal,

                  mealCategory:
                    copyTarget
                      .mealCategory,
                }),
            }
          );

        const newMenu =
          response?.menu;

        setCopyTarget(
          null
        );

        setSuccessMessage(
          response?.message ||
            "Previous Menu copied as a new draft."
        );

        if (
          newMenu
        ) {
          const filters = {
            date:
              newMenu.date,

            hostelId:
              String(
                newMenu.hostel
                  ?.id ??
                  copyForm.hostelId
              ),

            messUnitId:
              String(
                newMenu
                  .messUnit
                  ?.id ??
                  copyForm
                    .messUnitId
              ),

            meal:
              newMenu.meal,

            mealCategory:
              newMenu
                .mealCategory,
          };

          setDailyFilters(
            filters
          );

          setAppliedDailyFilters(
            filters
          );

          setActiveTab(
            "daily"
          );

          await loadDailyMenus(
            filters
          );
        }

        await loadRecentMenus();

        if (
          invalidateManagerData
        ) {
          await invalidateManagerData();
        }
      } catch (error) {
        setCopyError(
          getErrorMessage(
            error,
            "Unable to copy the Menu."
          )
        );
      } finally {
        setCopying(
          false
        );
      }
    };


  /* =========================================================
     TEMPLATE EDITOR
  ========================================================= */

  const openCreateTemplate =
    () => {
      setEditingTemplate(
        null
      );

      setTemplateForm(
        createTemplateForm()
      );

      setTemplateItems(
        []
      );

      setTemplateFoodSearch(
        ""
      );

      setTemplateEditorError(
        ""
      );

      setTemplateEditorOpen(
        true
      );
    };


  const openEditTemplate =
    (template) => {
      setEditingTemplate(
        template
      );

      setTemplateForm({
        name:
          template.name ||
          "",

        meal:
          template.meal ||
          "breakfast",

        mealCategory:
          template.mealCategory ||
          "veg",

        description:
          template.description ||
          "",

        isActive:
          template.isActive !==
          false,
      });

      setTemplateItems(
        Array.isArray(
          template.items
        )
          ? template.items.map(
              normalizeSelectedFood
            )
          : []
      );

      setTemplateFoodSearch(
        ""
      );

      setTemplateEditorError(
        ""
      );

      setTemplateEditorOpen(
        true
      );
    };


  const closeTemplateEditor =
    () => {
      if (
        templateSaving
      ) {
        return;
      }

      setTemplateEditorOpen(
        false
      );

      setEditingTemplate(
        null
      );

      setTemplateEditorError(
        ""
      );
    };


  const handleTemplateCategoryChange =
    (event) => {
      const value =
        event.target.value;

      setTemplateForm(
        (current) => ({
          ...current,
          mealCategory:
            value,
        })
      );

      setTemplateItems(
        (current) =>
          current.filter(
            (item) =>
              item.mealCategory ===
                "both" ||
              item.mealCategory ===
                value
          )
      );
    };


  const addTemplateFoodItem =
    (food) => {
      setTemplateItems(
        (current) => {
          const exists =
            current.some(
              (item) =>
                String(
                  item.menuItemId ??
                    item.id
                ) ===
                String(
                  food.id
                )
            );

          if (exists) {
            return current;
          }

          return [
            ...current,
            normalizeSelectedFood(
              food
            ),
          ];
        }
      );
    };


  const removeTemplateFoodItem =
    (foodId) => {
      setTemplateItems(
        (current) =>
          current.filter(
            (item) =>
              String(
                item.menuItemId ??
                  item.id
              ) !==
              String(foodId)
          )
      );
    };


  const updateTemplateFoodItem =
    (
      foodId,
      field,
      value
    ) => {
      setTemplateItems(
        (current) =>
          current.map(
            (item) =>
              String(
                item.menuItemId ??
                  item.id
              ) ===
              String(foodId)
                ? {
                    ...item,
                    [field]:
                      value,
                  }
                : item
          )
      );
    };


  const templateFoodIds =
    useMemo(
      () =>
        new Set(
          templateItems.map(
            (item) =>
              String(
                item.menuItemId ??
                  item.id
              )
          )
        ),
      [templateItems]
    );


  const saveTemplate =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        !templateForm.name
          .trim()
      ) {
        setTemplateEditorError(
          "Enter a Template name."
        );

        return;
      }

      if (
        templateItems.length ===
        0
      ) {
        setTemplateEditorError(
          "Select at least one food item."
        );

        return;
      }

      for (
        const item of
        templateItems
      ) {
        const quantity =
          Number(
            item.quantityPerStudent
          );

        if (
          !Number.isFinite(
            quantity
          ) ||
          quantity <= 0
        ) {
          setTemplateEditorError(
            `Enter a valid quantity for ${item.name}.`
          );

          return;
        }
      }

      setTemplateSaving(
        true
      );

      setTemplateEditorError(
        ""
      );

      try {
        const endpoint =
          editingTemplate
            ? `/api/manager/menu-templates/${editingTemplate.id}`
            : "/api/manager/menu-templates";

        const response =
          await apiFetch(
            endpoint,
            {
              method:
                editingTemplate
                  ? "PUT"
                  : "POST",

              body:
                JSON.stringify({
                  name:
                    templateForm.name
                      .trim(),

                  meal:
                    templateForm.meal,

                  mealCategory:
                    templateForm
                      .mealCategory,

                  description:
                    templateForm
                      .description
                      .trim(),

                  isActive:
                    templateForm
                      .isActive,

                  items:
                    buildItemPayload(
                      templateItems
                    ),
                }),
            }
          );

        setTemplateEditorOpen(
          false
        );

        setEditingTemplate(
          null
        );

        setSuccessMessage(
          response?.message ||
            "Menu Template saved successfully."
        );

        await loadTemplates();
      } catch (error) {
        setTemplateEditorError(
          getErrorMessage(
            error,
            "Unable to save the Menu Template."
          )
        );
      } finally {
        setTemplateSaving(
          false
        );
      }
    };


  /* =========================================================
     USE TEMPLATE
  ========================================================= */

  const openUseTemplate =
    (template) => {
      const hostelId =
        hostels[0]?.id ||
        "";

      const availableMess =
        messUnits.filter(
          (mess) =>
            String(
              getMessHostelId(
                mess
              )
            ) ===
            String(
              hostelId
            )
        );

      setUseTemplateTarget(
        template
      );

      setUseTemplateForm({
        date:
          getTodayInputValue(),

        hostelId:
          hostelId
            ? String(
                hostelId
              )
            : "",

        messUnitId:
          availableMess[0]
            ?.id
            ? String(
                availableMess[0]
                  .id
              )
            : "",
      });

      setUseTemplateError(
        ""
      );
    };


  const handleUseTemplateHostelChange =
    (event) => {
      const hostelId =
        event.target.value;

      const available =
        messUnits.filter(
          (mess) =>
            String(
              getMessHostelId(
                mess
              )
            ) ===
            String(
              hostelId
            )
        );

      setUseTemplateForm(
        (current) => ({
          ...current,

          hostelId,

          messUnitId:
            available[0]
              ?.id
              ? String(
                  available[0]
                    .id
                )
              : "",
        })
      );
    };


  const submitUseTemplate =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        !useTemplateTarget
      ) {
        return;
      }

      if (
        !useTemplateForm.date ||
        !useTemplateForm
          .hostelId ||
        !useTemplateForm
          .messUnitId
      ) {
        setUseTemplateError(
          "Select the date, Hostel and Mess Unit."
        );

        return;
      }

      setUsingTemplate(
        true
      );

      setUseTemplateError(
        ""
      );

      try {
        const response =
          await apiFetch(
            `/api/manager/menu-templates/${useTemplateTarget.id}/use`,
            {
              method:
                "POST",

              body:
                JSON.stringify({
                  date:
                    useTemplateForm
                      .date,

                  hostelId:
                    Number(
                      useTemplateForm
                        .hostelId
                    ),

                  messUnitId:
                    Number(
                      useTemplateForm
                        .messUnitId
                    ),
                }),
            }
          );

        const menu =
          response?.menu;

        setUseTemplateTarget(
          null
        );

        setSuccessMessage(
          response?.message ||
            "Menu created from Template successfully."
        );

        if (menu) {
          const filters = {
            date:
              menu.date,

            hostelId:
              String(
                menu.hostel
                  ?.id ??
                  useTemplateForm
                    .hostelId
              ),

            messUnitId:
              String(
                menu.messUnit
                  ?.id ??
                  useTemplateForm
                    .messUnitId
              ),

            meal:
              menu.meal,

            mealCategory:
              menu.mealCategory,
          };

          setDailyFilters(
            filters
          );

          setAppliedDailyFilters(
            filters
          );

          setActiveTab(
            "daily"
          );

          await loadDailyMenus(
            filters
          );
        }

        await loadRecentMenus();

        if (
          invalidateManagerData
        ) {
          await invalidateManagerData();
        }
      } catch (error) {
        setUseTemplateError(
          getErrorMessage(
            error,
            "Unable to create a Menu from this Template."
          )
        );
      } finally {
        setUsingTemplate(
          false
        );
      }
    };


  /* =========================================================
     DELETE
  ========================================================= */

  const openPermanentDelete =
    (
      kind,
      record
    ) => {
      setDeleteTarget({
        kind,
        record,
      });

      setDeleteConfirmation(
        ""
      );

      setDeleteError(
        ""
      );
    };


  const closePermanentDelete =
    useCallback(() => {
      if (
        deleting
      ) {
        return;
      }

      setDeleteTarget(
        null
      );

      setDeleteConfirmation(
        ""
      );

      setDeleteError(
        ""
      );
    }, [
      deleting,
    ]);


  const confirmPermanentDelete =
    async () => {
      if (
        !deleteTarget ||
        !isPermanentDeleteConfirmationValid(
          deleteConfirmation
        )
      ) {
        return;
      }

      if (
        !deleteGuardRef.current.tryStart()
      ) {
        return;
      }

      setDeleting(
        true
      );

      setDeleteError(
        ""
      );

      try {
        const isTemplate =
          deleteTarget.kind ===
          "template";

        const endpoint =
          isTemplate
            ? `/api/manager/menu-templates/${deleteTarget.record.id}`
            : `/api/manager/menus/${deleteTarget.record.id}`;

        const response =
          await apiFetch(
            endpoint,
            {
              method:
                "DELETE",

              body:
                JSON.stringify(
                  buildPermanentDeleteBody(
                    deleteConfirmation
                  )
                ),
            }
          );

        setDeleteTarget(
          null
        );

        setDeleteConfirmation(
          ""
        );

        setSuccessMessage(
          response?.message ||
            (
              isTemplate
                ? "Menu Template deleted permanently."
                : "Menu deleted permanently."
            )
        );

        if (
          isTemplate
        ) {
          await loadTemplates();
        } else {
          await refreshManagerMenuData();
        }
      } catch (error) {
        setDeleteError(
          getPermanentDeleteErrorMessage(
            error
          )
        );
      } finally {
        setDeleting(
          false
        );

        deleteGuardRef.current.finish();
      }
    };


  /* =========================================================
     CALENDAR
  ========================================================= */

  const calendarMap =
    useMemo(() => {
      const map =
        new Map();

      calendarDays.forEach(
        (day) => {
          map.set(
            day.date,
            Array.isArray(
              day.menus
            )
              ? day.menus
              : []
          );
        }
      );

      return map;
    }, [
      calendarDays,
    ]);


  const calendarCells =
    useMemo(() => {
      const first = new Date(
        calendarYear,
        calendarMonth - 1,
        1
      );

      const firstWeekday = first.getDay();
      const daysInMonth = new Date(
        calendarYear,
        calendarMonth,
        0
      ).getDate();
      const previousMonthDays = new Date(
        calendarYear,
        calendarMonth - 1,
        0
      ).getDate();

      const cells = [];

      for (let index = 0; index < firstWeekday; index += 1) {
        const day = previousMonthDays - firstWeekday + index + 1;
        const date = new Date(
          calendarYear,
          calendarMonth - 2,
          day
        );
        const dateKey = `${date.getFullYear()}-${padNumber(
          date.getMonth() + 1
        )}-${padNumber(date.getDate())}`;

        cells.push({
          day,
          date: dateKey,
          menus: [],
          outsideMonth: true,
        });
      }

      for (let day = 1; day <= daysInMonth; day += 1) {
        const dateKey = `${calendarYear}-${padNumber(
          calendarMonth
        )}-${padNumber(day)}`;

        cells.push({
          day,
          date: dateKey,
          menus: calendarMap.get(dateKey) || [],
          outsideMonth: false,
        });
      }

      const trailingCount = 42 - cells.length;
      for (let index = 1; index <= trailingCount; index += 1) {
        const date = new Date(
          calendarYear,
          calendarMonth,
          index
        );
        const dateKey = `${date.getFullYear()}-${padNumber(
          date.getMonth() + 1
        )}-${padNumber(date.getDate())}`;

        cells.push({
          day: index,
          date: dateKey,
          menus: [],
          outsideMonth: true,
        });
      }

      return cells;
    }, [
      calendarYear,
      calendarMonth,
      calendarMap,
    ]);


  const selectedCalendarMenus =
    useMemo(
      () =>
        calendarMap.get(
          selectedCalendarDate
        ) ||
        [],
      [
        calendarMap,
        selectedCalendarDate,
      ]
    );


  const previousCalendarMonth =
    () => {
      if (
        calendarMonth ===
        1
      ) {
        setCalendarMonth(
          12
        );

        setCalendarYear(
          (year) =>
            year - 1
        );
      } else {
        setCalendarMonth(
          (month) =>
            month - 1
        );
      }
    };


  const nextCalendarMonth =
    () => {
      if (
        calendarMonth ===
        12
      ) {
        setCalendarMonth(
          1
        );

        setCalendarYear(
          (year) =>
            year + 1
        );
      } else {
        setCalendarMonth(
          (month) =>
            month + 1
        );
      }
    };


  const calendarMonthTitle =
    useMemo(
      () =>
        new Date(
          calendarYear,
          calendarMonth -
            1,
          1
        ).toLocaleDateString(
          "en-IN",
          {
            month:
              "long",

            year:
              "numeric",
          }
        ),
      [
        calendarYear,
        calendarMonth,
      ]
    );


  const openCalendar = useCallback((event) => {
    calendarLastTriggerRef.current = event?.currentTarget || null;
    setCalendarError("");
    setCalendarOpen(true);
  }, []);

  const closeCalendar = useCallback(() => {
    setCalendarOpen(false);
  }, []);

  const handleCalendarViewMenu = useCallback(async () => {
    const selectedMenu = selectedCalendarMenus[0];

    setCalendarOpen(false);

    if (!selectedCalendarDate) {
      return;
    }

    const nextFilters = {
      ...dailyFilters,
      date: selectedCalendarDate,
      ...(selectedMenu?.hostelId != null
        ? { hostelId: String(selectedMenu.hostelId) }
        : {}),
      ...(selectedMenu?.messUnitId != null
        ? { messUnitId: String(selectedMenu.messUnitId) }
        : {}),
      ...(selectedMenu?.meal
        ? { meal: selectedMenu.meal }
        : {}),
      ...(selectedMenu?.mealCategory
        ? { mealCategory: selectedMenu.mealCategory }
        : {}),
    };

    setDailyFilters(nextFilters);
    setAppliedDailyFilters(nextFilters);
    setActiveTab("daily");
    await loadDailyMenus(nextFilters);
  }, [
    dailyFilters,
    loadDailyMenus,
    selectedCalendarDate,
    selectedCalendarMenus,
  ]);

  const handleCalendarCreateMenu = useCallback(() => {
    setCalendarOpen(false);
    openCreateMenu({ date: selectedCalendarDate });
  }, [openCreateMenu, selectedCalendarDate]);

  useEffect(() => {
    if (!calendarOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      calendarCloseButtonRef.current?.focus();
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCalendar();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialog = calendarDialogRef.current;
      if (!dialog) {
        return;
      }

      const focusable = Array.from(
        dialog.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;

      window.setTimeout(() => {
        calendarLastTriggerRef.current?.focus?.();
      }, 0);
    };
  }, [calendarOpen, closeCalendar]);


  /* =========================================================
     TAB HANDLING
  ========================================================= */

  const switchToTemplates =
    () => {
      setActiveTab(
        "templates"
      );
    };


  const quickCopyPrevious =
    () => {
      if (
        recentMenus.length ===
        0
      ) {
        setPageError(
          "No previous Menu is available to copy."
        );

        return;
      }

      openCopyMenu(
        recentMenus[0]
      );
    };


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="mm-page">

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="mm-page-header">

        <div className="mm-page-heading">
          <h1>
            Menu Management
          </h1>

          <p>
            Create and publish daily menus for all mess units
          </p>
        </div>

        <div className="mm-page-header__actions">

          <button
            type="button"
            className="mm-button mm-button--outline"
            onClick={openCalendar}
          >
            <CalendarDays
              size={17}
            />

            View Calendar
          </button>

          <button
            type="button"
            className="mm-button mm-button--primary"
            onClick={() =>
              openCreateMenu()
            }
            disabled={
              hostels.length ===
              0
            }
          >
            <Plus
              size={17}
            />

            Create Menu
          </button>

        </div>

      </div>


      {/* =====================================================
          GLOBAL MESSAGES
      ===================================================== */}

      {successMessage && (
        <div className="mm-alert mm-alert--success">
          <CheckCircle2
            size={18}
          />

          <span>
            {successMessage}
          </span>

          <button
            type="button"
            aria-label="Close success message"
            onClick={() =>
              setSuccessMessage(
                ""
              )
            }
          >
            <X
              size={17}
            />
          </button>
        </div>
      )}


      {pageError && (
        <div className="mm-alert mm-alert--error">
          <AlertCircle
            size={18}
          />

          <span>
            {pageError}
          </span>

          <button
            type="button"
            aria-label="Close error message"
            onClick={() =>
              setPageError(
                ""
              )
            }
          >
            <X
              size={17}
            />
          </button>
        </div>
      )}


      {/* =====================================================
          TABS
      ===================================================== */}

      <div
        className="mm-tabs"
        role="tablist"
        aria-label="Menu Management sections"
      >
        <button
          type="button"
          role="tab"
          aria-selected={
            activeTab ===
            "daily"
          }
          className={
            activeTab ===
            "daily"
              ? "mm-tab mm-tab--active"
              : "mm-tab"
          }
          onClick={() =>
            setActiveTab(
              "daily"
            )
          }
        >
          <UtensilsCrossed
            size={17}
          />

          Daily Menu
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={
            activeTab ===
            "history"
          }
          className={
            activeTab ===
            "history"
              ? "mm-tab mm-tab--active"
              : "mm-tab"
          }
          onClick={() =>
            setActiveTab(
              "history"
            )
          }
        >
          <Clock3
            size={17}
          />

          Menu History
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={
            activeTab ===
            "templates"
          }
          className={
            activeTab ===
            "templates"
              ? "mm-tab mm-tab--active"
              : "mm-tab"
          }
          onClick={() =>
            setActiveTab(
              "templates"
            )
          }
        >
          <LayoutTemplate
            size={17}
          />

          Menu Templates
        </button>
      </div>


      {/* =====================================================
          DAILY MENU TAB
      ===================================================== */}

      {activeTab ===
        "daily" && (
        <div
          className="mm-tab-panel"
          role="tabpanel"
        >

          {/* DAILY FILTERS */}

          <section className="mm-card mm-filter-card">

            <div className="mm-filter-grid">

              <label className="mm-field">
                <span>
                  Date
                </span>

                <input
                  type="date"
                  name="date"
                  value={
                    dailyFilters.date
                  }
                  onChange={
                    handleDailyFilterChange
                  }
                />
              </label>


              <label className="mm-field">
                <span>
                  Hostel
                </span>

                <select
                  name="hostelId"
                  value={
                    dailyFilters.hostelId
                  }
                  onChange={
                    handleDailyHostelChange
                  }
                >
                  <option value="all">
                    All Hostels
                  </option>

                  {hostels.map(
                    (hostel) => (
                      <option
                        key={
                          hostel.id
                        }
                        value={
                          hostel.id
                        }
                      >
                        {hostel.name}
                      </option>
                    )
                  )}
                </select>
              </label>


              <label className="mm-field">
                <span>
                  Mess Unit
                </span>

                <select
                  name="messUnitId"
                  value={
                    dailyFilters.messUnitId
                  }
                  onChange={
                    handleDailyFilterChange
                  }
                >
                  <option value="all">
                    All Mess Units
                  </option>

                  {dailyMessOptions.map(
                    (mess) => (
                      <option
                        key={
                          mess.id
                        }
                        value={
                          mess.id
                        }
                      >
                        {mess.name}
                      </option>
                    )
                  )}
                </select>
              </label>


              <label className="mm-field">
                <span>
                  Meal
                </span>

                <select
                  name="meal"
                  value={
                    dailyFilters.meal
                  }
                  onChange={
                    handleDailyFilterChange
                  }
                >
                  {MEALS.map(
                    (meal) => (
                      <option
                        key={
                          meal.value
                        }
                        value={
                          meal.value
                        }
                      >
                        {meal.label}
                      </option>
                    )
                  )}
                </select>
              </label>


              <label className="mm-field">
                <span>
                  Meal Category
                </span>

                <select
                  name="mealCategory"
                  value={
                    dailyFilters.mealCategory
                  }
                  onChange={
                    handleDailyFilterChange
                  }
                >
                  {CATEGORIES.map(
                    (category) => (
                      <option
                        key={
                          category.value
                        }
                        value={
                          category.value
                        }
                      >
                        {category.label}
                      </option>
                    )
                  )}
                </select>
              </label>


              <div className="mm-filter-action">
                <button
                  type="button"
                  className="mm-button mm-button--navy"
                  onClick={
                    applyDailySelection
                  }
                  disabled={
                    dailyLoading
                  }
                >
                  {dailyLoading ? (
                    <Loader2
                      size={17}
                      className="mm-spin"
                    />
                  ) : (
                    <RefreshCw
                      size={17}
                    />
                  )}

                  Load
                </button>
              </div>

            </div>

          </section>


          {dailyError && (
            <div className="mm-alert mm-alert--error">
              <AlertCircle
                size={18}
              />

              <span>
                {dailyError}
              </span>
            </div>
          )}


          {/* DAILY LOADING */}

          {dailyLoading ? (
            <section className="mm-card mm-loading-card">
              <Loader2
                size={26}
                className="mm-spin"
              />

              <span>
                Loading Menu...
              </span>
            </section>
          ) : dailyMenus.length ===
            0 ? (

            /* EMPTY STATE */

            <section className="mm-card mm-empty-state">

              <div className="mm-empty-state__icon">
                <UtensilsCrossed
                  size={30}
                />
              </div>

              <h2>
                No menu has been created for this selection.
              </h2>

              <p>
                Create a structured Menu for the selected Hostel, Mess Unit, Meal and category.
              </p>

              <button
                type="button"
                className="mm-button mm-button--primary"
                onClick={() =>
                  openCreateMenu()
                }
                disabled={
                  hostels.length ===
                  0
                }
              >
                <Plus
                  size={17}
                />

                Create Menu
              </button>

            </section>
          ) : (
            <>

              {/* MULTIPLE RESULT SELECTOR */}

              {dailyMenus.length >
                1 && (
                <section className="mm-card mm-matching-menus">

                  <div className="mm-section-heading">

                    <div>
                      <h2>
                        Matching Menus
                      </h2>

                      <p>
                        Select the Menu you want to view.
                      </p>
                    </div>

                  </div>

                  <div className="mm-matching-menu-list">

                    {dailyMenus.map(
                      (menu) => (
                        <button
                          key={
                            menu.id
                          }
                          type="button"
                          className={
                            String(
                              currentMenu
                                ?.id
                            ) ===
                            String(
                              menu.id
                            )
                              ? "mm-matching-menu mm-matching-menu--active"
                              : "mm-matching-menu"
                          }
                          onClick={() =>
                            setSelectedDailyMenuId(
                              menu.id
                            )
                          }
                        >
                          <strong>
                            {menu.hostel?.name}
                          </strong>

                          <span>
                            {menu.messUnit?.name}
                            {" • "}
                            {statusLabel(
                              menu.status
                            )}
                          </span>
                        </button>
                      )
                    )}

                  </div>

                </section>
              )}


              {/* CURRENT MENU */}

              {currentMenu && (
                <section className="mm-card mm-current-menu">

                  <div className="mm-current-menu__header">

                    <div>

                      <div className="mm-current-menu__title-row">

                        <h2>
                          Current Menu –{" "}
                          {formatMenuHeadingDate(
                            currentMenu.date
                          )}
                        </h2>

                        <span
                          className={`mm-status-badge mm-status-badge--${currentMenu.status}`}
                        >
                          {statusLabel(
                            currentMenu.status
                          )}
                        </span>

                      </div>

                      {currentMenu.publishedAt && (
                        <p>
                          Published{" "}
                          {formatDateTime(
                            currentMenu.publishedAt
                          )}
                          {currentMenu
                            .publishedBy
                            ?.name
                            ? ` by ${currentMenu.publishedBy.name}`
                            : ""}
                        </p>
                      )}

                    </div>


                    <div className="mm-current-menu__actions">

                      <button
                        type="button"
                        className="mm-button mm-button--outline"
                        onClick={() =>
                          openEditMenu(
                            currentMenu
                          )
                        }
                      >
                        <Edit3
                          size={16}
                        />

                        Edit
                      </button>


                      {currentMenu.status ===
                      "published" ? (
                        <button
                          type="button"
                          className="mm-button mm-button--navy"
                          onClick={() =>
                            changePublicationStatus(
                              currentMenu,
                              "unpublish"
                            )
                          }
                        >
                          <Clock3
                            size={16}
                          />

                          Unpublish
                        </button>
                      ) : (
                        currentMenu.status !==
                          "completed" && (
                          <button
                            type="button"
                            className="mm-button mm-button--primary"
                            onClick={() =>
                              changePublicationStatus(
                                currentMenu,
                                "publish"
                              )
                            }
                          >
                            <Send
                              size={16}
                            />

                            Publish
                          </button>
                        )
                      )}


                      <button
                        type="button"
                        className="mm-button mm-button--danger-outline"
                        onClick={() =>
                          openPermanentDelete(
                            "menu",
                            currentMenu
                          )
                        }
                      >
                        <Trash2
                          size={16}
                        />

                        Delete
                      </button>

                    </div>

                  </div>


                  {/* SUMMARY */}

                  <div className="mm-menu-summary">

                    <div className="mm-summary-box">
                      <span>
                        Mess Unit
                      </span>

                      <strong>
                        {currentMenu
                          .messUnit
                          ?.name ||
                          "—"}
                      </strong>
                    </div>

                    <div className="mm-summary-box">
                      <span>
                        Meal
                      </span>

                      <strong>
                        {formatMeal(
                          currentMenu.meal
                        )}
                      </strong>
                    </div>

                    <div className="mm-summary-box">
                      <span>
                        Meal Category
                      </span>

                      <strong>
                        {formatCategory(
                          currentMenu.mealCategory
                        )}
                      </strong>
                    </div>

                  </div>


                  <div className="mm-current-menu__body">

                    <div className="mm-menu-items-section">

                      <div className="mm-section-heading">

                        <div>
                          <h3>
                            Menu Items
                          </h3>

                          <p>
                            Quantity is shown per student.
                          </p>
                        </div>

                        <span className="mm-count-pill">
                          {getMenuItemCount(
                            currentMenu
                          )}{" "}
                          items
                        </span>

                      </div>


                      {Array.isArray(
                        currentMenu.items
                      ) &&
                      currentMenu.items
                        .length >
                        0 ? (
                        <div className="mm-table-wrap">

                          <table className="mm-table">

                            <thead>
                              <tr>
                                <th>
                                  #
                                </th>

                                <th>
                                  Food
                                </th>

                                <th>
                                  Item Name
                                </th>

                                <th>
                                  Type
                                </th>

                                <th>
                                  Quantity / Student
                                </th>

                                <th>
                                  Actions
                                </th>
                              </tr>
                            </thead>

                            <tbody>

                              {currentMenu.items.map(
                                (
                                  item,
                                  index
                                ) => (
                                  <tr
                                    key={
                                      item.linkId ||
                                      `${item.menuItemId}-${index}`
                                    }
                                  >
                                    <td>
                                      {index +
                                        1}
                                    </td>

                                    <td>
                                      <FoodImage
                                        item={
                                          item
                                        }
                                        size="small"
                                      />
                                    </td>

                                    <td>
                                      <strong className="mm-table-primary">
                                        {item.name}
                                      </strong>
                                    </td>

                                    <td>
                                      <span
                                        className={`mm-type-badge mm-type-badge--${String(
                                          item.type ||
                                            "other"
                                        )
                                          .toLowerCase()
                                          .replace(
                                            /\s+/g,
                                            "-"
                                          )}`}
                                      >
                                        {item.type ||
                                          "Other"}
                                      </span>
                                    </td>

                                    <td>
                                      {item.quantityPerStudent}
                                      {" "}
                                      {item.unit}
                                    </td>

                                    <td>
                                      <div className="mm-table-actions">

                                        <button
                                          type="button"
                                          className="mm-icon-action mm-icon-action--edit"
                                          onClick={() =>
                                            openMenuItemEdit(
                                              item
                                            )
                                          }
                                          aria-label={`Edit ${item.name}`}
                                          title="Edit item"
                                        >
                                          <Edit3
                                            size={15}
                                          />
                                        </button>

                                        <button
                                          type="button"
                                          className="mm-icon-action mm-icon-action--delete"
                                          onClick={() =>
                                            removeCurrentMenuItem(
                                              item
                                            )
                                          }
                                          disabled={
                                            removingItemId ===
                                            item.linkId
                                          }
                                          aria-label={`Remove ${item.name}`}
                                          title="Remove item"
                                        >
                                          {removingItemId ===
                                          item.linkId ? (
                                            <Loader2
                                              size={15}
                                              className="mm-spin"
                                            />
                                          ) : (
                                            <Trash2
                                              size={15}
                                            />
                                          )}
                                        </button>

                                      </div>
                                    </td>
                                  </tr>
                                )
                              )}

                            </tbody>

                          </table>

                        </div>
                      ) : (
                        <div className="mm-legacy-items">
                          {currentMenu.menuItems ||
                            "No structured Menu items are available."}
                        </div>
                      )}

                    </div>


                    {/* PREVIEW */}

                    <aside className="mm-menu-preview">

                      <div className="mm-menu-preview__heading">

                        <div>
                          <span className="mm-preview-label">
                            MENU PREVIEW
                          </span>

                          <h3>
                            {formatMeal(
                              currentMenu.meal
                            )}
                          </h3>
                        </div>

                        <span
                          className={`mm-category-badge mm-category-badge--${currentMenu.mealCategory}`}
                        >
                          {formatCategory(
                            currentMenu.mealCategory
                          )}
                        </span>

                      </div>


                      <div className="mm-preview-foods">

                        {Array.isArray(
                          currentMenu.items
                        ) &&
                        currentMenu.items
                          .length >
                          0 ? (
                          currentMenu.items.map(
                            (item) => (
                              <div
                                key={
                                  item.linkId ||
                                  item.menuItemId
                                }
                                className="mm-preview-food"
                              >
                                <FoodImage
                                  item={
                                    item
                                  }
                                  size="small"
                                />

                                <div>
                                  <strong>
                                    {item.name}
                                  </strong>

                                  <span>
                                    {item.quantityPerStudent}
                                    {" "}
                                    {item.unit}
                                  </span>
                                </div>
                              </div>
                            )
                          )
                        ) : (
                          <p className="mm-preview-empty">
                            {currentMenu.menuItems ||
                              "No items"}
                          </p>
                        )}

                      </div>


                      <div className="mm-preview-metrics">

                        <div>
                          <span>
                            Total Items
                          </span>

                          <strong>
                            {getMenuItemCount(
                              currentMenu
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Approx. Calories
                          </span>

                          <strong>
                            {Math.round(
                              Number(
                                currentMenu.approximateCalories ||
                                  0
                              )
                            )}{" "}
                            kcal
                          </strong>
                        </div>

                        <div>
                          <span>
                            Estimated Students
                          </span>

                          <strong>
                            {Number(
                              currentMenu.estimatedStudents ||
                                0
                            )}
                          </strong>
                        </div>

                      </div>

                    </aside>

                  </div>

                </section>
              )}

            </>
          )}


          {/* =================================================
              RECENT + QUICK ACTIONS
          ================================================= */}

          <div className="mm-bottom-grid">

            <section className="mm-card mm-recent-card">

              <div className="mm-section-heading">

                <div>
                  <h2>
                    Recent Menus
                  </h2>

                  <p>
                    Recently created menus from your Manager account.
                  </p>
                </div>

                <button
                  type="button"
                  className="mm-link-button"
                  onClick={() =>
                    setActiveTab(
                      "history"
                    )
                  }
                >
                  View All
                </button>

              </div>


              {recentLoading ? (
                <div className="mm-inline-loading">
                  <Loader2
                    size={20}
                    className="mm-spin"
                  />

                  Loading recent menus...
                </div>
              ) : recentMenus.length ===
                0 ? (
                <div className="mm-small-empty">
                  No recent menus available.
                </div>
              ) : (
                <div className="mm-table-wrap">

                  <table className="mm-table mm-table--compact">

                    <thead>
                      <tr>
                        <th>
                          Date
                        </th>

                        <th>
                          Hostel
                        </th>

                        <th>
                          Mess Unit
                        </th>

                        <th>
                          Meal
                        </th>

                        <th>
                          Category
                        </th>

                        <th>
                          Items
                        </th>

                        <th>
                          Status
                        </th>

                        <th>
                          View
                        </th>
                      </tr>
                    </thead>

                    <tbody>

                      {recentMenus.map(
                        (menu) => (
                          <tr
                            key={
                              menu.id
                            }
                          >
                            <td>
                              {formatDate(
                                menu.date
                              )}
                            </td>

                            <td>
                              {menu.hostel?.name ||
                                "—"}
                            </td>

                            <td>
                              {menu.messUnit?.name ||
                                "—"}
                            </td>

                            <td>
                              {formatMeal(
                                menu.meal
                              )}
                            </td>

                            <td>
                              <span
                                className={`mm-category-badge mm-category-badge--${menu.mealCategory}`}
                              >
                                {formatCategory(
                                  menu.mealCategory
                                )}
                              </span>
                            </td>

                            <td>
                              {getMenuItemCount(
                                menu
                              )}
                            </td>

                            <td>
                              <span
                                className={`mm-status-badge mm-status-badge--${menu.status}`}
                              >
                                {statusLabel(
                                  menu.status
                                )}
                              </span>
                            </td>

                            <td>
                              <button
                                type="button"
                                className="mm-icon-action"
                                title="View Menu"
                                aria-label="View Menu"
                                onClick={() =>
                                  viewMenuInDaily(
                                    menu
                                  )
                                }
                              >
                                <Eye
                                  size={16}
                                />
                              </button>
                            </td>
                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                </div>
              )}

            </section>


            <section className="mm-card mm-quick-actions-card">

              <div className="mm-section-heading">

                <div>
                  <h2>
                    Quick Actions
                  </h2>

                  <p>
                    Common Menu Management tasks.
                  </p>
                </div>

              </div>


              <div className="mm-quick-actions">

                <button
                  type="button"
                  onClick={() =>
                    openCreateMenu()
                  }
                >
                  <span className="mm-quick-action-icon">
                    <Plus
                      size={19}
                    />
                  </span>

                  <span>
                    <strong>
                      Create Menu
                    </strong>

                    <small>
                      Create a new daily Menu
                    </small>
                  </span>
                </button>


                <button
                  type="button"
                  onClick={
                    switchToTemplates
                  }
                >
                  <span className="mm-quick-action-icon">
                    <LayoutTemplate
                      size={19}
                    />
                  </span>

                  <span>
                    <strong>
                      Use Template
                    </strong>

                    <small>
                      Build from a saved Template
                    </small>
                  </span>
                </button>


                <button
                  type="button"
                  onClick={
                    quickCopyPrevious
                  }
                >
                  <span className="mm-quick-action-icon">
                    <ClipboardCopy
                      size={19}
                    />
                  </span>

                  <span>
                    <strong>
                      Copy Previous Menu
                    </strong>

                    <small>
                      Copy without changing the source
                    </small>
                  </span>
                </button>


                <button
                  type="button"
                  onClick={openCalendar}
                >
                  <span className="mm-quick-action-icon">
                    <CalendarDays
                      size={19}
                    />
                  </span>

                  <span>
                    <strong>
                      View Calendar
                    </strong>

                    <small>
                      Browse menus by month
                    </small>
                  </span>
                </button>

              </div>

            </section>

          </div>

        </div>
      )}


      {/* =====================================================
          HISTORY TAB
      ===================================================== */}

      {activeTab ===
        "history" && (
        <div
          className="mm-tab-panel"
          role="tabpanel"
        >

          <div className="mm-retention-notice">
            <Clock3
              size={18}
            />

            <span>
              {retentionMessage}
            </span>
          </div>


          <section className="mm-card mm-history-filter-card">

            <div className="mm-history-filter-grid">

              <label className="mm-field">
                <span>
                  From Date
                </span>

                <input
                  type="date"
                  name="startDate"
                  value={
                    historyFilters.startDate
                  }
                  onChange={
                    handleHistoryFilterChange
                  }
                />
              </label>


              <label className="mm-field">
                <span>
                  To Date
                </span>

                <input
                  type="date"
                  name="endDate"
                  value={
                    historyFilters.endDate
                  }
                  onChange={
                    handleHistoryFilterChange
                  }
                />
              </label>


              <label className="mm-field">
                <span>
                  Hostel
                </span>

                <select
                  name="hostelId"
                  value={
                    historyFilters.hostelId
                  }
                  onChange={
                    handleHistoryHostelChange
                  }
                >
                  <option value="all">
                    All Hostels
                  </option>

                  {hostels.map(
                    (hostel) => (
                      <option
                        key={
                          hostel.id
                        }
                        value={
                          hostel.id
                        }
                      >
                        {hostel.name}
                      </option>
                    )
                  )}
                </select>
              </label>


              <label className="mm-field">
                <span>
                  Mess Unit
                </span>

                <select
                  name="messUnitId"
                  value={
                    historyFilters.messUnitId
                  }
                  onChange={
                    handleHistoryFilterChange
                  }
                >
                  <option value="all">
                    All Mess Units
                  </option>

                  {historyMessOptions.map(
                    (mess) => (
                      <option
                        key={
                          mess.id
                        }
                        value={
                          mess.id
                        }
                      >
                        {mess.name}
                      </option>
                    )
                  )}
                </select>
              </label>


              <label className="mm-field">
                <span>
                  Meal
                </span>

                <select
                  name="meal"
                  value={
                    historyFilters.meal
                  }
                  onChange={
                    handleHistoryFilterChange
                  }
                >
                  <option value="all">
                    All Meals
                  </option>

                  {MEALS.map(
                    (meal) => (
                      <option
                        key={
                          meal.value
                        }
                        value={
                          meal.value
                        }
                      >
                        {meal.label}
                      </option>
                    )
                  )}
                </select>
              </label>


              <label className="mm-field">
                <span>
                  Category
                </span>

                <select
                  name="mealCategory"
                  value={
                    historyFilters.mealCategory
                  }
                  onChange={
                    handleHistoryFilterChange
                  }
                >
                  <option value="all">
                    All
                  </option>

                  {CATEGORIES.map(
                    (category) => (
                      <option
                        key={
                          category.value
                        }
                        value={
                          category.value
                        }
                      >
                        {category.label}
                      </option>
                    )
                  )}
                </select>
              </label>


              <label className="mm-field">
                <span>
                  Status
                </span>

                <select
                  name="status"
                  value={
                    historyFilters.status
                  }
                  onChange={
                    handleHistoryFilterChange
                  }
                >
                  <option value="all">
                    All Statuses
                  </option>

                  <option value="draft">
                    Draft
                  </option>

                  <option value="scheduled">
                    Scheduled
                  </option>

                  <option value="published">
                    Published
                  </option>

                  <option value="unpublished">
                    Unpublished
                  </option>

                  <option value="completed">
                    Completed
                  </option>
                </select>
              </label>


              <label className="mm-field mm-field--search">
                <span>
                  Search
                </span>

                <div className="mm-input-icon">
                  <Search
                    size={17}
                  />

                  <input
                    type="search"
                    name="search"
                    value={
                      historyFilters.search
                    }
                    onChange={
                      handleHistoryFilterChange
                    }
                    placeholder="Search Hostel, Mess or food item"
                    onKeyDown={
                      (event) => {
                        if (
                          event.key ===
                          "Enter"
                        ) {
                          event.preventDefault();
                          applyHistory();
                        }
                      }
                    }
                  />
                </div>
              </label>

            </div>


            <div className="mm-filter-footer">

              <button
                type="button"
                className="mm-button mm-button--secondary"
                onClick={
                  clearHistoryFilters
                }
              >
                Clear
              </button>

              <button
                type="button"
                className="mm-button mm-button--navy"
                onClick={
                  applyHistory
                }
              >
                <Search
                  size={16}
                />

                Apply Filters
              </button>

            </div>

          </section>


          <section className="mm-card mm-history-card">

            <div className="mm-section-heading">

              <div>
                <h2>
                  Menu History
                </h2>

                <p>
                  {historyPagination.total}{" "}
                  historical Menu record
                  {historyPagination.total ===
                  1
                    ? ""
                    : "s"}
                </p>
              </div>


              <button
                type="button"
                className="mm-icon-button"
                onClick={() =>
                  loadHistory(
                    historyPagination.page,
                    appliedHistoryFilters
                  )
                }
                disabled={
                  historyLoading
                }
                title="Refresh Menu History"
                aria-label="Refresh Menu History"
              >
                <RefreshCw
                  size={18}
                  className={
                    historyLoading
                      ? "mm-spin"
                      : ""
                  }
                />
              </button>

            </div>


            {historyError && (
              <div className="mm-alert mm-alert--error">
                <AlertCircle
                  size={17}
                />

                {historyError}
              </div>
            )}


            {historyLoading ? (
              <div className="mm-loading-card">
                <Loader2
                  size={24}
                  className="mm-spin"
                />

                Loading Menu History...
              </div>
            ) : historyMenus.length ===
              0 ? (
              <div className="mm-small-empty">
                No matching Menu History records found.
              </div>
            ) : (
              <div className="mm-table-wrap">

                <table className="mm-table">

                  <thead>
                    <tr>
                      <th>
                        Date
                      </th>

                      <th>
                        Hostel
                      </th>

                      <th>
                        Mess Unit
                      </th>

                      <th>
                        Meal
                      </th>

                      <th>
                        Category
                      </th>

                      <th>
                        Menu Items
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Published At
                      </th>

                      <th>
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>

                    {historyMenus.map(
                      (menu) => (
                        <tr
                          key={
                            menu.id
                          }
                        >
                          <td>
                            {formatDate(
                              menu.date
                            )}
                          </td>

                          <td>
                            {menu.hostel?.name ||
                              "—"}
                          </td>

                          <td>
                            {menu.messUnit?.name ||
                              "—"}
                          </td>

                          <td>
                            {formatMeal(
                              menu.meal
                            )}
                          </td>

                          <td>
                            <span
                              className={`mm-category-badge mm-category-badge--${menu.mealCategory}`}
                            >
                              {formatCategory(
                                menu.mealCategory
                              )}
                            </span>
                          </td>

                          <td>
                            <span
                              className="mm-history-items"
                              title={
                                getMenuItemsText(
                                  menu
                                )
                              }
                            >
                              {getMenuItemsText(
                                menu
                              )}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`mm-status-badge mm-status-badge--${menu.status}`}
                            >
                              {statusLabel(
                                menu.status
                              )}
                            </span>
                          </td>

                          <td>
                            {formatDateTime(
                              menu.publishedAt
                            )}
                          </td>

                          <td>
                            <div className="mm-table-actions">

                              <button
                                type="button"
                                className="mm-icon-action"
                                onClick={() =>
                                  viewMenuInDaily(
                                    menu
                                  )
                                }
                                title="View"
                                aria-label="View Menu"
                              >
                                <Eye
                                  size={15}
                                />
                              </button>

                              <button
                                type="button"
                                className="mm-icon-action mm-icon-action--copy"
                                onClick={() =>
                                  openCopyMenu(
                                    menu
                                  )
                                }
                                title="Copy"
                                aria-label="Copy Menu"
                              >
                                <Copy
                                  size={15}
                                />
                              </button>

                              <button
                                type="button"
                                className="mm-icon-action mm-icon-action--delete"
                                onClick={() =>
                                  openPermanentDelete(
                                    "menu",
                                    menu
                                  )
                                }
                                title="Delete"
                                aria-label="Delete Menu"
                              >
                                <Trash2
                                  size={15}
                                />
                              </button>

                            </div>
                          </td>
                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>
            )}


            <div className="mm-pagination">

              <span>
                Page{" "}
                {historyPagination.page}{" "}
                of{" "}
                {historyPagination.pages}
              </span>

              <div>

                <button
                  type="button"
                  className="mm-button mm-button--secondary"
                  disabled={
                    historyPagination.page <=
                      1 ||
                    historyLoading
                  }
                  onClick={() =>
                    setHistoryPagination(
                      (current) => ({
                        ...current,
                        page:
                          Math.max(
                            current.page -
                              1,
                            1
                          ),
                      })
                    )
                  }
                >
                  <ChevronLeft
                    size={16}
                  />

                  Previous
                </button>

                <button
                  type="button"
                  className="mm-button mm-button--secondary"
                  disabled={
                    historyPagination.page >=
                      historyPagination.pages ||
                    historyLoading
                  }
                  onClick={() =>
                    setHistoryPagination(
                      (current) => ({
                        ...current,
                        page:
                          Math.min(
                            current.page +
                              1,
                            current.pages
                          ),
                      })
                    )
                  }
                >
                  Next

                  <ChevronRight
                    size={16}
                  />
                </button>

              </div>

            </div>

          </section>

        </div>
      )}


      {/* =====================================================
          TEMPLATES TAB
      ===================================================== */}

      {activeTab ===
        "templates" && (
        <div
          className="mm-tab-panel"
          role="tabpanel"
        >

          <section className="mm-card mm-template-toolbar">

            <div className="mm-input-icon mm-template-search">
              <Search
                size={17}
              />

              <input
                type="search"
                value={
                  templateSearch
                }
                onChange={
                  (event) =>
                    setTemplateSearch(
                      event.target
                        .value
                    )
                }
                placeholder="Search Menu Templates"
                onKeyDown={
                  (event) => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      event.preventDefault();
                      loadTemplates();
                    }
                  }
                }
              />
            </div>


            <div className="mm-template-toolbar__actions">

              <button
                type="button"
                className="mm-button mm-button--outline"
                onClick={
                  loadTemplates
                }
                disabled={
                  templatesLoading
                }
              >
                <RefreshCw
                  size={16}
                  className={
                    templatesLoading
                      ? "mm-spin"
                      : ""
                  }
                />

                Refresh
              </button>

              <button
                type="button"
                className="mm-button mm-button--primary"
                onClick={
                  openCreateTemplate
                }
              >
                <Plus
                  size={17}
                />

                Create Template
              </button>

            </div>

          </section>


          {templatesError && (
            <div className="mm-alert mm-alert--error">
              <AlertCircle
                size={18}
              />

              {templatesError}
            </div>
          )}


          {templatesLoading ? (
            <section className="mm-card mm-loading-card">
              <Loader2
                size={25}
                className="mm-spin"
              />

              Loading Menu Templates...
            </section>
          ) : templates.length ===
            0 ? (
            <section className="mm-card mm-empty-state">

              <div className="mm-empty-state__icon">
                <LayoutTemplate
                  size={30}
                />
              </div>

              <h2>
                No Menu Templates yet
              </h2>

              <p>
                Save frequently used Menu combinations and reuse them for daily planning.
              </p>

              <button
                type="button"
                className="mm-button mm-button--primary"
                onClick={
                  openCreateTemplate
                }
              >
                <Plus
                  size={17}
                />

                Create Template
              </button>

            </section>
          ) : (
            <div className="mm-template-grid">

              {templates.map(
                (template) => (
                  <article
                    key={
                      template.id
                    }
                    className="mm-card mm-template-card"
                  >

                    <div className="mm-template-card__top">

                      <div>
                        <span className="mm-template-label">
                          MENU TEMPLATE
                        </span>

                        <h2>
                          {template.name}
                        </h2>
                      </div>

                      <span
                        className={
                          template.isActive
                            ? "mm-status-badge mm-status-badge--published"
                            : "mm-status-badge mm-status-badge--unpublished"
                        }
                      >
                        {template.isActive
                          ? "Active"
                          : "Inactive"}
                      </span>

                    </div>


                    <div className="mm-template-meta">

                      <span>
                        {formatMeal(
                          template.meal
                        )}
                      </span>

                      <span>
                        {formatCategory(
                          template.mealCategory
                        )}
                      </span>

                      <span>
                        {template.itemCount ??
                          template.items
                            ?.length ??
                          0}{" "}
                        items
                      </span>

                    </div>


                    {template.description && (
                      <p className="mm-template-description">
                        {template.description}
                      </p>
                    )}


                    <div className="mm-template-items">

                      {Array.isArray(
                        template.items
                      ) &&
                      template.items
                        .length >
                        0 ? (
                        template.items.map(
                          (item) => (
                            <div
                              key={
                                item.templateItemId ||
                                item.id
                              }
                              className="mm-template-food"
                            >
                              <FoodImage
                                item={
                                  item
                                }
                                size="small"
                              />

                              <div>
                                <strong>
                                  {item.name}
                                </strong>

                                <span>
                                  {item.quantityPerStudent}
                                  {" "}
                                  {item.unit}
                                </span>
                              </div>
                            </div>
                          )
                        )
                      ) : (
                        <span className="mm-muted">
                          No food items
                        </span>
                      )}

                    </div>


                    <div className="mm-template-card__actions">

                      <button
                        type="button"
                        className="mm-button mm-button--navy"
                        onClick={() =>
                          openUseTemplate(
                            template
                          )
                        }
                        disabled={
                          !template.isActive
                        }
                      >
                        <Check
                          size={16}
                        />

                        Use Template
                      </button>

                      <button
                        type="button"
                        className="mm-button mm-button--outline"
                        onClick={() =>
                          openEditTemplate(
                            template
                          )
                        }
                      >
                        <Edit3
                          size={16}
                        />

                        Edit
                      </button>

                      <button
                        type="button"
                        className="mm-button mm-button--danger-outline"
                        onClick={() =>
                          openPermanentDelete(
                            "template",
                            template
                          )
                        }
                      >
                        <Trash2
                          size={16}
                        />

                        Delete
                      </button>

                    </div>

                  </article>
                )
              )}

            </div>
          )}

        </div>
      )}


      {/* =====================================================
          CREATE / EDIT MENU DRAWER
      ===================================================== */}

      {drawerOpen && (
        <div
          className="mm-drawer-backdrop"
          onMouseDown={
            (event) => {
              if (
                event.target ===
                  event.currentTarget &&
                !savingMenu
              ) {
                closeDrawer();
              }
            }
          }
        >
          <aside
            className="mm-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mm-drawer-title"
          >

            <div className="mm-drawer__header">

              <div>
                <span className="mm-drawer-eyebrow">
                  MENU PLANNING
                </span>

                <h2
                  id="mm-drawer-title"
                >
                  {drawerMode ===
                  "edit"
                    ? "Edit Menu"
                    : "Create New Menu"}
                </h2>
              </div>

              <button
                type="button"
                className="mm-icon-button"
                onClick={
                  closeDrawer
                }
                disabled={
                  savingMenu
                }
                aria-label="Close Menu drawer"
              >
                <X
                  size={21}
                />
              </button>

            </div>


            <form
              className="mm-drawer__body"
              onSubmit={
                saveMenu
              }
            >

              {drawerError && (
                <div className="mm-form-error">
                  <AlertCircle
                    size={17}
                  />

                  {drawerError}
                </div>
              )}


              <div className="mm-drawer-form-grid">

                <label className="mm-field">
                  <span>
                    Date *
                  </span>

                  <input
                    type="date"
                    name="date"
                    value={
                      menuForm.date
                    }
                    onChange={
                      handleMenuFormChange
                    }
                  />
                </label>


                <label className="mm-field">
                  <span>
                    Hostel *
                  </span>

                  <select
                    name="hostelId"
                    value={
                      menuForm.hostelId
                    }
                    onChange={
                      handleDrawerHostelChange
                    }
                  >
                    <option value="">
                      Select Hostel
                    </option>

                    {hostels.map(
                      (hostel) => (
                        <option
                          key={
                            hostel.id
                          }
                          value={
                            hostel.id
                          }
                        >
                          {hostel.name}
                        </option>
                      )
                    )}
                  </select>
                </label>


                <label className="mm-field">
                  <span>
                    Mess Unit *
                  </span>

                  <select
                    name="messUnitId"
                    value={
                      menuForm.messUnitId
                    }
                    onChange={
                      handleMenuFormChange
                    }
                    disabled={
                      !menuForm.hostelId
                    }
                  >
                    <option value="">
                      Select Mess Unit
                    </option>

                    {drawerMessOptions.map(
                      (mess) => (
                        <option
                          key={
                            mess.id
                          }
                          value={
                            mess.id
                          }
                        >
                          {mess.name}
                        </option>
                      )
                    )}
                  </select>
                </label>


                <label className="mm-field">
                  <span>
                    Meal *
                  </span>

                  <select
                    name="meal"
                    value={
                      menuForm.meal
                    }
                    onChange={
                      handleMenuFormChange
                    }
                  >
                    {MEALS.map(
                      (meal) => (
                        <option
                          key={
                            meal.value
                          }
                          value={
                            meal.value
                          }
                        >
                          {meal.label}
                        </option>
                      )
                    )}
                  </select>
                </label>


                <label className="mm-field">
                  <span>
                    Meal Category *
                  </span>

                  <select
                    name="mealCategory"
                    value={
                      menuForm.mealCategory
                    }
                    onChange={
                      handleDrawerCategoryChange
                    }
                  >
                    {CATEGORIES.map(
                      (category) => (
                        <option
                          key={
                            category.value
                          }
                          value={
                            category.value
                          }
                        >
                          {category.label}
                        </option>
                      )
                    )}
                  </select>
                </label>

              </div>


              {/* FOOD CATALOG */}

              <div className="mm-drawer-section">

                <div className="mm-drawer-section__heading">

                  <div>
                    <h3>
                      Available Food Items
                    </h3>

                    <p>
                      Food items are loaded from the database.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="mm-link-button"
                    onClick={
                      openCustomFood
                    }
                  >
                    <Plus
                      size={15}
                    />

                    Custom Item
                  </button>

                </div>


                <div className="mm-input-icon">
                  <Search
                    size={17}
                  />

                  <input
                    type="search"
                    value={
                      foodSearch
                    }
                    onChange={
                      (event) =>
                        setFoodSearch(
                          event.target
                            .value
                        )
                    }
                    placeholder="Search food items"
                  />
                </div>


                {catalogError && (
                  <div className="mm-form-error">
                    <AlertCircle
                      size={16}
                    />

                    {catalogError}
                  </div>
                )}


                {catalogLoading ? (
                  <div className="mm-inline-loading">
                    <Loader2
                      size={20}
                      className="mm-spin"
                    />

                    Loading food items...
                  </div>
                ) : catalogItems.length ===
                  0 ? (
                  <div className="mm-small-empty">
                    No food items found. Create a custom food item if required.
                  </div>
                ) : (
                  <div className="mm-food-catalog">

                    {catalogItems.map(
                      (food) => {
                        const selected =
                          selectedFoodIds.has(
                            String(
                              food.id
                            )
                          );

                        return (
                          <div
                            key={
                              food.id
                            }
                            className={
                              selected
                                ? "mm-food-option mm-food-option--selected"
                                : "mm-food-option"
                            }
                          >

                            <button
                              type="button"
                              className="mm-food-checkbox"
                              aria-label={
                                selected
                                  ? `Remove ${food.name}`
                                  : `Add ${food.name}`
                              }
                              aria-pressed={
                                selected
                              }
                              onClick={() =>
                                selected
                                  ? removeSelectedFoodItem(
                                      food.id
                                    )
                                  : addFoodItem(
                                      food
                                    )
                              }
                            >
                              {selected && (
                                <Check
                                  size={14}
                                />
                              )}
                            </button>


                            <FoodImage
                              item={
                                food
                              }
                              size="small"
                            />


                            <div className="mm-food-option__content">

                              <strong>
                                {food.name}
                              </strong>

                              <span
                                className={`mm-type-badge mm-type-badge--${String(
                                  food.type ||
                                    "other"
                                )
                                  .toLowerCase()
                                  .replace(
                                    /\s+/g,
                                    "-"
                                  )}`}
                              >
                                {food.type ||
                                  "Other"}
                              </span>

                            </div>


                            <button
                              type="button"
                              className={
                                selected
                                  ? "mm-food-add-button mm-food-add-button--selected"
                                  : "mm-food-add-button"
                              }
                              onClick={() =>
                                selected
                                  ? removeSelectedFoodItem(
                                      food.id
                                    )
                                  : addFoodItem(
                                      food
                                    )
                              }
                            >
                              {selected
                                ? "Added"
                                : "Add"}
                            </button>

                          </div>
                        );
                      }
                    )}

                  </div>
                )}

              </div>


              {/* SELECTED ITEMS */}

              <div className="mm-drawer-section">

                <div className="mm-drawer-section__heading">

                  <div>
                    <h3>
                      Selected Items
                    </h3>

                    <p>
                      Set the quantity per student for each food item.
                    </p>
                  </div>

                  <span className="mm-count-pill">
                    {selectedItems.length}{" "}
                    selected
                  </span>

                </div>


                {selectedItems.length ===
                0 ? (
                  <div className="mm-small-empty">
                    Select at least one food item.
                  </div>
                ) : (
                  <div className="mm-selected-food-list">

                    {selectedItems.map(
                      (item) => (
                        <div
                          key={
                            item.menuItemId ??
                            item.id
                          }
                          className="mm-selected-food"
                        >

                          <div className="mm-selected-food__main">

                            <FoodImage
                              item={
                                item
                              }
                              size="small"
                            />

                            <div>
                              <strong>
                                {item.name}
                              </strong>

                              <span>
                                {item.type}
                                {" • "}
                                {Math.round(
                                  calculateSelectedItemCalories(
                                    item
                                  )
                                )}{" "}
                                kcal
                              </span>
                            </div>

                          </div>


                          <label className="mm-mini-field">
                            <span>
                              Quantity
                            </span>

                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={
                                item.quantityPerStudent
                              }
                              onChange={
                                (event) =>
                                  updateSelectedFoodItem(
                                    item.menuItemId ??
                                      item.id,
                                    "quantityPerStudent",
                                    event.target
                                      .value
                                  )
                              }
                            />
                          </label>


                          <label className="mm-mini-field">
                            <span>
                              Unit
                            </span>

                            <select
                              value={
                                item.unit
                              }
                              onChange={
                                (event) =>
                                  updateSelectedFoodItem(
                                    item.menuItemId ??
                                      item.id,
                                    "unit",
                                    event.target
                                      .value
                                  )
                              }
                            >
                              {UNITS.map(
                                (unit) => (
                                  <option
                                    key={
                                      unit
                                    }
                                    value={
                                      unit
                                    }
                                  >
                                    {unit}
                                  </option>
                                )
                              )}

                              {!UNITS.includes(
                                item.unit
                              ) &&
                                item.unit && (
                                  <option
                                    value={
                                      item.unit
                                    }
                                  >
                                    {item.unit}
                                  </option>
                                )}
                            </select>
                          </label>


                          <button
                            type="button"
                            className="mm-icon-action mm-icon-action--delete"
                            onClick={() =>
                              removeSelectedFoodItem(
                                item.menuItemId ??
                                  item.id
                              )
                            }
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2
                              size={16}
                            />
                          </button>

                        </div>
                      )
                    )}

                  </div>
                )}

              </div>


              {/* LIVE PREVIEW */}

              <div className="mm-drawer-preview">

                <div className="mm-menu-preview__heading">

                  <div>
                    <span className="mm-preview-label">
                      MENU PREVIEW
                    </span>

                    <h3>
                      {formatMeal(
                        menuForm.meal
                      )}
                    </h3>
                  </div>

                  <span
                    className={`mm-category-badge mm-category-badge--${menuForm.mealCategory}`}
                  >
                    {formatCategory(
                      menuForm.mealCategory
                    )}
                  </span>

                </div>


                <div className="mm-preview-foods">

                  {selectedItems.length ===
                  0 ? (
                    <p className="mm-preview-empty">
                      Add food items to preview the Menu.
                    </p>
                  ) : (
                    selectedItems.map(
                      (item) => (
                        <div
                          key={
                            item.menuItemId ??
                            item.id
                          }
                          className="mm-preview-food"
                        >
                          <FoodImage
                            item={
                              item
                            }
                            size="small"
                          />

                          <div>
                            <strong>
                              {item.name}
                            </strong>

                            <span>
                              {item.quantityPerStudent}
                              {" "}
                              {item.unit}
                            </span>
                          </div>
                        </div>
                      )
                    )
                  )}

                </div>


                <div className="mm-preview-metrics">

                  <div>
                    <span>
                      Total Items
                    </span>

                    <strong>
                      {selectedItems.length}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Approx. Calories
                    </span>

                    <strong>
                      {Math.round(
                        selectedCalories
                      )}{" "}
                      kcal
                    </strong>
                  </div>

                  <div>
                    <span>
                      Estimated Students
                    </span>

                    <strong>
                      {editingMenu
                        ?.estimatedStudents ??
                        "After save"}
                    </strong>
                  </div>

                </div>

              </div>


              <div className="mm-drawer__footer">

                <button
                  type="button"
                  className="mm-button mm-button--secondary"
                  onClick={
                    closeDrawer
                  }
                  disabled={
                    savingMenu
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="mm-button mm-button--primary"
                  disabled={
                    savingMenu
                  }
                >
                  {savingMenu ? (
                    <Loader2
                      size={17}
                      className="mm-spin"
                    />
                  ) : (
                    <Save
                      size={17}
                    />
                  )}

                  {savingMenu
                    ? "Saving..."
                    : drawerMode ===
                        "edit"
                      ? "Update Menu"
                      : "Save Menu"}
                </button>

              </div>

            </form>

          </aside>
        </div>
      )}


      {/* =====================================================
          CUSTOM FOOD MODAL
      ===================================================== */}

      {customFoodOpen && (
        <div className="mm-dialog-backdrop">

          <div
            className="mm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mm-custom-food-title"
          >

            <div className="mm-dialog__header">

              <div>
                <h2
                  id="mm-custom-food-title"
                >
                  Create Custom Food Item
                </h2>

                <p>
                  Add a new Manager-specific item to the food catalog.
                </p>
              </div>

              <button
                type="button"
                className="mm-icon-button"
                onClick={() =>
                  setCustomFoodOpen(
                    false
                  )
                }
                disabled={
                  customFoodSaving
                }
                aria-label="Close custom food dialog"
              >
                <X
                  size={20}
                />
              </button>

            </div>


            <form
              onSubmit={
                saveCustomFoodItem
              }
            >

              <div className="mm-dialog__body">

                {customFoodError && (
                  <div className="mm-form-error">
                    <AlertCircle
                      size={17}
                    />

                    {customFoodError}
                  </div>
                )}


                <div className="mm-form-grid">

                  <label className="mm-field mm-field--full">
                    <span>
                      Food Item Name *
                    </span>

                    <input
                      type="text"
                      value={
                        customFoodForm.name
                      }
                      onChange={
                        (event) =>
                          setCustomFoodForm(
                            (current) => ({
                              ...current,
                              name:
                                event.target
                                  .value,
                            })
                          )
                      }
                      placeholder="Example: Paneer Curry"
                    />
                  </label>


                  <label className="mm-field">
                    <span>
                      Type *
                    </span>

                    <select
                      value={
                        customFoodForm.type
                      }
                      onChange={
                        (event) =>
                          setCustomFoodForm(
                            (current) => ({
                              ...current,
                              type:
                                event.target
                                  .value,
                            })
                          )
                      }
                    >
                      {ITEM_TYPES.map(
                        (type) => (
                          <option
                            key={
                              type
                            }
                            value={
                              type
                            }
                          >
                            {type}
                          </option>
                        )
                      )}
                    </select>
                  </label>


                  <label className="mm-field">
                    <span>
                      Meal Category *
                    </span>

                    <select
                      value={
                        customFoodForm.mealCategory
                      }
                      onChange={
                        (event) =>
                          setCustomFoodForm(
                            (current) => ({
                              ...current,
                              mealCategory:
                                event.target
                                  .value,
                            })
                          )
                      }
                    >
                      {FOOD_CATEGORIES.map(
                        (category) => (
                          <option
                            key={
                              category.value
                            }
                            value={
                              category.value
                            }
                          >
                            {category.label}
                          </option>
                        )
                      )}
                    </select>
                  </label>


                  <label className="mm-field">
                    <span>
                      Default Quantity *
                    </span>

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={
                        customFoodForm.defaultQuantity
                      }
                      onChange={
                        (event) =>
                          setCustomFoodForm(
                            (current) => ({
                              ...current,
                              defaultQuantity:
                                event.target
                                  .value,
                            })
                          )
                      }
                    />
                  </label>


                  <label className="mm-field">
                    <span>
                      Default Unit *
                    </span>

                    <select
                      value={
                        customFoodForm.defaultUnit
                      }
                      onChange={
                        (event) =>
                          setCustomFoodForm(
                            (current) => ({
                              ...current,
                              defaultUnit:
                                event.target
                                  .value,
                            })
                          )
                      }
                    >
                      {UNITS.map(
                        (unit) => (
                          <option
                            key={
                              unit
                            }
                            value={
                              unit
                            }
                          >
                            {unit}
                          </option>
                        )
                      )}
                    </select>
                  </label>


                  <label className="mm-field">
                    <span>
                      Calories / Serving *
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={
                        customFoodForm.caloriesPerServing
                      }
                      onChange={
                        (event) =>
                          setCustomFoodForm(
                            (current) => ({
                              ...current,
                              caloriesPerServing:
                                event.target
                                  .value,
                            })
                          )
                      }
                    />
                  </label>


                  <label className="mm-field mm-field--full">
                    <span>
                      Food Image URL
                    </span>

                    <div className="mm-input-icon">
                      <ImageIcon
                        size={17}
                      />

                      <input
                        type="url"
                        value={
                          customFoodForm.imageUrl
                        }
                        onChange={
                          (event) =>
                            setCustomFoodForm(
                              (current) => ({
                                ...current,
                                imageUrl:
                                  event.target
                                    .value,
                              })
                            )
                        }
                        placeholder="Optional image URL"
                      />
                    </div>
                  </label>

                </div>

              </div>


              <div className="mm-dialog-actions">

                <button
                  type="button"
                  className="mm-button mm-button--secondary"
                  onClick={() =>
                    setCustomFoodOpen(
                      false
                    )
                  }
                  disabled={
                    customFoodSaving
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="mm-button mm-button--primary"
                  disabled={
                    customFoodSaving
                  }
                >
                  {customFoodSaving ? (
                    <Loader2
                      size={17}
                      className="mm-spin"
                    />
                  ) : (
                    <Plus
                      size={17}
                    />
                  )}

                  {customFoodSaving
                    ? "Creating..."
                    : "Create & Add"}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}


      {/* =====================================================
          EDIT MENU ITEM MODAL
      ===================================================== */}

      {editingMenuItem && (
        <div className="mm-dialog-backdrop">

          <div
            className="mm-dialog mm-dialog--small"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mm-edit-item-title"
          >

            <div className="mm-dialog__header">

              <div>
                <h2
                  id="mm-edit-item-title"
                >
                  Edit Menu Item
                </h2>

                <p>
                  {editingMenuItem.name}
                </p>
              </div>

              <button
                type="button"
                className="mm-icon-button"
                onClick={() =>
                  setEditingMenuItem(
                    null
                  )
                }
                disabled={
                  itemSaving
                }
                aria-label="Close item editor"
              >
                <X
                  size={20}
                />
              </button>

            </div>


            <form
              onSubmit={
                saveCurrentMenuItem
              }
            >

              <div className="mm-dialog__body">

                {itemEditError && (
                  <div className="mm-form-error">
                    <AlertCircle
                      size={17}
                    />

                    {itemEditError}
                  </div>
                )}


                <div className="mm-form-grid">

                  <label className="mm-field">
                    <span>
                      Quantity / Student
                    </span>

                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={
                        itemEditForm.quantityPerStudent
                      }
                      onChange={
                        (event) =>
                          setItemEditForm(
                            (current) => ({
                              ...current,
                              quantityPerStudent:
                                event.target
                                  .value,
                            })
                          )
                      }
                    />
                  </label>


                  <label className="mm-field">
                    <span>
                      Unit
                    </span>

                    <select
                      value={
                        itemEditForm.unit
                      }
                      onChange={
                        (event) =>
                          setItemEditForm(
                            (current) => ({
                              ...current,
                              unit:
                                event.target
                                  .value,
                            })
                          )
                      }
                    >
                      {UNITS.map(
                        (unit) => (
                          <option
                            key={
                              unit
                            }
                            value={
                              unit
                            }
                          >
                            {unit}
                          </option>
                        )
                      )}

                      {!UNITS.includes(
                        itemEditForm.unit
                      ) &&
                        itemEditForm.unit && (
                          <option
                            value={
                              itemEditForm.unit
                            }
                          >
                            {itemEditForm.unit}
                          </option>
                        )}
                    </select>
                  </label>

                </div>

              </div>


              <div className="mm-dialog-actions">

                <button
                  type="button"
                  className="mm-button mm-button--secondary"
                  onClick={() =>
                    setEditingMenuItem(
                      null
                    )
                  }
                  disabled={
                    itemSaving
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="mm-button mm-button--primary"
                  disabled={
                    itemSaving
                  }
                >
                  {itemSaving ? (
                    <Loader2
                      size={17}
                      className="mm-spin"
                    />
                  ) : (
                    <Save
                      size={17}
                    />
                  )}

                  Save Changes
                </button>

              </div>

            </form>

          </div>
        </div>
      )}


      {/* =====================================================
          COPY MENU MODAL
      ===================================================== */}

      {copyTarget && (
        <div className="mm-dialog-backdrop">

          <div
            className="mm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mm-copy-title"
          >

            <div className="mm-dialog__header">

              <div>
                <h2
                  id="mm-copy-title"
                >
                  Copy Previous Menu
                </h2>

                <p>
                  Copy items and quantities into a new Draft without changing the original Menu.
                </p>
              </div>

              <button
                type="button"
                className="mm-icon-button"
                onClick={() =>
                  setCopyTarget(
                    null
                  )
                }
                disabled={
                  copying
                }
                aria-label="Close Copy Menu dialog"
              >
                <X
                  size={20}
                />
              </button>

            </div>


            <form
              onSubmit={
                submitCopyMenu
              }
            >

              <div className="mm-dialog__body">

                <div className="mm-source-record">
                  <Copy
                    size={18}
                  />

                  <div>
                    <strong>
                      {formatMeal(
                        copyTarget.meal
                      )}{" "}
                      –{" "}
                      {formatDate(
                        copyTarget.date
                      )}
                    </strong>

                    <span>
                      {copyTarget.hostel?.name}
                      {" • "}
                      {copyTarget.messUnit?.name}
                      {" • "}
                      {formatCategory(
                        copyTarget.mealCategory
                      )}
                    </span>
                  </div>
                </div>


                {copyError && (
                  <div className="mm-form-error">
                    <AlertCircle
                      size={17}
                    />

                    {copyError}
                  </div>
                )}


                <div className="mm-form-grid">

                  <label className="mm-field">
                    <span>
                      New Date *
                    </span>

                    <input
                      type="date"
                      value={
                        copyForm.date
                      }
                      onChange={
                        (event) =>
                          setCopyForm(
                            (current) => ({
                              ...current,
                              date:
                                event.target
                                  .value,
                            })
                          )
                      }
                    />
                  </label>


                  <label className="mm-field">
                    <span>
                      Target Hostel *
                    </span>

                    <select
                      value={
                        copyForm.hostelId
                      }
                      onChange={
                        handleCopyHostelChange
                      }
                    >
                      <option value="">
                        Select Hostel
                      </option>

                      {hostels.map(
                        (hostel) => (
                          <option
                            key={
                              hostel.id
                            }
                            value={
                              hostel.id
                            }
                          >
                            {hostel.name}
                          </option>
                        )
                      )}
                    </select>
                  </label>


                  <label className="mm-field mm-field--full">
                    <span>
                      Target Mess Unit *
                    </span>

                    <select
                      value={
                        copyForm.messUnitId
                      }
                      onChange={
                        (event) =>
                          setCopyForm(
                            (current) => ({
                              ...current,
                              messUnitId:
                                event.target
                                  .value,
                            })
                          )
                      }
                      disabled={
                        !copyForm.hostelId
                      }
                    >
                      <option value="">
                        Select Mess Unit
                      </option>

                      {copyMessOptions.map(
                        (mess) => (
                          <option
                            key={
                              mess.id
                            }
                            value={
                              mess.id
                            }
                          >
                            {mess.name}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                </div>

              </div>


              <div className="mm-dialog-actions">

                <button
                  type="button"
                  className="mm-button mm-button--secondary"
                  onClick={() =>
                    setCopyTarget(
                      null
                    )
                  }
                  disabled={
                    copying
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="mm-button mm-button--primary"
                  disabled={
                    copying
                  }
                >
                  {copying ? (
                    <Loader2
                      size={17}
                      className="mm-spin"
                    />
                  ) : (
                    <ClipboardCopy
                      size={17}
                    />
                  )}

                  {copying
                    ? "Copying..."
                    : "Copy as Draft"}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}


      {/* =====================================================
          TEMPLATE EDITOR DRAWER
      ===================================================== */}

      {templateEditorOpen && (
        <div
          className="mm-drawer-backdrop"
          onMouseDown={
            (event) => {
              if (
                event.target ===
                  event.currentTarget &&
                !templateSaving
              ) {
                closeTemplateEditor();
              }
            }
          }
        >

          <aside
            className="mm-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mm-template-editor-title"
          >

            <div className="mm-drawer__header">

              <div>
                <span className="mm-drawer-eyebrow">
                  REUSABLE MENU
                </span>

                <h2
                  id="mm-template-editor-title"
                >
                  {editingTemplate
                    ? "Edit Menu Template"
                    : "Create Menu Template"}
                </h2>
              </div>

              <button
                type="button"
                className="mm-icon-button"
                onClick={
                  closeTemplateEditor
                }
                disabled={
                  templateSaving
                }
                aria-label="Close Template editor"
              >
                <X
                  size={21}
                />
              </button>

            </div>


            <form
              className="mm-drawer__body"
              onSubmit={
                saveTemplate
              }
            >

              {templateEditorError && (
                <div className="mm-form-error">
                  <AlertCircle
                    size={17}
                  />

                  {templateEditorError}
                </div>
              )}


              <div className="mm-drawer-form-grid">

                <label className="mm-field mm-field--full">
                  <span>
                    Template Name *
                  </span>

                  <input
                    type="text"
                    value={
                      templateForm.name
                    }
                    onChange={
                      (event) =>
                        setTemplateForm(
                          (current) => ({
                            ...current,
                            name:
                              event.target
                                .value,
                          })
                        )
                    }
                    placeholder="Example: Sunday Special Lunch"
                  />
                </label>


                <label className="mm-field">
                  <span>
                    Meal *
                  </span>

                  <select
                    value={
                      templateForm.meal
                    }
                    onChange={
                      (event) =>
                        setTemplateForm(
                          (current) => ({
                            ...current,
                            meal:
                              event.target
                                .value,
                          })
                        )
                    }
                  >
                    {MEALS.map(
                      (meal) => (
                        <option
                          key={
                            meal.value
                          }
                          value={
                            meal.value
                          }
                        >
                          {meal.label}
                        </option>
                      )
                    )}
                  </select>
                </label>


                <label className="mm-field">
                  <span>
                    Meal Category *
                  </span>

                  <select
                    value={
                      templateForm.mealCategory
                    }
                    onChange={
                      handleTemplateCategoryChange
                    }
                  >
                    {CATEGORIES.map(
                      (category) => (
                        <option
                          key={
                            category.value
                          }
                          value={
                            category.value
                          }
                        >
                          {category.label}
                        </option>
                      )
                    )}
                  </select>
                </label>


                <label className="mm-field mm-field--full">
                  <span>
                    Description
                  </span>

                  <textarea
                    rows="3"
                    value={
                      templateForm.description
                    }
                    onChange={
                      (event) =>
                        setTemplateForm(
                          (current) => ({
                            ...current,
                            description:
                              event.target
                                .value,
                          })
                        )
                    }
                    placeholder="Optional Template description"
                  />
                </label>


                <label className="mm-toggle-row mm-field--full">
                  <div>
                    <strong>
                      Active Template
                    </strong>

                    <span>
                      Active Templates can be used to create daily menus.
                    </span>
                  </div>

                  <input
                    type="checkbox"
                    checked={
                      templateForm.isActive
                    }
                    onChange={
                      (event) =>
                        setTemplateForm(
                          (current) => ({
                            ...current,
                            isActive:
                              event.target
                                .checked,
                          })
                        )
                    }
                  />
                </label>

              </div>


              <div className="mm-drawer-section">

                <div className="mm-drawer-section__heading">

                  <div>
                    <h3>
                      Food Items
                    </h3>

                    <p>
                      Select the food items to save in this Template.
                    </p>
                  </div>

                  <span className="mm-count-pill">
                    {templateItems.length}{" "}
                    selected
                  </span>

                </div>


                <div className="mm-input-icon">
                  <Search
                    size={17}
                  />

                  <input
                    type="search"
                    value={
                      templateFoodSearch
                    }
                    onChange={
                      (event) =>
                        setTemplateFoodSearch(
                          event.target
                            .value
                        )
                    }
                    placeholder="Search food items"
                  />
                </div>


                {templateCatalogLoading ? (
                  <div className="mm-inline-loading">
                    <Loader2
                      size={20}
                      className="mm-spin"
                    />

                    Loading food items...
                  </div>
                ) : (
                  <div className="mm-food-catalog">

                    {templateCatalog.map(
                      (food) => {
                        const selected =
                          templateFoodIds.has(
                            String(
                              food.id
                            )
                          );

                        return (
                          <div
                            key={
                              food.id
                            }
                            className={
                              selected
                                ? "mm-food-option mm-food-option--selected"
                                : "mm-food-option"
                            }
                          >

                            <button
                              type="button"
                              className="mm-food-checkbox"
                              aria-pressed={
                                selected
                              }
                              onClick={() =>
                                selected
                                  ? removeTemplateFoodItem(
                                      food.id
                                    )
                                  : addTemplateFoodItem(
                                      food
                                    )
                              }
                            >
                              {selected && (
                                <Check
                                  size={14}
                                />
                              )}
                            </button>

                            <FoodImage
                              item={
                                food
                              }
                              size="small"
                            />

                            <div className="mm-food-option__content">
                              <strong>
                                {food.name}
                              </strong>

                              <span
                                className={`mm-type-badge mm-type-badge--${String(
                                  food.type ||
                                    "other"
                                )
                                  .toLowerCase()
                                  .replace(
                                    /\s+/g,
                                    "-"
                                  )}`}
                              >
                                {food.type ||
                                  "Other"}
                              </span>
                            </div>

                            <button
                              type="button"
                              className="mm-food-add-button"
                              onClick={() =>
                                selected
                                  ? removeTemplateFoodItem(
                                      food.id
                                    )
                                  : addTemplateFoodItem(
                                      food
                                    )
                              }
                            >
                              {selected
                                ? "Remove"
                                : "Add"}
                            </button>

                          </div>
                        );
                      }
                    )}

                  </div>
                )}

              </div>


              <div className="mm-drawer-section">

                <div className="mm-drawer-section__heading">
                  <div>
                    <h3>
                      Default Quantities
                    </h3>

                    <p>
                      These quantities are copied when the Template is used.
                    </p>
                  </div>
                </div>


                {templateItems.length ===
                0 ? (
                  <div className="mm-small-empty">
                    Select food items first.
                  </div>
                ) : (
                  <div className="mm-selected-food-list">

                    {templateItems.map(
                      (item) => (
                        <div
                          key={
                            item.menuItemId ??
                            item.id
                          }
                          className="mm-selected-food"
                        >

                          <div className="mm-selected-food__main">
                            <FoodImage
                              item={
                                item
                              }
                              size="small"
                            />

                            <div>
                              <strong>
                                {item.name}
                              </strong>

                              <span>
                                {item.type}
                              </span>
                            </div>
                          </div>


                          <label className="mm-mini-field">
                            <span>
                              Quantity
                            </span>

                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={
                                item.quantityPerStudent
                              }
                              onChange={
                                (event) =>
                                  updateTemplateFoodItem(
                                    item.menuItemId ??
                                      item.id,
                                    "quantityPerStudent",
                                    event.target
                                      .value
                                  )
                              }
                            />
                          </label>


                          <label className="mm-mini-field">
                            <span>
                              Unit
                            </span>

                            <select
                              value={
                                item.unit
                              }
                              onChange={
                                (event) =>
                                  updateTemplateFoodItem(
                                    item.menuItemId ??
                                      item.id,
                                    "unit",
                                    event.target
                                      .value
                                  )
                              }
                            >
                              {UNITS.map(
                                (unit) => (
                                  <option
                                    key={
                                      unit
                                    }
                                    value={
                                      unit
                                    }
                                  >
                                    {unit}
                                  </option>
                                )
                              )}

                              {!UNITS.includes(
                                item.unit
                              ) &&
                                item.unit && (
                                  <option
                                    value={
                                      item.unit
                                    }
                                  >
                                    {item.unit}
                                  </option>
                                )}
                            </select>
                          </label>


                          <button
                            type="button"
                            className="mm-icon-action mm-icon-action--delete"
                            onClick={() =>
                              removeTemplateFoodItem(
                                item.menuItemId ??
                                  item.id
                              )
                            }
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2
                              size={16}
                            />
                          </button>

                        </div>
                      )
                    )}

                  </div>
                )}

              </div>


              <div className="mm-drawer__footer">

                <button
                  type="button"
                  className="mm-button mm-button--secondary"
                  onClick={
                    closeTemplateEditor
                  }
                  disabled={
                    templateSaving
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="mm-button mm-button--primary"
                  disabled={
                    templateSaving
                  }
                >
                  {templateSaving ? (
                    <Loader2
                      size={17}
                      className="mm-spin"
                    />
                  ) : (
                    <Save
                      size={17}
                    />
                  )}

                  {templateSaving
                    ? "Saving..."
                    : editingTemplate
                      ? "Update Template"
                      : "Save Template"}
                </button>

              </div>

            </form>

          </aside>

        </div>
      )}


      {/* =====================================================
          USE TEMPLATE MODAL
      ===================================================== */}

      {useTemplateTarget && (
        <div className="mm-dialog-backdrop">

          <div
            className="mm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mm-use-template-title"
          >

            <div className="mm-dialog__header">

              <div>
                <h2
                  id="mm-use-template-title"
                >
                  Use Menu Template
                </h2>

                <p>
                  Create a new daily Menu from{" "}
                  <strong>
                    {useTemplateTarget.name}
                  </strong>
                  .
                </p>
              </div>

              <button
                type="button"
                className="mm-icon-button"
                onClick={() =>
                  setUseTemplateTarget(
                    null
                  )
                }
                disabled={
                  usingTemplate
                }
                aria-label="Close Use Template dialog"
              >
                <X
                  size={20}
                />
              </button>

            </div>


            <form
              onSubmit={
                submitUseTemplate
              }
            >

              <div className="mm-dialog__body">

                <div className="mm-source-record">
                  <LayoutTemplate
                    size={18}
                  />

                  <div>
                    <strong>
                      {useTemplateTarget.name}
                    </strong>

                    <span>
                      {formatMeal(
                        useTemplateTarget.meal
                      )}
                      {" • "}
                      {formatCategory(
                        useTemplateTarget.mealCategory
                      )}
                      {" • "}
                      {useTemplateTarget.itemCount ??
                        useTemplateTarget.items
                          ?.length ??
                        0}{" "}
                      items
                    </span>
                  </div>
                </div>


                {useTemplateError && (
                  <div className="mm-form-error">
                    <AlertCircle
                      size={17}
                    />

                    {useTemplateError}
                  </div>
                )}


                <div className="mm-form-grid">

                  <label className="mm-field">
                    <span>
                      Date *
                    </span>

                    <input
                      type="date"
                      value={
                        useTemplateForm.date
                      }
                      onChange={
                        (event) =>
                          setUseTemplateForm(
                            (current) => ({
                              ...current,
                              date:
                                event.target
                                  .value,
                            })
                          )
                      }
                    />
                  </label>


                  <label className="mm-field">
                    <span>
                      Hostel *
                    </span>

                    <select
                      value={
                        useTemplateForm.hostelId
                      }
                      onChange={
                        handleUseTemplateHostelChange
                      }
                    >
                      <option value="">
                        Select Hostel
                      </option>

                      {hostels.map(
                        (hostel) => (
                          <option
                            key={
                              hostel.id
                            }
                            value={
                              hostel.id
                            }
                          >
                            {hostel.name}
                          </option>
                        )
                      )}
                    </select>
                  </label>


                  <label className="mm-field mm-field--full">
                    <span>
                      Mess Unit *
                    </span>

                    <select
                      value={
                        useTemplateForm.messUnitId
                      }
                      onChange={
                        (event) =>
                          setUseTemplateForm(
                            (current) => ({
                              ...current,
                              messUnitId:
                                event.target
                                  .value,
                            })
                          )
                      }
                      disabled={
                        !useTemplateForm.hostelId
                      }
                    >
                      <option value="">
                        Select Mess Unit
                      </option>

                      {useTemplateMessOptions.map(
                        (mess) => (
                          <option
                            key={
                              mess.id
                            }
                            value={
                              mess.id
                            }
                          >
                            {mess.name}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                </div>

              </div>


              <div className="mm-dialog-actions">

                <button
                  type="button"
                  className="mm-button mm-button--secondary"
                  onClick={() =>
                    setUseTemplateTarget(
                      null
                    )
                  }
                  disabled={
                    usingTemplate
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="mm-button mm-button--primary"
                  disabled={
                    usingTemplate
                  }
                >
                  {usingTemplate ? (
                    <Loader2
                      size={17}
                      className="mm-spin"
                    />
                  ) : (
                    <Check
                      size={17}
                    />
                  )}

                  {usingTemplate
                    ? "Creating..."
                    : "Create Menu"}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}


      {/* =====================================================
          CALENDAR MODAL
      ===================================================== */}

      {calendarOpen &&
        createPortal(
          <div
            className="mm-calendar-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeCalendar();
              }
            }}
          >
            <div
              ref={calendarDialogRef}
              className="mm-calendar-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mm-calendar-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="mm-calendar-dialog__header">
                <div className="mm-calendar-dialog__heading">
                  <span className="mm-calendar-dialog__icon" aria-hidden="true">
                    <CalendarDays size={22} />
                  </span>

                  <div>
                    <h2 id="mm-calendar-title">Menu Calendar</h2>
                    <p>View and manage menus by date</p>
                  </div>
                </div>

                <button
                  ref={calendarCloseButtonRef}
                  type="button"
                  className="mm-calendar-dialog__close"
                  onClick={closeCalendar}
                  aria-label="Close Menu Calendar"
                >
                  <X size={21} />
                </button>
              </div>

              <div className="mm-calendar-dialog__body">
                <div className="mm-calendar-navigation">
                  <button
                    type="button"
                    className="mm-calendar-nav-button"
                    onClick={previousCalendarMonth}
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={21} />
                  </button>

                  <strong className="mm-calendar-month-title">
                    {calendarMonthTitle}
                  </strong>

                  <div className="mm-calendar-navigation__right">
                    <button
                      type="button"
                      className="mm-calendar-nav-button"
                      onClick={nextCalendarMonth}
                      aria-label="Next month"
                    >
                      <ChevronRight size={21} />
                    </button>

                    <button
                      type="button"
                      className="mm-calendar-today-button"
                      onClick={() => {
                        const currentDate = new Date();
                        const currentYear = currentDate.getFullYear();
                        const currentMonth = currentDate.getMonth() + 1;
                        const currentDay = currentDate.getDate();
                        const currentDateKey = `${currentYear}-${padNumber(
                          currentMonth
                        )}-${padNumber(currentDay)}`;

                        setCalendarYear(currentYear);
                        setCalendarMonth(currentMonth);
                        setSelectedCalendarDate(currentDateKey);
                      }}
                    >
                      Today
                    </button>
                  </div>
                </div>

                {calendarError && (
                  <div className="mm-calendar-error" role="alert">
                    <AlertCircle size={17} />
                    <span>{calendarError}</span>
                  </div>
                )}

                {calendarLoading ? (
                  <div className="mm-calendar-loading" aria-live="polite">
                    <Loader2 size={25} className="mm-spin" />
                    <span>Loading Menu Calendar...</span>
                  </div>
                ) : (
                  <>
                    <div className="mm-calendar-grid-shell">
                      <div className="mm-calendar-weekdays" role="row">
                        {[
                          "Sun",
                          "Mon",
                          "Tue",
                          "Wed",
                          "Thu",
                          "Fri",
                          "Sat",
                        ].map((weekday) => (
                          <div
                            key={weekday}
                            className="mm-calendar-weekday"
                            role="columnheader"
                          >
                            {weekday}
                          </div>
                        ))}
                      </div>

                      <div className="mm-calendar-grid" role="grid" aria-label={calendarMonthTitle}>
                        {calendarCells.map((cell) => {
                          const selected =
                            selectedCalendarDate === cell.date &&
                            !cell.outsideMonth;
                          const todayKey = getTodayInputValue();
                          const isToday = cell.date === todayKey && !cell.outsideMonth;
                          const menuCount = cell.menus.length;
                          const visibleIndicators = cell.menus.slice(0, 3);
                          const extraCount = Math.max(0, menuCount - 3);

                          return (
                            <button
                              key={cell.date}
                              type="button"
                              className={`mm-calendar-date-cell${
                                cell.outsideMonth
                                  ? " mm-calendar-date-cell--outside"
                                  : ""
                              }${selected ? " mm-calendar-date-cell--selected" : ""}${
                                isToday ? " mm-calendar-date-cell--today" : ""
                              }`}
                              onClick={() => {
                                if (!cell.outsideMonth) {
                                  setSelectedCalendarDate(cell.date);
                                }
                              }}
                              disabled={cell.outsideMonth}
                              role="gridcell"
                              aria-selected={selected}
                              aria-label={`${cell.day} ${calendarMonthTitle}${
                                menuCount ? `, ${menuCount} menus available` : ", no menu"
                              }`}
                            >
                              <span className="mm-calendar-date-number">
                                {cell.day}
                              </span>

                              <span className="mm-calendar-date-indicators" aria-hidden="true">
                                {visibleIndicators.map((menu) => (
                                  <span
                                    key={menu.id}
                                    className={`mm-calendar-dot mm-calendar-dot--${menu.status}`}
                                    title={`${formatMeal(menu.meal)} - ${statusLabel(menu.status)}`}
                                  />
                                ))}

                                {extraCount > 0 && (
                                  <span className="mm-calendar-more-indicator">
                                    +{extraCount}
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mm-calendar-legend" aria-label="Calendar legend">
                      <span className="mm-calendar-legend-item">
                        <span className="mm-calendar-legend-dot" aria-hidden="true" />
                        Menu available
                      </span>

                      <span className="mm-calendar-legend-item">
                        <span className="mm-calendar-legend-selected" aria-hidden="true" />
                        Selected date
                      </span>

                      <span className="mm-calendar-legend-item">
                        <span className="mm-calendar-legend-empty" aria-hidden="true" />
                        No menu
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="mm-calendar-dialog__footer">
                <div className="mm-calendar-selected-date">
                  <span className="mm-calendar-selected-date__icon" aria-hidden="true">
                    <CalendarDays size={19} />
                  </span>

                  <div>
                    <span className="mm-calendar-selected-date__label">
                      Selected Date
                    </span>
                    <strong>
                      {selectedCalendarDate
                        ? formatDate(selectedCalendarDate, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                        : "Select a date"}
                    </strong>
                  </div>
                </div>

                <div className="mm-calendar-footer-actions">
                  <button
                    type="button"
                    className="mm-calendar-footer-button mm-calendar-footer-button--secondary"
                    onClick={closeCalendar}
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    className="mm-calendar-footer-button mm-calendar-footer-button--primary"
                    onClick={
                      selectedCalendarMenus.length > 0
                        ? handleCalendarViewMenu
                        : handleCalendarCreateMenu
                    }
                    disabled={!selectedCalendarDate}
                  >
                    {selectedCalendarMenus.length > 0
                      ? "View Menu →"
                      : "Create Menu"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}


    </div>
  );
}
export default MenuManagement;
