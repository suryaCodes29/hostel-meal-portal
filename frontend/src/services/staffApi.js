import { clearStudentSession, getStoredToken } from "./studentApi";
import { API_BASE_URL } from "./apiConfig";

export async function staffRequest(path, options = {}) {
  const token = getStoredToken();
  if (!token) {
    const error = new Error("Your session has expired. Please sign in again.");
    error.status = 401;
    clearStudentSession();
    window.dispatchEvent(
      new CustomEvent("auth-session-expired", {
        detail: { role: "staff", status: 401, message: error.message },
      })
    );
    throw error;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body != null ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (cause) {
    const error = new Error(
      "Unable to reach the server. Check your backend connection and try again."
    );
    error.status = 0;
    error.cause = cause;
    throw error;
  }

  let data = {};
  try {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text ? { message: text } : {};
    }
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = new Error(
      data?.message || `Staff request failed with HTTP ${response.status}.`
    );
    error.status = response.status;
    error.data = data;

    if (response.status === 401 && getStoredToken() === token) {
      clearStudentSession();
      window.dispatchEvent(
        new CustomEvent("auth-session-expired", {
          detail: { role: "staff", status: 401, message: error.message },
        })
      );
    }

    throw error;
  }
  return data;
}
