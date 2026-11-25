import {
  ChefHat,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  LockKeyhole,
  LogIn,
  Mail,
  ShieldCheck,
  UtensilsCrossed,
} from "lucide-react";

import {
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  storeAuthenticatedSession,
} from "../utils/managerSession";
import { API_BASE_URL } from "../services/apiConfig";

const VALID_ROLES = [
  "manager",
  "student",
  "staff",
];


const ROLE_OPTIONS = [
  {
    id: "manager",
    label: "Manager",
    description:
      "Manage hostels, students, staff and mess operations.",
    icon: ShieldCheck,
  },
  {
    id: "student",
    label: "Student",
    description:
      "View meal information and submit meal responses.",
    icon: GraduationCap,
  },
  {
    id: "staff",
    label: "Mess Staff",
    description:
      "Manage assigned mess operations and meal preparation.",
    icon: ChefHat,
  },
];


const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


function normalizeEmail(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}


function getSavedRole() {
  const candidates = [
    localStorage.getItem(
      "selectedRole"
    ),
    sessionStorage.getItem(
      "selectedRole"
    ),
    localStorage.getItem(
      "role"
    ),
    sessionStorage.getItem(
      "role"
    ),
  ];


  const matchedRole =
    candidates.find(
      (role) =>
        VALID_ROLES.includes(
          String(
            role || ""
          ).toLowerCase()
        )
    );


  return matchedRole
    ? String(
        matchedRole
      ).toLowerCase()
    : "manager";
}


function getDashboardPath(
  role
) {
  switch (role) {
    case "manager":
      return "/manager/dashboard";

    case "student":
      return "/student/dashboard";

    case "staff":
      return "/staff/dashboard";

    default:
      return "/login";
  }
}


function Login() {
  const navigate =
    useNavigate();


  const location =
    useLocation();


  const submittingRef =
    useRef(false);


  const initialRole =
    useMemo(
      () => {
        const stateRole =
          String(
            location.state
              ?.selectedRole ||
            ""
          )
            .trim()
            .toLowerCase();


        if (
          VALID_ROLES.includes(
            stateRole
          )
        ) {
          return stateRole;
        }


        return getSavedRole();
      },
      [
        location.state,
      ]
    );


  const [
    selectedRole,
    setSelectedRole,
  ] = useState(
    initialRole
  );


  const [
    email,
    setEmail,
  ] = useState("");


  const [
    password,
    setPassword,
  ] = useState("");


  const [
    showPassword,
    setShowPassword,
  ] = useState(false);


  const [
    submitting,
    setSubmitting,
  ] = useState(false);


  const [
    emailError,
    setEmailError,
  ] = useState("");


  const [
    passwordError,
    setPasswordError,
  ] = useState("");


  const [
    generalError,
    setGeneralError,
  ] = useState("");


  const registrationSuccess =
    location.state
      ?.registrationSuccess ||
    "";


  const selectedRoleInfo =
    ROLE_OPTIONS.find(
      (role) =>
        role.id ===
        selectedRole
    ) ||
    ROLE_OPTIONS[0];


  const selectedRoleLabel =
    selectedRoleInfo.label;


  const validateForm = () => {
    const normalizedEmail =
      normalizeEmail(
        email
      );


    let valid = true;


    setEmailError("");
    setPasswordError("");
    setGeneralError("");


    if (!normalizedEmail) {
      setEmailError(
        "Email address is required."
      );

      valid = false;

    } else if (
      !EMAIL_PATTERN.test(
        normalizedEmail
      )
    ) {
      setEmailError(
        "Please enter a valid email address."
      );

      valid = false;
    }


    if (!password) {
      setPasswordError(
        "Password is required."
      );

      valid = false;
    }


    return valid;
  };


  const handleRoleChange = (
    role
  ) => {
    if (submitting) {
      return;
    }


    setSelectedRole(
      role
    );


    localStorage.setItem(
      "selectedRole",
      role
    );


    sessionStorage.setItem(
      "selectedRole",
      role
    );


    setGeneralError("");
    setEmailError("");
    setPasswordError("");
  };


  const handleEmailChange = (
    event
  ) => {
    setEmail(
      event.target.value
    );


    if (emailError) {
      setEmailError("");
    }


    if (generalError) {
      setGeneralError("");
    }
  };


  const handleEmailBlur = () => {
    setEmail(
      normalizeEmail(
        email
      )
    );
  };


  const handlePasswordChange = (
    event
  ) => {
    setPassword(
      event.target.value
    );


    if (passwordError) {
      setPasswordError("");
    }


    if (generalError) {
      setGeneralError("");
    }
  };


  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();


    /*
     * Prevent duplicate Login requests caused by
     * fast double-clicking.
     */
    if (
      submittingRef.current
    ) {
      return;
    }


    if (!validateForm()) {
      return;
    }


    const normalizedEmail =
      normalizeEmail(
        email
      );


    submittingRef.current =
      true;


    setSubmitting(
      true
    );


    setGeneralError("");


    try {
      const response =
        await fetch(
          `${API_BASE_URL}/api/auth/login`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            /*
             * Login itself must never be satisfied
             * from an HTTP cache.
             */
            cache:
              "no-store",

            body:
              JSON.stringify({
                email:
                  normalizedEmail,

                password,

                role:
                  selectedRole,
              }),
          }
        );


      let data = {};


      try {
        data =
          await response.json();

      } catch {
        data = {};
      }


      if (!response.ok) {
        setGeneralError(
          data?.message ||
          "Unable to sign in. Please check your credentials."
        );


        return;
      }


      const token =
        data?.access_token ||
        data?.accessToken ||
        data?.token ||
        "";


      const user =
        data?.user ||
        null;


      if (!token) {
        setGeneralError(
          "Login succeeded but the authentication token was not returned."
        );


        return;
      }


      if (!user) {
        setGeneralError(
          "Login succeeded but the user information was not returned."
        );


        return;
      }


      const returnedRole =
        String(
          user.role ||
          selectedRole
        )
          .trim()
          .toLowerCase();


      if (
        !VALID_ROLES.includes(
          returnedRole
        )
      ) {
        setGeneralError(
          "The server returned an invalid account role."
        );


        return;
      }


      if (
        returnedRole !==
        selectedRole
      ) {
        setGeneralError(
          `This account belongs to the ${returnedRole} role. Please select the correct role and try again.`
        );


        return;
      }


      /*
       * CRITICAL MULTI-TENANT FRONTEND ISOLATION
       *
       * Before the newly authenticated account is stored,
       * clear:
       *
       * - previous Manager filters
       * - previous Manager cache entries
       * - previous Manager dashboard state
       * - previous authentication storage
       *
       * Then store only this authenticated account.
       *
       * The user's ID stored by the helper is used only as
       * a frontend cache scope. Backend ownership continues
       * to come exclusively from the JWT.
       */
      storeAuthenticatedSession({
        token,
        user,
        role:
          returnedRole,

        rememberMe:
          true,
      });


      const dashboardPath =
        getDashboardPath(
          returnedRole
        );


      const mustChangePassword =
        Boolean(
          data?.mustChangePassword ??
          user?.mustChangePassword
        );


      if (
        mustChangePassword
      ) {
        navigate(
          "/change-password",
          {
            replace: true,

            state: {
              from:
                dashboardPath,

              role:
                returnedRole,
            },
          }
        );


        return;
      }


      navigate(
        dashboardPath,
        {
          replace: true,
        }
      );


    } catch (error) {
      console.error(
        "Login request failed:",
        error
      );


      setGeneralError(
        "Unable to connect to the server. Please make sure the Flask backend is running and try again."
      );


    } finally {
      submittingRef.current =
        false;


      setSubmitting(
        false
      );
    }
  };


  return (
    <main
      style={{
        minHeight:
          "100vh",

        display:
          "grid",

        gridTemplateColumns:
          "minmax(340px, 0.9fr) minmax(560px, 1.1fr)",

        background:
          "#f5f7fa",

        fontFamily:
          'Inter, "Segoe UI", Arial, sans-serif',

        color:
          "#0b2945",
      }}
      className="login-page"
    >

      {/* =====================================================
          LEFT BRAND PANEL
      ===================================================== */}

      <section
        style={{
          minHeight:
            "100vh",

          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "center",

          padding:
            "48px",

          background:
            "linear-gradient(145deg, #041f36 0%, #062e4f 55%, #0a4267 100%)",

          color:
            "#ffffff",
        }}
        className="login-brand-panel"
      >

        <div
          style={{
            width:
              "100%",

            maxWidth:
              "430px",
          }}
        >

          <div
            style={{
              width:
                "68px",

              height:
                "68px",

              display:
                "flex",

              alignItems:
                "center",

              justifyContent:
                "center",

              marginBottom:
                "25px",

              borderRadius:
                "18px",

              background:
                "#ff6500",

              boxShadow:
                "0 15px 32px rgba(255, 101, 0, 0.24)",
            }}
          >
            <UtensilsCrossed
              size={38}
              strokeWidth={2.2}
            />
          </div>


          <span
            style={{
              display:
                "block",

              marginBottom:
                "8px",

              color:
                "#ffb27f",

              fontSize:
                "12px",

              fontWeight:
                "800",

              letterSpacing:
                "0.12em",

              textTransform:
                "uppercase",
            }}
          >
            Hostel Mess
          </span>


          <h1
            style={{
              margin:
                "0",

              fontSize:
                "46px",

              fontWeight:
                "800",

              lineHeight:
                "1.08",

              letterSpacing:
                "-1px",
            }}
          >
            Management
            <br />
            Portal
          </h1>


          <p
            style={{
              maxWidth:
                "390px",

              margin:
                "20px 0 0",

              color:
                "#c6d2df",

              fontSize:
                "14px",

              lineHeight:
                "1.75",
            }}
          >
            Secure role-based access for Managers,
            Students and Mess Staff.
          </p>


          <div
            style={{
              marginTop:
                "32px",

              padding:
                "18px",

              border:
                "1px solid rgba(255,255,255,0.12)",

              borderRadius:
                "14px",

              background:
                "rgba(255,255,255,0.06)",
            }}
          >

            <div
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                gap:
                  "11px",
              }}
            >

              <ShieldCheck
                size={26}
                color="#ff8b40"
              />


              <div>
                <strong
                  style={{
                    display:
                      "block",

                    fontSize:
                      "13px",
                  }}
                >
                  Secure Authentication
                </strong>


                <span
                  style={{
                    display:
                      "block",

                    marginTop:
                      "4px",

                    color:
                      "#b8c7d6",

                    fontSize:
                      "11px",

                    lineHeight:
                      "1.5",
                  }}
                >
                  Sign in using your registered email
                  and assigned role.
                </span>
              </div>

            </div>

          </div>

        </div>

      </section>


      {/* =====================================================
          LOGIN PANEL
      ===================================================== */}

      <section
        style={{
          minHeight:
            "100vh",

          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "center",

          padding:
            "42px",
        }}
        className="login-form-panel"
      >

        <div
          style={{
            width:
              "100%",

            maxWidth:
              "650px",

            padding:
              "32px",

            border:
              "1px solid #dce4ec",

            borderRadius:
              "16px",

            background:
              "#ffffff",

            boxShadow:
              "0 14px 42px rgba(6, 46, 79, 0.075)",
          }}
          className="login-card"
        >

          {/* =================================================
              HEADING
          ================================================= */}

          <header
            style={{
              marginBottom:
                "24px",
            }}
          >

            <span
              style={{
                display:
                  "block",

                marginBottom:
                  "7px",

                color:
                  "#ff6500",

                fontSize:
                  "10px",

                fontWeight:
                  "800",

                letterSpacing:
                  "0.1em",

                textTransform:
                  "uppercase",
              }}
            >
              Welcome Back
            </span>


            <h2
              style={{
                margin:
                  "0",

                fontSize:
                  "26px",

                fontWeight:
                  "800",

                letterSpacing:
                  "-0.4px",
              }}
            >
              Sign In
            </h2>


            <p
              style={{
                margin:
                  "7px 0 0",

                color:
                  "#64748b",

                fontSize:
                  "12px",

                lineHeight:
                  "1.5",
              }}
            >
              Select your role and enter your account
              credentials.
            </p>

          </header>


          {/* =================================================
              REGISTRATION SUCCESS
          ================================================= */}

          {registrationSuccess && (
            <div
              role="status"
              style={{
                marginBottom:
                  "18px",

                padding:
                  "12px 14px",

                border:
                  "1px solid rgba(34, 167, 101, 0.28)",

                borderRadius:
                  "9px",

                background:
                  "rgba(34, 167, 101, 0.07)",

                color:
                  "#168753",

                fontSize:
                  "11px",

                fontWeight:
                  "650",

                lineHeight:
                  "1.5",
              }}
            >
              {registrationSuccess}
            </div>
          )}


          {/* =================================================
              ROLE SELECTION
          ================================================= */}

          <div
            style={{
              marginBottom:
                "23px",
            }}
          >

            <label
              style={{
                display:
                  "block",

                marginBottom:
                  "9px",

                color:
                  "#475569",

                fontSize:
                  "11px",

                fontWeight:
                  "700",
              }}
            >
              Select Role
            </label>


            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(3, minmax(0, 1fr))",

                gap:
                  "10px",
              }}
              className="login-role-grid"
            >

              {ROLE_OPTIONS.map(
                (role) => {
                  const Icon =
                    role.icon;


                  const active =
                    selectedRole ===
                    role.id;


                  return (
                    <button
                      key={
                        role.id
                      }
                      type="button"
                      onClick={() =>
                        handleRoleChange(
                          role.id
                        )
                      }
                      disabled={
                        submitting
                      }
                      aria-pressed={
                        active
                      }
                      style={{
                        appearance:
                          "none",

                        minHeight:
                          "94px",

                        display:
                          "flex",

                        flexDirection:
                          "column",

                        alignItems:
                          "flex-start",

                        justifyContent:
                          "center",

                        gap:
                          "6px",

                        padding:
                          "13px",

                        border:
                          active
                            ? "1px solid #ff6500"
                            : "1px solid #dce4ec",

                        borderRadius:
                          "11px",

                        background:
                          active
                            ? "rgba(255, 101, 0, 0.055)"
                            : "#ffffff",

                        color:
                          active
                            ? "#0b2945"
                            : "#64748b",

                        font:
                          "inherit",

                        textAlign:
                          "left",

                        cursor:
                          submitting
                            ? "not-allowed"
                            : "pointer",

                        transition:
                          "border-color 0.18s ease, background 0.18s ease",
                      }}
                    >

                      <Icon
                        size={21}
                        color={
                          active
                            ? "#ff6500"
                            : "#64748b"
                        }
                      />


                      <strong
                        style={{
                          color:
                            "#0b2945",

                          fontSize:
                            "11px",

                          fontWeight:
                            "800",
                        }}
                      >
                        {role.label}
                      </strong>


                      <span
                        style={{
                          fontSize:
                            "8px",

                          lineHeight:
                            "1.35",
                        }}
                      >
                        {role.description}
                      </span>

                    </button>
                  );
                }
              )}

            </div>

          </div>


          {/* =================================================
              LOGIN ERROR
          ================================================= */}

          {generalError && (
            <div
              role="alert"
              style={{
                marginBottom:
                  "17px",

                padding:
                  "12px 14px",

                border:
                  "1px solid rgba(220, 38, 38, 0.26)",

                borderRadius:
                  "9px",

                background:
                  "rgba(220, 38, 38, 0.065)",

                color:
                  "#b91c1c",

                fontSize:
                  "11px",

                fontWeight:
                  "650",

                lineHeight:
                  "1.5",
              }}
            >
              {generalError}
            </div>
          )}


          {/* =================================================
              FORM
          ================================================= */}

          <form
            onSubmit={
              handleSubmit
            }
            noValidate
          >

            {/* EMAIL */}

            <div
              style={{
                marginBottom:
                  "16px",
              }}
            >

              <label
                htmlFor="login-email"
                style={{
                  display:
                    "block",

                  marginBottom:
                    "7px",

                  color:
                    "#475569",

                  fontSize:
                    "11px",

                  fontWeight:
                    "700",
                }}
              >
                Registered Email
              </label>


              <div
                style={{
                  position:
                    "relative",

                  minHeight:
                    "46px",

                  display:
                    "flex",

                  alignItems:
                    "center",

                  border:
                    emailError
                      ? "1px solid #dc2626"
                      : "1px solid #dce4ec",

                  borderRadius:
                    "10px",

                  background:
                    "#ffffff",
                }}
              >

                <Mail
                  size={19}
                  style={{
                    position:
                      "absolute",

                    left:
                      "13px",

                    color:
                      emailError
                        ? "#dc2626"
                        : "#94a3b8",

                    pointerEvents:
                      "none",
                  }}
                />


                <input
                  id="login-email"
                  type="email"
                  value={
                    email
                  }
                  onChange={
                    handleEmailChange
                  }
                  onBlur={
                    handleEmailBlur
                  }
                  placeholder="Enter registered email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck="false"
                  disabled={
                    submitting
                  }
                  style={{
                    width:
                      "100%",

                    height:
                      "44px",

                    padding:
                      "0 13px 0 43px",

                    border:
                      "0",

                    outline:
                      "0",

                    borderRadius:
                      "9px",

                    background:
                      "transparent",

                    color:
                      "#0b2945",

                    font:
                      "inherit",

                    fontSize:
                      "12px",
                  }}
                />

              </div>


              {emailError && (
                <span
                  style={{
                    display:
                      "block",

                    marginTop:
                      "6px",

                    color:
                      "#b91c1c",

                    fontSize:
                      "9px",

                    fontWeight:
                      "650",
                  }}
                >
                  {emailError}
                </span>
              )}

            </div>


            {/* PASSWORD */}

            <div
              style={{
                marginBottom:
                  "18px",
              }}
            >

              <label
                htmlFor="login-password"
                style={{
                  display:
                    "block",

                  marginBottom:
                    "7px",

                  color:
                    "#475569",

                  fontSize:
                    "11px",

                  fontWeight:
                    "700",
                }}
              >
                Password
              </label>


              <div
                style={{
                  position:
                    "relative",

                  minHeight:
                    "46px",

                  display:
                    "flex",

                  alignItems:
                    "center",

                  border:
                    passwordError
                      ? "1px solid #dc2626"
                      : "1px solid #dce4ec",

                  borderRadius:
                    "10px",

                  background:
                    "#ffffff",
                }}
              >

                <LockKeyhole
                  size={19}
                  style={{
                    position:
                      "absolute",

                    left:
                      "13px",

                    color:
                      passwordError
                        ? "#dc2626"
                        : "#94a3b8",

                    pointerEvents:
                      "none",
                  }}
                />


                <input
                  id="login-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={
                    password
                  }
                  onChange={
                    handlePasswordChange
                  }
                  placeholder="Enter password"
                  autoComplete="current-password"
                  disabled={
                    submitting
                  }
                  style={{
                    width:
                      "100%",

                    height:
                      "44px",

                    padding:
                      "0 48px 0 43px",

                    border:
                      "0",

                    outline:
                      "0",

                    borderRadius:
                      "9px",

                    background:
                      "transparent",

                    color:
                      "#0b2945",

                    font:
                      "inherit",

                    fontSize:
                      "12px",
                  }}
                />


                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (current) =>
                        !current
                    )
                  }
                  disabled={
                    submitting
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  title={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  style={{
                    appearance:
                      "none",

                    position:
                      "absolute",

                    right:
                      "6px",

                    width:
                      "34px",

                    height:
                      "34px",

                    display:
                      "flex",

                    alignItems:
                      "center",

                    justifyContent:
                      "center",

                    padding:
                      "0",

                    border:
                      "0",

                    borderRadius:
                      "8px",

                    background:
                      "transparent",

                    color:
                      "#64748b",

                    cursor:
                      submitting
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {showPassword ? (
                    <EyeOff
                      size={19}
                    />
                  ) : (
                    <Eye
                      size={19}
                    />
                  )}
                </button>

              </div>


              {passwordError && (
                <span
                  style={{
                    display:
                      "block",

                    marginTop:
                      "6px",

                    color:
                      "#b91c1c",

                    fontSize:
                      "9px",

                    fontWeight:
                      "650",
                  }}
                >
                  {passwordError}
                </span>
              )}

            </div>


            {/* =================================================
                SUBMIT
            ================================================= */}

            <button
              type="submit"
              disabled={
                submitting
              }
              style={{
                appearance:
                  "none",

                width:
                  "100%",

                minHeight:
                  "46px",

                display:
                  "flex",

                alignItems:
                  "center",

                justifyContent:
                  "center",

                gap:
                  "8px",

                padding:
                  "0 18px",

                border:
                  "1px solid #ff6500",

                borderRadius:
                  "10px",

                background:
                  submitting
                    ? "#f58a45"
                    : "#ff6500",

                color:
                  "#ffffff",

                font:
                  "inherit",

                fontSize:
                  "12px",

                fontWeight:
                  "750",

                cursor:
                  submitting
                    ? "not-allowed"
                    : "pointer",

                boxShadow:
                  submitting
                    ? "none"
                    : "0 8px 20px rgba(255, 101, 0, 0.18)",
              }}
            >

              {submitting ? (
                <>
                  <Loader2
                    size={19}
                    style={{
                      animation:
                        "login-spinner 0.8s linear infinite",
                    }}
                  />

                  Signing In
                </>
              ) : (
                <>
                  <LogIn
                    size={19}
                  />

                  Sign In as{" "}
                  {selectedRoleLabel}
                </>
              )}

            </button>

          </form>


          {/* =================================================
              MANAGER REGISTRATION LINK

              Multiple Managers are allowed.
              This does not depend on managerExists.
          ================================================= */}

          {selectedRole ===
            "manager" && (

            <div
              style={{
                marginTop:
                  "19px",

                paddingTop:
                  "17px",

                borderTop:
                  "1px solid #edf1f5",

                textAlign:
                  "center",
              }}
            >

              <span
                style={{
                  color:
                    "#64748b",

                  fontSize:
                    "10px",
                }}
              >
                New Owner/Manager?
                {" "}
              </span>


              <Link
                to="/manager-register"
                onClick={() => {
                  localStorage.setItem(
                    "selectedRole",
                    "manager"
                  );

                  sessionStorage.setItem(
                    "selectedRole",
                    "manager"
                  );
                }}
                style={{
                  color:
                    "#ff6500",

                  fontSize:
                    "10px",

                  fontWeight:
                    "750",

                  textDecoration:
                    "none",
                }}
              >
                Create Account
              </Link>

            </div>
          )}


          {/* =================================================
              STUDENT INFORMATION
          ================================================= */}

          {selectedRole ===
            "student" && (

            <div
              style={{
                marginTop:
                  "18px",

                padding:
                  "11px 13px",

                borderRadius:
                  "9px",

                background:
                  "#f8fafc",

                color:
                  "#64748b",

                fontSize:
                  "9px",

                lineHeight:
                  "1.5",

                textAlign:
                  "center",
              }}
            >
              Student accounts are created and assigned by
              the Hostel Manager.
            </div>
          )}


          {/* =================================================
              STAFF INFORMATION
          ================================================= */}

          {selectedRole ===
            "staff" && (

            <div
              style={{
                marginTop:
                  "18px",

                padding:
                  "11px 13px",

                borderRadius:
                  "9px",

                background:
                  "#f8fafc",

                color:
                  "#64748b",

                fontSize:
                  "9px",

                lineHeight:
                  "1.5",

                textAlign:
                  "center",
              }}
            >
              Mess Staff accounts are created and assigned
              by the Hostel Manager.
            </div>
          )}

        </div>

      </section>


      <style>
        {`
          @keyframes login-spinner {
            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 900px) {
            .login-page {
              display: block !important;
            }

            .login-brand-panel {
              min-height: auto !important;
              padding: 32px 24px !important;
            }

            .login-form-panel {
              min-height: auto !important;
              padding: 30px 20px 44px !important;
            }
          }

          @media (max-width: 600px) {
            .login-role-grid {
              grid-template-columns: 1fr !important;
            }

            .login-brand-panel {
              padding: 26px 18px !important;
            }

            .login-form-panel {
              padding: 18px 12px 34px !important;
            }

            .login-card {
              padding: 22px 17px !important;
            }
          }
        `}
      </style>

    </main>
  );
}


export default Login;