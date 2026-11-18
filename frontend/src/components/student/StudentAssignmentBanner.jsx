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
    for (const key of assignmentKeys) {
      if (
        assignment &&
        assignment[key] !== undefined &&
        assignment[key] !== null &&
        String(assignment[key]).trim() !== ""
      ) {
        return assignment[key];
      }
    }

    for (const key of studentKeys) {
      if (
        student &&
        student[key] !== undefined &&
        student[key] !== null &&
        String(student[key]).trim() !== ""
      ) {
        return student[key];
      }
    }

    return fallback;
  };

  const hostel = getValue(
    ["hostel_name", "hostelName"],
    ["hostel_name", "hostelName"]
  );

  const block = getValue(
    ["block_name", "blockName"],
    ["block_name", "blockName"]
  );

  const messUnit = getValue(
    ["mess_unit_name", "messUnitName"],
    ["mess_unit", "messUnit", "mess_unit_name"]
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