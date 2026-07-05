"use client";

import { useEffect, useState } from "react";
import type { BookingWithNames, Pitch, Team } from "@/lib/types";
import { formatMin } from "@/lib/time";

export interface ModalDefaults {
  pitchId: number;
  date: string;
  startMin: number;
}

interface Props {
  pitches: Pitch[];
  teams: Team[];
  bookedBy: string;
  /** Existing booking to edit, or null when creating. */
  booking: BookingWithNames | null;
  defaults: ModalDefaults;
  onClose: () => void;
  onSaved: () => void;
}

const TIME_OPTIONS: number[] = [];
for (let m = 7 * 60; m <= 22 * 60; m += 15) TIME_OPTIONS.push(m);

export default function BookingModal({
  pitches,
  teams,
  bookedBy,
  booking,
  defaults,
  onClose,
  onSaved,
}: Props) {
  // 0 in the select means "no pitch required" (training / away) and is stored as null.
  const [pitchId, setPitchId] = useState(booking ? (booking.pitchId ?? 0) : defaults.pitchId);
  const [teamId, setTeamId] = useState(booking?.teamId ?? teams[0]?.id ?? 0);
  const [type, setType] = useState<"fixture" | "training">(booking?.type ?? "training");
  const [title, setTitle] = useState(booking?.title ?? "");
  const [date, setDate] = useState(booking?.date ?? defaults.date);
  const [startMin, setStartMin] = useState(booking?.startMin ?? defaults.startMin);
  const [endMin, setEndMin] = useState(booking?.endMin ?? defaults.startMin + 90);
  const [error, setError] = useState<string | null>(null);
  const [clashes, setClashes] = useState<BookingWithNames[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setSaving(true);
    setError(null);
    setClashes([]);
    try {
      const payload = {
        pitchId: pitchId === 0 ? null : pitchId,
        teamId,
        type,
        title,
        date,
        startMin,
        endMin,
        bookedBy,
      };
      const res = await fetch(booking ? `/api/bookings/${booking.id}` : "/api/bookings", {
        method: booking ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onSaved();
        return;
      }
      const data = await res.json();
      if (res.status === 409 && data.error === "clash") {
        setClashes(data.clashes);
        setError("This slot clashes with an existing booking on this pitch:");
      } else {
        setError(data.error ?? "Something went wrong");
      }
    } catch {
      setError("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!booking) return;
    if (!confirm("Delete this booking?")) return;
    setDeleting(true);
    await fetch(`/api/bookings/${booking.id}`, { method: "DELETE" });
    onSaved();
  }

  const labelCls = "block text-sm font-medium text-slate-600 mb-1";
  const inputCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-gold focus:outline-none focus:ring-2 focus:ring-accent/40";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold text-navy">
          {booking ? "Edit booking" : "New booking"}
        </h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Team</label>
              <select
                className={inputCls}
                value={teamId}
                onChange={(e) => setTeamId(Number(e.target.value))}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Pitch</label>
              <select
                className={inputCls}
                value={pitchId}
                onChange={(e) => setPitchId(Number(e.target.value))}
              >
                {pitches.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value={0}>No pitch (training / away)</option>
              </select>
            </div>
          </div>

          {pitchId === 0 && (
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
              No pitch needed — this will show on the calendar under &quot;Off-site / no
              pitch&quot; and can never cause a clash.
            </p>
          )}

          <div>
            <label className={labelCls}>Type</label>
            <div className="flex gap-2">
              {(["training", "fixture"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                    type === t
                      ? "border-navy bg-navy text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>
              {type === "fixture" ? "Opposition / match details" : "Notes"} (optional)
            </label>
            <input
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === "fixture" ? "e.g. vs Rovers FC (League)" : "e.g. shooting drills"}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Date</label>
              <input
                type="date"
                className={inputCls}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Start</label>
              <select
                className={inputCls}
                value={startMin}
                onChange={(e) => setStartMin(Number(e.target.value))}
              >
                {TIME_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {formatMin(m)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>End</label>
              <select
                className={inputCls}
                value={endMin}
                onChange={(e) => setEndMin(Number(e.target.value))}
              >
                {TIME_OPTIONS.filter((m) => m > startMin).map((m) => (
                  <option key={m} value={m}>
                    {formatMin(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="font-medium">{error}</p>
              {clashes.map((c) => (
                <p key={c.id} className="mt-1">
                  {c.teamName} — {c.type === "fixture" ? "Fixture" : "Training"},{" "}
                  {formatMin(c.startMin)}–{formatMin(c.endMin)} (booked by {c.bookedBy})
                </p>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {booking ? (
              <button
                type="button"
                onClick={remove}
                disabled={deleting}
                className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || teams.length === 0}
                className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-navy hover:bg-accent disabled:opacity-50"
              >
                {saving ? "Saving…" : booking ? "Save changes" : "Book slot"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
