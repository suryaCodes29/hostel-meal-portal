
import { useCallback, useEffect, useMemo, useState } from "react";
import { useManager } from "../../context/ManagerContext";

const initialFilters = {
  status: "all",
  category: "all",
  rating: "all",
  startDate: "",
  endDate: "",
};

const styles = {
  page: {
    padding: "24px",
    maxWidth: "1500px",
    margin: "0 auto",
    color: "#172033",
    fontFamily: "Arial, sans-serif",
  },
  heading: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
    marginBottom: "24px",
  },
  title: {
    margin: "0 0 8px",
    fontSize: "28px",
  },
  subtitle: {
    margin: 0,
    color: "#667085",
  },
  button: {
    padding: "10px 15px",
    border: "1px solid #d0d5dd",
    borderRadius: "8px",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  primaryButton: {
    padding: "10px 15px",
    border: "none",
    borderRadius: "8px",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  stat: {
    padding: "20px",
    border: "1px solid #e4e7ec",
    borderRadius: "12px",
    background: "#fff",
  },
  statLabel: {
    display: "block",
    color: "#667085",
    marginBottom: "10px",
    fontSize: "14px",
  },
  statValue: {
    fontSize: "27px",
    fontWeight: 700,
  },
  card: {
    padding: "20px",
    border: "1px solid #e4e7ec",
    borderRadius: "12px",
    background: "#fff",
    marginBottom: "18px",
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "14px",
    marginTop: "18px",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    fontSize: "13px",
    fontWeight: 600,
    color: "#344054",
  },
  input: {
    width: "100%",
    padding: "10px",
    border: "1px solid #d0d5dd",
    borderRadius: "7px",
    boxSizing: "border-box",
    background: "#fff",
    color: "#172033",
    fontSize: "14px",
  },
  alert: {
    padding: "13px 15px",
    borderRadius: "8px",
    marginBottom: "16px",
    overflowWrap: "anywhere",
  },
  feedbackCard: {
    padding: "20px",
    border: "1px solid #e4e7ec",
    borderRadius: "12px",
    marginBottom: "16px",
    background: "#fff",
  },
  muted: {
    color: "#667085",
    fontSize: "14px",
  },
  badge: {
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: 700,
  },
};

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString();
}

function getStatusStyle(status) {
  if (status === "reviewed") {
    return {
      ...styles.badge,
      color: "#067647",
      background: "#d1fadf",
    };
  }

  return {
    ...styles.badge,
    color: "#b54708",
    background: "#fef0c7",
  };
}

export default function ManagerFeedback() {
  const { apiFetch } = useManager();

  const [feedback, setFeedback] = useState([]);
  const [filters, setFilters] = useState({ ...initialFilters });
  const [replies, setReplies] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingId, setSavingId] = useState(null);

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      // The current backend supports the status query parameter.
      if (filters.status !== "all") {
        params.set("status", filters.status);
      }

      const query = params.toString();
      const url = `/api/manager/feedback${query ? `?${query}` : ""}`;

      const result = await apiFetch(url);

      if (!result || !Array.isArray(result.feedback)) {
        throw new Error("The server returned an invalid feedback response.");
      }

      setFeedback(result.feedback);
    } catch (err) {
      setFeedback([]);
      setError(
        err?.message || "Could not load feedback. Check the backend connection."
      );
    } finally {
      setLoading(false);
    }
  }, [apiFetch, filters.status]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  function updateFilter(name, value) {
    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetFilters() {
    setFilters({ ...initialFilters });
    setNotice("");
    setError("");
  }

  const visibleFeedback = useMemo(() => {
    return feedback.filter((item) => {
      if (
        filters.category !== "all" &&
        String(item.category || "").toLowerCase() !==
          filters.category.toLowerCase()
      ) {
        return false;
      }

      if (
        filters.rating !== "all" &&
        Number(item.overallRating) !== Number(filters.rating)
      ) {
        return false;
      }

      const mealDate = item.mealDate
        ? String(item.mealDate).slice(0, 10)
        : "";

      if (filters.startDate && (!mealDate || mealDate < filters.startDate)) {
        return false;
      }

      if (filters.endDate && (!mealDate || mealDate > filters.endDate)) {
        return false;
      }

      return true;
    });
  }, [feedback, filters]);

  const averageRating = visibleFeedback.length
    ? (
        visibleFeedback.reduce(
          (total, item) => total + Number(item.overallRating || 0),
          0
        ) / visibleFeedback.length
      ).toFixed(1)
    : "—";

  async function saveReply(item) {
    const reply = String(
      replies[item.id] ?? item.staffReply ?? ""
    ).trim();

    if (!reply) {
      setError("Please enter a reply before saving.");
      setNotice("");
      return;
    }

    if (reply.length > 2000) {
      setError("The reply cannot exceed 2000 characters.");
      setNotice("");
      return;
    }

    setSavingId(item.id);
    setError("");
    setNotice("");

    try {
      await apiFetch(`/api/manager/feedback/${item.id}/reply`, {
        method: "PATCH",
        body: JSON.stringify({ reply }),
      });

      setNotice("Reply saved successfully.");
      setReplies((current) => {
        const updated = { ...current };
        delete updated[item.id];
        return updated;
      });

      await loadFeedback();
    } catch (err) {
      setError(err?.message || "Could not save the reply.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main style={styles.page}>
      <header style={styles.heading}>
        <div>
          <h1 style={styles.title}>Student Feedback</h1>
          <p style={styles.subtitle}>
            Review student feedback and respond to their concerns.
          </p>
        </div>

        <button
          type="button"
          style={styles.button}
          onClick={loadFeedback}
          disabled={loading}
        >
          {loading ? "Loading..." : "↻ Refresh"}
        </button>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            ...styles.alert,
            color: "#b42318",
            background: "#fef3f2",
            border: "1px solid #fecdca",
          }}
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          style={{
            ...styles.alert,
            color: "#067647",
            background: "#ecfdf3",
            border: "1px solid #abefc6",
          }}
        >
          {notice}
        </div>
      )}

      <section style={styles.stats}>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Feedback shown</span>
          <div style={styles.statValue}>{visibleFeedback.length}</div>
        </div>

        <div style={styles.stat}>
          <span style={styles.statLabel}>Pending</span>
          <div style={styles.statValue}>
            {visibleFeedback.filter((item) => item.status === "pending").length}
          </div>
        </div>

        <div style={styles.stat}>
          <span style={styles.statLabel}>Reviewed</span>
          <div style={styles.statValue}>
            {visibleFeedback.filter((item) => item.status === "reviewed").length}
          </div>
        </div>

        <div style={styles.stat}>
          <span style={styles.statLabel}>Average rating</span>
          <div style={styles.statValue}>
            {averageRating}
            {averageRating !== "—" ? "/5" : ""}
          </div>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={{ marginTop: 0 }}>Filter feedback</h2>

        <div style={styles.filters}>
          <label style={styles.label}>
            Status
            <select
              style={styles.input}
              value={filters.status}
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </label>

          <label style={styles.label}>
            Category
            <select
              style={styles.input}
              value={filters.category}
              onChange={(event) => updateFilter("category", event.target.value)}
            >
              <option value="all">All categories</option>
              <option value="Food Quality">Food Quality</option>
              <option value="Taste">Taste</option>
              <option value="Hygiene">Hygiene</option>
              <option value="Quantity">Quantity</option>
              <option value="Service">Service</option>
              <option value="Other">Other</option>
            </select>
          </label>

          <label style={styles.label}>
            Rating
            <select
              style={styles.input}
              value={filters.rating}
              onChange={(event) => updateFilter("rating", event.target.value)}
            >
              <option value="all">All ratings</option>
              {[5, 4, 3, 2, 1].map((rating) => (
                <option key={rating} value={String(rating)}>
                  {rating} / 5
                </option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            From date
            <input
              style={styles.input}
              type="date"
              value={filters.startDate}
              onChange={(event) => updateFilter("startDate", event.target.value)}
            />
          </label>

          <label style={styles.label}>
            To date
            <input
              style={styles.input}
              type="date"
              value={filters.endDate}
              min={filters.startDate || undefined}
              onChange={(event) => updateFilter("endDate", event.target.value)}
            />
          </label>

          <div style={{ display: "flex", alignItems: "end" }}>
            <button
              type="button"
              style={styles.button}
              onClick={resetFilters}
            >
              Reset filters
            </button>
          </div>
        </div>

        <p style={styles.muted}>
          Category, rating, and date filters apply to the feedback currently
          loaded from the server.
        </p>
      </section>

      <section>
        <h2>Feedback records</h2>

        {loading && (
          <div style={styles.card} role="status">
            Loading student feedback...
          </div>
        )}

        {!loading && !error && visibleFeedback.length === 0 && (
          <div style={styles.card}>
            <h3>No feedback found</h3>
            <p style={styles.muted}>
              There are no matching feedback records. Try resetting the filters
              or refresh the page.
            </p>
          </div>
        )}

        {!loading &&
          visibleFeedback.map((item) => (
            <article key={item.id} style={styles.feedbackCard}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <h3 style={{ margin: "0 0 8px" }}>
                    {item.studentName || "Student"}
                  </h3>

                  <p style={styles.muted}>
                    Student ID: {item.studentId || "Not available"}
                  </p>
                </div>

                <span style={getStatusStyle(item.status)}>
                  {item.status || "pending"}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: "12px",
                  margin: "18px 0",
                }}
              >
                <div>
                  <span style={styles.muted}>Meal</span>
                  <div>{item.meal || "Not specified"}</div>
                </div>

                <div>
                  <span style={styles.muted}>Meal date</span>
                  <div>{formatDate(item.mealDate)}</div>
                </div>

                <div>
                  <span style={styles.muted}>Category</span>
                  <div>{item.category || "Other"}</div>
                </div>

                <div>
                  <span style={styles.muted}>Rating</span>
                  <div>
                    {"★".repeat(
                      Math.max(0, Math.min(5, Number(item.overallRating) || 0))
                    )}
                    {"☆".repeat(
                      5 -
                        Math.max(
                          0,
                          Math.min(5, Number(item.overallRating) || 0)
                        )
                    )}
                    {" "}
                    ({item.overallRating ?? "—"}/5)
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: "18px" }}>
                <strong>Student comments</strong>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {item.comments || "No comments provided."}
                </p>
              </div>

              {item.photoUrl && (
                <p>
                  <a href={item.photoUrl} target="_blank" rel="noreferrer">
                    View attached photo
                  </a>
                </p>
              )}

              <label style={styles.label}>
                Reply to student
                <textarea
                  style={{
                    ...styles.input,
                    minHeight: "100px",
                    resize: "vertical",
                  }}
                  maxLength={2000}
                  placeholder="Write a helpful response..."
                  value={replies[item.id] ?? item.staffReply ?? ""}
                  onChange={(event) =>
                    setReplies((current) => ({
                      ...current,
                      [item.id]: event.target.value,
                    }))
                  }
                />
              </label>

              {item.repliedAt && (
                <p style={styles.muted}>
                  Last replied: {formatDate(item.repliedAt)}
                </p>
              )}

              <div style={{ marginTop: "14px" }}>
                <button
                  type="button"
                  style={{
                    ...styles.primaryButton,
                    opacity: savingId === item.id ? 0.65 : 1,
                  }}
                  disabled={savingId === item.id}
                  onClick={() => saveReply(item)}
                >
                  {savingId === item.id ? "Saving..." : "Save reply"}
                </button>
              </div>
            </article>
          ))}
      </section>
    </main>
  );
}
