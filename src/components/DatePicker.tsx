import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DatePickerProps {
  value: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  required?: boolean;
  maxDate?: string; // "YYYY-MM-DD" - restricts future dates beyond this
  minDate?: string; // "YYYY-MM-DD" - restricts past dates before this
  onDateRestricted?: (attemptedDate: string, reason: "future" | "past") => void;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function parseDate(dateStr?: string | null) {
  const now = new Date();
  if (!dateStr || typeof dateStr !== "string") {
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }
  const clean = dateStr.trim();
  const isoMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return { year: y, month: m, day: d };
    }
  }

  const parsed = new Date(clean.includes(" ") && !clean.match(/\d{4}/) ? `${clean} ${now.getFullYear()}` : clean);
  if (!isNaN(parsed.getTime())) {
    return { year: parsed.getFullYear(), month: parsed.getMonth(), day: parsed.getDate() };
  }

  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
}

function formatISO(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Monday = 0
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  required,
  maxDate,
  minDate,
  onDateRestricted,
}) => {
  const parsed = parseDate(value || new Date().toISOString().split("T")[0]);
  const [viewYear, setViewYear] = useState(parsed.year);
  const [viewMonth, setViewMonth] = useState(parsed.month);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Sync view when value changes externally
  useEffect(() => {
    if (value) {
      const p = parseDate(value);
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [value]);

  const selectedDay = parsed.day;
  const selectedMonth = parsed.month;
  const selectedYear = parsed.year;

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);

  // Previous month trailing days
  const prevMonthDays = getDaysInMonth(viewYear, viewMonth - 1 < 0 ? 11 : viewMonth - 1);
  const trailingDays: { day: number; current: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    trailingDays.push({ day: prevMonthDays - i, current: false });
  }

  // Current month days
  const currentDays: { day: number; current: boolean }[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    currentDays.push({ day: i, current: true });
  }

  // Next month leading days
  const totalCells = trailingDays.length + currentDays.length;
  const nextDaysCount = totalCells <= 35 ? 35 - totalCells : 42 - totalCells;
  const leadingDays: { day: number; current: boolean }[] = [];
  for (let i = 1; i <= nextDaysCount; i++) {
    leadingDays.push({ day: i, current: false });
  }

  const allDays = [...trailingDays, ...currentDays, ...leadingDays];

  const goToPrevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const isDayRestricted = (day: number, isCurrent: boolean): { restricted: boolean; reason?: "future" | "past" } => {
    if (!isCurrent) return { restricted: false };
    const dateStr = formatISO(viewYear, viewMonth, day);
    if (maxDate && dateStr > maxDate) {
      return { restricted: true, reason: "future" };
    }
    if (minDate && dateStr < minDate) {
      return { restricted: true, reason: "past" };
    }
    return { restricted: false };
  };

  const handleSelectDay = (day: number, isCurrent: boolean) => {
    if (isCurrent) {
      const selectedIso = formatISO(viewYear, viewMonth, day);
      const { restricted, reason } = isDayRestricted(day, isCurrent);
      if (restricted && reason) {
        onDateRestricted?.(selectedIso, reason);
        return;
      }
      onChange(selectedIso);
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    onChange("");
    setIsOpen(false);
  };

  const handleToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const todayIso = formatISO(y, m, d);
    if (maxDate && todayIso > maxDate) {
      onDateRestricted?.(todayIso, "future");
      return;
    }
    if (minDate && todayIso < minDate) {
      onDateRestricted?.(todayIso, "past");
      return;
    }
    setViewYear(y);
    setViewMonth(m);
    onChange(todayIso);
    setIsOpen(false);
  };

  const isSelected = (day: number, isCurrent: boolean) =>
    isCurrent && day === selectedDay && viewMonth === selectedMonth && viewYear === selectedYear;

  const isToday = (day: number, isCurrent: boolean) => {
    if (!isCurrent) return false;
    const now = new Date();
    return day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
  };

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full z-10 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
      {/* Hidden native input for form validation */}
      {required && (
        <input
          type="date"
          required
          max={maxDate}
          min={minDate}
          value={value}
          onChange={() => {}}
          tabIndex={-1}
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-5 min-w-[340px] select-none"
             onClick={(e) => e.stopPropagation()}
              style={{ fontSize: '0.7rem' }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4 gap-1">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              title="Previous month"
            >
              <ChevronLeft className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
            <div className="flex items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-slate-800 dark:text-white text-sm bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 py-1 px-1.5 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer focus:outline-none"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx} className="bg-white dark:bg-[#1E1E1E] text-slate-900 dark:text-white">
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-slate-800 dark:text-white text-sm bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 py-1 px-1.5 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer focus:outline-none"
              >
                {Array.from({ length: 110 }, (_, i) => new Date().getFullYear() + 5 - i).map((yr) => (
                  <option key={yr} value={yr} className="bg-white dark:bg-[#1E1E1E] text-slate-900 dark:text-white">
                    {yr}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={goToNextMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
              title="Next month"
            >
              <ChevronRight className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_LABELS.map((label) => (
              <div key={label} className="text-center text-xs font-semibold text-slate-400 dark:text-slate-500 py-1">
                {label}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {allDays.map((d, i) => {
              const selected = isSelected(d.day, d.current);
              const today = isToday(d.day, d.current);
              const { restricted } = isDayRestricted(d.day, d.current);

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectDay(d.day, d.current)}
                  disabled={!d.current}
                  className={`
                    w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all duration-150
                    ${!d.current
                      ? "text-slate-300 dark:text-slate-600 cursor-default"
                      : restricted
                        ? "text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-35 hover:bg-transparent"
                        : selected
                          ? "bg-cyan-500 text-white font-bold shadow-md shadow-cyan-500/30 cursor-pointer"
                          : today
                            ? "border-2 border-cyan-400 text-cyan-600 dark:text-cyan-400 font-semibold hover:bg-cyan-50 dark:hover:bg-cyan-950 cursor-pointer"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium cursor-pointer"
                    }
                  `}
                  title={restricted ? "Date restricted: future dates not allowed for media" : undefined}
                >
                  {d.day}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition font-medium cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="text-sm text-cyan-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition font-medium cursor-pointer"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
