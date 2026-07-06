"use client";

import type { BookingWithNames } from "@/lib/types";
import { addDays, startOfWeek, toDateStr } from "@/lib/time";

interface Props {
  /** Any date inside the month being displayed (YYYY-MM-DD) */
  monthAnchor: string;
  bookings: BookingWithNames[];
  selectedDate: string;
  onSelectDay: (date: string) => void;
}

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export default function MonthGrid({ monthAnchor, bookings, selectedDate, onSelectDay }: Props) {
  const anchor = new Date(monthAnchor + "T00:00:00");
  const month = anchor.getMonth();
  const first = new Date(anchor.getFullYear(), month, 1);
  const last = new Date(anchor.getFullYear(), month + 1, 0);

  const weeks: Date[][] = [];
  let cursor = startOfWeek(first);
  while (cursor <= last) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
    cursor = addDays(cursor, 7);
  }

  const todayStr = toDateStr(new Date());
  const coloursByDate = new Map<string, string[]>();
  for (const b of bookings) {
    const arr = coloursByDate.get(b.date) ?? [];
    if (!arr.includes(b.teamColour)) arr.push(b.teamColour);
    coloursByDate.set(b.date, arr);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="grid grid-cols-7">
        {WEEKDAY_LABELS.map((w) => (
          <span
            key={w}
            className="pb-1 text-center text-[10px] font-semibold uppercase text-slate-400"
          >
            {w}
          </span>
        ))}
      </div>
      <div className="space-y-1">
        {weeks.map((week, i) => (
          <div key={i} className="grid grid-cols-7 gap-1">
            {week.map((d) => {
              const dateStr = toDateStr(d);
              const inMonth = d.getMonth() === month;
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === todayStr;
              const colours = coloursByDate.get(dateStr) ?? [];
              return (
                <button
                  key={dateStr}
                  onClick={() => onSelectDay(dateStr)}
                  className={`flex h-12 flex-col items-center justify-center rounded-lg transition ${
                    isSelected
                      ? "bg-navy text-white"
                      : isToday
                        ? "bg-accent/20 text-navy"
                        : inMonth
                          ? "text-slate-700 active:bg-slate-100"
                          : "text-slate-300"
                  }`}
                >
                  <span className={`text-sm ${isSelected || isToday ? "font-bold" : "font-medium"}`}>
                    {d.getDate()}
                  </span>
                  <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
                    {colours.slice(0, 4).map((c) => (
                      <span
                        key={c}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: isSelected ? "#f1c500" : c }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
