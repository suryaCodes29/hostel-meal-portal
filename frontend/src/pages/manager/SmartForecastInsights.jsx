
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CircleHelp,
  CookingPot,
  RefreshCw,
  Users,
  Utensils,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import "./smart-forecast-insights.css";


function getTodayLocal() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function formatDate(value) {
  if (!value) return "—";

  return new Date(`${value}T00:00:00`).toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}


function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}


function confidenceClass(value) {
  return String(value || "low").toLowerCase();
}


function readableMeal(value) {
  const meal = String(value || "").toLowerCase();

  return meal.charAt(0).toUpperCase() + meal.slice(1);
}


function SmartForecastInsights({
  apiFetch,
  hostelFilter = "all",
  messFilter = "all",
  categoryFilter = "all",
}) {
  const [forecastDate, setForecastDate] = useState(getTodayLocal());

  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [selectedMeal, setSelectedMeal] = useState("all");


  const loadInsights = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      params.set("date", forecastDate);

      if (hostelFilter !== "all") {
        params.set("hostel_id", hostelFilter);
      }

      if (messFilter !== "all") {
        params.set("mess_unit_id", messFilter);
      }

      if (categoryFilter !== "all") {
        params.set("meal_category", categoryFilter);
      }

      const result = await apiFetch(
        `/api/manager/forecasts/insights?${params.toString()}`
      );

      setData(result);
    } catch (err) {
      console.error("Smart Forecast Insights error:", err);

      setError(
        err?.message ||
        "Unable to load Smart Forecast Insights."
      );

      setData(null);
    } finally {
      setLoading(false);
    }
  }, [
    apiFetch,
    forecastDate,
    hostelFilter,
    messFilter,
    categoryFilter,
  ]);


  useEffect(() => {
    loadInsights();
  }, [loadInsights]);


  const forecasts = useMemo(() => {
    const rows = Array.isArray(data?.forecasts)
      ? data.forecasts
      : [];

    if (selectedMeal === "all") {
      return rows;
    }

    return rows.filter(
      (row) =>
        String(row.meal).toLowerCase() === selectedMeal
    );
  }, [data, selectedMeal]);


  const summary = useMemo(() => {
    const rows = forecasts;

    return {
      expectedStudents: rows.reduce(
        (total, row) =>
          total + Number(row.expectedStudents || 0),
        0
      ),

      confirmedYes: rows.reduce(
        (total, row) =>
          total + Number(row.confirmedYes || 0),
        0
      ),

      confirmedNo: rows.reduce(
        (total, row) =>
          total + Number(row.confirmedNo || 0),
        0
      ),

      noResponse: rows.reduce(
        (total, row) =>
          total + Number(row.noResponse || 0),
        0
      ),

      highConfidence: rows.filter(
        (row) => row.confidence === "High"
      ).length,

      lowConfidence: rows.filter(
        (row) => row.confidence === "Low"
      ).length,
    };
  }, [forecasts]);


  const recommendations = useMemo(() => {
    const result = [];

    forecasts.forEach((forecast) => {
      if (forecast.recommendation) {
        result.push({
          key: `${forecast.menuId}-waste`,
          meal: forecast.meal,
          hostel: forecast.hostel,
          messUnit: forecast.messUnit,
          message: forecast.recommendation,
          confidence: forecast.confidence,
        });
      }

      if (
        forecast.confidence === "Low" &&
        Array.isArray(forecast.confidenceReasons) &&
        forecast.confidenceReasons.length
      ) {
        result.push({
          key: `${forecast.menuId}-confidence`,
          meal: forecast.meal,
          hostel: forecast.hostel,
          messUnit: forecast.messUnit,
          message: forecast.confidenceReasons.join(". "),
          confidence: "Low",
        });
      }

      if (
        forecast.responseCoverage < 30 &&
        forecast.population > 0
      ) {
        result.push({
          key: `${forecast.menuId}-response`,
          meal: forecast.meal,
          hostel: forecast.hostel,
          messUnit: forecast.messUnit,
          message:
            "Student response coverage is low. Review responses before finalizing preparation quantities.",
          confidence: "Low",
        });
      }
    });

    return result;
  }, [forecasts]);


  return (
    <section className="smart-forecast-section">

      <div className="smart-forecast-heading">

        <div>
          <span className="smart-forecast-eyebrow">
            SMART DEMAND PLANNING
          </span>

          <h2>
            Food Demand Insights
          </h2>

          <p>
            Response-based demand estimation with historical attendance.
          </p>
        </div>

        <div className="smart-forecast-date-control">
          <CalendarDays size={17} />

          <input
            type="date"
            value={forecastDate}
            onChange={(event) =>
              setForecastDate(event.target.value)
            }
          />

          <button
            type="button"
            onClick={loadInsights}
            disabled={loading}
            title="Refresh insights"
          >
            <RefreshCw
              size={16}
              className={loading ? "smart-forecast-spin" : ""}
            />
          </button>
        </div>

      </div>


      {error && (
        <div className="smart-forecast-error">
          <AlertTriangle size={18} />

          <div>
            <strong>Insights could not be loaded</strong>
            <p>{error}</p>
          </div>

          <button
            type="button"
            onClick={loadInsights}
          >
            Retry
          </button>
        </div>
      )}


      <div className="smart-forecast-meal-tabs">

        {[
          { value: "all", label: "All Meals" },
          { value: "breakfast", label: "Breakfast" },
          { value: "lunch", label: "Lunch" },
          { value: "snacks", label: "Snacks" },
          { value: "dinner", label: "Dinner" },
        ].map((meal) => (
          <button
            key={meal.value}
            type="button"
            className={
              selectedMeal === meal.value
                ? "active"
                : ""
            }
            onClick={() => setSelectedMeal(meal.value)}
          >
            {meal.label}
          </button>
        ))}

      </div>


      {loading && !data ? (
        <div className="smart-forecast-loading">
          <RefreshCw className="smart-forecast-spin" size={22} />
          <span>Calculating demand insights...</span>
        </div>
      ) : (
        <>
          <div className="smart-forecast-summary-grid">

            <article className="smart-forecast-summary-card">
              <div className="smart-forecast-card-icon blue">
                <Users size={19} />
              </div>

              <span>Expected Students</span>

              <strong>
                {formatNumber(summary.expectedStudents)}
              </strong>

              <small>Confirmed + estimated demand</small>
            </article>


            <article className="smart-forecast-summary-card">
              <div className="smart-forecast-card-icon green">
                <CheckCircle2 size={19} />
              </div>

              <span>Confirmed YES</span>

              <strong>
                {formatNumber(summary.confirmedYes)}
              </strong>

              <small>Students confirmed attendance</small>
            </article>


            <article className="smart-forecast-summary-card">
              <div className="smart-forecast-card-icon orange">
                <CircleHelp size={19} />
              </div>

              <span>No Response</span>

              <strong>
                {formatNumber(summary.noResponse)}
              </strong>

              <small>Attendance estimated from history</small>
            </article>


            <article className="smart-forecast-summary-card">
              <div className="smart-forecast-card-icon purple">
                <Utensils size={19} />
              </div>

              <span>Confirmed NO</span>

              <strong>
                {formatNumber(summary.confirmedNo)}
              </strong>

              <small>Students not attending</small>
            </article>

          </div>


          {!forecasts.length ? (
            <div className="smart-forecast-empty">
              <CookingPot size={30} />

              <strong>No menu forecasts available</strong>

              <p>
                There are no menus for this date and selected filters.
              </p>
            </div>
          ) : (
            <div className="smart-forecast-meal-grid">

              {forecasts.map((forecast) => (
                <article
                  className="smart-forecast-meal-card"
                  key={forecast.menuId}
                >

                  <div className="smart-forecast-meal-card-header">

                    <div>
                      <span className="smart-forecast-meal-label">
                        {readableMeal(forecast.meal)}
                      </span>

                      <h3>
                        {forecast.hostel}
                      </h3>

                      <p>
                        {forecast.messUnit}
                        {" · "}
                        {forecast.mealCategory === "non-veg"
                          ? "Non-Veg"
                          : "Veg"}
                      </p>
                    </div>

                    <span
                      className={`smart-forecast-confidence ${confidenceClass(
                        forecast.confidence
                      )}`}
                    >
                      {forecast.confidence} Confidence
                    </span>

                  </div>


                  <div className="smart-forecast-attendance">

                    <div>
                      <span>Expected attendance</span>
                      <strong>
                        {formatNumber(forecast.expectedStudents)}
                      </strong>
                    </div>

                    <div>
                      <span>Total population</span>
                      <strong>
                        {formatNumber(forecast.population)}
                      </strong>
                    </div>

                  </div>


                  <div className="smart-forecast-response-bar">

                    <div className="smart-forecast-response-bar-label">
                      <span>Response coverage</span>

                      <strong>
                        {forecast.responseCoverage}%
                      </strong>
                    </div>

                    <div className="smart-forecast-progress-track">
                      <div
                        className="smart-forecast-progress-fill"
                        style={{
                          width: `${Math.min(
                            Math.max(
                              Number(forecast.responseCoverage || 0),
                              0
                            ),
                            100
                          )}%`,
                        }}
                      />
                    </div>

                  </div>


                  <div className="smart-forecast-response-breakdown">

                    <div>
                      <span className="dot yes" />
                      YES
                      <strong>
                        {formatNumber(forecast.confirmedYes)}
                      </strong>
                    </div>

                    <div>
                      <span className="dot no" />
                      NO
                      <strong>
                        {formatNumber(forecast.confirmedNo)}
                      </strong>
                    </div>

                    <div>
                      <span className="dot pending" />
                      No Response
                      <strong>
                        {formatNumber(forecast.noResponse)}
                      </strong>
                    </div>

                  </div>


                  <div className="smart-forecast-estimation-box">

                    <span>
                      Estimated attendance from non-responders
                    </span>

                    <strong>
                      {formatNumber(
                        forecast.estimatedNonResponderAttendance
                      )}
                    </strong>

                    <small>
                      Historical attendance rate:{" "}
                      {forecast.historicalAttendanceRate}%
                    </small>

                  </div>


                  <div className="smart-forecast-history-info">

                    <span>
                      Historical records
                    </span>

                    <strong>
                      {forecast.historicalRecords}
                    </strong>

                    <span>
                      Average attendance
                    </span>

                    <strong>
                      {formatNumber(
                        forecast.historicalAverageAttendance
                      )}
                    </strong>

                  </div>


                  {forecast.confidenceReasons?.length > 0 && (
                    <div className="smart-forecast-confidence-reasons">
                      {forecast.confidenceReasons.map(
                        (reason, index) => (
                          <span key={index}>
                            {reason}
                          </span>
                        )
                      )}
                    </div>
                  )}


                  <div className="smart-forecast-food-section">

                    <div className="smart-forecast-food-heading">
                      <CookingPot size={17} />

                      <h4>
                        Food Preparation Plan
                      </h4>
                    </div>


                    {!forecast.foodItems?.length ? (
                      <p className="smart-forecast-no-food">
                        No configured food quantities are available for this menu.
                      </p>
                    ) : (
                      <div className="smart-forecast-food-table-wrapper">

                        <table className="smart-forecast-food-table">

                          <thead>
                            <tr>
                              <th>Food Item</th>
                              <th>Per Student</th>
                              <th>Recommended</th>
                            </tr>
                          </thead>

                          <tbody>
                            {forecast.foodItems.map((item) => (
                              <tr key={item.menuItemId}>
                                <td>{item.name}</td>

                                <td>
                                  {item.quantityPerStudent}
                                  {" "}
                                  {item.unit}
                                </td>

                                <td>
                                  <strong>
                                    {item.recommendedQuantity}
                                    {" "}
                                    {item.unit}
                                  </strong>
                                </td>
                              </tr>
                            ))}
                          </tbody>

                        </table>

                      </div>
                    )}

                  </div>


                  {forecast.recommendation && (
                    <div className="smart-forecast-recommendation">
                      <AlertTriangle size={17} />

                      <div>
                        <strong>Recommendation</strong>

                        <p>
                          {forecast.recommendation}
                        </p>
                      </div>
                    </div>
                  )}

                </article>
              ))}

            </div>
          )}


          {recommendations.length > 0 && (
            <section className="smart-forecast-recommendations-section">

              <div className="smart-forecast-recommendations-heading">
                <div>
                  <span className="smart-forecast-eyebrow">
                    DATA-DRIVEN SUGGESTIONS
                  </span>

                  <h3>
                    Manager Recommendations
                  </h3>
                </div>
              </div>


              <div className="smart-forecast-recommendations-list">

                {recommendations.map((recommendation) => (
                  <article
                    key={recommendation.key}
                    className="smart-forecast-recommendation-item"
                  >
                    <div className="smart-forecast-recommendation-icon">
                      <AlertTriangle size={18} />
                    </div>

                    <div>
                      <strong>
                        {readableMeal(recommendation.meal)}
                        {" · "}
                        {recommendation.hostel}
                      </strong>

                      <p>
                        {recommendation.message}
                      </p>

                      <span>
                        Confidence: {recommendation.confidence}
                      </span>
                    </div>
                  </article>
                ))}

              </div>

            </section>
          )}

        </>
      )}

    </section>
  );
}


export default SmartForecastInsights;
