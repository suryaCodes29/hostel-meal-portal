import {
  Check,
  Edit3,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  User,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useManager,
} from "../../context/ManagerContext";

import "./managerProfile.css";


/* =========================================================
   EMPTY PROFILE
========================================================= */

const EMPTY_PROFILE = {
  id: null,
  managerId: "",
  name: "",
  email: "",
  mobile: "",
  role: "manager",
  isActive: true,
  hostel: "",
  hostelBlock: "",
};


/* =========================================================
   LOCAL STORAGE SYNC
========================================================= */

function updateStoredUser(profile) {
  try {
    const existingUser =
      localStorage.getItem("user");


    const existingCurrentUser =
      localStorage.getItem(
        "currentUser"
      );


    let userObject = {};


    if (existingUser) {
      try {
        userObject =
          JSON.parse(
            existingUser
          );
      } catch {
        userObject = {};
      }
    } else if (
      existingCurrentUser
    ) {
      try {
        userObject =
          JSON.parse(
            existingCurrentUser
          );
      } catch {
        userObject = {};
      }
    }


    const updatedUser = {
      ...userObject,

      id:
        profile.id ??
        userObject.id,

      managerId:
        profile.managerId ??
        userObject.managerId,

      manager_id:
        profile.managerId ??
        userObject.manager_id,

      name:
        profile.name ??
        userObject.name,

      fullName:
        profile.name ??
        userObject.fullName,

      email:
        profile.email ??
        userObject.email,

      mobile:
        profile.mobile ??
        "",

      role:
        profile.role ??
        userObject.role ??
        "manager",

      isActive:
        profile.isActive ??
        true,
    };


    localStorage.setItem(
      "user",
      JSON.stringify(
        updatedUser
      )
    );


    /*
      Keep currentUser synchronized too
      if this project version uses it.
    */
    if (
      existingCurrentUser
    ) {
      localStorage.setItem(
        "currentUser",
        JSON.stringify(
          updatedUser
        )
      );
    }


    window.dispatchEvent(
      new Event(
        "manager-profile-updated"
      )
    );

  } catch (error) {
    console.error(
      "Unable to synchronize Manager profile:",
      error
    );
  }
}


/* =========================================================
   MANAGER PROFILE PAGE
========================================================= */

function ManagerProfile() {
  const navigate =
    useNavigate();


  const {
    apiFetch,
  } = useManager();


  /* =========================================================
     STATE
  ========================================================= */

  const [
    profile,
    setProfile,
  ] = useState(
    EMPTY_PROFILE
  );


  const [
    form,
    setForm,
  ] = useState({
    name: "",
    email: "",
    mobile: "",
  });


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    saving,
    setSaving,
  ] = useState(false);


  const [
    editing,
    setEditing,
  ] = useState(false);


  const [
    error,
    setError,
  ] = useState("");


  const [
    success,
    setSuccess,
  ] = useState("");


  /* =========================================================
     LOAD PROFILE
  ========================================================= */

  const loadProfile =
    useCallback(async () => {

      setLoading(true);

      setError("");


      try {
        const data =
          await apiFetch(
            "/api/manager/profile"
          );


        const profileData =
          data?.profile ||
          data?.manager ||
          {};


        const normalized = {
          id:
            profileData.id ??
            null,

          managerId:
            profileData
              .managerId ??
            profileData
              .manager_id ??
            "",

          name:
            profileData.name ??
            "",

          email:
            profileData.email ??
            "",

          mobile:
            profileData.mobile ??
            "",

          role:
            profileData.role ??
            "manager",

          isActive:
            profileData
              .isActive ??
            profileData
              .is_active ??
            true,

          hostel:
            profileData.hostel ??
            "",

          hostelBlock:
            profileData
              .hostelBlock ??
            profileData
              .hostel_block ??
            "",
        };


        setProfile(
          normalized
        );


        setForm({
          name:
            normalized.name,

          email:
            normalized.email,

          mobile:
            normalized.mobile ||
            "",
        });


        updateStoredUser(
          normalized
        );

      } catch (loadError) {
        console.error(
          "Manager profile loading error:",
          loadError
        );


        setError(
          loadError?.message ||
          "Unable to load Manager profile."
        );
      } finally {
        setLoading(false);
      }

    }, [
      apiFetch,
    ]);


  useEffect(() => {
    loadProfile();
  }, [loadProfile]);


  /* =========================================================
     AUTO CLEAR SUCCESS
  ========================================================= */

  useEffect(() => {
    if (!success) {
      return undefined;
    }


    const timer =
      window.setTimeout(
        () => {
          setSuccess("");
        },
        3500
      );


    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [success]);


  /* =========================================================
     FORM CHANGE
  ========================================================= */

  const handleChange =
    (event) => {
      const {
        name,
        value,
      } = event.target;


      setForm(
        (current) => ({
          ...current,
          [name]:
            value,
        })
      );


      if (error) {
        setError("");
      }
    };


  /* =========================================================
     START EDIT
  ========================================================= */

  const startEditing =
    () => {
      setForm({
        name:
          profile.name ||
          "",

        email:
          profile.email ||
          "",

        mobile:
          profile.mobile ||
          "",
      });


      setError("");

      setSuccess("");

      setEditing(true);
    };


  /* =========================================================
     CANCEL EDIT
  ========================================================= */

  const cancelEditing =
    () => {
      setForm({
        name:
          profile.name ||
          "",

        email:
          profile.email ||
          "",

        mobile:
          profile.mobile ||
          "",
      });


      setError("");

      setEditing(false);
    };


  /* =========================================================
     FRONTEND VALIDATION
  ========================================================= */

  const validateForm =
    () => {
      const name =
        form.name.trim();


      const email =
        form.email
          .trim()
          .toLowerCase();


      const mobile =
        form.mobile.trim();


      if (!name) {
        return (
          "Manager name is required."
        );
      }


      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email
        )
      ) {
        return (
          "Please enter a valid email address."
        );
      }


      if (
        mobile &&
        !/^[6-9]\d{9}$/.test(
          mobile
        )
      ) {
        return (
          "Please enter a valid 10-digit mobile number."
        );
      }


      return "";
    };


  /* =========================================================
     SAVE PROFILE TO DATABASE
  ========================================================= */

  const saveProfile =
    async () => {

      const validationError =
        validateForm();


      if (
        validationError
      ) {
        setError(
          validationError
        );

        return;
      }


      setSaving(true);

      setError("");

      setSuccess("");


      try {
        const data =
          await apiFetch(
            "/api/manager/profile",
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  name:
                    form.name
                      .trim(),

                  email:
                    form.email
                      .trim()
                      .toLowerCase(),

                  mobile:
                    form.mobile
                      .trim(),
                }),
            }
          );


        const updated =
          data?.profile ||
          data?.manager ||
          {};


        const normalized = {
          id:
            updated.id ??
            profile.id,

          managerId:
            updated
              .managerId ??
            updated
              .manager_id ??
            profile.managerId,

          name:
            updated.name ??
            form.name.trim(),

          email:
            updated.email ??
            form.email
              .trim()
              .toLowerCase(),

          mobile:
            updated.mobile ??
            form.mobile.trim(),

          role:
            updated.role ??
            profile.role ??
            "manager",

          isActive:
            updated
              .isActive ??
            updated
              .is_active ??
            profile.isActive,

          hostel:
            updated.hostel ??
            profile.hostel,

          hostelBlock:
            updated
              .hostelBlock ??
            updated
              .hostel_block ??
            profile.hostelBlock,
        };


        setProfile(
          normalized
        );


        setForm({
          name:
            normalized.name,

          email:
            normalized.email,

          mobile:
            normalized.mobile ||
            "",
        });


        updateStoredUser(
          normalized
        );


        setEditing(false);


        setSuccess(
          data?.message ||
          "Manager profile updated successfully."
        );

      } catch (saveError) {
        console.error(
          "Manager profile update error:",
          saveError
        );


        setError(
          saveError?.message ||
          "Unable to update Manager profile."
        );
      } finally {
        setSaving(false);
      }
    };


  /* =========================================================
     CHANGE PASSWORD
  ========================================================= */

  const handleChangePassword =
    () => {
      navigate(
        "/change-password",
        {
          state: {
            from:
              "/manager/dashboard/profile",
          },
        }
      );
    };


  /* =========================================================
     LOADING STATE
  ========================================================= */

  if (loading) {
    return (
      <div className="manager-profile-page">

        <div className="manager-profile-loading">

          <Loader2
            size={28}
            className="manager-profile-spin"
          />


          <strong>
            Loading Manager Profile
          </strong>


          <span>
            Please wait while your account information is loaded.
          </span>

        </div>

      </div>
    );
  }


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="manager-profile-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="manager-profile-page-header">

        <div>

          <span className="manager-profile-eyebrow">
            MANAGER ACCOUNT
          </span>


          <h1>
            My Profile
          </h1>


          <p>
            View and manage your Manager account information.
          </p>

        </div>


        {!editing && (
          <button
            type="button"
            className="manager-profile-primary-button"
            onClick={
              startEditing
            }
          >
            <Edit3
              size={16}
            />

            Edit Profile
          </button>
        )}

      </div>


      {/* =====================================================
          SUCCESS MESSAGE
      ===================================================== */}

      {success && (
        <div className="manager-profile-message">

          <Check
            size={17}
          />


          <span>
            {success}
          </span>


          <button
            type="button"
            onClick={() =>
              setSuccess("")
            }
            aria-label="Close success message"
          >
            <X size={15} />
          </button>

        </div>
      )}


      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="manager-profile-error">

          <span>
            {error}
          </span>


          {!editing && (
            <button
              type="button"
              onClick={
                loadProfile
              }
            >
              Retry
            </button>
          )}

        </div>
      )}


      {/* =====================================================
          MAIN PROFILE CARD
      ===================================================== */}

      <section className="manager-profile-card">

        {/* ===================================================
            HERO
        =================================================== */}

        <div className="manager-profile-hero">

          <div className="manager-profile-large-avatar">

            <User
              size={34}
            />

          </div>


          <div className="manager-profile-hero-info">

            <h2>
              {profile.name ||
                "Manager"}
            </h2>


            <span className="manager-profile-role-badge">
              Manager
            </span>


            <p>
              {profile.email ||
                "—"}
            </p>

          </div>

        </div>


        <div className="manager-profile-divider" />


        {/* ===================================================
            VIEW MODE
        =================================================== */}

        {!editing ? (

          <div className="manager-profile-info-grid">

            {/* FULL NAME */}

            <div className="manager-profile-info-item">

              <div className="manager-profile-info-icon">

                <User
                  size={19}
                />

              </div>


              <div>

                <span>
                  Full Name
                </span>

                <strong>
                  {profile.name ||
                    "—"}
                </strong>

              </div>

            </div>


            {/* EMAIL */}

            <div className="manager-profile-info-item">

              <div className="manager-profile-info-icon">

                <Mail
                  size={19}
                />

              </div>


              <div>

                <span>
                  Registered Email
                </span>

                <strong>
                  {profile.email ||
                    "—"}
                </strong>

              </div>

            </div>


            {/* MOBILE */}

            <div className="manager-profile-info-item">

              <div className="manager-profile-info-icon">

                <Phone
                  size={19}
                />

              </div>


              <div>

                <span>
                  Mobile Number
                </span>

                <strong>
                  {profile.mobile ||
                    "Not added"}
                </strong>

              </div>

            </div>


            {/* MANAGER ID */}

            <div className="manager-profile-info-item">

              <div className="manager-profile-info-icon">

                <ShieldCheck
                  size={19}
                />

              </div>


              <div>

                <span>
                  Manager ID
                </span>

                <strong>
                  {profile.managerId ||
                    "—"}
                </strong>

              </div>

            </div>


            {/* ROLE */}

            <div className="manager-profile-info-item">

              <div className="manager-profile-info-icon">

                <ShieldCheck
                  size={19}
                />

              </div>


              <div>

                <span>
                  Account Role
                </span>

                <strong>
                  Manager
                </strong>

              </div>

            </div>


            {/* STATUS */}

            <div className="manager-profile-info-item">

              <div
                className={`manager-profile-info-icon ${
                  profile.isActive
                    ? "success"
                    : ""
                }`}
              >

                <Check
                  size={19}
                />

              </div>


              <div>

                <span>
                  Account Status
                </span>

                <strong
                  className={
                    profile.isActive
                      ? "manager-profile-active-text"
                      : ""
                  }
                >
                  {profile.isActive
                    ? "Active"
                    : "Inactive"}
                </strong>

              </div>

            </div>


            {/* HOSTEL */}

            {profile.hostel && (
              <div className="manager-profile-info-item">

                <div className="manager-profile-info-icon">

                  <User
                    size={19}
                  />

                </div>


                <div>

                  <span>
                    Registered Hostel
                  </span>

                  <strong>
                    {profile.hostel}
                  </strong>

                </div>

              </div>
            )}


            {/* HOSTEL BLOCK */}

            {profile.hostelBlock && (
              <div className="manager-profile-info-item">

                <div className="manager-profile-info-icon">

                  <User
                    size={19}
                  />

                </div>


                <div>

                  <span>
                    Hostel Block
                  </span>

                  <strong>
                    {profile.hostelBlock}
                  </strong>

                </div>

              </div>
            )}

          </div>

        ) : (

          /* =================================================
             EDIT MODE
          ================================================= */

          <div className="manager-profile-edit-form">

            <div className="manager-profile-form-grid">

              {/* NAME */}

              <div className="manager-profile-form-field">

                <label>
                  Full Name
                </label>


                <input
                  type="text"
                  name="name"
                  value={
                    form.name
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Manager full name"
                  disabled={
                    saving
                  }
                />

              </div>


              {/* EMAIL */}

              <div className="manager-profile-form-field">

                <label>
                  Registered Email
                </label>


                <input
                  type="email"
                  name="email"
                  value={
                    form.email
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="manager@hostel.com"
                  disabled={
                    saving
                  }
                />

              </div>


              {/* MOBILE */}

              <div className="manager-profile-form-field">

                <label>
                  Mobile Number
                </label>


                <input
                  type="tel"
                  name="mobile"
                  value={
                    form.mobile
                  }
                  onChange={
                    handleChange
                  }
                  maxLength={10}
                  inputMode="numeric"
                  placeholder="9876543210"
                  disabled={
                    saving
                  }
                />

              </div>


              {/* MANAGER ID */}

              <div className="manager-profile-form-field">

                <label>
                  Manager ID
                </label>


                <input
                  type="text"
                  value={
                    profile.managerId ||
                    ""
                  }
                  readOnly
                  disabled
                />


                <small>
                  Manager ID cannot be changed.
                </small>

              </div>

            </div>


            {/* ===============================================
                ACTIONS
            =============================================== */}

            <div className="manager-profile-form-actions">

              <button
                type="button"
                className="manager-profile-secondary-button"
                onClick={
                  cancelEditing
                }
                disabled={
                  saving
                }
              >
                <X
                  size={16}
                />

                Cancel
              </button>


              <button
                type="button"
                className="manager-profile-primary-button"
                onClick={
                  saveProfile
                }
                disabled={
                  saving
                }
              >
                {saving ? (
                  <>
                    <Loader2
                      size={16}
                      className="manager-profile-spin"
                    />

                    Saving...
                  </>
                ) : (
                  <>
                    <Save
                      size={16}
                    />

                    Save Changes
                  </>
                )}

              </button>

            </div>

          </div>

        )}

      </section>


      {/* =====================================================
          SECURITY
      ===================================================== */}

      <section className="manager-profile-security-card">

        <div className="manager-profile-security-icon">

          <LockKeyhole
            size={25}
          />

        </div>


        <div className="manager-profile-security-content">

          <h2>
            Account Security
          </h2>


          <p>
            Keep your Manager account secure by updating your password periodically.
          </p>

        </div>


        <button
          type="button"
          className="manager-profile-secondary-button"
          onClick={
            handleChangePassword
          }
        >
          <LockKeyhole
            size={16}
          />

          Change Password
        </button>

      </section>

    </div>
  );
}


export default ManagerProfile;