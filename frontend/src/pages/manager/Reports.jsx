import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Download,
  FileDown,
  PieChart,
  Printer,
  RefreshCw,
  TrendingDown,
  Users,
  UtensilsCrossed,
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

import "./reports.css";


/* =========================================================
   DATE HELPERS
========================================================= */

function getDefaultStartDate() {
  const date = new Date();

  date.setDate(
    date.getDate() - 6
  );

  return date
    .toISOString()
    .slice(0, 10);
}


function getDefaultEndDate() {
  return new Date()
    .toISOString()
    .slice(0, 10);
}


/* =========================================================
   DISPLAY HELPERS
========================================================= */

function readableMeal(value) {
  const normalized =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();


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
    value === "veg"
  ) {
    return "Veg";
  }


  if (
    value === "non-veg"
  ) {
    return "Non-Veg";
  }


  return "All";
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


  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}


/* =========================================================
   CSV HELPERS
========================================================= */

function escapeCsv(value) {
  const text =
    String(
      value ?? ""
    );


  return `"${text.replaceAll(
    '"',
    '""'
  )}"`;
}


function downloadBlob(
  blob,
  filename
) {
  const url =
    URL.createObjectURL(
      blob
    );


  const anchor =
    document.createElement(
      "a"
    );


  anchor.href = url;

  anchor.download =
    filename;


  document.body.appendChild(
    anchor
  );


  anchor.click();


  document.body.removeChild(
    anchor
  );


  URL.revokeObjectURL(
    url
  );
}


/* =========================================================
   PDF HELPERS
========================================================= */

function escapePdfText(value) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "\\",
      "\\\\"
    )
    .replaceAll(
      "(",
      "\\("
    )
    .replaceAll(
      ")",
      "\\)"
    );
}


function createSimplePdfBlob(
  lines
) {
  const safeLines =
    lines.map(
      (line) =>
        escapePdfText(
          line
        )
    );


  let textStream =
    "BT\n" +
    "/F1 11 Tf\n" +
    "48 790 Td\n";


  safeLines.forEach(
    (
      line,
      index
    ) => {
      if (
        index === 0
      ) {
        textStream +=
          `(${line}) Tj\n`;
      } else {
        textStream +=
          "0 -18 Td\n" +
          `(${line}) Tj\n`;
      }
    }
  );


  textStream +=
    "ET";


  const objects = [];


  objects.push(
    "1 0 obj\n" +
      "<< /Type /Catalog /Pages 2 0 R >>\n" +
      "endobj\n"
  );


  objects.push(
    "2 0 obj\n" +
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n" +
      "endobj\n"
  );


  objects.push(
    "3 0 obj\n" +
      "<< /Type /Page /Parent 2 0 R " +
      "/MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 5 0 R >> >> " +
      "/Contents 4 0 R >>\n" +
      "endobj\n"
  );


  objects.push(
    "4 0 obj\n" +
      `<< /Length ${textStream.length} >>\n` +
      "stream\n" +
      textStream +
      "\nendstream\n" +
      "endobj\n"
  );


  objects.push(
    "5 0 obj\n" +
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n" +
      "endobj\n"
  );


  let pdf =
    "%PDF-1.4\n";


  const offsets = [
    0,
  ];


  objects.forEach(
    (object) => {
      offsets.push(
        pdf.length
      );

      pdf += object;
    }
  );


  const xrefOffset =
    pdf.length;


  pdf +=
    "xref\n" +
    `0 ${objects.length + 1}\n` +
    "0000000000 65535 f \n";


  for (
    let index = 1;
    index <= objects.length;
    index += 1
  ) {
    pdf +=
      `${String(
        offsets[index]
      ).padStart(
        10,
        "0"
      )} 00000 n \n`;
  }


  pdf +=
    "trailer\n" +
    `<< /Size ${
      objects.length + 1
    } /Root 1 0 R >>\n` +
    "startxref\n" +
    `${xrefOffset}\n` +
    "%%EOF";


  return new Blob(
    [pdf],
    {
      type:
        "application/pdf",
    }
  );
}


/* =========================================================
   MEAL CONSUMPTION CHART
========================================================= */

function MealConsumptionChart({
  data,
}) {
  const maximum =
    Math.max(
      ...data.map(
        (item) =>
          Number(
            item.value || 0
          )
      ),
      1
    );


  return (
    <div className="report-bar-chart">

      {data.map(
        (item) => {
          const value =
            Number(
              item.value || 0
            );


          const percentage =
            Math.min(
              100,
              (
                value /
                maximum
              ) *
                100
            );


          return (
            <div
              key={
                item.meal
              }
              className="report-bar-row"
            >

              <div className="report-bar-label">

                <span>
                  {readableMeal(
                    item.meal
                  )}
                </span>

                <strong>
                  {value}
                </strong>

              </div>


              <div className="report-bar-track">

                <span
                  style={{
                    width:
                      `${percentage}%`,
                  }}
                />

              </div>

            </div>
          );
        }
      )}

    </div>
  );
}


/* =========================================================
   VEG / NON-VEG
========================================================= */

function CategoryComparison({
  data,
}) {
  const veg =
    Number(
      data.find(
        (item) =>
          item.category ===
          "veg"
      )?.value || 0
    );


  const nonVeg =
    Number(
      data.find(
        (item) =>
          item.category ===
          "non-veg"
      )?.value || 0
    );


  const total =
    veg + nonVeg;


  const vegPercentage =
    total > 0
      ? (
          veg /
          total
        ) *
        100
      : 0;


  const nonVegPercentage =
    total > 0
      ? (
          nonVeg /
          total
        ) *
        100
      : 0;


  return (
    <div className="report-category-comparison">

      <div className="report-category-total">

        <strong>
          {total}
        </strong>

        <span>
          Total Meals
        </span>

      </div>


      <div className="report-category-bar">

        <span
          className="veg"
          style={{
            width:
              `${vegPercentage}%`,
          }}
        />

        <span
          className="nonveg"
          style={{
            width:
              `${nonVegPercentage}%`,
          }}
        />

      </div>


      <div className="report-category-legend">

        <div>

          <i className="veg" />

          <span>
            Veg
          </span>

          <strong>
            {veg}
          </strong>

          <small>
            {vegPercentage.toFixed(
              1
            )}
            %
          </small>

        </div>


        <div>

          <i className="nonveg" />

          <span>
            Non-Veg
          </span>

          <strong>
            {nonVeg}
          </strong>

          <small>
            {nonVegPercentage.toFixed(
              1
            )}
            %
          </small>

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   RESPONSE DOUGHNUT
========================================================= */

function ResponseChart({
  responseData,
}) {
  const attending =
    Number(
      responseData
        ?.attending
        ?.count || 0
    );


  const skipping =
    Number(
      responseData
        ?.skipping
        ?.count || 0
    );


  const unanswered =
    Number(
      responseData
        ?.unanswered
        ?.count || 0
    );


  const total =
    Number(
      responseData?.total ||
      attending +
        skipping +
        unanswered
    );


  const attendingPercentage =
    total > 0
      ? (
          attending /
          total
        ) *
        100
      : 0;


  const skippingPercentage =
    total > 0
      ? (
          skipping /
          total
        ) *
        100
      : 0;


  const firstEnd =
    attendingPercentage;


  const secondEnd =
    attendingPercentage +
    skippingPercentage;


  const background =
    total > 0
      ? `conic-gradient(
          #22a765 0% ${firstEnd}%,
          #ff6500 ${firstEnd}% ${secondEnd}%,
          #cbd5e1 ${secondEnd}% 100%
        )`
      : "#e8edf2";


  return (
    <div className="report-response-chart">

      <div
        className="report-doughnut"
        style={{
          background,
        }}
      >

        <div className="report-doughnut-center">

          <strong>
            {total}
          </strong>

          <span>
            Responses
          </span>

        </div>

      </div>


      <div className="report-response-legend">

        <div>

          <i className="attending" />

          <span>
            Attending
          </span>

          <strong>
            {attending}
          </strong>

        </div>


        <div>

          <i className="skipping" />

          <span>
            Skipping
          </span>

          <strong>
            {skipping}
          </strong>

        </div>


        <div>

          <i className="unanswered" />

          <span>
            Unanswered
          </span>

          <strong>
            {unanswered}
          </strong>

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   WASTE TREND
========================================================= */

function WasteTrendChart({
  data,
}) {
  if (
    data.length === 0
  ) {
    return (
      <div className="report-chart-empty">

        <TrendingDown
          size={34}
        />

        <strong>
          No waste data
        </strong>

        <span>
          Waste trend data will appear when matching records exist.
        </span>

      </div>
    );
  }


  const width = 720;

  const height = 250;

  const left = 46;

  const right = 24;

  const top = 22;

  const bottom = 42;


  const chartWidth =
    width -
    left -
    right;


  const chartHeight =
    height -
    top -
    bottom;


  const maximum =
    Math.max(
      ...data.map(
        (item) =>
          Number(
            item.waste || 0
          )
      ),
      1
    );


  const pointX =
    (index) => {
      if (
        data.length === 1
      ) {
        return (
          left +
          chartWidth / 2
        );
      }


      return (
        left +
        (
          index /
          (data.length - 1)
        ) *
          chartWidth
      );
    };


  const pointY =
    (value) =>
      top +
      chartHeight -
      (
        Number(
          value || 0
        ) /
        maximum
      ) *
        chartHeight;


  const points =
    data
      .map(
        (
          item,
          index
        ) =>
          `${pointX(
            index
          )},${pointY(
            item.waste
          )}`
      )
      .join(" ");


  return (
    <div className="report-waste-chart-wrapper">

      <svg
        className="report-waste-chart"
        viewBox={`0 0 ${width} ${height}`}
      >

        {[
          0,
          0.25,
          0.5,
          0.75,
          1,
        ].map(
          (ratio) => {
            const y =
              top +
              chartHeight -
              ratio *
                chartHeight;


            return (
              <g
                key={
                  ratio
                }
              >

                <line
                  x1={left}
                  x2={
                    width -
                    right
                  }
                  y1={y}
                  y2={y}
                  className="report-chart-grid-line"
                />


                <text
                  x={
                    left - 8
                  }
                  y={
                    y + 4
                  }
                  textAnchor="end"
                  className="report-chart-label"
                >
                  {(
                    maximum *
                    ratio
                  ).toFixed(
                    1
                  )}
                </text>

              </g>
            );
          }
        )}


        <polyline
          points={points}
          className="report-waste-line"
        />


        {data.map(
          (
            item,
            index
          ) => (
            <g
              key={
                item.date
              }
            >

              <circle
                cx={
                  pointX(index)
                }
                cy={
                  pointY(
                    item.waste
                  )
                }
                r="4"
                className="report-waste-point"
              >

                <title>
                  {`${formatDate(
                    item.date
                  )}: ${
                    item.waste
                  } kg`}
                </title>

              </circle>


              <text
                x={
                  pointX(index)
                }
                y={
                  height - 14
                }
                textAnchor="middle"
                className="report-chart-label"
              >
                {new Date(
                  `${item.date}T00:00:00`
                ).toLocaleDateString(
                  "en-IN",
                  {
                    day:
                      "2-digit",

                    month:
                      "short",
                  }
                )}
              </text>

            </g>
          )
        )}

      </svg>

    </div>
  );
}


/* =========================================================
   REPORTS
========================================================= */

function Reports() {
  const {
    apiFetch,
    hostels,
    messUnits,
  } = useManager();


  /* =========================================================
     SUMMARY
  ========================================================= */

  const [
    summary,
    setSummary,
  ] = useState({
    totalMealsServed: 0,
    averageDailyStudents: 0,
    totalFoodWaste: 0,
    satisfactionRate: 0,
  });


  /* =========================================================
     CHART DATA
  ========================================================= */

  const [
    charts,
    setCharts,
  ] = useState({
    mealWiseConsumption: [],
    categoryComparison: [],
    wasteTrend: [],
  });


  /* =========================================================
     RESPONSE DATA
  ========================================================= */

  const [
    responses,
    setResponses,
  ] = useState({
    total: 0,
    menuCount: 0,

    attending: {
      count: 0,
      percentage: 0,
    },

    skipping: {
      count: 0,
      percentage: 0,
    },

    unanswered: {
      count: 0,
      percentage: 0,
    },
  });


  /* =========================================================
     LOADING / ERROR
  ========================================================= */

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
  ] = useState(
    getDefaultStartDate()
  );


  const [
    endDate,
    setEndDate,
  ] = useState(
    getDefaultEndDate()
  );


  /* =========================================================
     MESS OPTIONS
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
     COMMON REPORT QUERY

     IMPORTANT:
     All three report APIs now use exactly this query.
  ========================================================= */

  const reportQuery =
    useMemo(() => {
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


      return (
        params.toString()
      );
    }, [
      hostelFilter,
      messFilter,
      categoryFilter,
      startDate,
      endDate,
    ]);


  /* =========================================================
     LOAD REPORT
  ========================================================= */

  const loadReport =
    useCallback(async () => {
      if (
        startDate &&
        endDate &&
        startDate >
          endDate
      ) {
        setError(
          "Start Date cannot be later than End Date."
        );

        return;
      }


      setLoading(true);

      setError("");


      try {
        const [
          summaryData,
          chartData,
          responseData,
        ] =
          await Promise.all([

            apiFetch(
              `/api/manager/reports/summary?${reportQuery}`
            ),

            apiFetch(
              `/api/manager/reports/charts?${reportQuery}`
            ),

            apiFetch(
              `/api/manager/reports/responses?${reportQuery}`
            ),

          ]);


        /* ===================================================
           SUMMARY
        =================================================== */

        setSummary({

          totalMealsServed:
            Number(
              summaryData
                .summary
                ?.totalMealsServed ||
                0
            ),

          averageDailyStudents:
            Number(
              summaryData
                .summary
                ?.averageDailyStudents ||
                0
            ),

          totalFoodWaste:
            Number(
              summaryData
                .summary
                ?.totalFoodWaste ||
                0
            ),

          satisfactionRate:
            Number(
              summaryData
                .summary
                ?.satisfactionRate ||
                0
            ),

        });


        /* ===================================================
           CHARTS
        =================================================== */

        setCharts({

          mealWiseConsumption:
            Array.isArray(
              chartData
                .mealWiseConsumption
            )
              ? chartData
                  .mealWiseConsumption
              : [],

          categoryComparison:
            Array.isArray(
              chartData
                .categoryComparison
            )
              ? chartData
                  .categoryComparison
              : [],

          wasteTrend:
            Array.isArray(
              chartData
                .wasteTrend
            )
              ? chartData
                  .wasteTrend
              : [],

        });


        /* ===================================================
           PERIOD RESPONSE BREAKDOWN
        =================================================== */

        setResponses({

          total:
            Number(
              responseData
                ?.total ||
                0
            ),

          menuCount:
            Number(
              responseData
                ?.menuCount ||
                0
            ),

          attending: {

            count:
              Number(
                responseData
                  ?.attending
                  ?.count ||
                  0
              ),

            percentage:
              Number(
                responseData
                  ?.attending
                  ?.percentage ||
                  0
              ),

          },

          skipping: {

            count:
              Number(
                responseData
                  ?.skipping
                  ?.count ||
                  0
              ),

            percentage:
              Number(
                responseData
                  ?.skipping
                  ?.percentage ||
                  0
              ),

          },

          unanswered: {

            count:
              Number(
                responseData
                  ?.unanswered
                  ?.count ||
                  0
              ),

            percentage:
              Number(
                responseData
                  ?.unanswered
                  ?.percentage ||
                  0
              ),

          },

        });

      } catch (loadError) {
        console.error(
          "Reports loading error:",
          loadError
        );


        setError(
          loadError.message ||
            "Unable to load report data."
        );
      } finally {
        setLoading(false);
      }
    }, [
      apiFetch,
      reportQuery,
      startDate,
      endDate,
    ]);


  useEffect(() => {
    loadReport();
  }, [loadReport]);


  /* =========================================================
     SELECTED HOSTEL
  ========================================================= */

  const selectedHostelName =
    useMemo(() => {
      if (
        hostelFilter ===
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
              hostelFilter
            )
        )?.name ||
        "Selected Hostel"
      );
    }, [
      hostels,
      hostelFilter,
    ]);


  /* =========================================================
     SELECTED MESS
  ========================================================= */

  const selectedMessName =
    useMemo(() => {
      if (
        messFilter ===
        "all"
      ) {
        return "All Mess Units";
      }


      return (
        messUnits.find(
          (mess) =>
            String(
              mess.id
            ) ===
            String(
              messFilter
            )
        )?.name ||
        "Selected Mess Unit"
      );
    }, [
      messUnits,
      messFilter,
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

    setStartDate(
      getDefaultStartDate()
    );

    setEndDate(
      getDefaultEndDate()
    );
  };


  /* =========================================================
     CSV EXPORT
  ========================================================= */

  const exportCsv = () => {
    const rows = [

      [
        "HOSTEL MESS MANAGEMENT PORTAL",
      ],

      [
        "Manager Report",
      ],

      [],

      [
        "Hostel",
        selectedHostelName,
      ],

      [
        "Mess Unit",
        selectedMessName,
      ],

      [
        "Meal Category",
        readableCategory(
          categoryFilter
        ),
      ],

      [
        "Start Date",
        startDate,
      ],

      [
        "End Date",
        endDate,
      ],

      [],

      [
        "SUMMARY",
      ],

      [
        "Metric",
        "Value",
      ],

      [
        "Total Meals Served",
        summary.totalMealsServed,
      ],

      [
        "Average Daily Students",
        summary.averageDailyStudents,
      ],

      [
        "Total Food Waste (kg)",
        summary.totalFoodWaste,
      ],

      [
        "Satisfaction Rate (%)",
        summary.satisfactionRate,
      ],

      [],

      [
        "MEAL-WISE CONSUMPTION",
      ],

      [
        "Meal",
        "Students Served",
      ],

      ...charts
        .mealWiseConsumption
        .map(
          (item) => [

            readableMeal(
              item.meal
            ),

            item.value,

          ]
        ),

      [],

      [
        "VEG VS NON-VEG",
      ],

      [
        "Category",
        "Students Served",
      ],

      ...charts
        .categoryComparison
        .map(
          (item) => [

            readableCategory(
              item.category
            ),

            item.value,

          ]
        ),

      [],

      [
        "STUDENT RESPONSES",
      ],

      [
        "Response",
        "Count",
        "Percentage",
      ],

      [
        "Attending",

        responses
          .attending
          .count,

        `${responses
          .attending
          .percentage}%`,
      ],

      [
        "Skipping",

        responses
          .skipping
          .count,

        `${responses
          .skipping
          .percentage}%`,
      ],

      [
        "Unanswered",

        responses
          .unanswered
          .count,

        `${responses
          .unanswered
          .percentage}%`,
      ],

      [
        "Total Response Opportunities",

        responses.total,
      ],

      [
        "Menus Included",

        responses.menuCount,
      ],

      [],

      [
        "FOOD WASTE TREND",
      ],

      [
        "Date",
        "Waste KG",
      ],

      ...charts
        .wasteTrend
        .map(
          (item) => [

            item.date,

            item.waste,

          ]
        ),

    ];


    const csv =
      rows
        .map(
          (row) =>
            row
              .map(
                escapeCsv
              )
              .join(",")
        )
        .join("\n");


    downloadBlob(
      new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8",
        }
      ),

      `hostel-mess-report-${startDate}-${endDate}.csv`
    );
  };


  /* =========================================================
     PDF EXPORT
  ========================================================= */

  const downloadPdf = () => {
    const lines = [

      "HOSTEL MESS MANAGEMENT PORTAL",

      "Manager Report",

      "",

      `Hostel: ${selectedHostelName}`,

      `Mess Unit: ${selectedMessName}`,

      `Meal Category: ${readableCategory(
        categoryFilter
      )}`,

      `Period: ${formatDate(
        startDate
      )} to ${formatDate(
        endDate
      )}`,

      "",

      "SUMMARY",

      `Total Meals Served: ${summary.totalMealsServed}`,

      `Average Daily Students: ${summary.averageDailyStudents}`,

      `Total Food Waste: ${summary.totalFoodWaste} kg`,

      `Satisfaction Rate: ${summary.satisfactionRate}%`,

      "",

      "MEAL-WISE CONSUMPTION",

      ...charts
        .mealWiseConsumption
        .map(
          (item) =>
            `${readableMeal(
              item.meal
            )}: ${item.value}`
        ),

      "",

      "VEG VS NON-VEG",

      ...charts
        .categoryComparison
        .map(
          (item) =>
            `${readableCategory(
              item.category
            )}: ${item.value}`
        ),

      "",

      "STUDENT RESPONSES",

      `Attending: ${responses.attending.count} (${responses.attending.percentage}%)`,

      `Skipping: ${responses.skipping.count} (${responses.skipping.percentage}%)`,

      `Unanswered: ${responses.unanswered.count} (${responses.unanswered.percentage}%)`,

      `Total Response Opportunities: ${responses.total}`,

      `Menus Included: ${responses.menuCount}`,

      "",

      "FOOD WASTE TREND",

      ...charts
        .wasteTrend
        .map(
          (item) =>
            `${formatDate(
              item.date
            )}: ${item.waste} kg`
        ),

    ];


    const blob =
      createSimplePdfBlob(
        lines
      );


    downloadBlob(
      blob,

      `hostel-mess-report-${startDate}-${endDate}.pdf`
    );
  };


  /* =========================================================
     PRINT
  ========================================================= */

  const printReport = () => {
    window.print();
  };


  /* =========================================================
     DATE VALIDATION
  ========================================================= */

  const invalidDateRange =
    Boolean(
      startDate &&
      endDate &&
      startDate >
        endDate
    );


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div
      className="reports-page"
      id="manager-report"
    >

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="reports-header">

        <div>

          <span className="reports-eyebrow">
            ANALYTICS & INSIGHTS
          </span>

          <h1>
            Reports
          </h1>

          <p>
            Review meal consumption, student responses and food-waste performance.
          </p>

        </div>


        <div className="reports-header-actions">

          <button
            type="button"
            className="report-action-button"
            onClick={
              downloadPdf
            }
            disabled={
              loading ||
              invalidDateRange
            }
          >
            <Download
              size={16}
            />

            Download PDF
          </button>


          <button
            type="button"
            className="report-action-button"
            onClick={
              exportCsv
            }
            disabled={
              loading ||
              invalidDateRange
            }
          >
            <FileDown
              size={16}
            />

            Export CSV
          </button>


          <button
            type="button"
            className="report-primary-button"
            onClick={
              printReport
            }
            disabled={
              loading
            }
          >
            <Printer
              size={16}
            />

            Print
          </button>

        </div>

      </div>


      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="report-error-message">

          <AlertTriangle
            size={18}
          />

          <div>

            <strong>
              Unable to load Reports
            </strong>

            <span>
              {error}
            </span>

          </div>


          <button
            type="button"
            onClick={
              loadReport
            }
          >
            Retry
          </button>

        </div>
      )}


      {/* =====================================================
          DATE RANGE WARNING
      ===================================================== */}

      {invalidDateRange && (
        <div className="report-warning-message">

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

      <section className="report-filter-card">

        <div className="report-filter-field">

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


        <div className="report-filter-field">

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


        <div className="report-filter-field">

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


        <div className="report-filter-field">

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
              endDate ||
              undefined
            }
          />

        </div>


        <div className="report-filter-field">

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


        <button
          type="button"
          className="report-clear-button"
          onClick={
            clearFilters
          }
        >
          Clear Filters
        </button>

      </section>


      {/* =====================================================
          SELECTED FILTERS
      ===================================================== */}

      <div className="report-selection-summary">

        <CalendarDays
          size={17}
        />

        <span>
          Showing
          {" "}
          <strong>
            {selectedHostelName}
          </strong>
          {" • "}
          <strong>
            {selectedMessName}
          </strong>
          {" • "}
          <strong>
            {readableCategory(
              categoryFilter
            )}
          </strong>
          {" • "}
          {formatDate(
            startDate
          )}
          {" – "}
          {formatDate(
            endDate
          )}
        </span>

      </div>


      {/* =====================================================
          SUMMARY CARDS
      ===================================================== */}

      <section className="report-summary-grid">

        <article className="report-summary-card">

          <div className="report-summary-icon blue">

            <UtensilsCrossed
              size={21}
            />

          </div>

          <div>

            <span>
              Total Meals Served
            </span>

            <strong>
              {loading
                ? "—"
                : summary
                    .totalMealsServed}
            </strong>

            <small>
              Selected reporting period
            </small>

          </div>

        </article>


        <article className="report-summary-card">

          <div className="report-summary-icon orange">

            <Users
              size={21}
            />

          </div>

          <div>

            <span>
              Average Daily Students
            </span>

            <strong>
              {loading
                ? "—"
                : summary
                    .averageDailyStudents}
            </strong>

            <small>
              Daily average served
            </small>

          </div>

        </article>


        <article className="report-summary-card">

          <div className="report-summary-icon red">

            <TrendingDown
              size={21}
            />

          </div>

          <div>

            <span>
              Total Food Waste
            </span>

            <strong>
              {loading
                ? "—"
                : `${summary.totalFoodWaste} kg`}
            </strong>

            <small>
              Selected reporting period
            </small>

          </div>

        </article>


        <article className="report-summary-card">

          <div className="report-summary-icon green">

            <BarChart3
              size={21}
            />

          </div>

          <div>

            <span>
              Satisfaction Rate
            </span>

            <strong>
              {loading
                ? "—"
                : `${summary.satisfactionRate}%`}
            </strong>

            <small>
              Feedback metric
            </small>

          </div>

        </article>

      </section>


      {/* =====================================================
          CHARTS ROW 1
      ===================================================== */}

      <section className="report-chart-grid">

        {/* ===================================================
            MEAL CONSUMPTION
        =================================================== */}

        <article className="report-chart-card">

          <div className="report-chart-header">

            <div>

              <h2>
                Meal-wise Consumption
              </h2>

              <p>
                Students served by meal type
              </p>

            </div>


            <BarChart3
              size={19}
            />

          </div>


          {loading ? (

            <div className="report-chart-loading">

              <RefreshCw
                size={23}
                className="report-spin"
              />

              <span>
                Loading chart...
              </span>

            </div>

          ) : (

            <MealConsumptionChart
              data={
                charts
                  .mealWiseConsumption
              }
            />

          )}

        </article>


        {/* ===================================================
            CATEGORY
        =================================================== */}

        <article className="report-chart-card">

          <div className="report-chart-header">

            <div>

              <h2>
                Veg vs Non-Veg
              </h2>

              <p>
                Consumption comparison
              </p>

            </div>


            <PieChart
              size={19}
            />

          </div>


          {loading ? (

            <div className="report-chart-loading">

              <RefreshCw
                size={23}
                className="report-spin"
              />

              <span>
                Loading comparison...
              </span>

            </div>

          ) : (

            <CategoryComparison
              data={
                charts
                  .categoryComparison
              }
            />

          )}

        </article>

      </section>


      {/* =====================================================
          CHARTS ROW 2
      ===================================================== */}

      <section className="report-chart-grid">

        {/* ===================================================
            REPORT PERIOD RESPONSES
        =================================================== */}

        <article className="report-chart-card">

          <div className="report-chart-header">

            <div>

              <h2>
                Student Responses
              </h2>

              <p>
                Attending, skipping and unanswered for the selected reporting period
              </p>

            </div>


            <Users
              size={19}
            />

          </div>


          {loading ? (

            <div className="report-chart-loading">

              <RefreshCw
                size={23}
                className="report-spin"
              />

              <span>
                Loading responses...
              </span>

            </div>

          ) : (

            <ResponseChart
              responseData={
                responses
              }
            />

          )}

        </article>


        {/* ===================================================
            WASTE TREND
        =================================================== */}

        <article className="report-chart-card">

          <div className="report-chart-header">

            <div>

              <h2>
                Food Waste Trend
              </h2>

              <p>
                Waste recorded in kilograms during the selected reporting period
              </p>

            </div>


            <TrendingDown
              size={19}
            />

          </div>


          {loading ? (

            <div className="report-chart-loading">

              <RefreshCw
                size={23}
                className="report-spin"
              />

              <span>
                Loading waste trend...
              </span>

            </div>

          ) : (

            <WasteTrendChart
              data={
                charts
                  .wasteTrend
              }
            />

          )}

        </article>

      </section>


      {/* =====================================================
          REPORT TABLE
      ===================================================== */}

      <section className="report-table-card">

        <div className="report-table-heading">

          <div>

            <strong>
              Report Breakdown
            </strong>

            <span>
              Meal consumption summary
            </span>

          </div>

        </div>


        {loading ? (

          <div className="report-table-loading">

            <RefreshCw
              size={23}
              className="report-spin"
            />

            <span>
              Loading report data...
            </span>

          </div>

        ) : (

          <div className="report-table-wrapper">

            <table className="report-table">

              <thead>

                <tr>

                  <th>
                    Meal
                  </th>

                  <th>
                    Students Served
                  </th>

                  <th>
                    Selected Hostel
                  </th>

                  <th>
                    Selected Mess
                  </th>

                  <th>
                    Category
                  </th>

                  <th>
                    Period
                  </th>

                </tr>

              </thead>


              <tbody>

                {charts
                  .mealWiseConsumption
                  .map(
                    (item) => (

                      <tr
                        key={
                          item.meal
                        }
                      >

                        <td>

                          <strong>
                            {readableMeal(
                              item.meal
                            )}
                          </strong>

                        </td>


                        <td>
                          {item.value}
                        </td>


                        <td>
                          {selectedHostelName}
                        </td>


                        <td>
                          {selectedMessName}
                        </td>


                        <td>
                          {readableCategory(
                            categoryFilter
                          )}
                        </td>


                        <td>
                          {formatDate(
                            startDate
                          )}
                          {" – "}
                          {formatDate(
                            endDate
                          )}
                        </td>

                      </tr>

                    )
                  )}

              </tbody>

            </table>

          </div>

        )}

      </section>

    </div>
  );
}


export default Reports;