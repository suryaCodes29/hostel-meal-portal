import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  clearPreviousManagerSession,
} from "../utils/managerSession";
import { API_BASE_URL } from "../services/apiConfig";


const ManagerContext =
  createContext(null);


const AUTH_STORAGE_KEYS =
  new Set([
    "accessToken",
    "token",
    "authToken",
    "user",
    "currentUser",
    "role",
    "selectedRole",
    "managerSessionUserId",
  ]);


/* ============================================================
   STORAGE HELPERS
============================================================ */

function normalizeRole(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}


function getStoredRole() {
  const candidates = [
    localStorage.getItem(
      "role"
    ),
    sessionStorage.getItem(
      "role"
    ),
    localStorage.getItem(
      "selectedRole"
    ),
    sessionStorage.getItem(
      "selectedRole"
    ),
  ];


  for (
    const candidate
    of candidates
  ) {
    const role =
      normalizeRole(
        candidate
      );


    if (role) {
      return role;
    }
  }


  return "";
}


function getStoredToken() {
  return (
    localStorage.getItem(
      "accessToken"
    ) ||
    localStorage.getItem(
      "token"
    ) ||
    localStorage.getItem(
      "authToken"
    ) ||
    sessionStorage.getItem(
      "accessToken"
    ) ||
    sessionStorage.getItem(
      "token"
    ) ||
    sessionStorage.getItem(
      "authToken"
    ) ||
    ""
  );
}


/* ============================================================
   PROVIDER
============================================================ */

export function ManagerProvider({
  children,
}) {

  /* ==========================================================
     TENANT DATA
  ========================================================== */

  const [
    hostels,
    setHostels,
  ] = useState([]);


  const [
    messUnits,
    setMessUnits,
  ] = useState([]);


  /*
   * Empty string means:
   *
   * selectedHostel  = All Hostels
   * selectedMessUnit = All Mess Units
   *
   * These are intentionally NOT initialized to the first
   * database record.
   */
  const [
    selectedHostel,
    setSelectedHostel,
  ] = useState("");


  const [
    selectedMessUnit,
    setSelectedMessUnit,
  ] = useState("");


  const [
    selectedMealCategory,
    setSelectedMealCategory,
  ] = useState(
    "all"
  );


  const [
    manager,
    setManager,
  ] = useState(null);


  const [
    loadingFilters,
    setLoadingFilters,
  ] = useState(false);


  const [
    filterError,
    setFilterError,
  ] = useState("");


  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);


  const [
    notificationCount,
    setNotificationCount,
  ] = useState(0);


  /*
   * Incremented every time authentication changes.
   *
   * Every ManagerContext request captures the generation
   * that existed when it started.
   *
   * If Manager A's request finishes AFTER Manager B logs in,
   * the old response is ignored instead of being written into
   * Manager B's React state.
   */
  const authGenerationRef =
    useRef(0);


  const [
    authGeneration,
    setAuthGeneration,
  ] = useState(0);


  const redirectingRef =
    useRef(false);


  /* ==========================================================
     COMPLETE MANAGER STATE RESET
  ========================================================== */

  const resetManagerState =
    useCallback(
      () => {
        setManager(
          null
        );


        setHostels(
          []
        );


        setMessUnits(
          []
        );


        setSelectedHostel(
          ""
        );


        setSelectedMessUnit(
          ""
        );


        setSelectedMealCategory(
          "all"
        );


        setNotificationCount(
          0
        );


        setFilterError(
          ""
        );


        setLoadingFilters(
          false
        );


        setSidebarOpen(
          false
        );
      },
      []
    );


  /* ==========================================================
     TOKEN
  ========================================================== */

  const getToken =
    useCallback(
      () =>
        getStoredToken(),
      []
    );


  /* ==========================================================
     MANAGER SESSION CHECK
  ========================================================== */

  const isManagerSession =
    useCallback(
      () => {
        const token =
          getStoredToken();


        const role =
          getStoredRole();


        return (
          Boolean(
            token
          ) &&
          role ===
            "manager"
        );
      },
      []
    );


  /* ==========================================================
     SESSION EXPIRED
  ========================================================== */

  const handleExpiredSession =
    useCallback(
      () => {
        if (
          redirectingRef.current
        ) {
          return;
        }


        redirectingRef.current =
          true;


        authGenerationRef.current +=
          1;


        resetManagerState();


        clearPreviousManagerSession({
          preserveSelectedRole:
            true,
        });


        localStorage.setItem(
          "selectedRole",
          "manager"
        );


        sessionStorage.setItem(
          "selectedRole",
          "manager"
        );


        window.location.replace(
          "/login"
        );
      },
      [
        resetManagerState,
      ]
    );


  /* ==========================================================
     AUTHENTICATED FETCH
  ========================================================== */

  const apiFetch = useCallback(
    async (endpoint, options = {}) => {
      const token = getToken();

      if (!token) {
        const error = new Error(
          "Authentication is required. Please sign in."
        );
        error.status = 401;
        throw error;
      }

      const requestHeaders = {
        ...(options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      };

      let response;

      try {
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers: requestHeaders,
          cache: "no-store",
        });
      } catch (cause) {
        // Network and CORS errors must not log out the manager.
        const error = new Error(
          "Unable to reach the server. Check your backend connection and try again."
        );
        error.cause = cause;
        error.status = 0;
        throw error;
      }

      let data = {};

      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (response.status === 401) {
        // Redirect only if the failed request still belongs
        // to the currently authenticated session.
        const currentToken = getToken();
        const currentRole = getStoredRole();

        if (
          currentToken === token &&
          currentRole === "manager"
        ) {
          handleExpiredSession();
        }

        const error = new Error(
          data?.message || "Your session has expired."
        );
        error.status = 401;
        error.data = data;
        throw error;
      }

      if (response.status === 403) {
        const error = new Error(
          data?.message ||
            "You do not have permission to access this resource."
        );
        error.status = 403;
        error.data = data;
        throw error;
      }

      if (!response.ok) {
        const error = new Error(
          data?.message ||
            `Request failed with HTTP ${response.status}.`
        );
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    },
    [getToken, handleExpiredSession]
  );

  /* ==========================================================
     LOAD MANAGER PROFILE
  ========================================================== */

  const loadManagerProfile =
    useCallback(
      async (
        generation =
          authGenerationRef.current
      ) => {
        if (
          !isManagerSession()
        ) {
          if (
            generation ===
            authGenerationRef.current
          ) {
            setManager(
              null
            );
          }


          return null;
        }


        try {
          const data =
            await apiFetch(
              "/api/manager/profile"
            );


          /*
           * Ignore an old Manager request that completed
           * after authentication changed.
           */
          if (
            generation !==
            authGenerationRef.current
          ) {
            return null;
          }


          const receivedManager =
            data?.manager ||
            null;


          setManager(
            receivedManager
          );


          return receivedManager;

        } catch (error) {
          if (
            generation !==
            authGenerationRef.current
          ) {
            return null;
          }


          if (
            error?.status !==
            401
          ) {
            console.error(
              "Manager profile error:",
              error
            );
          }


          setManager(
            null
          );


          return null;
        }
      },
      [
        apiFetch,
        isManagerSession,
      ]
    );


  /* ==========================================================
     LOAD TENANT FILTER OPTIONS
  ========================================================== */

  const loadFilterOptions =
    useCallback(
      async (
        generation =
          authGenerationRef.current
      ) => {
        if (
          !isManagerSession()
        ) {
          if (
            generation ===
            authGenerationRef.current
          ) {
            setHostels(
              []
            );


            setMessUnits(
              []
            );


            setSelectedHostel(
              ""
            );


            setSelectedMessUnit(
              ""
            );


            setSelectedMealCategory(
              "all"
            );


            setFilterError(
              ""
            );


            setLoadingFilters(
              false
            );
          }


          return {
            hostels:
              [],

            messUnits:
              [],
          };
        }


        if (
          generation ===
          authGenerationRef.current
        ) {
          setLoadingFilters(
            true
          );


          setFilterError(
            ""
          );
        }


        try {
          const data =
            await apiFetch(
              "/api/manager/filter-options"
            );


          if (
            generation !==
            authGenerationRef.current
          ) {
            return null;
          }


          const receivedHostels =
            Array.isArray(
              data?.hostels
            )
              ? data.hostels
              : [];


          const receivedMessUnits =
            Array.isArray(
              data?.messUnits
            )
              ? data.messUnits
              : [];


          /*
           * Backend /api/manager/filter-options is already
           * tenant-scoped.
           *
           * Never merge this response with old state.
           * Replace the arrays completely.
           */
          setHostels(
            receivedHostels
          );


          setMessUnits(
            receivedMessUnits
          );


          /*
           * Preserve a selected Hostel only if it still
           * exists in THIS authenticated Manager's response.
           *
           * Otherwise return to All Hostels.
           */
          setSelectedHostel(
            (
              current
            ) => {
              if (!current) {
                return "";
              }


              const stillOwned =
                receivedHostels.some(
                  (
                    hostel
                  ) =>
                    String(
                      hostel.id
                    ) ===
                    String(
                      current
                    )
                );


              return stillOwned
                ? current
                : "";
            }
          );


          /*
           * Preserve selected Mess Unit only if it still
           * exists in THIS authenticated Manager's response.
           *
           * Otherwise return to All Mess Units.
           */
          setSelectedMessUnit(
            (
              current
            ) => {
              if (!current) {
                return "";
              }


              const stillOwned =
                receivedMessUnits.some(
                  (
                    mess
                  ) =>
                    String(
                      mess.id
                    ) ===
                    String(
                      current
                    )
                );


              return stillOwned
                ? current
                : "";
            }
          );


          return {
            hostels:
              receivedHostels,

            messUnits:
              receivedMessUnits,
          };

        } catch (error) {
          if (
            generation !==
            authGenerationRef.current
          ) {
            return null;
          }


          /*
           * Never keep old tenant arrays after a failed
           * refresh. Empty state is safer than displaying
           * another Manager's previous data.
           */
          setHostels(
            []
          );


          setMessUnits(
            []
          );


          setSelectedHostel(
            ""
          );


          setSelectedMessUnit(
            ""
          );


          if (
            error?.status !==
            401
          ) {
            console.error(
              "Filter options error:",
              error
            );


            setFilterError(
              error?.message ||
              "Unable to load dashboard filters."
            );
          }


          return null;

        } finally {
          if (
            generation ===
            authGenerationRef.current
          ) {
            setLoadingFilters(
              false
            );
          }
        }
      },
      [
        apiFetch,
        isManagerSession,
      ]
    );


  /* ==========================================================
     LOAD NOTIFICATION COUNT
  ========================================================== */

  const loadNotificationCount =
    useCallback(
      async (
        generation =
          authGenerationRef.current
      ) => {
        if (
          !isManagerSession()
        ) {
          if (
            generation ===
            authGenerationRef.current
          ) {
            setNotificationCount(
              0
            );
          }


          return 0;
        }


        try {
          const data =
            await apiFetch(
              "/api/manager/notifications"
            );


          if (
            generation !==
            authGenerationRef.current
          ) {
            return 0;
          }


          const count =
            Math.max(
              Number(
                data?.unreadCount ||
                0
              ),
              0
            );


          setNotificationCount(
            count
          );


          return count;

        } catch (error) {
          if (
            generation !==
            authGenerationRef.current
          ) {
            return 0;
          }


          setNotificationCount(
            0
          );


          if (
            error?.status !==
            401
          ) {
            console.error(
              "Notification error:",
              error
            );
          }


          return 0;
        }
      },
      [
        apiFetch,
        isManagerSession,
      ]
    );


  /* ==========================================================
     FILTER MESS UNITS BY SELECTED HOSTEL
  ========================================================== */

  const filteredMessUnits =
    useMemo(
      () => {
        /*
         * All Hostels:
         * return every Mess Unit returned by this Manager's
         * tenant-scoped API.
         */
        if (
          !selectedHostel
        ) {
          return messUnits;
        }


        return messUnits.filter(
          (
            mess
          ) =>
            String(
              mess.hostelId ??
              mess.hostel?.id ??
              ""
            ) ===
            String(
              selectedHostel
            )
        );
      },
      [
        messUnits,
        selectedHostel,
      ]
    );


  /* ==========================================================
     RESET INVALID MESS FILTER WHEN HOSTEL CHANGES
  ========================================================== */

  useEffect(
    () => {
      /*
       * Empty means All Mess Units.
       * Never auto-select the first Mess Unit.
       */
      if (
        !selectedMessUnit
      ) {
        return;
      }


      const stillValid =
        filteredMessUnits.some(
          (
            mess
          ) =>
            String(
              mess.id
            ) ===
            String(
              selectedMessUnit
            )
        );


      if (
        !stillValid
      ) {
        setSelectedMessUnit(
          ""
        );
      }
    },
    [
      filteredMessUnits,
      selectedMessUnit,
    ]
  );


  /* ==========================================================
     SELECTED OBJECTS
  ========================================================== */

  const selectedHostelData =
    useMemo(
      () => {
        if (
          !selectedHostel
        ) {
          return null;
        }


        return (
          hostels.find(
            (
              hostel
            ) =>
              String(
                hostel.id
              ) ===
              String(
                selectedHostel
              )
          ) ||
          null
        );
      },
      [
        hostels,
        selectedHostel,
      ]
    );


  const selectedMessUnitData =
    useMemo(
      () => {
        if (
          !selectedMessUnit
        ) {
          return null;
        }


        return (
          filteredMessUnits.find(
            (
              mess
            ) =>
              String(
                mess.id
              ) ===
              String(
                selectedMessUnit
              )
          ) ||
          null
        );
      },
      [
        filteredMessUnits,
        selectedMessUnit,
      ]
    );


  /* ==========================================================
     FILTER QUERY STRING
  ========================================================== */

  const filterQueryString =
    useMemo(
      () => {
        const params =
          new URLSearchParams();


        /*
         * Missing hostel_id means:
         * All Hostels owned by authenticated Manager.
         */
        if (
          selectedHostel
        ) {
          params.set(
            "hostel_id",
            selectedHostel
          );
        }


        /*
         * Missing mess_unit_id means:
         * All allowed Mess Units within current Manager scope.
         */
        if (
          selectedMessUnit
        ) {
          params.set(
            "mess_unit_id",
            selectedMessUnit
          );
        }


        /*
         * Missing meal_category means:
         * All meal categories.
         */
        if (
          selectedMealCategory &&
          selectedMealCategory !==
            "all"
        ) {
          params.set(
            "meal_category",
            selectedMealCategory
          );
        }


        return params.toString();
      },
      [
        selectedHostel,
        selectedMessUnit,
        selectedMealCategory,
      ]
    );


  /* ==========================================================
     CURRENT MANAGER CACHE SCOPE
  ========================================================== */

  const managerScopeKey =
    useMemo(
      () => {
        if (
          manager?.id ===
            undefined ||
          manager?.id ===
            null
        ) {
          return "manager:none";
        }


        return `manager:${manager.id}`;
      },
      [
        manager?.id,
      ]
    );


  /* ==========================================================
     REFRESH CURRENT MANAGER DATA
  ========================================================== */

  const refreshManagerData =
    useCallback(
      async () => {
        const generation =
          authGenerationRef.current;


        if (
          !isManagerSession()
        ) {
          resetManagerState();


          return;
        }


        /*
         * Do not use old Manager arrays while refresh is
         * happening after an authentication change.
         */
        await Promise.allSettled([
          loadManagerProfile(
            generation
          ),

          loadFilterOptions(
            generation
          ),

          loadNotificationCount(
            generation
          ),
        ]);
      },
      [
        isManagerSession,
        loadManagerProfile,
        loadFilterOptions,
        loadNotificationCount,
        resetManagerState,
      ]
    );


  /* ==========================================================
     AUTHENTICATION CHANGE HANDLER
  ========================================================== */

  const handleAuthenticationChange =
    useCallback(
      () => {
        /*
         * Immediately invalidate all requests started by the
         * previous Manager.
         */
        authGenerationRef.current +=
          1;


        const nextGeneration =
          authGenerationRef.current;


        /*
         * Remove Manager A from React memory immediately.
         */
        resetManagerState();


        /*
         * Causes the authenticated-load effect below to fetch
         * fresh Manager B data using the new JWT.
         */
        setAuthGeneration(
          nextGeneration
        );
      },
      [
        resetManagerState,
      ]
    );


  /* ==========================================================
     LISTEN FOR SAME-TAB LOGIN / LOGOUT
  ========================================================== */

  useEffect(
    () => {
      window.addEventListener(
        "manager-auth-changed",
        handleAuthenticationChange
      );


      return () => {
        window.removeEventListener(
          "manager-auth-changed",
          handleAuthenticationChange
        );
      };
    },
    [
      handleAuthenticationChange,
    ]
  );


  /* ==========================================================
     LISTEN FOR CROSS-TAB ACCOUNT CHANGES
  ========================================================== */

  useEffect(
    () => {
      const handleStorage =
        (
          event
        ) => {
          /*
           * null means storage.clear().
           */
          if (
            event.key ===
              null ||
            AUTH_STORAGE_KEYS.has(
              event.key
            )
          ) {
            handleAuthenticationChange();
          }
        };


      window.addEventListener(
        "storage",
        handleStorage
      );


      return () => {
        window.removeEventListener(
          "storage",
          handleStorage
        );
      };
    },
    [
      handleAuthenticationChange,
    ]
  );


  /* ==========================================================
     LOAD CURRENT AUTHENTICATED MANAGER

     Runs:
     - on initial app mount
     - after Manager A -> Manager B
     - after logout/login
     - after authentication changes in another tab
  ========================================================== */

  useEffect(
    () => {
      const generation =
        authGenerationRef.current;


      if (
        !isManagerSession()
      ) {
        resetManagerState();


        return;
      }


      /*
       * New tenant starts from empty memory.
       *
       * There is intentionally no period where the old
       * Manager's arrays are shown while new data loads.
       */
      setManager(
        null
      );


      setHostels(
        []
      );


      setMessUnits(
        []
      );


      setSelectedHostel(
        ""
      );


      setSelectedMessUnit(
        ""
      );


      setSelectedMealCategory(
        "all"
      );


      setNotificationCount(
        0
      );


      setFilterError(
        ""
      );


      Promise.allSettled([
        loadManagerProfile(
          generation
        ),

        loadFilterOptions(
          generation
        ),

        loadNotificationCount(
          generation
        ),
      ]);
    },
    [
      authGeneration,
      isManagerSession,
      loadManagerProfile,
      loadFilterOptions,
      loadNotificationCount,
      resetManagerState,
    ]
  );


  /* ==========================================================
     CONTEXT VALUE
  ========================================================== */

  const value =
    useMemo(
      () => ({
        API_BASE_URL,

        apiFetch,

        manager,
        setManager,

        /*
         * Useful for cache/query keys.
         *
         * Example:
         * [
         *   managerScopeKey,
         *   "students",
         *   filters
         * ]
         *
         * This is frontend cache isolation only.
         * Backend authorization still comes from JWT.
         */
        managerScopeKey,

        hostels,
        messUnits,
        filteredMessUnits,

        selectedHostel,
        setSelectedHostel,

        selectedMessUnit,
        setSelectedMessUnit,

        selectedMealCategory,
        setSelectedMealCategory,

        selectedHostelData,
        selectedMessUnitData,

        filterQueryString,

        loadingFilters,
        filterError,

        sidebarOpen,
        setSidebarOpen,

        notificationCount,
        setNotificationCount,

        loadManagerProfile,
        loadFilterOptions,
        loadNotificationCount,

        refreshManagerData,

        /*
         * Used by ManagerHeader Sign Out.
         */
        resetManagerState,
      }),
      [
        apiFetch,

        manager,
        managerScopeKey,

        hostels,
        messUnits,
        filteredMessUnits,

        selectedHostel,
        selectedMessUnit,
        selectedMealCategory,

        selectedHostelData,
        selectedMessUnitData,

        filterQueryString,

        loadingFilters,
        filterError,

        sidebarOpen,

        notificationCount,

        loadManagerProfile,
        loadFilterOptions,
        loadNotificationCount,

        refreshManagerData,
        resetManagerState,
      ]
    );


  return (
    <ManagerContext.Provider
      value={
        value
      }
    >
      {children}
    </ManagerContext.Provider>
  );
}


/* ============================================================
   HOOK
============================================================ */

export function useManager() {
  const context =
    useContext(
      ManagerContext
    );


  if (!context) {
    throw new Error(
      "useManager must be used inside ManagerProvider."
    );
  }


  return context;
}


export default ManagerContext;