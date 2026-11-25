import React, { useEffect, useMemo, useState } from "react";
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
  MessageSquareText,
  History,
  Megaphone,
  UserRound,
} from "lucide-react";

import { Link } from "react-router-dom";
import { useStudent } from "../context/StudentContext";
import studentApi from "../services/studentApi";
import "./StudentDashboard.css";

const mealOrder = {
  breakfast: 1,
  lunch: 2,
  snacks: 3,
  dinner: 4,
};

const normalizeMeal = (meal) =>
  String(meal || "")
    .trim()
    .toLowerCase();

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (value) => {
  if (!value) return "";

  if (
    typeof value === "string" &&
    /^\d{1,2}:\d{2}/.test(value)
  ) {
    const [hour, minute] = value.split(":");
    const date = new Date();
    date.setHours(Number(hour), Number(minute), 0, 0);

    return date.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const getISTGreeting = () => {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date())
  );

  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
};

const getResponseStatus = (response) => {
  const value = String(
    response?.response ||
      response?.status ||
      response?.meal_response ||
      ""
  ).toLowerCase();

  if (
    value === "attending" ||
    value === "attend" ||
    value === "yes" ||
    value === "present"
  ) {
    return "attending";
  }

  if (
    value === "skipping" ||
    value === "skip" ||
    value === "no" ||
    value === "absent"
  ) {
    return "skipping";
  }

  return "not-recorded";
};

const getMenuId = (menu) =>
  menu?.id ||
  menu?.menu_id ||
  menu?._id;

const getMealName = (menu) =>
  menu?.meal_category ||
  menu?.meal_type ||
  menu?.meal ||
  menu?.category ||
  "Meal";

const getMenuItems = (menu) => {
  if (Array.isArray(menu?.items)) return menu.items;
  if (Array.isArray(menu?.menu_items)) return menu.menu_items;
  return [];
};

export default function StudentDashboard() {
  const {
    student,
    assignment,
    loading: studentLoading,
    refreshStudent,
  } = useStudent();

  const [menus, setMenus] = useState([]);
  const [responses, setResponses] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    try {
      setError("");

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

      let dashboardData = null;

      if (dashboardResult.status === "fulfilled") {
        dashboardData =
          dashboardResult.value?.dashboard ||
          dashboardResult.value?.data ||
          dashboardResult.value;
      }

      if (menuResult.status === "fulfilled") {
        const value = menuResult.value;

        const menuData =
          value?.menus ||
          value?.data ||
          value?.results ||
          [];

        setMenus(Array.isArray(menuData) ? menuData : []);
      } else if (dashboardData?.menus) {
        setMenus(
          Array.isArray(dashboardData.menus)
            ? dashboardData.menus
            : []
        );
      }

      if (responseResult.status === "fulfilled") {
        const value = responseResult.value;

        const responseData =
          value?.responses ||
          value?.data ||
          value?.results ||
          [];

        setResponses(
          Array.isArray(responseData)
            ? responseData
            : []
        );
      } else if (dashboardData?.responses) {
        setResponses(
          Array.isArray(dashboardData.responses)
            ? dashboardData.responses
            : []
        );
      }

      if (announcementResult.status === "fulfilled") {
        const value = announcementResult.value;

        const announcementData =
          value?.announcements ||
          value?.data ||
          value?.results ||
          [];

        setAnnouncements(
          Array.isArray(announcementData)
            ? announcementData
            : []
        );
      }

      if (
        dashboardResult.status === "rejected" &&
        menuResult.status === "rejected"
      ) {
        throw dashboardResult.reason || menuResult.reason;
      }
    } catch (err) {
      console.error("Student dashboard error:", err);

      setError(
        err?.message ||
          "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      await refreshStudent?.();
    } catch (err) {
      console.error(err);
    }

    await loadDashboard();
  };

  const sortedMenus = useMemo(() => {
    return [...menus].sort((a, b) => {
      const mealA = mealOrder[normalizeMeal(getMealName(a))] || 99;
      const mealB = mealOrder[normalizeMeal(getMealName(b))] || 99;

      return mealA - mealB;
    });
  }, [menus]);

  const responseMap = useMemo(() => {
    const map = {};

    responses.forEach((item) => {
      const menuId =
        item?.menu_id ||
        item?.menuId ||
        item?.menu?.id ||
        item?.id;

      if (menuId !== undefined && menuId !== null) {
        map[String(menuId)] = item;
      }
    });

    return map;
  }, [responses]);

  const todayStats = useMemo(() => {
    let attending = 0;
    let skipping = 0;
    let notRecorded = 0;

    sortedMenus.forEach((menu) => {
      const id = getMenuId(menu);
      const response = responseMap[String(id)];

      const status = response
        ? getResponseStatus(response)
        : "not-recorded";

      if (status === "attending") attending += 1;
      else if (status === "skipping") skipping += 1;
      else notRecorded += 1;
    });

    return {
      total: sortedMenus.length,
      attending,
      skipping,
      notRecorded,
    };
  }, [sortedMenus, responseMap]);

  const recentResponses = useMemo(() => {
    return [...responses]
      .sort((a, b) => {
        const dateA = new Date(
          a?.date ||
            a?.meal_date ||
            a?.created_at ||
            0
        );

        const dateB = new Date(
          b?.date ||
            b?.meal_date ||
            b?.created_at ||
            0
        );

        return dateB - dateA;
      })
      .slice(0, 5);
  }, [responses]);

  const studentName =
    student?.name ||
    student?.full_name ||
    student?.student_name ||
    student?.username ||
    "Student";

  const firstName =
    studentName.split(" ")[0] || "Student";

  const hostelName =
    assignment?.hostel?.name ||
    assignment?.hostel_name ||
    student?.hostel_name ||
    "Not assigned";

  const blockName =
    assignment?.block?.name ||
    assignment?.block_name ||
    student?.block_name ||
    "Not assigned";

  const messName =
    assignment?.mess_unit?.name ||
    assignment?.mess_unit_name ||
    student?.mess_unit_name ||
    "Not assigned";

  const categoryName =
    assignment?.meal_category?.name ||
    assignment?.meal_category_name ||
    student?.meal_category_name ||
    "Not assigned";

  if (studentLoading && loading) {
    return (
      <div className="student-dashboard-page">
        <div className="student-dashboard-loading">
          <div className="student-spinner" />
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="student-dashboard-page">
      <div className="student-dashboard-container">

        {/* Header */}
        <section className="student-dashboard-welcome">
          <div>
            <p className="student-dashboard-eyebrow">
              STUDENT PORTAL
            </p>

            <h1>
              {getISTGreeting()}, {firstName}! 👋
            </h1>

            <p className="student-dashboard-subtitle">
              Welcome back. Here is your meal overview for today.
            </p>
          </div>

          <button
            type="button"
            className="student-refresh-button"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? "student-spin"
                  : ""
              }
            />

            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </section>

        {/* Assignment */}
        <section className="student-assignment-card">
          <div className="student-assignment-icon">
            <UserRound size={22} />
          </div>

          <div className="student-assignment-content">
            <span>Your Assigned Meal Setup</span>

            <div className="student-assignment-values">
              <strong>{hostelName}</strong>
              <span>{blockName}</span>
              <span>{messName}</span>
              <span>{categoryName}</span>
            </div>
          </div>

          <Link
            to="/student/dashboard/profile"
            className="student-assignment-link"
          >
            View Profile
            <ChevronRight size={16} />
          </Link>
        </section>

        {/* Error */}
        {error && (
          <div className="student-dashboard-error">
            <AlertCircle size={19} />
            <span>{error}</span>

            <button
              type="button"
              onClick={loadDashboard}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Statistics */}
        <section className="student-stat-grid">

          <div className="student-stat-card">
            <div className="student-stat-icon today">
              <Utensils size={22} />
            </div>

            <div>
              <span>Today's Meals</span>
              <strong>{todayStats.total}</strong>
            </div>
          </div>

          <div className="student-stat-card">
            <div className="student-stat-icon attending">
              <CheckCircle2 size={22} />
            </div>

            <div>
              <span>Attending</span>
              <strong>{todayStats.attending}</strong>
            </div>
          </div>

          <div className="student-stat-card">
            <div className="student-stat-icon skipping">
              <XCircle size={22} />
            </div>

            <div>
              <span>Skipping</span>
              <strong>{todayStats.skipping}</strong>
            </div>
          </div>

          <div className="student-stat-card">
            <div className="student-stat-icon pending">
              <Clock3 size={22} />
            </div>

            <div>
              <span>Not Recorded</span>
              <strong>{todayStats.notRecorded}</strong>
            </div>
          </div>

        </section>

        {/* Main Grid */}
        <section className="student-dashboard-main-grid">

          {/* Today's Menu */}
          <div className="student-dashboard-panel student-menu-panel">

            <div className="student-panel-header">
              <div>
                <h2>Today's Menu</h2>
                <p>
                  {formatDate(new Date())}
                </p>
              </div>

              <Link
                to="/student/dashboard/my-meals"
                className="student-panel-link"
              >
                My Meals
                <ChevronRight size={16} />
              </Link>
            </div>

            {loading ? (
              <div className="student-panel-loading">
                <div className="student-spinner small" />
                <span>Loading today's menu...</span>
              </div>
            ) : sortedMenus.length === 0 ? (
              <div className="student-empty-state">
                <div className="student-empty-icon">
                  <Utensils size={25} />
                </div>

                <h3>No menu published</h3>

                <p>
                  No meal menu is currently available
                  for your assignment.
                </p>

                <Link
                  to="/student/dashboard/menu-calendar"
                >
                  View Menu Calendar
                  <ChevronRight size={15} />
                </Link>
              </div>
            ) : (
              <div className="student-meal-list">
                {sortedMenus.map((menu) => {
                  const id = getMenuId(menu);
                  const meal = getMealName(menu);
                  const normalizedMeal =
                    normalizeMeal(meal);

                  const response =
                    responseMap[String(id)];

                  const status = response
                    ? getResponseStatus(response)
                    : "not-recorded";

                  const items = getMenuItems(menu);

                  const startTime =
                    menu?.start_time ||
                    menu?.serving_start ||
                    menu?.meal_start_time;

                  const endTime =
                    menu?.end_time ||
                    menu?.serving_end ||
                    menu?.meal_end_time;

                  return (
                    <div
                      className="student-meal-row"
                      key={id || meal}
                    >
                      <div className="student-meal-icon">
                        {normalizedMeal ===
                        "breakfast" ? (
                          <Coffee size={21} />
                        ) : (
                          <Utensils size={21} />
                        )}
                      </div>

                      <div className="student-meal-details">
                        <div className="student-meal-title-row">
                          <h3>{meal}</h3>

                          {status === "attending" && (
                            <span className="student-status attending">
                              <CheckCircle2 size={13} />
                              Attending
                            </span>
                          )}

                          {status === "skipping" && (
                            <span className="student-status skipping">
                              <XCircle size={13} />
                              Skipping
                            </span>
                          )}

                          {status === "not-recorded" && (
                            <span className="student-status pending">
                              Not Recorded
                            </span>
                          )}
                        </div>

                        {(startTime || endTime) && (
                          <div className="student-meal-time">
                            <Clock3 size={14} />

                            {formatTime(startTime)}

                            {endTime && (
                              <>
                                {" - "}
                                {formatTime(endTime)}
                              </>
                            )}
                          </div>
                        )}

                        {items.length > 0 && (
                          <div className="student-food-items">
                            {items
                              .slice(0, 5)
                              .map((item, index) => (
                                <span
                                  key={
                                    item?.id ||
                                    item?.name ||
                                    index
                                  }
                                >
                                  {item?.name ||
                                    item?.item_name ||
                                    item}
                                </span>
                              ))}

                            {items.length > 5 && (
                              <span>
                                +{items.length - 5} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <Link
                        to="/student/dashboard/my-meals"
                        className="student-meal-action"
                      >
                        Manage
                        <ChevronRight size={15} />
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="student-dashboard-panel">

            <div className="student-panel-header">
              <div>
                <h2>Quick Actions</h2>
                <p>Manage your meal portal</p>
              </div>
            </div>

            <div className="student-quick-actions">

              <Link
                to="/student/dashboard/menu-calendar"
                className="student-quick-action"
              >
                <div className="student-quick-icon">
                  <CalendarDays size={20} />
                </div>

                <div>
                  <strong>Menu Calendar</strong>
                  <span>
                    View upcoming meals
                  </span>
                </div>

                <ChevronRight size={17} />
              </Link>

              <Link
                to="/student/dashboard/responses"
                className="student-quick-action"
              >
                <div className="student-quick-icon">
                  <CheckCircle2 size={20} />
                </div>

                <div>
                  <strong>My Responses</strong>
                  <span>
                    View meal responses
                  </span>
                </div>

                <ChevronRight size={17} />
              </Link>

              <Link
                to="/student/dashboard/meal-history"
                className="student-quick-action"
              >
                <div className="student-quick-icon">
                  <History size={20} />
                </div>

                <div>
                  <strong>Meal History</strong>
                  <span>
                    Check attendance history
                  </span>
                </div>

                <ChevronRight size={17} />
              </Link>

              <Link
                to="/student/dashboard/feedback"
                className="student-quick-action"
              >
                <div className="student-quick-icon">
                  <MessageSquareText size={20} />
                </div>

                <div>
                  <strong>Give Feedback</strong>
                  <span>
                    Share your meal experience
                  </span>
                </div>

                <ChevronRight size={17} />
              </Link>

            </div>
          </div>
        </section>

        {/* Bottom Grid */}
        <section className="student-dashboard-bottom-grid">

          {/* Recent Responses */}
          <div className="student-dashboard-panel">

            <div className="student-panel-header">
              <div>
                <h2>Recent Responses</h2>
                <p>Your latest meal responses</p>
              </div>

              <Link
                to="/student/dashboard/responses"
                className="student-panel-link"
              >
                View All
                <ChevronRight size={16} />
              </Link>
            </div>

            {recentResponses.length === 0 ? (
              <div className="student-small-empty">
                <CheckCircle2 size={22} />
                <span>
                  No meal responses recorded yet.
                </span>
              </div>
            ) : (
              <div className="student-response-list">
                {recentResponses.map(
                  (item, index) => {
                    const status =
                      getResponseStatus(item);

                    const meal =
                      item?.meal ||
                      item?.meal_type ||
                      item?.meal_category ||
                      item?.menu?.meal_category ||
                      "Meal";

                    const date =
                      item?.date ||
                      item?.meal_date ||
                      item?.created_at;

                    return (
                      <div
                        className="student-response-item"
                        key={
                          item?.id ||
                          `${meal}-${date}-${index}`
                        }
                      >
                        <div className="student-response-date">
                          <span>
                            {date
                              ? new Date(
                                  date
                                ).toLocaleDateString(
                                  "en-IN",
                                  {
                                    day: "2-digit",
                                  }
                                )
                              : "—"}
                          </span>

                          <small>
                            {date
                              ? new Date(
                                  date
                                ).toLocaleDateString(
                                  "en-IN",
                                  {
                                    month: "short",
                                  }
                                )
                              : ""}
                          </small>
                        </div>

                        <div className="student-response-info">
                          <strong>{meal}</strong>

                          <span>
                            {date
                              ? formatDate(date)
                              : "Date unavailable"}
                          </span>
                        </div>

                        <span
                          className={`student-status ${status}`}
                        >
                          {status ===
                            "attending" && (
                            <CheckCircle2 size={13} />
                          )}

                          {status ===
                            "skipping" && (
                            <XCircle size={13} />
                          )}

                          {status ===
                            "not-recorded" &&
                            "Not Recorded"}

                          {status ===
                            "attending" &&
                            "Attending"}

                          {status ===
                            "skipping" &&
                            "Skipping"}
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>

          {/* Announcements */}
          <div className="student-dashboard-panel">

            <div className="student-panel-header">
              <div>
                <h2>Announcements</h2>
                <p>Latest hostel updates</p>
              </div>

              <Link
                to="/student/dashboard/announcements"
                className="student-panel-link"
              >
                View All
                <ChevronRight size={16} />
              </Link>
            </div>

            {announcements.length === 0 ? (
              <div className="student-small-empty">
                <Megaphone size={22} />
                <span>
                  No new announcements.
                </span>
              </div>
            ) : (
              <div className="student-announcement-list">
                {announcements
                  .slice(0, 4)
                  .map((announcement, index) => (
                    <Link
                      to="/student/dashboard/announcements"
                      className="student-announcement-item"
                      key={
                        announcement?.id ||
                        index
                      }
                    >
                      <div className="student-announcement-icon">
                        <Megaphone size={17} />
                      </div>

                      <div>
                        <strong>
                          {announcement?.title ||
                            announcement?.subject ||
                            "Announcement"}
                        </strong>

                        <span>
                          {announcement?.message ||
                            announcement?.content ||
                            "View announcement details"}
                        </span>
                      </div>

                      <ChevronRight size={16} />
                    </Link>
                  ))}
              </div>
            )}
          </div>

        </section>

        {/* Footer message */}
        <div className="student-dashboard-footer-message">
          <Utensils size={17} />
          <span>
            Good Food, Brighter Tomorrows
          </span>
        </div>

      </div>
    </div>
  );
}