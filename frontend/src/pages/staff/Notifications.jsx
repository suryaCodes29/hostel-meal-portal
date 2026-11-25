import { useCallback, useEffect, useState } from "react";
import { Bell, BellCheck, Check, RefreshCw } from "lucide-react";
import { staffRequest } from "../../services/staffApi";
import "./staffPages.css";

function formatCreatedAt(value) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function StaffNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await staffRequest("/api/staff/notifications");
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(Number(data.unreadCount || 0));
    } catch (requestError) {
      setError(requestError.message || "Unable to load Staff notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const markRead = async (notification) => {
    if (notification.isRead) return;
    setUpdating(true);
    setError("");
    try {
      await staffRequest(`/api/staff/notifications/${notification.id}/read`, {
        method: "PATCH",
      });
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item,
        ),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (requestError) {
      setError(requestError.message || "Unable to mark the notification as read.");
    } finally {
      setUpdating(false);
    }
  };

  const markAll = async () => {
    if (!unreadCount) return;
    setUpdating(true);
    setError("");
    try {
      await staffRequest("/api/staff/notifications/read-all", { method: "PATCH" });
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (requestError) {
      setError(requestError.message || "Unable to mark notifications as read.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <main className="staff-page">
      <header className="staff-page-header">
        <div className="staff-page-header-icon"><Bell size={22} /></div>
        <div>
          <h1>Notifications</h1>
          <p>Staff account updates, announcements, and Manager messages.</p>
        </div>
        <button className="staff-secondary-button" type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </header>

      <div className="staff-page-actions">
        <span className="staff-status-badge warning">{unreadCount} unread</span>
        <button className="staff-secondary-button" type="button" onClick={() => void markAll()} disabled={!unreadCount || updating}>
          <Check size={15} /> Mark all as read
        </button>
      </div>

      {error && <div className="staff-alert" role="alert">{error}</div>}

      {loading ? (
        <div className="staff-empty-state" role="status">Loading notifications…</div>
      ) : notifications.length ? (
        <section className="staff-notification-list" aria-label="Staff notifications">
          {notifications.map((notification) => (
            <article
              className={`staff-card staff-notification-card${notification.isRead ? "" : " unread"}`}
              key={notification.id}
            >
              <span className="staff-notification-icon">
                {notification.isRead ? <BellCheck size={19} /> : <Bell size={19} />}
              </span>
              <div className="staff-notification-copy">
                <div className="staff-notification-heading">
                  <h2>{notification.title}</h2>
                  <span className={`staff-status-badge${notification.isRead ? "" : " warning"}`}>
                    {notification.isRead ? "Read" : "Unread"}
                  </span>
                </div>
                <p>{notification.message}</p>
                <small>
                  {notification.type || "Staff update"} · {formatCreatedAt(notification.createdAt)}
                </small>
              </div>
              {!notification.isRead && (
                <button
                  className="staff-secondary-button"
                  type="button"
                  onClick={() => void markRead(notification)}
                  disabled={updating}
                >
                  <Check size={14} /> Mark read
                </button>
              )}
            </article>
          ))}
        </section>
      ) : (
        <div className="staff-empty-state">
          <Bell size={26} />
          <h2>You&apos;re all caught up</h2>
          <p>New notifications for your Staff account will appear here.</p>
        </div>
      )}
    </main>
  );
}
