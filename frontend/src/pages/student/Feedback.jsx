import React, { useEffect, useMemo, useState } from "react";
import {
  MessageSquare,
  Star,
  CalendarDays,
  Utensils,
  Send,
  ImagePlus,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock3,
} from "lucide-react";

import studentApi from "../../services/studentApi";
import StudentAssignmentBanner from "../../components/student/StudentAssignmentBanner";

const CATEGORIES = [
  "Food Quality",
  "Taste",
  "Hygiene",
  "Quantity",
  "Service",
  "Other",
];

const MEALS = ["Breakfast", "Lunch", "Dinner"];

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
}

function parseDate(value) {
  if (!value) return null;

  const raw = String(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = parseDate(value);

  if (!date) return "-";

  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function normalizeMeal(value) {
  const text = String(value || "").toLowerCase();

  if (text.includes("breakfast")) return "Breakfast";
  if (text.includes("lunch")) return "Lunch";
  if (text.includes("dinner")) return "Dinner";

  return value || "";
}

function getMenus(response) {
  if (Array.isArray(response)) {
    return response;
  }

  return (
    response?.menus ||
    response?.data?.menus ||
    response?.data ||
    response?.result ||
    []
  );
}

function normalizeMenu(menu) {
  const raw = menu || {};

  let items = [];

  if (Array.isArray(raw.items)) {
    items = raw.items;
  } else if (Array.isArray(raw.menu_items)) {
    items = raw.menu_items;
  } else if (Array.isArray(raw.menuItems)) {
    items = raw.menuItems;
  }

  return {
    ...raw,
    id: raw.id || raw.menu_id,
    date:
      raw.date ||
      raw.menu_date ||
      raw.meal_date ||
      "",
    meal: normalizeMeal(
      raw.meal ||
        raw.meal_type ||
        raw.meal_name
    ),
    published:
      raw.published === true ||
      raw.is_published === true ||
      String(raw.status || "").toLowerCase() ===
        "published",
    items,
    servingTime:
      raw.serving_time ||
      raw.servingTime ||
      raw.time ||
      "",
  };
}

function StarRating({
  value,
  onChange,
  label,
  disabled = false,
}) {
  return (
    <div className="student-feedback-rating-row">
      <div className="student-feedback-rating-label">
        <span>{label}</span>

        <strong>
          {value > 0 ? `${value}/5` : "Not rated"}
        </strong>
      </div>

      <div
        className="student-feedback-stars"
        aria-label={`${label} rating`}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            type="button"
            key={star}
            className={
              star <= value
                ? "active"
                : ""
            }
            onClick={() =>
              onChange(star)
            }
            disabled={disabled}
            aria-label={`${star} star`}
          >
            <Star
              size={22}
              fill={
                star <= value
                  ? "currentColor"
                  : "none"
              }
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Feedback() {
  const today = new Date();

  const [assignment, setAssignment] = useState(null);

  const [menus, setMenus] = useState([]);

  const [loadingMenus, setLoadingMenus] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState("");

  const [mealDate, setMealDate] = useState(
    dateKey(today)
  );

  const [meal, setMeal] =
    useState("Breakfast");

  const [category, setCategory] =
    useState("Food Quality");

  const [overallRating, setOverallRating] =
    useState(0);

  const [tasteRating, setTasteRating] =
    useState(0);

  const [hygieneRating, setHygieneRating] =
    useState(0);

  const [quantityRating, setQuantityRating] =
    useState(0);

  const [comments, setComments] =
    useState("");

  const [photo, setPhoto] = useState(null);

  const [photoPreview, setPhotoPreview] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState("");

  const loadMenus = async (
    showRefresh = false
  ) => {
    try {
      setError("");

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoadingMenus(true);
      }

      const response =
        await studentApi.getTodayMenus();

      const normalized = getMenus(response)
        .map(normalizeMenu)
        .filter((menu) => menu.date)
        .filter((menu) => menu.published);

      setMenus(normalized);

      if (response?.assignment) {
        setAssignment(response.assignment);
      } else if (response?.data?.assignment) {
        setAssignment(response.data.assignment);
      }
    } catch (err) {
      console.error(
        "Feedback menu loading error:",
        err
      );

      setError(
        err?.message ||
          "Unable to load available meals."
      );
    } finally {
      setLoadingMenus(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMenus();
  }, []);

  const availableMealsForDate = useMemo(() => {
    return menus
      .filter(
        (menu) =>
          dateKey(parseDate(menu.date)) ===
          mealDate
      )
      .map((menu) => menu.meal)
      .filter(Boolean);
  }, [menus, mealDate]);

  useEffect(() => {
    if (
      availableMealsForDate.length > 0 &&
      !availableMealsForDate.includes(meal)
    ) {
      setMeal(availableMealsForDate[0]);
    }
  }, [availableMealsForDate, meal]);

  const selectedMenu = useMemo(() => {
    return (
      menus.find(
        (menu) =>
          dateKey(parseDate(menu.date)) ===
            mealDate &&
          menu.meal === meal
      ) || null
    );
  }, [menus, mealDate, meal]);

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessageType("error");
      setMessage(
        "Please select a valid image file."
      );
      return;
    }

    const maxSize = 5 * 1024 * 1024;

    if (file.size > maxSize) {
      setMessageType("error");
      setMessage(
        "Photo size must be less than 5 MB."
      );
      return;
    }

    setPhoto(file);

    const previewUrl =
      URL.createObjectURL(file);

    setPhotoPreview(previewUrl);

    setMessage("");
    setMessageType("");
  };

  const removePhoto = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }

    setPhoto(null);
    setPhotoPreview("");
  };

  const resetForm = () => {
    setCategory("Food Quality");
    setOverallRating(0);
    setTasteRating(0);
    setHygieneRating(0);
    setQuantityRating(0);
    setComments("");
    removePhoto();
    setMessage("");
    setMessageType("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage("");
    setMessageType("");

    if (!mealDate) {
      setMessageType("error");
      setMessage(
        "Please select the meal date."
      );
      return;
    }

    if (!meal) {
      setMessageType("error");
      setMessage(
        "Please select a meal."
      );
      return;
    }

    if (!category) {
      setMessageType("error");
      setMessage(
        "Please select a feedback category."
      );
      return;
    }

    if (overallRating < 1) {
      setMessageType("error");
      setMessage(
        "Please provide an overall rating."
      );
      return;
    }

    if (comments.length > 500) {
      setMessageType("error");
      setMessage(
        "Comments must not exceed 500 characters."
      );
      return;
    }

    try {
      setSubmitting(true);

      const feedbackData = {
        menu_id: selectedMenu?.id || null,
        meal_date: mealDate,
        meal,
        category,
        overall_rating: overallRating,
        taste_rating: tasteRating,
        hygiene_rating: hygieneRating,
        quantity_rating: quantityRating,
        comments: comments.trim(),
      };

      await studentApi.submitFeedback(
        feedbackData,
        photo
      );

      setMessageType("success");
      setMessage(
        "Your feedback has been submitted successfully."
      );

      setTimeout(() => {
        resetForm();
      }, 1000);
    } catch (err) {
      console.error(
        "Feedback submission error:",
        err
      );

      setMessageType("error");
      setMessage(
        err?.message ||
          "Unable to submit feedback. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const setToday = () => {
    const todayKey = dateKey(
      new Date()
    );

    setMealDate(todayKey);
  };

  return (
    <div className="student-page student-feedback-page">
      <div className="student-page-header">
        <div>
          <div className="student-page-title-row">
            <MessageSquare size={27} />

            <h1>Feedback</h1>
          </div>

          <p>
            Share your experience and help improve
            hostel meals.
          </p>
        </div>

        <button
          type="button"
          className="student-refresh-btn"
          onClick={() => loadMenus(true)}
          disabled={refreshing}
        >
          <RefreshCw
            size={17}
            className={
              refreshing
                ? "student-spin"
                : ""
            }
          />

          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      <StudentAssignmentBanner
        assignment={assignment}
      />

      {error && (
        <div className="student-alert student-alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="student-feedback-layout">
        <section className="student-feedback-form-card">
          <div className="student-feedback-card-header">
            <div>
              <span className="student-section-eyebrow">
                Meal Experience
              </span>

              <h2>
                Tell us about your meal
              </h2>

              <p>
                Your feedback helps the mess team
                understand what students need.
              </p>
            </div>

            <div className="student-feedback-header-icon">
              <MessageSquare size={23} />
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="student-feedback-form-grid">
              <div className="student-feedback-field">
                <label htmlFor="feedback-date">
                  <CalendarDays size={14} />
                  Meal Date
                </label>

                <div className="student-feedback-date-row">
                  <input
                    id="feedback-date"
                    type="date"
                    value={mealDate}
                    max={dateKey(today)}
                    onChange={(event) =>
                      setMealDate(
                        event.target.value
                      )
                    }
                    disabled={submitting}
                  />

                  <button
                    type="button"
                    onClick={setToday}
                    disabled={submitting}
                  >
                    Today
                  </button>
                </div>
              </div>

              <div className="student-feedback-field">
                <label htmlFor="feedback-meal">
                  <Utensils size={14} />
                  Meal
                </label>

                <select
                  id="feedback-meal"
                  value={meal}
                  onChange={(event) =>
                    setMeal(event.target.value)
                  }
                  disabled={submitting}
                >
                  {MEALS.map(
                    (mealOption) => (
                      <option
                        key={mealOption}
                        value={mealOption}
                      >
                        {mealOption}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div className="student-feedback-field">
              <label htmlFor="feedback-category">
                Feedback Category
              </label>

              <select
                id="feedback-category"
                value={category}
                onChange={(event) =>
                  setCategory(
                    event.target.value
                  )
                }
                disabled={submitting}
              >
                {CATEGORIES.map(
                  (categoryOption) => (
                    <option
                      key={categoryOption}
                      value={categoryOption}
                    >
                      {categoryOption}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="student-feedback-rating-section">
              <div className="student-feedback-rating-section-heading">
                <div>
                  <strong>
                    Rate your experience
                  </strong>

                  <span>
                    1 = Poor &nbsp; • &nbsp;
                    5 = Excellent
                  </span>
                </div>
              </div>

              <StarRating
                label="Overall"
                value={overallRating}
                onChange={setOverallRating}
                disabled={submitting}
              />

              <StarRating
                label="Taste"
                value={tasteRating}
                onChange={setTasteRating}
                disabled={submitting}
              />

              <StarRating
                label="Hygiene"
                value={hygieneRating}
                onChange={setHygieneRating}
                disabled={submitting}
              />

              <StarRating
                label="Quantity"
                value={quantityRating}
                onChange={setQuantityRating}
                disabled={submitting}
              />
            </div>

            <div className="student-feedback-field">
              <div className="student-feedback-comment-heading">
                <label htmlFor="feedback-comments">
                  Comments
                </label>

                <span>
                  {comments.length}/500
                </span>
              </div>

              <textarea
                id="feedback-comments"
                value={comments}
                maxLength={500}
                onChange={(event) =>
                  setComments(
                    event.target.value
                  )
                }
                placeholder="Tell us what you liked or what could be improved..."
                disabled={submitting}
              />
            </div>

            <div className="student-feedback-field">
              <label>
                Photo
                <span className="student-feedback-optional">
                  Optional
                </span>
              </label>

              {!photoPreview ? (
                <label className="student-feedback-upload">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={
                      handlePhotoChange
                    }
                    disabled={submitting}
                  />

                  <ImagePlus size={23} />

                  <strong>
                    Add a photo
                  </strong>

                  <span>
                    JPG, PNG or WEBP • Max 5 MB
                  </span>
                </label>
              ) : (
                <div className="student-feedback-photo-preview">
                  <img
                    src={photoPreview}
                    alt="Feedback preview"
                  />

                  <button
                    type="button"
                    onClick={removePhoto}
                    disabled={submitting}
                    aria-label="Remove photo"
                  >
                    <X size={17} />
                  </button>

                  <div>
                    <strong>
                      {photo?.name}
                    </strong>

                    <span>
                      {(
                        (photo?.size || 0) /
                        1024 /
                        1024
                      ).toFixed(2)}{" "}
                      MB
                    </span>
                  </div>
                </div>
              )}
            </div>

            {message && (
              <div
                className={
                  messageType ===
                  "success"
                    ? "student-feedback-message success"
                    : "student-feedback-message error"
                }
              >
                {messageType ===
                "success" ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <AlertCircle size={17} />
                )}

                <span>{message}</span>
              </div>
            )}

            <div className="student-feedback-form-footer">
              <button
                type="button"
                className="student-feedback-reset-btn"
                onClick={resetForm}
                disabled={submitting}
              >
                Clear
              </button>

              <button
                type="submit"
                className="student-feedback-submit-btn"
                disabled={
                  submitting ||
                  loadingMenus
                }
              >
                {submitting ? (
                  <>
                    <RefreshCw
                      size={16}
                      className="student-spin"
                    />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Submit Feedback
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        <aside className="student-feedback-side">
          <div className="student-feedback-meal-card">
            <div className="student-feedback-side-heading">
              <div className="student-feedback-side-icon">
                <Utensils size={19} />
              </div>

              <div>
                <span>
                  Selected Meal
                </span>

                <strong>
                  {meal}
                </strong>
              </div>
            </div>

            <div className="student-feedback-meal-date">
              <CalendarDays size={16} />

              <span>
                {formatDate(mealDate)}
              </span>
            </div>

            {selectedMenu ? (
              <>
                <div className="student-feedback-menu-status">
                  <CheckCircle2 size={15} />
                  Published menu
                </div>

                <div className="student-feedback-menu-items">
                  {selectedMenu.items?.length >
                  0 ? (
                    selectedMenu.items
                      .slice(0, 6)
                      .map(
                        (item, index) => {
                          const name =
                            typeof item ===
                            "string"
                              ? item
                              : item?.name ||
                                item?.item_name ||
                                item?.food_name ||
                                "Menu item";

                          return (
                            <span
                              key={`${name}-${index}`}
                            >
                              {name}
                            </span>
                          );
                        }
                      )
                  ) : (
                    <span>
                      Menu items not available.
                    </span>
                  )}
                </div>

                {selectedMenu.servingTime && (
                  <div className="student-feedback-serving">
                    <Clock3 size={14} />

                    {selectedMenu.servingTime}
                  </div>
                )}
              </>
            ) : (
              <div className="student-feedback-no-menu">
                <AlertCircle size={17} />

                <span>
                  No published menu is available
                  for this meal/date.
                </span>
              </div>
            )}
          </div>

          <div className="student-feedback-tips-card">
            <h3>
              Feedback Guidelines
            </h3>

            <div>
              <CheckCircle2 size={15} />
              <span>
                Be specific and constructive.
              </span>
            </div>

            <div>
              <CheckCircle2 size={15} />
              <span>
                Rate the meal based on your actual
                experience.
              </span>
            </div>

            <div>
              <CheckCircle2 size={15} />
              <span>
                Mention what can be improved.
              </span>
            </div>

            <div>
              <CheckCircle2 size={15} />
              <span>
                Photos can help explain food-quality
                issues.
              </span>
            </div>
          </div>

          <div className="student-feedback-note-card">
            <Star size={18} />

            <div>
              <strong>
                Your voice matters
              </strong>

              <span>
                Honest feedback helps improve the
                dining experience for everyone.
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}