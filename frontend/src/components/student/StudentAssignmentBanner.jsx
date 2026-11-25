import React from "react";
import {
  CheckCircle2,
  Building2,
  Layers3,
  Utensils,
  Soup,
} from "lucide-react";

import { useStudent } from "../../context/StudentContext";

function StudentAssignmentBanner() {
  const {
    student,
    assignment,
    loading,
  } = useStudent();

  if (loading) {
    return (
      <div className="student-assignment-banner loading">
        <div className="student-assignment-skeleton" />
      </div>
    );
  }

  const getValue = (
    assignmentKeys = [],
    studentKeys = [],
    fallback = "Not assigned"
  ) => {
    const getDisplayValue = (source, key) => {
      const value = source?.[key];

      if (typeof value === "string" && value.trim() !== "") {
        return value;
      }

      if (typeof value === "number") {
        return value;
      }

      if (
        value &&
        typeof value === "object" &&
        typeof value.name === "string" &&
        value.name.trim() !== ""
      ) {
        return value.name;
      }

      return null;
    };

    for (const key of assignmentKeys) {
      const value = getDisplayValue(assignment, key);

      if (value !== null) {
        return value;
      }
    }

    for (const key of studentKeys) {
      const value = getDisplayValue(student, key);

      if (value !== null) {
        return value;
      }
    }

    return fallback;
  };

  const hostel = getValue(
    ["hostel_name", "hostelName", "hostel"],
    ["hostel_name", "hostelName", "hostel"]
  );

  const block = getValue(
    ["block_name", "blockName", "block", "hostelBlock", "hostel_block"],
    ["block_name", "blockName", "block", "hostelBlock", "hostel_block"]
  );

  const messUnit = getValue(
    ["mess_unit_name", "messUnitName", "messUnit", "mess_unit"],
    ["mess_unit", "messUnit", "mess_unit_name", "messUnitName"]
  );

  const mealCategory = getValue(
    ["meal_category", "mealCategory"],
    ["meal_category", "mealCategory"]
  );

  const items = [
    {
      label: "Hostel",
      value: hostel,
      icon: Building2,
    },
    {
      label: "Block",
      value: block,
      icon: Layers3,
    },
    {
      label: "Mess Unit",
      value: messUnit,
      icon: Utensils,
    },
    {
      label: "Meal Category",
      value: mealCategory,
      icon: Soup,
    },
  ];

  return (
    <section className="student-assignment-banner">
      <div className="student-assignment-banner-left">
        <div className="student-assignment-check">
          <CheckCircle2
            size={20}
            strokeWidth={2.3}
          />
        </div>

        <div>
          <h3>
            Your Meal Assignment
          </h3>

          <p>
            Your menus and meal options are based
            on this assignment.
          </p>
        </div>
      </div>

      <div className="student-assignment-grid">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <div
              className="student-assignment-card"
              key={item.label}
            >
              <div className="student-assignment-card-icon">
                <Icon
                  size={17}
                  strokeWidth={2}
                />
              </div>

              <div className="student-assignment-card-info">
                <span>{item.label}</span>

                <strong title={String(item.value)}>
                  {item.value}
                </strong>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default StudentAssignmentBanner;