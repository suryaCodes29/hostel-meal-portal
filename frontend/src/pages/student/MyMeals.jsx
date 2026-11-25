import React, { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import "./MyMeals.css";
import {
  Coffee,
  Utensils,
  Moon,
  Clock3,
  CheckCircle2,
  XCircle,
  Lock,
  RefreshCw,
  CalendarDays,
  AlertCircle,
} from "lucide-react";
import studentApi from "../../services/studentApi";
import StudentAssignmentBanner from "../../components/student/StudentAssignmentBanner";

const MEAL_ORDER = ["Breakfast", "Lunch", "Snacks", "Dinner"];

function getQrExpiryTime(qr) {
  if (!qr?.expiresAt) return null;
  const value = String(qr.expiresAt);
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  const timestamp = new Date(hasTimezone ? value : `${value}Z`).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function isQrActive(qr) {
  const expiresAt = getQrExpiryTime(qr);
  return Boolean(qr?.token && expiresAt && expiresAt > Date.now());
}

const mealIcons = {
  Breakfast: Coffee,
  Lunch: Utensils,
  Dinner: Moon,
};

const mealClasses = {
  Breakfast: "student-mymeal-breakfast",
  Lunch: "student-mymeal-lunch",
  Snacks: "student-mymeal-snacks",
  Dinner: "student-mymeal-dinner",
};

function getStoredQrPasses() {
  try {
    const cached = JSON.parse(
      sessionStorage.getItem("hostelMealQrPasses") || "{}",
    );
    return cached && typeof cached === "object" && !Array.isArray(cached)
      ? cached
      : {};
  } catch {
    return {};
  }
}

function MyMeals() {
  const [menus, setMenus] = useState([]);
  const [responses, setResponses] = useState({});
  const [originalResponses, setOriginalResponses] = useState({});

  // Meal QR state
  const [qrData, setQrData] = useState(getStoredQrPasses);
  const qrDataRef = useRef(qrData);
  const [qrLoading, setQrLoading] = useState({});
  const [qrErrors, setQrErrors] = useState({});
  const qrRequests = useRef(new Set());

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

      // Do not clear the success message here.
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });
      const end = new Date();
      end.setDate(end.getDate() + 31);
      const dateTo = end.toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      });

      const [menuResponse, responseResponse] = await Promise.all([
        studentApi.getStudentMenus({
          dateFrom: today,
          dateTo,
        }),
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

      setMenus(
        menuList.filter((menu) =>
          menu?.sessionStatus !== "completed" ||
          menu?.qrAttendance?.status === "scanned"
        )
      );

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
    const initialLoad = window.setTimeout(() => void loadMeals(), 0);
    const refreshInterval = window.setInterval(() => {
      loadMeals(true);
    }, 60000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(refreshInterval);
    };
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
    if (normalized.includes("snack")) return "Snacks";
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
    menu?.responseDeadline ??
    menu?.response_deadline ??
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

  const isLocked = (menu) =>
    menu?.responseOpen === false ||
    menu?.sessionStatus === "completed";

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

  // Generate Meal QR
  const handleGenerateQR = async (menu) => {
    const menuId = getMenuId(menu);
    const key = String(menuId);

    if (!menuId) return;

    if (isQrActive(qrData[key]) || qrRequests.current.has(key)) {
      return;
    }

    qrRequests.current.add(key);
    setQrLoading((previous) => ({
      ...previous,
      [key]: true,
    }));

    setQrErrors((previous) => ({
      ...previous,
      [key]: "",
    }));

    try {
      const response = await studentApi.generateMealQrToken(menuId);

      const data = response?.data ?? response;
      const qr = data?.qr ?? data;
      const nextQrData = { ...qrDataRef.current, [key]: qr };
      qrDataRef.current = nextQrData;
      setQrData(nextQrData);
      try {
        sessionStorage.setItem("hostelMealQrPasses", JSON.stringify(nextQrData));
      } catch {
        // The QR remains usable in the current page if browser storage is unavailable.
      }
    } catch (error) {
      setQrErrors((previous) => ({
        ...previous,
        [key]:
          error?.response?.data?.message ||
          error?.message ||
          "Unable to generate QR code.",
      }));
    } finally {
      qrRequests.current.delete(key);
      setQrLoading((previous) => ({
        ...previous,
        [key]: false,
      }));
    }
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

  const handleSelect = async (menu, value) => {
    const menuId = getMenuId(menu);

    if (menuId === undefined || menuId === null) return;

    const key = String(menuId);

    if (
      saving ||
      isLocked(menu) ||
      !isPublished(menu)
    ) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await studentApi.submitMealResponse(menuId, value);
      setResponses((previous) => ({ ...previous, [key]: value }));
      setOriginalResponses((previous) => ({ ...previous, [key]: value }));
      setSuccess("Response saved successfully.");
    } catch (err) {
      setError(err?.message || "Unable to save your response.");
      await loadMeals(true);
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
      menu?.mealCategory ??
      menu?.meal_category ??
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
              deadline.
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

          <h3>No upcoming meals available</h3>

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
              const responseLocked = locked;
              const cachedQr = qrData[String(menuId)];
              const qrScanned = menu?.qrAttendance?.status === "scanned";
              const qrExpired = Boolean(cachedQr?.token) && !isQrActive(cachedQr);

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
                      {(menu?.date || menu?.menuDate || menu?.menu_date) && (
                        <small>
                          {formatDate(
                            menu?.date ||
                              menu?.menuDate ||
                              menu?.menu_date
                          )}
                        </small>
                      )}
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
                      <span>Menu Items</span>
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

                  {/* Meal response section */}
                  <div
                    className={`student-my-meal-response ${
                      selected === "attending"
                        ? "response-attending"
                        : selected === "skipping"
                          ? "response-skipping"
                          : "response-required"
                    } ${
                      selected &&
                      selected === originalResponses[String(menuId)]
                        ? "response-saved"
                        : "response-unsaved"
                    }`}
                  >
                    <div className="student-response-heading">
                      <span>Will you attend this meal?</span>

                      {selected ? (
                        <span className="student-selected-label">
                          {selected === "attending" ? "ATTENDING" : "SKIPPING"}
                        </span>
                      ) : (
                        <span className="student-selected-label">NO RESPONSE</span>
                      )}
                    </div>

                    <div className="student-response-options">
                      <button
                        type="button"
                        disabled={responseLocked || !published || saving}
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
                        disabled={responseLocked || !published || saving}
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

                    {/* MEAL QR VERIFICATION */}
                    {selected === "attending" && published && (
                      <div className="student-meal-qr-section">
                        <h4>Meal Verification QR</h4>

                        {qrScanned ? (
                          <div className="student-qr-scanned" role="status">
                            <CheckCircle2 size={21} />
                            <div>
                              <strong>QR Attendance: SCANNED</strong>
                              <span>QR Scanned Successfully</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            {(!cachedQr?.token || qrExpired) && (
                              <button
                                type="button"
                                className="student-generate-qr-button"
                                onClick={() => handleGenerateQR(menu)}
                                disabled={qrLoading[String(menuId)]}
                              >
                                {qrLoading[String(menuId)]
                                  ? "Generating QR..."
                                  : "Generate Meal QR"}
                              </button>
                            )}

                            {qrErrors[String(menuId)] && (
                              <div className="student-qr-error" role="alert">
                                {qrErrors[String(menuId)]}
                              </div>
                            )}

                            {cachedQr?.token && !qrExpired && (
                              <div className="student-meal-qr-card premium-qr-card">
                                <div className="premium-qr-header">
                                  <div>
                                    <span className="premium-qr-eyebrow">
                                      DIGITAL MEAL PASS
                                    </span>
                                    <h3>Your Meal Pass</h3>
                                    <p>
                                      {meal} • {getTodayLabel()}
                                    </p>
                                  </div>

                                  <span className="premium-qr-active">
                                    <span className="premium-qr-active-dot" />
                                    QR ACTIVE
                                  </span>
                                </div>

                                <div className="premium-qr-code-frame">
                                  <QRCodeSVG
                                    value={qrData[String(menuId)].token}
                                    size={200}
                                    level="H"
                                    bgColor="#ffffff"
                                    fgColor="#14213d"
                                  />
                                </div>

                                <div className="premium-qr-instruction">
                                  <CheckCircle2 size={17} />
                                  <span>
                                    Show this QR code at your mess counter.
                                  </span>
                                </div>

                                <div className="premium-qr-details">
                                  <div>
                                    <span>Meal</span>
                                    <strong>{meal}</strong>
                                  </div>

                                  <div>
                                    <span>Meal Time</span>
                                    <strong>
                                      {servingTime || "Not specified"}
                                    </strong>
                                  </div>

                                  {qrData[String(menuId)].qrOpenTime && (
                                    <div>
                                      <span>QR Opens</span>
                                      <strong>
                                        {formatDateTime(
                                          qrData[String(menuId)].qrOpenTime
                                        )}
                                      </strong>
                                    </div>
                                  )}

                                  {qrData[String(menuId)].expiresAt && (
                                    <div>
                                      <span>Expires At</span>
                                      <strong>
                                        {formatDateTime(
                                          qrData[String(menuId)].expiresAt
                                        )}
                                      </strong>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {locked && (
                      <div className="student-locked-message">
                        <Lock size={13} />
                        <span>
                          SESSION CLOSED
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

        </>
      )}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${String(value).split("T")[0]}T00:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
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