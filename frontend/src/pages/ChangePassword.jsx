import {
  useState
} from "react";

import {
  useNavigate
} from "react-router-dom";

import {
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck
} from "lucide-react";

import { getStoredToken } from "../services/studentApi";
import { API_BASE_URL } from "../services/apiConfig";

import "../styles/auth.css";


function ChangePassword() {

  const navigate =
    useNavigate();


  const [
    currentPassword,
    setCurrentPassword
  ] = useState("");

  const [
    newPassword,
    setNewPassword
  ] = useState("");

  const [
    confirmPassword,
    setConfirmPassword
  ] = useState("");

  const [
    showCurrent,
    setShowCurrent
  ] = useState(false);

  const [
    showNew,
    setShowNew
  ] = useState(false);

  const [
    showConfirm,
    setShowConfirm
  ] = useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);


  const passwordValid =
    (password) => {

      return (
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/
      ).test(
        password
      );

    };


  const token = getStoredToken();

  const userString =
    localStorage.getItem("user") ||
    sessionStorage.getItem("user") ||
    localStorage.getItem("currentUser") ||
    sessionStorage.getItem("currentUser");


  const handleSubmit =
    async (event) => {

      event.preventDefault();

      setError("");
      setMessage("");


      if (
        !token ||
        !userString
      ) {

        navigate(
          "/login"
        );

        return;

      }


      if (
        !currentPassword
      ) {

        setError(
          "Please enter your current password."
        );

        return;

      }


      if (
        newPassword ===
        "Mess@123"
      ) {

        setError(
          "You cannot reuse the default password."
        );

        return;

      }


      if (
        !passwordValid(
          newPassword
        )
      ) {

        setError(
          "New password must contain at least "
          + "8 characters, one uppercase letter, "
          + "one lowercase letter, one number "
          + "and one special character."
        );

        return;

      }


      if (
        newPassword !==
        confirmPassword
      ) {

        setError(
          "New password and Confirm New Password "
          + "do not match."
        );

        return;

      }


      try {

        setLoading(
          true
        );


        const response =
          await fetch(
            `${API_BASE_URL}/api/auth/change-password`,
            {

              method:
                "POST",

              headers: {

                "Content-Type":
                    "application/json",

                Authorization:
                    `Bearer ${token}`

              },

              body:
                JSON.stringify({

                  currentPassword,

                  newPassword,

                  confirmPassword

                })

            }
          );


        const data =
          await response.json();


        if (!response.ok) {

          setError(
            data.message ||
            "Unable to change password."
          );

          return;

        }


        const user =
          JSON.parse(
            userString
          );


        user.mustChangePassword =
          false;


        storage.setItem(
          "user",
          JSON.stringify(
            user
          )
        );


        setMessage(
          "Password changed successfully."
        );


        setTimeout(
          () => {

            if (
              user.role ===
              "student"
            ) {

              navigate(
                "/student/dashboard"
              );

            }

            else if (
              user.role ===
              "staff"
            ) {

              navigate(
                "/staff/dashboard"
              );

            }

            else {

              navigate(
                "/manager/dashboard"
              );

            }

          },
          1200
        );

      }

      catch {

        setError(
          "Unable to connect to the server."
        );

      }

      finally {

        setLoading(
          false
        );

      }

    };


  return (

    <div className="auth-page">

      <div
        className=
          "login-section"
      >

        <div className="login-card">


          <div className="brand-logo">

            <ShieldCheck
              size={30}
            />

          </div>


          <div
            className=
              "login-heading"
          >

            <p
              className=
                "welcome-label"
            >
              SECURITY REQUIRED
            </p>

            <h2>
              Change your password
            </h2>

            <p>

              For security reasons,
              you must change your
              default password before
              continuing.

            </p>

          </div>


          {error && (

            <div
              className=
                "error-message"
            >
              {error}
            </div>

          )}


          {message && (

            <div
              style={{

                background:
                  "#edfbee",

                color:
                  "#218340",

                padding:
                  "13px",

                borderRadius:
                  "9px",

                marginBottom:
                  "18px"

              }}
            >
              {message}
            </div>

          )}


          <form
            onSubmit={
              handleSubmit
            }
          >


            <PasswordField

              label=
                "Current Password"

              value=
                {currentPassword}

              setValue=
                {setCurrentPassword}

              show=
                {showCurrent}

              setShow=
                {setShowCurrent}

            />


            <PasswordField

              label=
                "New Password"

              value=
                {newPassword}

              setValue=
                {setNewPassword}

              show=
                {showNew}

              setShow=
                {setShowNew}

            />


            <div
              style={{
                fontSize:
                  "12px",

                marginTop:
                  "-10px",

                marginBottom:
                  "18px",

                color:
                  passwordValid(
                    newPassword
                  )
                    ? "#218340"
                    : "#777"
              }}
            >

              At least 8 characters,
              uppercase, lowercase,
              number and special character.

            </div>


            <PasswordField

              label=
                "Confirm New Password"

              value=
                {confirmPassword}

              setValue=
                {setConfirmPassword}

              show=
                {showConfirm}

              setShow=
                {setShowConfirm}

            />


            {
              confirmPassword
              && (

                <div
                  style={{
                    fontSize:
                      "12px",

                    marginTop:
                      "-10px",

                    marginBottom:
                      "18px"
                  }}
                >

                  {
                    newPassword ===
                    confirmPassword
                      ? "✓ Passwords match"
                      : "✕ Passwords do not match"
                  }

                </div>

              )
            }


            <button

              className=
                "login-button"

              type="submit"

              disabled={
                loading
              }

            >

              {
                loading
                  ? "Changing Password..."
                  : "Change Password"
              }

            </button>

          </form>

        </div>

      </div>

    </div>

  );

}


function PasswordField({

  label,
  value,
  setValue,
  show,
  setShow

}) {

  return (

    <div
      className=
        "form-group"
    >

      <label>
        {label}
      </label>

      <div
        className=
          "input-wrapper"
      >

        <LockKeyhole
          size={19}
        />

        <input

          type={
            show
              ? "text"
              : "password"
          }

          value={
            value
          }

          onChange={
            (event) =>
              setValue(
                event.target.value
              )
          }

        />


        <button

          type="button"

          className=
            "password-toggle"

          onClick={
            () =>
              setShow(
                !show
              )
          }

        >

          {
            show
              ? (
                <EyeOff
                  size={19}
                />
              )
              : (
                <Eye
                  size={19}
                />
              )
          }

        </button>

      </div>

    </div>

  );

}


export default ChangePassword;