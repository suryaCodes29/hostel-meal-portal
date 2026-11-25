import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BadgeCheck,
  Clock3,
  Hourglass,
  MapPin,
  ScanLine,
  UsersRound,
} from "lucide-react";
import { staffRequest } from "../services/staffApi";
import "./StaffDashboard.css";

const IST = "Asia/Kolkata";

function formatTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

function formatClock(value) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

function formatMeal(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

function formatCategory(value) {
  return value ? value.replace("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "";
}

function StatCard({ label, value, caption, Icon, tone }) {
  return (
    <article className={`staff-dashboard-stat staff-dashboard-stat-${tone}`}>
      <div className="staff-dashboard-stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{caption}</small>
      </div>
      <div className="staff-dashboard-stat-icon" aria-hidden="true">
        <Icon size={22} strokeWidth={2.2} />
      </div>
    </article>
  );
}

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const data = await staffRequest("/api/staff/dashboard");
      setDashboard(data);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(load, 0);
    const refreshTimer = window.setInterval(load, 30000);
    const clockTimer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearTimeout(initialLoadTimer);
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, [load]);

  if (loading) {
    return <div className="staff-dashboard-loading" role="status">Loading dashboard…</div>;
  }

  const staff = dashboard?.staff || {};
  const current = dashboard?.currentSession;
  const scans = dashboard?.recentScans || [];
  const expected = current?.expected || 0;
  const scanned = current?.attended || 0;
  const remaining = expected - scanned;
  const attendance = expected ? Math.round((scanned / expected) * 100) : 0;

  return (
    <div className="staff-dashboard">
      {error && (
        <div className="staff-dashboard-error" role="alert">
          {error}
          <button type="button" onClick={load}>Try again</button>
        </div>
      )}

      <section className="staff-dashboard-heading">
        <div>
          <h1>{dashboard?.greeting || "Good Evening"}, {staff.name || "Staff"}!</h1>
          <p>Here&apos;s your mess overview for today</p>
        </div>
        <div className="staff-dashboard-datetime" aria-label="Current date and time in India">
          <span>{formatDate(now)}</span>
          <strong><Clock3 size={16} /> {formatClock(now)} IST</strong>
        </div>
      </section>

      <section className="staff-dashboard-stats" aria-label="Current meal attendance">
        <StatCard label="Expected" value={expected} caption="Students expected" Icon={UsersRound} tone="blue" />
        <StatCard label="Scanned" value={scanned} caption="Successfully verified" Icon={BadgeCheck} tone="green" />
        <StatCard label="Remaining" value={remaining} caption="Yet to be scanned" Icon={Hourglass} tone="orange" />
        <StatCard label="Attendance" value={`${attendance}%`} caption="Of expected students" Icon={BarChart3} tone="purple" />
      </section>

      <section className="staff-dashboard-overview">
        <article className="staff-dashboard-panel staff-dashboard-session">
          <div className="staff-dashboard-panel-heading">
            <div>
              <span className="staff-dashboard-eyebrow">LIVE OVERVIEW</span>
              <h2>Current Meal Session</h2>
            </div>
            {current && <span className="staff-dashboard-live"><i /> Live Session</span>}
          </div>

          {current ? (
            <div className="staff-dashboard-session-detail">
              <div className="staff-dashboard-meal-mark"><UsersRound size={23} /></div>
              <div className="staff-dashboard-meal-info">
                <h3>{formatMeal(current.meal)}</h3>
                <p>{staff.messUnit || current.messUnit || "Mess unit"} - {formatCategory(current.mealCategory)}</p>
                <div className="staff-dashboard-session-meta">
                  <span><MapPin size={15} /> {staff.hostel || current.hostel || "Assigned hostel"}</span>
                  <span><Clock3 size={15} /> {formatTime(current.startTime)} – {formatTime(current.endTime)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="staff-dashboard-no-session">
              <div className="staff-dashboard-meal-mark"><Clock3 size={22} /></div>
              <div>
                <h3>No Active Meal Session</h3>
                <p>There is no meal session running for your assigned mess right now.</p>
              </div>
            </div>
          )}
        </article>

        <article className="staff-dashboard-panel staff-dashboard-actions">
          <span className="staff-dashboard-eyebrow">GET STARTED</span>
          <h2>Quick Actions</h2>
          <p>Verify student meal passes for your assigned session.</p>
          <button type="button" onClick={() => navigate("/staff/qr-scanner")}>
            <ScanLine size={19} />
            Open QR Scanner
            <ArrowRight size={17} />
          </button>
        </article>
      </section>

      <section className="staff-dashboard-panel staff-dashboard-recent">
        <div className="staff-dashboard-panel-heading">
          <div>
            <span className="staff-dashboard-eyebrow">ATTENDANCE ACTIVITY</span>
            <h2>Recent Scans</h2>
          </div>
          <Link
            className="staff-dashboard-view-all"
            to="/staff/history"
          >
            View All <ArrowRight size={16} />
          </Link>
        </div>
        <div className="staff-dashboard-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Student ID</th>
                <th>Meal</th>
                <th>Scan Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((scan, index) => (
                <tr key={`${scan.studentId || scan.studentName}-${scan.scanTime}-${index}`}>
                  <td className="staff-dashboard-student">{scan.studentName}</td>
                  <td>{scan.studentId || "—"}</td>
                  <td>{formatMeal(scan.meal)}</td>
                  <td>{formatTime(scan.scanTime)}</td>
                  <td><span className="staff-dashboard-verified"><i /> Verified</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!scans.length && <p className="staff-dashboard-empty">No recent scans available.</p>}
        </div>
      </section>
    </div>
  );
}
