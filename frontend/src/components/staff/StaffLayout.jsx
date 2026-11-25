import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  ScanLine,
  Users,
  MessageSquareText,
  History,
  Megaphone,
  Bell,
  UserCircle,
  Settings,
  LogOut,
  Utensils,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { clearStudentSession } from "../../services/studentApi";
import { staffRequest } from "../../services/staffApi";
import "./staffLayout.css";
import "../../pages/staff/staffPages.css";

const IST = "Asia/Kolkata";

const DEFAULT_STAFF_SETTINGS = {
  notificationsEnabled: true,
  announcementNotifications: true,
  managerNotifications: true,
  mealUpdateNotifications: true,
  systemNotifications: true,
  timezone: "Asia/Kolkata",
  language: "en",
  theme: "system",
  compactLayout: false,
};

function initials(name) {
  return String(name || "Staff")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatHeaderDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatHeaderTime(value) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

const items = [
  ["Dashboard", "/staff/dashboard", LayoutDashboard],
  ["QR Scanner", "/staff/qr-scanner", ScanLine],
  ["Meal Attendance", "/staff/attendance", Users],
  ["Student Response", "/staff/responses", MessageSquareText],
  ["Attendance History", "/staff/history", History],
  ["Announcements", "/staff/announcements", Megaphone],
  ["Notifications", "/staff/notifications", Bell],
  ["Profile", "/staff/profile", UserCircle],
  ["Settings", "/staff/settings", Settings],
];

export default function StaffLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [profileError, setProfileError] = useState("");
  const [notificationError, setNotificationError] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [staffSettings, setStaffSettings] = useState(DEFAULT_STAFF_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState("");
  const notificationRef = useRef(null);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const handleSessionExpired = (event) => {
      if (event.detail?.role === "staff") {
        navigate("/login", { replace: true });
      }
    };
    window.addEventListener("auth-session-expired", handleSessionExpired);
    return () => {
      window.removeEventListener("auth-session-expired", handleSessionExpired);
    };
  }, [navigate]);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      try {
        const data = await staffRequest("/api/staff/profile");
        if (!active) return;
        setProfile(data.profile || null);
        setProfileError("");
      } catch (error) {
        if (!active) return;
        setProfileError(error.message || "Unable to load Staff profile.");
      }
    };
    void loadProfile();
    window.addEventListener("staff-profile-updated", loadProfile);
    return () => {
      active = false;
      window.removeEventListener("staff-profile-updated", loadProfile);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      try {
        const data = await staffRequest("/api/staff/settings");
        if (!active) return;
        setStaffSettings({ ...DEFAULT_STAFF_SETTINGS, ...(data.settings || {}) });
        setSettingsError("");
      } catch (error) {
        if (active) setSettingsError(error.message || "Unable to load Staff settings.");
      } finally {
        if (active) setSettingsLoading(false);
      }
    };
    const refreshSettings = (event) => {
      if (event.detail) {
        setStaffSettings((current) => ({ ...current, ...event.detail }));
        setSettingsError("");
      } else {
        void loadSettings();
      }
    };
    void loadSettings();
    window.addEventListener("staff-settings-updated", refreshSettings);
    return () => {
      active = false;
      window.removeEventListener("staff-settings-updated", refreshSettings);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadNotifications = async () => {
      try {
        const data = await staffRequest("/api/staff/notifications");
        if (!active) return;
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        setNotificationError("");
      } catch (error) {
        if (active) setNotificationError(error.message || "Unable to load notifications.");
      }
    };
    void loadNotifications();
    const timer = window.setInterval(() => void loadNotifications(), 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const updateColorScheme = (event) => setSystemPrefersDark(event.matches);
    colorScheme.addEventListener("change", updateColorScheme);
    return () => colorScheme.removeEventListener("change", updateColorScheme);
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false);
      if (!notificationRef.current?.contains(event.target)) setNotificationOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
        setNotificationOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const logout = () => {
    clearStudentSession();
    navigate("/login", { replace: true });
  };
  const navigateFromProfileMenu = (path) => {
    setProfileMenuOpen(false);
    navigate(path);
  };
  const updateStaffSetting = (key, value) => {
    setStaffSettings((current) => ({ ...current, [key]: value }));
  };
  const title = items.find(([, path]) =>
    path === "/staff/dashboard"
      ? location.pathname === path
      : location.pathname.startsWith(path)
  )?.[0] || "Staff Portal";
  const theme = ["light", "dark", "system"].includes(staffSettings.theme)
    ? staffSettings.theme
    : "light";
  const applyDarkTheme = theme === "dark" || (theme === "system" && systemPrefersDark);

  return (
    <div className={`staff-layout-shell theme-${theme}${applyDarkTheme && theme !== "dark" ? " theme-dark" : ""}${staffSettings.compactLayout ? " compact-layout" : ""}${sidebarOpen ? " sidebar-open" : ""}`}>
      {sidebarOpen && (
        <button
          type="button"
          className="staff-layout-overlay"
          aria-label="Close navigation menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className="staff-layout-sidebar" aria-label="Staff navigation">
        <div className="staff-layout-brand">
          <div className="staff-layout-brand-icon"><Utensils size={22} /></div>
          <div><strong>DU MESS</strong><span>Staff Portal</span></div>
        </div>
        <div className="staff-layout-staff-card">
          <span className="staff-layout-staff-avatar">
            {initials(profile?.name)}
          </span>
          <span className="staff-layout-staff-details">
            <strong>{profile?.name || "Staff"}</strong>
            <small>{profile?.staffId || (profileError ? "Profile unavailable" : "Loading Staff ID…")}</small>
          </span>
        </div>
        <nav className="staff-layout-nav">
          {items.map(([label, path, Icon]) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/staff/dashboard"}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `staff-layout-nav-item${isActive ? " active" : ""}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button type="button" className="staff-layout-logout" onClick={logout}>
          <LogOut size={18} /> Logout
        </button>
      </aside>
      <div className="staff-layout-main">
        <header className="staff-layout-header">
          <div className="staff-layout-header-title">
            <button
              type="button"
              className="staff-layout-menu-toggle"
              aria-label={sidebarOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((open) => !open)}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="staff-layout-title-block">
              <strong>{title}</strong>
              <span>{formatHeaderDate(now)} · {formatHeaderTime(now)} IST</span>
            </div>
          </div>
          <div className="staff-layout-header-actions">
            <div className="staff-layout-notification" ref={notificationRef}>
              <button
                type="button"
                onClick={() => {
                  setNotificationOpen((open) => !open);
                  setProfileMenuOpen(false);
                }}
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
                aria-expanded={notificationOpen}
                aria-haspopup="menu"
              >
                <Bell size={18} />
                {unreadCount > 0 && <span>{unreadCount > 99 ? "99+" : unreadCount}</span>}
              </button>
              {notificationOpen && (
                <div className="staff-layout-notification-menu" role="menu">
                  <div className="staff-layout-menu-heading">
                    <strong>Notifications</strong>
                    <small>{unreadCount} unread</small>
                  </div>
                  {notificationError && <p className="staff-layout-menu-error" role="alert">{notificationError}</p>}
                  {notifications.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setNotificationOpen(false);
                        navigate("/staff/notifications");
                      }}
                    >
                      <strong>{item.title}</strong>
                      <small>{item.isRead ? "Read" : "Unread"}</small>
                    </button>
                  ))}
                  {!notifications.length && !notificationError && <p>No notifications</p>}
                  <button
                    className="staff-layout-menu-link"
                    type="button"
                    onClick={() => {
                      setNotificationOpen(false);
                      navigate("/staff/notifications");
                    }}
                  >
                    View all notifications
                  </button>
                </div>
              )}
            </div>
            <div className="staff-layout-profile-wrap" ref={profileMenuRef}>
              <button
                type="button"
                className="staff-layout-profile"
                onClick={() => {
                  setProfileMenuOpen((open) => !open);
                  setNotificationOpen(false);
                }}
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
                aria-label="Open Staff profile menu"
              >
                <span>{initials(profile?.name)}</span>
                <div>
                  <strong>{profile?.name || "Staff"}</strong>
                  <small>{profile?.staffId || "Staff Portal"}</small>
                </div>
                <ChevronDown size={15} />
              </button>
              {profileMenuOpen && (
                <div className="staff-layout-profile-menu" role="menu">
                  <div className="staff-layout-profile-menu-identity">
                    <span className="staff-layout-profile-menu-avatar">{initials(profile?.name)}</span>
                    <div>
                      <strong>{profile?.name || "Staff"}</strong>
                      <small>{profile?.staffId || "Staff ID unavailable"}</small>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => navigateFromProfileMenu("/staff/profile")}
                  >
                    <UserCircle size={17} /> View Profile
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => navigateFromProfileMenu("/staff/settings")}
                  >
                    <Settings size={17} /> Settings
                  </button>
                  <button
                    className="staff-layout-profile-logout"
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      logout();
                    }}
                  >
                    <LogOut size={17} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="staff-layout-content">
          <Outlet context={{ staffSettings, settingsLoading, settingsError, updateStaffSetting }} />
        </main>
      </div>
    </div>
  );
}
