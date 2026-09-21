import {
  Bell,
  Check,
  Database,
  Download,
  LockKeyhole,
  Monitor,
  Moon,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useManager,
} from "../../context/ManagerContext";

import "./settings.css";


/* =========================================================
   SETTINGS TABS
========================================================= */

const settingTabs = [
  {
    id: "general",
    label: "General",
    icon: SlidersHorizontal,
  },

  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
  },

  {
    id: "backup",
    label: "Backup & Data",
    icon: Database,
  },

  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
  },

  {
    id: "appearance",
    label: "Appearance",
    icon: Monitor,
  },
];


/* =========================================================
   STORAGE KEYS
========================================================= */

const SETTINGS_STORAGE_KEY =
  "managerPortalSettings";


/* =========================================================
   DEFAULT SETTINGS
========================================================= */

const DEFAULT_SETTINGS = {
  notifications: {
    managerNotifications: true,
    menuUpdates: true,
    studentResponses: true,
    forecastAlerts: true,
  },

  appearance: {
    mode: "light",
    compactMode: false,
  },
};


/* =========================================================
   READ SAVED SETTINGS
========================================================= */

function readSavedSettings() {
  try {
    const stored =
      localStorage.getItem(
        SETTINGS_STORAGE_KEY
      );


    if (!stored) {
      return DEFAULT_SETTINGS;
    }


    const parsed =
      JSON.parse(stored);


    return {
      notifications: {
        ...DEFAULT_SETTINGS
          .notifications,

        ...(
          parsed.notifications ||
          {}
        ),
      },

      appearance: {
        ...DEFAULT_SETTINGS
          .appearance,

        ...(
          parsed.appearance ||
          {}
        ),
      },
    };
  } catch (error) {
    console.error(
      "Unable to read Manager settings:",
      error
    );


    return DEFAULT_SETTINGS;
  }
}


/* =========================================================
   DOWNLOAD JSON
========================================================= */

function downloadJson(
  data,
  filename
) {
  const blob =
    new Blob(
      [
        JSON.stringify(
          data,
          null,
          2
        ),
      ],
      {
        type:
          "application/json",
      }
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const anchor =
    document.createElement(
      "a"
    );


  anchor.href = url;

  anchor.download =
    filename;


  document.body.appendChild(
    anchor
  );


  anchor.click();


  document.body.removeChild(
    anchor
  );


  URL.revokeObjectURL(
    url
  );
}


/* =========================================================
   SETTINGS PAGE
========================================================= */

function Settings() {
  const navigate =
    useNavigate();


  const manager =
    useManager();


  const [
    activeTab,
    setActiveTab,
  ] = useState(
    "general"
  );


  const [
    settings,
    setSettings,
  ] = useState(
    readSavedSettings
  );


  const [
    message,
    setMessage,
  ] = useState("");


  const [
    exporting,
    setExporting,
  ] = useState(false);


  /* =========================================================
     MANAGER INFORMATION
  ========================================================= */

  const currentUser =
    useMemo(() => {
      try {
        const stored =
          localStorage.getItem(
            "user"
          ) ||
          localStorage.getItem(
            "currentUser"
          );


        if (!stored) {
          return {};
        }


        return JSON.parse(
          stored
        );
      } catch {
        return {};
      }
    }, []);


  const managerName =
    currentUser?.name ||
    currentUser?.fullName ||
    currentUser?.username ||
    "Manager";


  const managerEmail =
    currentUser?.email ||
    "—";


  /* =========================================================
     HOSTEL / MESS COUNTS
  ========================================================= */

  const hostels =
    Array.isArray(
      manager?.hostels
    )
      ? manager.hostels
      : [];


  const messUnits =
    Array.isArray(
      manager?.messUnits
    )
      ? manager.messUnits
      : [];


  const activeHostels =
    hostels.filter(
      (hostel) =>
        hostel.isActive !==
          false &&
        hostel.is_active !==
          false &&
        String(
          hostel.status ||
            "active"
        ).toLowerCase() !==
          "inactive"
    );


  const activeMessUnits =
    messUnits.filter(
      (mess) =>
        mess.isActive !==
          false &&
        mess.is_active !==
          false &&
        String(
          mess.status ||
            "active"
        ).toLowerCase() !==
          "inactive"
    );


  /* =========================================================
     SAVE SETTINGS LOCALLY
  ========================================================= */
useEffect(() => {
  try {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(
        settings
      )
    );


    window.dispatchEvent(
      new Event(
        "manager-settings-updated"
      )
    );
  } catch (error) {
    console.error(
      "Unable to save Manager settings:",
      error
    );
  }
}, [settings]);
  /* =========================================================
     APPLY APPEARANCE
  ========================================================= */

  useEffect(() => {
    const root =
      document.documentElement;


    root.dataset
      .managerTheme =
      settings.appearance.mode;


    if (
      settings.appearance
        .compactMode
    ) {
      root.classList.add(
        "manager-compact-mode"
      );
    } else {
      root.classList.remove(
        "manager-compact-mode"
      );
    }


    return () => {
      /*
        We intentionally keep the selected theme
        when navigating between Manager pages.
      */
    };
  }, [
    settings.appearance,
  ]);


  /* =========================================================
     AUTO HIDE MESSAGE
  ========================================================= */

  useEffect(() => {
    if (!message) {
      return undefined;
    }


    const timer =
      window.setTimeout(
        () => {
          setMessage("");
        },
        3500
      );


    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [message]);


  /* =========================================================
     CHANGE PASSWORD
  ========================================================= */

  const handleChangePassword =
    () => {
      navigate(
        "/change-password",
        {
          state: {
            from:
              "/manager/dashboard/settings",
          },
        }
      );
    };


  /* =========================================================
     NOTIFICATION TOGGLE
  ========================================================= */

  const toggleNotification =
    (key) => {
      setSettings(
        (current) => ({
          ...current,

          notifications: {
            ...current
              .notifications,

            [key]:
              !current
                .notifications[
                key
              ],
          },
        })
      );


      setMessage(
        "Notification preference updated."
      );
    };


  /* =========================================================
     APPEARANCE MODE
  ========================================================= */

  const changeAppearanceMode =
    (mode) => {
      setSettings(
        (current) => ({
          ...current,

          appearance: {
            ...current
              .appearance,

            mode,
          },
        })
      );


      setMessage(
        `${
          mode === "dark"
            ? "Dark"
            : "Light"
        } appearance selected.`
      );
    };


  /* =========================================================
     COMPACT MODE
  ========================================================= */

  const toggleCompactMode =
    () => {
      setSettings(
        (current) => ({
          ...current,

          appearance: {
            ...current
              .appearance,

            compactMode:
              !current
                .appearance
                .compactMode,
          },
        })
      );


      setMessage(
        "Dashboard spacing preference updated."
      );
    };


  /* =========================================================
     RESET SETTINGS
  ========================================================= */

  const resetSettings =
    () => {
      const confirmed =
        window.confirm(
          "Reset Manager portal preferences to their default values?"
        );


      if (!confirmed) {
        return;
      }


      setSettings(
        DEFAULT_SETTINGS
      );


      setMessage(
        "Settings restored to default."
      );
    };


  /* =========================================================
     EXPORT SETTINGS / PORTAL SUMMARY
  ========================================================= */

  const exportPortalData =
    async () => {
      setExporting(true);


      try {
        const exportData = {
          exportedAt:
            new Date()
              .toISOString(),

          manager: {
            name:
              managerName,

            email:
              managerEmail,

            role:
              "manager",
          },

          portal: {
            name:
              "Hostel Mess Management Portal",

            activeHostels:
              activeHostels.length,

            totalHostels:
              hostels.length,

            activeMessUnits:
              activeMessUnits.length,

            totalMessUnits:
              messUnits.length,
          },

          preferences:
            settings,
        };


        downloadJson(
          exportData,
          `hostel-mess-manager-data-${
            new Date()
              .toISOString()
              .slice(0, 10)
          }.json`
        );


        setMessage(
          "Manager portal data exported successfully."
        );
      } catch (error) {
        console.error(
          "Export error:",
          error
        );


        setMessage(
          "Unable to export portal data."
        );
      } finally {
        setExporting(false);
      }
    };


  /* =========================================================
     NOTIFICATION OPTION COMPONENT
  ========================================================= */

  const renderNotificationOption =
    (
      key,
      title,
      description
    ) => {
      const enabled =
        Boolean(
          settings
            .notifications[
            key
          ]
        );


      return (
        <div className="settings-option-row">

          <div>

            <strong>
              {title}
            </strong>

            <span>
              {description}
            </span>

          </div>


          <button
            type="button"
            className={`settings-toggle ${
              enabled
                ? "enabled"
                : ""
            }`}
            onClick={() =>
              toggleNotification(
                key
              )
            }
            aria-pressed={
              enabled
            }
          >
            <span />

          </button>

        </div>
      );
    };


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="manager-settings-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="settings-page-header">

        <span className="settings-eyebrow">
          PORTAL CONFIGURATION
        </span>


        <h1>
          Settings
        </h1>


        <p>
          Manage notifications, security, data and portal preferences.
        </p>

      </div>


      {/* =====================================================
          MESSAGE
      ===================================================== */}

      {message && (
        <div className="settings-message">

          <Check size={16} />

          <span>
            {message}
          </span>

        </div>
      )}


      {/* =====================================================
          LAYOUT
      ===================================================== */}

      <div className="settings-layout">

        {/* ===================================================
            TABS
        =================================================== */}

        <aside className="settings-tabs">

          {settingTabs.map(
            (tab) => {
              const Icon =
                tab.icon;


              return (
                <button
                  key={
                    tab.id
                  }
                  type="button"
                  className={
                    activeTab ===
                    tab.id
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveTab(
                      tab.id
                    )
                  }
                >
                  <Icon
                    size={18}
                  />

                  <span>
                    {tab.label}
                  </span>

                </button>
              );
            }
          )}

        </aside>


        {/* ===================================================
            CONTENT
        =================================================== */}

        <section className="settings-content-card">

          {/* =================================================
              GENERAL
          ================================================= */}

          {activeTab ===
            "general" && (
            <div className="settings-section">

              <div className="settings-section-heading">

                <div>

                  <h2>
                    General
                  </h2>

                  <p>
                    Manager account and Hostel Mess portal information.
                  </p>

                </div>

              </div>


              <div className="settings-info-grid">

                <div className="settings-info-item">

                  <span>
                    Manager Name
                  </span>

                  <strong>
                    {managerName}
                  </strong>

                </div>


                <div className="settings-info-item">

                  <span>
                    Registered Email
                  </span>

                  <strong>
                    {managerEmail}
                  </strong>

                </div>


                <div className="settings-info-item">

                  <span>
                    Account Role
                  </span>

                  <strong>
                    Manager
                  </strong>

                </div>


                <div className="settings-info-item">

                  <span>
                    Account Status
                  </span>

                  <strong className="settings-success-text">
                    Active
                  </strong>

                </div>


                <div className="settings-info-item">

                  <span>
                    Total Hostels
                  </span>

                  <strong>
                    {hostels.length}
                  </strong>

                </div>


                <div className="settings-info-item">

                  <span>
                    Active Hostels
                  </span>

                  <strong>
                    {activeHostels.length}
                  </strong>

                </div>


                <div className="settings-info-item">

                  <span>
                    Total Mess Units
                  </span>

                  <strong>
                    {messUnits.length}
                  </strong>

                </div>


                <div className="settings-info-item">

                  <span>
                    Active Mess Units
                  </span>

                  <strong>
                    {activeMessUnits.length}
                  </strong>

                </div>

              </div>


              <div className="settings-general-note">

                <strong>
                  Hostel Management
                </strong>

                <p>
                  Hostel creation, activation, deactivation and deletion are handled from the separate Hostel Details page.
                </p>

                <button
                  type="button"
                  className="settings-secondary-button"
                  onClick={() =>
                    navigate(
                      "/manager/dashboard/hostels"
                    )
                  }
                >
                  Open Hostel Details
                </button>

              </div>

            </div>
          )}


          {/* =================================================
              NOTIFICATIONS
          ================================================= */}

          {activeTab ===
            "notifications" && (
            <div className="settings-section">

              <div className="settings-section-heading">

                <div>

                  <h2>
                    Notifications
                  </h2>

                  <p>
                    Choose which operational alerts are shown to the Manager.
                  </p>

                </div>

              </div>


              <div className="settings-options-list">

                {renderNotificationOption(
                  "managerNotifications",
                  "Manager Notifications",
                  "Receive general operational alerts and important portal updates."
                )}


                {renderNotificationOption(
                  "menuUpdates",
                  "Menu Updates",
                  "Receive notifications when menus are created, scheduled or published."
                )}


                {renderNotificationOption(
                  "studentResponses",
                  "Student Responses",
                  "Receive updates related to student meal responses."
                )}


                {renderNotificationOption(
                  "forecastAlerts",
                  "Forecast Alerts",
                  "Receive demand forecast and expected food-waste notifications."
                )}

              </div>

            </div>
          )}


          {/* =================================================
              BACKUP & DATA
          ================================================= */}

          {activeTab ===
            "backup" && (
            <div className="settings-section">

              <div className="settings-section-heading">

                <div>

                  <h2>
                    Backup & Data
                  </h2>

                  <p>
                    Review portal data information and export Manager settings.
                  </p>

                </div>

              </div>


              <div className="settings-info-grid">

                <div className="settings-info-item">

                  <span>
                    Hostels
                  </span>

                  <strong>
                    {hostels.length}
                  </strong>

                </div>


                <div className="settings-info-item">

                  <span>
                    Active Hostels
                  </span>

                  <strong>
                    {activeHostels.length}
                  </strong>

                </div>


                <div className="settings-info-item">

                  <span>
                    Mess Units
                  </span>

                  <strong>
                    {messUnits.length}
                  </strong>

                </div>


                <div className="settings-info-item">

                  <span>
                    Storage
                  </span>

                  <strong>
                    Backend Database
                  </strong>

                </div>

              </div>


              <div className="settings-data-warning">

                <Database
                  size={21}
                />

                <div>

                  <strong>
                    Operational Data
                  </strong>

                  <p>
                    Student, Staff, Hostel, Mess Unit, Menu, Forecast and Waste records are managed by the backend database.
                  </p>

                </div>

              </div>


              <div className="settings-backup-actions">

                <button
                  type="button"
                  className="settings-add-button"
                  onClick={
                    exportPortalData
                  }
                  disabled={
                    exporting
                  }
                >
                  {exporting ? (
                    <>
                      <RefreshCw
                        size={16}
                        className="settings-spin"
                      />

                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download
                        size={16}
                      />

                      Export Manager Data
                    </>
                  )}

                </button>

              </div>

            </div>
          )}


          {/* =================================================
              SECURITY
          ================================================= */}

          {activeTab ===
            "security" && (
            <div className="settings-section">

              <div className="settings-section-heading">

                <div>

                  <h2>
                    Security
                  </h2>

                  <p>
                    Manage password and Manager account protection.
                  </p>

                </div>

              </div>


              <div className="settings-security-list">

                <div className="settings-security-card">

                  <div className="settings-security-icon">

                    <LockKeyhole
                      size={23}
                    />

                  </div>


                  <div className="settings-security-content">

                    <strong>
                      Account Password
                    </strong>

                    <span>
                      Change your Manager login password securely.
                    </span>

                  </div>


                  <button
                    type="button"
                    className="settings-secondary-button"
                    onClick={
                      handleChangePassword
                    }
                  >
                    Change Password
                  </button>

                </div>


                <div className="settings-security-card">

                  <div className="settings-security-icon">

                    <ShieldCheck
                      size={23}
                    />

                  </div>


                  <div className="settings-security-content">

                    <strong>
                      Manager Route Protection
                    </strong>

                    <span>
                      Manager pages require an authenticated Manager account.
                    </span>

                  </div>


                  <span className="settings-enabled">
                    Active
                  </span>

                </div>


                <div className="settings-security-card">

                  <div className="settings-security-icon">

                    <ShieldCheck
                      size={23}
                    />

                  </div>


                  <div className="settings-security-content">

                    <strong>
                      Role-Based Access
                    </strong>

                    <span>
                      Manager, Mess Staff and Student dashboard access remains separated by role.
                    </span>

                  </div>


                  <span className="settings-enabled">
                    Active
                  </span>

                </div>

              </div>

            </div>
          )}


          {/* =================================================
              APPEARANCE
          ================================================= */}

          {activeTab ===
            "appearance" && (
            <div className="settings-section">

              <div className="settings-section-heading">

                <div>

                  <h2>
                    Appearance
                  </h2>

                  <p>
                    Customize your Manager Dashboard appearance.
                  </p>

                </div>

              </div>


              <div className="settings-theme-preview">

                <div className="settings-theme-icon">

                  <Monitor
                    size={24}
                  />

                </div>


                <div>

                  <strong>
                    Manager Dashboard Theme
                  </strong>

                  <span>
                    Navy Blue, White and Orange
                  </span>

                </div>

              </div>


              <div className="settings-appearance-title">
                Theme Mode
              </div>


              <div className="settings-theme-mode-grid">

                <button
                  type="button"
                  className={`settings-theme-mode-card ${
                    settings
                      .appearance
                      .mode ===
                    "light"
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    changeAppearanceMode(
                      "light"
                    )
                  }
                >
                  <Sun
                    size={22}
                  />

                  <strong>
                    Light
                  </strong>

                  <span>
                    Bright dashboard with white cards.
                  </span>

                  {settings
                    .appearance
                    .mode ===
                    "light" && (
                    <Check
                      size={17}
                      className="settings-theme-check"
                    />
                  )}

                </button>


                <button
                  type="button"
                  className={`settings-theme-mode-card ${
                    settings
                      .appearance
                      .mode ===
                    "dark"
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    changeAppearanceMode(
                      "dark"
                    )
                  }
                >
                  <Moon
                    size={22}
                  />

                  <strong>
                    Dark
                  </strong>

                  <span>
                    Reduced brightness for low-light use.
                  </span>

                  {settings
                    .appearance
                    .mode ===
                    "dark" && (
                    <Check
                      size={17}
                      className="settings-theme-check"
                    />
                  )}

                </button>

              </div>


              <div className="settings-option-row settings-compact-row">

                <div>

                  <strong>
                    Compact Dashboard
                  </strong>

                  <span>
                    Reduce spacing between Manager dashboard cards and sections.
                  </span>

                </div>


                <button
                  type="button"
                  className={`settings-toggle ${
                    settings
                      .appearance
                      .compactMode
                      ? "enabled"
                      : ""
                  }`}
                  onClick={
                    toggleCompactMode
                  }
                  aria-pressed={
                    settings
                      .appearance
                      .compactMode
                  }
                >
                  <span />

                </button>

              </div>


              <div className="settings-theme-colors">

                <div className="settings-theme-color">

                  <span className="theme-color navy" />

                  <div>

                    <strong>
                      Navy Blue
                    </strong>

                    <span>
                      Navigation & headings
                    </span>

                  </div>

                </div>


                <div className="settings-theme-color">

                  <span className="theme-color orange" />

                  <div>

                    <strong>
                      Orange
                    </strong>

                    <span>
                      Actions & active states
                    </span>

                  </div>

                </div>


                <div className="settings-theme-color">

                  <span className="theme-color white" />

                  <div>

                    <strong>
                      White
                    </strong>

                    <span>
                      Cards & content
                    </span>

                  </div>

                </div>

              </div>


              <div className="settings-reset-area">

                <button
                  type="button"
                  className="settings-secondary-button"
                  onClick={
                    resetSettings
                  }
                >
                  Reset Appearance & Preferences
                </button>

              </div>

            </div>
          )}

        </section>

      </div>

    </div>
  );
}


export default Settings;