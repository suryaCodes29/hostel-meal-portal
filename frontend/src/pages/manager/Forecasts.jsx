import SmartForecastInsights from "./SmartForecastInsights";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useManager,
} from "../../context/ManagerContext";

import "./forecasts.css";


const MEAL_ORDER = [
  "breakfast",
  "lunch",
  "snacks",
  "dinner",
];


function normalizeStatus(value) {
  return String(
    value || "planned"
  )
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replaceAll(" ", "-");
}


function readableMeal(value) {
  const normalized =
    String(
      value || ""
    ).toLowerCase();


  if (
    normalized === "breakfast"
  ) {
    return "Breakfast";
  }


  if (
    normalized === "lunch"
  ) {
    return "Lunch";
  }


  if (
    normalized === "snacks"
  ) {
    return "Snacks";
  }


  if (
    normalized === "dinner"
  ) {
    return "Dinner";
  }


  return value || "—";
}


function readableCategory(value) {
  if (
    value === "non-veg"
  ) {
    return "Non-Veg";
  }


  if (
    value === "veg"
  ) {
    return "Veg";
  }


  return "—";
}


function readablePreparationStatus(
  value
) {
  const status =
    normalizeStatus(value);


  if (
    status === "planned"
  ) {
    return "Planned";
  }


  if (
    status === "in-progress"
  ) {
    return "In Progress";
  }


  if (
    status === "completed"
  ) {
    return "Completed";
  }


  if (
    status === "pending"
  ) {
    return "Pending";
  }


  return String(
    value || "Planned"
  );
}


function formatDate(value) {
  if (!value) {
    return "—";
  }


  const date =
    new Date(
      `${value}T00:00:00`
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }


  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}


function formatShortDate(value) {
  if (!value) {
    return "";
  }


  const date =
    new Date(
      `${value}T00:00:00`
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }


  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
    }
  ).format(date);
}


function formatDateTime(value) {
  if (!value) {
    return "—";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }


  return date.toLocaleString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}


function ForecastLineChart({
  data,
}) {
  const width = 760;
  const height = 260;

  const paddingLeft = 48;
  const paddingRight = 26;
  const paddingTop = 25;
  const paddingBottom = 44;


  const chartWidth =
    width -
    paddingLeft -
    paddingRight;


  const chartHeight =
    height -
    paddingTop -
    paddingBottom;


  const maxValue =
    Math.max(
      ...data.flatMap(
        (item) => [
          Number(
            item.predicted || 0
          ),
          Number(
            item.actual || 0
          ),
        ]
      ),
      10
    );


  const roundedMaximum =
    Math.ceil(
      maxValue / 50
    ) * 50 || 50;


  const pointX =
    (index) => {
      if (
        data.length <= 1
      ) {
        return (
          paddingLeft +
          chartWidth / 2
        );
      }


      return (
        paddingLeft +
        (
          index /
          (data.length - 1)
        ) *
          chartWidth
      );
    };


  const pointY =
    (value) => {
      return (
        paddingTop +
        chartHeight -
        (
          Number(value || 0) /
          roundedMaximum
        ) *
          chartHeight
      );
    };


  const predictedPoints =
    data
      .map(
        (item, index) =>
          `${pointX(index)},${pointY(
            item.predicted
          )}`
      )
      .join(" ");


  const actualPoints =
    data
      .filter(
        (item) =>
          item.actual !== null &&
          item.actual !== undefined
      )
      .map((item) => {
        const originalIndex =
          data.findIndex(
            (row) =>
              row.date ===
              item.date
          );


        return `${pointX(
          originalIndex
        )},${pointY(
          item.actual
        )}`;
      })
      .join(" ");


  const horizontalLines = [
    0,
    0.25,
    0.5,
    0.75,
    1,
  ];


  if (
    data.length === 0
  ) {
    return (
      <div className="forecast-chart-empty">

        <TrendingUp
          size={34}
        />

        <strong>
          No chart data
        </strong>

        <span>
          Change the filters or date range to view forecast data.
        </span>

      </div>
    );
  }


  return (
    <div className="forecast-line-chart-wrapper">

      <svg
        className="forecast-line-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Predicted versus actual demand chart"
      >

        {/* ===================================================
            GRID
        =================================================== */}

        {horizontalLines.map(
          (ratio) => {
            const y =
              paddingTop +
              chartHeight -
              ratio *
                chartHeight;


            const value =
              Math.round(
                roundedMaximum *
                  ratio
              );


            return (
              <g
                key={ratio}
              >

                <line
                  className="forecast-chart-grid-line"
                  x1={paddingLeft}
                  x2={
                    width -
                    paddingRight
                  }
                  y1={y}
                  y2={y}
                />


                <text
                  className="forecast-chart-axis-label"
                  x={
                    paddingLeft -
                    10
                  }
                  y={y + 4}
                  textAnchor="end"
                >
                  {value}
                </text>

              </g>
            );
          }
        )}


        {/* ===================================================
            X AXIS LABELS
        =================================================== */}

        {data.map(
          (item, index) => (
            <text
              key={
                item.date
              }
              className="forecast-chart-axis-label"
              x={
                pointX(index)
              }
              y={
                height - 14
              }
              textAnchor="middle"
            >
              {formatShortDate(
                item.date
              )}
            </text>
          )
        )}


        {/* ===================================================
            PREDICTED LINE
        =================================================== */}

        {predictedPoints && (
          <polyline
            className="forecast-chart-line predicted"
            points={
              predictedPoints
            }
          />
        )}


        {/* ===================================================
            ACTUAL LINE
        =================================================== */}

        {actualPoints && (
          <polyline
            className="forecast-chart-line actual"
            points={
              actualPoints
            }
          />
        )}


        {/* ===================================================
            PREDICTED POINTS
        =================================================== */}

        {data.map(
          (item, index) => (
            <g
              key={`predicted-${item.date}`}
            >

              <circle
                className="forecast-chart-point predicted"
                cx={
                  pointX(index)
                }
                cy={
                  pointY(
                    item.predicted
                  )
                }
                r="4"
              >

                <title>
                  {`${formatDate(
                    item.date
                  )} - Predicted: ${
                    item.predicted
                  }`}
                </title>

              </circle>

            </g>
          )
        )}


        {/* ===================================================
            ACTUAL POINTS
        =================================================== */}

        {data.map(
          (item, index) => {
            if (
              item.actual ===
                null ||
              item.actual ===
                undefined
            ) {
              return null;
            }


            return (
              <circle
                key={`actual-${item.date}`}
                className="forecast-chart-point actual"
                cx={
                  pointX(index)
                }
                cy={
                  pointY(
                    item.actual
                  )
                }
                r="4"
              >

                <title>
                  {`${formatDate(
                    item.date
                  )} - Actual: ${
                    item.actual
                  }`}
                </title>

              </circle>
            );
          }
        )}

      </svg>

    </div>
  );
}


function Forecasts() {
  const {
    apiFetch,
    hostels,
    messUnits,
  } = useManager();


  /* =========================================================
     DATA
  ========================================================= */

  const [
    forecasts,
    setForecasts,
  ] = useState([]);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    error,
    setError,
  ] = useState("");


  /* =========================================================
     FILTERS
  ========================================================= */

  const [
    hostelFilter,
    setHostelFilter,
  ] = useState("all");


  const [
    messFilter,
    setMessFilter,
  ] = useState("all");


  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState("all");


  const [
    startDate,
    setStartDate,
  ] = useState("");


  const [
    endDate,
    setEndDate,
  ] = useState("");


  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");


  const [
    search,
    setSearch,
  ] = useState("");


  /* =========================================================
     VIEW MODAL
  ========================================================= */

  const [
    viewingForecast,
    setViewingForecast,
  ] = useState(null);


  /* =========================================================
     PAGE MESS OPTIONS
  ========================================================= */

  const pageMessUnits =
    useMemo(() => {
      if (
        hostelFilter ===
        "all"
      ) {
        return messUnits;
      }


      return messUnits.filter(
        (mess) => {
          const hostelId =
            mess.hostelId ??
            mess.hostel_id ??
            mess.hostel?.id;


          return (
            String(
              hostelId
            ) ===
            String(
              hostelFilter
            )
          );
        }
      );
    }, [
      messUnits,
      hostelFilter,
    ]);


  useEffect(() => {
    if (
      messFilter ===
      "all"
    ) {
      return;
    }


    const valid =
      pageMessUnits.some(
        (mess) =>
          String(
            mess.id
          ) ===
          String(
            messFilter
          )
      );


    if (!valid) {
      setMessFilter(
        "all"
      );
    }
  }, [
    pageMessUnits,
    messFilter,
  ]);


  /* =========================================================
     LOAD FORECASTS
  ========================================================= */

  const loadForecasts =
    useCallback(async () => {
      setLoading(true);

      setError("");


      try {
        const params =
          new URLSearchParams();


        if (
          hostelFilter !==
          "all"
        ) {
          params.set(
            "hostel_id",
            hostelFilter
          );
        }


        if (
          messFilter !==
          "all"
        ) {
          params.set(
            "mess_unit_id",
            messFilter
          );
        }


        if (
          categoryFilter !==
          "all"
        ) {
          params.set(
            "meal_category",
            categoryFilter
          );
        }


        if (startDate) {
          params.set(
            "start_date",
            startDate
          );
        }


        if (endDate) {
          params.set(
            "end_date",
            endDate
          );
        }


        const query =
          params.toString();


        const data =
          await apiFetch(
            query
              ? `/api/manager/forecasts?${query}`
              : "/api/manager/forecasts"
          );


        setForecasts(
          Array.isArray(
            data.forecasts
          )
            ? data.forecasts
            : []
        );
      } catch (loadError) {
        console.error(
          "Forecast loading error:",
          loadError
        );


        setError(
          loadError.message ||
            "Unable to load Forecast data."
        );


        setForecasts([]);
      } finally {
        setLoading(false);
      }
    }, [
      apiFetch,
      hostelFilter,
      messFilter,
      categoryFilter,
      startDate,
      endDate,
    ]);


  useEffect(() => {
    loadForecasts();
  }, [loadForecasts]);


  /* =========================================================
     LOCAL FILTERS
  ========================================================= */

  const filteredForecasts =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();


      return forecasts.filter(
        (forecast) => {
          const matchesStatus =
            statusFilter ===
              "all" ||
            normalizeStatus(
              forecast
                .preparationStatus
            ) ===
              statusFilter;


          const matchesSearch =
            !term ||
            String(
              forecast.hostel ||
                ""
            )
              .toLowerCase()
              .includes(term) ||
            String(
              forecast.messUnit ||
                ""
            )
              .toLowerCase()
              .includes(term) ||
            String(
              forecast.meal ||
                ""
            )
              .toLowerCase()
              .includes(term);


          return (
            matchesStatus &&
            matchesSearch
          );
        }
      );
    }, [
      forecasts,
      statusFilter,
      search,
    ]);


  /* =========================================================
     SUMMARY
  ========================================================= */

  const summary =
    useMemo(() => {
      let predicted = 0;
      let actual = 0;
      let actualRecords = 0;
      let absoluteDifference = 0;


      filteredForecasts.forEach(
        (forecast) => {
          const predictedValue =
            Number(
              forecast
                .predictedStudents ||
                0
            );


          predicted +=
            predictedValue;


          if (
            forecast.actualStudents !==
              null &&
            forecast.actualStudents !==
              undefined
          ) {
            const actualValue =
              Number(
                forecast
                  .actualStudents ||
                  0
              );


            actual +=
              actualValue;


            actualRecords += 1;


            absoluteDifference +=
              Math.abs(
                actualValue -
                  predictedValue
              );
          }
        }
      );


      let accuracy = null;


      if (
        actualRecords > 0 &&
        actual > 0
      ) {
        accuracy =
          Math.max(
            0,
            100 -
              (
                absoluteDifference /
                actual
              ) *
                100
          );
      }


      return {
        records:
          filteredForecasts.length,

        predicted,

        actual,

        actualRecords,

        difference:
          actualRecords > 0
            ? actual -
              predicted
            : null,

        accuracy:
          accuracy !== null
            ? Number(
                accuracy.toFixed(
                  1
                )
              )
            : null,
      };
    }, [
      filteredForecasts,
    ]);


  /* =========================================================
     DAILY CHART DATA
  ========================================================= */

  const chartData =
    useMemo(() => {
      const grouped =
        new Map();


      filteredForecasts.forEach(
        (forecast) => {
          const date =
            forecast.date;


          if (
            !grouped.has(date)
          ) {
            grouped.set(
              date,
              {
                date,

                predicted: 0,

                actual: 0,

                hasActual: false,
              }
            );
          }


          const row =
            grouped.get(date);


          row.predicted +=
            Number(
              forecast
                .predictedStudents ||
                0
            );


          if (
            forecast.actualStudents !==
              null &&
            forecast.actualStudents !==
              undefined
          ) {
            row.actual +=
              Number(
                forecast
                  .actualStudents ||
                  0
              );


            row.hasActual =
              true;
          }
        }
      );


      return Array.from(
        grouped.values()
      )
        .sort(
          (a, b) =>
            String(
              a.date
            ).localeCompare(
              String(
                b.date
              )
            )
        )
        .map(
          (item) => ({
            date:
              item.date,

            predicted:
              item.predicted,

            actual:
              item.hasActual
                ? item.actual
                : null,
          })
        );
    }, [
      filteredForecasts,
    ]);


  /* =========================================================
     MEAL-WISE DEMAND
  ========================================================= */

  const mealDemand =
    useMemo(() => {
      return MEAL_ORDER.map(
        (meal) => {
          const rows =
            filteredForecasts.filter(
              (forecast) =>
                String(
                  forecast.meal
                ).toLowerCase() ===
                meal
            );


          const predicted =
            rows.reduce(
              (
                total,
                forecast
              ) =>
                total +
                Number(
                  forecast
                    .predictedStudents ||
                    0
                ),
              0
            );


          const actualRows =
            rows.filter(
              (forecast) =>
                forecast.actualStudents !==
                  null &&
                forecast.actualStudents !==
                  undefined
            );


          const actual =
            actualRows.reduce(
              (
                total,
                forecast
              ) =>
                total +
                Number(
                  forecast
                    .actualStudents ||
                    0
                ),
              0
            );


          return {
            meal,

            predicted,

            actual:
              actualRows.length > 0
                ? actual
                : null,

            records:
              rows.length,
          };
        }
      );
    }, [
      filteredForecasts,
    ]);


  /* =========================================================
     UPCOMING THREE DAYS
  ========================================================= */

  const upcomingThreeDays =
    useMemo(() => {
      const today =
        new Date();


      today.setHours(
        0,
        0,
        0,
        0
      );


      const futureDates =
        [
          ...new Set(
            filteredForecasts
              .filter(
                (forecast) => {
                  const date =
                    new Date(
                      `${forecast.date}T00:00:00`
                    );


                  return (
                    !Number.isNaN(
                      date.getTime()
                    ) &&
                    date >= today
                  );
                }
              )
              .map(
                (forecast) =>
                  forecast.date
              )
          ),
        ]
          .sort()
          .slice(0, 3);


      return futureDates.map(
        (date) => ({
          date,

          rows:
            filteredForecasts
              .filter(
                (forecast) =>
                  forecast.date ===
                  date
              )
              .sort(
                (a, b) =>
                  MEAL_ORDER.indexOf(
                    String(
                      a.meal
                    ).toLowerCase()
                  ) -
                  MEAL_ORDER.indexOf(
                    String(
                      b.meal
                    ).toLowerCase()
                  )
              ),
        })
      );
    }, [
      filteredForecasts,
    ]);


  /* =========================================================
     CLEAR FILTERS
  ========================================================= */

  const clearFilters = () => {
    setHostelFilter(
      "all"
    );

    setMessFilter(
      "all"
    );

    setCategoryFilter(
      "all"
    );

    setStartDate("");

    setEndDate("");

    setStatusFilter(
      "all"
    );

    setSearch("");
  };


  /* =========================================================
     DATE VALIDATION
  ========================================================= */

  const invalidDateRange =
    Boolean(
      startDate &&
      endDate &&
      startDate > endDate
    );


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="forecasts-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="forecasts-header">

        <div>

          <span className="forecasts-eyebrow">
            ML DEMAND FORECAST
          </span>

          <h1>
            Forecasts
          </h1>

          <p>
            Compare predicted meal demand with actual attendance.
          </p>

        </div>


        <button
          type="button"
          className="forecast-refresh-button"
          onClick={
            loadForecasts
          }
          disabled={
            loading
          }
        >
          <RefreshCw
            size={16}
            className={
              loading
                ? "forecast-spin"
                : ""
            }
          />

          Refresh
        </button>

      </div>

      {/* =====================================================
          SMART FOOD DEMAND INSIGHTS
      ===================================================== */}

      <SmartForecastInsights
        apiFetch={apiFetch}
        hostelFilter={hostelFilter}
        messFilter={messFilter}
        categoryFilter={categoryFilter}
      />
      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="forecast-error-message">

          <AlertTriangle
            size={18}
          />

          <div>

            <strong>
              Unable to load forecasts
            </strong>

            <span>
              {error}
            </span>

          </div>


          <button
            type="button"
            onClick={
              loadForecasts
            }
          >
            Retry
          </button>

        </div>
      )}


      {/* =====================================================
          DATE RANGE ERROR
      ===================================================== */}

      {invalidDateRange && (
        <div className="forecast-warning-message">

          <AlertTriangle
            size={17}
          />

          <span>
            Start Date cannot be later than End Date.
          </span>

        </div>
      )}


      {/* =====================================================
          FILTERS
      ===================================================== */}

      <section className="forecast-filter-card">

        <div className="forecast-search-box">

          <Search size={16} />

          <input
            type="text"
            value={
              search
            }
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search Hostel, Mess Unit or meal"
          />

        </div>


        <div className="forecast-filter-field">

          <label>
            Hostel
          </label>

          <select
            value={
              hostelFilter
            }
            onChange={(event) => {
              setHostelFilter(
                event.target.value
              );

              setMessFilter(
                "all"
              );
            }}
          >
            <option value="all">
              All Hostels
            </option>

            {hostels.map(
              (hostel) => (
                <option
                  key={
                    hostel.id
                  }
                  value={
                    hostel.id
                  }
                >
                  {hostel.name}
                </option>
              )
            )}

          </select>

        </div>


        <div className="forecast-filter-field">

          <label>
            Mess Unit
          </label>

          <select
            value={
              messFilter
            }
            onChange={(event) =>
              setMessFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All Mess Units
            </option>

            {pageMessUnits.map(
              (mess) => (
                <option
                  key={
                    mess.id
                  }
                  value={
                    mess.id
                  }
                >
                  {mess.name}
                </option>
              )
            )}

          </select>

        </div>


        <div className="forecast-filter-field">

          <label>
            Meal Category
          </label>

          <select
            value={
              categoryFilter
            }
            onChange={(event) =>
              setCategoryFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All
            </option>

            <option value="veg">
              Veg
            </option>

            <option value="non-veg">
              Non-Veg
            </option>
          </select>

        </div>


        <div className="forecast-filter-field">

          <label>
            Start Date
          </label>

          <input
            type="date"
            value={
              startDate
            }
            onChange={(event) =>
              setStartDate(
                event.target.value
              )
            }
            max={
              endDate || undefined
            }
          />

        </div>


        <div className="forecast-filter-field">

          <label>
            End Date
          </label>

          <input
            type="date"
            value={
              endDate
            }
            onChange={(event) =>
              setEndDate(
                event.target.value
              )
            }
            min={
              startDate ||
              undefined
            }
          />

        </div>


        <div className="forecast-filter-field">

          <label>
            Preparation
          </label>

          <select
            value={
              statusFilter
            }
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
          >
            <option value="all">
              All
            </option>

            <option value="planned">
              Planned
            </option>

            <option value="in-progress">
              In Progress
            </option>

            <option value="completed">
              Completed
            </option>

            <option value="pending">
              Pending
            </option>
          </select>

        </div>


        <button
          type="button"
          className="forecast-clear-button"
          onClick={
            clearFilters
          }
        >
          Clear Filters
        </button>

      </section>


      {/* =====================================================
          SUMMARY CARDS
      ===================================================== */}

      <section className="forecast-summary-grid">

        <article className="forecast-summary-card">

          <div className="forecast-summary-icon blue">

            <TrendingUp
              size={20}
            />

          </div>

          <div>

            <span>
              Predicted Students
            </span>

            <strong>
              {summary.predicted}
            </strong>

          </div>

        </article>


        <article className="forecast-summary-card">

          <div className="forecast-summary-icon orange">

            <Users size={20} />

          </div>

          <div>

            <span>
              Actual Students
            </span>

            <strong>
              {summary.actualRecords >
              0
                ? summary.actual
                : "—"}
            </strong>

          </div>

        </article>


        <article className="forecast-summary-card">

          <div className="forecast-summary-icon green">

            <CheckCircle2
              size={20}
            />

          </div>

          <div>

            <span>
              Forecast Accuracy
            </span>

            <strong>
              {summary.accuracy !==
              null
                ? `${summary.accuracy}%`
                : "—"}
            </strong>

          </div>

        </article>


        <article className="forecast-summary-card">

          <div className="forecast-summary-icon navy">

            <UtensilsCrossed
              size={20}
            />

          </div>

          <div>

            <span>
              Forecast Records
            </span>

            <strong>
              {summary.records}
            </strong>

          </div>

        </article>

      </section>


      {/* =====================================================
          CHART + MEAL DEMAND
      ===================================================== */}

      <section className="forecast-dashboard-grid">

        {/* ===================================================
            LINE CHART
        =================================================== */}

        <article className="forecast-panel forecast-chart-panel">

          <div className="forecast-panel-header">

            <div>

              <h2>
                Predicted vs Actual Demand
              </h2>

              <p>
                Daily total student demand from database forecast records.
              </p>

            </div>


            <div className="forecast-chart-legend">

              <span className="predicted">

                <i />

                Predicted

              </span>


              <span className="actual">

                <i />

                Actual

              </span>

            </div>

          </div>


          {loading ? (

            <div className="forecast-panel-loading">

              <RefreshCw
                size={24}
                className="forecast-spin"
              />

              <span>
                Loading chart...
              </span>

            </div>

          ) : (

            <ForecastLineChart
              data={
                chartData
              }
            />

          )}

        </article>


        {/* ===================================================
            MEAL WISE FORECAST
        =================================================== */}

        <article className="forecast-panel">

          <div className="forecast-panel-header">

            <div>

              <h2>
                Demand by Meal
              </h2>

              <p>
                Predicted demand for each meal type.
              </p>

            </div>

          </div>


          <div className="forecast-meal-list">

            {mealDemand.map(
              (item) => {

                const maxMealValue =
                  Math.max(
                    ...mealDemand.map(
                      (meal) =>
                        Number(
                          meal.predicted ||
                            0
                        )
                    ),
                    1
                  );


                const width =
                  Math.min(
                    100,
                    (
                      Number(
                        item.predicted ||
                          0
                      ) /
                      maxMealValue
                    ) *
                      100
                  );


                return (
                  <div
                    key={
                      item.meal
                    }
                    className="forecast-meal-row"
                  >

                    <div className="forecast-meal-row-top">

                      <div>

                        <strong>
                          {readableMeal(
                            item.meal
                          )}
                        </strong>

                        <span>
                          {item.records}
                          {" "}
                          forecast records
                        </span>

                      </div>


                      <strong className="forecast-meal-value">
                        {item.predicted}
                      </strong>

                    </div>


                    <div className="forecast-meal-progress">

                      <span
                        style={{
                          width:
                            `${width}%`,
                        }}
                      />

                    </div>


                    <div className="forecast-meal-comparison">

                      <span>
                        Predicted:
                        {" "}
                        <strong>
                          {item.predicted}
                        </strong>
                      </span>

                      <span>
                        Actual:
                        {" "}
                        <strong>
                          {item.actual !==
                          null
                            ? item.actual
                            : "—"}
                        </strong>
                      </span>

                    </div>

                  </div>
                );
              }
            )}

          </div>

        </article>

      </section>


      {/* =====================================================
          NEXT THREE DAYS
      ===================================================== */}

      <section className="forecast-panel forecast-upcoming-panel">

        <div className="forecast-panel-header">

          <div>

            <h2>
              Next Three Days Forecast
            </h2>

            <p>
              Upcoming meal preparation demand.
            </p>

          </div>

        </div>


        {loading ? (

          <div className="forecast-panel-loading">

            <RefreshCw
              size={24}
              className="forecast-spin"
            />

            <span>
              Loading upcoming forecasts...
            </span>

          </div>

        ) : upcomingThreeDays.length ===
          0 ? (

          <div className="forecast-upcoming-empty">

            <CalendarDays
              size={32}
            />

            <strong>
              No upcoming forecast records
            </strong>

            <span>
              The database does not currently contain forecast rows for future dates under these filters.
            </span>

          </div>

        ) : (

          <div className="forecast-upcoming-grid">

            {upcomingThreeDays.map(
              (day) => (

                <article
                  key={
                    day.date
                  }
                  className="forecast-day-card"
                >

                  <div className="forecast-day-heading">

                    <CalendarDays
                      size={17}
                    />

                    <strong>
                      {formatDate(
                        day.date
                      )}
                    </strong>

                  </div>


                  <div className="forecast-day-meals">

                    {day.rows.map(
                      (forecast) => (

                        <div
                          key={
                            forecast.id
                          }
                          className="forecast-day-meal"
                        >

                          <div>

                            <strong>
                              {readableMeal(
                                forecast.meal
                              )}
                            </strong>

                            <span>
                              {readableCategory(
                                forecast.mealCategory
                              )}
                            </span>

                          </div>


                          <div className="forecast-day-prediction">

                            <span>
                              Predicted
                            </span>

                            <strong>
                              {forecast.predictedStudents}
                            </strong>

                          </div>

                        </div>

                      )
                    )}

                  </div>

                </article>

              )
            )}

          </div>
        )}

      </section>


      {/* =====================================================
          FORECAST TABLE
      ===================================================== */}

      <section className="forecast-table-card">

        <div className="forecast-table-heading">

          <div>

            <strong>
              Forecast Details
            </strong>

            <span>
              {filteredForecasts.length}
              {" "}
              matching records
            </span>

          </div>

        </div>


        {loading ? (

          <div className="forecast-loading">

            <RefreshCw
              size={25}
              className="forecast-spin"
            />

            <span>
              Loading forecasts...
            </span>

          </div>

        ) : filteredForecasts.length ===
          0 ? (

          <div className="forecast-empty-state">

            <TrendingUp
              size={38}
            />

            <h2>
              No Forecasts found
            </h2>

            <p>
              No database forecast records match the selected filters.
            </p>

          </div>

        ) : (

          <div className="forecast-table-wrapper">

            <table className="forecast-table">

              <thead>

                <tr>

                  <th>#</th>

                  <th>Date</th>

                  <th>Meal</th>

                  <th>
                    Meal Category
                  </th>

                  <th>Hostel</th>

                  <th>Mess Unit</th>

                  <th>
                    Predicted
                  </th>

                  <th>
                    Actual
                  </th>

                  <th>
                    Difference
                  </th>

                  <th>
                    Preparation Status
                  </th>

                  <th>
                    Last Updated
                  </th>

                  <th>
                    Actions
                  </th>

                </tr>

              </thead>


              <tbody>

                {filteredForecasts.map(
                  (
                    forecast,
                    index
                  ) => {

                    const difference =
                      forecast.difference;


                    return (
                      <tr
                        key={
                          forecast.id
                        }
                      >

                        <td>
                          {index + 1}
                        </td>


                        <td>
                          <div className="forecast-date-cell">

                            <CalendarDays
                              size={14}
                            />

                            {formatDate(
                              forecast.date
                            )}

                          </div>
                        </td>


                        <td>
                          <span className="forecast-meal-badge">
                            {readableMeal(
                              forecast.meal
                            )}
                          </span>
                        </td>


                        <td>
                          <span
                            className={`forecast-category-badge ${
                              forecast.mealCategory ===
                              "non-veg"
                                ? "nonveg"
                                : "veg"
                            }`}
                          >
                            {readableCategory(
                              forecast.mealCategory
                            )}
                          </span>
                        </td>


                        <td>
                          {forecast.hostel ||
                            "—"}
                        </td>


                        <td>
                          {forecast.messUnit ||
                            "—"}
                        </td>


                        <td>
                          <strong className="forecast-predicted-value">
                            {forecast.predictedStudents}
                          </strong>
                        </td>


                        <td>
                          <strong className="forecast-actual-value">
                            {forecast.actualStudents !==
                              null &&
                            forecast.actualStudents !==
                              undefined
                              ? forecast.actualStudents
                              : "—"}
                          </strong>
                        </td>


                        <td>
                          {difference !==
                            null &&
                          difference !==
                            undefined ? (
                            <span
                              className={`forecast-difference ${
                                Number(
                                  difference
                                ) > 0
                                  ? "positive"
                                  : Number(
                                      difference
                                    ) < 0
                                  ? "negative"
                                  : "zero"
                              }`}
                            >
                              {Number(
                                difference
                              ) > 0
                                ? "+"
                                : ""}
                              {difference}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>


                        <td>
                          <span
                            className={`forecast-preparation-status ${normalizeStatus(
                              forecast.preparationStatus
                            )}`}
                          >
                            {readablePreparationStatus(
                              forecast.preparationStatus
                            )}
                          </span>
                        </td>


                        <td>
                          <div className="forecast-updated-cell">

                            <Clock3
                              size={13}
                            />

                            {formatDateTime(
                              forecast.lastUpdated
                            )}

                          </div>
                        </td>


                        <td>
                          <button
                            type="button"
                            className="forecast-view-button"
                            onClick={() =>
                              setViewingForecast(
                                forecast
                              )
                            }
                          >
                            View
                          </button>
                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>
        )}

      </section>


      {/* =====================================================
          VIEW FORECAST MODAL
      ===================================================== */}

      {viewingForecast && (
        <div className="forecast-modal-backdrop">

          <div className="forecast-modal">

            <div className="forecast-modal-header">

              <div>

                <span className="forecasts-eyebrow">
                  FORECAST DETAILS
                </span>

                <h2>
                  {readableMeal(
                    viewingForecast.meal
                  )}
                </h2>

                <p>
                  {formatDate(
                    viewingForecast.date
                  )}
                </p>

              </div>


              <button
                type="button"
                onClick={() =>
                  setViewingForecast(
                    null
                  )
                }
                aria-label="Close"
              >
                <X size={20} />
              </button>

            </div>


            <div className="forecast-view-content">

              <div>

                <span>
                  Hostel
                </span>

                <strong>
                  {viewingForecast.hostel ||
                    "—"}
                </strong>

              </div>


              <div>

                <span>
                  Mess Unit
                </span>

                <strong>
                  {viewingForecast.messUnit ||
                    "—"}
                </strong>

              </div>


              <div>

                <span>
                  Meal Category
                </span>

                <strong>
                  {readableCategory(
                    viewingForecast.mealCategory
                  )}
                </strong>

              </div>


              <div>

                <span>
                  Predicted Students
                </span>

                <strong className="forecast-predicted-value">
                  {viewingForecast.predictedStudents}
                </strong>

              </div>


              <div>

                <span>
                  Actual Students
                </span>

                <strong className="forecast-actual-value">
                  {viewingForecast.actualStudents !==
                    null &&
                  viewingForecast.actualStudents !==
                    undefined
                    ? viewingForecast.actualStudents
                    : "Not available yet"}
                </strong>

              </div>


              <div>

                <span>
                  Difference
                </span>

                <strong>
                  {viewingForecast.difference !==
                    null &&
                  viewingForecast.difference !==
                    undefined
                    ? viewingForecast.difference
                    : "—"}
                </strong>

              </div>


              <div>

                <span>
                  Preparation Status
                </span>

                <strong>
                  {readablePreparationStatus(
                    viewingForecast.preparationStatus
                  )}
                </strong>

              </div>


              <div>

                <span>
                  Last Updated
                </span>

                <strong>
                  {formatDateTime(
                    viewingForecast.lastUpdated
                  )}
                </strong>

              </div>

            </div>


            <div className="forecast-modal-actions">

              <button
                type="button"
                className="forecast-secondary-button"
                onClick={() =>
                  setViewingForecast(
                    null
                  )
                }
              >
                Close
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}


export default Forecasts;