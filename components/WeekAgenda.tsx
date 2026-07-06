"use client";

import type { BookingWithNames } from "@/lib/types";
import { formatMin, toDateStr } from "@/lib/time";

interface Props {
  days: Date[]; // the 7 days of the week being shown
  bookings: BookingWithNames[]; // this week's bookings, all pitches
  onBookingClick: (booking: BookingWithNames) => void;
}

export default function WeekAgenda({ days, bookings, onBookingClick }: Props) {
  const todayStr = toDateStr(new Date());

  return (
    <div className="space-y-4">
      {days.map((d) => {
        const dateStr = toDateStr(d);
        const isToday = dateStr === todayStr;
        const dayBookings = bookings
          .filter((b) => b.date === dateStr)
          .sort(
            (a, c) =>
              a.startMin - c.startMin || (a.pitchName ?? "").localeCompare(c.pitchName ?? "")
          );
        return (
          <section key={dateStr}>
            <h3
              className={`mb-1.5 flex items-center gap-2 text-sm font-bold ${
                isToday ? "text-navy" : "text-slate-500"
              }`}
            >
              {d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
              {isToday && (
                <span className="rounded-full bg-accent/25 px-2 py-0.5 text-[10px] font-semibold uppercase text-navy">
                  Today
                </span>
              )}
            </h3>
            {dayBookings.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400">
                No bookings
              </p>
            ) : (
              <ul className="space-y-1.5">
                {dayBookings.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => onBookingClick(b)}
                      className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition active:scale-[0.99] active:bg-slate-50"
                    >
                      <span
                        className="h-8 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: b.teamColour }}
                      />
                      <span className="w-[92px] shrink-0 text-xs font-bold text-navy">
                        {formatMin(b.startMin)}–{formatMin(b.endMin)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {b.teamName}
                        </span>
                        {b.title && (
                          <span className="block truncate text-xs text-slate-500">{b.title}</span>
                        )}
                      </span>
                      {b.pitchName ? (
                        <span className="shrink-0 rounded-full bg-navy px-2 py-0.5 text-[10px] font-semibold text-white">
                          {b.pitchName}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          Off-site
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
