import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Utensils,
  CalendarDays,
  MessageSquareText,
  History,
  Star,
  Megaphone,
  UserCircle,
  Settings,
  Menu,
  X,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { useStudent } from "../../context/StudentContext";
import "./studentPortal.css";
const navigationItems = [
  {
    label: "Overview",
    path: "/student/dashboard",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "My Meals",
    path: "/student/dashboard/my-meals",
    icon: Utensils,
  },
  {
    label: "Menu Calendar",
    path: "/student/dashboard/menu-calendar",
    icon: CalendarDays,
  },
  {
    label: "Responses",
    path: "/student/dashboard/responses",
    icon: MessageSquareText,
  },
  {
    label: "Meal History",
    path: "/student/dashboard/meal-history",
    icon: History,
  },
  {
    label: "Feedback",
    path: "/student/dashboard/feedback",
    icon: Star,
  },
  {
    label: "Announcements",
    path: "/student/dashboard/announcements",
    icon: Megaphone,
  },
  {
    label: "Profile",
    path: "/student/dashboard/profile",
    icon: UserCircle,
  },
  {
    label: "Settings",
    path: "/student/dashboard/settings",
    icon: Settings,
  },
];

function StudentLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    student,
    assignment,
    notifications,
    unreadNotificationCount,
    logout,
    loading,
  } = useStudent();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
    setNotificationOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 900) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  const getStudentName = () => {
    if (!student) return "Student";

    return (
      student.name ||
      student.full_name ||
      student.fullName ||
      student.username ||
      student.email?.split("@")[0] ||
      "Student"
    );
  };

  const getInitials = () => {
    const name = getStudentName();

    const parts = name
      .trim()
      .split(" ")
      .filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }

    return name.substring(0, 2).toUpperCase();
  };

  const getAssignmentValue = (key1, key2, fallback = "Not assigned") => {
    return (
      assignment?.[key1] ||
      assignment?.[key2] ||
      student?.[key1] ||
      student?.[key2] ||
      fallback
    );
  };

  const hostelName = getAssignmentValue(
    "hostel_name",
    "hostelName"
  );

  const blockName = getAssignmentValue(
    "block_name",
    "blockName"
  );

  const messName = getAssignmentValue(
    "mess_unit_name",
    "messUnitName"
  );

  const mealCategory = getAssignmentValue(
    "meal_category",
    "mealCategory"
  );

  const pageTitle = (() => {
    const current = navigationItems.find((item) => {
      if (item.end) {
        return location.pathname === item.path;
      }

      return location.pathname.startsWith(item.path);
    });

    return current?.label || "Student Portal";
  })();

  return (
    <div className="student-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="student-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ================= SIDEBAR ================= */}
      <aside
        className={`student-sidebar ${
          sidebarCollapsed ? "collapsed" : ""
        } ${sidebarOpen ? "mobile-open" : ""}`}
      >
        <div className="student-sidebar-brand">
          <div className="student-brand-logo">
            <Utensils size={24} strokeWidth={2.3} />
          </div>

          {!sidebarCollapsed && (
            <div className="student-brand-text">
              <div className="student-brand-title">
                Hostel Meal
              </div>

              <div className="student-brand-subtitle">
                Student Portal
              </div>
            </div>
          )}

          <button
            type="button"
            className="student-mobile-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={21} />
          </button>
        </div>

        <div className="student-sidebar-scroll">
          <div className="student-sidebar-section">
            {!sidebarCollapsed && (
              <div className="student-sidebar-section-title">
                MENU
              </div>
            )}

            <nav className="student-navigation">
              {navigationItems.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `student-nav-item ${
                        isActive ? "active" : ""
                      }`
                    }
                  >
                    <span className="student-nav-icon">
                      <Icon size={19} strokeWidth={2} />
                    </span>

                    {!sidebarCollapsed && (
                      <span className="student-nav-label">
                        {item.label}
                      </span>
                    )}

                    {item.label === "Announcements" &&
                      unreadNotificationCount > 0 &&
                      !sidebarCollapsed && (
                        <span className="student-nav-badge">
                          {unreadNotificationCount > 99
                            ? "99+"
                            : unreadNotificationCount}
                        </span>
                      )}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Sidebar bottom */}
        <div className="student-sidebar-bottom">
          {!sidebarCollapsed && (
            <div className="student-sidebar-slogan">
              <div className="student-slogan-icon">
                🍽️
              </div>

              <div>
                <div className="student-slogan-title">
                  Good Food,
                </div>

                <div className="student-slogan-text">
                  Brighter Tomorrows
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            className="student-collapse-button"
            onClick={() =>
              setSidebarCollapsed((previous) => !previous)
            }
            title={
              sidebarCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
          >
            {sidebarCollapsed ? (
              <ChevronRight size={18} />
            ) : (
              <ChevronLeft size={18} />
            )}

            {!sidebarCollapsed && (
              <span>
                Collapse sidebar
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* ================= MAIN ================= */}
      <div
        className={`student-main ${
          sidebarCollapsed ? "sidebar-collapsed" : ""
        }`}
      >
        {/* ================= HEADER ================= */}
        <header className="student-header">
          <div className="student-header-left">
            <button
              type="button"
              className="student-hamburger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={23} />
            </button>

            <div className="student-page-heading">
              <h1>{pageTitle}</h1>

              <p>
                Manage your hostel meals and preferences
              </p>
            </div>
          </div>

          <div className="student-header-right">
            {/* Notifications */}
            <div className="student-notification-wrapper">
              <button
                type="button"
                className="student-header-icon-button"
                onClick={() =>
                  setNotificationOpen(
                    (previous) => !previous
                  )
                }
                aria-label="Notifications"
              >
                <Bell size={20} />

                {unreadNotificationCount > 0 && (
                  <span className="student-notification-dot">
                    {unreadNotificationCount > 9
                      ? "9+"
                      : unreadNotificationCount}
                  </span>
                )}
              </button>

              {notificationOpen && (
                <div className="student-notification-dropdown">
                  <div className="student-notification-header">
                    <div>
                      <strong>Notifications</strong>

                      <span>
                        {unreadNotificationCount > 0
                          ? `${unreadNotificationCount} unread`
                          : "All caught up"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          "/student/dashboard/announcements"
                        )
                      }
                    >
                      View all
                    </button>
                  </div>

                  <div className="student-notification-list">
                    {Array.isArray(notifications) &&
                    notifications.length > 0 ? (
                      notifications
                        .slice(0, 5)
                        .map((notification) => (
                          <button
                            type="button"
                            className={`student-notification-item ${
                              notification.is_read ||
                              notification.read
                                ? ""
                                : "unread"
                            }`}
                            key={
                              notification.id ||
                              notification._id
                            }
                            onClick={() => {
                              setNotificationOpen(false);
                              navigate(
                                "/student/dashboard/announcements"
                              );
                            }}
                          >
                            <div className="student-notification-item-icon">
                              <Bell size={16} />
                            </div>

                            <div className="student-notification-content">
                              <strong>
                                {notification.title ||
                                  notification.subject ||
                                  "Notification"}
                              </strong>

                              <span>
                                {notification.message ||
                                  notification.body ||
                                  "You have a new notification."}
                              </span>
                            </div>
                          </button>
                        ))
                    ) : (
                      <div className="student-empty-notifications">
                        <Bell size={26} />

                        <p>No notifications</p>

                        <span>
                          You're all caught up.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="student-header-divider" />

            {/* Profile */}
            <button
              type="button"
              className="student-profile-button"
              onClick={() =>
                navigate("/student/dashboard/profile")
              }
            >
              <div className="student-avatar">
                {student?.profile_image ||
                student?.profileImage ? (
                  <img
                    src={
                      student.profile_image ||
                      student.profileImage
                    }
                    alt={getStudentName()}
                  />
                ) : (
                  getInitials()
                )}
              </div>

              <div className="student-profile-info">
                <strong>{getStudentName()}</strong>

                <span>
                  {student?.student_id ||
                    student?.studentId ||
                    "Student"}
                </span>
              </div>
            </button>

            <button
              type="button"
              className="student-logout-button"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* ================= ASSIGNMENT BAR ================= */}
        <div className="student-assignment-bar">
          <div className="student-assignment-content">
            <div className="student-assignment-status">
              <span className="student-status-dot" />

              <span>
                Active Student Account
              </span>
            </div>

            <div className="student-assignment-items">
              <div className="student-assignment-item">
                <span>Hostel</span>
                <strong>{hostelName}</strong>
              </div>

              <div className="student-assignment-separator" />

              <div className="student-assignment-item">
                <span>Block</span>
                <strong>{blockName}</strong>
              </div>

              <div className="student-assignment-separator" />

              <div className="student-assignment-item">
                <span>Mess Unit</span>
                <strong>{messName}</strong>
              </div>

              <div className="student-assignment-separator" />

              <div className="student-assignment-item">
                <span>Meal Category</span>
                <strong>{mealCategory}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* ================= PAGE CONTENT ================= */}
        <main className="student-page-content">
          {loading ? (
            <div className="student-page-loader">
              <div className="student-loader-spinner" />

              <p>
                Loading student portal...
              </p>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}

export default StudentLayout;