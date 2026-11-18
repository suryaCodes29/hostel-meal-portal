
import { useCallback, useEffect, useState } from "react";
import { useManager } from "../../context/ManagerContext";

const blankForm = {
  title: "",
  message: "",
  priority: "normal",
  audience: "general",
  hostelId: "",
  messUnitId: "",
  mealCategory: "",
  recipientUserId: "",
  attachmentUrl: "",
  status: "draft",
};

const buttonStyle = {
  padding: "10px 14px",
  border: "1px solid #d5dce7",
  borderRadius: "7px",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 600,
};

const fieldStyle = {
  display: "grid",
  gap: "6px",
  marginBottom: "14px",
  fontSize: "14px",
  fontWeight: 600,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px",
  border: "1px solid #d5dce7",
  borderRadius: "7px",
  font: "inherit",
  fontWeight: 400,
};

export default function ManagerAnnouncements() {
  const { apiFetch } = useManager();

  const [announcements, setAnnouncements] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [messUnits, setMessUnits] = useState([]);
  const [students, setStudents] = useState([]);

  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const query = params.toString();
      const result = await apiFetch(
        `/api/manager/announcements${query ? `?${query}` : ""}`
      );

      if (!result || !Array.isArray(result.announcements)) {
        throw new Error(
          "The announcements API returned an unexpected response."
        );
      }

      setAnnouncements(result.announcements);
    } catch (err) {
      setAnnouncements([]);
      setError(
        err?.message ||
          "Could not load announcements. Check the backend and retry."
      );
    } finally {
      setLoading(false);
    }
  }, [apiFetch, statusFilter]);

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);

    try {
      const results = await Promise.allSettled([
        apiFetch("/api/manager/hostels"),
        apiFetch("/api/manager/mess-units"),
        apiFetch("/api/manager/students"),
      ]);

      const [hostelResult, messResult, studentResult] = results;

      if (hostelResult.status === "fulfilled") {
        const data = hostelResult.value;
        setHostels(
          Array.isArray(data)
            ? data
            : data?.hostels || []
        );
      }

      if (messResult.status === "fulfilled") {
        const data = messResult.value;
        setMessUnits(
          Array.isArray(data)
            ? data
            : data?.messUnits || data?.mess_units || []
        );
      }

      if (studentResult.status === "fulfilled") {
        const data = studentResult.value;
        setStudents(
          Array.isArray(data)
            ? data
            : data?.students || []
        );
      }
    } finally {
      setLoadingOptions(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  function updateForm(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm({ ...blankForm });
    setEditingId(null);
    setError("");
    setNotice("");
  }

  function editAnnouncement(item) {
    setEditingId(item.id);

    setForm({
      title: item.title || "",
      message: item.message || "",
      priority: item.priority || "normal",
      audience: item.isGeneral
        ? "general"
        : item.recipientUserId
          ? "student"
          : item.messUnitId
            ? "mess"
            : item.mealCategory
              ? "category"
              : "hostel",
      hostelId: item.hostelId ? String(item.hostelId) : "",
      messUnitId: item.messUnitId ? String(item.messUnitId) : "",
      mealCategory: item.mealCategory || "",
      recipientUserId: item.recipientUserId
        ? String(item.recipientUserId)
        : "",
      attachmentUrl: item.attachmentUrl || "",
      status: item.status || "draft",
    });

    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function buildPayload() {
    const payload = {
      title: form.title.trim(),
      message: form.message.trim(),
      priority: form.priority,
      status: form.status,
      is_general: form.audience === "general",
      hostel_id: null,
      mess_unit_id: null,
      meal_category: null,
      recipient_user_id: null,
      attachment_url: form.attachmentUrl.trim() || null,
    };

    if (form.audience === "hostel") {
      payload.hostel_id = form.hostelId
        ? Number(form.hostelId)
        : null;
    }

    if (form.audience === "mess") {
      payload.hostel_id = form.hostelId
        ? Number(form.hostelId)
        : null;
      payload.mess_unit_id = form.messUnitId
        ? Number(form.messUnitId)
        : null;
    }

    if (form.audience === "category") {
      payload.hostel_id = form.hostelId
        ? Number(form.hostelId)
        : null;
      payload.meal_category = form.mealCategory || null;
    }

    if (form.audience === "student") {
      payload.recipient_user_id = form.recipientUserId
        ? Number(form.recipientUserId)
        : null;
    }

    return payload;
  }

  async function submitAnnouncement(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!form.title.trim() || !form.message.trim()) {
      setError("Enter both a title and announcement message.");
      return;
    }

    if (
      form.audience !== "general" &&
      form.audience !== "student" &&
      !form.hostelId
    ) {
      setError("Select a hostel for this audience.");
      return;
    }

    if (form.audience === "mess" && !form.messUnitId) {
      setError("Select a mess unit.");
      return;
    }

    if (form.audience === "category" && !form.mealCategory) {
      setError("Select a meal category.");
      return;
    }

    if (form.audience === "student" && !form.recipientUserId) {
      setError("Select a student.");
      return;
    }

    setSaving(true);

    try {
      const payload = buildPayload();

      const result = editingId
        ? await apiFetch(
            `/api/manager/announcements/${editingId}`,
            {
              method: "PATCH",
              body: JSON.stringify(payload),
            }
          )
        : await apiFetch("/api/manager/announcements", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      setNotice(
        result?.message ||
          (editingId
            ? "Announcement updated successfully."
            : "Announcement saved successfully.")
      );

      resetForm();
      await loadAnnouncements();
    } catch (err) {
      setError(
        err?.message ||
          "Unable to save announcement. Please retry."
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(item, status) {
    setError("");
    setNotice("");
    setSaving(true);

    try {
      const result = await apiFetch(
        `/api/manager/announcements/${item.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }
      );

      setNotice(
        result?.message ||
          `Announcement ${status === "published" ? "published" : status === "draft" ? "saved as draft" : "unpublished"}.`
      );

      await loadAnnouncements();
    } catch (err) {
      setError(
        err?.message ||
          "Could not update announcement status."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ padding: "24px", maxWidth: "1400px", margin: "auto" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1 style={{ marginBottom: "6px" }}>
            Manager Announcements
          </h1>
          <p style={{ color: "#64748b", margin: 0 }}>
            Publish updates for the students assigned to your hostels and mess units.
          </p>
        </div>

        <button
          type="button"
          style={buttonStyle}
          onClick={loadAnnouncements}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            padding: "14px",
            borderRadius: "8px",
            background: "#fff1f2",
            color: "#9f1239",
            marginBottom: "18px",
          }}
        >
          <p>{error}</p>
          <button
            type="button"
            style={buttonStyle}
            onClick={() => {
              loadAnnouncements();
              loadOptions();
            }}
          >
            Retry
          </button>
        </div>
      )}

      {notice && (
        <div
          role="status"
          style={{
            padding: "12px",
            borderRadius: "8px",
            background: "#ecfdf5",
            color: "#166534",
            marginBottom: "18px",
          }}
        >
          {notice}
        </div>
      )}

      <section
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "22px",
          marginBottom: "24px",
        }}
      >
        <h2>{editingId ? "Edit announcement" : "Create announcement"}</h2>

        <form onSubmit={submitAnnouncement}>
          <label style={fieldStyle}>
            Title
            <input
              style={inputStyle}
              maxLength={200}
              required
              value={form.title}
              onChange={(e) => updateForm("title", e.target.value)}
              placeholder="Enter announcement title"
            />
          </label>

          <label style={fieldStyle}>
            Message
            <textarea
              style={{ ...inputStyle, minHeight: "120px" }}
              required
              value={form.message}
              onChange={(e) => updateForm("message", e.target.value)}
              placeholder="Write your announcement..."
            />
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
            }}
          >
            <label style={fieldStyle}>
              Priority
              <select
                style={inputStyle}
                value={form.priority}
                onChange={(e) => updateForm("priority", e.target.value)}
              >
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>

            <label style={fieldStyle}>
              Audience
              <select
                style={inputStyle}
                value={form.audience}
                onChange={(e) => {
                  const audience = e.target.value;
                  setForm((current) => ({
                    ...current,
                    audience,
                    hostelId: "",
                    messUnitId: "",
                    mealCategory: "",
                    recipientUserId: "",
                  }));
                }}
              >
                <option value="general">General announcement</option>
                <option value="hostel">Entire hostel</option>
                <option value="mess">Specific mess unit</option>
                <option value="category">Meal category</option>
                <option value="student">Specific student</option>
              </select>
            </label>

            <label style={fieldStyle}>
              Initial status
              <select
                style={inputStyle}
                value={form.status}
                onChange={(e) => updateForm("status", e.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="published">Publish immediately</option>
              </select>
            </label>
          </div>

          {["hostel", "mess", "category"].includes(form.audience) && (
            <label style={fieldStyle}>
              Hostel
              <select
                style={inputStyle}
                value={form.hostelId}
                required
                onChange={(e) => updateForm("hostelId", e.target.value)}
              >
                <option value="">
                  {loadingOptions ? "Loading hostels..." : "Select hostel"}
                </option>
                {hostels.map((hostel) => (
                  <option key={hostel.id} value={hostel.id}>
                    {hostel.name || hostel.hostelName || `Hostel ${hostel.id}`}
                  </option>
                ))}
              </select>
            </label>
          )}

          {form.audience === "mess" && (
            <label style={fieldStyle}>
              Mess unit
              <select
                style={inputStyle}
                required
                value={form.messUnitId}
                onChange={(e) => updateForm("messUnitId", e.target.value)}
              >
                <option value="">Select mess unit</option>
                {messUnits
                  .filter(
                    (unit) =>
                      !form.hostelId ||
                      String(unit.hostelId ?? unit.hostel_id ?? "") ===
                        String(form.hostelId)
                  )
                  .map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name || unit.unitName || `Mess ${unit.id}`}
                    </option>
                  ))}
              </select>
            </label>
          )}

          {form.audience === "category" && (
            <label style={fieldStyle}>
              Meal category
              <select
                style={inputStyle}
                required
                value={form.mealCategory}
                onChange={(e) => updateForm("mealCategory", e.target.value)}
              >
                <option value="">Select category</option>
                <option value="Veg">Veg</option>
                <option value="Non-Veg">Non-Veg</option>
              </select>
            </label>
          )}

          {form.audience === "student" && (
            <label style={fieldStyle}>
              Student
              <select
                style={inputStyle}
                required
                value={form.recipientUserId}
                onChange={(e) => updateForm("recipientUserId", e.target.value)}
              >
                <option value="">
                  {loadingOptions ? "Loading students..." : "Select student"}
                </option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name || student.fullName || `Student ${student.id}`}
                    {student.email ? ` (${student.email})` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label style={fieldStyle}>
            Attachment URL (optional)
            <input
              style={inputStyle}
              type="url"
              maxLength={500}
              value={form.attachmentUrl}
              onChange={(e) => updateForm("attachmentUrl", e.target.value)}
              placeholder="https://..."
            />
          </label>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="submit"
              style={{
                ...buttonStyle,
                background: "#2459d3",
                borderColor: "#2459d3",
                color: "#fff",
              }}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Save changes"
                  : "Create announcement"}
            </button>

            {editingId && (
              <button
                type="button"
                style={buttonStyle}
                onClick={resetForm}
                disabled={saving}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "22px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <h2>Announcements</h2>

          <select
            style={{ ...inputStyle, width: "190px" }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="unpublished">Unpublished</option>
          </select>
        </div>

        {loading ? (
          <p role="status">Loading announcements...</p>
        ) : error ? (
          <p>Announcements could not be loaded. Use Retry above.</p>
        ) : announcements.length === 0 ? (
          <div style={{ padding: "30px 10px", textAlign: "center" }}>
            <h3>No announcements found</h3>
            <p style={{ color: "#64748b" }}>
              Create an announcement or change the status filter.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "16px" }}>
            {announcements.map((item) => (
              <article
                key={item.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div>
                    <h3 style={{ marginTop: 0, marginBottom: "8px" }}>
                      {item.title}
                    </h3>
                    <p style={{ whiteSpace: "pre-wrap" }}>
                      {item.message}
                    </p>
                  </div>

                  <div style={{ color: "#64748b", fontSize: "13px" }}>
                    <div>Priority: {item.priority || "normal"}</div>
                    <div>Status: {item.status || "draft"}</div>
                    <div>
                      Audience:{" "}
                      {item.isGeneral
                        ? "General"
                        : item.recipientUserId
                          ? "Specific student"
                          : item.messUnitName
                            ? item.messUnitName
                            : item.mealCategory
                              ? item.mealCategory
                              : item.hostelName || "Targeted"}
                    </div>
                    <div>
                      {item.publishedAt
                        ? `Published: ${formatDate(item.publishedAt)}`
                        : "Not published"}
                    </div>
                  </div>
                </div>

                {item.attachmentUrl && (
                  <p>
                    <a
                      href={item.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View attachment
                    </a>
                  </p>
                )}

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={buttonStyle}
                    onClick={() => editAnnouncement(item)}
                    disabled={saving}
                  >
                    Edit
                  </button>

                  {item.status !== "published" ? (
                    <button
                      type="button"
                      style={{
                        ...buttonStyle,
                        background: "#2459d3",
                        color: "#fff",
                      }}
                      onClick={() => changeStatus(item, "published")}
                      disabled={saving}
                    >
                      Publish
                    </button>
                  ) : (
                    <button
                      type="button"
                      style={buttonStyle}
                      onClick={() => changeStatus(item, "unpublished")}
                      disabled={saving}
                    >
                      Unpublish
                    </button>
                  )}

                  {item.status !== "draft" && (
                    <button
                      type="button"
                      style={buttonStyle}
                      onClick={() => changeStatus(item, "draft")}
                      disabled={saving}
                    >
                      Save as draft
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
