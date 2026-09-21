import { Navigate } from "react-router-dom";


function readStoredUser() {
  const value =
    localStorage.getItem("user") ||
    localStorage.getItem("currentUser") ||
    sessionStorage.getItem("user") ||
    sessionStorage.getItem("currentUser");


  if (!value) {
    return null;
  }


  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}


function ManagerProtectedRoute({
  children,
}) {
  const token =
    localStorage.getItem(
      "accessToken"
    ) ||
    localStorage.getItem(
      "token"
    ) ||
    sessionStorage.getItem(
      "accessToken"
    ) ||
    sessionStorage.getItem(
      "token"
    );


  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }


  const user =
    readStoredUser();


  /*
   * If user information exists,
   * make sure it belongs to Manager.
   *
   * If user information has not yet
   * been restored but JWT exists,
   * allow ManagerContext to verify
   * the session through the backend.
   */
  if (
    user &&
    user.role &&
    user.role !== "manager"
  ) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }


  if (
    user?.mustChangePassword === true ||
    user?.must_change_password === true
  ) {
    return (
      <Navigate
        to="/change-password"
        replace
      />
    );
  }


  return children;
}


export default ManagerProtectedRoute;