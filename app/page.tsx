"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { BookingWithNames, Pitch, Team } from "@/lib/types";
import { addDays, formatWeekLabel, startOfWeek, toDateStr, weekDays } from "@/lib/time";
import WeekCalendar from "@/components/WeekCalendar";
import BookingModal, { type ModalDefaults } from "@/components/BookingModal";
import ClubLogo from "@/components/ClubLogo";
import DayAgenda from "@/components/DayAgenda";
import WeekAgenda from "@/components/WeekAgenda";
import MonthGrid from "@/components/MonthGrid";

type MobileView = "day" | "week" | "month";

// Pseudo pitch id for the "Off-site / no pitch" tab (training, away games, Cubs sessions).
const NO_PITCH = 0;

export default function Home() {
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [bookings, setBookings] = useState<BookingWithNames[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => toDateStr(new Date()));
  const [viewMode, setViewMode] = useState<MobileView>("day");

  useEffect(() => {
    const saved = localStorage.getItem("pb_view");
    if (saved === "week" || saved === "month") setViewMode(saved);
  }, []);

  function changeView(mode: MobileView) {
    setViewMode(mode);
    localStorage.setItem("pb_view", mode);
  }
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

  // Month view needs the full month grid (including leading/trailing week days);
  // day and week views only need the current week.
  const range = useMemo(() => {
    if (viewMode === "month") {
      const d = new Date(selectedDate + "T00:00:00");
      const first = new Date(d.getFullYear(), d.getMonth(), 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { from: toDateStr(startOfWeek(first)), to: toDateStr(addDays(startOfWeek(last), 6)) };
    }
    return { from: toDateStr(weekStart), to: toDateStr(addDays(weekStart, 6)) };
  }, [viewMode, selectedDate, weekStart]);

  const refreshBookings = useCallback(() => {
    fetch(`/api/bookings?from=${range.from}&to=${range.to}`)
      .then((r) => r.json())
      .then(setBookings)
      .catch(() => {});
  }, [range.from, range.to]);

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
  // Mobile day view shows every booking for the selected day, all pitches + off-site
  const dayBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.date === selectedDate)
        .sort(
          (a, c) => a.startMin - c.startMin || (a.pitchName ?? "").localeCompare(c.pitchName ?? "")
        ),
    [bookings, selectedDate]
  );

  function shiftWeek(delta: number) {
    setWeekStart((w) => addDays(w, delta * 7));
    setSelectedDate((d) => toDateStr(addDays(new Date(d + "T00:00:00"), delta * 7)));
  }

  function goToToday() {
    setWeekStart(startOfWeek(new Date()));
    setSelectedDate(toDateStr(new Date()));
  }

  function shiftMonth(delta: number) {
    const d = new Date(selectedDate + "T00:00:00");
    const firstOfTarget = new Date(d.getFullYear(), d.getMonth() + delta, 1);
    setSelectedDate(toDateStr(firstOfTarget));
    setWeekStart(startOfWeek(firstOfTarget));
  }

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
      <main className="flex min-h-screen items-center justify-center bg-navy p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
          <div className="flex flex-col items-center text-center">
            <ClubLogo className="h-24 w-auto" />
            <h1 className="mt-4 text-xl font-bold text-navy">UBFC Calendar</h1>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Who&apos;s booking today? Your name is shown against every booking you make so the
            committee knows who to talk to.
          </p>
          <input
            className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-gold focus:outline-none focus:ring-2 focus:ring-accent/40"
            placeholder="e.g. Dave Smith (U12's manager)"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            autoFocus
          />
          <button
            onClick={saveName}
            disabled={!nameInput.trim()}
            className="mt-3 w-full rounded-lg bg-gold px-4 py-2 text-sm font-bold text-navy hover:bg-accent disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b-4 border-gold bg-navy">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <ClubLogo className="h-10 w-auto" />
            <h1 className="text-lg font-bold text-white">UBFC Calendar</h1>
          </div>
          <div className="flex min-w-0 items-center gap-3 text-sm">
            <span className="min-w-0 truncate text-slate-300">
              <span className="hidden sm:inline">Signed in as </span>
              <span className="font-medium text-white">{name}</span>
            </span>
            <button
              onClick={() => {
                localStorage.removeItem("pb_name");
                setName("");
                setNameInput("");
              }}
              className="text-slate-400 underline hover:text-accent"
            >
              change
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-4 px-4 py-4 pb-24 md:py-6 md:pb-6">
        {/* Desktop week navigation */}
        <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftWeek(-1)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              ← Prev
            </button>
            <button
              onClick={goToToday}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Today
            </button>
            <button
              onClick={() => shiftWeek(1)}
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
            className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-navy shadow-sm hover:bg-accent"
          >
            + New booking
          </button>
        </div>

        {/* Mobile views */}
        <div className="space-y-3 md:hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-base font-bold text-navy">
              {viewMode === "week"
                ? formatWeekLabel(weekStart)
                : new Date(selectedDate + "T00:00:00").toLocaleDateString("en-GB", {
                    month: "long",
                    year: "numeric",
                  })}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              {viewMode !== "day" && (
                <button
                  onClick={() => (viewMode === "month" ? shiftMonth(-1) : shiftWeek(-1))}
                  aria-label={viewMode === "month" ? "Previous month" : "Previous week"}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 active:bg-slate-100"
                >
                  ‹
                </button>
              )}
              <button
                onClick={goToToday}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 active:bg-slate-100"
              >
                Today
              </button>
              {viewMode !== "day" && (
                <button
                  onClick={() => (viewMode === "month" ? shiftMonth(1) : shiftWeek(1))}
                  aria-label={viewMode === "month" ? "Next month" : "Next week"}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 active:bg-slate-100"
                >
                  ›
                </button>
              )}
            </div>
          </div>

          {/* View switcher */}
          <div className="grid grid-cols-3 gap-1 rounded-full border border-slate-200 bg-white p-1">
            {(["day", "week", "month"] as const).map((m) => (
              <button
                key={m}
                onClick={() => changeView(m)}
                className={`rounded-full py-1.5 text-xs font-semibold capitalize transition ${
                  viewMode === m ? "bg-navy text-white" : "text-slate-600 active:bg-slate-100"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {viewMode === "day" && (
            <>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => shiftWeek(-1)}
                  aria-label="Previous week"
                  className="flex h-11 w-8 shrink-0 items-center justify-center rounded-lg text-lg text-slate-400 active:bg-slate-100"
                >
                  ‹
                </button>
                <div className="grid flex-1 grid-cols-7 gap-1">
                  {weekDays(weekStart).map((d) => {
                    const dateStr = toDateStr(d);
                    const isSelected = dateStr === selectedDate;
                    const isToday = dateStr === toDateStr(new Date());
                    const hasBookings = bookings.some((b) => b.date === dateStr);
                    return (
                      <button
                        key={dateStr}
                        onClick={() => setSelectedDate(dateStr)}
                        className={`flex h-14 flex-col items-center justify-center rounded-xl text-center transition ${
                          isSelected
                            ? "bg-navy text-white shadow"
                            : isToday
                              ? "bg-accent/20 text-navy"
                              : "bg-white text-slate-600 active:bg-slate-100"
                        }`}
                      >
                        <span
                          className={`text-[10px] font-medium uppercase ${isSelected ? "text-gold" : "text-slate-400"}`}
                        >
                          {d.toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2)}
                        </span>
                        <span className="text-sm font-bold leading-tight">{d.getDate()}</span>
                        <span
                          className={`mt-0.5 h-1 w-1 rounded-full ${
                            hasBookings ? (isSelected ? "bg-gold" : "bg-navy/60") : "bg-transparent"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => shiftWeek(1)}
                  aria-label="Next week"
                  className="flex h-11 w-8 shrink-0 items-center justify-center rounded-lg text-lg text-slate-400 active:bg-slate-100"
                >
                  ›
                </button>
              </div>
              <DayAgenda
                bookings={dayBookings}
                onBookingClick={(b) =>
                  setModal({
                    booking: b,
                    defaults: {
                      pitchId: b.pitchId ?? NO_PITCH,
                      date: b.date,
                      startMin: b.startMin,
                    },
                  })
                }
              />
            </>
          )}

          {viewMode === "week" && (
            <WeekAgenda
              days={weekDays(weekStart)}
              bookings={bookings}
              onBookingClick={(b) =>
                setModal({
                  booking: b,
                  defaults: {
                    pitchId: b.pitchId ?? NO_PITCH,
                    date: b.date,
                    startMin: b.startMin,
                  },
                })
              }
            />
          )}

          {viewMode === "month" && (
            <MonthGrid
              monthAnchor={selectedDate}
              bookings={bookings}
              selectedDate={selectedDate}
              onSelectDay={(date) => {
                setSelectedDate(date);
                setWeekStart(startOfWeek(new Date(date + "T00:00:00")));
                changeView("day");
              }}
            />
          )}
        </div>

        <div className="hidden flex-wrap gap-2 md:flex">
          {pitches.map((p) => {
            const count = bookings.filter((b) => b.pitchId === p.id).length;
            return (
              <button
                key={p.id}
                onClick={() => setActivePitchId(p.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  p.id === activePitchId
                    ? "bg-navy text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {p.name}
                {count > 0 && (
                  <span
                    className={`ml-1.5 text-xs ${p.id === activePitchId ? "text-gold" : "text-slate-400"}`}
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
                ? "bg-navy text-white"
                : "border border-dashed border-slate-400 bg-white text-slate-600 hover:bg-slate-100"
            }`}
            title="Training, away games and anything else that doesn't need a pitch"
          >
            Off-site / no pitch
            {noPitchCount > 0 && (
              <span
                className={`ml-1.5 text-xs ${activePitchId === NO_PITCH ? "text-gold" : "text-slate-400"}`}
              >
                {noPitchCount}
              </span>
            )}
          </button>
        </div>

        <div className="hidden md:block">
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
        </div>

        <div className="hidden flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 md:flex">
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

      {/* Mobile floating action button */}
      <button
        onClick={() => openNewBooking(selectedDate)}
        aria-label="New booking"
        className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-3xl font-bold text-navy shadow-lg transition active:scale-95 md:hidden"
      >
        +
      </button>

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
