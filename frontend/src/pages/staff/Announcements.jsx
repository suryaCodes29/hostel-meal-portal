import { useCallback, useEffect, useState } from "react";
import { Bell, CalendarDays, Megaphone, RefreshCw } from "lucide-react";
import { staffRequest } from "../../services/staffApi";
import "./staffPages.css";

function formatPublishedAt(value) {
  if (!value) return "Publish time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Publish time unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function StaffAnnouncements() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [readingId, setReadingId] = useState(null);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const data = await staffRequest("/api/staff/announcements");
      setRows(Array.isArray(data.announcements) ? data.announcements : []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load Manager announcements.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const markRead = async (announcement) => {
    if (announcement.isRead) return;
    setReadingId(announcement.id);
    setError("");
    try {
      await staffRequest(`/api/staff/announcements/${announcement.id}/read`, {
        method: "PATCH",
      });
      setRows((current) =>
        current.map((row) =>
          row.id === announcement.id ? { ...row, isRead: true } : row,
        ),
      );
    } catch (requestError) {
      setError(requestError.message || "Unable to update announcement status.");
    } finally {
      setReadingId(null);
    }
  };

  return (
    <main className="staff-page">
      <header className="staff-page-header">
        <div className="staff-page-header-icon"><Megaphone size={22} /></div>
        <div>
          <h1>Announcements</h1>
          <p>Updates published by your Manager for your authorized assignment.</p>
        </div>
        <button
          className="staff-secondary-button"
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh announcements"
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </header>

      {error && <div className="staff-alert" role="alert">{error}</div>}

      {loading ? (
        <div className="staff-empty-state" role="status">Loading announcements…</div>
      ) : rows.length ? (
        <section className="staff-announcement-list" aria-label="Manager announcements">
          {rows.map((row) => (
            <article
              className={`staff-card staff-announcement-card${row.isRead ? "" : " unread"}`}
              key={row.id}
            >
              <div className="staff-announcement-card-header">
                <h2>{row.title}</h2>
                <span className={`staff-status-badge${row.isRead ? "" : " warning"}`}>
                  {row.isRead ? "Read" : "Unread"}
                </span>
              </div>
              <p>{row.message}</p>
              <div className="staff-announcement-meta">
                <span className="staff-status-badge warning">
                  {row.priority || "Announcement"}
                </span>
                <span><CalendarDays size={14} /> {formatPublishedAt(row.publishedAt)}</span>
                {!row.isRead && (
                  <button
                    className="staff-secondary-button"
                    type="button"
                    onClick={() => void markRead(row)}
                    disabled={readingId === row.id}
                  >
                    <Bell size={14} />
                    {readingId === row.id ? "Updating…" : "Mark as read"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="staff-empty-state">
          <Megaphone size={26} />
          <h2>No announcements yet</h2>
          <p>Manager announcements for your hostel and mess assignment will appear here.</p>
        </div>
      )}
    </main>
  );
}
