import { useState } from "react";
import {
  Bell,
  Globe2,
  LogOut,
  Monitor,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { clearStudentSession } from "../../services/studentApi";
import { staffRequest } from "../../services/staffApi";
import "./staffPages.css";

const TABS = [
  { id: "general", label: "General", Icon: SlidersHorizontal },
  { id: "notifications", label: "Notifications", Icon: Bell },
  { id: "security", label: "Security", Icon: ShieldCheck },
  { id: "appearance", label: "Appearance", Icon: Monitor },
];

const NOTIFICATION_OPTIONS = [
  ["notificationsEnabled", "All notifications", "Master switch for Staff Portal alerts."],
  ["announcementNotifications", "Announcements", "Updates published by your Manager."],
  ["managerNotifications", "Manager notifications", "Messages and assignment updates."],
  ["mealUpdateNotifications", "Meal schedule updates", "Changes to meal sessions and timing."],
  ["systemNotifications", "System notifications", "Important account and service notices."],
];

export default function StaffSettings() {
  const navigate = useNavigate();
  const {
    staffSettings: settings,
    settingsLoading,
    settingsError,
    updateStaffSetting,
  } = useOutletContext();
  const [activeTab, setActiveTab] = useState("general");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const updateSetting = (key, value) => {
    updateStaffSetting(key, value);
    setNotice("");
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const data = await staffRequest("/api/staff/settings", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      setNotice(data.message || "Staff settings saved.");
      window.dispatchEvent(new CustomEvent("staff-settings-updated", { detail: settings }));
    } catch (requestError) {
      setError(requestError.message || "Unable to save Staff settings.");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setChangingPassword(true);
    try {
      const data = await staffRequest("/api/staff/settings/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setNotice(data.message || "Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (requestError) {
      setError(requestError.message || "Unable to change your password.");
    } finally {
      setChangingPassword(false);
    }
  };

  const logout = () => {
    clearStudentSession();
    navigate("/login", { replace: true });
  };

  return (
    <main className="staff-page">
      <header className="staff-page-header">
        <div className="staff-page-header-icon"><SlidersHorizontal size={22} /></div>
        <div>
          <h1>Settings</h1>
          <p>Manage preferences for your authenticated Staff account.</p>
        </div>
      </header>

      {(error || settingsError) && <div className="staff-alert" role="alert">{error || settingsError}</div>}
      {notice && <div className="staff-notice" role="status">{notice}</div>}

      {settingsLoading ? (
        <div className="staff-empty-state" role="status">Loading your settings…</div>
      ) : (
        <div className="staff-settings-layout">
          <nav className="staff-card staff-settings-tabs" aria-label="Settings sections">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                className={activeTab === id ? "active" : ""}
                aria-current={activeTab === id ? "page" : undefined}
                onClick={() => {
                  setActiveTab(id);
                  setError("");
                  setNotice("");
                }}
              >
                <Icon size={17} /> {label}
              </button>
            ))}
          </nav>

          <section className="staff-card staff-settings-content">
            {activeTab === "general" && (
              <form className="staff-settings-form" onSubmit={saveSettings}>
                <div>
                  <h2>General settings</h2>
                  <p>Choose your language and regional display preferences.</p>
                </div>
                <label className="staff-field">
                  <span><Globe2 size={15} /> Time zone</span>
                  <select
                    value={settings.timezone}
                    onChange={(event) => updateSetting("timezone", event.target.value)}
                  >
                    <option value="Asia/Kolkata">India Standard Time (IST)</option>
                  </select>
                </label>
                <label className="staff-field">
                  Language
                  <select
                    value={settings.language}
                    onChange={(event) => updateSetting("language", event.target.value)}
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                  </select>
                </label>
                <button className="staff-primary-button" type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save general settings"}
                </button>
              </form>
            )}

            {activeTab === "notifications" && (
              <form className="staff-settings-form" onSubmit={saveSettings}>
                <div>
                  <h2>Notification preferences</h2>
                  <p>Choose which account notifications you want to receive.</p>
                </div>
                <div className="staff-settings-options">
                  {NOTIFICATION_OPTIONS.map(([key, title, description]) => (
                    <label className="staff-settings-option" key={key}>
                      <span>
                        <strong>{title}</strong>
                        <small>{description}</small>
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(settings[key])}
                        onChange={(event) => updateSetting(key, event.target.checked)}
                        aria-label={title}
                      />
                    </label>
                  ))}
                </div>
                <button className="staff-primary-button" type="submit" disabled={saving}>
                  <Bell size={15} /> {saving ? "Saving…" : "Save notification preferences"}
                </button>
              </form>
            )}

            {activeTab === "security" && (
              <form className="staff-settings-form" onSubmit={changePassword}>
                <div>
                  <h2>Security</h2>
                  <p>Update your password. Your current password is required to confirm the change.</p>
                </div>
                <label className="staff-field">
                  Current password
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                </label>
                <label className="staff-field">
                  New password
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                </label>
                <button className="staff-primary-button" type="submit" disabled={changingPassword}>
                  <ShieldCheck size={15} />
                  {changingPassword ? "Updating password…" : "Change password"}
                </button>
                <button className="staff-secondary-button" type="button" onClick={logout}>
                  <LogOut size={15} /> Logout
                </button>
              </form>
            )}

            {activeTab === "appearance" && (
              <form className="staff-settings-form" onSubmit={saveSettings}>
                <div>
                  <h2>Appearance</h2>
                  <p>Set the Staff Portal theme and content density for this account.</p>
                </div>
                <label className="staff-field">
                  Theme
                  <select
                    value={settings.theme}
                    onChange={(event) => updateSetting("theme", event.target.value)}
                  >
                    <option value="system">Use device setting</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
                <label className="staff-settings-option">
                  <span>
                    <strong>Compact layout</strong>
                    <small>Reduce spacing in the Staff Portal content area.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.compactLayout)}
                    onChange={(event) => updateSetting("compactLayout", event.target.checked)}
                    aria-label="Compact layout"
                  />
                </label>
                <button className="staff-primary-button" type="submit" disabled={saving}>
                  <Monitor size={15} /> {saving ? "Saving…" : "Save appearance"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
