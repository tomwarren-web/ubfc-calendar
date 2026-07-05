"use client";

import type { BookingWithNames } from "@/lib/types";
import { formatMin } from "@/lib/time";

interface Props {
  bookings: BookingWithNames[]; // this day's bookings, all pitches, sorted by time
  onBookingClick: (booking: BookingWithNames) => void;
}

export default function DayAgenda({ bookings, onBookingClick }: Props) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-10 text-center">
        <p className="text-sm font-medium text-slate-500">Nothing booked this day</p>
        <p className="mt-1 text-xs text-slate-400">Tap + to book a fixture or training slot</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {bookings.map((b) => (
        <li key={b.id}>
          <button
            type="button"
            onClick={() => onBookingClick(b)}
            className="flex w-full gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition active:scale-[0.99] active:bg-slate-50"
          >
            <span
              className="w-1.5 shrink-0 self-stretch rounded-full"
              style={{ backgroundColor: b.teamColour }}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-navy">
                  {formatMin(b.startMin)} – {formatMin(b.endMin)}
                </span>
                {b.pitchName ? (
                  <span className="shrink-0 rounded-full bg-navy px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    {b.pitchName}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                    Off-site
                  </span>
                )}
              </span>
              <span className="mt-0.5 block truncate font-semibold text-slate-900">
                {b.teamName}
              </span>
              {b.title && (
                <span className="block truncate text-sm text-slate-600">{b.title}</span>
              )}
              <span className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <span
                  className={`rounded px-1.5 py-0.5 font-medium ${
                    b.type === "fixture"
                      ? "bg-gold/25 text-navy"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {b.type === "fixture" ? "Fixture" : "Training"}
                </span>
                <span className="truncate">booked by {b.bookedBy}</span>
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
