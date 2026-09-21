const AUTH_STORAGE_KEYS = [
  "accessToken",
  "token",
  "authToken",
  "user",
  "currentUser",
  "role",
];


const MANAGER_TENANT_STORAGE_KEYS = [
  /*
   * Global Manager filters.
   */
  "selectedHostel",
  "selectedMessUnit",
  "selectedMealCategory",

  "managerSelectedHostel",
  "managerSelectedMessUnit",
  "managerSelectedMealCategory",

  "managerHostelFilter",
  "managerMessUnitFilter",
  "managerMealCategoryFilter",

  "managerFilters",
  "managerDashboardFilters",
  "managerFilterState",

  /*
   * Manager-specific dashboard/page data that older
   * versions of the frontend may have persisted.
   */
  "managerDashboardData",
  "managerOverviewData",
  "managerStudents",
  "managerStaff",
  "managerMessUnits",
  "managerHostels",
  "managerMenus",
  "managerForecasts",
  "managerReports",
  "managerNotifications",

  /*
   * Page-specific selections.
   */
  "managerStudentSearch",
  "managerStaffSearch",
  "managerMenuSearch",
  "managerReportSearch",
  "managerForecastSearch",

  "managerStudentPage",
  "managerStaffPage",
  "managerMenuPage",
  "managerReportPage",
  "managerForecastPage",

  /*
   * Previous Manager UI/session values.
   *
   * managerPortalSettings is cleared because the existing
   * frontend stores it globally rather than namespaced by
   * Manager ID. Keeping it would expose Manager A's portal
   * preferences to Manager B.
   */
  "managerPortalSettings",

  "managerProfile",
  "managerProfileData",

  "managerSidebarState",
  "managerSidebarCollapsed",

  "managerSessionUserId",
  "managerScopeId",
  "managerScopeKey",
];


const MANAGER_CACHE_PREFIXES = [
  "manager-cache:",
  "managerCache:",

  "manager-query:",
  "managerQuery:",

  "manager-dashboard:",
  "managerDashboard:",

  "manager-data:",
  "managerData:",

  "manager-filter:",
  "managerFilter:",

  "manager-user:",
  "managerUser:",
];


function getStorageKeys(storage) {
  const keys = [];


  for (
    let index = 0;
    index < storage.length;
    index += 1
  ) {
    const key =
      storage.key(
        index
      );


    if (key) {
      keys.push(
        key
      );
    }
  }


  return keys;
}


function removeKeys(
  storage,
  keys
) {
  keys.forEach(
    (key) => {
      storage.removeItem(
        key
      );
    }
  );
}


function removeManagerCachePrefixes(
  storage
) {
  const keys =
    getStorageKeys(
      storage
    );


  keys.forEach(
    (key) => {
      const shouldRemove =
        MANAGER_CACHE_PREFIXES.some(
          (prefix) =>
            key.startsWith(
              prefix
            )
        );


      if (
        shouldRemove
      ) {
        storage.removeItem(
          key
        );
      }
    }
  );
}


/**
 * Remove Manager-specific frontend data.
 *
 * This does NOT remove unrelated Student/Staff/application
 * data and does NOT perform any backend authorization.
 *
 * Backend JWT ownership checks remain the security authority.
 */
export function clearManagerTenantState() {
  removeKeys(
    localStorage,
    MANAGER_TENANT_STORAGE_KEYS
  );


  removeKeys(
    sessionStorage,
    MANAGER_TENANT_STORAGE_KEYS
  );


  removeManagerCachePrefixes(
    localStorage
  );


  removeManagerCachePrefixes(
    sessionStorage
  );
}


/**
 * Clear authentication values from both storage locations.
 *
 * preserveSelectedRole=true is useful when returning to the
 * login screen and we still want the Manager role card selected.
 */
export function clearAuthenticationState({
  preserveSelectedRole = false,
} = {}) {
  removeKeys(
    localStorage,
    AUTH_STORAGE_KEYS
  );


  removeKeys(
    sessionStorage,
    AUTH_STORAGE_KEYS
  );


  if (
    !preserveSelectedRole
  ) {
    localStorage.removeItem(
      "selectedRole"
    );


    sessionStorage.removeItem(
      "selectedRole"
    );
  }
}


/**
 * Fully clear a previous Manager session before another account
 * is stored.
 */
export function clearPreviousManagerSession({
  preserveSelectedRole = true,
} = {}) {
  clearManagerTenantState();


  clearAuthenticationState({
    preserveSelectedRole,
  });
}


/**
 * Notify same-tab Manager components that authentication has
 * changed.
 *
 * The ManagerContext listens for this event and immediately
 * clears in-memory Hostels, Mess Units, filters and counts.
 */
export function notifyManagerAuthChanged() {
  window.dispatchEvent(
    new CustomEvent(
      "manager-auth-changed"
    )
  );
}


/**
 * Remove the previous Manager tenant state, store the new
 * authenticated user and token, and notify Manager components.
 *
 * This helper is intended to be called only AFTER the backend
 * has successfully authenticated the user.
 */
export function storeAuthenticatedSession({
  token,
  user,
  role,
  rememberMe = true,
}) {
  const safeRole =
    String(
      role ||
      user?.role ||
      ""
    )
      .trim()
      .toLowerCase();


  const serializedUser =
    JSON.stringify(
      user ||
      {}
    );


  /*
   * The previous account's frontend state must disappear
   * before the new account is written.
   */
  clearPreviousManagerSession({
    preserveSelectedRole:
      true,
  });


  if (
    rememberMe
  ) {
    localStorage.setItem(
      "accessToken",
      token
    );


    localStorage.setItem(
      "token",
      token
    );


    localStorage.setItem(
      "user",
      serializedUser
    );


    localStorage.setItem(
      "currentUser",
      serializedUser
    );


    localStorage.setItem(
      "role",
      safeRole
    );


    /*
     * Remove session copies so an older session token can
     * never override or coexist with the new account.
     */
    sessionStorage.removeItem(
      "accessToken"
    );


    sessionStorage.removeItem(
      "token"
    );


    sessionStorage.removeItem(
      "authToken"
    );


    sessionStorage.removeItem(
      "user"
    );


    sessionStorage.removeItem(
      "currentUser"
    );


    sessionStorage.removeItem(
      "role"
    );

  } else {
    sessionStorage.setItem(
      "accessToken",
      token
    );


    sessionStorage.setItem(
      "token",
      token
    );


    sessionStorage.setItem(
      "user",
      serializedUser
    );


    sessionStorage.setItem(
      "currentUser",
      serializedUser
    );


    sessionStorage.setItem(
      "role",
      safeRole
    );


    /*
     * Remove persistent copies so an older remembered
     * Manager cannot be read after the new session login.
     */
    localStorage.removeItem(
      "accessToken"
    );


    localStorage.removeItem(
      "token"
    );


    localStorage.removeItem(
      "authToken"
    );


    localStorage.removeItem(
      "user"
    );


    localStorage.removeItem(
      "currentUser"
    );


    localStorage.removeItem(
      "role"
    );
  }


  localStorage.setItem(
    "selectedRole",
    safeRole
  );


  sessionStorage.setItem(
    "selectedRole",
    safeRole
  );


  /*
   * This value is for frontend cache separation only.
   *
   * Never send or trust it as backend ownership.
   */
  if (
    safeRole ===
      "manager" &&
    user?.id !==
      undefined &&
    user?.id !==
      null
  ) {
    const managerId =
      String(
        user.id
      );


    localStorage.setItem(
      "managerSessionUserId",
      managerId
    );


    sessionStorage.setItem(
      "managerSessionUserId",
      managerId
    );
  }


  notifyManagerAuthChanged();
}


/**
 * Logout helper for Manager UI.
 *
 * Only an explicit logout action should call this helper.
 */
export function clearManagerLogoutSession() {
  clearManagerTenantState();


  clearAuthenticationState({
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


  notifyManagerAuthChanged();
}
