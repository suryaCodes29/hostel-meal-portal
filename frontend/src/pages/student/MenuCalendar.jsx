import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Utensils,
  Clock3,
  CheckCircle2,
  XCircle,
  Circle,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

import { studentApi } from "../../services/studentApi";
import { useStudent } from "../../context/StudentContext";

import "./MenuCalendar.css";

const MEAL_ORDER = ["Breakfast", "Lunch", "Snacks", "Dinner"];

const getDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDate = (date) => {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatMonth = (date) => {
  return date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
};

const normalizeResponse = (value) => {
  const text = String(value || "").toLowerCase();

  if (
    text === "attending" ||
    text === "attend" ||
    text === "yes" ||
    text === "present"
  ) {
    return "attending";
  }

  if (
    text === "skipping" ||
    text === "skip" ||
    text === "no" ||
    text === "absent"
  ) {
    return "skipping";
  }

  return "not_recorded";
};

const getStatusClass = (response) => {
  if (response === "attending") return "attending";
  if (response === "skipping") return "skipping";
  return "not-recorded";
};

const getStatusText = (response) => {
  if (response === "attending") return "Attending";
  if (response === "skipping") return "Skipping";
  return "Not Recorded";
};

const getStatusIcon = (response) => {
  if (response === "attending") {
    return <CheckCircle2 size={16} />;
  }

  if (response === "skipping") {
    return <XCircle size={16} />;
  }

  return <Circle size={16} />;
};

const normalizeMenu = (menu) => {
  const rawItems =
    menu?.items ||
    menu?.menu_items ||
    menu?.menuItems ||
    [];

  const items = Array.isArray(rawItems)
    ? rawItems.map((item) => {
        if (typeof item === "string") {
          return {
            name: item,
            category: "",
          };
        }

        return {
          name:
            item?.name ||
            item?.item_name ||
            item?.itemName ||
            "Menu Item",
          category:
            item?.category ||
            item?.type ||
            "",
        };
      })
    : [];

  const response = normalizeResponse(
  menu?.myResponse ??
    menu?.response ??
    menu?.student_response ??
    menu?.meal_response
);

  return {
    id: menu?.id || menu?.menu_id,
    date:
      menu?.date ||
      menu?.menu_date ||
      menu?.scheduled_date,
    meal:
      menu?.meal ||
      menu?.meal_type ||
      menu?.meal_category ||
      menu?.meal_name ||
      "Meal",
    title:
      menu?.title ||
      menu?.name ||
      menu?.menu_name ||
      "",
    servingTime:
      menu?.serving_time ||
      menu?.servingTime ||
      menu?.time ||
      "",
    cutoffTime:
      menu?.cutoff_time ||
      menu?.cutoffTime ||
      "",
    published:
      menu?.published !== false &&
      menu?.is_published !== false,
    items,
    response,
  };
};

export default function MenuCalendar() {
  const { assignment } = useStudent();

  const [currentMonth, setCurrentMonth] = useState(
    new Date()
  );

  const [selectedDate, setSelectedDate] = useState(
    new Date()
  );

  const [menus, setMenus] = useState([]);
  const [responses, setResponses] = useState({});

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const todayKey = getDateKey(new Date());

  const monthStart = useMemo(() => {
    return new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1
    );
  }, [currentMonth]);

  const monthEnd = useMemo(() => {
    return new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0
    );
  }, [currentMonth]);

  const loadCalendar = async () => {
  try {
    setLoading(true);
    setError("");

    const response = await studentApi.getCalendar({
      month: currentMonth.getMonth() + 1,
      year: currentMonth.getFullYear(),
    });

    console.log("Calendar API response:", response);

    let rawMenus = [];

    // Backend's actual calendar response format
    if (response?.menusByDate && typeof response.menusByDate === "object") {
      rawMenus = Object.entries(response.menusByDate).flatMap(
        ([date, dayMenus]) => {
          if (!Array.isArray(dayMenus)) return [];

          return dayMenus.map((menu) => ({
            ...menu,
            date: menu.date || menu.menu_date || date,
          }));
        }
      );
    }

    // Compatibility fallback
    else if (Array.isArray(response?.menus)) {
      rawMenus = response.menus;
    } else if (Array.isArray(response?.calendar)) {
      rawMenus = response.calendar;
    } else if (Array.isArray(response?.data)) {
      rawMenus = response.data;
    } else if (Array.isArray(response?.result)) {
      rawMenus = response.result;
    }

    const normalizedMenus = rawMenus.map(normalizeMenu);

    setMenus(normalizedMenus);

    const responseMap = {};

    normalizedMenus.forEach((menu) => {
      if (menu.id) {
        responseMap[menu.id] = menu.response;
      }
    });

    setResponses(responseMap);

  } catch (err) {
    console.error("Failed to load menu calendar:", err);

    setError(
      err?.message || "Unable to load the menu calendar."
    );

    setMenus([]);
    setResponses({});
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    loadCalendar();
  }, [
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
  ]);

  const menusByDate = useMemo(() => {
    const grouped = {};

    menus.forEach((menu) => {
      if (!menu.date) return;

      const key = String(menu.date).slice(0, 10);

      if (!grouped[key]) {
        grouped[key] = [];
      }

      grouped[key].push(menu);
    });

    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => {
        const aIndex = MEAL_ORDER.findIndex(
          (meal) =>
            String(a.meal).toLowerCase() ===
            meal.toLowerCase()
        );

        const bIndex = MEAL_ORDER.findIndex(
          (meal) =>
            String(b.meal).toLowerCase() ===
            meal.toLowerCase()
        );

        return (
          (aIndex === -1 ? 99 : aIndex) -
          (bIndex === -1 ? 99 : bIndex)
        );
      });
    });

    return grouped;
  }, [menus]);

  const calendarDays = useMemo(() => {
    const days = [];

    const firstDay = monthStart.getDay();
    const daysInMonth = monthEnd.getDate();

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(
        new Date(
          currentMonth.getFullYear(),
          currentMonth.getMonth(),
          day
        )
      );
    }

    return days;
  }, [currentMonth, monthStart, monthEnd]);

  const selectedDateKey = getDateKey(selectedDate);

  const selectedMenus =
    menusByDate[selectedDateKey] || [];

  const changeMonth = (amount) => {
    setCurrentMonth(
      new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + amount,
        1
      )
    );
  };

  const goToToday = () => {
    const today = new Date();

    setCurrentMonth(
      new Date(
        today.getFullYear(),
        today.getMonth(),
        1
      )
    );

    setSelectedDate(today);
  };

  const handleDateClick = (date) => {
    if (!date) return;

    setSelectedDate(date);
    setMessage("");
    setError("");
  };

const handleResponse = async (menu, value) => {
  if (!menu?.id) {
    setError("Invalid menu. Please refresh and try again.");
    return;
  }

  if (!menu.published) {
    setError("This menu is not currently available.");
    return;
  }

  if (!["attending", "skipping"].includes(value)) {
    setError("Invalid meal response.");
    return;
  }

  if (savingId === menu.id) {
    return;
  }

  try {
    setSavingId(menu.id);
    setError("");
    setMessage("");

    // Send the response to the backend
    const result = await studentApi.submitMealResponse(
      menu.id,
      {
        response: value,
      }
    );

    // Read the response actually returned by the backend
    const savedResponse =
      result?.response?.value ||
      result?.response?.response ||
      result?.value ||
      result?.responseValue;

    if (
      !savedResponse ||
      !["attending", "skipping"].includes(
        String(savedResponse).toLowerCase()
      )
    ) {
      throw new Error(
        "The server did not confirm the saved response. Please refresh and try again."
      );
    }

    const confirmedValue =
      String(savedResponse).toLowerCase();

    // Update UI only after backend confirms saving
    setResponses((previous) => ({
      ...previous,
      [menu.id]: confirmedValue,
    }));

    setMenus((previous) =>
      previous.map((item) =>
        item.id === menu.id
          ? {
              ...item,
              response: confirmedValue,
            }
          : item
      )
    );

    setMessage(
      `${menu.meal} response saved successfully: ${
        confirmedValue === "attending"
          ? "Attending"
          : "Skipping"
      }.`
    );

  } catch (err) {
    console.error("Meal response save failed:", err);

    setError(
      err?.message ||
        "Unable to save your meal response. Please try again."
    );

    // Do not falsely update the selected response
  } finally {
    setSavingId(null);
  }
};
  const getDaySummary = (date) => {
    if (!date) {
      return {
        count: 0,
        attending: 0,
        skipping: 0,
      };
    }

    const key = getDateKey(date);
    const dayMenus = menusByDate[key] || [];

    let attending = 0;
    let skipping = 0;

    dayMenus.forEach((menu) => {
      const response =
        responses[menu.id] || menu.response;

      if (response === "attending") {
        attending++;
      }

      if (response === "skipping") {
        skipping++;
      }
    });

    return {
      count: dayMenus.length,
      attending,
      skipping,
    };
  };

  const selectedSummary =
    getDaySummary(selectedDate);

  return (
    <div className="student-calendar-page">

      {/* HEADER */}
      <div className="student-calendar-header">
        <div>
          <span className="student-calendar-label">
            MEAL PLANNER
          </span>

          <h1>Menu Calendar</h1>

          <p>
            View your published meals and manage your
            meal responses.
          </p>
        </div>

        <div className="student-calendar-assignment">
          <Utensils size={18} />

          <div>
            <span>Assigned Meal Category</span>

            <strong>
              {assignment?.meal_category ||
                assignment?.mealCategory ||
                "Not assigned"}
            </strong>
          </div>
        </div>
      </div>

      {/* ALERT */}
      {message && (
        <div className="student-calendar-alert success">
          <CheckCircle2 size={18} />
          {message}
        </div>
      )}

      {error && (
        <div className="student-calendar-alert error">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* CALENDAR CARD */}
      <section className="student-calendar-card">

        {/* CALENDAR TOOLBAR */}
        <div className="student-calendar-toolbar">

          <div className="student-calendar-month">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="student-calendar-nav"
              aria-label="Previous month"
            >
              <ChevronLeft size={19} />
            </button>

            <h2>{formatMonth(currentMonth)}</h2>

            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="student-calendar-nav"
              aria-label="Next month"
            >
              <ChevronRight size={19} />
            </button>
          </div>

          <button
            type="button"
            className="student-today-button"
            onClick={goToToday}
          >
            <CalendarDays size={16} />
            Today
          </button>

        </div>

        {/* LEGEND */}
        <div className="student-calendar-legend">
          <div>
            <span className="legend-dot published" />
            Published menu
          </div>

          <div>
            <span className="legend-dot attending" />
            Attending
          </div>

          <div>
            <span className="legend-dot skipping" />
            Skipping
          </div>
        </div>

        {/* WEEK DAYS */}
        <div className="student-calendar-weekdays">
          {[
            "Sun",
            "Mon",
            "Tue",
            "Wed",
            "Thu",
            "Fri",
            "Sat",
          ].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* DAYS */}
        {loading ? (
          <div className="student-calendar-loading">
            <RefreshCw
              size={28}
              className="student-calendar-spin"
            />

            <span>Loading menu calendar...</span>
          </div>
        ) : (
          <div className="student-calendar-grid">

            {calendarDays.map((date, index) => {
              if (!date) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="student-calendar-day empty"
                  />
                );
              }

              const key = getDateKey(date);
              const dayMenus =
                menusByDate[key] || [];

              const summary =
                getDaySummary(date);

              const isToday =
                key === todayKey;

              const isSelected =
                key === selectedDateKey;

              return (
                <button
                  type="button"
                  key={key}
                  className={`student-calendar-day ${
                    isToday ? "today" : ""
                  } ${
                    isSelected ? "selected" : ""
                  } ${
                    dayMenus.length > 0
                      ? "has-menu"
                      : ""
                  }`}
                  onClick={() =>
                    handleDateClick(date)
                  }
                >
                  <div className="student-day-number">
                    {date.getDate()}
                  </div>

                  {dayMenus.length > 0 && (
                    <div className="student-day-meals">

                      {dayMenus
                        .slice(0, 3)
                        .map((menu) => {
                          const response =
                            responses[menu.id] ||
                            menu.response;

                          return (
                            <div
                              key={menu.id}
                              className={`student-day-meal ${
                                getStatusClass(
                                  response
                                )
                              }`}
                            >
                              <span>
                                {String(
                                  menu.meal
                                ).charAt(0)}
                              </span>

                              <b>
                                {String(
                                  menu.meal
                                )}
                              </b>
                            </div>
                          );
                        })}

                      {dayMenus.length > 3 && (
                        <small>
                          +{dayMenus.length - 3} more
                        </small>
                      )}

                    </div>
                  )}

                  {summary.attending > 0 && (
                    <div className="student-day-status">
                      <span className="mini-attending" />
                    </div>
                  )}

                </button>
              );
            })}

          </div>
        )}

      </section>

      {/* SELECTED DAY */}
      <section className="student-selected-day">

        <div className="student-selected-day-header">

          <div>
            <span className="student-selected-label">
              SELECTED DATE
            </span>

            <h2>{formatDate(selectedDate)}</h2>
          </div>

          <div className="student-selected-summary">

            <div>
              <strong>
                {selectedSummary.count}
              </strong>
              <span>Meals</span>
            </div>

            <div>
              <strong>
                {selectedSummary.attending}
              </strong>
              <span>Attending</span>
            </div>

            <div>
              <strong>
                {selectedSummary.skipping}
              </strong>
              <span>Skipping</span>
            </div>

          </div>

        </div>

        {selectedMenus.length === 0 ? (
          <div className="student-no-menu">

            <div className="student-no-menu-icon">
              <Utensils size={27} />
            </div>

            <h3>No published menu</h3>

            <p>
              No meal menu has been published for this
              date based on your assigned meal category.
            </p>

          </div>
        ) : (
          <div className="student-menu-list">

            {selectedMenus.map((menu) => {
              const currentResponse =
                responses[menu.id] ||
                menu.response ||
                "not_recorded";

              const isSaving =
                savingId === menu.id;

              return (
                <article
                  key={menu.id}
                  className="student-menu-card"
                >

                  {/* MENU HEADER */}
                  <div className="student-menu-card-header">

                    <div className="student-menu-meal-icon">
                      <Utensils size={21} />
                    </div>

                    <div className="student-menu-title">

                      <span>
                        {menu.meal}
                      </span>

                      <h3>
                        {menu.title ||
                          `${menu.meal} Menu`}
                      </h3>

                    </div>

                    <div
                      className={`student-menu-status ${
                        getStatusClass(
                          currentResponse
                        )
                      }`}
                    >
                      {getStatusIcon(
                        currentResponse
                      )}

                      {getStatusText(
                        currentResponse
                      )}
                    </div>

                  </div>

                  {/* SERVING INFO */}
                  {(menu.servingTime ||
                    menu.cutoffTime) && (
                    <div className="student-menu-times">

                      {menu.servingTime && (
                        <div>
                          <Clock3 size={15} />
                          <span>
                            Serving:{" "}
                            <strong>
                              {menu.servingTime}
                            </strong>
                          </span>
                        </div>
                      )}

                      {menu.cutoffTime && (
                        <div>
                          <Clock3 size={15} />
                          <span>
                            Response cutoff:{" "}
                            <strong>
                              {menu.cutoffTime}
                            </strong>
                          </span>
                        </div>
                      )}

                    </div>
                  )}

                  {/* ITEMS */}
                  <div className="student-menu-items">

                    <h4>Today's Menu</h4>

                    {menu.items.length === 0 ? (
                      <p className="student-empty-items">
                        Menu items are not available.
                      </p>
                    ) : (
                      <div className="student-food-items">

                        {menu.items.map(
                          (item, itemIndex) => (
                            <div
                              className="student-food-item"
                              key={`${menu.id}-${itemIndex}`}
                            >
                              <span className="student-food-bullet">
                                ✓
                              </span>

                              <div>
                                <strong>
                                  {item.name}
                                </strong>

                                {item.category && (
                                  <small>
                                    {item.category}
                                  </small>
                                )}
                              </div>
                            </div>
                          )
                        )}

                      </div>
                    )}

                  </div>

                  {/* RESPONSE */}
                  <div className="student-response-section">

                    <div>
                      <h4>
                        Will you attend this meal?
                      </h4>

                      <p>
                        Your response helps the mess
                        prepare the required quantity.
                      </p>
                    </div>

                    <div className="student-response-buttons">

                      <button
                        type="button"
                        disabled={
                          isSaving ||
                          !menu.published
                        }
                        className={`student-response-btn attend ${
                          currentResponse ===
                          "attending"
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          handleResponse(
                            menu,
                            "attending"
                          )
                        }
                      >
                        {isSaving &&
                        currentResponse !==
                          "attending" ? (
                          <RefreshCw
                            size={16}
                            className="student-calendar-spin"
                          />
                        ) : (
                          <CheckCircle2 size={17} />
                        )}

                        Attending
                      </button>

                      <button
                        type="button"
                        disabled={
                          isSaving ||
                          !menu.published
                        }
                        className={`student-response-btn skip ${
                          currentResponse ===
                          "skipping"
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          handleResponse(
                            menu,
                            "skipping"
                          )
                        }
                      >
                        {isSaving &&
                        currentResponse !==
                          "skipping" ? (
                          <RefreshCw
                            size={16}
                            className="student-calendar-spin"
                          />
                        ) : (
                          <XCircle size={17} />
                        )}

                        Skipping
                      </button>

                    </div>

                  </div>

                </article>
              );
            })}

          </div>
        )}

      </section>

      {/* REFRESH */}
      <div className="student-calendar-footer">

        <button
          type="button"
          className="student-calendar-refresh"
          onClick={loadCalendar}
          disabled={loading}
        >
          <RefreshCw
            size={17}
            className={
              loading
                ? "student-calendar-spin"
                : ""
            }
          />

          Refresh Calendar
        </button>

      </div>

    </div>
  );
}