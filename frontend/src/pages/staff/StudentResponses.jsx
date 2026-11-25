import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  Search,
  UsersRound,
  XCircle,
} from "lucide-react";
import { staffRequest } from "../../services/staffApi";
import "./staffPages.css";

const PAGE_SIZE = 10;

function parseServerDate(value) {
  if (!value) return null;
  const text = String(value);
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(text);
  const date = new Date(hasTimezone ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatIstDate(value) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00+05:30`)
    : parseServerDate(value);
  if (!date || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
  }).format(date);
}

function formatIstTime(value) {
  const date = parseServerDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusClass(value) {
  return String(value || "NO RESPONSE").toLowerCase().replace(/\s+/g, "-");
}

export default function StudentResponses() {
  const [rows, setRows] = useState([]);
  const [assignmentRequired, setAssignmentRequired] = useState(false);
  const [search, setSearch] = useState("");
  const [meal, setMeal] = useState("");
  const [date, setDate] = useState("");
  const [responseFilter, setResponseFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await staffRequest("/api/staff/responses");
      setRows(Array.isArray(data.responses) ? data.responses : []);
      setAssignmentRequired(Boolean(data.assignmentRequired));
    } catch (requestError) {
      setError(requestError.message || "Unable to load authorized student responses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const availableCategories = useMemo(() => {
    const categories = new Set(
      rows
        .map((row) => String(row.foodCategory || row.mealCategory || "").trim().toLowerCase())
        .filter(Boolean),
    );
    return [...categories].sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return rows.filter((row) => {
      const studentMatches = !searchTerm || [
        row.studentName,
        row.studentId,
      ].some((value) => String(value || "").toLowerCase().includes(searchTerm));
      const mealMatches = !meal || String(row.meal || "").toLowerCase() === meal;
      const dateMatches = !date || row.mealDate === date;
      const response = String(row.responseStatus || "NO RESPONSE").toUpperCase();
      const responseMatches = responseFilter === "all" || response === responseFilter;
      const category = String(row.foodCategory || row.mealCategory || "").trim().toLowerCase();
      const categoryMatches = categoryFilter === "all" || category === categoryFilter;
      return studentMatches && mealMatches && dateMatches && responseMatches && categoryMatches;
    });
  }, [rows, search, meal, date, responseFilter, categoryFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const visiblePage = Math.min(page, pageCount);
  const visibleRows = filteredRows.slice(
    (visiblePage - 1) * PAGE_SIZE,
    visiblePage * PAGE_SIZE,
  );
  const attendingCount = rows.filter(
    (row) => String(row.responseStatus).toUpperCase() === "ATTENDING",
  ).length;
  const skippingCount = rows.filter(
    (row) => String(row.responseStatus).toUpperCase() === "SKIPPING",
  ).length;
  const noResponseCount = rows.filter(
    (row) => !row.responseStatus || String(row.responseStatus).toUpperCase() === "NO RESPONSE",
  ).length;

  return (
    <main className="staff-page">
      <header className="staff-page-header">
        <div className="staff-page-header-icon"><ClipboardList size={22} /></div>
        <div>
          <h1>Student Responses</h1>
          <p>Read-only meal responses for students in your assigned hostel, mess, and category.</p>
        </div>
        <button className="staff-secondary-button" type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </header>

      {error && <div className="staff-alert" role="alert">{error}</div>}

      {assignmentRequired ? (
        <div className="staff-empty-state">
          <ClipboardList size={26} />
          <h2>Staff assignment required</h2>
          <p>Ask your Manager to assign your hostel, mess unit, and food category before viewing responses.</p>
        </div>
      ) : (
        <>
          <section className="staff-responses-summary" aria-label="Response summary">
            <article className="staff-card">
              <div className="staff-summary-label"><span>Total students</span><UsersRound size={18} /></div>
              <strong>{loading ? "—" : rows.length}</strong>
              <small>For authorized meal sessions</small>
            </article>
            <article className="staff-card">
              <div className="staff-summary-label"><span>Attending</span><CheckCircle2 size={18} /></div>
              <strong>{loading ? "—" : attendingCount}</strong>
              <small>Meal response submitted</small>
            </article>
            <article className="staff-card">
              <div className="staff-summary-label"><span>Skipping</span><XCircle size={18} /></div>
              <strong>{loading ? "—" : skippingCount}</strong>
              <small>Meal response submitted</small>
            </article>
            <article className="staff-card">
              <div className="staff-summary-label"><span>No response</span><ClipboardList size={18} /></div>
              <strong>{loading ? "—" : noResponseCount}</strong>
              <small>No response on record</small>
            </article>
          </section>

          <section className="staff-data-toolbar staff-card" aria-label="Student response filters">
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
              Meal date
              <input type="date" value={date} onChange={(event) => {
                setDate(event.target.value);
                setPage(1);
              }} />
            </label>
            <label className="staff-field">
              Response status
              <select value={responseFilter} onChange={(event) => {
                setResponseFilter(event.target.value);
                setPage(1);
              }}>
                <option value="all">All responses</option>
                <option value="ATTENDING">Attending</option>
                <option value="SKIPPING">Skipping</option>
                <option value="NO RESPONSE">No response</option>
              </select>
            </label>
            <label className="staff-field">
              Food category
              <select value={categoryFilter} onChange={(event) => {
                setCategoryFilter(event.target.value);
                setPage(1);
              }}>
                <option value="all">All assigned categories</option>
                {availableCategories.map((category) => (
                  <option key={category} value={category}>{category.toUpperCase()}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="staff-card staff-data-card">
            <div className="staff-data-table-wrap">
              <table className="staff-data-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Student ID</th>
                    <th>Meal</th>
                    <th>Meal Date</th>
                    <th>Food Category</th>
                    <th>Response</th>
                    <th>Submitted At (IST)</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, index) => {
                    const response = String(row.responseStatus || "NO RESPONSE").toUpperCase();
                    const responseTone = response === "ATTENDING" ? "success" : response === "SKIPPING" ? "warning" : "";
                    return (
                      <tr key={`${row.menuId}-${row.studentId || row.email}-${index}`}>
                        <td className="staff-table-primary">{row.studentName || "—"}</td>
                        <td>{row.studentId || "—"}</td>
                        <td>{row.meal || "—"}</td>
                        <td>{formatIstDate(row.mealDate)}</td>
                        <td>{(row.foodCategory || row.mealCategory || "—").toString().toUpperCase()}</td>
                        <td><span className={`staff-status-badge ${responseTone} response-${statusClass(response)}`}>{response}</span></td>
                        <td>{formatIstTime(row.respondedAt)}</td>
                      </tr>
                    );
                  })}
                  {!loading && !visibleRows.length && (
                    <tr><td className="staff-table-empty" colSpan={7}>No student responses match these filters.</td></tr>
                  )}
                  {loading && (
                    <tr><td className="staff-table-empty" colSpan={7}>Loading authorized student responses…</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <footer className="staff-page-pagination">
              <span>{filteredRows.length} matching response{filteredRows.length === 1 ? "" : "s"} · Response data is read-only</span>
              <div className="staff-pagination-controls">
                <button className="staff-secondary-button" type="button" onClick={() => setPage((current) => Math.max(1, Math.min(current, pageCount) - 1))} disabled={visiblePage <= 1}>
                  <ChevronLeft size={15} /> Previous
                </button>
                <span>Page {visiblePage} of {pageCount}</span>
                <button className="staff-secondary-button" type="button" onClick={() => setPage((current) => Math.min(pageCount, Math.min(current, pageCount) + 1))} disabled={visiblePage >= pageCount}>
                  Next <ChevronRight size={15} />
                </button>
              </div>
            </footer>
          </section>
          {!loading && !error && !rows.length && (
            <div className="staff-empty-state">
              <CalendarDays size={25} />
              <h2>No meal responses available</h2>
              <p>Eligible student responses from your assigned meal sessions will appear here.</p>
            </div>
          )}
        </>
      )}
    </main>
  );
}
