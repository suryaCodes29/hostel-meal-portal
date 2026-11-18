import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Circle,
  CalendarDays,
  Utensils,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  Clock3,
  AlertCircle,
} from "lucide-react";

import { studentApi } from "../../services/studentApi";
import "./Responses.css";

const PAGE_SIZE = 10;

const normalizeResponse = (value) => {
  const text = String(value || "").toLowerCase();

  if (
    text === "attending" ||
    text === "attend" ||
    text === "yes" ||
    text === "present"
  ) {
    return "attending";
  }

  if (
    text === "skipping" ||
    text === "skip" ||
    text === "no" ||
    text === "absent"
  ) {
    return "skipping";
  }

  return "not_recorded";
};

const normalizeResponseItem = (item) => {
  const response = normalizeResponse(
    item?.response ||
      item?.status ||
      item?.meal_response ||
      item?.student_response
  );

  return {
    id:
      item?.id ||
      item?.response_id ||
      item?.meal_response_id,

    menuId:
      item?.menu_id ||
      item?.menuId,

    date:
      item?.date ||
      item?.meal_date ||
      item?.menu_date ||
      "",

    meal:
      item?.meal ||
      item?.meal_type ||
      item?.meal_category ||
      item?.meal_name ||
      "Meal",

    menuName:
      item?.menu_name ||
      item?.menuName ||
      item?.title ||
      item?.name ||
      "",

    response,

    responseAt:
      item?.response_at ||
      item?.responded_at ||
      item?.created_at ||
      item?.updated_at ||
      "",

    servingTime:
      item?.serving_time ||
      item?.servingTime ||
      item?.time ||
      "",
  };
};

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusText = (status) => {
  if (status === "attending") return "Attending";
  if (status === "skipping") return "Skipping";
  return "Not Recorded";
};

const getStatusIcon = (status) => {
  if (status === "attending") {
    return <CheckCircle2 size={16} />;
  }

  if (status === "skipping") {
    return <XCircle size={16} />;
  }

  return <Circle size={16} />;
};

export default function Responses() {
  const [responses, setResponses] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mealFilter, setMealFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);

  const loadResponses = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const result = await studentApi.getResponses();

      const rawData =
        result?.responses ||
        result?.data ||
        result?.results ||
        result?.result ||
        [];

      const normalized = Array.isArray(rawData)
        ? rawData.map(normalizeResponseItem)
        : [];

      setResponses(normalized);
    } catch (err) {
      console.error(
        "Failed to load student responses:",
        err
      );

      setError(
        err?.message ||
          "Unable to load your meal responses."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadResponses();
  }, []);

  const mealTypes = useMemo(() => {
    const values = responses
      .map((item) => item.meal)
      .filter(Boolean);

    return [...new Set(values)];
  }, [responses]);

  const filteredResponses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return responses.filter((item) => {
      const matchesSearch =
        !query ||
        String(item.meal)
          .toLowerCase()
          .includes(query) ||
        String(item.menuName)
          .toLowerCase()
          .includes(query) ||
        String(item.date)
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        item.response === statusFilter;

      const matchesMeal =
        mealFilter === "all" ||
        String(item.meal).toLowerCase() ===
          mealFilter.toLowerCase();

      return (
        matchesSearch &&
        matchesStatus &&
        matchesMeal
      );
    });
  }, [
    responses,
    search,
    statusFilter,
    mealFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredResponses.length / PAGE_SIZE
    )
  );

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages
  );

  const paginatedResponses = useMemo(() => {
    const start =
      (safeCurrentPage - 1) * PAGE_SIZE;

    return filteredResponses.slice(
      start,
      start + PAGE_SIZE
    );
  }, [
    filteredResponses,
    safeCurrentPage,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, mealFilter]);

  const statistics = useMemo(() => {
    const attending = responses.filter(
      (item) => item.response === "attending"
    ).length;

    const skipping = responses.filter(
      (item) => item.response === "skipping"
    ).length;

    const notRecorded = responses.filter(
      (item) => item.response === "not_recorded"
    ).length;

    return {
      total: responses.length,
      attending,
      skipping,
      notRecorded,
    };
  }, [responses]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setMealFilter("all");
    setCurrentPage(1);
  };

  return (
    <div className="student-responses-page">

      {/* HEADER */}
      <div className="student-responses-header">

        <div>
          <span className="student-responses-label">
            MEAL ACTIVITY
          </span>

          <h1>My Responses</h1>

          <p>
            View and track all your meal attendance
            responses.
          </p>
        </div>

        <button
          type="button"
          className="student-responses-refresh"
          onClick={() => loadResponses(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={17}
            className={
              refreshing
                ? "student-responses-spin"
                : ""
            }
          />
          Refresh
        </button>

      </div>

      {/* ERROR */}
      {error && (
        <div className="student-responses-alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* STATISTICS */}
      <div className="student-response-stats">

        <div className="student-response-stat">
          <div className="student-response-stat-icon total">
            <Utensils size={20} />
          </div>

          <div>
            <span>Total Responses</span>
            <strong>{statistics.total}</strong>
          </div>
        </div>

        <div className="student-response-stat">
          <div className="student-response-stat-icon attend">
            <CheckCircle2 size={20} />
          </div>

          <div>
            <span>Attending</span>
            <strong>{statistics.attending}</strong>
          </div>
        </div>

        <div className="student-response-stat">
          <div className="student-response-stat-icon skip">
            <XCircle size={20} />
          </div>

          <div>
            <span>Skipping</span>
            <strong>{statistics.skipping}</strong>
          </div>
        </div>

        <div className="student-response-stat">
          <div className="student-response-stat-icon pending">
            <Circle size={20} />
          </div>

          <div>
            <span>Not Recorded</span>
            <strong>{statistics.notRecorded}</strong>
          </div>
        </div>

      </div>

      {/* FILTER CARD */}
      <section className="student-response-filter-card">

        <div className="student-response-filter-title">
          <Filter size={18} />
          <div>
            <h2>Response History</h2>
            <p>
              Search and filter your previous meal responses.
            </p>
          </div>
        </div>

        <div className="student-response-filters">

          <div className="student-response-search">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search meal, menu or date..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
          >
            <option value="all">
              All Status
            </option>

            <option value="attending">
              Attending
            </option>

            <option value="skipping">
              Skipping
            </option>

            <option value="not_recorded">
              Not Recorded
            </option>
          </select>

          <select
            value={mealFilter}
            onChange={(e) =>
              setMealFilter(e.target.value)
            }
          >
            <option value="all">
              All Meals
            </option>

            {mealTypes.map((meal) => (
              <option
                value={meal}
                key={meal}
              >
                {meal}
              </option>
            ))}
          </select>

          {(search ||
            statusFilter !== "all" ||
            mealFilter !== "all") && (
            <button
              type="button"
              className="student-clear-filter"
              onClick={clearFilters}
            >
              Clear
            </button>
          )}

        </div>

      </section>

      {/* TABLE */}
      <section className="student-response-table-card">

        {loading ? (
          <div className="student-response-loading">
            <RefreshCw
              size={28}
              className="student-responses-spin"
            />

            <span>
              Loading responses...
            </span>
          </div>
        ) : paginatedResponses.length === 0 ? (
          <div className="student-response-empty">

            <div className="student-response-empty-icon">
              <Utensils size={28} />
            </div>

            <h3>
              No responses found
            </h3>

            <p>
              {responses.length === 0
                ? "You have not submitted any meal responses yet."
                : "No responses match your current filters."}
            </p>

            {responses.length > 0 && (
              <button
                type="button"
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            )}

          </div>
        ) : (
          <>
            <div className="student-response-table-wrapper">

              <table className="student-response-table">

                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Meal</th>
                    <th>Menu</th>
                    <th>Serving Time</th>
                    <th>Response</th>
                    <th>Responded At</th>
                  </tr>
                </thead>

                <tbody>

                  {paginatedResponses.map(
                    (item, index) => (
                      <tr
                        key={
                          item.id ||
                          `${item.date}-${item.meal}-${index}`
                        }
                      >

                        <td>
                          <div className="student-response-date">
                            <CalendarDays size={15} />

                            <span>
                              {formatDate(
                                item.date
                              )}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="student-response-meal">
                            <div>
                              <Utensils size={15} />
                            </div>

                            <strong>
                              {item.meal}
                            </strong>
                          </div>
                        </td>

                        <td>
                          <span className="student-response-menu-name">
                            {item.menuName ||
                              "Published Menu"}
                          </span>
                        </td>

                        <td>
                          {item.servingTime ? (
                            <div className="student-response-time">
                              <Clock3 size={14} />
                              {item.servingTime}
                            </div>
                          ) : (
                            <span className="student-response-muted">
                              —
                            </span>
                          )}
                        </td>

                        <td>
                          <span
                            className={`student-response-status ${item.response}`}
                          >
                            {getStatusIcon(
                              item.response
                            )}

                            {getStatusText(
                              item.response
                            )}
                          </span>
                        </td>

                        <td>
                          <span className="student-response-datetime">
                            {formatDateTime(
                              item.responseAt
                            )}
                          </span>
                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>

            {/* PAGINATION */}
            <div className="student-response-pagination">

              <span>
                Showing{" "}
                <strong>
                  {filteredResponses.length === 0
                    ? 0
                    : (safeCurrentPage - 1) *
                        PAGE_SIZE +
                      1}
                </strong>
                {" "}–{" "}
                <strong>
                  {Math.min(
                    safeCurrentPage * PAGE_SIZE,
                    filteredResponses.length
                  )}
                </strong>
                {" "}of{" "}
                <strong>
                  {filteredResponses.length}
                </strong>
              </span>

              <div className="student-pagination-buttons">

                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.max(
                          1,
                          page - 1
                        )
                    )
                  }
                >
                  <ChevronLeft size={16} />
                </button>

                <span className="student-page-number">
                  {safeCurrentPage}
                </span>

                <button
                  type="button"
                  disabled={
                    safeCurrentPage >=
                    totalPages
                  }
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.min(
                          totalPages,
                          page + 1
                        )
                    )
                  }
                >
                  <ChevronRight size={16} />
                </button>

              </div>

            </div>
          </>
        )}

      </section>

    </div>
  );
}