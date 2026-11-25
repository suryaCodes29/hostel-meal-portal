import React, { useEffect, useMemo, useState } from "react";
import {
  Megaphone,
  Search,
  Filter,
  CalendarDays,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Bell,
  ChevronDown,
  RefreshCw,
  X,
} from "lucide-react";


import StudentAssignmentBanner from "../../components/student/StudentAssignmentBanner";
import studentApi from "../../services/studentApi";

import "./Announcements.css";

const FILTER_OPTIONS = [
  { value: "all", label: "All Announcements" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: "general", label: "General" },
  { value: "meal", label: "Meal" },
  { value: "hostel", label: "Hostel" },
  { value: "important", label: "Important" },
];

function normalizeAnnouncement(item, index) {
  const announcement = item || {};

  const id =
    announcement.id ??
    announcement.announcement_id ??
    announcement.announcementId ??
    `announcement-${index}`;

  const title =
    announcement.title ||
    announcement.heading ||
    announcement.name ||
    "Announcement";

  const message =
    announcement.message ||
    announcement.description ||
    announcement.content ||
    "";

  const category =
    String(
      announcement.category ||
        announcement.type ||
        announcement.announcement_type ||
        "general"
    ).toLowerCase();

  const createdAt =
    announcement.created_at ||
    announcement.createdAt ||
    announcement.published_at ||
    announcement.date ||
    null;

  const isRead =
    announcement.is_read ??
    announcement.isRead ??
    announcement.read ??
    false;

  const priority =
    String(
      announcement.priority ||
        announcement.level ||
        (category === "important" ? "high" : "normal")
    ).toLowerCase();

  return {
    ...announcement,
    id,
    title,
    message,
    category,
    createdAt,
    isRead: Boolean(isRead),
    priority,
  };
}

function formatDate(dateValue) {
  if (!dateValue) return "Date not available";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateValue) {
  if (!dateValue) return "Date not available";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return String(dateValue);
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCategoryLabel(category) {
  const labels = {
    general: "General",
    meal: "Meal",
    hostel: "Hostel",
    important: "Important",
  };

  return labels[category] || "General";
}

function getCategoryClass(category) {
  if (category === "meal") return "meal";
  if (category === "hostel") return "hostel";
  if (category === "important") return "important";
  return "general";
}

function getPriorityClass(priority) {
  if (priority === "high" || priority === "urgent") return "high";
  if (priority === "medium") return "medium";
  return "normal";
}

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [readFilter, setReadFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [showFilters, setShowFilters] = useState(false);

  const loadAnnouncements = async (showRefresh = false) => {
    try {
      setError("");

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await studentApi.getAnnouncements();

      const data =
        response?.announcements ||
        response?.data?.announcements ||
        response?.data ||
        response?.result ||
        response ||
        [];

      const list = Array.isArray(data) ? data : [];

      setAnnouncements(list.map(normalizeAnnouncement));
    } catch (err) {
      console.error("Failed to load announcements:", err);

      setError(
        err?.message ||
          "Unable to load announcements. Please try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
    const refreshTimer = window.setInterval(() => {
      loadAnnouncements(true);
    }, 60000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  const filteredAnnouncements = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return announcements.filter((announcement) => {
      const matchesSearch =
        !query ||
        announcement.title.toLowerCase().includes(query) ||
        announcement.message.toLowerCase().includes(query) ||
        announcement.category.toLowerCase().includes(query);

      const matchesRead =
        readFilter === "all" ||
        (readFilter === "unread" && !announcement.isRead) ||
        (readFilter === "read" && announcement.isRead);

      const matchesCategory =
        categoryFilter === "all" ||
        announcement.category === categoryFilter;

      return matchesSearch && matchesRead && matchesCategory;
    });
  }, [
    announcements,
    searchTerm,
    readFilter,
    categoryFilter,
  ]);

  const unreadCount = announcements.filter(
    (announcement) => !announcement.isRead
  ).length;

  const importantCount = announcements.filter(
    (announcement) => announcement.category === "important"
  ).length;

  const mealCount = announcements.filter(
    (announcement) => announcement.category === "meal"
  ).length;

  const handleOpenAnnouncement = async (announcement) => {
    setSelectedAnnouncement(announcement);

    if (announcement.isRead) {
      return;
    }

    try {
      await studentApi.markAnnouncementRead(announcement.id);

      setAnnouncements((previous) =>
        previous.map((item) =>
          item.id === announcement.id
            ? { ...item, isRead: true }
            : item
        )
      );

      setSelectedAnnouncement((previous) =>
        previous
          ? {
              ...previous,
              isRead: true,
            }
          : previous
      );
    } catch (err) {
      console.error("Failed to mark announcement as read:", err);
    }
  };

  const handleCloseAnnouncement = () => {
    setSelectedAnnouncement(null);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setReadFilter("all");
    setCategoryFilter("all");
  };

  return (
      <div className="student-announcements-page">
        <div className="announcements-container">

          {/* Page Header */}
          <div className="announcements-page-header">
            <div>
              <div className="announcements-title-row">
                <div className="announcements-title-icon">
                  <Megaphone size={24} />
                </div>

                <div>
                  <h1>Announcements</h1>
                  <p>
                    Stay updated with important hostel and meal
                    information.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="announcements-refresh-btn"
              onClick={() => loadAnnouncements(true)}
              disabled={refreshing}
            >
              <RefreshCw
                size={17}
                className={refreshing ? "refresh-spinning" : ""}
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {/* Assignment Banner */}
          <StudentAssignmentBanner />

          {/* Summary Cards */}
          <div className="announcement-summary-grid">

            <div className="announcement-summary-card">
              <div className="summary-icon total">
                <Bell size={21} />
              </div>

              <div>
                <span>Total</span>
                <strong>{announcements.length}</strong>
              </div>
            </div>

            <div className="announcement-summary-card">
              <div className="summary-icon unread">
                <AlertCircle size={21} />
              </div>

              <div>
                <span>Unread</span>
                <strong>{unreadCount}</strong>
              </div>
            </div>

            <div className="announcement-summary-card">
              <div className="summary-icon important">
                <Megaphone size={21} />
              </div>

              <div>
                <span>Important</span>
                <strong>{importantCount}</strong>
              </div>
            </div>

            <div className="announcement-summary-card">
              <div className="summary-icon meal">
                <CalendarDays size={21} />
              </div>

              <div>
                <span>Meal Updates</span>
                <strong>{mealCount}</strong>
              </div>
            </div>

          </div>

          {/* Search + Filters */}
          <div className="announcement-toolbar">

            <div className="announcement-search">
              <Search size={18} />

              <input
                type="text"
                placeholder="Search announcements..."
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
              />

              {searchTerm && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <button
              type="button"
              className={`filter-toggle-btn ${
                showFilters ? "active" : ""
              }`}
              onClick={() =>
                setShowFilters((previous) => !previous)
              }
            >
              <Filter size={17} />
              Filters
              <ChevronDown
                size={16}
                className={
                  showFilters ? "filter-chevron rotated" : "filter-chevron"
                }
              />
            </button>

          </div>

          {showFilters && (
            <div className="announcement-filter-panel">

              <div className="announcement-filter-field">
                <label>Read Status</label>

                <select
                  value={readFilter}
                  onChange={(event) =>
                    setReadFilter(event.target.value)
                  }
                >
                  {FILTER_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="announcement-filter-field">
                <label>Category</label>

                <select
                  value={categoryFilter}
                  onChange={(event) =>
                    setCategoryFilter(event.target.value)
                  }
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="clear-filter-btn"
                onClick={clearFilters}
              >
                Clear Filters
              </button>

            </div>
          )}

          {/* Error */}
          {error && (
            <div className="announcement-error">
              <AlertCircle size={19} />

              <div>
                <strong>Unable to load announcements</strong>
                <span>{error}</span>
              </div>

              <button
                type="button"
                onClick={() => loadAnnouncements()}
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="announcement-loading">

              {[1, 2, 3].map((item) => (
                <div
                  className="announcement-skeleton-card"
                  key={item}
                >
                  <div className="skeleton-line skeleton-small" />
                  <div className="skeleton-line skeleton-title" />
                  <div className="skeleton-line" />
                  <div className="skeleton-line skeleton-medium" />
                </div>
              ))}

            </div>
          ) : filteredAnnouncements.length === 0 ? (

            /* Empty */
            <div className="announcement-empty">

              <div className="empty-icon">
                <Megaphone size={32} />
              </div>

              <h3>
                {announcements.length === 0
                  ? "No announcements yet"
                  : "No matching announcements"}
              </h3>

              <p>
                {announcements.length === 0
                  ? "There are currently no announcements available for you."
                  : "Try changing your search or filters."}
              </p>

              {announcements.length > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="empty-clear-btn"
                >
                  Clear Filters
                </button>
              )}

            </div>
          ) : (

            /* Announcement List */
            <div className="announcement-list">

              <div className="announcement-list-header">
                <div>
                  <h2>Latest Announcements</h2>
                  <span>
                    Showing {filteredAnnouncements.length} of{" "}
                    {announcements.length}
                  </span>
                </div>

                {unreadCount > 0 && (
                  <span className="unread-badge">
                    {unreadCount} unread
                  </span>
                )}
              </div>

              {filteredAnnouncements.map((announcement) => (

                <button
                  type="button"
                  key={announcement.id}
                  className={`announcement-card ${
                    announcement.isRead ? "read" : "unread"
                  }`}
                  onClick={() =>
                    handleOpenAnnouncement(announcement)
                  }
                >

                  <div
                    className={`announcement-card-icon ${getCategoryClass(
                      announcement.category
                    )}`}
                  >
                    {announcement.category === "meal" ? (
                      <CalendarDays size={22} />
                    ) : announcement.category === "hostel" ? (
                      <Bell size={22} />
                    ) : announcement.category === "important" ? (
                      <AlertCircle size={22} />
                    ) : (
                      <Megaphone size={22} />
                    )}
                  </div>

                  <div className="announcement-card-content">

                    <div className="announcement-card-top">

                      <div className="announcement-card-badges">

                        <span
                          className={`announcement-category ${getCategoryClass(
                            announcement.category
                          )}`}
                        >
                          {getCategoryLabel(
                            announcement.category
                          )}
                        </span>

                        {announcement.priority === "high" ||
                        announcement.priority === "urgent" ? (
                          <span className="announcement-priority">
                            Important
                          </span>
                        ) : null}

                        {!announcement.isRead && (
                          <span className="new-badge">
                            New
                          </span>
                        )}

                      </div>

                      <span className="announcement-date">
                        <Clock3 size={14} />
                        {formatDate(
                          announcement.createdAt
                        )}
                      </span>

                    </div>

                    <h3>{announcement.title}</h3>

                    <p>
                      {announcement.message.length > 180
                        ? `${announcement.message.slice(
                            0,
                            180
                          )}...`
                        : announcement.message}
                    </p>

                    <div className="announcement-card-footer">
                      <span>
                        {announcement.createdAt
                          ? formatDateTime(
                              announcement.createdAt
                            )
                          : "Recently published"}
                      </span>

                      <span className="view-details">
                        View details →
                      </span>
                    </div>

                  </div>

                  {!announcement.isRead && (
                    <span
                      className="unread-dot"
                      aria-label="Unread"
                    />
                  )}

                </button>

              ))}

            </div>
          )}

        </div>

      {/* Details Modal */}
      {selectedAnnouncement && (
        <div
          className="announcement-modal-backdrop"
          onClick={handleCloseAnnouncement}
        >
          <div
            className="announcement-modal"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="announcement-modal-header">
              <div
                className={`modal-icon ${getCategoryClass(
                  selectedAnnouncement.category
                )}`}
              >
                <Megaphone size={23} />
              </div>

              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseAnnouncement}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="announcement-modal-body">
              <div className="modal-badge-row">
                <span
                  className={`announcement-category ${getCategoryClass(
                    selectedAnnouncement.category
                  )}`}
                >
                  {getCategoryLabel(selectedAnnouncement.category)}
                </span>

                {selectedAnnouncement.isRead && (
                  <span className="modal-read-status">
                    <CheckCircle2 size={14} />
                    Read
                  </span>
                )}
              </div>

              <h2>{selectedAnnouncement.title}</h2>

              <div className="modal-date">
                <CalendarDays size={15} />
                {formatDateTime(selectedAnnouncement.createdAt)}
              </div>

              <div className="modal-message">
                {selectedAnnouncement.message
                  .split("\n")
                  .map((paragraph, index) => (
                    <p key={index}>{paragraph || "\u00A0"}</p>
                  ))}
              </div>

              <div className="modal-footer">
                <span>
                  {selectedAnnouncement.isRead
                    ? "You have read this announcement."
                    : "Announcement marked as read."}
                </span>

                <button
                  type="button"
                  onClick={handleCloseAnnouncement}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}