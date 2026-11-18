import React, { useEffect, useState } from "react";
import {
  Bell,
  Mail,
  MessageSquare,
  Shield,
  Moon,
  Sun,
  Smartphone,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

import { studentApi } from "../../services/studentApi";
import { useStudent } from "../../context/StudentContext";

import "./Settings.css";

const DEFAULT_SETTINGS = {
  email_notifications: true,
  meal_notifications: true,
  announcement_notifications: true,
  feedback_notifications: true,
  reminder_notifications: true,
  push_notifications: true,
  dark_mode: false,
};

export default function Settings() {
  const { student, refreshStudent } = useStudent();

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await studentApi.getSettings();

      const data =
        response?.settings ||
        response?.data ||
        response?.result ||
        response ||
        {};

      setSettings({
        ...DEFAULT_SETTINGS,
        ...data,
      });
    } catch (err) {
      console.error("Failed to load settings:", err);

      setError(
        err?.message ||
          "Unable to load your settings. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key) => {
    setSettings((previous) => ({
      ...previous,
      [key]: !previous[key],
    }));

    setMessage("");
    setError("");
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setMessage("");
      setError("");

      await studentApi.updateSettings(settings);

      setMessage("Settings saved successfully.");

      if (refreshStudent) {
        await refreshStudent().catch(() => {});
      }
    } catch (err) {
      console.error("Failed to save settings:", err);

      setError(
        err?.message ||
          "Unable to save settings. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!passwordData.current_password) {
      setError("Please enter your current password.");
      return;
    }

    if (!passwordData.new_password) {
      setError("Please enter a new password.");
      return;
    }

    if (passwordData.new_password.length < 6) {
      setError("New password must contain at least 6 characters.");
      return;
    }

    if (
      passwordData.new_password !==
      passwordData.confirm_password
    ) {
      setError("New password and confirm password do not match.");
      return;
    }

    /*
      The current studentApi service may not expose a password
      change method. The form is kept ready for the backend endpoint.

      If your backend exposes:
      PATCH /api/student/password

      add changePassword() to studentApi.js and uncomment the
      request below.
    */

    try {
      setSaving(true);

      if (typeof studentApi.changePassword !== "function") {
        throw new Error(
          "Password change API is not connected yet. Add the student password endpoint before using this section."
        );
      }

      await studentApi.changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      });

      setPasswordData({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });

      setMessage("Password changed successfully.");
    } catch (err) {
      console.error("Password change failed:", err);

      setError(
        err?.message ||
          "Unable to change password. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const SettingToggle = ({
    icon: Icon,
    title,
    description,
    settingKey,
  }) => {
    return (
      <div className="student-setting-row">
        <div className="student-setting-left">
          <div className="student-setting-icon">
            <Icon size={20} />
          </div>

          <div className="student-setting-text">
            <h4>{title}</h4>
            <p>{description}</p>
          </div>
        </div>

        <button
          type="button"
          className={`student-switch ${
            settings[settingKey] ? "active" : ""
          }`}
          onClick={() => handleToggle(settingKey)}
          aria-label={`Toggle ${title}`}
          aria-pressed={settings[settingKey]}
        >
          <span />
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="student-settings-page">
        <div className="student-settings-loading">
          <RefreshCw className="student-spin" size={30} />
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="student-settings-page">

      {/* PAGE HEADER */}
      <div className="student-settings-header">
        <div>
          <span className="student-settings-label">
            ACCOUNT SETTINGS
          </span>

          <h1>Settings</h1>

          <p>
            Manage your notifications, preferences and account
            security.
          </p>
        </div>

        <div className="student-settings-user">
          <div className="student-settings-avatar">
            {(
              student?.name ||
              student?.full_name ||
              "S"
            )
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>
            <strong>
              {student?.name ||
                student?.full_name ||
                "Student"}
            </strong>

            <span>
              {student?.student_id ||
                student?.roll_number ||
                "Student Account"}
            </span>
          </div>
        </div>
      </div>

      {/* SUCCESS MESSAGE */}
      {message && (
        <div className="student-settings-alert success">
          <CheckCircle size={19} />
          <span>{message}</span>
        </div>
      )}

      {/* ERROR MESSAGE */}
      {error && (
        <div className="student-settings-alert error">
          <AlertCircle size={19} />
          <span>{error}</span>
        </div>
      )}

      <div className="student-settings-grid">

        {/* NOTIFICATIONS */}
        <section className="student-settings-card">
          <div className="student-settings-card-header">
            <div className="student-settings-card-icon">
              <Bell size={22} />
            </div>

            <div>
              <h2>Notifications</h2>
              <p>
                Choose which notifications you want to receive.
              </p>
            </div>
          </div>

          <div className="student-settings-options">

            <SettingToggle
              icon={Mail}
              title="Email Notifications"
              description="Receive important portal updates through email."
              settingKey="email_notifications"
            />

            <SettingToggle
              icon={Bell}
              title="Meal Notifications"
              description="Get reminders about today's meals and responses."
              settingKey="meal_notifications"
            />

            <SettingToggle
              icon={MessageSquare}
              title="Announcement Notifications"
              description="Receive notifications when new announcements are published."
              settingKey="announcement_notifications"
            />

            <SettingToggle
              icon={MessageSquare}
              title="Feedback Notifications"
              description="Get updates related to your submitted feedback."
              settingKey="feedback_notifications"
            />

            <SettingToggle
              icon={Bell}
              title="Meal Reminder Notifications"
              description="Receive reminders before meal response deadlines."
              settingKey="reminder_notifications"
            />

            <SettingToggle
              icon={Smartphone}
              title="Push Notifications"
              description="Allow portal notifications on supported devices."
              settingKey="push_notifications"
            />

          </div>
        </section>

        {/* APPEARANCE */}
        <section className="student-settings-card">

          <div className="student-settings-card-header">
            <div className="student-settings-card-icon">
              <Sun size={22} />
            </div>

            <div>
              <h2>Appearance</h2>
              <p>
                Customize how the student portal looks.
              </p>
            </div>
          </div>

          <div className="student-appearance-box">

            <div className="student-appearance-option">
              <div className="student-appearance-icon">
                <Sun size={20} />
              </div>

              <div>
                <strong>Light Mode</strong>
                <p>
                  Use the default bright portal interface.
                </p>
              </div>

              <div
                className={`student-radio ${
                  !settings.dark_mode ? "selected" : ""
                }`}
              />
            </div>

            <div className="student-appearance-option">
              <div className="student-appearance-icon">
                <Moon size={20} />
              </div>

              <div>
                <strong>Dark Mode</strong>
                <p>
                  Use a darker interface for low-light environments.
                </p>
              </div>

              <button
                type="button"
                className={`student-switch ${
                  settings.dark_mode ? "active" : ""
                }`}
                onClick={() =>
                  handleToggle("dark_mode")
                }
                aria-label="Toggle dark mode"
              >
                <span />
              </button>
            </div>

          </div>
        </section>

        {/* SECURITY */}
        <section className="student-settings-card student-security-card">

          <div className="student-settings-card-header">
            <div className="student-settings-card-icon">
              <Shield size={22} />
            </div>

            <div>
              <h2>Security</h2>
              <p>
                Keep your student account secure.
              </p>
            </div>
          </div>

          <div className="student-security-info">

            <div className="student-security-row">
              <div className="student-security-icon">
                <Lock size={19} />
              </div>

              <div>
                <strong>Account Security</strong>
                <p>
                  Your account is managed by the hostel
                  administration.
                </p>
              </div>
            </div>

            <div className="student-security-row">
              <div className="student-security-icon">
                <Shield size={19} />
              </div>

              <div>
                <strong>Role</strong>
                <p>
                  Student access is restricted to your own
                  assigned data.
                </p>
              </div>
            </div>

          </div>

          <form
            className="student-password-form"
            onSubmit={handlePasswordChange}
          >
            <div className="student-form-title">
              <Lock size={19} />
              <h3>Change Password</h3>
            </div>

            <div className="student-form-group">
              <label>Current Password</label>

              <div className="student-password-input">
                <input
                  type={showPassword ? "text" : "password"}
                  value={
                    passwordData.current_password
                  }
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      current_password: e.target.value,
                    })
                  }
                  placeholder="Enter current password"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            <div className="student-form-group">
              <label>New Password</label>

              <input
                type="password"
                value={passwordData.new_password}
                onChange={(e) =>
                  setPasswordData({
                    ...passwordData,
                    new_password: e.target.value,
                  })
                }
                placeholder="Enter new password"
              />
            </div>

            <div className="student-form-group">
              <label>Confirm New Password</label>

              <input
                type="password"
                value={passwordData.confirm_password}
                onChange={(e) =>
                  setPasswordData({
                    ...passwordData,
                    confirm_password: e.target.value,
                  })
                }
                placeholder="Confirm new password"
              />
            </div>

            <button
              type="submit"
              className="student-password-btn"
              disabled={saving}
            >
              {saving ? (
                <>
                  <RefreshCw
                    size={17}
                    className="student-spin"
                  />
                  Updating...
                </>
              ) : (
                <>
                  <Lock size={17} />
                  Change Password
                </>
              )}
            </button>
          </form>
        </section>

        {/* ACCOUNT INFORMATION */}
        <section className="student-settings-card">

          <div className="student-settings-card-header">
            <div className="student-settings-card-icon">
              <Shield size={22} />
            </div>

            <div>
              <h2>Account Information</h2>
              <p>
                Basic information associated with your account.
              </p>
            </div>
          </div>

          <div className="student-account-info">

            <div>
              <span>Student ID</span>
              <strong>
                {student?.student_id ||
                  student?.roll_number ||
                  "Not available"}
              </strong>
            </div>

            <div>
              <span>Email</span>
              <strong>
                {student?.email || "Not available"}
              </strong>
            </div>

            <div>
              <span>Hostel</span>
              <strong>
                {student?.hostel_name ||
                  student?.hostel?.name ||
                  "Not assigned"}
              </strong>
            </div>

            <div>
              <span>Block</span>
              <strong>
                {student?.block_name ||
                  student?.block?.name ||
                  "Not assigned"}
              </strong>
            </div>

            <div>
              <span>Mess Unit</span>
              <strong>
                {student?.mess_unit_name ||
                  student?.mess_unit?.name ||
                  "Not assigned"}
              </strong>
            </div>

            <div>
              <span>Meal Category</span>
              <strong>
                {student?.meal_category ||
                  "Not assigned"}
              </strong>
            </div>

          </div>
        </section>

      </div>

      {/* SAVE BUTTON */}
      <div className="student-settings-footer">

        <button
          type="button"
          className="student-settings-refresh"
          onClick={loadSettings}
          disabled={loading || saving}
        >
          <RefreshCw
            size={17}
            className={loading ? "student-spin" : ""}
          />
          Refresh
        </button>

        <button
          type="button"
          className="student-settings-save"
          onClick={handleSaveSettings}
          disabled={saving}
        >
          {saving ? (
            <>
              <RefreshCw
                size={18}
                className="student-spin"
              />
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              Save Settings
            </>
          )}
        </button>

      </div>

    </div>
  );
}