import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  Clock3,
  Filter,
  Hourglass,
  Search,
  UsersRound,
} from "lucide-react";
import { staffRequest } from "../../services/staffApi";
import "./MealAttendance.css";

const IST = "Asia/Kolkata";

function istDateInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatClock(value) {
  if (!value) return "Time not set";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00+05:30`));
}

function StatCard({ label, value, caption, Icon, tone }) {
  return (
    <article className={`staff-attendance-stat staff-attendance-stat-${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{caption}</small>
      </div>
      <span className="staff-attendance-stat-icon" aria-hidden="true">
        <Icon size={21} strokeWidth={2.2} />
      </span>
    </article>
  );
}

function statusClass(status) {
  return String(status || "").toLowerCase().replace(/\s+/g, "-");
}

export default function MealAttendance() {
  const [date, setDate] = useState(() => istDateInputValue());
  const [profile, setProfile] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedMenuId, setSelectedMenuId] = useState("");
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loadedMenuId, setLoadedMenuId] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [assignmentRequired, setAssignmentRequired] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const [attendanceError, setAttendanceError] = useState("");
  const [studentNameSearch, setStudentNameSearch] = useState("");
  const [studentIdSearch, setStudentIdSearch] = useState("");
  const [responseFilter, setResponseFilter] = useState("ALL");
  const [qrFilter, setQrFilter] = useState("ALL");
  const sessionRequestId = useRef(0);

  const loadSessions = useCallback(async () => {
    const requestId = ++sessionRequestId.current;
    try {
      const [profileData, sessionData] = await Promise.all([
        staffRequest("/api/staff/profile"),
        staffRequest(`/api/staff/meal-sessions?date=${encodeURIComponent(date)}`),
      ]);
      if (requestId !== sessionRequestId.current) return;
      setProfile(profileData.profile || null);
      setAssignmentRequired(Boolean(sessionData.assignmentRequired));
      setSessions(sessionData.sessions || []);
      setSessionError("");
      setSelectedMenuId((previous) => {
        const stillAvailable = sessionData.sessions?.some(
          (session) => String(session.menuId) === previous,
        );
        if (stillAvailable) return previous;
        const activeSession = sessionData.sessions?.find(
          (session) => session.sessionStatus === "active",
        );
        return String(activeSession?.menuId ?? sessionData.sessions?.[0]?.menuId ?? "");
      });
    } catch (error) {
      if (requestId !== sessionRequestId.current) return;
      setProfile(null);
      setSessions([]);
      setSelectedMenuId("");
      setSessionError(error.message);
    } finally {
      if (requestId === sessionRequestId.current) setLoadingSessions(false);
    }
  }, [date]);

  useEffect(() => {
    // The effect synchronizes this page with the authenticated staff assignment and session API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSessions();
    const timer = window.setInterval(loadSessions, 30000);
    return () => window.clearInterval(timer);
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedMenuId) {
      return undefined;
    }

    let active = true;
    const loadAttendance = async (showLoading = false) => {
      if (showLoading && active) setLoadingAttendance(true);
      try {
        const query = `menuId=${encodeURIComponent(selectedMenuId)}`;
        const [summaryData, responseData] = await Promise.all([
          staffRequest(`/api/staff/attendance/summary?${query}`),
          staffRequest(`/api/staff/responses?${query}`),
        ]);
        if (!active) return;
        setSummary(summaryData);
        setRows(responseData.responses || []);
        setLoadedMenuId(selectedMenuId);
        setAttendanceError("");
      } catch (error) {
        if (active) setAttendanceError(error.message);
      } finally {
        if (showLoading && active) setLoadingAttendance(false);
      }
    };

    loadAttendance(true);
    const timer = window.setInterval(() => loadAttendance(), 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedMenuId]);

  const selectedSession = sessions.find(
    (session) => String(session.menuId) === selectedMenuId,
  );
  const currentRows = loadedMenuId === selectedMenuId ? rows : [];
  const currentSummary = loadedMenuId === selectedMenuId ? summary : null;

  const filteredRows = currentRows.filter((row) => {
    const nameQuery = studentNameSearch.trim().toLowerCase();
    const idQuery = studentIdSearch.trim().toLowerCase();
    if (nameQuery && !String(row.studentName || "").toLowerCase().includes(nameQuery)) {
      return false;
    }
    if (idQuery && !String(row.studentId || "").toLowerCase().includes(idQuery)) {
      return false;
    }
    if (responseFilter !== "ALL" && row.responseStatus !== responseFilter) {
      return false;
    }
    if (qrFilter === "SCANNED" && row.qrAttendance !== "SCANNED") return false;
    if (qrFilter === "NOT SCANNED" && row.qrAttendance === "SCANNED") return false;
    return true;
  });

  const expected = currentSummary?.expectedAttending ?? 0;
  const scanned = currentSummary?.successfullyScanned ?? 0;
  const remaining = currentSummary?.remainingToScan ?? Math.max(expected - scanned, 0);

  return (
    <main className="staff-attendance-page">
      <header className="staff-attendance-heading">
        <div className="staff-attendance-heading-icon" aria-hidden="true">
          <CalendarDays size={23} />
        </div>
        <div>
          <h1>Meal Attendance</h1>
          <p>Review student meal responses and live QR attendance for your assignment.</p>
        </div>
      </header>

      {sessionError && (
        <div className="staff-attendance-alert" role="alert">
          {sessionError}
        </div>
      )}
      {assignmentRequired && (
        <div className="staff-attendance-empty staff-attendance-assignment">
          <h2>Staff assignment required</h2>
          <p>Your account is not assigned to a hostel, mess unit, and meal category. Please contact the Manager.</p>
        </div>
      )}

      {!assignmentRequired && (
        <>
          <section className="staff-attendance-assignment-bar" aria-label="Staff assignment">
            <div>
              <span>Assigned Hostel</span>
              <strong>{profile?.hostel || "—"}</strong>
            </div>
            <div>
              <span>Mess Unit</span>
              <strong>{profile?.messUnit || "—"}</strong>
            </div>
            <div>
              <span>Food Category</span>
              <strong>{profile?.mealCategory || "—"}</strong>
            </div>
          </section>

          <section className="staff-attendance-toolbar" aria-label="Meal selection">
            <label>
              <span>Date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  setLoadingSessions(true);
                  setDate(event.target.value);
                }}
              />
            </label>
            <label className="staff-attendance-session-select">
              <span>Meal session</span>
              <select
                value={selectedMenuId}
                onChange={(event) => setSelectedMenuId(event.target.value)}
                disabled={loadingSessions || sessions.length === 0}
              >
                {sessions.length === 0 && <option value="">No sessions available</option>}
                {sessions.map((session) => (
                  <option key={session.menuId} value={session.menuId}>
                    {session.meal} · {session.mealCategory} · {session.sessionStatus}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {loadingSessions ? (
            <div className="staff-attendance-empty">Loading authorized meal sessions…</div>
          ) : !sessions.length ? (
            <div className="staff-attendance-empty">
              <h2>No meal sessions for this date</h2>
              <p>There are no Manager-created meal sessions for your assignment on {formatDate(date)}.</p>
            </div>
          ) : (
            <>
              {selectedSession && (
                <section className="staff-attendance-session-card">
                  <div className="staff-attendance-session-copy">
                    <span className="staff-attendance-eyebrow">SELECTED MEAL SESSION</span>
                    <h2>{selectedSession.meal}</h2>
                    <p>
                      {selectedSession.mealCategory} meal · {formatDate(selectedSession.date)}
                    </p>
                  </div>
                  <div className="staff-attendance-session-meta">
                    <span className={`staff-attendance-session-status ${statusClass(selectedSession.sessionStatus)}`}>
                      <i />
                      {selectedSession.sessionStatus}
                    </span>
                    <span><Clock3 size={15} /> {formatClock(selectedSession.startTime)} – {formatClock(selectedSession.endTime)} IST</span>
                  </div>
                </section>
              )}

              {attendanceError && (
                <div className="staff-attendance-alert" role="alert">
                  {attendanceError}
                </div>
              )}

              <section className="staff-attendance-stats" aria-label="Attendance summary">
                <StatCard
                  label="Expected"
                  value={currentSummary ? expected : "—"}
                  caption="Students attending this meal"
                  Icon={UsersRound}
                  tone="blue"
                />
                <StatCard
                  label="Scanned"
                  value={currentSummary ? scanned : "—"}
                  caption="Successfully verified"
                  Icon={BadgeCheck}
                  tone="green"
                />
                <StatCard
                  label="Remaining"
                  value={currentSummary ? remaining : "—"}
                  caption="Awaiting QR verification"
                  Icon={Hourglass}
                  tone="orange"
                />
                <StatCard
                  label="Attendance"
                  value={currentSummary ? `${currentSummary.attendancePercentage}%` : "—"}
                  caption="Of expected students scanned"
                  Icon={CalendarDays}
                  tone="purple"
                />
              </section>

              <section className="staff-attendance-panel">
                <div className="staff-attendance-panel-heading">
                  <div>
                    <h2>Student Attendance</h2>
                    <p>Students are limited to your assigned hostel, mess unit, and meal category.</p>
                  </div>
                  <span className="staff-attendance-live">
                    <i />
                    Updates every 15 seconds
                  </span>
                </div>

                <div className="staff-attendance-filters">
                  <label className="staff-attendance-search">
                    <Search size={16} aria-hidden="true" />
                    <span className="staff-attendance-sr-only">Search by student name</span>
                    <input
                      type="search"
                      placeholder="Search student name"
                      value={studentNameSearch}
                      onChange={(event) => setStudentNameSearch(event.target.value)}
                    />
                  </label>
                  <label className="staff-attendance-search">
                    <Search size={16} aria-hidden="true" />
                    <span className="staff-attendance-sr-only">Search by student ID</span>
                    <input
                      type="search"
                      placeholder="Search student ID"
                      value={studentIdSearch}
                      onChange={(event) => setStudentIdSearch(event.target.value)}
                    />
                  </label>
                  <label className="staff-attendance-filter">
                    <Filter size={15} aria-hidden="true" />
                    <span className="staff-attendance-sr-only">Filter by meal response</span>
                    <select value={responseFilter} onChange={(event) => setResponseFilter(event.target.value)}>
                      <option value="ALL">All responses</option>
                      <option value="ATTENDING">Attending</option>
                      <option value="SKIPPING">Skipping</option>
                      <option value="NO RESPONSE">No response</option>
                    </select>
                  </label>
                  <label className="staff-attendance-filter">
                    <Filter size={15} aria-hidden="true" />
                    <span className="staff-attendance-sr-only">Filter by QR attendance</span>
                    <select value={qrFilter} onChange={(event) => setQrFilter(event.target.value)}>
                      <option value="ALL">All QR statuses</option>
                      <option value="SCANNED">Scanned</option>
                      <option value="NOT SCANNED">Not scanned</option>
                    </select>
                  </label>
                </div>

                <div className="staff-attendance-table-wrap">
                  <table className="staff-attendance-table">
                    <thead>
                      <tr>
                        <th>Student Name</th>
                        <th>Student ID</th>
                        <th>Email</th>
                        <th>Hostel</th>
                        <th>Mess Unit</th>
                        <th>Food Category</th>
                        <th>Meal Response</th>
                        <th>QR Attendance</th>
                        <th>Scan Time (IST)</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!loadingAttendance && filteredRows.map((row) => (
                        <tr key={`${row.menuId}-${row.studentId || row.email}`}>
                          <td className="staff-attendance-student-name">{row.studentName || "—"}</td>
                          <td>{row.studentId || "—"}</td>
                          <td>{row.email || "—"}</td>
                          <td>{row.hostel || "—"}</td>
                          <td>{row.messUnit || "—"}</td>
                          <td>{row.foodCategory || row.mealCategory || "—"}</td>
                          <td>
                            <span className={`staff-attendance-badge response-${statusClass(row.responseStatus)}`}>
                              {row.responseStatus || "NO RESPONSE"}
                            </span>
                          </td>
                          <td>
                            <span className={`staff-attendance-badge qr-${statusClass(row.qrAttendance || "not-scanned")}`}>
                              {row.qrAttendance || "—"}
                            </span>
                          </td>
                          <td>{row.scanTime ? formatClock(row.scanTime) : "—"}</td>
                          <td>
                            <span className={`staff-attendance-badge status-${statusClass(row.attendanceStatus)}`}>
                              {row.attendanceStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!loadingAttendance && !filteredRows.length && (
                        <tr>
                          <td className="staff-attendance-no-rows" colSpan="10">
                            {currentRows.length ? "No students match the selected filters." : "No eligible students found for this meal session."}
                          </td>
                        </tr>
                      )}
                      {loadingAttendance && (
                        <tr>
                          <td className="staff-attendance-no-rows" colSpan="10">Loading attendance…</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <footer className="staff-attendance-table-footer">
                  <span>{filteredRows.length} student{filteredRows.length === 1 ? "" : "s"}</span>
                  <span>Times displayed in India Standard Time (IST)</span>
                </footer>
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}
