import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  BarChart3,
  Bell,
  BookOpen,
  CheckCheck,
  ChevronDown,
  FileText,
  HelpCircle,
  Loader2,
  Lock,
  LogOut,
  Menu,
  Search,
  Settings,
  SlidersHorizontal,
  User,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useManager,
} from "../../context/ManagerContext";

import {
  clearManagerLogoutSession,
} from "../../utils/managerSession";

import "./managerHeaderNotifications.css";


const SETTINGS_STORAGE_KEY =
  "managerPortalSettings";


const HELP_ITEMS = [
  {
    id: "students",
    title: "Students",
    description:
      "Manage students, assignments and account status.",
    path:
      "/manager/dashboard/students",
    icon:
      Users,
  },
  {
    id: "mess-units",
    title: "Mess Units",
    description:
      "View North/South Mess Units and assignments.",
    path:
      "/manager/dashboard/mess-units",
    icon:
      UtensilsCrossed,
  },
  {
    id: "menu-management",
    title: "Menu Publishing",
    description:
      "Create and publish Hostel meal menus.",
    path:
      "/manager/dashboard/menu-management",
    icon:
      BookOpen,
  },
  {
    id: "forecasts",
    title: "Forecasts",
    description:
      "Review predicted demand and meal requirements.",
    path:
      "/manager/dashboard/forecasts",
    icon:
      BarChart3,
  },
  {
    id: "reports",
    title: "Reports",
    description:
      "Review operational reports and meal statistics.",
    path:
      "/manager/dashboard/reports",
    icon:
      FileText,
  },
];


function safeParseStoredUser(
  value
) {
  if (!value) {
    return null;
  }


  try {
    const parsed =
      JSON.parse(
        value
      );


    if (
      parsed &&
      typeof parsed ===
        "object"
    ) {
      return parsed;
    }

  } catch {
    return null;
  }


  return null;
}


function getStoredManager() {
  const candidates = [
    localStorage.getItem(
      "currentUser"
    ),
    localStorage.getItem(
      "user"
    ),
    sessionStorage.getItem(
      "currentUser"
    ),
    sessionStorage.getItem(
      "user"
    ),
  ];


  for (
    const candidate
    of candidates
  ) {
    const parsed =
      safeParseStoredUser(
        candidate
      );


    if (parsed) {
      return parsed;
    }
  }


  return {};
}


function getSavedNotificationSettings() {
  try {
    const stored =
      localStorage.getItem(
        SETTINGS_STORAGE_KEY
      );


    if (!stored) {
      return {
        managerNotifications:
          true,

        menuUpdates:
          true,

        studentResponses:
          true,

        forecastAlerts:
          true,
      };
    }


    const parsed =
      JSON.parse(
        stored
      );


    return {
      managerNotifications:
        parsed
          ?.notifications
          ?.managerNotifications ??
        true,

      menuUpdates:
        parsed
          ?.notifications
          ?.menuUpdates ??
        true,

      studentResponses:
        parsed
          ?.notifications
          ?.studentResponses ??
        true,

      forecastAlerts:
        parsed
          ?.notifications
          ?.forecastAlerts ??
        true,
    };

  } catch (error) {
    console.error(
      "Unable to read notification preferences:",
      error
    );


    return {
      managerNotifications:
        true,

      menuUpdates:
        true,

      studentResponses:
        true,

      forecastAlerts:
        true,
    };
  }
}


function getInitials(
  name
) {
  const value =
    String(
      name ||
      "Manager"
    )
      .trim();


  if (!value) {
    return "MR";
  }


  const words =
    value
      .split(
        /\s+/
      )
      .filter(
        Boolean
      );


  if (
    words.length ===
    1
  ) {
    return words[0]
      .slice(
        0,
        2
      )
      .toUpperCase();
  }


  return (
    words[0][0] +
    words[
      words.length - 1
    ][0]
  ).toUpperCase();
}


function formatNotificationTime(
  value
) {
  if (!value) {
    return "";
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }


  const now =
    new Date();


  const difference =
    now.getTime() -
    date.getTime();


  const minutes =
    Math.floor(
      difference /
      60000
    );


  if (
    minutes < 1
  ) {
    return "Just now";
  }


  if (
    minutes < 60
  ) {
    return `${minutes} min ago`;
  }


  const hours =
    Math.floor(
      minutes /
      60
    );


  if (
    hours < 24
  ) {
    return `${hours} hr ago`;
  }


  const days =
    Math.floor(
      hours /
      24
    );


  if (
    days < 7
  ) {
    return `${days} day${
      days === 1
        ? ""
        : "s"
    } ago`;
  }


  return date.toLocaleDateString(
    "en-IN",
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",
    }
  );
}


function notificationAllowed(
  notification,
  settings
) {
  if (
    !settings
      .managerNotifications
  ) {
    return false;
  }


  const type =
    String(
      notification?.type ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    type.includes(
      "forecast"
    )
  ) {
    return settings
      .forecastAlerts;
  }


  if (
    type.includes(
      "menu"
    )
  ) {
    return settings
      .menuUpdates;
  }


  if (
    type.includes(
      "response"
    ) ||
    type.includes(
      "student"
    )
  ) {
    return settings
      .studentResponses;
  }


  return true;
}


function ManagerHeader({
  onMenuClick,
}) {
  const navigate =
    useNavigate();


  const {
    apiFetch,
    manager,
    resetManagerState,
    setNotificationCount,
  } = useManager();


  const profileRef =
    useRef(null);


  const notificationRef =
    useRef(null);


  const helpRef =
    useRef(null);


  const [
    profileOpen,
    setProfileOpen,
  ] = useState(false);


  const [
    notificationOpen,
    setNotificationOpen,
  ] = useState(false);


  const [
    helpOpen,
    setHelpOpen,
  ] = useState(false);


  const [
    storedUser,
    setStoredUser,
  ] = useState(
    getStoredManager
  );


  const [
    helpSearch,
    setHelpSearch,
  ] = useState("");


  const [
    notificationSettings,
    setNotificationSettings,
  ] = useState(
    getSavedNotificationSettings
  );


  const [
    notifications,
    setNotifications,
  ] = useState([]);


  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);


  const [
    notificationLoading,
    setNotificationLoading,
  ] = useState(false);


  const [
    notificationError,
    setNotificationError,
  ] = useState("");


  const [
    markingRead,
    setMarkingRead,
  ] = useState(false);


  /*
   * Prefer ManagerContext because it comes from the
   * protected /api/manager/profile endpoint.
   *
   * Browser storage is fallback UI data only.
   */
  const currentUser =
    manager ||
    storedUser ||
    {};


  const managerName =
    currentUser?.name ||
    currentUser?.fullName ||
    currentUser?.username ||
    "Manager";


  const managerEmail =
    currentUser?.email ||
    "";


  const managerInitials =
    useMemo(
      () =>
        getInitials(
          managerName
        ),
      [
        managerName,
      ]
    );


  const visibleNotifications =
    useMemo(
      () =>
        notifications.filter(
          (
            notification
          ) =>
            notificationAllowed(
              notification,
              notificationSettings
            )
        ),
      [
        notifications,
        notificationSettings,
      ]
    );


  const visibleUnreadCount =
    useMemo(
      () =>
        visibleNotifications.filter(
          (
            notification
          ) =>
            !notification.isRead
        ).length,
      [
        visibleNotifications,
      ]
    );


  const filteredHelpItems =
    useMemo(
      () => {
        const search =
          helpSearch
            .trim()
            .toLowerCase();


        if (!search) {
          return HELP_ITEMS;
        }


        return HELP_ITEMS.filter(
          (item) =>
            item.title
              .toLowerCase()
              .includes(
                search
              ) ||
            item.description
              .toLowerCase()
              .includes(
                search
              )
        );
      },
      [
        helpSearch,
      ]
    );


  const syncNotificationCount =
    useCallback(
      (
        count
      ) => {
        const safeCount =
          Math.max(
            Number(
              count ||
              0
            ),
            0
          );


        setUnreadCount(
          safeCount
        );


        if (
          typeof setNotificationCount ===
          "function"
        ) {
          setNotificationCount(
            safeCount
          );
        }
      },
      [
        setNotificationCount,
      ]
    );


  const loadNotifications =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (
          !notificationSettings
            .managerNotifications
        ) {
          setNotifications([]);

          syncNotificationCount(
            0
          );

          setNotificationError("");

          return;
        }


        if (!silent) {
          setNotificationLoading(
            true
          );
        }


        setNotificationError("");


        try {
          const data =
            await apiFetch(
              "/api/manager/notifications"
            );


          const rows =
            Array.isArray(
              data?.notifications
            )
              ? data.notifications
              : [];


          setNotifications(
            rows
          );


          syncNotificationCount(
            Number(
              data?.unreadCount ||
              0
            )
          );

        } catch (error) {
          /*
           * apiFetch handles a genuine 401.
           *
           * Do not log the Manager out because
           * notifications failed for another reason.
           */
          console.error(
            "Notification loading error:",
            error
          );


          setNotifications([]);

          syncNotificationCount(
            0
          );


          setNotificationError(
            error?.message ||
            "Unable to load notifications."
          );

        } finally {
          if (!silent) {
            setNotificationLoading(
              false
            );
          }
        }
      },
      [
        apiFetch,
        notificationSettings
          .managerNotifications,
        syncNotificationCount,
      ]
    );


  useEffect(() => {
    loadNotifications({
      silent:
        true,
    });
  }, [
    loadNotifications,
  ]);


  useEffect(() => {
    if (
      !notificationSettings
        .managerNotifications
    ) {
      return undefined;
    }


    const interval =
      window.setInterval(
        () => {
          loadNotifications({
            silent:
              true,
          });
        },
        60000
      );


    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    loadNotifications,
    notificationSettings
      .managerNotifications,
  ]);


  /*
   * Clear local notification rows whenever the
   * authenticated Manager tenant changes.
   */
  useEffect(() => {
    setNotifications([]);

    syncNotificationCount(
      0
    );

    setNotificationError("");

    setNotificationOpen(
      false
    );

    setHelpOpen(
      false
    );

    setProfileOpen(
      false
    );

    setHelpSearch("");
  }, [
    manager?.id,
    syncNotificationCount,
  ]);


  useEffect(() => {
    const refreshProfile =
      () => {
        setStoredUser(
          getStoredManager()
        );
      };


    window.addEventListener(
      "manager-profile-updated",
      refreshProfile
    );


    window.addEventListener(
      "storage",
      refreshProfile
    );


    window.addEventListener(
      "manager-auth-changed",
      refreshProfile
    );


    return () => {
      window.removeEventListener(
        "manager-profile-updated",
        refreshProfile
      );


      window.removeEventListener(
        "storage",
        refreshProfile
      );


      window.removeEventListener(
        "manager-auth-changed",
        refreshProfile
      );
    };
  }, []);


  useEffect(() => {
    const refreshSettings =
      () => {
        setNotificationSettings(
          getSavedNotificationSettings()
        );
      };


    window.addEventListener(
      "manager-settings-updated",
      refreshSettings
    );


    window.addEventListener(
      "storage",
      refreshSettings
    );


    return () => {
      window.removeEventListener(
        "manager-settings-updated",
        refreshSettings
      );


      window.removeEventListener(
        "storage",
        refreshSettings
      );
    };
  }, []);


  useEffect(() => {
    if (
      notificationSettings
        .managerNotifications
    ) {
      loadNotifications({
        silent:
          true,
      });

    } else {
      setNotifications([]);

      syncNotificationCount(
        0
      );
    }
  }, [
    notificationSettings,
    loadNotifications,
    syncNotificationCount,
  ]);


  useEffect(() => {
    const handleOutsideClick =
      (
        event
      ) => {
        if (
          profileRef.current &&
          !profileRef.current.contains(
            event.target
          )
        ) {
          setProfileOpen(
            false
          );
        }


        if (
          notificationRef.current &&
          !notificationRef.current.contains(
            event.target
          )
        ) {
          setNotificationOpen(
            false
          );
        }


        if (
          helpRef.current &&
          !helpRef.current.contains(
            event.target
          )
        ) {
          setHelpOpen(
            false
          );
        }
      };


    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );


    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);


  useEffect(() => {
    const handleEscape =
      (
        event
      ) => {
        if (
          event.key ===
          "Escape"
        ) {
          setProfileOpen(
            false
          );

          setNotificationOpen(
            false
          );

          setHelpOpen(
            false
          );
        }
      };


    document.addEventListener(
      "keydown",
      handleEscape
    );


    return () => {
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);


  const handleNotificationClick =
    async () => {
      const nextOpen =
        !notificationOpen;


      setNotificationOpen(
        nextOpen
      );


      setProfileOpen(
        false
      );


      setHelpOpen(
        false
      );


      if (nextOpen) {
        await loadNotifications();
      }
    };


  const handleHelpClick =
    () => {
      setHelpOpen(
        (
          current
        ) =>
          !current
      );


      setProfileOpen(
        false
      );


      setNotificationOpen(
        false
      );
    };


  const handleProfileClick =
    () => {
      setStoredUser(
        getStoredManager()
      );


      setProfileOpen(
        (
          current
        ) =>
          !current
      );


      setNotificationOpen(
        false
      );


      setHelpOpen(
        false
      );
    };


  const markNotificationRead =
    async (
      notification
    ) => {
      if (
        !notification ||
        notification.isRead
      ) {
        return;
      }


      try {
        await apiFetch(
          `/api/manager/notifications/${notification.id}/read`,
          {
            method:
              "POST",
          }
        );


        setNotifications(
          (
            current
          ) =>
            current.map(
              (
                item
              ) =>
                item.id ===
                notification.id
                  ? {
                      ...item,
                      isRead:
                        true,
                    }
                  : item
            )
        );


        syncNotificationCount(
          Math.max(
            unreadCount - 1,
            0
          )
        );

      } catch (error) {
        console.error(
          "Unable to mark notification as read:",
          error
        );


        setNotificationError(
          error?.message ||
          "Unable to update notification."
        );
      }
    };


  const markAllRead =
    async () => {
      if (
        unreadCount <=
        0
      ) {
        return;
      }


      setMarkingRead(
        true
      );


      setNotificationError("");


      try {
        await apiFetch(
          "/api/manager/notifications/mark-all-read",
          {
            method:
              "POST",
          }
        );


        setNotifications(
          (
            current
          ) =>
            current.map(
              (
                notification
              ) => ({
                ...notification,
                isRead:
                  true,
              })
            )
        );


        syncNotificationCount(
          0
        );

      } catch (error) {
        console.error(
          "Mark notifications read error:",
          error
        );


        setNotificationError(
          error?.message ||
          "Unable to mark notifications as read."
        );

      } finally {
        setMarkingRead(
          false
        );
      }
    };


  const handleLogout =
    () => {
      /*
       * Clear in-memory tenant state immediately.
       */
      if (
        typeof resetManagerState ===
        "function"
      ) {
        resetManagerState();
      }


      setNotifications([]);

      syncNotificationCount(
        0
      );


      /*
       * Clear:
       * - token/user authentication
       * - Manager filters
       * - Manager cache entries
       * - Manager settings/preferences
       * - previous Manager tenant identifiers
       *
       * Only explicit Sign Out calls this.
       */
      clearManagerLogoutSession();


      navigate(
        "/login",
        {
          replace:
            true,

          state: {
            selectedRole:
              "manager",
          },
        }
      );
    };


  const openHelpItem =
    (
      item
    ) => {
      setHelpOpen(
        false
      );


      setHelpSearch("");


      navigate(
        item.path
      );
    };


  return (
    <header className="manager-header">

      <div className="manager-header-left">

        <button
          type="button"
          className="manager-menu-button"
          onClick={
            onMenuClick
          }
          aria-label="Open navigation menu"
          title="Menu"
        >
          <Menu
            size={23}
          />
        </button>


        <div className="manager-header-title">

          <h2>
            Hostel Mess Management
          </h2>

          <p>
            Manager Portal
          </p>

        </div>

      </div>


      <div className="manager-header-right">

        {/* ===================================================
            NOTIFICATIONS
        =================================================== */}

        <div
          className="manager-header-action"
          ref={
            notificationRef
          }
        >

          <button
            type="button"
            className="manager-icon-button manager-notification-button"
            onClick={
              handleNotificationClick
            }
            aria-label="Notifications"
            title="Notifications"
            aria-haspopup="true"
            aria-expanded={
              notificationOpen
            }
          >
            <Bell
              size={21}
            />


            {notificationSettings
              .managerNotifications &&
              visibleUnreadCount >
                0 && (
                <span className="notification-badge">
                  {visibleUnreadCount >
                  99
                    ? "99+"
                    : visibleUnreadCount}
                </span>
              )}

          </button>


          {notificationOpen && (
            <div
              className="manager-dropdown notification-dropdown"
              role="dialog"
              aria-label="Notifications"
            >

              <div className="dropdown-header notification-dropdown-header">

                <div>
                  <strong>
                    Notifications
                  </strong>

                  <span>
                    {visibleUnreadCount}
                    {" "}
                    unread
                  </span>
                </div>


                {notificationSettings
                  .managerNotifications &&
                  unreadCount >
                    0 && (
                    <button
                      type="button"
                      className="notification-mark-all-button"
                      onClick={
                        markAllRead
                      }
                      disabled={
                        markingRead
                      }
                    >
                      {markingRead ? (
                        <Loader2
                          size={14}
                          className="notification-spin"
                        />
                      ) : (
                        <CheckCheck
                          size={14}
                        />
                      )}

                      Mark all read
                    </button>
                  )}

              </div>


              {!notificationSettings
                .managerNotifications ? (

                <div className="notification-empty">

                  <Bell
                    size={24}
                  />

                  <strong>
                    Notifications disabled
                  </strong>

                  <span>
                    Enable Manager Notifications from Settings
                    to see portal alerts.
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setNotificationOpen(
                        false
                      );


                      navigate(
                        "/manager/dashboard/settings"
                      );
                    }}
                  >
                    Open Settings
                  </button>

                </div>

              ) : notificationLoading ? (

                <div className="notification-loading">

                  <Loader2
                    size={24}
                    className="notification-spin"
                  />

                  <span>
                    Loading notifications...
                  </span>

                </div>

              ) : notificationError ? (

                <div className="notification-error">

                  <strong>
                    Unable to load notifications
                  </strong>

                  <span>
                    {notificationError}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      loadNotifications()
                    }
                  >
                    Retry
                  </button>

                </div>

              ) : visibleNotifications
                  .length ===
                0 ? (

                <div className="notification-empty">

                  <Bell
                    size={24}
                  />

                  <strong>
                    No notifications
                  </strong>

                  <span>
                    There are no notifications for this Manager.
                  </span>

                </div>

              ) : (

                <div className="notification-list">

                  {visibleNotifications.map(
                    (
                      notification
                    ) => (

                      <button
                        type="button"
                        key={
                          notification.id
                        }
                        className={`notification-item notification-item-button ${
                          notification.isRead
                            ? "read"
                            : "unread"
                        }`}
                        onClick={() =>
                          markNotificationRead(
                            notification
                          )
                        }
                      >

                        <div className="notification-item-main">

                          <div className="notification-title-row">

                            <strong>
                              {notification.title}
                            </strong>


                            {!notification.isRead && (
                              <span className="notification-unread-dot" />
                            )}

                          </div>


                          <span className="notification-message">
                            {notification.message}
                          </span>


                          <small>
                            {formatNotificationTime(
                              notification.createdAt
                            )}
                          </small>

                        </div>

                      </button>

                    )
                  )}

                </div>

              )}


              <div className="notification-dropdown-footer">

                <button
                  type="button"
                  onClick={() => {
                    setNotificationOpen(
                      false
                    );


                    navigate(
                      "/manager/dashboard/settings"
                    );
                  }}
                >
                  Notification Settings
                </button>

              </div>

            </div>
          )}

        </div>


        {/* ===================================================
            HELP
        =================================================== */}

        <div
          className="manager-header-action manager-help-wrapper"
          ref={
            helpRef
          }
        >

          <button
            type="button"
            className="manager-icon-button manager-help-button"
            onClick={
              handleHelpClick
            }
            aria-label="Help"
            title="Help"
            aria-haspopup="true"
            aria-expanded={
              helpOpen
            }
          >
            <HelpCircle
              size={20}
            />
          </button>


          {helpOpen && (
            <div
              className="manager-dropdown manager-help-dropdown"
              role="dialog"
              aria-label="Help and Support"
            >

              <div className="manager-help-dropdown-header">

                <div>
                  <strong>
                    Help &amp; Support
                  </strong>

                  <span>
                    Quick help for Manager tools
                  </span>
                </div>


                <button
                  type="button"
                  className="manager-help-close"
                  onClick={() =>
                    setHelpOpen(
                      false
                    )
                  }
                  aria-label="Close Help"
                  title="Close"
                >
                  <X
                    size={18}
                  />
                </button>

              </div>


              <div className="manager-help-search">

                <Search
                  size={17}
                />


                <input
                  type="search"
                  value={
                    helpSearch
                  }
                  onChange={(
                    event
                  ) =>
                    setHelpSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search help topics"
                  aria-label="Search help topics"
                />

              </div>


              <div className="manager-help-list">

                {filteredHelpItems.length ===
                0 ? (

                  <div className="manager-help-empty">

                    <HelpCircle
                      size={24}
                    />

                    <strong>
                      No help topics found
                    </strong>

                    <span>
                      Try a different search term.
                    </span>

                  </div>

                ) : (

                  filteredHelpItems.map(
                    (
                      item
                    ) => {
                      const Icon =
                        item.icon;


                      return (
                        <button
                          type="button"
                          key={
                            item.id
                          }
                          className="manager-help-item"
                          onClick={() =>
                            openHelpItem(
                              item
                            )
                          }
                        >

                          <span className="manager-help-item-icon">
                            <Icon
                              size={18}
                            />
                          </span>


                          <span className="manager-help-item-content">
                            <strong>
                              {item.title}
                            </strong>

                            <small>
                              {item.description}
                            </small>
                          </span>

                        </button>
                      );
                    }
                  )

                )}

              </div>


              <div className="manager-help-footer">
                Need more assistance? Contact the system administrator.
              </div>

            </div>
          )}

        </div>


        {/* ===================================================
            PROFILE
        =================================================== */}

        <div
          className="manager-profile-wrapper"
          ref={
            profileRef
          }
        >

          <button
            type="button"
            className="manager-profile-button"
            onClick={
              handleProfileClick
            }
            aria-label="Manager profile"
            aria-haspopup="true"
            aria-expanded={
              profileOpen
            }
          >

            <div className="manager-avatar manager-avatar-initials">
              {managerInitials}
            </div>


            <div className="manager-profile-info">

              <strong
                title={
                  managerName
                }
              >
                {managerName}
              </strong>

              <span>
                Manager
              </span>

            </div>


            <ChevronDown
              size={17}
              className={
                profileOpen
                  ? "manager-profile-chevron open"
                  : "manager-profile-chevron"
              }
            />

          </button>


          {profileOpen && (
            <div
              className="manager-dropdown profile-dropdown"
              role="menu"
            >

              <div className="profile-dropdown-user">

                <div className="profile-dropdown-avatar profile-dropdown-avatar-initials">
                  {managerInitials}
                </div>


                <div className="profile-dropdown-user-info">

                  <strong
                    title={
                      managerName
                    }
                  >
                    {managerName}
                  </strong>

                  <span
                    title={
                      managerEmail
                    }
                  >
                    {managerEmail ||
                      "Manager account"}
                  </span>

                </div>

              </div>


              <div className="profile-dropdown-divider" />


              <button
                type="button"
                className="profile-dropdown-option"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(
                    false
                  );


                  navigate(
                    "/manager/dashboard/profile"
                  );
                }}
              >
                <User
                  size={18}
                />

                <span>
                  My Profile
                </span>
              </button>


              <button
                type="button"
                className="profile-dropdown-option"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(
                    false
                  );


                  navigate(
                    "/change-password",
                    {
                      state: {
                        from:
                          "/manager/dashboard",
                      },
                    }
                  );
                }}
              >
                <Lock
                  size={18}
                />

                <span>
                  Change Password
                </span>
              </button>


              <button
                type="button"
                className="profile-dropdown-option"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(
                    false
                  );


                  navigate(
                    "/manager/dashboard/settings"
                  );
                }}
              >
                <SlidersHorizontal
                  size={18}
                />

                <span>
                  Settings
                </span>
              </button>


              <div className="profile-dropdown-divider" />


              <button
                type="button"
                className="profile-dropdown-option logout-option"
                role="menuitem"
                onClick={
                  handleLogout
                }
              >
                <LogOut
                  size={18}
                />

                <span>
                  Sign Out
                </span>
              </button>

            </div>
          )}

        </div>

      </div>

    </header>
  );
}


export default ManagerHeader;