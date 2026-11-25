// ============================================================
// STUDENT API SERVICE
// ============================================================
//
// Central Student API service.
//
// IMPORTANT:
// - Student identity is NOT taken from a student ID sent by
//   the frontend.
// - Backend resolves the authenticated Student from JWT.
// - All Student endpoints are protected by the backend.
// - This service automatically sends the JWT.
// ============================================================

import { API_BASE_URL } from "./apiConfig";


// ============================================================
// AUTH HELPERS
// ============================================================


export function getStoredToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("accessToken") ||
    sessionStorage.getItem("authToken") ||
    ""
  );
}



export function getStoredUser() {
  const raw =
    localStorage.getItem("user") ||
    sessionStorage.getItem("user") ||
    localStorage.getItem("currentUser") ||
    sessionStorage.getItem("currentUser");

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}


export function clearStudentSession() {
  const sessionKeys = [
    "token",
    "accessToken",
    "authToken",
    "user",
    "currentUser",
    "role",
    "hostelMealQrPasses",
  ];

  sessionKeys.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}


// ============================================================
// QUERY BUILDER
// ============================================================

export function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      value !== "all"
    ) {
      query.set(key, value);
    }
  });

  const result = query.toString();

  return result
    ? `?${result}`
    : "";
}


// ============================================================
// GENERIC API REQUEST
// ============================================================

async function request(
  endpoint,
  options = {}
) {
  const token = getStoredToken();

  if (!token) {
    const error = new Error("Your session has expired. Please sign in again.");
    error.status = 401;
    clearStudentSession();
    window.dispatchEvent(
      new CustomEvent("auth-session-expired", {
        detail: { role: "student", message: error.message },
      })
    );
    throw error;
  }

  const {
    method = "GET",
    body,
    responseType,
    skipJsonContentType = false,
    ...rest
  } = options;

  const headers = {
    Accept: "application/json",
    ...(rest.headers || {}),
  };


  // ----------------------------------------------------------
  // Authorization
  // ----------------------------------------------------------

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }


  // ----------------------------------------------------------
  // JSON Content-Type
  // ----------------------------------------------------------

  if (
    body !== undefined &&
    body !== null &&
    !skipJsonContentType &&
    !(body instanceof FormData)
  ) {
    headers["Content-Type"] =
      "application/json";
  }


  const url =
    endpoint.startsWith("http")
      ? endpoint
      : `${API_BASE_URL}${endpoint}`;


  let response;

  try {
    response = await fetch(
      url,
      {
        method,
        headers,
        body,
        ...rest,
      }
    );
  } catch (error) {
    const networkError = new Error(
      "Unable to connect to the server. Please make sure the backend is running."
    );
    networkError.status = 0;
    networkError.cause = error;
    throw networkError;
  }


  // ----------------------------------------------------------
  // Blob response
  // ----------------------------------------------------------

  if (responseType === "blob") {
    if (!response.ok) {
      let message =
        "Unable to download the requested file.";

      try {
        const errorData =
          await response.json();

        message =
          errorData?.message ||
          errorData?.error ||
          message;
      } catch {
        // Ignore JSON parsing failure
      }

      throw new Error(message);
    }

    return response.blob();
  }


  // ----------------------------------------------------------
  // Empty response
  // ----------------------------------------------------------

  if (response.status === 204) {
    return null;
  }


  // ----------------------------------------------------------
  // Parse JSON
  // ----------------------------------------------------------

  let data = null;

  try {
    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    if (
      contentType.includes(
        "application/json"
      )
    ) {
      data =
        await response.json();
    } else {
      const text =
        await response.text();

      data = text
        ? { message: text }
        : null;
    }
  } catch {
    data = null;
  }


  // ----------------------------------------------------------
  // Handle errors
  // ----------------------------------------------------------

  if (!response.ok) {

    const message =
      data?.message ||
      data?.error ||
      `Request failed with status ${response.status}.`;


    // --------------------------------------------------------
    // Session expired
    // --------------------------------------------------------

    if (
      response.status === 401
    ) {
      if (getStoredToken() === token) {
        clearStudentSession();
        window.dispatchEvent(
          new CustomEvent("auth-session-expired", {
            detail: { role: "student", status: 401, message },
          })
        );
      }
    }


    const error =
      new Error(message);

    error.status =
      response.status;

    error.data = data;

    throw error;
  }


  return data;
}


// ============================================================
// DASHBOARD
// ============================================================

export async function getStudentDashboard() {
  return request(
    "/api/student/dashboard"
  );
}


// ============================================================
// PROFILE
// ============================================================

export async function getStudentProfile() {
  return request(
    "/api/student/profile"
  );
}


export async function updateStudentProfile(
  payload
) {
  return request(
    "/api/student/profile",
    {
      method: "PATCH",
      body: JSON.stringify(
        payload
      ),
    }
  );
}


// ============================================================
// MENUS
// ============================================================

export async function getStudentMenus(
  params = {}
) {
  return request(
    `/api/student/menus${buildQuery(
      params
    )}`
  );
}


export async function getTodayMenus() {
  return request(
    "/api/student/menus/today"
  );
}


export async function getMenuCalendar(
  params = {}
) {
  return request(
    `/api/student/menus/calendar${buildQuery(
      params
    )}`
  );
}


export async function saveMealResponse(
  menuId,
  payload
) {
  return request(
    `/api/student/menus/${menuId}/response`,
    {
      method: "PUT",
      body: JSON.stringify(
        payload
      ),
    }
  );
}

// ============================================================
// MEAL QR TOKEN
// ============================================================

export async function generateMealQrToken(menuId) {
  return request(
    `/api/student/menus/${menuId}/qr-token`,
    {
      method: "POST",
    }
  );
}

// ============================================================
// RESPONSES
// ============================================================

export async function getStudentResponses(
  params = {}
) {
  return request(
    `/api/student/responses${buildQuery(
      params
    )}`
  );
}


// ============================================================
// MEAL HISTORY
// ============================================================

export async function getMealHistory(
  params = {}
) {
  return request(
    `/api/student/meal-history${buildQuery(
      params
    )}`
  );
}


export function getMealHistoryExportUrl(
  params = {}
) {
  return (
    `${API_BASE_URL}` +
    `/api/student/meal-history/export` +
    buildQuery(params)
  );
}


export async function downloadMealHistory(
  params = {}
) {
  return request(
    `/api/student/meal-history/export${buildQuery(
      params
    )}`,
    {
      responseType: "blob",
    }
  );
}


// ============================================================
// FEEDBACK
// ============================================================

export async function getStudentFeedback(
  params = {}
) {
  return request(
    `/api/student/feedback${buildQuery(
      params
    )}`
  );
}


export async function submitStudentFeedback(
  payload
) {
  const isFormData =
    payload instanceof FormData;

  return request(
    "/api/student/feedback",
    {
      method: "POST",

      ...(isFormData
        ? {
            body: payload,
            skipJsonContentType:
              true,
          }
        : {
            body:
              JSON.stringify(
                payload
              ),
          }),
    }
  );
}


// ============================================================
// ANNOUNCEMENTS
// ============================================================

export async function getStudentAnnouncements(
  params = {}
) {
  return request(
    `/api/student/announcements${buildQuery(
      params
    )}`
  );
}


export async function markAnnouncementRead(
  announcementId
) {
  return request(
    `/api/student/announcements/${announcementId}/read`,
    {
      method: "PATCH",
    }
  );
}


// ============================================================
// NOTIFICATIONS
// ============================================================

export async function getStudentNotifications(
  params = {}
) {
  return request(
    `/api/student/notifications${buildQuery(
      params
    )}`
  );
}


export async function markStudentNotificationRead(
  notificationId
) {
  return request(
    `/api/student/notifications/${notificationId}/read`,
    {
      method: "PATCH",
    }
  );
}


export async function markAllStudentNotificationsRead() {
  return request(
    "/api/student/notifications/read-all",
    {
      method: "PATCH",
    }
  );
}


// ============================================================
// SETTINGS
// ============================================================

export async function getStudentSettings() {
  return request(
    "/api/student/settings"
  );
}


export async function updateStudentSettings(
  payload
) {
  return request(
    "/api/student/settings",
    {
      method: "PATCH",
      body: JSON.stringify(
        payload
      ),
    }
  );
}


// ============================================================
// LOGOUT
// ============================================================

export function logout() {
  clearStudentSession();

  window.dispatchEvent(
    new CustomEvent(
      "student-logout"
    )
  );
}


// ============================================================
// COMPATIBILITY OBJECT
// ============================================================
//
// Your Student pages use:
//     studentApi.getCalendar()
//     studentApi.getTodayMenus()
//     studentApi.getResponses()
//     etc.
//
// Therefore we expose one studentApi object while also keeping
// the named exports above.
//

export const studentApi = {

  // Dashboard
  getDashboard:
    getStudentDashboard,

  getStudentDashboard:
    getStudentDashboard,


  // Profile
  getProfile:
    getStudentProfile,

  getStudentProfile:
    getStudentProfile,

  updateProfile:
    updateStudentProfile,

  updateStudentProfile:
    updateStudentProfile,


  // Menus
  getMenus:
    getStudentMenus,

  getStudentMenus:
    getStudentMenus,

  getTodayMenus:
    getTodayMenus,

  getCalendar:
    getMenuCalendar,

  getMenuCalendar:
    getMenuCalendar,

  saveMealResponse:
    saveMealResponse,

  submitMealResponse:
    async (
      menuId,
      responseValue
    ) => {
      const payload =
        typeof responseValue ===
        "string"
          ? {
              response:
                responseValue,
            }
          : responseValue;

      return saveMealResponse(
        menuId,
        payload
      );
    },
    generateMealQrToken:
  generateMealQrToken,

  // Responses
  getResponses:
    getStudentResponses,

  getStudentResponses:
    getStudentResponses,


  // Meal history
  getMealHistory:
    getMealHistory,

  getMealHistoryExportUrl:
    getMealHistoryExportUrl,

  downloadMealHistory:
    downloadMealHistory,

  downloadMealHistoryCsv:
    downloadMealHistory,


  // Feedback
  getFeedback:
    getStudentFeedback,

  getStudentFeedback:
    getStudentFeedback,

  submitFeedback:
    submitStudentFeedback,

  submitStudentFeedback:
    submitStudentFeedback,


  // Announcements
  getAnnouncements:
    getStudentAnnouncements,

  getStudentAnnouncements:
    getStudentAnnouncements,

  markAnnouncementRead:
    markAnnouncementRead,


  // Notifications
  getNotifications:
    getStudentNotifications,

  getStudentNotifications:
    getStudentNotifications,

  markNotificationRead:
    markStudentNotificationRead,

  markAllNotificationsRead:
    markAllStudentNotificationsRead,


  // Settings
  getSettings:
    getStudentSettings,

  getStudentSettings:
    getStudentSettings,

  updateSettings:
    updateStudentSettings,

  updateStudentSettings:
    updateStudentSettings,


  // Auth
  getStoredToken:
    getStoredToken,

  getStoredUser:
    getStoredUser,

  clearSession:
    clearStudentSession,

  logout:
    logout,
};


// ============================================================
// DEFAULT EXPORT
// ============================================================

export default studentApi;