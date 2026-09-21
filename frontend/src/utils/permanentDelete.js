export const PERMANENT_DELETE_CONFIRMATION =
  "DELETE";


export function isPermanentDeleteConfirmationValid(
  value
) {
  return (
    typeof value === "string" &&
    value ===
      PERMANENT_DELETE_CONFIRMATION
  );
}


export function buildPermanentDeleteBody(
  confirmation
) {
  return {
    confirmation,
  };
}


export function getPermanentDeleteErrorMessage(
  error,
  fallbackMessage =
    "Unable to permanently delete this record."
) {
  if (!error) {
    return fallbackMessage;
  }

  if (
    typeof error === "string" &&
    error.trim()
  ) {
    return error.trim();
  }

  if (
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  return fallbackMessage;
}


export function createPermanentDeleteRequestGuard() {
  let inFlight = false;

  return {
    isInFlight() {
      return inFlight;
    },

    tryStart() {
      if (inFlight) {
        return false;
      }

      inFlight = true;
      return true;
    },

    finish() {
      inFlight = false;
    },
  };
}