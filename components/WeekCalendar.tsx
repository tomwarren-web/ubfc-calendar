"use client";

import type { BookingWithNames, Pitch } from "@/lib/types";
import {
  DAY_END_MIN,
  DAY_START_MIN,
  formatDayLabel,
  formatMin,
  toDateStr,
  weekDays,
} from "@/lib/time";

interface Props {
  weekStart: Date;
  pitch: Pitch;
  bookings: BookingWithNames[]; // already filtered to this pitch + week
  onSlotClick: (date: string, startMin: number) => void;
  onBookingClick: (booking: BookingWithNames) => void;
}

const TOTAL_MIN = DAY_END_MIN - DAY_START_MIN;
const HOUR_PX = 48;
const GRID_HEIGHT = (TOTAL_MIN / 60) * HOUR_PX;

export default function WeekCalendar({
  weekStart,
  pitch,
  bookings,
  onSlotClick,
  onBookingClick,
}: Props) {
  const days = weekDays(weekStart);
  const hours: number[] = [];
  for (let m = DAY_START_MIN; m < DAY_END_MIN; m += 60) hours.push(m);
  const todayStr = toDateStr(new Date());

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, dateStr: string) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const rawMin = DAY_START_MIN + (y / GRID_HEIGHT) * TOTAL_MIN;
    const snapped = Math.floor(rawMin / 30) * 30; // snap to half hour
    onSlotClick(dateStr, Math.min(snapped, DAY_END_MIN - 30));
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="min-w-[840px]">
        {/* Day headers */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-slate-200">
          <div />
          {days.map((d) => {
            const isToday = toDateStr(d) === todayStr;
            return (
              <div
                key={d.toISOString()}
                className={`border-l border-slate-200 px-2 py-2 text-center text-sm font-medium ${
                  isToday ? "bg-emerald-50 text-emerald-700" : "text-slate-700"
                }`}
              >
                {formatDayLabel(d)}
              </div>
            );
          })}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)]">
          {/* Time gutter */}
          <div className="relative" style={{ height: GRID_HEIGHT }}>
            {hours.map((m) => (
              <div
                key={m}
                className="absolute right-2 -translate-y-1/2 text-xs text-slate-400"
                style={{ top: ((m - DAY_START_MIN) / TOTAL_MIN) * GRID_HEIGHT }}
              >
                {m === DAY_START_MIN ? "" : formatMin(m)}
              </div>
            ))}
          </div>

          {days.map((d) => {
            const dateStr = toDateStr(d);
            const dayBookings = bookings.filter((b) => b.date === dateStr);
            return (
              <div
                key={dateStr}
                className="relative cursor-pointer border-l border-slate-200"
                style={{ height: GRID_HEIGHT }}
                onClick={(e) => handleColumnClick(e, dateStr)}
                title="Click an empty slot to book"
              >
                {/* Hour lines */}
                {hours.slice(1).map((m) => (
                  <div
                    key={m}
                    className="pointer-events-none absolute inset-x-0 border-t border-slate-100"
                    style={{ top: ((m - DAY_START_MIN) / TOTAL_MIN) * GRID_HEIGHT }}
                  />
                ))}

                {/* Bookings */}
                {dayBookings.map((b) => {
                  const clampedStart = Math.max(b.startMin, DAY_START_MIN);
                  const clampedEnd = Math.min(b.endMin, DAY_END_MIN);
                  if (clampedEnd <= clampedStart) return null;
                  const top = ((clampedStart - DAY_START_MIN) / TOTAL_MIN) * GRID_HEIGHT;
                  const height = ((clampedEnd - clampedStart) / TOTAL_MIN) * GRID_HEIGHT;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBookingClick(b);
                      }}
                      className="absolute inset-x-0.5 z-10 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-white shadow-sm transition hover:brightness-110"
                      style={{ top, height, backgroundColor: b.teamColour }}
                      title={`${b.teamName} · ${formatMin(b.startMin)}–${formatMin(b.endMin)}${b.title ? ` · ${b.title}` : ""} · booked by ${b.bookedBy}`}
                    >
                      <span className="block truncate text-xs font-semibold leading-tight">
                        {b.teamName}
                      </span>
                      <span className="block truncate text-[10px] leading-tight opacity-90">
                        {b.type === "fixture" ? "⚽ Fixture" : "Training"} ·{" "}
                        {formatMin(b.startMin)}–{formatMin(b.endMin)}
                      </span>
                      {b.title && height > 44 && (
                        <span className="block truncate text-[10px] leading-tight opacity-80">
                          {b.title}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
        {pitch.name} — click an empty slot to book, or a booking to edit it.
      </div>
    </div>
  );
}
