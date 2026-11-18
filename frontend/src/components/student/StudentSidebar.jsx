import React from "react";
import { NavLink } from "react-router-dom";
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
} from "lucide-react";

const menuItems = [
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

function StudentSidebar({
  collapsed = false,
  onNavigate,
  unreadCount = 0,
}) {
  return (
    <div className="student-sidebar-content">
      {/* Brand */}
      <div className="student-sidebar-brand">
        <div className="student-brand-logo">
          <Utensils size={23} strokeWidth={2.2} />
        </div>

        {!collapsed && (
          <div className="student-brand-text">
            <div className="student-brand-title">
              Hostel Meal
            </div>

            <div className="student-brand-subtitle">
              Student Portal
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="student-sidebar-navigation">
        {!collapsed && (
          <div className="student-sidebar-section-title">
            MENU
          </div>
        )}

        <nav>
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `student-nav-item ${
                    isActive ? "active" : ""
                  }`
                }
              >
                <span className="student-nav-icon">
                  <Icon
                    size={19}
                    strokeWidth={2}
                  />
                </span>

                {!collapsed && (
                  <span className="student-nav-label">
                    {item.label}
                  </span>
                )}

                {item.label === "Announcements" &&
                  unreadCount > 0 &&
                  !collapsed && (
                    <span className="student-nav-badge">
                      {unreadCount > 99
                        ? "99+"
                        : unreadCount}
                    </span>
                  )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Slogan */}
      {!collapsed && (
        <div className="student-sidebar-slogan">
          <div className="student-slogan-icon">
            🍽️
          </div>

          <div className="student-slogan-text-wrapper">
            <div className="student-slogan-title">
              Good Food,
            </div>

            <div className="student-slogan-text">
              Brighter Tomorrows
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { menuItems };

export default StudentSidebar;