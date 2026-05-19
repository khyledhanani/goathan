"use client";

import { useState } from "react";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function startDay(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function DatePicker({
  value,
  onChange,
}: {
  value: string; // YYYY-MM-DD or ""
  onChange: (iso: string) => void;
}) {
  const today = new Date();
  const initialYear = value
    ? parseInt(value.split("-")[0], 10)
    : today.getFullYear();
  const initialMonth = value
    ? parseInt(value.split("-")[1], 10) - 1
    : today.getMonth();

  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  const total = daysInMonth(viewYear, viewMonth);
  const offset = startDay(viewYear, viewMonth);
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);

  return (
    <div className="dp">
      <div className="dp-nav">
        <button type="button" className="dp-arrow" onClick={prevMonth}>
          &larr;
        </button>
        <span className="dp-title">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button type="button" className="dp-arrow" onClick={nextMonth}>
          &rarr;
        </button>
      </div>
      <div className="dp-grid">
        {DAYS.map((d) => (
          <span key={d} className="dp-head">
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} className="dp-cell" />;
          const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isSelected = iso === value;
          const isToday = iso === todayIso;
          const isPast = iso < todayIso;
          return (
            <button
              key={iso}
              type="button"
              className={`dp-cell dp-day${isSelected ? " dp-sel" : ""}${isToday ? " dp-today" : ""}${isPast ? " dp-past" : ""}`}
              disabled={isPast}
              onClick={() => onChange(iso)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
