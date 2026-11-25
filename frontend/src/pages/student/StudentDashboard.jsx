import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coffee,
  Utensils,
  XCircle,
  AlertCircle,
  RefreshCw,
  Bell,
  MessageSquare,
  History,
} from "lucide-react";

import { useStudent } from "../../context/StudentContext";
import studentApi from "../../services/studentApi";
import StudentAssignmentBanner from "../../components/student/StudentAssignmentBanner";
import "./StudentDashboard.css";

const MEAL_ORDER = [
  "Breakfast",
  "Lunch",
  "Snacks",
  "Dinner",
];

const getISTGreeting = () => {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date())
  );

  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }

  if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
};

const normalizeMeal = (menu) => {
  const value = String(
    menu?.mealCategory ||
      menu?.meal ||
      menu?.mealType ||
      menu?.category ||
      ""
  ).toLowerCase();

  if (value.includes("break")) return "Breakfast";
  if (value.includes("lunch")) return "Lunch";
  if (value.includes("snack")) return "Snacks";
  if (value.includes("dinner")) return "Dinner";

  return menu?.mealCategory || menu?.meal || "Meal";
};

const getMenuItems = (menu) => {
  if (Array.isArray(menu?.items)) return menu.items;
  if (Array.isArray(menu?.menuItems)) return menu.menuItems;
  if (Array.isArray(menu?.menu_items)) return menu.menu_items;
  return [];
};

const getMenuDate = (menu) =>
  menu?.date ||
  menu?.menuDate ||
  menu?.mealDate ||
  menu?.scheduledDate ||
  "";

const getResponseValue = (response) => {
  if (!response) return null;

  const value =
    response.response ||
    response.status ||
    response.attendance ||
    response.mealResponse ||
    response.value;

  if (!value) return null;

  const normalized = String(value).toLowerCase();

  if (
    normalized === "attending" ||
    normalized === "attend" ||
    normalized === "yes" ||
    normalized === "present"
  ) {
    return "attending";
  }

  if (
    normalized === "skipping" ||
    normalized === "skip" ||
    normalized === "no" ||
    normalized === "absent"
  ) {
    return "skipping";
  }

  return normalized;
};

const formatTime = (value) => {
  if (!value) return "";

  try {
    const date = new Date(`1970-01-01T${value}`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  } catch {
    // Ignore formatting errors.
  }

  return String(value);
};

const formatDate = (value) => {
  if (!value) return "Today";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
};

const isToday = (value) => {
  if (!value) return true;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

function StatCard({ icon, title, value, subtitle, className = "" }) {
  return (
    <div className={`student-stat-card ${className}`}>
      <div className="student-stat-icon">{icon}</div>

      <div className="student-stat-content">
        <span className="student-stat-title">{title}</span>
        <strong>{value}</strong>
        {subtitle && <small>{subtitle}</small>}
      </div>
    </div>
  );
}

function MealCard({ menu, response, onRespond, saving }) {
  const mealName = normalizeMeal(menu);
  
  const items = getMenuItems(menu);

  const currentResponse = getResponseValue(response);

  const mealKey = mealName.toLowerCase();

  let MealIcon = Utensils;

  if (mealKey.includes("break")) {
    MealIcon = Coffee;
  }

  const servingTime =
    menu?.servingTime ||
    menu?.serving_time ||
    menu?.time ||
    menu?.startTime ||
    "";

  const cutoff =
    menu?.responseCutoff ||
    menu?.response_cutoff ||
    menu?.cutoffTime ||
    menu?.cutoff ||
    "";

  const published =
    menu?.published !== false &&
    menu?.isPublished !== false &&
    menu?.status !== "draft";

  return (
    <div className="student-meal-card">
      <div className="student-meal-card-top">
        <div className="student-meal-title">
          <div className="student-meal-icon">
            <MealIcon size={20} />
          </div>

          <div>
            <h3>{mealName}</h3>

            {servingTime && (
              <span className="student-meal-time">
                <Clock3 size={14} />
                {formatTime(servingTime)}
              </span>
            )}
          </div>
        </div>

        <span
          className={`student-published-badge ${
            published ? "published" : "not-published"
          }`}
        >
          {published ? "Published" : "Not Published"}
        </span>
      </div>

      <div className="student-food-list">
        {items.length > 0 ? (
          items.slice(0, 6).map((item, index) => {
            const itemName =
              item?.name ||
              item?.itemName ||
              item?.foodName ||
              item?.title ||
              "Menu item";

            return (
              <div className="student-food-item" key={item?.id || index}>
                <span className="student-food-dot" />
                <span>{itemName}</span>
              </div>
            );
          })
        ) : (
          <div className="student-empty-food">
            <Utensils size={17} />
            <span>No menu items added yet.</span>
          </div>
        )}
      </div>

      {cutoff && (
        <div className="student-cutoff">
          <Clock3 size={14} />
          Response cutoff: {formatTime(cutoff)}
        </div>
      )}

      <div className="student-response-section">
        <span className="student-response-label">
          Your response
        </span>

        <div className="student-response-buttons">
          <button
            type="button"
            className={`student-response-btn attending ${
              currentResponse === "attending" ? "selected" : ""
            }`}
            disabled={!published || saving}
            onClick={() => onRespond(menu, "attending")}
          >
            <CheckCircle2 size={17} />
            Attending
          </button>

          <button
            type="button"
            className={`student-response-btn skipping ${
              currentResponse === "skipping" ? "selected" : ""
            }`}
            disabled={!published || saving}
            onClick={() => onRespond(menu, "skipping")}
          >
            <XCircle size={17} />
            Skipping
          </button>
        </div>

        {currentResponse && (
          <div className={`student-current-response ${currentResponse}`}>
            {currentResponse === "attending"
              ? "You are marked as attending."
              : "You are marked as skipping."}
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  const {
    student,
    assignment,
    studentName,
    refreshNotifications,
  } = useStudent();

  const [dashboard, setDashboard] = useState(null);
  const [menus, setMenus] = useState([]);
  const [responses, setResponses] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingMenuId, setSavingMenuId] = useState(null);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const today = useMemo(() => {
    return new Date().toISOString().slice(0, 10);
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        dashboardResult,
        menuResult,
        responseResult,
        announcementResult,
      ] = await Promise.allSettled([
        studentApi.getDashboard(),
        studentApi.getTodayMenus(),
        studentApi.getResponses(),
        studentApi.getAnnouncements(),
      ]);

      if (dashboardResult.status === "fulfilled") {
        const result = dashboardResult.value;

        setDashboard(
          result?.dashboard ||
            result?.data ||
            result?.result ||
            result ||
            null
        );
      }

      if (menuResult.status === "fulfilled") {
        const result = menuResult.value;

        const menuData =
          result?.menus ||
          result?.data ||
          result?.result ||
          [];

        setMenus(Array.isArray(menuData) ? menuData : []);
      }

      if (responseResult.status === "fulfilled") {
        const result = responseResult.value;

        const responseData =
          result?.responses ||
          result?.data ||
          result?.result ||
          [];

        setResponses(
          Array.isArray(responseData) ? responseData : []
        );
      }

      if (announcementResult.status === "fulfilled") {
        const result = announcementResult.value;

        const announcementData =
          result?.announcements ||
          result?.data ||
          result?.result ||
          [];

        setAnnouncements(
          Array.isArray(announcementData)
            ? announcementData
            : []
        );
      }

      const everythingFailed =
        dashboardResult.status === "rejected" &&
        menuResult.status === "rejected" &&
        responseResult.status === "rejected" &&
        announcementResult.status === "rejected";

      if (everythingFailed) {
        throw dashboardResult.reason;
      }

      setLastUpdated(new Date());

      try {
        await refreshNotifications();
      } catch {
        // Notification refresh should not break dashboard.
      }
    } catch (err) {
      console.error("Student dashboard loading error:", err);

      setError(
        err?.message ||
          "Unable to load your dashboard. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [refreshNotifications]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const responseMap = useMemo(() => {
    const map = new Map();

    responses.forEach((item) => {
      const menuId =
        item?.menuId ||
        item?.menu_id ||
        item?.menu?.id ||
        item?.menu?.menuId;

      if (menuId !== undefined && menuId !== null) {
        map.set(String(menuId), item);
      }
    });

    return map;
  }, [responses]);

  const todayMenus = useMemo(() => {
    return menus
      .filter((menu) => {
        const menuDate = getMenuDate(menu);

        return !menuDate || isToday(menuDate);
      })
      .sort((a, b) => {
        const mealA = normalizeMeal(a).toLowerCase();
        const mealB = normalizeMeal(b).toLowerCase();

        return (
          (MEAL_ORDER[mealA] || 99) -
          (MEAL_ORDER[mealB] || 99)
        );
      });
  }, [menus]);

  const attendedCount = useMemo(() => {
    return responses.filter(
      (item) => getResponseValue(item) === "attending"
    ).length;
  }, [responses]);

  const skippedCount = useMemo(() => {
    return responses.filter(
      (item) => getResponseValue(item) === "skipping"
    ).length;
  }, [responses]);

  const unreadAnnouncements = useMemo(() => {
    return announcements.filter(
      (item) =>
        item?.isRead === false ||
        item?.read === false ||
        item?.readAt === null
    ).length;
  }, [announcements]);

  const handleResponse = async (menu, value) => {
    const menuId = menu?.id || menu?.menuId;

    if (!menuId) {
      setError("Unable to identify this menu.");
      return;
    }

    setSavingMenuId(menuId);
    setError("");

    try {
      await studentApi.submitMealResponse(menuId, value);

      setResponses((current) => {
        const existingIndex = current.findIndex(
          (item) =>
            String(
              item?.menuId ||
                item?.menu_id ||
                item?.menu?.id
            ) === String(menuId)
        );

        const updatedResponse = {
          ...(existingIndex >= 0
            ? current[existingIndex]
            : {}),
          menuId,
          response: value,
          status: value,
        };

        if (existingIndex >= 0) {
          const next = [...current];
          next[existingIndex] = updatedResponse;
          return next;
        }

        return [...current, updatedResponse];
      });
    } catch (err) {
      console.error("Meal response error:", err);

      setError(
        err?.message ||
          "Unable to save your meal response."
      );
    } finally {
      setSavingMenuId(null);
    }
  };

  const displayName =
    student?.name ||
    student?.fullName ||
    student?.studentName ||
    studentName ||
    "Student";

  const totalMenus = todayMenus.length;

  const assignmentData = {
    hostel:
      assignment?.hostel ||
      student?.hostel ||
      student?.hostelName ||
      "",
    block:
      assignment?.block ||
      student?.block ||
      student?.blockName ||
      "",
    messUnit:
      assignment?.messUnit ||
      student?.messUnit ||
      student?.messUnitName ||
      "",
    mealCategory:
      assignment?.mealCategory ||
      student?.mealCategory ||
      "",
  };

  const dashboardStats = dashboard?.stats || dashboard?.statistics || {};

  return (
    <div className="student-dashboard-page">
      <div className="student-dashboard-container">
        {/* Welcome */}
        <section className="student-welcome-card">
          <div className="student-welcome-content">
            <span className="student-welcome-label">
              STUDENT PORTAL
            </span>

            <h1>
              {getISTGreeting()}, {firstName}! 👋
            </h1>

            <p>
              Manage your meals, responses and hostel
              information from one place.
            </p>

            <div className="student-welcome-date">
              <CalendarDays size={17} />
              {formatDate(today)}
            </div>
          </div>

          <div className="student-welcome-decoration">
            <Utensils size={76} strokeWidth={1.2} />
          </div>
        </section>

        {/* Assignment */}
        <StudentAssignmentBanner />

        {/* Error */}
        {error && (
          <div className="student-dashboard-alert error">
            <AlertCircle size={18} />
            <span>{error}</span>

            <button
              type="button"
              onClick={loadDashboard}
              className="student-alert-retry"
            >
              Retry
            </button>
          </div>
        )}

        {/* Stats */}
        <section className="student-stats-grid">
          <StatCard
            icon={<Utensils size={22} />}
            title="Today's Meals"
            value={
              dashboardStats.todayMeals ??
              dashboardStats.totalMeals ??
              totalMenus
            }
            subtitle="Published menus"
          />

          <StatCard
            icon={<CheckCircle2 size={22} />}
            title="Attending"
            value={
              dashboardStats.attending ??
              dashboardStats.attended ??
              attendedCount
            }
            subtitle="Your responses"
            className="success"
          />

          <StatCard
            icon={<XCircle size={22} />}
            title="Skipping"
            value={
              dashboardStats.skipping ??
              dashboardStats.skipped ??
              skippedCount
            }
            subtitle="Your responses"
            className="warning"
          />

          <StatCard
            icon={<Bell size={22} />}
            title="Announcements"
            value={
              dashboardStats.announcements ??
              announcements.length
            }
            subtitle={
              unreadAnnouncements > 0
                ? `${unreadAnnouncements} unread`
                : "All caught up"
            }
            className="info"
          />
        </section>

        {/* Today's Meals */}
        <section className="student-dashboard-section">
          <div className="student-section-header">
            <div>
              <span className="student-section-eyebrow">
                TODAY
              </span>

              <h2>Today's Meals</h2>

              <p>
                View today's published menu and submit your
                meal response.
              </p>
            </div>

            <button
              type="button"
              className="student-refresh-btn"
              onClick={loadDashboard}
              disabled={loading}
              title="Refresh dashboard"
            >
              <RefreshCw
                size={17}
                className={loading ? "student-spin" : ""}
              />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="student-dashboard-loading">
              <RefreshCw className="student-spin" size={30} />
              <span>Loading today's meals...</span>
            </div>
          ) : todayMenus.length === 0 ? (
            <div className="student-empty-state">
              <div className="student-empty-icon">
                <Utensils size={30} />
              </div>

              <h3>No meals published for today</h3>

              <p>
                Your Manager has not published a menu matching
                your current assignment yet.
              </p>
            </div>
          ) : (
            <div className="student-meals-grid">
              {todayMenus.map((menu, index) => {
                const menuId =
                  menu?.id ||
                  menu?.menuId ||
                  `menu-${index}`;

                return (
                  <MealCard
                    key={menuId}
                    menu={menu}
                    response={responseMap.get(String(menuId))}
                    onRespond={handleResponse}
                    saving={savingMenuId === menuId}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Quick Actions */}
        <section className="student-dashboard-section">
          <div className="student-section-header compact">
            <div>
              <span className="student-section-eyebrow">
                QUICK ACCESS
              </span>

              <h2>Quick Actions</h2>
            </div>
          </div>

          <div className="student-quick-actions">
            <a
              href="/student/dashboard/menu-calendar"
              className="student-quick-action"
            >
              <div className="student-quick-icon">
                <CalendarDays size={21} />
              </div>

              <div>
                <strong>Menu Calendar</strong>
                <span>View upcoming meals</span>
              </div>

              <ChevronRight size={19} />
            </a>

            <a
              href="/student/dashboard/responses"
              className="student-quick-action"
            >
              <div className="student-quick-icon">
                <CheckCircle2 size={21} />
              </div>

              <div>
                <strong>My Responses</strong>
                <span>Review meal responses</span>
              </div>

              <ChevronRight size={19} />
            </a>

            <a
              href="/student/dashboard/meal-history"
              className="student-quick-action"
            >
              <div className="student-quick-icon">
                <History size={21} />
              </div>

              <div>
                <strong>Meal History</strong>
                <span>Check attendance history</span>
              </div>

              <ChevronRight size={19} />
            </a>

            <a
              href="/student/dashboard/feedback"
              className="student-quick-action"
            >
              <div className="student-quick-icon">
                <MessageSquare size={21} />
              </div>

              <div>
                <strong>Give Feedback</strong>
                <span>Share your meal experience</span>
              </div>

              <ChevronRight size={19} />
            </a>
          </div>
        </section>

        {/* Assignment summary */}
        <section className="student-dashboard-bottom-grid">
          <div className="student-info-card">
            <div className="student-info-card-header">
              <div>
                <span className="student-section-eyebrow">
                  YOUR ASSIGNMENT
                </span>
                <h3>Hostel Details</h3>
              </div>
            </div>

            <div className="student-assignment-details">
              <div>
                <span>Hostel</span>
                <strong>
                  {assignmentData.hostel || "Not assigned"}
                </strong>
              </div>

              <div>
                <span>Block</span>
                <strong>
                  {assignmentData.block || "Not assigned"}
                </strong>
              </div>

              <div>
                <span>Mess Unit</span>
                <strong>
                  {assignmentData.messUnit || "Not assigned"}
                </strong>
              </div>

              <div>
                <span>Meal Category</span>
                <strong>
                  {assignmentData.mealCategory || "Not assigned"}
                </strong>
              </div>
            </div>
          </div>

          <div className="student-info-card">
            <div className="student-info-card-header">
              <div>
                <span className="student-section-eyebrow">
                  ACCOUNT
                </span>
                <h3>Student Information</h3>
              </div>
            </div>

            <div className="student-account-details">
              <div>
                <span>Student ID</span>
                <strong>
                  {student?.studentId ||
                    student?.id ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>Email</span>
                <strong>
                  {student?.email || "—"}
                </strong>
              </div>

              <div>
                <span>Status</span>
                <strong className="student-active-status">
                  <span />
                  Active
                </strong>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="student-dashboard-footer">
          <span>
            Good Food, Brighter Tomorrows
          </span>

          {lastUpdated && (
            <span>
              Last updated{" "}
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}