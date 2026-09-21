import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  UtensilsCrossed,
  UserCog,
  Wheat,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useManager,
} from "../../context/ManagerContext";

import "./overview.css";


function Overview() {
  const navigate =
    useNavigate();


  const {
    apiFetch,

    hostels,
    messUnits,

    loadingFilters,
    filterError,
  } = useManager();


  /* =========================================================
     OVERVIEW-SPECIFIC FILTERS

     IMPORTANT:
     These filters exist only inside Overview.

     Default:
     All Hostels
     All Mess Units
     All
  ========================================================= */

  const [
    selectedHostel,
    setSelectedHostel,
  ] = useState("all");


  const [
    selectedMessType,
    setSelectedMessType,
  ] = useState("all");


  const [
    selectedMealCategory,
    setSelectedMealCategory,
  ] = useState("all");


  /* =========================================================
     DATA
  ========================================================= */

  const [
    overview,
    setOverview,
  ] = useState(null);


  const [
    responseSummary,
    setResponseSummary,
  ] = useState(null);


  const [
    sevenDayData,
    setSevenDayData,
  ] = useState([]);


  const [
    recentActivities,
    setRecentActivities,
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
     HOSTEL CHANGE

     Reset Mess Unit to All Mess Units.
  ========================================================= */

  const handleHostelChange =
    (event) => {
      setSelectedHostel(
        event.target.value
      );

      setSelectedMessType(
        "all"
      );
    };


  /* =========================================================
     MESS TYPES AVAILABLE FROM DATABASE

     We use unitType from actual database records.

     This allows:

     All Hostels + North Mess
     All Hostels + South Mess
  ========================================================= */

  const availableMessTypes =
    useMemo(() => {
      let source =
        messUnits;


      if (
        selectedHostel !==
        "all"
      ) {
        source =
          messUnits.filter(
            (mess) =>
              String(
                mess.hostelId
              ) ===
              String(
                selectedHostel
              )
          );
      }


      const types =
        new Set();


      source.forEach(
        (mess) => {
          const type =
            String(
              mess.unitType ||
                ""
            )
              .trim()
              .toLowerCase();


          if (
            type ===
              "north" ||
            type ===
              "south"
          ) {
            types.add(type);
          }
        }
      );


      return Array.from(
        types
      );
    }, [
      messUnits,
      selectedHostel,
    ]);


  /* =========================================================
     QUERY STRING
  ========================================================= */

  const overviewQuery =
    useMemo(() => {
      const params =
        new URLSearchParams();


      /*
       * We deliberately send "all"
       * because the updated backend API
       * will explicitly support it.
       */

      params.set(
        "hostel_id",
        selectedHostel
      );


      params.set(
        "mess_unit_type",
        selectedMessType
      );


      params.set(
        "meal_category",
        selectedMealCategory
      );


      return (
        params.toString()
      );
    }, [
      selectedHostel,
      selectedMessType,
      selectedMealCategory,
    ]);


  /* =========================================================
     LOAD COMPLETE OVERVIEW
  ========================================================= */

  const loadOverview =
    useCallback(
      async () => {
        setLoading(true);

        setError("");


        try {
          const [
            overviewResult,
            responseResult,
            sevenDayResult,
            notificationResult,
          ] =
            await Promise.allSettled([
              apiFetch(
                `/api/manager/overview?${overviewQuery}`
              ),

              apiFetch(
                `/api/manager/dashboard/response-summary?${overviewQuery}`
              ),

              apiFetch(
                `/api/manager/dashboard/seven-day?${overviewQuery}`
              ),

              apiFetch(
                "/api/manager/notifications"
              ),
            ]);


          /* =====================================
             OVERVIEW

             This is the main required request.
          ===================================== */

          if (
            overviewResult.status ===
            "fulfilled"
          ) {
            setOverview(
              overviewResult.value
            );
          } else {
            throw (
              overviewResult.reason
            );
          }


          /* =====================================
             RESPONSE SUMMARY
          ===================================== */

          if (
            responseResult.status ===
            "fulfilled"
          ) {
            setResponseSummary(
              responseResult.value
            );
          } else {
            console.error(
              "Response summary error:",
              responseResult.reason
            );

            setResponseSummary(
              null
            );
          }


          /* =====================================
             SEVEN-DAY GRAPH
          ===================================== */

          if (
            sevenDayResult.status ===
            "fulfilled"
          ) {
            setSevenDayData(
              Array.isArray(
                sevenDayResult
                  .value?.data
              )
                ? sevenDayResult
                    .value.data
                : []
            );
          } else {
            console.error(
              "Seven-day graph error:",
              sevenDayResult.reason
            );

            setSevenDayData(
              []
            );
          }


          /* =====================================
             RECENT ACTIVITY
          ===================================== */

          if (
            notificationResult.status ===
            "fulfilled"
          ) {
            const items =
              Array.isArray(
                notificationResult
                  .value
                  ?.notifications
              )
                ? notificationResult
                    .value
                    .notifications
                : [];


            setRecentActivities(
              items.slice(
                0,
                5
              )
            );
          } else {
            console.error(
              "Activity loading error:",
              notificationResult.reason
            );

            setRecentActivities(
              []
            );
          }
        } catch (err) {
          console.error(
            "Overview loading error:",
            err
          );


          setOverview(
            null
          );


          setError(
            err?.message ||
              "Unable to load Overview data."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        apiFetch,
        overviewQuery,
      ]
    );


  /* =========================================================
     RELOAD WHEN FILTER CHANGES
  ========================================================= */

  useEffect(() => {
    loadOverview();
  }, [
    loadOverview,
  ]);


  /* =========================================================
     DATA NORMALIZATION
  ========================================================= */

  const summary =
    overview?.summary ||
    {};


  const mealDemand =
    Array.isArray(
      overview?.mealDemand
    )
      ? overview.mealDemand
      : [];


  const todaySummary =
    overview?.todaySummary ||
    {};


  const forecast =
    overview?.forecast ||
    {};


  const alerts =
    Array.isArray(
      overview?.alerts
    )
      ? overview.alerts
      : [];


  /* =========================================================
     MEALS SERVED TODAY
  ========================================================= */

  const mealsServedToday =
    useMemo(() => {
      if (
        summary.mealsServedToday !==
        undefined
      ) {
        return Number(
          summary.mealsServedToday ||
            0
        );
      }


      return (
        Number(
          todaySummary.breakfast ||
            0
        ) +
        Number(
          todaySummary.lunch ||
            0
        ) +
        Number(
          todaySummary.snacks ||
            0
        ) +
        Number(
          todaySummary.dinner ||
            0
        )
      );
    }, [
      summary.mealsServedToday,
      todaySummary,
    ]);


  /* =========================================================
     SUMMARY CARDS

     Values come only from API data.
  ========================================================= */

  const summaryCards =
    useMemo(
      () => [
        {
          title:
            "Total Students",

          value:
            Number(
              summary.totalStudents ||
                0
            ),

          subtitle:
            "Students in current selection",

          icon:
            Users,

          tone:
            "blue",
        },

        {
          title:
            "Meals Served Today",

          value:
            mealsServedToday,

          subtitle:
            "Meals served today",

          icon:
            Wheat,

          tone:
            "green",
        },

        {
          title:
            "Today's Waste",

          value:
            `${Number(
              summary.todayWaste ||
                0
            ).toFixed(2)} kg`,

          subtitle:
            "Recorded food waste",

          icon:
            Activity,

          tone:
            "red",
        },

        {
          title:
            "Active Mess Units",

          value:
            Number(
              summary.activeMessUnits ||
                0
            ),

          subtitle:
            "Operational mess units",

          icon:
            UtensilsCrossed,

          tone:
            "orange",
        },

        {
          title:
            "Active Staff",

          value:
            Number(
              summary.activeStaff ||
                0
            ),

          subtitle:
            "Active mess staff",

          icon:
            UserCog,

          tone:
            "purple",
        },

        {
          title:
            "Today's Responses",

          value:
            Number(
              summary.todayResponses ||
                0
            ),

          subtitle:
            "Student responses received",

          icon:
            ClipboardCheck,

          tone:
            "teal",
        },
      ],
      [
        summary,
        mealsServedToday,
      ]
    );


  /* =========================================================
     MAX GRAPH VALUE
  ========================================================= */

  const maxDemand =
    useMemo(() => {
      const values =
        mealDemand.map(
          (item) =>
            Number(
              item.count ??
                item.value ??
                0
            )
        );


      return Math.max(
        ...values,
        1
      );
    }, [
      mealDemand,
    ]);


  const maxSevenDay =
    useMemo(() => {
      const values =
        sevenDayData.map(
          (item) =>
            Number(
              item.mealsServed ||
                0
            )
        );


      return Math.max(
        ...values,
        1
      );
    }, [
      sevenDayData,
    ]);


  /* =========================================================
     CURRENT FILTER LABEL
  ========================================================= */

  const currentHostelName =
    useMemo(() => {
      if (
        selectedHostel ===
        "all"
      ) {
        return "All Hostels";
      }


      return (
        hostels.find(
          (hostel) =>
            String(
              hostel.id
            ) ===
            String(
              selectedHostel
            )
        )?.name ||
        "Selected Hostel"
      );
    }, [
      hostels,
      selectedHostel,
    ]);


  const currentMessName =
    selectedMessType ===
    "all"
      ? "All Mess Units"
      : selectedMessType ===
        "north"
      ? "North Mess"
      : "South Mess";


  /* =========================================================
     FILTER EMPTY STATES
  ========================================================= */

  const noHostels =
    !loadingFilters &&
    hostels.length === 0;


  const selectedHostelMessUnits =
    useMemo(() => {
      if (
        selectedHostel ===
        "all"
      ) {
        return messUnits;
      }


      return (
        messUnits.filter(
          (mess) =>
            String(
              mess.hostelId
            ) ===
            String(
              selectedHostel
            )
        )
      );
    }, [
      messUnits,
      selectedHostel,
    ]);


  const noMessUnits =
    !loadingFilters &&
    selectedHostelMessUnits
      .length === 0;


  /* =========================================================
     LOADING
  ========================================================= */

  if (
    loadingFilters
  ) {
    return (
      <div className="overview-loading">
        <RefreshCw
          size={24}
          className="overview-spin"
        />

        <span>
          Loading Hostel and Mess Unit data...
        </span>
      </div>
    );
  }


  /* =========================================================
     FILTER OPTIONS API ERROR
  ========================================================= */

  if (
    filterError &&
    hostels.length === 0
  ) {
    return (
      <div className="overview-error-card">

        <AlertTriangle
          size={28}
        />

        <div>
          <h3>
            Unable to load Overview
          </h3>

          <p>
            {filterError}
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
          >
            <RefreshCw
              size={16}
            />

            Retry
          </button>
        </div>

      </div>
    );
  }


  return (
    <div className="manager-overview">

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="overview-page-heading">

        <div>

          <span className="overview-eyebrow">
            MANAGER DASHBOARD
          </span>

          <h1>
            Overview
          </h1>

          <p>
            Monitor students, meals,
            responses, demand, forecasts
            and waste across your Hostel
            Mess operations.
          </p>

        </div>


        <button
          type="button"
          className="overview-refresh-button"
          onClick={
            loadOverview
          }
          disabled={
            loading
          }
        >
          <RefreshCw
            size={16}
            className={
              loading
                ? "overview-spin"
                : ""
            }
          />

          Refresh
        </button>

      </div>


      {/* =====================================================
          OVERVIEW FILTER CARD

          IMPORTANT:
          NO ADD HOSTEL BUTTON
          NO ADD MESS UNIT BUTTON
      ===================================================== */}

      <section className="overview-filter-card">

        {/* HOSTEL */}

        <div className="overview-filter-field">

          <label
            htmlFor="overviewHostel"
          >
            HOSTEL
          </label>


          <select
            id="overviewHostel"
            value={
              selectedHostel
            }
            onChange={
              handleHostelChange
            }
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


        {/* MESS UNIT */}

        <div className="overview-filter-field">

          <label
            htmlFor="overviewMess"
          >
            MESS UNIT
          </label>


          <select
            id="overviewMess"
            value={
              selectedMessType
            }
            onChange={(
              event
            ) =>
              setSelectedMessType(
                event.target
                  .value
              )
            }
            disabled={
              noMessUnits
            }
          >

            <option value="all">
              All Mess Units
            </option>


            {availableMessTypes.includes(
              "north"
            ) && (

              <option value="north">
                North Mess
              </option>

            )}


            {availableMessTypes.includes(
              "south"
            ) && (

              <option value="south">
                South Mess
              </option>

            )}

          </select>

        </div>


        {/* MEAL CATEGORY */}

        <div className="overview-filter-field">

          <label>
            MEAL CATEGORY
          </label>


          <div className="overview-category-selector">

            <button
              type="button"
              className={
                selectedMealCategory ===
                "all"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setSelectedMealCategory(
                  "all"
                )
              }
            >
              All
            </button>


            <button
              type="button"
              className={
                selectedMealCategory ===
                "veg"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setSelectedMealCategory(
                  "veg"
                )
              }
            >
              Veg
            </button>


            <button
              type="button"
              className={
                selectedMealCategory ===
                "non-veg"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setSelectedMealCategory(
                  "non-veg"
                )
              }
            >
              Non-Veg
            </button>

          </div>

        </div>

      </section>


      {/* =====================================================
          CURRENT VIEW
      ===================================================== */}

      <div className="overview-current-view">

        <span>
          Showing:
        </span>

        <strong>
          {currentHostelName}
          {"  →  "}
          {currentMessName}
          {"  →  "}
          {selectedMealCategory ===
          "all"
            ? "All Categories"
            : selectedMealCategory ===
              "veg"
            ? "Veg"
            : "Non-Veg"}
        </strong>

      </div>


      {/* =====================================================
          EMPTY HOSTEL
      ===================================================== */}

      {noHostels && (

        <div className="overview-empty-notice">

          <AlertTriangle
            size={20}
          />

          <div>
            <strong>
              No hostel data is available.
            </strong>

            <span>
              Add a hostel from
              Settings → Hostel Details.
            </span>
          </div>

        </div>

      )}


      {/* =====================================================
          EMPTY MESS
      ===================================================== */}

      {!noHostels &&
        noMessUnits && (

        <div className="overview-empty-notice">

          <AlertTriangle
            size={20}
          />

          <div>
            <strong>
              No mess unit is available.
            </strong>

            <span>
              Add a mess unit from the
              Mess Units page.
            </span>
          </div>

        </div>

      )}


      {/* =====================================================
          DATA ERROR
      ===================================================== */}

      {error && (

        <div className="overview-inline-error">

          <AlertTriangle
            size={18}
          />

          <div>
            <strong>
              Unable to load Overview data.
            </strong>

            <span>
              {error}
            </span>
          </div>


          <button
            type="button"
            onClick={
              loadOverview
            }
          >
            Retry
          </button>

        </div>

      )}


      {/* =====================================================
          LOADING OVERVIEW
      ===================================================== */}

      {loading && (

        <div className="overview-data-loading">

          <RefreshCw
            size={18}
            className="overview-spin"
          />

          Updating dashboard for
          the selected filters...

        </div>

      )}


      {/* =====================================================
          DASHBOARD CONTENT
      ===================================================== */}

      {!loading &&
        !error &&
        overview && (
        <>

          {/* =================================================
              SUMMARY CARDS
          ================================================= */}

          <section className="overview-summary-grid">

            {summaryCards.map(
              (card) => {
                const Icon =
                  card.icon;


                return (
                  <article
                    key={
                      card.title
                    }
                    className="overview-summary-card"
                  >

                    <div
                      className={`overview-summary-icon ${card.tone}`}
                    >
                      <Icon
                        size={21}
                      />
                    </div>


                    <div className="overview-summary-content">

                      <span>
                        {card.title}
                      </span>

                      <strong>
                        {card.value}
                      </strong>

                      <small>
                        {card.subtitle}
                      </small>

                    </div>

                  </article>
                );
              }
            )}

          </section>


          {/* =================================================
              LAST 7 DAYS + QUICK ACTIONS
          ================================================= */}

          <section className="overview-main-grid">

            {/* 7 DAY GRAPH */}

            <article className="overview-card">

              <div className="overview-card-header">

                <div>
                  <span className="overview-card-eyebrow">
                    LAST 7 DAYS
                  </span>

                  <h2>
                    Meals Served – Last 7 Days
                  </h2>
                </div>


                <TrendingUp
                  size={20}
                  className="overview-header-icon"
                />

              </div>


              {sevenDayData.length ===
              0 ? (

                <div className="overview-empty-state">
                  No seven-day meal data
                  is available for this
                  selection.
                </div>

              ) : (

                <div className="overview-seven-day-chart">

                  {sevenDayData.map(
                    (
                      item,
                      index
                    ) => {
                      const value =
                        Number(
                          item.mealsServed ||
                            0
                        );


                      const height =
                        Math.max(
                          (
                            value /
                            maxSevenDay
                          ) *
                            100,
                          3
                        );


                      return (
                        <div
                          className="overview-seven-day-column"
                          key={
                            item.date ||
                            index
                          }
                        >

                          <strong>
                            {value}
                          </strong>


                          <div className="overview-seven-day-track">

                            <div
                              className="overview-seven-day-bar"
                              style={{
                                height:
                                  `${height}%`,
                              }}
                            />

                          </div>


                          <span>
                            {item.label ||
                              item.date}
                          </span>

                        </div>
                      );
                    }
                  )}

                </div>

              )}

            </article>


            {/* QUICK ACTIONS */}

            <article className="overview-card">

              <div className="overview-card-header">

                <div>
                  <span className="overview-card-eyebrow">
                    SHORTCUTS
                  </span>

                  <h2>
                    Quick Actions
                  </h2>
                </div>

              </div>


              <div className="overview-quick-actions">

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/manager/dashboard/students"
                    )
                  }
                >
                  <Users
                    size={18}
                  />

                  <span>
                    Manage Students
                  </span>

                  <ArrowRight
                    size={15}
                  />
                </button>


                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/manager/dashboard/mess-units"
                    )
                  }
                >
                  <UtensilsCrossed
                    size={18}
                  />

                  <span>
                    Manage Mess Units
                  </span>

                  <ArrowRight
                    size={15}
                  />
                </button>


                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/manager/dashboard/menu-management"
                    )
                  }
                >
                  <ClipboardCheck
                    size={18}
                  />

                  <span>
                    Manage Menus
                  </span>

                  <ArrowRight
                    size={15}
                  />
                </button>


                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/manager/dashboard/forecasts"
                    )
                  }
                >
                  <Sparkles
                    size={18}
                  />

                  <span>
                    View Forecasts
                  </span>

                  <ArrowRight
                    size={15}
                  />
                </button>

              </div>

            </article>

          </section>


          {/* =================================================
              TODAY DEMAND + MEAL SUMMARY
          ================================================= */}

          <section className="overview-main-grid">

            {/* TODAY'S DEMAND */}

            <article className="overview-card">

              <div className="overview-card-header">

                <div>
                  <span className="overview-card-eyebrow">
                    TODAY
                  </span>

                  <h2>
                    Today's Meal Demand
                  </h2>
                </div>


                <TrendingUp
                  size={20}
                  className="overview-header-icon"
                />

              </div>


              {mealDemand.length ===
              0 ? (

                <div className="overview-empty-state">
                  No meal-demand data
                  is available.
                </div>

              ) : (

                <div className="overview-demand-chart">

                  {mealDemand.map(
                    (
                      item,
                      index
                    ) => {
                      const value =
                        Number(
                          item.count ??
                            item.value ??
                            0
                        );


                      const height =
                        Math.max(
                          (
                            value /
                            maxDemand
                          ) *
                            100,
                          4
                        );


                      return (
                        <div
                          key={
                            item.meal ||
                            index
                          }
                          className="overview-demand-column"
                        >

                          <div className="overview-demand-value">
                            {value}
                          </div>


                          <div className="overview-demand-track">

                            <div
                              className="overview-demand-bar"
                              style={{
                                height:
                                  `${height}%`,
                              }}
                            />

                          </div>


                          <span>
                            {item.meal ||
                              "Meal"}
                          </span>

                        </div>
                      );
                    }
                  )}

                </div>

              )}

            </article>


            {/* MEAL SUMMARY */}

            <article className="overview-card">

              <div className="overview-card-header">

                <div>
                  <span className="overview-card-eyebrow">
                    MEAL SUMMARY
                  </span>

                  <h2>
                    Meals Served Today
                  </h2>
                </div>

              </div>


              <div className="overview-meal-summary">

                <div>
                  <span>
                    Breakfast
                  </span>

                  <strong>
                    {Number(
                      todaySummary.breakfast ||
                        0
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    Lunch
                  </span>

                  <strong>
                    {Number(
                      todaySummary.lunch ||
                        0
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    Snacks
                  </span>

                  <strong>
                    {Number(
                      todaySummary.snacks ||
                        0
                    )}
                  </strong>
                </div>


                <div>
                  <span>
                    Dinner
                  </span>

                  <strong>
                    {Number(
                      todaySummary.dinner ||
                        0
                    )}
                  </strong>
                </div>

              </div>

            </article>

          </section>


          {/* =================================================
              RESPONSE SUMMARY / FORECAST / WASTE
          ================================================= */}

          <section className="overview-secondary-grid">

            {/* RESPONSE SUMMARY */}

            <article className="overview-card">

              <div className="overview-card-header">

                <div>
                  <span className="overview-card-eyebrow">
                    STUDENT RESPONSES
                  </span>

                  <h2>
                    Response Summary
                  </h2>
                </div>

              </div>


              {responseSummary ? (

                <div className="overview-response-list">

                  <div>

                    <span>
                      Attending
                    </span>

                    <strong>
                      {Number(
                        responseSummary
                          ?.attending
                          ?.count ||
                          0
                      )}
                    </strong>

                    <small>
                      {Number(
                        responseSummary
                          ?.attending
                          ?.percentage ||
                          0
                      )}
                      %
                    </small>

                  </div>


                  <div>

                    <span>
                      Skipping
                    </span>

                    <strong>
                      {Number(
                        responseSummary
                          ?.skipping
                          ?.count ||
                          0
                      )}
                    </strong>

                    <small>
                      {Number(
                        responseSummary
                          ?.skipping
                          ?.percentage ||
                          0
                      )}
                      %
                    </small>

                  </div>


                  <div>

                    <span>
                      Unanswered
                    </span>

                    <strong>
                      {Number(
                        responseSummary
                          ?.unanswered
                          ?.count ||
                          0
                      )}
                    </strong>

                    <small>
                      {Number(
                        responseSummary
                          ?.unanswered
                          ?.percentage ||
                          0
                      )}
                      %
                    </small>

                  </div>

                </div>

              ) : (

                <div className="overview-empty-state compact">
                  Response summary is
                  not available.
                </div>

              )}

            </article>


            {/* FORECAST */}

            <article className="overview-card">

              <div className="overview-card-header">

                <div>
                  <span className="overview-card-eyebrow">
                    FORECAST
                  </span>

                  <h2>
                    Next Meal Forecast
                  </h2>
                </div>


                <Sparkles
                  size={19}
                  className="overview-header-icon"
                />

              </div>


              <div className="overview-forecast-content">

                <div className="overview-forecast-number">

                  <strong>
                    {Number(
                      forecast.predictedCount ||
                        0
                    )}
                  </strong>

                  <span>
                    predicted students
                  </span>

                </div>


                <div className="overview-forecast-details">

                  <div>
                    <span>
                      Meal
                    </span>

                    <strong>
                      {forecast.meal ||
                        "Not available"}
                    </strong>
                  </div>


                  <div>
                    <span>
                      Confidence
                    </span>

                    <strong>
                      {Number(
                        forecast.confidence ||
                          0
                      )}
                      %
                    </strong>
                  </div>

                </div>

              </div>


              <button
                type="button"
                className="overview-text-button"
                onClick={() =>
                  navigate(
                    "/manager/dashboard/forecasts"
                  )
                }
              >
                View Forecasts

                <ArrowRight
                  size={15}
                />
              </button>

            </article>


            {/* WASTE SUMMARY */}

            <article className="overview-card">

              <div className="overview-card-header">

                <div>
                  <span className="overview-card-eyebrow">
                    WASTE
                  </span>

                  <h2>
                    Waste Summary
                  </h2>
                </div>


                <Activity
                  size={19}
                  className="overview-header-icon"
                />

              </div>


              <div className="overview-waste-summary">

                <strong>
                  {Number(
                    summary.todayWaste ||
                      0
                  ).toFixed(2)}
                </strong>

                <span>
                  kg recorded today
                </span>

              </div>


              <p className="overview-waste-note">
                Waste values are calculated
                from database records matching
                the selected Hostel, Mess Unit
                and Meal Category.
              </p>

            </article>

          </section>


          {/* =================================================
              ALERTS + RECENT ACTIVITIES
          ================================================= */}

          <section className="overview-main-grid overview-bottom-grid">

            {/* ALERTS */}

            <article className="overview-card">

              <div className="overview-card-header">

                <div>
                  <span className="overview-card-eyebrow">
                    ATTENTION
                  </span>

                  <h2>
                    Alerts
                  </h2>
                </div>


                <AlertTriangle
                  size={19}
                  className="overview-alert-heading-icon"
                />

              </div>


              {alerts.length ===
              0 ? (

                <div className="overview-no-alerts">

                  <CheckCircle2
                    size={22}
                  />

                  <div>
                    <strong>
                      Everything looks good
                    </strong>

                    <span>
                      No active alerts.
                    </span>
                  </div>

                </div>

              ) : (

                <div className="overview-alert-list">

                  {alerts.map(
                    (
                      alert,
                      index
                    ) => (

                      <div
                        className="overview-alert-item"
                        key={
                          alert.id ||
                          index
                        }
                      >

                        <AlertTriangle
                          size={16}
                        />

                        <div>

                          <strong>
                            {alert.title ||
                              "Alert"}
                          </strong>

                          <span>
                            {alert.message ||
                              ""}
                          </span>

                        </div>

                      </div>

                    )
                  )}

                </div>

              )}

            </article>


            {/* RECENT ACTIVITY */}

            <article className="overview-card">

              <div className="overview-card-header">

                <div>
                  <span className="overview-card-eyebrow">
                    ACTIVITY
                  </span>

                  <h2>
                    Recent Activities
                  </h2>
                </div>

              </div>


              {recentActivities.length ===
              0 ? (

                <div className="overview-empty-state compact">
                  No recent activities.
                </div>

              ) : (

                <div className="overview-activity-list">

                  {recentActivities.map(
                    (
                      item,
                      index
                    ) => (

                      <div
                        className="overview-activity-item"
                        key={
                          item.id ||
                          index
                        }
                      >

                        <div className="overview-activity-dot" />


                        <div>

                          <strong>
                            {item.title ||
                              "Activity"}
                          </strong>

                          <span>
                            {item.message ||
                              ""}
                          </span>

                          {item.createdAt && (

                            <small>
                              {new Date(
                                item.createdAt
                              )
                                .toLocaleString(
                                  "en-IN"
                                )}
                            </small>

                          )}

                        </div>

                      </div>

                    )
                  )}

                </div>

              )}

            </article>

          </section>

        </>
      )}

    </div>
  );
}


export default Overview;