import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  History,
  RefreshCw,
  Search,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { staffRequest } from "../../services/staffApi";
import "./staffPages.css";

const IST = "Asia/Kolkata";
const PAGE_SIZE = 10;

function parseServerDate(value) {
  if (!value) return null;
  const text = String(value);
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(text);
  const date = new Date(hasTimezone ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function istDateValue(value) {
  const date = parseServerDate(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatIstDate(value) {
  const date = parseServerDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    dateStyle: "medium",
  }).format(date);
}

function formatIstTime(value) {
  const date = parseServerDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeCategory(value) {
  return String(value || "").trim().toLowerCase().replace("_", "-");
}

export default function AttendanceHistory() {
  const [rows, setRows] = useState([]);
  const [profile, setProfile] = useState(null);
  const [meal, setMeal] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (meal) params.set("meal", meal);
    if (search.trim()) params.set("search", search.trim());
    const query = params.toString();
    try {
      const [historyData, profileData] = await Promise.all([
        staffRequest(`/api/staff/attendance/history${query ? `?${query}` : ""}`),
        staffRequest("/api/staff/profile"),
      ]);
      setRows(Array.isArray(historyData.records) ? historyData.records : []);
      setProfile(profileData.profile || null);
    } catch (requestError) {
      setError(requestError.message || "Unable to load attendance history.");
    } finally {
      setLoading(false);
    }
  }, [meal, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const availableCategories = useMemo(() => {
    const categories = new Set(
      rows.map((row) => normalizeCategory(row.mealCategory)).filter(Boolean),
    );
    if (profile?.mealCategory && normalizeCategory(profile.mealCategory) !== "both") {
      categories.add(normalizeCategory(profile.mealCategory));
    }
    return [...categories].sort();
  }, [rows, profile]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const scanDate = istDateValue(row.scanTime);
    const category = normalizeCategory(row.mealCategory);
    const status = String(row.verificationStatus || "approved").toLowerCase();
    if (fromDate && (!scanDate || scanDate < fromDate)) return false;
    if (toDate && (!scanDate || scanDate > toDate)) return false;
    if (statusFilter === "verified" && status !== "approved") return false;
    if (categoryFilter !== "all" && category !== categoryFilter) return false;
    return true;
  }), [rows, fromDate, toDate, statusFilter, categoryFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const visiblePage = Math.min(page, pageCount);
  const visibleRows = filteredRows.slice(
    (visiblePage - 1) * PAGE_SIZE,
    visiblePage * PAGE_SIZE,
  );
  const verifiedCount = filteredRows.filter(
    (row) => String(row.verificationStatus || "approved").toLowerCase() === "approved",
  ).length;

  return (
    <main className="staff-page">
      <header className="staff-page-header">
        <div className="staff-page-header-icon"><History size={22} /></div>
        <div>
          <h1>Attendance History</h1>
          <p>Review approved QR scans for your assigned hostel, mess, and food category.</p>
        </div>
        <button
          className="staff-secondary-button"
          type="button"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </header>

      {error && <div className="staff-alert" role="alert">{error}</div>}

      <section className="staff-data-toolbar staff-card" aria-label="Attendance filters">
        <label className="staff-field">
          Search student
          <span className="staff-filter-input">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Name or Student ID"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </span>
        </label>
        <label className="staff-field">
          From scan date
          <input type="date" value={fromDate} onChange={(event) => {
            setFromDate(event.target.value);
            setPage(1);
          }} />
        </label>
        <label className="staff-field">
          To scan date
          <input type="date" value={toDate} onChange={(event) => {
            setToDate(event.target.value);
            setPage(1);
          }} />
        </label>
        <label className="staff-field">
          Meal
          <select value={meal} onChange={(event) => {
            setMeal(event.target.value);
            setPage(1);
          }}>
            <option value="">All meals</option>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="snacks">Snacks</option>
            <option value="dinner">Dinner</option>
          </select>
        </label>
        <label className="staff-field">
          Attendance status
          <span className="staff-filter-input">
            <Filter size={15} aria-hidden="true" />
            <select value={statusFilter} onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}>
              <option value="all">All statuses</option>
              <option value="verified">Verified</option>
            </select>
          </span>
        </label>
        <label className="staff-field">
          Food category
          <span className="staff-filter-input">
            <Filter size={15} aria-hidden="true" />
            <select value={categoryFilter} onChange={(event) => {
              setCategoryFilter(event.target.value);
              setPage(1);
            }}>
              <option value="all">All assigned categories</option>
              {availableCategories.map((category) => (
                <option key={category} value={category}>{category.toUpperCase()}</option>
              ))}
            </select>
          </span>
        </label>
      </section>

      <section className="staff-history-summary" aria-label="Attendance summary">
        <article className="staff-card">
          <div className="staff-summary-label"><span>Total records</span><UsersRound size={18} /></div>
          <strong>{loading ? "—" : filteredRows.length}</strong>
          <small>Within selected filters</small>
        </article>
        <article className="staff-card">
          <div className="staff-summary-label"><span>Verified scans</span><BadgeCheck size={18} /></div>
          <strong>{loading ? "—" : verifiedCount}</strong>
          <small>Approved attendance</small>
        </article>
        <article className="staff-card">
          <div className="staff-summary-label"><span>Assigned food category</span><ShieldCheck size={18} /></div>
          <strong>{profile?.mealCategory ? profile.mealCategory.toUpperCase() : "—"}</strong>
          <small>Manager controlled</small>
        </article>
      </section>

      <section className="staff-card staff-data-card">
        <div className="staff-data-table-wrap">
          <table className="staff-data-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Student ID</th>
                <th>Meal</th>
                <th>Food Category</th>
                <th>Attendance Status</th>
                <th>Scan Date (IST)</th>
                <th>Scan Time (IST)</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.verificationId}>
                  <td className="staff-table-primary">{row.studentName || "—"}</td>
                  <td>{row.studentId || "—"}</td>
                  <td>{row.meal || "—"}</td>
                  <td>{row.mealCategory ? row.mealCategory.toUpperCase() : "—"}</td>
                  <td><span className="staff-status-badge success"><BadgeCheck size={13} /> Verified</span></td>
                  <td>{formatIstDate(row.scanTime)}</td>
                  <td>{formatIstTime(row.scanTime)}</td>
                </tr>
              ))}
              {!loading && !visibleRows.length && (
                <tr>
                  <td className="staff-table-empty" colSpan={7}>
                    No attendance records match the selected filters.
                  </td>
                </tr>
              )}
              {loading && (
                <tr><td className="staff-table-empty" colSpan={7}>Loading authorized attendance…</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="staff-page-pagination">
          <span>{filteredRows.length} matching record{filteredRows.length === 1 ? "" : "s"} · Times shown in IST</span>
          <div className="staff-pagination-controls">
            <button
              className="staff-secondary-button"
              type="button"
              onClick={() => setPage((current) => Math.max(1, Math.min(current, pageCount) - 1))}
              disabled={visiblePage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft size={15} /> Previous
            </button>
            <span>Page {visiblePage} of {pageCount}</span>
            <button
              className="staff-secondary-button"
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, Math.min(current, pageCount) + 1))}
              disabled={visiblePage >= pageCount}
              aria-label="Next page"
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </footer>
      </section>

      {!loading && !error && !rows.length && (
        <div className="staff-empty-state">
          <CalendarDays size={25} />
          <h2>No attendance history yet</h2>
          <p>Approved scans for your Manager-assigned hostel and category will appear here.</p>
        </div>
      )}
    </main>
  );
}
