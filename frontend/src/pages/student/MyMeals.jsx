
import React, { useEffect, useMemo, useState } from "react";

import {
  Coffee,
  Utensils,
  Moon,
  Clock3,
  CheckCircle2,
  XCircle,
  Lock,
  Save,
  RefreshCw,
  CalendarDays,
  AlertCircle,
} from "lucide-react";

import studentApi from "../../services/studentApi";
import StudentAssignmentBanner from "../../components/student/StudentAssignmentBanner";

const MEAL_ORDER = ["Breakfast", "Lunch", "Dinner"];

const mealIcons = {
  Breakfast: Coffee,
  Lunch: Utensils,
  Dinner: Moon,
};

const mealClasses = {
  Breakfast: "student-mymeal-breakfast",
  Lunch: "student-mymeal-lunch",
  Dinner: "student-mymeal-dinner",
};

function MyMeals() {
  const [menus, setMenus] = useState([]);
  const [responses, setResponses] = useState({});
  const [originalResponses, setOriginalResponses] = useState({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const normalizeResponse = (value) => {
    const normalized = String(value ?? "").toLowerCase().trim();

    if (["attending", "attend", "yes", "present"].includes(normalized)) {
      return "attending";
    }

    if (["skipping", "skip", "no", "absent"].includes(normalized)) {
      return "skipping";
    }

    return "";
  };

  const loadMeals = async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      // Do not clear the success message here. A successful save
      // should remain visible while data is refreshed.
      const [menuResponse, responseResponse] = await Promise.all([
        studentApi.getTodayMenus(),
        studentApi.getResponses(),
      ]);

      const menuData =
        menuResponse?.data ??
        menuResponse?.menus ??
        menuResponse?.result ??
        menuResponse;

      const responseData =
        responseResponse?.data ??
        responseResponse?.responses ??
        responseResponse?.result ??
        responseResponse;

      const menuList = Array.isArray(menuData)
        ? menuData
        : Array.isArray(menuData?.menus)
          ? menuData.menus
          : [];

      const responseList = Array.isArray(responseData)
        ? responseData
        : Array.isArray(responseData?.responses)
          ? responseData.responses
          : [];

      setMenus(menuList);

      const responseMap = {};

      responseList.forEach((item) => {
        const menuId =
          item?.menu_id ??
          item?.menuId ??
          item?.menu?.id ??
          item?.menu?._id;

        const value =
          item?.response ??
          item?.status ??
          item?.attendance;

        if (menuId !== undefined && menuId !== null && value) {
          responseMap[String(menuId)] = normalizeResponse(value);
        }
      });

      setResponses(responseMap);
      setOriginalResponses(responseMap);
    } catch (err) {
      console.error("My meals loading error:", err);
      setError(err?.message || "Unable to load today's meals.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMeals();
  }, []);

  useEffect(() => {
    if (!success) return undefined;

    const timer = setTimeout(() => {
      setSuccess("");
    }, 4500);

    return () => clearTimeout(timer);
  }, [success]);

  const normalizeMeal = (menu) => {
    const value =
      menu?.meal ??
      menu?.meal_type ??
      menu?.mealType ??
      menu?.meal_name ??
      "";

    const normalized = String(value).toLowerCase().trim();

    if (normalized.includes("break")) return "Breakfast";
    if (normalized.includes("lunch")) return "Lunch";
    if (normalized.includes("dinner")) return "Dinner";

    return value || "Meal";
  };

  const getMenuId = (menu) =>
    menu?.id ?? menu?._id ?? menu?.menu_id ?? menu?.menuId;

  const getItems = (menu) => {
    const items =
      menu?.items ?? menu?.menu_items ?? menu?.menuItems ?? [];

    return Array.isArray(items) ? items : [];
  };

  const getItemName = (item) => {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return "Food item";

    return (
      item.name ??
      item.item_name ??
      item.itemName ??
      item.food_name ??
      "Food item"
    );
  };

  const formatTime = (value) => {
    if (!value) return "";

    const text = String(value);

    if (/AM|PM/i.test(text)) return text;

    const parts = text.split(":");
    if (parts.length < 2) return text;

    let hour = Number(parts[0]);
    const minute = parts[1];

    if (Number.isNaN(hour)) return text;

    const suffix = hour >= 12 ? "PM" : "AM";
    hour %= 12;
    if (hour === 0) hour = 12;

    return `${hour}:${minute} ${suffix}`;
  };

  const getServingTime = (menu) => {
    if (menu?.serving_time || menu?.servingTime) {
      return menu.serving_time ?? menu.servingTime;
    }

    const start = menu?.start_time ?? menu?.startTime;
    const end = menu?.end_time ?? menu?.endTime;

    if (start && end) {
      return `${formatTime(start)} - ${formatTime(end)}`;
    }

    if (start) return formatTime(start);

    return "";
  };

  const getCutoff = (menu) =>
    menu?.response_cutoff ??
    menu?.responseCutoff ??
    menu?.cutoff_at ??
    menu?.cutoffAt ??
    null;

  const isPastCutoff = (menu) => {
    const cutoff = getCutoff(menu);
    if (!cutoff) return false;

    const cutoffDate = new Date(cutoff);

    if (Number.isNaN(cutoffDate.getTime())) return false;

    return cutoffDate.getTime() <= Date.now();
  };

  const isPastMeal = (menu) => {
    const date = menu?.date ?? menu?.menu_date ?? menu?.menuDate;
    if (!date) return false;

    const endTime = menu?.end_time ?? menu?.endTime;
    if (!endTime) return false;

    const dateText = String(date).split("T")[0];
    const dateTime = new Date(`${dateText}T${endTime}`);

    if (Number.isNaN(dateTime.getTime())) return false;

    return dateTime < new Date();
  };

  const isLocked = (menu) => isPastCutoff(menu) || isPastMeal(menu);

  const isPublished = (menu) => {
    if (menu?.is_published !== undefined) {
      return Boolean(menu.is_published);
    }

    if (menu?.isPublished !== undefined) {
      return Boolean(menu.isPublished);
    }

    if (menu?.status) {
      return String(menu.status).toLowerCase().trim() === "published";
    }

    // Backend should return only published student menus.
    return true;
  };

  const orderedMenus = useMemo(
    () =>
      [...menus].sort((a, b) => {
        const indexA = MEAL_ORDER.indexOf(normalizeMeal(a));
        const indexB = MEAL_ORDER.indexOf(normalizeMeal(b));

        return (
          (indexA === -1 ? 99 : indexA) -
          (indexB === -1 ? 99 : indexB)
        );
      }),
    [menus]
  );

  const handleSelect = (menu, value) => {
    const menuId = getMenuId(menu);

    if (menuId === undefined || menuId === null) return;
    if (!isPublished(menu) || isLocked(menu)) return;

    setResponses((previous) => ({
      ...previous,
      [String(menuId)]: value,
    }));

    setSuccess("");
    setError("");
  };

  const hasChanges = useMemo(() => {
    const keys = new Set([
      ...Object.keys(responses),
      ...Object.keys(originalResponses),
    ]);

    for (const key of keys) {
      if (responses[key] !== originalResponses[key]) {
        return true;
      }
    }

    return false;
  }, [responses, originalResponses]);

  // Updated: display success only after the save API succeeds.
  const handleSaveResponses = async () => {
    if (saving || !hasChanges) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const changedMenus = orderedMenus.filter((menu) => {
        const menuId = getMenuId(menu);

        if (menuId === undefined || menuId === null) return false;

        const key = String(menuId);

        return (
          responses[key] &&
          responses[key] !== originalResponses[key]
        );
      });

      if (changedMenus.length === 0) {
        setSuccess("There are no new changes to save.");
        return;
      }

      // Submit changed responses sequentially.
      for (const menu of changedMenus) {
        const menuId = getMenuId(menu);
        const response = responses[String(menuId)];

        await studentApi.submitMealResponse(menuId, response);
      }

      // Update only the successfully submitted responses.
      setOriginalResponses((previous) => {
        const updated = { ...previous };

        changedMenus.forEach((menu) => {
          const key = String(getMenuId(menu));
          updated[key] = responses[key];
        });

        return updated;
      });

      setSuccess("Response saved successfully!");
    } catch (err) {
      console.error("Saving meal responses error:", err);
      setError(
        err?.message || "Unable to save your response. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const getTodayLabel = () =>
    new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const getMealTypeLabel = (menu) => {
    const category =
      menu?.category ??
      menu?.food_type ??
      menu?.foodType ??
      menu?.type;

    if (!category) return "";

    const value = String(category).toLowerCase();

    if (value.includes("veg") && !value.includes("non")) {
      return "Veg";
    }

    if (value.includes("non") && value.includes("veg")) {
      return "Non-Veg";
    }

    return String(category);
  };

  if (loading) {
    return (
      <div className="student-my-meals">
        <StudentAssignmentBanner />

        <div className="student-my-meals-loading">
          <div className="student-loader-spinner" />
          <p>Loading today's meals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="student-my-meals">
      <div className="student-subpage-header">
        <div>
          <div className="student-subpage-date">
            <CalendarDays size={14} />
            <span>{getTodayLabel()}</span>
          </div>

          <h2>My Meals</h2>
          <p>
            View today's published menu and tell us whether you will attend.
          </p>
        </div>

        <button
          type="button"
          className="student-refresh-button"
          onClick={() => loadMeals(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={14}
            className={refreshing ? "student-refresh-spin" : ""}
          />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <StudentAssignmentBanner />

      {error && (
        <div className="student-page-alert error" role="alert">
          <AlertCircle size={17} />
          <div>
            <strong>Unable to complete request</strong>
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="student-page-alert success" role="status">
          <CheckCircle2 size={17} />
          <div>
            <strong>Success</strong>
            <span>{success}</span>
          </div>
          <button type="button" onClick={() => setSuccess("")}>
            ×
          </button>
        </div>
      )}

      <div className="student-response-info">
        <div>
          <CheckCircle2 size={17} />
          <div>
            <strong>Meal Response</strong>
            <span>
              Select Attending or Skipping for each meal before the response
              cutoff.
            </span>
          </div>
        </div>

        <div className="student-response-info-right">
          <span>
            <i className="student-info-dot green" />
            Attending
          </span>
          <span>
            <i className="student-info-dot red" />
            Skipping
          </span>
          <span>
            <i className="student-info-dot gray" />
            Locked
          </span>
        </div>
      </div>

      {orderedMenus.length === 0 ? (
        <div className="student-no-meals">
          <div className="student-no-meals-icon">
            <Utensils size={28} />
          </div>

          <h3>No meals available today</h3>
          <p>
            No published menu is currently available for your hostel, block,
            mess unit and meal category.
          </p>

          <button
            type="button"
            onClick={() => loadMeals(true)}
            disabled={refreshing}
          >
            <RefreshCw size={14} />
            Check again
          </button>
        </div>
      ) : (
        <>
          <div className="student-my-meal-grid">
            {orderedMenus.map((menu, index) => {
              const menuId = getMenuId(menu);
              const menuKey = menuId ?? `meal-${index}`;
              const meal = normalizeMeal(menu);
              const MealIcon = mealIcons[meal] || Utensils;
              const mealClass =
                mealClasses[meal] || "student-mymeal-default";
              const selected = responses[String(menuId)] || "";
              const locked = isLocked(menu);
              const published = isPublished(menu);
              const items = getItems(menu);
              const servingTime = getServingTime(menu);
              const cutoff = getCutoff(menu);
              const mealCategory = getMealTypeLabel(menu);

              return (
                <article
                  key={menuKey}
                  className={`student-my-meal-card ${locked ? "locked" : ""}`}
                >
                  <div className="student-my-meal-header">
                    <div className={`student-my-meal-icon ${mealClass}`}>
                      <MealIcon size={22} />
                    </div>

                    <div className="student-my-meal-title">
                      <h3>{meal}</h3>

                      {servingTime && (
                        <span>
                          <Clock3 size={12} />
                          {servingTime}
                        </span>
                      )}

                      {mealCategory && <small>{mealCategory}</small>}
                    </div>

                    {!published ? (
                      <span className="student-menu-status unpublished">
                        Unpublished
                      </span>
                    ) : locked ? (
                      <span className="student-menu-status locked">
                        <Lock size={11} />
                        Locked
                      </span>
                    ) : (
                      <span className="student-menu-status published">
                        Published
                      </span>
                    )}
                  </div>

                  <div className="student-my-meal-menu">
                    <div className="student-my-meal-menu-heading">
                      <span>Today's Menu</span>
                      <span>
                        {items.length} item{items.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {items.length > 0 ? (
                      <div className="student-food-list">
                        {items.map((item, itemIndex) => (
                          <div
                            className="student-food-item"
                            key={`${menuKey}-${itemIndex}`}
                          >
                            <span className="student-food-check">✓</span>
                            <span>{getItemName(item)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="student-no-menu-items">
                        Menu items are not available.
                      </div>
                    )}
                  </div>

                  <div className="student-cutoff-row">
                    <div>
                      <Clock3 size={13} />
                      <span>Response cutoff</span>
                    </div>

                    <strong>
                      {cutoff ? formatDateTime(cutoff) : "Not specified"}
                    </strong>
                  </div>

                  <div className="student-my-meal-response">
                    <div className="student-response-heading">
                      <span>Will you attend this meal?</span>
                      {selected && (
                        <span className="student-selected-label">
                          Selected
                        </span>
                      )}
                    </div>

                    <div className="student-response-options">
                      <button
                        type="button"
                        disabled={locked || !published}
                        className={`student-response-option attending ${
                          selected === "attending" ? "selected" : ""
                        }`}
                        onClick={() => handleSelect(menu, "attending")}
                      >
                        <CheckCircle2 size={18} />
                        <div>
                          <strong>Attending</strong>
                          <span>I'll have this meal</span>
                        </div>
                        {selected === "attending" && (
                          <span className="student-option-check">✓</span>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={locked || !published}
                        className={`student-response-option skipping ${
                          selected === "skipping" ? "selected" : ""
                        }`}
                        onClick={() => handleSelect(menu, "skipping")}
                      >
                        <XCircle size={18} />
                        <div>
                          <strong>Skipping</strong>
                          <span>I won't have this meal</span>
                        </div>
                        {selected === "skipping" && (
                          <span className="student-option-check">✓</span>
                        )}
                      </button>
                    </div>

                    {locked && (
                      <div className="student-locked-message">
                        <Lock size={13} />
                        <span>
                          Responses are locked after the cutoff or once the
                          meal has passed.
                        </span>
                      </div>
                    )}

                    {!published && (
                      <div className="student-locked-message">
                        <Lock size={13} />
                        <span>
                          Responses are available only for published menus.
                        </span>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="student-save-responses-bar">
            <div>
              <strong>
                {hasChanges
                  ? "You have unsaved changes"
                  : "Your responses are up to date"}
              </strong>
              <span>
                {hasChanges
                  ? "Save your selections to update your meal responses."
                  : "No changes need to be saved."}
              </span>
            </div>

            <button
              type="button"
              className="student-save-responses-button"
              onClick={handleSaveResponses}
              disabled={saving || !hasChanges}
            >
              {saving ? (
                <>
                  <RefreshCw
                    size={15}
                    className="student-refresh-spin"
                  />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={15} />
                  Save Responses
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default MyMeals;
