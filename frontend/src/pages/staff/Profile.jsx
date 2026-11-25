import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, CircleUserRound, Save } from "lucide-react";
import { staffRequest } from "../../services/staffApi";
import "./staffPages.css";

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

function displayCategory(value) {
  if (!value) return "Not assigned";
  return String(value).replace("-", " ").toUpperCase();
}

export default function StaffProfile() {
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await staffRequest("/api/staff/profile");
      const currentProfile = data.profile;
      if (!currentProfile) throw new Error("The Staff profile response was empty.");
      setProfile(currentProfile);
      setName(currentProfile.name || "");
      setMobile(currentProfile.mobile || "");
    } catch (requestError) {
      setError(requestError.message || "Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await staffRequest("/api/staff/profile", {
        method: "PATCH",
        body: JSON.stringify({ name, mobile }),
      });
      setNotice("Your personal details were saved.");
      window.dispatchEvent(new Event("staff-profile-updated"));
      await load();
    } catch (requestError) {
      setError(requestError.message || "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="staff-page"><div className="staff-empty-state" role="status">Loading Staff profile…</div></main>;
  }

  return (
    <main className="staff-page">
      <header className="staff-page-header">
        <div className="staff-page-header-icon"><CircleUserRound size={23} /></div>
        <div>
          <h1>Staff Profile</h1>
          <p>View your account details and update your personal contact information.</p>
        </div>
      </header>

      {error && <div className="staff-alert" role="alert">{error}</div>}
      {notice && <div className="staff-notice" role="status">{notice}</div>}
      {!profile ? (
        <div className="staff-empty-state">
          <CircleUserRound size={26} />
          <h2>Profile unavailable</h2>
          <p>Your authenticated Staff details could not be loaded.</p>
          <button className="staff-secondary-button" type="button" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : (
        <section className="staff-card staff-profile-card">
          <header className="staff-profile-identity">
            <div className="staff-profile-avatar" aria-label={`${profile.name || "Staff"} avatar`}>
              {initials(profile.name)}
            </div>
            <div>
              <h2>{profile.name || "Staff member"}</h2>
              <p>{profile.staffId || "Staff ID unavailable"} · {profile.staffRole || "Staff"}</p>
            </div>
            <span className={`staff-status-badge${profile.isActive ? " success" : ""}`}>
              <BadgeCheck size={14} /> {profile.isActive ? "Active" : "Inactive"}
            </span>
          </header>

          <dl className="staff-profile-details">
            <div><dt>Staff ID</dt><dd>{profile.staffId || "—"}</dd></div>
            <div><dt>Email</dt><dd>{profile.email || "—"}</dd></div>
            <div><dt>Role</dt><dd>{profile.staffRole || "—"}</dd></div>
            <div><dt>Assigned Hostel</dt><dd>{profile.hostel || "Not assigned"}</dd></div>
            <div><dt>Assigned Mess Unit</dt><dd>{profile.messUnit || "Not assigned"}</dd></div>
            <div><dt>Food Category</dt><dd>{displayCategory(profile.mealCategory)}</dd></div>
            <div><dt>Account Status</dt><dd>{profile.isActive ? "Active" : "Inactive"}</dd></div>
          </dl>

          <form className="staff-settings-form" onSubmit={save}>
            <h2>Personal details</h2>
            <p>Staff ID, role, hostel, mess, and food category are controlled by your Manager.</p>
            <label className="staff-field">
              Full name
              <input
                autoComplete="name"
                maxLength={100}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="staff-field">
              Phone number
              <input
                autoComplete="tel"
                inputMode="tel"
                maxLength={15}
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
              />
            </label>
            <button className="staff-primary-button" type="submit" disabled={saving}>
              <Save size={16} /> {saving ? "Saving…" : "Save personal details"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
