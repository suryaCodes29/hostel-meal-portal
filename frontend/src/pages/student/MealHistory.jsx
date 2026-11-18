import "./MealHistory.css";
import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock3,
  RefreshCw,
  Download,
  Filter,
  Utensils,
  BarChart3,
  AlertCircle,
} from "lucide-react";

import studentApi from "../../services/studentApi";
import StudentAssignmentBanner from "../../components/student/StudentAssignmentBanner";

const MEALS = ["All", "Breakfast", "Lunch", "Dinner"];
const STATUSES = ["All", "Attended", "Skipped", "Not recorded"];

function parseDate(value) {
  if (!value) return null;

  const raw = String(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKey(value) {
  const date = parseDate(value);

  if (!date) return "";

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(value) {
  const date = parseDate(value);

  if (!date) return "—";

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getHistoryArray(response) {
  if (!response) return [];

  const data = response.data ?? response;

  if (Array.isArray(data)) return data;

  if (Array.isArray(data.history)) return data.history;

  if (Array.isArray(data.meal_history)) {
    return data.meal_history;
  }

  if (Array.isArray(data.data)) return data.data;

  if (Array.isArray(data.results)) return data.results;

  return [];
}

function normalizeStatus(value) {
  if (!value) return "Not recorded";

  const status = String(value).trim().toLowerCase();

  if (
    status === "attending" ||
    status === "attended" ||
    status === "present" ||
    status === "yes"
  ) {
    return "Attended";
  }

  if (
    status === "skipping" ||
    status === "skipped" ||
    status === "absent" ||
    status === "no"
  ) {
    return "Skipped";
  }

  return "Not recorded";
}

function normalizeItem(item) {
  const date =
    item.date ||
    item.menu_date ||
    item.meal_date ||
    item.serving_date ||
    item.served_date;

  const meal =
    item.meal ||
    item.meal_type ||
    item.mealType ||
    "";

  const status = normalizeStatus(
    item.status ||
      item.response ||
      item.meal_response ||
      item.attendance
  );

  const menu =
    item.menu_name ||
    item.menuName ||
    item.menu_title ||
    item.menu ||
    item.items ||
    "";

  return {
    id:
      item.id ||
      `${toDateKey(date)}-${meal}`,
    date,
    dateKey: toDateKey(date),
    meal,
    status,
    menu,
  };
}

function getDateInput(value) {
  const date = parseDate(value);

  return date ? toDateKey(date) : "";
}

function getDefaultFromDate() {
  const date = new Date();
  date.setDate(date.getDate() - 30);

  return toDateKey(date);
}

function getDefaultToDate() {
  return toDateKey(new Date());
}

function getMenuText(menu) {
  if (!menu) return "—";

  if (Array.isArray(menu)) {
    return menu
      .map((item) => {
        if (typeof item === "string") return item;

        return (
          item.name ||
          item.item_name ||
          item.menu_item_name ||
          ""
        );
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof menu === "object") {
    return (
      menu.name ||
      menu.title ||
      menu.menu_name ||
      "Published Menu"
    );
  }

  return String(menu);
}

function getWeekStart(date) {
  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  const day = result.getDay();

  result.setDate(result.getDate() - day);

  return result;
}

function buildWeeklyData(history) {
  const today = new Date();
  const currentWeekStart = getWeekStart(today);

  const weeks = [];

  for (let i = 5; i >= 0; i--) {
    const start = new Date(currentWeekStart);

    start.setDate(start.getDate() - i * 7);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    let attended = 0;
    let skipped = 0;

    history.forEach((item) => {
      const itemDate = parseDate(item.date);

      if (!itemDate) return;

      if (itemDate >= start && itemDate <= end) {
        if (item.status === "Attended") {
          attended++;
        }

        if (item.status === "Skipped") {
          skipped++;
        }
      }
    });

    weeks.push({
      label:
        start.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      attended,
      skipped,
      total: attended + skipped,
    });
  }

  return weeks;
}

export default function MealHistory() {
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [error, setError] = useState("");

  const [fromDate, setFromDate] = useState(
    getDefaultFromDate()
  );

  const [toDate, setToDate] = useState(
    getDefaultToDate()
  );

  const [mealFilter, setMealFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [page, setPage] = useState(1);

  const pageSize = 10;

  const loadHistory = async (showRefresh = false) => {
    try {
      setError("");

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await studentApi.getMealHistory({
        from: fromDate,
        to: toDate,
        meal: mealFilter !== "All" ? mealFilter : "",
        status:
          statusFilter !== "All" ? statusFilter : "",
      });

      const items = getHistoryArray(response)
        .map(normalizeItem)
        .filter((item) => item.dateKey);

      items.sort(
        (a, b) =>
          new Date(b.date) - new Date(a.date)
      );

      setHistory(items);
      setPage(1);
    } catch (err) {
      console.error("Student meal history error:", err);

      setError(
        err?.message ||
          "Unable to load your meal history."
      );

      setHistory([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      if (
        mealFilter !== "All" &&
        String(item.meal).toLowerCase() !==
          mealFilter.toLowerCase()
      ) {
        return false;
      }

      if (
        statusFilter !== "All" &&
        item.status !== statusFilter
      ) {
        return false;
      }

      if (fromDate && item.dateKey < fromDate) {
        return false;
      }

      if (toDate && item.dateKey > toDate) {
        return false;
      }

      return true;
    });
  }, [
    history,
    mealFilter,
    statusFilter,
    fromDate,
    toDate,
  ]);

  const summary = useMemo(() => {
    let attended = 0;
    let skipped = 0;
    let notRecorded = 0;

    filteredHistory.forEach((item) => {
      if (item.status === "Attended") {
        attended++;
      } else if (item.status === "Skipped") {
        skipped++;
      } else {
        notRecorded++;
      }
    });

    const recorded = attended + skipped;

    const attendancePercentage =
      recorded > 0
        ? Math.round((attended / recorded) * 100)
        : 0;

    return {
      attended,
      skipped,
      notRecorded,
      total: filteredHistory.length,
      recorded,
      attendancePercentage,
    };
  }, [filteredHistory]);

  const weeklyData = useMemo(
    () => buildWeeklyData(filteredHistory),
    [filteredHistory]
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredHistory.length / pageSize)
  );

  const paginatedHistory = useMemo(() => {
    const start = (page - 1) * pageSize;

    return filteredHistory.slice(
      start,
      start + pageSize
    );
  }, [filteredHistory, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const resetFilters = () => {
    setFromDate("");
    setToDate("");
    setMealFilter("All");
    setStatusFilter("All");
    setPage(1);
  };

  const handleApplyFilters = () => {
    setPage(1);
    loadHistory(true);
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      setError("");

      const response =
        await studentApi.downloadMealHistoryCsv({
          from: fromDate,
          to: toDate,
          meal:
            mealFilter !== "All"
              ? mealFilter
              : "",
          status:
            statusFilter !== "All"
              ? statusFilter
              : "",
        });

      if (response instanceof Blob) {
        const url = window.URL.createObjectURL(
          response
        );

        const link = document.createElement("a");

        link.href = url;
        link.download = `meal-history-${toDateKey(
          new Date()
        )}.csv`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        window.URL.revokeObjectURL(url);
        return;
      }

      if (
        response?.blob instanceof Blob
      ) {
        const url = window.URL.createObjectURL(
          response.blob
        );

        const link = document.createElement("a");

        link.href = url;
        link.download = `meal-history-${toDateKey(
          new Date()
        )}.csv`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(
        "Meal history CSV error:",
        err
      );

      setError(
        err?.message ||
          "Unable to download meal history."
      );
    } finally {
      setDownloading(false);
    }
  };

  const maxWeeklyValue = Math.max(
    1,
    ...weeklyData.map(
      (week) =>
        week.attended + week.skipped
    )
  );

  return (
    <div className="student-page student-meal-history-page">
      <div className="student-page-header">
        <div>
          <div className="student-page-title-row">
            <BarChart3 size={24} />
            <h1>Meal History</h1>
          </div>

          <p>
            View your personal meal attendance history
            and attendance trends.
          </p>
        </div>

        <button
          type="button"
          className="student-secondary-button"
          onClick={() => loadHistory(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={16}
            className={
              refreshing
                ? "student-spin"
                : ""
            }
          />
          Refresh
        </button>
      </div>

      <StudentAssignmentBanner />

      {error && (
        <div className="student-alert student-alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}

      <section className="student-history-filter-panel">
        <div className="student-history-filter-title">
          <div>
            <Filter size={17} />
            <span>History Filters</span>
          </div>

          <button
            type="button"
            onClick={resetFilters}
          >
            Clear Filters
          </button>
        </div>

        <div className="student-history-filters">
          <div className="student-filter-field">
            <label htmlFor="history-from">
              From Date
            </label>

            <input
              id="history-from"
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="student-filter-field">
            <label htmlFor="history-to">
              To Date
            </label>

            <input
              id="history-to"
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="student-filter-field">
            <label htmlFor="history-meal">
              Meal
            </label>

            <select
              id="history-meal"
              value={mealFilter}
              onChange={(event) => {
                setMealFilter(event.target.value);
                setPage(1);
              }}
            >
              {MEALS.map((meal) => (
                <option
                  key={meal}
                  value={meal}
                >
                  {meal}
                </option>
              ))}
            </select>
          </div>

          <div className="student-filter-field">
            <label htmlFor="history-status">
              Status
            </label>

            <select
              id="history-status"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              {STATUSES.map((status) => (
                <option
                  key={status}
                  value={status}
                >
                  {status}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="student-apply-filter-button"
            onClick={handleApplyFilters}
          >
            Apply
          </button>
        </div>
      </section>

      {/* Summary */}

      <div className="student-history-summary">
        <div className="student-history-summary-card">
          <div className="student-history-summary-icon attended">
            <CheckCircle2 size={20} />
          </div>

          <div>
            <span>Attended</span>
            <strong>{summary.attended}</strong>
          </div>
        </div>

        <div className="student-history-summary-card">
          <div className="student-history-summary-icon skipped">
            <XCircle size={20} />
          </div>

          <div>
            <span>Skipped</span>
            <strong>{summary.skipped}</strong>
          </div>
        </div>

        <div className="student-history-summary-card">
          <div className="student-history-summary-icon pending">
            <Clock3 size={20} />
          </div>

          <div>
            <span>Not Recorded</span>
            <strong>{summary.notRecorded}</strong>
          </div>
        </div>

        <div className="student-history-summary-card">
          <div className="student-history-summary-icon percentage">
            <BarChart3 size={20} />
          </div>

          <div>
            <span>Attendance</span>
            <strong>
              {summary.attendancePercentage}%
            </strong>
          </div>
        </div>
      </div>

      {/* Weekly chart */}

      <section className="student-history-chart-panel">
        <div className="student-history-section-header">
          <div>
            <h2>Weekly Attendance</h2>
            <p>
              Your attendance trend for the recent weeks.
            </p>
          </div>
        </div>

        <div className="student-weekly-chart">
          <div className="student-chart-y-axis">
            <span>{maxWeeklyValue}</span>
            <span>
              {Math.round(maxWeeklyValue / 2)}
            </span>
            <span>0</span>
          </div>

          <div className="student-chart-area">
            <div className="student-chart-grid-line top" />
            <div className="student-chart-grid-line middle" />
            <div className="student-chart-grid-line bottom" />

            <div className="student-chart-bars">
              {weeklyData.map((week, index) => {
                const totalHeight =
                  ((week.attended +
                    week.skipped) /
                    maxWeeklyValue) *
                  100;

                const attendedHeight =
                  week.attended /
                    Math.max(
                      1,
                      week.attended +
                        week.skipped
                    ) *
                  totalHeight;

                const skippedHeight =
                  week.skipped /
                    Math.max(
                      1,
                      week.attended +
                        week.skipped
                    ) *
                  totalHeight;

                return (
                  <div
                    className="student-chart-column"
                    key={`${week.label}-${index}`}
                  >
                    <div className="student-chart-value">
                      {week.total}
                    </div>

                    <div className="student-bar-container">
                      <div
                        className="student-chart-bar-attended"
                        style={{
                          height: `${attendedHeight}%`,
                        }}
                        title={`Attended: ${week.attended}`}
                      />

                      <div
                        className="student-chart-bar-skipped"
                        style={{
                          height: `${skippedHeight}%`,
                        }}
                        title={`Skipped: ${week.skipped}`}
                      />
                    </div>

                    <span>
                      {week.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="student-chart-legend">
          <span>
            <i className="attended" />
            Attended
          </span>

          <span>
            <i className="skipped" />
            Skipped
          </span>
        </div>
      </section>

      {/* History table */}

      <section className="student-history-table-panel">
        <div className="student-history-section-header">
          <div>
            <h2>Meal History</h2>
            <p>
              {filteredHistory.length} record
              {filteredHistory.length !== 1
                ? "s"
                : ""}{" "}
              found.
            </p>
          </div>

          <button
            type="button"
            className="student-download-button"
            onClick={handleDownload}
            disabled={
              downloading ||
              filteredHistory.length === 0
            }
          >
            {downloading ? (
              <RefreshCw
                size={15}
                className="student-spin"
              />
            ) : (
              <Download size={15} />
            )}

            {downloading
              ? "Downloading..."
              : "Download CSV"}
          </button>
        </div>

        {loading ? (
          <div className="student-history-loading">
            <RefreshCw
              size={22}
              className="student-spin"
            />
            <span>
              Loading meal history...
            </span>
          </div>
        ) : paginatedHistory.length === 0 ? (
          <div className="student-history-empty">
            <div className="student-history-empty-icon">
              <Utensils size={27} />
            </div>

            <h3>No meal history found</h3>

            <p>
              No meal records match your selected
              date range and filters.
            </p>
          </div>
        ) : (
          <>
            <div className="student-history-table-wrapper">
              <table className="student-history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Meal</th>
                    <th>Menu</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedHistory.map(
                    (item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="student-history-date">
                            <CalendarDays size={14} />
                            {formatDate(
                              item.date
                            )}
                          </div>
                        </td>

                        <td>
                          <span className="student-history-meal">
                            {item.meal ||
                              "—"}
                          </span>
                        </td>

                        <td>
                          <div className="student-history-menu">
                            {getMenuText(
                              item.menu
                            )}
                          </div>
                        </td>

                        <td>
                          {item.status ===
                          "Attended" ? (
                            <span className="student-history-status attended">
                              <CheckCircle2
                                size={14}
                              />
                              Attended
                            </span>
                          ) : item.status ===
                            "Skipped" ? (
                            <span className="student-history-status skipped">
                              <XCircle
                                size={14}
                              />
                              Skipped
                            </span>
                          ) : (
                            <span className="student-history-status not-recorded">
                              <Clock3
                                size={14}
                              />
                              Not recorded
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="student-history-pagination">
              <span>
                Showing{" "}
                {(page - 1) * pageSize + 1}–
                {Math.min(
                  page * pageSize,
                  filteredHistory.length
                )}{" "}
                of {filteredHistory.length}
              </span>

              <div>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.max(1, current - 1)
                    )
                  }
                >
                  Previous
                </button>

                <span className="student-page-number">
                  {page} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={
                    page >= totalPages
                  }
                  onClick={() =>
                    setPage(
                      (current) =>
                        Math.min(
                          totalPages,
                          current + 1
                        )
                    )
                  }
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <div className="student-history-note">
        <AlertCircle size={15} />
        <span>
          This history contains only your own meal
          records. Other students' attendance data is
          never displayed.
        </span>
      </div>
    </div>
  );
}

