import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  LogOut,
  Menu,
  UserCircle,
} from "lucide-react";

import { useStudent } from "../../context/StudentContext";

const pageTitles = {
  "/student/dashboard": {
    title: "Overview",
    subtitle:
      "Manage your hostel meals and preferences",
  },

  "/student/dashboard/my-meals": {
    title: "My Meals",
    subtitle:
      "View today's meals and submit your responses",
  },

  "/student/dashboard/menu-calendar": {
    title: "Menu Calendar",
    subtitle:
      "View your published hostel meal schedule",
  },

  "/student/dashboard/responses": {
    title: "Responses",
    subtitle:
      "Manage your meal attendance responses",
  },

  "/student/dashboard/meal-history": {
    title: "Meal History",
    subtitle:
      "View your previous meal attendance",
  },

  "/student/dashboard/feedback": {
    title: "Feedback",
    subtitle:
      "Share your experience with hostel meals",
  },

  "/student/dashboard/announcements": {
    title: "Announcements",
    subtitle:
      "Stay updated with hostel meal announcements",
  },

  "/student/dashboard/profile": {
    title: "Profile",
    subtitle:
      "View and manage your student profile",
  },

  "/student/dashboard/settings": {
    title: "Settings",
    subtitle:
      "Manage your student portal preferences",
  },
};

function StudentHeader({
  onMenuClick,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    student,
    notifications,
    unreadNotificationCount,
    logout,
  } = useStudent();

  const [notificationOpen, setNotificationOpen] =
    useState(false);

  const getStudentName = () => {
    return (
      student?.name ||
      student?.full_name ||
      student?.fullName ||
      student?.username ||
      student?.email?.split("@")[0] ||
      "Student"
    );
  };

  const getInitials = () => {
    const name = getStudentName()
      .trim()
      .split(" ")
      .filter(Boolean);

    if (name.length >= 2) {
      return (
        name[0][0] +
        name[name.length - 1][0]
      ).toUpperCase();
    }

    return getStudentName()
      .substring(0, 2)
      .toUpperCase();
  };

  const getPageInformation = () => {
    if (pageTitles[location.pathname]) {
      return pageTitles[location.pathname];
    }

    if (
      location.pathname.startsWith(
        "/student/dashboard/my-meals"
      )
    ) {
      return pageTitles[
        "/student/dashboard/my-meals"
      ];
    }

    if (
      location.pathname.startsWith(
        "/student/dashboard/menu-calendar"
      )
    ) {
      return pageTitles[
        "/student/dashboard/menu-calendar"
      ];
    }

    if (
      location.pathname.startsWith(
        "/student/dashboard/responses"
      )
    ) {
      return pageTitles[
        "/student/dashboard/responses"
      ];
    }

    if (
      location.pathname.startsWith(
        "/student/dashboard/meal-history"
      )
    ) {
      return pageTitles[
        "/student/dashboard/meal-history"
      ];
    }

    if (
      location.pathname.startsWith(
        "/student/dashboard/feedback"
      )
    ) {
      return pageTitles[
        "/student/dashboard/feedback"
      ];
    }

    if (
      location.pathname.startsWith(
        "/student/dashboard/announcements"
      )
    ) {
      return pageTitles[
        "/student/dashboard/announcements"
      ];
    }

    if (
      location.pathname.startsWith(
        "/student/dashboard/profile"
      )
    ) {
      return pageTitles[
        "/student/dashboard/profile"
      ];
    }

    if (
      location.pathname.startsWith(
        "/student/dashboard/settings"
      )
    ) {
      return pageTitles[
        "/student/dashboard/settings"
      ];
    }

    return {
      title: "Student Portal",
      subtitle:
        "Manage your hostel meals and preferences",
    };
  };

  const page = getPageInformation();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate("/login", {
        replace: true,
      });
    }
  };

  const openAnnouncements = () => {
    setNotificationOpen(false);

    navigate(
      "/student/dashboard/announcements"
    );
  };

  return (
    <header className="student-header">
      {/* Left */}
      <div className="student-header-left">
        <button
          type="button"
          className="student-hamburger"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu size={23} />
        </button>

        <div className="student-page-heading">
          <h1>{page.title}</h1>

          <p>{page.subtitle}</p>
        </div>
      </div>

      {/* Right */}
      <div className="student-header-right">
        {/* Notification */}
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
            <>
              <div
                className="student-dropdown-backdrop"
                onClick={() =>
                  setNotificationOpen(false)
                }
              />

              <div className="student-notification-dropdown">
                <div className="student-notification-header">
                  <div>
                    <strong>
                      Notifications
                    </strong>

                    <span>
                      {unreadNotificationCount > 0
                        ? `${unreadNotificationCount} unread`
                        : "All caught up"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={openAnnouncements}
                  >
                    View all
                  </button>
                </div>

                <div className="student-notification-list">
                  {Array.isArray(notifications) &&
                  notifications.length > 0 ? (
                    notifications
                      .slice(0, 5)
                      .map((notification) => {
                        const notificationId =
                          notification.id ||
                          notification._id;

                        const isUnread =
                          !notification.is_read &&
                          !notification.read;

                        return (
                          <button
                            key={notificationId}
                            type="button"
                            className={`student-notification-item ${
                              isUnread
                                ? "unread"
                                : ""
                            }`}
                            onClick={
                              openAnnouncements
                            }
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

                              {notification.created_at && (
                                <small>
                                  {new Date(
                                    notification.created_at
                                  ).toLocaleString()}
                                </small>
                              )}
                            </div>
                          </button>
                        );
                      })
                  ) : (
                    <div className="student-empty-notifications">
                      <Bell size={28} />

                      <p>
                        No notifications
                      </p>

                      <span>
                        You're all caught up.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="student-header-divider" />

        {/* Profile */}
        <button
          type="button"
          className="student-profile-button"
          onClick={() =>
            navigate(
              "/student/dashboard/profile"
            )
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

        {/* Logout */}
        <button
          type="button"
          className="student-logout-button"
          onClick={handleLogout}
          title="Logout"
          aria-label="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

export default StudentHeader;