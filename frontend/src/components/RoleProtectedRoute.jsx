import {
  Navigate
} from "react-router-dom";


function RoleProtectedRoute({

  requiredRole,
  children

}) {

  const token =
    localStorage.getItem(
      "token"
    )
    ||
    sessionStorage.getItem(
      "token"
    );


  const userString =
    localStorage.getItem(
      "user"
    )
    ||
    sessionStorage.getItem(
      "user"
    );


  if (
    !token ||
    !userString
  ) {

    return (

      <Navigate
        to="/login"
        replace
      />

    );

  }


  try {

    const user =
      JSON.parse(
        userString
      );


    if (
      user.role !==
      requiredRole
    ) {

      return (

        <Navigate
          to="/login"
          replace
        />

      );

    }


    if (
      user.mustChangePassword
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

  catch {

    return (

      <Navigate
        to="/login"
        replace
      />

    );

  }

}


export default RoleProtectedRoute;