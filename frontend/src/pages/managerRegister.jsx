import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  BadgeCheck,
  Building2,
  Eye,
  EyeOff,
  IdCard,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  User,
  UtensilsCrossed,
} from "lucide-react";

import {
  Link,
  useNavigate,
} from "react-router-dom";
import { API_BASE_URL } from "../services/apiConfig";

import "../styles/managerRegister.css";


const INITIAL_FORM = {
  name: "",
  managerId: "",
  email: "",
  mobileNumber: "",
  hostelName: "",
  hostelBlock: "",
  password: "",
  confirmPassword: "",
  termsAccepted: false,
};


const INITIAL_ERRORS = {
  name: "",
  managerId: "",
  email: "",
  mobileNumber: "",
  hostelName: "",
  hostelBlock: "",
  password: "",
  confirmPassword: "",
  termsAccepted: "",
};


const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


const MOBILE_PATTERN =
  /^[6-9]\d{9}$/;


const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;


function normalizeEmail(value) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}


function normalizeManagerId(value) {
  return String(
    value || ""
  )
    .trim()
    .toUpperCase();
}


function getPasswordStrength(password) {
  const value =
    String(
      password || ""
    );


  if (!value) {
    return {
      label: "",
      level: "",
    };
  }


  let score = 0;


  if (value.length >= 8) {
    score += 1;
  }


  if (
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value)
  ) {
    score += 1;
  }


  if (/\d/.test(value)) {
    score += 1;
  }


  if (
    /[@$!%*?&#]/.test(value)
  ) {
    score += 1;
  }


  if (score <= 1) {
    return {
      label: "Weak",
      level: "weak",
    };
  }


  if (score <= 3) {
    return {
      label: "Good",
      level: "good",
    };
  }


  return {
    label: "Strong",
    level: "strong",
  };
}


function ManagerRegister() {
  const navigate =
    useNavigate();


  const redirectTimerRef =
    useRef(null);


  const submittingRef =
    useRef(false);


  const [
    form,
    setForm,
  ] = useState(
    INITIAL_FORM
  );


  const [
    fieldErrors,
    setFieldErrors,
  ] = useState(
    INITIAL_ERRORS
  );


  const [
    generalError,
    setGeneralError,
  ] = useState("");


  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");


  const [
    submitting,
    setSubmitting,
  ] = useState(false);


  const [
    showPassword,
    setShowPassword,
  ] = useState(false);


  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);


  const passwordStrength =
    getPasswordStrength(
      form.password
    );


  const passwordsMatch =
    form.confirmPassword.length > 0 &&
    form.password ===
      form.confirmPassword;


  useEffect(() => {
    return () => {
      if (
        redirectTimerRef.current
      ) {
        window.clearTimeout(
          redirectTimerRef.current
        );
      }
    };
  }, []);


  const clearFieldError = (
    field
  ) => {
    setFieldErrors(
      (current) => ({
        ...current,
        [field]: "",
      })
    );
  };


  const handleInputChange = (
    event
  ) => {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;


    const nextValue =
      type === "checkbox"
        ? checked
        : value;


    setForm(
      (current) => ({
        ...current,
        [name]: nextValue,
      })
    );


    clearFieldError(
      name
    );


    /*
     * A stale API error must disappear as soon as
     * the user starts correcting the form.
     *
     * This is especially important for an old
     * "This email is already registered." message.
     */
    setGeneralError("");
    setSuccessMessage("");
  };


  const handleEmailBlur = () => {
    const normalized =
      normalizeEmail(
        form.email
      );


    setForm(
      (current) => ({
        ...current,
        email: normalized,
      })
    );
  };


  const handleManagerIdBlur = () => {
    const normalized =
      normalizeManagerId(
        form.managerId
      );


    setForm(
      (current) => ({
        ...current,
        managerId: normalized,
      })
    );
  };


  const validateForm = () => {
    const errors = {
      ...INITIAL_ERRORS,
    };


    const name =
      form.name.trim();


    const managerId =
      normalizeManagerId(
        form.managerId
      );


    const email =
      normalizeEmail(
        form.email
      );


    const mobileNumber =
      String(
        form.mobileNumber || ""
      ).trim();


    const hostelName =
      form.hostelName.trim();


    const hostelBlock =
      form.hostelBlock.trim();


    if (!name) {
      errors.name =
        "Manager full name is required.";
    }


    if (
      managerId &&
      managerId.length < 3
    ) {
      errors.managerId =
        "Please enter a valid Manager ID.";
    }


    if (!email) {
      errors.email =
        "Email address is required.";
    } else if (
      !EMAIL_PATTERN.test(
        email
      )
    ) {
      errors.email =
        "Please enter a valid email address.";
    }


    if (!mobileNumber) {
      errors.mobileNumber =
        "Mobile number is required.";
    } else if (
      !MOBILE_PATTERN.test(
        mobileNumber
      )
    ) {
      errors.mobileNumber =
        "Please enter a valid 10-digit mobile number.";
    }


    if (!hostelName) {
      errors.hostelName =
        "Hostel name is required.";
    }


    if (!hostelBlock) {
      errors.hostelBlock =
        "Hostel block is required.";
    }


    if (!form.password) {
      errors.password =
        "Password is required.";
    } else if (
      !PASSWORD_PATTERN.test(
        form.password
      )
    ) {
      errors.password =
        "Use at least 8 characters with uppercase, lowercase, number and special character.";
    }


    if (
      !form.confirmPassword
    ) {
      errors.confirmPassword =
        "Please confirm your password.";
    } else if (
      form.password !==
      form.confirmPassword
    ) {
      errors.confirmPassword =
        "Passwords do not match.";
    }


    if (
      !form.termsAccepted
    ) {
      errors.termsAccepted =
        "Please accept the Terms and Conditions.";
    }


    setFieldErrors(
      errors
    );


    return !Object.values(
      errors
    ).some(Boolean);
  };


  const applyBackendFieldError = (
    field,
    message
  ) => {
    const validFields = [
      "name",
      "managerId",
      "email",
      "mobileNumber",
      "hostelName",
      "hostelBlock",
      "password",
      "confirmPassword",
      "termsAccepted",
    ];


    if (
      !validFields.includes(
        field
      )
    ) {
      return false;
    }


    setFieldErrors(
      (current) => ({
        ...current,
        [field]:
          message ||
          "Please check this field.",
      })
    );


    return true;
  };


  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();


    /*
     * React state updates are asynchronous, so using only
     * `submitting` is not enough to prevent two requests from
     * an extremely fast double-click.
     *
     * The ref changes synchronously and blocks the second call.
     */
    if (
      submittingRef.current
    ) {
      return;
    }


    setGeneralError("");
    setSuccessMessage("");


    setFieldErrors(
      INITIAL_ERRORS
    );


    const isValid =
      validateForm();


    if (!isValid) {
      return;
    }


    submittingRef.current =
      true;


    setSubmitting(
      true
    );


    const normalizedEmail =
      normalizeEmail(
        form.email
      );


    const normalizedManagerId =
      normalizeManagerId(
        form.managerId
      );


    const payload = {
      name:
        form.name.trim(),

      email:
        normalizedEmail,

      mobileNumber:
        String(
          form.mobileNumber
        ).trim(),

      mobile:
        String(
          form.mobileNumber
        ).trim(),

      hostelName:
        form.hostelName.trim(),

      hostelBlock:
        form.hostelBlock.trim(),

      password:
        form.password,

      confirmPassword:
        form.confirmPassword,

      termsAccepted:
        form.termsAccepted,
    };


    /*
     * Manager ID is optional in the UI because the backend
     * can generate one safely. When the Manager enters one,
     * send the normalized ID and validate uniqueness.
     */
    if (
      normalizedManagerId
    ) {
      payload.managerId =
        normalizedManagerId;
    }


    try {
      const response =
        await fetch(
          `${API_BASE_URL}/api/auth/manager-register`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                payload
              ),
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
        const backendMessage =
          data?.message ||
          "Unable to create Manager account.";


        /*
         * Duplicate messages are shown only when the backend
         * identifies the actual conflicting field.
         */
        if (
          response.status === 409
        ) {
          if (
            data?.field ===
            "email"
          ) {
            applyBackendFieldError(
              "email",
              backendMessage
            );


            return;
          }


          if (
            data?.field ===
            "mobileNumber"
          ) {
            applyBackendFieldError(
              "mobileNumber",
              backendMessage
            );


            return;
          }


          if (
            data?.field ===
            "managerId"
          ) {
            applyBackendFieldError(
              "managerId",
              backendMessage
            );


            return;
          }


          /*
           * Never convert an unknown 409 into an email error.
           */
          setGeneralError(
            backendMessage
          );


          return;
        }


        if (
          data?.field &&
          applyBackendFieldError(
            data.field,
            backendMessage
          )
        ) {
          return;
        }


        setGeneralError(
          backendMessage
        );


        return;
      }


      const message =
        data?.message ||
        "Manager account created successfully. Please sign in.";


      setSuccessMessage(
        message
      );


      setGeneralError("");


      /*
       * The Login page can use either navigation state or its
       * existing selectedRole storage behaviour.
       *
       * No registration error is stored in localStorage.
       */
      localStorage.setItem(
        "selectedRole",
        "manager"
      );


      sessionStorage.setItem(
        "selectedRole",
        "manager"
      );


      redirectTimerRef.current =
        window.setTimeout(
          () => {
            navigate(
              "/login",
              {
                replace: true,

                state: {
                  selectedRole:
                    "manager",

                  registrationSuccess:
                    message,
                },
              }
            );
          },
          1200
        );


    } catch (error) {
      console.error(
        "Manager registration request failed:",
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
    <main className="manager-register-page">
      <section className="manager-register-brand-panel">
        <div className="manager-register-brand-content">
          <div className="manager-register-logo">
            <UtensilsCrossed
              size={38}
              strokeWidth={2.2}
            />
          </div>


          <div className="manager-register-brand-heading">
            <span>
              Hostel Mess
            </span>

            <h1>
              Management
              <br />
              Portal
            </h1>
          </div>


          <p className="manager-register-brand-description">
            Create your Manager account to manage students,
            mess staff and hostel meal operations.
          </p>


          <div className="manager-register-security-card">
            <div className="manager-register-security-icon">
              <ShieldCheck
                size={27}
              />
            </div>

            <div>
              <h2>
                Secure Manager Account
              </h2>

              <p>
                Your password is securely hashed before being
                stored in the database.
              </p>
            </div>
          </div>


          <div className="manager-register-brand-points">
            <div>
              <BadgeCheck
                size={19}
              />

              <span>
                Secure authentication
              </span>
            </div>

            <div>
              <BadgeCheck
                size={19}
              />

              <span>
                Role-based Manager access
              </span>
            </div>

            <div>
              <BadgeCheck
                size={19}
              />

              <span>
                Multiple Manager accounts supported
              </span>
            </div>
          </div>
        </div>
      </section>


      <section className="manager-register-form-panel">
        <div className="manager-register-card">
          <header className="manager-register-card-header">
            <span className="manager-register-eyebrow">
              Manager Registration
            </span>

            <h2>
              Create Manager Account
            </h2>

            <p>
              Enter your hostel management details.
            </p>
          </header>


          {generalError && (
            <div
              className="manager-register-alert manager-register-alert-error"
              role="alert"
            >
              {generalError}
            </div>
          )}


          {successMessage && (
            <div
              className="manager-register-alert manager-register-alert-success"
              role="status"
            >
              {successMessage}
            </div>
          )}


          <form
            className="manager-register-form"
            onSubmit={
              handleSubmit
            }
            noValidate
          >
            <div className="manager-register-grid">
              <div className="manager-register-field">
                <label
                  htmlFor="manager-name"
                >
                  Manager Full Name
                </label>

                <div
                  className={`manager-register-input-wrap ${
                    fieldErrors.name
                      ? "has-error"
                      : ""
                  }`}
                >
                  <User
                    size={20}
                    className="manager-register-input-icon"
                  />

                  <input
                    id="manager-name"
                    name="name"
                    type="text"
                    value={
                      form.name
                    }
                    onChange={
                      handleInputChange
                    }
                    placeholder="Enter full name"
                    autoComplete="name"
                    disabled={
                      submitting
                    }
                  />
                </div>

                {fieldErrors.name && (
                  <span className="manager-register-field-error">
                    {
                      fieldErrors.name
                    }
                  </span>
                )}
              </div>


              <div className="manager-register-field">
                <label
                  htmlFor="manager-id"
                >
                  Manager ID
                  <span className="manager-register-optional">
                    Optional
                  </span>
                </label>

                <div
                  className={`manager-register-input-wrap ${
                    fieldErrors.managerId
                      ? "has-error"
                      : ""
                  }`}
                >
                  <IdCard
                    size={20}
                    className="manager-register-input-icon"
                  />

                  <input
                    id="manager-id"
                    name="managerId"
                    type="text"
                    value={
                      form.managerId
                    }
                    onChange={
                      handleInputChange
                    }
                    onBlur={
                      handleManagerIdBlur
                    }
                    placeholder="Auto-generated if blank"
                    autoComplete="off"
                    disabled={
                      submitting
                    }
                  />
                </div>

                {fieldErrors.managerId && (
                  <span className="manager-register-field-error">
                    {
                      fieldErrors.managerId
                    }
                  </span>
                )}
              </div>


              <div className="manager-register-field">
                <label
                  htmlFor="manager-email"
                >
                  Email Address
                </label>

                <div
                  className={`manager-register-input-wrap ${
                    fieldErrors.email
                      ? "has-error"
                      : ""
                  }`}
                >
                  <Mail
                    size={20}
                    className="manager-register-input-icon"
                  />

                  <input
                    id="manager-email"
                    name="email"
                    type="email"
                    value={
                      form.email
                    }
                    onChange={
                      handleInputChange
                    }
                    onBlur={
                      handleEmailBlur
                    }
                    placeholder="manager@example.com"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck="false"
                    disabled={
                      submitting
                    }
                  />
                </div>

                {fieldErrors.email && (
                  <span className="manager-register-field-error">
                    {
                      fieldErrors.email
                    }
                  </span>
                )}
              </div>


              <div className="manager-register-field">
                <label
                  htmlFor="manager-mobile"
                >
                  Mobile Number
                </label>

                <div
                  className={`manager-register-input-wrap ${
                    fieldErrors.mobileNumber
                      ? "has-error"
                      : ""
                  }`}
                >
                  <Phone
                    size={20}
                    className="manager-register-input-icon"
                  />

                  <input
                    id="manager-mobile"
                    name="mobileNumber"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={
                      form.mobileNumber
                    }
                    onChange={
                      handleInputChange
                    }
                    placeholder="9876543210"
                    autoComplete="tel"
                    disabled={
                      submitting
                    }
                  />
                </div>

                {fieldErrors.mobileNumber && (
                  <span className="manager-register-field-error">
                    {
                      fieldErrors.mobileNumber
                    }
                  </span>
                )}
              </div>


              <div className="manager-register-field">
                <label
                  htmlFor="hostel-name"
                >
                  Hostel Name
                </label>

                <div
                  className={`manager-register-input-wrap ${
                    fieldErrors.hostelName
                      ? "has-error"
                      : ""
                  }`}
                >
                  <Building2
                    size={20}
                    className="manager-register-input-icon"
                  />

                  <input
                    id="hostel-name"
                    name="hostelName"
                    type="text"
                    value={
                      form.hostelName
                    }
                    onChange={
                      handleInputChange
                    }
                    placeholder="Enter hostel name"
                    autoComplete="organization"
                    disabled={
                      submitting
                    }
                  />
                </div>

                {fieldErrors.hostelName && (
                  <span className="manager-register-field-error">
                    {
                      fieldErrors.hostelName
                    }
                  </span>
                )}
              </div>


              <div className="manager-register-field">
                <label
                  htmlFor="hostel-block"
                >
                  Hostel Block
                </label>

                <div
                  className={`manager-register-input-wrap ${
                    fieldErrors.hostelBlock
                      ? "has-error"
                      : ""
                  }`}
                >
                  <MapPin
                    size={20}
                    className="manager-register-input-icon"
                  />

                  <input
                    id="hostel-block"
                    name="hostelBlock"
                    type="text"
                    value={
                      form.hostelBlock
                    }
                    onChange={
                      handleInputChange
                    }
                    placeholder="Example: A"
                    autoComplete="off"
                    disabled={
                      submitting
                    }
                  />
                </div>

                {fieldErrors.hostelBlock && (
                  <span className="manager-register-field-error">
                    {
                      fieldErrors.hostelBlock
                    }
                  </span>
                )}
              </div>


              <div className="manager-register-field">
                <label
                  htmlFor="manager-password"
                >
                  Password
                </label>

                <div
                  className={`manager-register-input-wrap manager-register-password-wrap ${
                    fieldErrors.password
                      ? "has-error"
                      : ""
                  }`}
                >
                  <LockKeyhole
                    size={20}
                    className="manager-register-input-icon"
                  />

                  <input
                    id="manager-password"
                    name="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={
                      form.password
                    }
                    onChange={
                      handleInputChange
                    }
                    placeholder="Create password"
                    autoComplete="new-password"
                    disabled={
                      submitting
                    }
                  />

                  <button
                    type="button"
                    className="manager-register-password-toggle"
                    onClick={() => {
                      setShowPassword(
                        (current) =>
                          !current
                      );
                    }}
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
                    disabled={
                      submitting
                    }
                  >
                    {showPassword ? (
                      <EyeOff
                        size={20}
                      />
                    ) : (
                      <Eye
                        size={20}
                      />
                    )}
                  </button>
                </div>

                {passwordStrength.label && (
                  <div
                    className={`manager-register-password-strength ${passwordStrength.level}`}
                  >
                    Password strength:
                    <strong>
                      {
                        passwordStrength.label
                      }
                    </strong>
                  </div>
                )}

                {fieldErrors.password && (
                  <span className="manager-register-field-error">
                    {
                      fieldErrors.password
                    }
                  </span>
                )}
              </div>


              <div className="manager-register-field">
                <label
                  htmlFor="manager-confirm-password"
                >
                  Confirm Password
                </label>

                <div
                  className={`manager-register-input-wrap manager-register-password-wrap ${
                    fieldErrors.confirmPassword
                      ? "has-error"
                      : ""
                  }`}
                >
                  <LockKeyhole
                    size={20}
                    className="manager-register-input-icon"
                  />

                  <input
                    id="manager-confirm-password"
                    name="confirmPassword"
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    value={
                      form.confirmPassword
                    }
                    onChange={
                      handleInputChange
                    }
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    disabled={
                      submitting
                    }
                  />

                  <button
                    type="button"
                    className="manager-register-password-toggle"
                    onClick={() => {
                      setShowConfirmPassword(
                        (current) =>
                          !current
                      );
                    }}
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                    title={
                      showConfirmPassword
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                    disabled={
                      submitting
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff
                        size={20}
                      />
                    ) : (
                      <Eye
                        size={20}
                      />
                    )}
                  </button>
                </div>

                {passwordsMatch &&
                  !fieldErrors.confirmPassword && (
                    <span className="manager-register-match-message">
                      ✓ Passwords match
                    </span>
                  )}

                {fieldErrors.confirmPassword && (
                  <span className="manager-register-field-error">
                    {
                      fieldErrors.confirmPassword
                    }
                  </span>
                )}
              </div>
            </div>


            <div className="manager-register-password-rules">
              <LockKeyhole
                size={18}
              />

              <div>
                <strong>
                  Password requirements
                </strong>

                <span>
                  Minimum 8 characters with uppercase,
                  lowercase, number and special character.
                </span>
              </div>
            </div>


            <div className="manager-register-terms">
              <label>
                <input
                  type="checkbox"
                  name="termsAccepted"
                  checked={
                    form.termsAccepted
                  }
                  onChange={
                    handleInputChange
                  }
                  disabled={
                    submitting
                  }
                />

                <span>
                  I agree to the Terms and Conditions and
                  confirm that the information entered above
                  is correct.
                </span>
              </label>

              {fieldErrors.termsAccepted && (
                <span className="manager-register-field-error">
                  {
                    fieldErrors.termsAccepted
                  }
                </span>
              )}
            </div>


            <button
              type="submit"
              className="manager-register-submit"
              disabled={
                submitting
              }
            >
              {submitting ? (
                <>
                  <span
                    className="manager-register-spinner"
                    aria-hidden="true"
                  />

                  Creating Manager Account
                </>
              ) : (
                <>
                  <ShieldCheck
                    size={20}
                  />

                  Create Manager Account
                </>
              )}
            </button>


            <p className="manager-register-signin">
              Already have an account?
              {" "}

              <Link
                to="/login"
                state={{
                  selectedRole:
                    "manager",
                }}
                onClick={() => {
                  localStorage.setItem(
                    "selectedRole",
                    "manager"
                  );
                }}
              >
                Sign In
              </Link>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}


export default ManagerRegister;