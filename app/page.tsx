"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { BookingWithNames, Pitch, Team } from "@/lib/types";
import { addDays, formatWeekLabel, startOfWeek, toDateStr } from "@/lib/time";
import WeekCalendar from "@/components/WeekCalendar";
import BookingModal, { type ModalDefaults } from "@/components/BookingModal";

// Pseudo pitch id for the "Off-site / no pitch" tab (training, away games, Cubs sessions).
const NO_PITCH = 0;

export default function Home() {
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [bookings, setBookings] = useState<BookingWithNames[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [activePitchId, setActivePitchId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [modal, setModal] = useState<{
    booking: BookingWithNames | null;
    defaults: ModalDefaults;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setName(localStorage.getItem("pb_name") ?? "");
    Promise.all([fetch("/api/pitches"), fetch("/api/teams")])
      .then(async ([p, t]) => {
        const pitchList: Pitch[] = await p.json();
        setPitches(pitchList);
        setTeams(await t.json());
        if (pitchList.length > 0) setActivePitchId(pitchList[0].id);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const from = toDateStr(weekStart);
  const to = toDateStr(addDays(weekStart, 6));

  const refreshBookings = useCallback(() => {
    fetch(`/api/bookings?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then(setBookings)
      .catch(() => {});
  }, [from, to]);

  useEffect(refreshBookings, [refreshBookings]);

  const activePitch = pitches.find((p) => p.id === activePitchId) ?? null;
  const calendarLabel = activePitch?.name ?? "Off-site / no pitch";
  const pitchBookings = useMemo(
    () =>
      bookings.filter((b) =>
        activePitchId === NO_PITCH ? b.pitchId === null : b.pitchId === activePitchId
      ),
    [bookings, activePitchId]
  );
  const noPitchCount = useMemo(
    () => bookings.filter((b) => b.pitchId === null).length,
    [bookings]
  );

  function saveName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    localStorage.setItem("pb_name", trimmed);
    setName(trimmed);
  }

  function openNewBooking(date?: string, startMin?: number) {
    if (activePitchId === null) return;
    setModal({
      booking: null,
      defaults: {
        pitchId: activePitchId,
        date: date ?? toDateStr(new Date()),
        startMin: startMin ?? 18 * 60,
      },
    });
  }

  if (!loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-500">
        Loading…
      </main>
    );
  }

  if (!name) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">
          <h1 className="text-xl font-bold text-slate-900">⚽ Pitch Booking</h1>
          <p className="mt-2 text-sm text-slate-600">
            Who&apos;s booking today? Your name is shown against every booking you make so the
            committee knows who to talk to.
          </p>
          <input
            className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder="e.g. Dave Smith (U15s manager)"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            autoFocus
          />
          <button
            onClick={saveName}
            disabled={!nameInput.trim()}
            className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <h1 className="text-lg font-bold text-slate-900">⚽ Pitch Booking</h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">
              Signed in as <span className="font-medium text-slate-800">{name}</span>
            </span>
            <button
              onClick={() => {
                localStorage.removeItem("pb_name");
                setName("");
                setNameInput("");
              }}
              className="text-slate-400 underline hover:text-slate-600"
            >
              change
            </button>
            <Link
              href="/settings"
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              Teams &amp; pitches
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Prev
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Today
            </button>
            <button
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Next →
            </button>
            <span className="ml-2 text-sm font-semibold text-slate-800">
              {formatWeekLabel(weekStart)}
            </span>
          </div>
          <button
            onClick={() => openNewBooking()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            + New booking
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {pitches.map((p) => {
            const count = bookings.filter((b) => b.pitchId === p.id).length;
            return (
              <button
                key={p.id}
                onClick={() => setActivePitchId(p.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  p.id === activePitchId
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {p.name}
                {count > 0 && (
                  <span
                    className={`ml-1.5 text-xs ${p.id === activePitchId ? "text-slate-300" : "text-slate-400"}`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
          <button
            onClick={() => setActivePitchId(NO_PITCH)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              activePitchId === NO_PITCH
                ? "bg-slate-900 text-white"
                : "border border-dashed border-slate-400 bg-white text-slate-600 hover:bg-slate-100"
            }`}
            title="Training, away games and anything else that doesn't need a pitch"
          >
            Off-site / no pitch
            {noPitchCount > 0 && (
              <span
                className={`ml-1.5 text-xs ${activePitchId === NO_PITCH ? "text-slate-300" : "text-slate-400"}`}
              >
                {noPitchCount}
              </span>
            )}
          </button>
        </div>

        {activePitchId !== null ? (
          <WeekCalendar
            weekStart={weekStart}
            label={calendarLabel}
            bookings={pitchBookings}
            onSlotClick={(date, startMin) => openNewBooking(date, startMin)}
            onBookingClick={(b) =>
              setModal({
                booking: b,
                defaults: { pitchId: b.pitchId ?? NO_PITCH, date: b.date, startMin: b.startMin },
              })
            }
          />
        ) : (
          <p className="text-sm text-slate-500">
            No pitches set up yet — add one under{" "}
            <Link href="/settings" className="underline">
              Teams &amp; pitches
            </Link>
            .
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
          {teams.map((t) => (
            <span key={t.id} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: t.colour }}
              />
              {t.name}
            </span>
          ))}
        </div>
      </div>

      {modal && (
        <BookingModal
          pitches={pitches}
          teams={teams}
          bookedBy={name}
          booking={modal.booking}
          defaults={modal.defaults}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            refreshBookings();
          }}
        />
      )}
    </main>
  );
}
