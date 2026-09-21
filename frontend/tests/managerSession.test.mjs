import assert from "node:assert/strict";

import {
  afterEach,
  beforeEach,
  test,
} from "node:test";


/* ============================================================
   BROWSER STORAGE MOCK
============================================================ */

class MemoryStorage {
  constructor() {
    this.data =
      new Map();
  }


  get length() {
    return this.data.size;
  }


  key(index) {
    const keys =
      Array.from(
        this.data.keys()
      );


    return (
      keys[index] ??
      null
    );
  }


  getItem(key) {
    const normalizedKey =
      String(
        key
      );


    if (
      !this.data.has(
        normalizedKey
      )
    ) {
      return null;
    }


    return this.data.get(
      normalizedKey
    );
  }


  setItem(
    key,
    value
  ) {
    this.data.set(
      String(
        key
      ),
      String(
        value
      )
    );
  }


  removeItem(key) {
    this.data.delete(
      String(
        key
      )
    );
  }


  clear() {
    this.data.clear();
  }
}


/* ============================================================
   WINDOW / CUSTOM EVENT MOCK
============================================================ */

class TestWindow
  extends EventTarget {
}


if (
  typeof globalThis.CustomEvent ===
  "undefined"
) {
  globalThis.CustomEvent =
    class CustomEvent
      extends Event {

      constructor(
        type,
        options = {}
      ) {
        super(
          type,
          options
        );


        this.detail =
          options.detail;
      }
    };
}


/* ============================================================
   GLOBAL TEST ENVIRONMENT
============================================================ */

globalThis.localStorage =
  new MemoryStorage();


globalThis.sessionStorage =
  new MemoryStorage();


globalThis.window =
  new TestWindow();


/*
 * Import only after the browser globals above exist.
 */
const {
  clearAuthenticationState,
  clearManagerLogoutSession,
  clearManagerTenantState,
  clearPreviousManagerSession,
  notifyManagerAuthChanged,
  storeAuthenticatedSession,
} = await import(
  "../src/utils/managerSession.js"
);


/* ============================================================
   HELPERS
============================================================ */

function seedManagerAState() {
  const managerA = {
    id:
      101,

    name:
      "Manager A",

    email:
      "manager.a@test.local",

    role:
      "manager",
  };


  localStorage.setItem(
    "accessToken",
    "token-manager-a"
  );


  localStorage.setItem(
    "token",
    "token-manager-a"
  );


  localStorage.setItem(
    "user",
    JSON.stringify(
      managerA
    )
  );


  localStorage.setItem(
    "currentUser",
    JSON.stringify(
      managerA
    )
  );


  localStorage.setItem(
    "role",
    "manager"
  );


  localStorage.setItem(
    "selectedRole",
    "manager"
  );


  /*
   * Tenant-specific Manager A state.
   */
  localStorage.setItem(
    "selectedHostel",
    "11"
  );


  localStorage.setItem(
    "selectedMessUnit",
    "21"
  );


  localStorage.setItem(
    "selectedMealCategory",
    "non-veg"
  );


  localStorage.setItem(
    "managerSelectedHostel",
    "11"
  );


  localStorage.setItem(
    "managerSelectedMessUnit",
    "21"
  );


  localStorage.setItem(
    "managerSelectedMealCategory",
    "non-veg"
  );


  localStorage.setItem(
    "managerDashboardData",
    JSON.stringify({
      totalStudents:
        120,

      activeStaff:
        14,
    })
  );


  localStorage.setItem(
    "managerStudents",
    JSON.stringify([
      {
        id:
          501,

        name:
          "Manager A Student",
      },
    ])
  );


  localStorage.setItem(
    "managerStaff",
    JSON.stringify([
      {
        id:
          601,

        name:
          "Manager A Staff",
      },
    ])
  );


  localStorage.setItem(
    "managerMessUnits",
    JSON.stringify([
      {
        id:
          21,

        name:
          "Manager A North Mess",
      },
    ])
  );


  localStorage.setItem(
    "managerHostels",
    JSON.stringify([
      {
        id:
          11,

        name:
          "Krishna Hostel",
      },
    ])
  );


  localStorage.setItem(
    "managerSessionUserId",
    "101"
  );


  localStorage.setItem(
    "managerScopeId",
    "101"
  );


  localStorage.setItem(
    "managerScopeKey",
    "manager:101"
  );


  /*
   * Prefix-based cache entries.
   */
  localStorage.setItem(
    "manager-cache:students:101",
    "manager-a-students"
  );


  localStorage.setItem(
    "manager-query:overview:101",
    "manager-a-overview"
  );


  localStorage.setItem(
    "manager-dashboard:101",
    "manager-a-dashboard"
  );


  localStorage.setItem(
    "manager-data:forecasts:101",
    "manager-a-forecast"
  );


  /*
   * Session copies to prove both storage locations are cleared.
   */
  sessionStorage.setItem(
    "accessToken",
    "old-session-token-a"
  );


  sessionStorage.setItem(
    "token",
    "old-session-token-a"
  );


  sessionStorage.setItem(
    "user",
    JSON.stringify(
      managerA
    )
  );


  sessionStorage.setItem(
    "selectedHostel",
    "11"
  );


  sessionStorage.setItem(
    "selectedMessUnit",
    "21"
  );


  sessionStorage.setItem(
    "managerSessionUserId",
    "101"
  );


  sessionStorage.setItem(
    "manager-cache:staff:101",
    "manager-a-staff"
  );
}


function assertManagerAStateRemoved() {
  const keysThatMustBeGone = [
    "selectedHostel",
    "selectedMessUnit",
    "selectedMealCategory",

    "managerSelectedHostel",
    "managerSelectedMessUnit",
    "managerSelectedMealCategory",

    "managerDashboardData",
    "managerStudents",
    "managerStaff",
    "managerMessUnits",
    "managerHostels",

    "managerScopeId",
    "managerScopeKey",

    "manager-cache:students:101",
    "manager-query:overview:101",
    "manager-dashboard:101",
    "manager-data:forecasts:101",
  ];


  for (
    const key
    of keysThatMustBeGone
  ) {
    assert.equal(
      localStorage.getItem(
        key
      ),
      null,
      `${key} remained in localStorage`
    );
  }


  const sessionKeysThatMustBeGone = [
    "selectedHostel",
    "selectedMessUnit",
    "manager-cache:staff:101",
  ];


  for (
    const key
    of sessionKeysThatMustBeGone
  ) {
    assert.equal(
      sessionStorage.getItem(
        key
      ),
      null,
      `${key} remained in sessionStorage`
    );
  }
}


/* ============================================================
   TEST LIFECYCLE
============================================================ */

beforeEach(() => {
  localStorage.clear();

  sessionStorage.clear();
});


afterEach(() => {
  localStorage.clear();

  sessionStorage.clear();
});


/* ============================================================
   TEST 1
   TENANT STATE CLEANUP
============================================================ */

test(
  "clearManagerTenantState removes Manager-specific filters and cache",
  () => {
    seedManagerAState();


    clearManagerTenantState();


    assertManagerAStateRemoved();


    /*
     * Authentication is intentionally not removed by this
     * function alone.
     */
    assert.equal(
      localStorage.getItem(
        "accessToken"
      ),
      "token-manager-a"
    );


    assert.equal(
      localStorage.getItem(
        "role"
      ),
      "manager"
    );
  }
);


/* ============================================================
   TEST 2
   FULL PREVIOUS SESSION CLEANUP
============================================================ */

test(
  "clearPreviousManagerSession removes old authentication and tenant data",
  () => {
    seedManagerAState();


    clearPreviousManagerSession({
      preserveSelectedRole:
        true,
    });


    assertManagerAStateRemoved();


    assert.equal(
      localStorage.getItem(
        "accessToken"
      ),
      null
    );


    assert.equal(
      localStorage.getItem(
        "token"
      ),
      null
    );


    assert.equal(
      localStorage.getItem(
        "user"
      ),
      null
    );


    assert.equal(
      localStorage.getItem(
        "currentUser"
      ),
      null
    );


    assert.equal(
      localStorage.getItem(
        "role"
      ),
      null
    );


    assert.equal(
      sessionStorage.getItem(
        "accessToken"
      ),
      null
    );


    assert.equal(
      sessionStorage.getItem(
        "token"
      ),
      null
    );


    /*
     * Role selection can remain for login-page convenience.
     * It is not backend authorization.
     */
    assert.equal(
      localStorage.getItem(
        "selectedRole"
      ),
      "manager"
    );
  }
);


/* ============================================================
   TEST 3
   MANAGER A -> MANAGER B
============================================================ */

test(
  "Manager B login cannot reuse Manager A cached data",
  () => {
    seedManagerAState();


    const managerB = {
      id:
        202,

      name:
        "Manager B",

      email:
        "manager.b@test.local",

      role:
        "manager",
    };


    let authChangedCount =
      0;


    const handleAuthChanged =
      () => {
        authChangedCount +=
          1;
      };


    window.addEventListener(
      "manager-auth-changed",
      handleAuthChanged
    );


    storeAuthenticatedSession({
      token:
        "token-manager-b",

      user:
        managerB,

      role:
        "manager",

      rememberMe:
        true,
    });


    window.removeEventListener(
      "manager-auth-changed",
      handleAuthChanged
    );


    /*
     * Old Manager A tenant data must be gone.
     */
    assertManagerAStateRemoved();


    /*
     * New authentication must belong only to Manager B.
     */
    assert.equal(
      localStorage.getItem(
        "accessToken"
      ),
      "token-manager-b"
    );


    assert.equal(
      localStorage.getItem(
        "token"
      ),
      "token-manager-b"
    );


    assert.equal(
      localStorage.getItem(
        "role"
      ),
      "manager"
    );


    assert.equal(
      localStorage.getItem(
        "managerSessionUserId"
      ),
      "202"
    );


    const storedUser =
      JSON.parse(
        localStorage.getItem(
          "currentUser"
        )
      );


    assert.equal(
      storedUser.id,
      202
    );


    assert.equal(
      storedUser.name,
      "Manager B"
    );


    assert.equal(
      storedUser.email,
      "manager.b@test.local"
    );


    /*
     * Manager B must start with no Manager A filters.
     */
    assert.equal(
      localStorage.getItem(
        "selectedHostel"
      ),
      null
    );


    assert.equal(
      localStorage.getItem(
        "selectedMessUnit"
      ),
      null
    );


    assert.equal(
      localStorage.getItem(
        "selectedMealCategory"
      ),
      null
    );


    /*
     * The context listens for this event and clears its
     * in-memory tenant arrays before fetching Manager B data.
     */
    assert.equal(
      authChangedCount,
      1
    );
  }
);


/* ============================================================
   TEST 4
   REMEMBER-ME FALSE
============================================================ */

test(
  "session-only login removes previous persistent Manager authentication",
  () => {
    seedManagerAState();


    const managerB = {
      id:
        202,

      name:
        "Manager B",

      email:
        "manager.b@test.local",

      role:
        "manager",
    };


    storeAuthenticatedSession({
      token:
        "session-token-manager-b",

      user:
        managerB,

      role:
        "manager",

      rememberMe:
        false,
    });


    /*
     * Persistent Manager A auth must not coexist with the
     * new session-only Manager B authentication.
     */
    assert.equal(
      localStorage.getItem(
        "accessToken"
      ),
      null
    );


    assert.equal(
      localStorage.getItem(
        "token"
      ),
      null
    );


    assert.equal(
      localStorage.getItem(
        "user"
      ),
      null
    );


    assert.equal(
      localStorage.getItem(
        "currentUser"
      ),
      null
    );


    assert.equal(
      localStorage.getItem(
        "role"
      ),
      null
    );


    assert.equal(
      sessionStorage.getItem(
        "accessToken"
      ),
      "session-token-manager-b"
    );


    assert.equal(
      sessionStorage.getItem(
        "token"
      ),
      "session-token-manager-b"
    );


    assert.equal(
      sessionStorage.getItem(
        "role"
      ),
      "manager"
    );


    assert.equal(
      sessionStorage.getItem(
        "managerSessionUserId"
      ),
      "202"
    );


    assertManagerAStateRemoved();
  }
);


/* ============================================================
   TEST 5
   LOGOUT
============================================================ */

test(
  "Manager logout clears authentication and all tenant-specific state",
  () => {
    seedManagerAState();


    let authChangedCount =
      0;


    const handleAuthChanged =
      () => {
        authChangedCount +=
          1;
      };


    window.addEventListener(
      "manager-auth-changed",
      handleAuthChanged
    );


    clearManagerLogoutSession();


    window.removeEventListener(
      "manager-auth-changed",
      handleAuthChanged
    );


    assertManagerAStateRemoved();


    assert.equal(
      localStorage.getItem(
        "accessToken"
      ),
      null
    );


    assert.equal(
      localStorage.getItem(
        "token"
      ),
      null
    );


    assert.equal(
      localStorage.getItem(
        "user"
      ),
      null
    );


    assert.equal(
      localStorage.getItem(
        "currentUser"
      ),
      null
    );


    assert.equal(
      localStorage.getItem(
        "role"
      ),
      null
    );


    assert.equal(
      sessionStorage.getItem(
        "accessToken"
      ),
      null
    );


    assert.equal(
      sessionStorage.getItem(
        "token"
      ),
      null
    );


    /*
     * Login UI may remember only the selected role.
     */
    assert.equal(
      localStorage.getItem(
        "selectedRole"
      ),
      "manager"
    );


    assert.equal(
      sessionStorage.getItem(
        "selectedRole"
      ),
      "manager"
    );


    assert.equal(
      authChangedCount,
      1
    );
  }
);


/* ============================================================
   TEST 6
   AUTH CLEARING WITHOUT PRESERVING ROLE
============================================================ */

test(
  "clearAuthenticationState can remove selectedRole when requested",
  () => {
    seedManagerAState();


    clearAuthenticationState({
      preserveSelectedRole:
        false,
    });


    assert.equal(
      localStorage.getItem(
        "accessToken"
      ),
      null
    );


    assert.equal(
      localStorage.getItem(
        "role"
      ),
      null
    );


    assert.equal(
      localStorage.getItem(
        "selectedRole"
      ),
      null
    );


    assert.equal(
      sessionStorage.getItem(
        "selectedRole"
      ),
      null
    );
  }
);


/* ============================================================
   TEST 7
   AUTH CHANGE EVENT
============================================================ */

test(
  "notifyManagerAuthChanged emits the event used by ManagerContext",
  () => {
    let count =
      0;


    const listener =
      () => {
        count +=
          1;
      };


    window.addEventListener(
      "manager-auth-changed",
      listener
    );


    notifyManagerAuthChanged();


    window.removeEventListener(
      "manager-auth-changed",
      listener
    );


    assert.equal(
      count,
      1
    );
  }
);


/* ============================================================
   TEST 8
   NON-MANAGER LOGIN MUST NOT CREATE MANAGER TENANT ID
============================================================ */

test(
  "Student login does not create a Manager tenant cache identifier",
  () => {
    seedManagerAState();


    const student = {
      id:
        303,

      name:
        "Student Account",

      email:
        "student@test.local",

      role:
        "student",
    };


    storeAuthenticatedSession({
      token:
        "student-token",

      user:
        student,

      role:
        "student",

      rememberMe:
        true,
    });


    /*
     * Old Manager state is still required to be removed even
     * when switching Manager -> Student.
     */
    assertManagerAStateRemoved();


    assert.equal(
      localStorage.getItem(
        "accessToken"
      ),
      "student-token"
    );


    assert.equal(
      localStorage.getItem(
        "role"
      ),
      "student"
    );


    assert.equal(
      localStorage.getItem(
        "managerSessionUserId"
      ),
      null
    );
  }
);