import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import studentApi, {
  clearStudentSession,
  getStoredUser,
} from "../services/studentApi";


/* =========================================================
   CONTEXT
========================================================= */

const StudentContext =
  createContext(null);


/* =========================================================
   PROVIDER
========================================================= */

export function StudentProvider({
  children,
}) {
  const [student, setStudent] =
    useState(() => getStoredUser());

  const [assignment, setAssignment] =
    useState(null);

  const [settings, setSettings] =
    useState(null);

  const [notifications, setNotifications] =
    useState([]);

  const [unreadNotificationCount, setUnreadNotificationCount] =
    useState(0);

  const [loading, setLoading] =
    useState(false);

  const [profileLoading, setProfileLoading] =
    useState(false);

  const [error, setError] =
    useState(null);

  const [initialized, setInitialized] =
    useState(false);


  /* =======================================================
     UPDATE LOCAL STUDENT
  ======================================================= */

  const updateLocalStudent = useCallback(
    (user) => {
      if (!user) {
        setStudent(null);
        return;
      }

      setStudent(user);

      /*
       * Keep the authenticated user object synchronized.
       * This is only a convenience cache.
       *
       * Backend authorization must always use JWT identity.
       */
      try {
        localStorage.setItem(
          "user",
          JSON.stringify(user)
        );
      } catch {
        // Ignore storage errors.
      }
    },
    []
  );


  /* =======================================================
     LOAD PROFILE
  ======================================================= */

  const loadProfile = useCallback(
    async () => {
      setProfileLoading(true);
      setError(null);

      try {
        const result =
          await studentApi.getStudentProfile();

        /*
         * Support both:
         *
         * {
         *   student: {...}
         * }
         *
         * and
         *
         * {
         *   data: {...}
         * }
         */

        const profile =
          result?.student ||
          result?.data ||
          result;

        if (profile) {
          updateLocalStudent(
            profile
          );

          /*
           * Assignment can be returned either as:
           *
           * profile.assignment
           *
           * or directly inside profile.
           */
          const studentAssignment =
            profile.assignment ||
            profile.assigned ||
            {
              hostel:
                profile.hostel,
              block:
                profile.block ||
                profile.hostel_block,
              messUnit:
                profile.messUnit ||
                profile.mess_unit,
              mealCategory:
                profile.mealCategory ||
                profile.meal_category,
            };

          setAssignment(
            studentAssignment
          );
        }

        return result;
      } catch (err) {
        setError(
          err?.message ||
            "Unable to load Student profile."
        );

        throw err;
      } finally {
        setProfileLoading(false);
      }
    },
    [updateLocalStudent]
  );


  /* =======================================================
     LOAD SETTINGS
  ======================================================= */

  const loadSettings =
    useCallback(
      async () => {
        try {
          const result =
            await studentApi.getStudentSettings();

          const data =
            result?.settings ||
            result?.data ||
            result;

          setSettings(
            data || null
          );

          return data;
        } catch (err) {
          /*
           * Settings should not prevent the dashboard
           * from loading.
           */
          console.warn(
            "Unable to load Student settings:",
            err
          );

          return null;
        }
      },
      []
    );


  /* =======================================================
     LOAD NOTIFICATIONS
  ======================================================= */

  const loadNotifications =
    useCallback(
      async () => {
        try {
          const result =
            await studentApi.getStudentNotifications(
              {
                limit: 50,
              }
            );

          const list =
            result?.notifications ||
            result?.data ||
            (
              Array.isArray(result)
                ? result
                : []
            );

          setNotifications(
            list
          );

          /*
           * Prefer backend unread count.
           */
          if (
            typeof result?.unreadCount ===
            "number"
          ) {
            setUnreadNotificationCount(
              result.unreadCount
            );
          } else {
            const unread =
              list.filter(
                (item) =>
                  !item.isRead &&
                  !item.read
              ).length;

            setUnreadNotificationCount(
              unread
            );
          }

          return list;
        } catch (err) {
          console.warn(
            "Unable to load Student notifications:",
            err
          );

          return [];
        }
      },
      []
    );


  /* =======================================================
     INITIALIZE STUDENT
  ======================================================= */

  const initializeStudent =
    useCallback(
      async () => {
        setLoading(true);
        setError(null);

        try {
          /*
           * First check whether a JWT exists.
           *
           * studentApi itself reads the actual token.
           */
          const token =
            studentApi.getToken();

          if (!token) {
            clearStudentSession();

            setStudent(null);
            setAssignment(null);
            setSettings(null);
            setNotifications([]);
            setUnreadNotificationCount(0);

            return null;
          }

          /*
           * Load authenticated Student profile.
           *
           * The backend identifies the Student from JWT.
           */
          const profile =
            await loadProfile();

          /*
           * These are secondary requests.
           */
          await Promise.allSettled([
            loadSettings(),
            loadNotifications(),
          ]);

          return profile;
        } catch (err) {
          /*
           * 401/403 is already handled inside studentApi.
           */
          setError(
            err?.message ||
              "Unable to initialize Student session."
          );

          return null;
        } finally {
          setInitialized(true);
          setLoading(false);
        }
      },
      [
        loadProfile,
        loadSettings,
        loadNotifications,
      ]
    );


  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    initializeStudent();
  }, [initializeStudent]);


  /* =======================================================
     REFRESH STUDENT
  ======================================================= */

  const refreshStudent =
    useCallback(
      async () => {
        return initializeStudent();
      },
      [initializeStudent]
    );


  /* =======================================================
     REFRESH NOTIFICATIONS
  ======================================================= */

  const refreshNotifications =
    useCallback(
      async () => {
        return loadNotifications();
      },
      [loadNotifications]
    );


  /* =======================================================
     MARK NOTIFICATION READ
  ======================================================= */

  const markNotificationRead =
    useCallback(
      async (notificationId) => {
        if (
          notificationId ===
          undefined ||
          notificationId === null
        ) {
          return;
        }

        await studentApi.markNotificationRead(
          notificationId
        );

        setNotifications(
          (current) =>
            current.map(
              (notification) => {
                const id =
                  notification.id ??
                  notification.notificationId;

                if (
                  String(id) !==
                  String(notificationId)
                ) {
                  return notification;
                }

                return {
                  ...notification,
                  isRead: true,
                  read: true,
                };
              }
            )
        );

        setUnreadNotificationCount(
          (count) =>
            Math.max(
              0,
              count - 1
            )
        );
      },
      []
    );


  /* =======================================================
     MARK ALL NOTIFICATIONS READ
  ======================================================= */

  const markAllNotificationsRead =
    useCallback(
      async () => {
        await studentApi.markAllNotificationsRead();

        setNotifications(
          (current) =>
            current.map(
              (notification) => ({
                ...notification,
                isRead: true,
                read: true,
              })
            )
        );

        setUnreadNotificationCount(
          0
        );
      },
      []
    );


  /* =======================================================
     UPDATE SETTINGS
  ======================================================= */

  const updateSettings =
    useCallback(
      async (payload) => {
        const result =
          await studentApi.updateStudentSettings(
            payload
          );

        const updated =
          result?.settings ||
          result?.data ||
          result;

        if (updated) {
          setSettings(
            updated
          );
        }

        return result;
      },
      []
    );


  /* =======================================================
     LOGOUT
  ======================================================= */

  const logout =
    useCallback(() => {
      studentApi.logoutStudent();

      setStudent(null);
      setAssignment(null);
      setSettings(null);
      setNotifications([]);
      setUnreadNotificationCount(0);
      setInitialized(false);
      setError(null);
    }, []);


  /* =======================================================
     AUTH EVENTS
  ======================================================= */

  useEffect(() => {
    const handleAuthError =
      () => {
        setStudent(null);
        setAssignment(null);
        setSettings(null);
        setNotifications([]);
        setUnreadNotificationCount(0);
        setInitialized(false);
      };

    const handleLogout =
      () => {
        setStudent(null);
        setAssignment(null);
        setSettings(null);
        setNotifications([]);
        setUnreadNotificationCount(0);
        setInitialized(false);
        setError(null);
      };

    window.addEventListener(
      "student-auth-error",
      handleAuthError
    );

    window.addEventListener(
      "student-logout",
      handleLogout
    );

    return () => {
      window.removeEventListener(
        "student-auth-error",
        handleAuthError
      );

      window.removeEventListener(
        "student-logout",
        handleLogout
      );
    };
  }, []);


  /* =======================================================
     DERIVED ASSIGNMENT VALUES
  ======================================================= */

  const hostel =
    assignment?.hostel ||
    student?.hostel ||
    null;

  const block =
    assignment?.block ||
    assignment?.hostelBlock ||
    student?.block ||
    student?.hostelBlock ||
    null;

  const messUnit =
    assignment?.messUnit ||
    assignment?.mess_unit ||
    student?.messUnit ||
    student?.mess_unit ||
    null;

  const mealCategory =
    assignment?.mealCategory ||
    assignment?.meal_category ||
    student?.mealCategory ||
    student?.meal_category ||
    null;


  /* =======================================================
     DISPLAY NAME
  ======================================================= */

  const studentName =
    student?.name ||
    student?.fullName ||
    student?.full_name ||
    student?.username ||
    "Student";


  /* =======================================================
     ROLE
  ======================================================= */

  const role =
    student?.role ||
    "student";


  /* =======================================================
     ACTIVE STATUS
  ======================================================= */

  const isActive =
    student?.isActive ??
    student?.is_active ??
    true;


  /* =======================================================
     MEMOIZED CONTEXT VALUE
  ======================================================= */

  const value =
    useMemo(
      () => ({
        /*
         * Student
         */
        student,
        setStudent:
          updateLocalStudent,

        studentName,

        role,

        isActive,

        /*
         * Assignment
         */
        assignment,

        hostel,
        block,
        messUnit,
        mealCategory,

        /*
         * Settings
         */
        settings,
        setSettings,

        /*
         * Notifications
         */
        notifications,
        unreadNotificationCount,

        /*
         * Loading
         */
        loading,
        profileLoading,
        initialized,

        /*
         * Error
         */
        error,

        /*
         * Actions
         */
        initializeStudent,
        refreshStudent,
        loadProfile,
        loadSettings,
        loadNotifications,
        refreshNotifications,

        markNotificationRead,
        markAllNotificationsRead,

        updateSettings,

        logout,
      }),
      [
        student,
        updateLocalStudent,
        studentName,
        role,
        isActive,
        assignment,
        hostel,
        block,
        messUnit,
        mealCategory,
        settings,
        notifications,
        unreadNotificationCount,
        loading,
        profileLoading,
        initialized,
        error,
        initializeStudent,
        refreshStudent,
        loadProfile,
        loadSettings,
        loadNotifications,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        updateSettings,
        logout,
      ]
    );


  /* =======================================================
     PROVIDER
  ======================================================= */

  return (
    <StudentContext.Provider
      value={value}
    >
      {children}
    </StudentContext.Provider>
  );
}


/* =========================================================
   HOOK
========================================================= */

export function useStudent() {
  const context =
    useContext(
      StudentContext
    );

  if (!context) {
    throw new Error(
      "useStudent must be used inside StudentProvider."
    );
  }

  return context;
}


/* =========================================================
   OPTIONAL ALIAS
========================================================= */

export const StudentContextProvider =
  StudentProvider;


export default StudentContext;