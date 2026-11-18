import React, { useEffect, useState } from "react";
import {
  User,
  Mail,
  Phone,
  GraduationCap,
  Building2,
  Home,
  Utensils,
  ShieldCheck,
  Edit3,
  Save,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Lock,
  CalendarDays,
} from "lucide-react";

import studentApi from "../../services/studentApi";
import StudentAssignmentBanner from "../../components/student/StudentAssignmentBanner";


const getValue = (obj, keys, fallback = "") => {
  for (const key of keys) {
    const value = obj?.[key];

    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      continue;
    }

    // Convert objects into readable text instead of
    // returning an object directly to React.
    if (typeof value === "object") {
      if (Array.isArray(value)) {
        return value
          .map((item) => {
            if (typeof item === "object" && item !== null) {
              return (
                item.name ??
                item.label ??
                item.title ??
                item.value ??
                ""
              );
            }

            return String(item);
          })
          .filter(Boolean)
          .join(", ");
      }

      const readableValue =
        value.name ??
        value.label ??
        value.title ??
        value.value ??
        value.full_name ??
        value.fullName ??
        value.code;

      if (readableValue !== undefined && readableValue !== null) {
        return String(readableValue);
      }

      // Don't render arbitrary objects as React children.
      return fallback;
    }

    return String(value);
  }

  return fallback;
};


const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function Profile() {
  const [student, setStudent] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [editing, setEditing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const loadProfile = async () => {
    try {
      setError("");

      const result = await studentApi.getProfile();

      const data =
        result?.student ||
        result?.data ||
        result?.result ||
        result;

      setStudent(data);

      setForm({
        name: getValue(
          data,
          ["name", "full_name", "fullName"],
          ""
        ),
        email: getValue(
          data,
          ["email", "email_address", "emailAddress"],
          ""
        ),
        phone: getValue(
          data,
          ["phone", "mobile", "phone_number", "mobile_number"],
          ""
        ),
      });
    } catch (err) {
      console.error("Profile loading error:", err);

      setError(
        err?.message ||
          "Unable to load student profile."
      );
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadProfile();
      setLoading(false);
    };

    load();
  }, []);

  const refreshProfile = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleCancel = () => {
    setForm({
      name: getValue(
        student,
        ["name", "full_name", "fullName"],
        ""
      ),
      email: getValue(
        student,
        ["email", "email_address", "emailAddress"],
        ""
      ),
      phone: getValue(
        student,
        [
          "phone",
          "mobile",
          "phone_number",
          "mobile_number",
        ],
        ""
      ),
    });

    setEditing(false);
    setError("");
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Name cannot be empty.");
      return;
    }

    if (!form.email.trim()) {
      setError("Email cannot be empty.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const result =
        await studentApi.updateProfile({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        });

      const updated =
        result?.student ||
        result?.data ||
        result?.result ||
        result;

      if (updated && typeof updated === "object") {
        setStudent((current) => ({
          ...(current || {}),
          ...updated,
        }));
      } else {
        setStudent((current) => ({
          ...(current || {}),
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        }));
      }

      setEditing(false);

      setSuccess(
        "Profile updated successfully."
      );

      setTimeout(() => {
        setSuccess("");
      }, 3000);
    } catch (err) {
      console.error(
        "Profile update error:",
        err
      );

      setError(
        err?.message ||
          "Unable to update profile."
      );
    } finally {
      setSaving(false);
    }
  };

  const studentId = getValue(
    student,
    [
      "student_id",
      "studentId",
      "roll_number",
      "rollNumber",
      "registration_number",
      "registrationNumber",
    ],
    "-"
  );

  const name = getValue(
    student,
    ["name", "full_name", "fullName"],
    form.name || "Student"
  );

  const email = getValue(
    student,
    ["email", "email_address", "emailAddress"],
    form.email || "-"
  );

  const phone = getValue(
    student,
    [
      "phone",
      "mobile",
      "phone_number",
      "mobile_number",
    ],
    "-"
  );

  const course = getValue(
    student,
    [
      "course",
      "program",
      "degree",
      "course_name",
      "program_name",
    ],
    "-"
  );

  const department = getValue(
    student,
    [
      "department",
      "department_name",
      "branch",
    ],
    "-"
  );

  const year = getValue(
    student,
    [
      "year",
      "year_of_study",
      "yearOfStudy",
      "study_year",
    ],
    "-"
  );

  const hostel = getValue(
    student,
    [
      "hostel",
      "hostel_name",
      "hostelName",
    ],
    "-"
  );

  const block = getValue(
    student,
    [
      "block",
      "block_name",
      "blockName",
    ],
    "-"
  );

  const messUnit = getValue(
    student,
    [
      "mess_unit",
      "messUnit",
      "mess_unit_name",
      "messUnitName",
    ],
    "-"
  );

  const mealCategory = getValue(
    student,
    [
      "meal_category",
      "mealCategory",
      "meal_category_name",
      "mealCategoryName",
    ],
    "-"
  );

  const gender = getValue(
    student,
    ["gender", "sex"],
    "-"
  );

  const joinedAt = getValue(
    student,
    [
      "joined_at",
      "joinedAt",
      "created_at",
      "createdAt",
    ],
    null
  );

  const status = getValue(
    student,
    ["status", "account_status"],
    "Active"
  );

  const role = getValue(
    student,
    ["role"],
    "student"
  );

  if (loading) {
    return (
      <div className="student-page student-profile-page">

        <div className="student-profile-loading">

          <RefreshCw
            size={25}
            className="student-spin"
          />

          <span>
            Loading profile...
          </span>

        </div>

      </div>
    );
  }

  return (
    <div className="student-page student-profile-page">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="student-profile-header">

        <div>
          <div className="student-page-eyebrow">
            <User size={14} />
            Account
          </div>

          <h1>
            My Profile
          </h1>

          <p>
            View and manage your student profile
            information.
          </p>
        </div>

        <button
          type="button"
          className="student-profile-refresh"
          onClick={refreshProfile}
          disabled={refreshing}
        >
          <RefreshCw
            size={15}
            className={
              refreshing
                ? "student-spin"
                : ""
            }
          />

          Refresh
        </button>

      </div>


      {/* =====================================================
          ASSIGNMENT
          ===================================================== */}

      <StudentAssignmentBanner />


      {/* =====================================================
          ALERTS
          ===================================================== */}

      {error && (
        <div className="student-profile-message error">

          <AlertCircle size={16} />

          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() => setError("")}
          >
            ×
          </button>

        </div>
      )}

      {success && (
        <div className="student-profile-message success">

          <CheckCircle2 size={16} />

          <span>
            {success}
          </span>

          <button
            type="button"
            onClick={() => setSuccess("")}
          >
            ×
          </button>

        </div>
      )}


      {/* =====================================================
          PROFILE OVERVIEW
          ===================================================== */}

      <div className="student-profile-overview">

        <div className="student-profile-avatar">

          <span>
            {name
              .trim()
              .charAt(0)
              .toUpperCase()}
          </span>

        </div>

        <div className="student-profile-main-info">

          <div className="student-profile-name-row">

            <h2>
              {name}
            </h2>

            <span className="student-profile-active-badge">
              <span />
              {status}
            </span>

          </div>

          <p>
            Student ID:{" "}
            <strong>
              {studentId}
            </strong>
          </p>

          <div className="student-profile-meta">

            <span>
              <GraduationCap size={12} />
              {course}
            </span>

            <span>
              <Building2 size={12} />
              {department}
            </span>

            <span>
              <ShieldCheck size={12} />
              {role}
            </span>

          </div>

        </div>

        {!editing && (
          <button
            type="button"
            className="student-profile-edit-btn"
            onClick={() => {
              setError("");
              setSuccess("");
              setEditing(true);
            }}
          >
            <Edit3 size={14} />
            Edit Profile
          </button>
        )}

      </div>


      {/* =====================================================
          PROFILE CONTENT
          ===================================================== */}

      <div className="student-profile-grid">

        {/* ===================================================
            PERSONAL INFORMATION
            =================================================== */}

        <section className="student-profile-card">

          <div className="student-profile-card-header">

            <div className="student-profile-card-title">

              <div className="student-profile-card-icon personal">
                <User size={16} />
              </div>

              <div>
                <h3>
                  Personal Information
                </h3>

                <p>
                  Your basic account details
                </p>
              </div>

            </div>

            {!editing && (
              <span className="student-profile-locked">
                <Lock size={11} />
                Protected
              </span>
            )}

          </div>


          {editing ? (
            <form
              className="student-profile-form"
              onSubmit={handleSave}
            >

              <div className="student-profile-form-grid">

                <label>
                  <span>
                    Full Name
                  </span>

                  <div className="student-profile-input">

                    <User size={14} />

                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Enter your name"
                    />

                  </div>
                </label>


                <label>
                  <span>
                    Email
                  </span>

                  <div className="student-profile-input">

                    <Mail size={14} />

                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="Enter your email"
                    />

                  </div>
                </label>


                <label>
                  <span>
                    Phone
                  </span>

                  <div className="student-profile-input">

                    <Phone size={14} />

                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="Enter phone number"
                    />

                  </div>
                </label>

              </div>


              <div className="student-profile-form-actions">

                <button
                  type="button"
                  className="student-profile-cancel-btn"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  <X size={14} />
                  Cancel
                </button>

                <button
                  type="submit"
                  className="student-profile-save-btn"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <RefreshCw
                        size={14}
                        className="student-spin"
                      />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      Save Changes
                    </>
                  )}
                </button>

              </div>

            </form>
          ) : (
            <div className="student-profile-details">

              <div className="student-profile-detail">

                <div className="student-profile-detail-icon">
                  <User size={14} />
                </div>

                <div>
                  <span>
                    Full Name
                  </span>

                  <strong>
                    {name}
                  </strong>
                </div>

              </div>


              <div className="student-profile-detail">

                <div className="student-profile-detail-icon">
                  <Mail size={14} />
                </div>

                <div>
                  <span>
                    Email
                  </span>

                  <strong>
                    {email}
                  </strong>
                </div>

              </div>


              <div className="student-profile-detail">

                <div className="student-profile-detail-icon">
                  <Phone size={14} />
                </div>

                <div>
                  <span>
                    Phone
                  </span>

                  <strong>
                    {phone}
                  </strong>
                </div>

              </div>


              <div className="student-profile-detail">

                <div className="student-profile-detail-icon">
                  <GraduationCap size={14} />
                </div>

                <div>
                  <span>
                    Year of Study
                  </span>

                  <strong>
                    {year}
                  </strong>
                </div>

              </div>


              <div className="student-profile-detail">

                <div className="student-profile-detail-icon">
                  <Building2 size={14} />
                </div>

                <div>
                  <span>
                    Department
                  </span>

                  <strong>
                    {department}
                  </strong>
                </div>

              </div>


              <div className="student-profile-detail">

                <div className="student-profile-detail-icon">
                  <GraduationCap size={14} />
                </div>

                <div>
                  <span>
                    Course
                  </span>

                  <strong>
                    {course}
                  </strong>
                </div>

              </div>

            </div>
          )}

        </section>


        {/* ===================================================
            HOSTEL ASSIGNMENT
            =================================================== */}

        <section className="student-profile-card">

          <div className="student-profile-card-header">

            <div className="student-profile-card-title">

              <div className="student-profile-card-icon hostel">
                <Home size={16} />
              </div>

              <div>
                <h3>
                  Hostel Assignment
                </h3>

                <p>
                  Assigned by hostel management
                </p>
              </div>

            </div>

            <span className="student-profile-assigned-badge">
              Assigned
            </span>

          </div>


          <div className="student-assignment-details">

            <div className="student-assignment-detail">

              <div className="student-assignment-icon">
                <Home size={15} />
              </div>

              <div>
                <span>
                  Hostel
                </span>

                <strong>
                  {hostel}
                </strong>
              </div>

            </div>


            <div className="student-assignment-detail">

              <div className="student-assignment-icon">
                <Building2 size={15} />
              </div>

              <div>
                <span>
                  Block
                </span>

                <strong>
                  {block}
                </strong>
              </div>

            </div>


            <div className="student-assignment-detail">

              <div className="student-assignment-icon">
                <Utensils size={15} />
              </div>

              <div>
                <span>
                  Mess Unit
                </span>

                <strong>
                  {messUnit}
                </strong>
              </div>

            </div>


            <div className="student-assignment-detail">

              <div className="student-assignment-icon">
                <Utensils size={15} />
              </div>

              <div>
                <span>
                  Meal Category
                </span>

                <strong>
                  {mealCategory}
                </strong>
              </div>

            </div>

          </div>


          <div className="student-profile-assignment-note">

            <ShieldCheck size={14} />

            <span>
              Hostel, block, mess unit and meal
              category are controlled by the
              Manager.
            </span>

          </div>

        </section>


        {/* ===================================================
            ACCOUNT INFORMATION
            =================================================== */}

        <section className="student-profile-card">

          <div className="student-profile-card-header">

            <div className="student-profile-card-title">

              <div className="student-profile-card-icon account">
                <ShieldCheck size={16} />
              </div>

              <div>
                <h3>
                  Account Information
                </h3>

                <p>
                  Security and account details
                </p>
              </div>

            </div>

          </div>


          <div className="student-account-details">

            <div className="student-account-row">

              <span>
                Student ID
              </span>

              <strong>
                {studentId}
              </strong>

            </div>


            <div className="student-account-row">

              <span>
                Account Status
              </span>

              <strong className="active">
                <span />
                {status}
              </strong>

            </div>


            <div className="student-account-row">

              <span>
                Account Role
              </span>

              <strong>
                Student
              </strong>

            </div>


            <div className="student-account-row">

              <span>
                Gender
              </span>

              <strong>
                {gender}
              </strong>

            </div>


            <div className="student-account-row">

              <span>
                Joined Date
              </span>

              <strong>
                <CalendarDays size={12} />
                {formatDate(joinedAt)}
              </strong>

            </div>

          </div>

        </section>


        {/* ===================================================
            PROFILE SECURITY
            =================================================== */}

        <section className="student-profile-security-card">

          <div className="student-security-icon">
            <Lock size={19} />
          </div>

          <div>

            <h3>
              Your account is protected
            </h3>

            <p>
              Your hostel assignment and student
              identity are managed securely by the
              hostel administration. You can update
              only the profile information permitted
              by your account.
            </p>

          </div>

        </section>

      </div>

    </div>
  );
}