"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Pitch, Team } from "@/lib/types";

export default function SettingsPage() {
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [newPitch, setNewPitch] = useState("");
  const [newTeam, setNewTeam] = useState("");
  const [newColour, setNewColour] = useState("#2563eb");
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    fetch("/api/pitches").then((r) => r.json()).then(setPitches);
    fetch("/api/teams").then((r) => r.json()).then(setTeams);
  }

  useEffect(refresh, []);

  async function addPitch() {
    setError(null);
    const res = await fetch("/api/pitches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newPitch }),
    });
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    setNewPitch("");
    refresh();
  }

  async function addTeam() {
    setError(null);
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTeam, colour: newColour }),
    });
    if (!res.ok) {
      setError((await res.json()).error);
      return;
    }
    setNewTeam("");
    refresh();
  }

  async function removePitch(p: Pitch) {
    if (!confirm(`Delete "${p.name}"? All bookings on this pitch will also be deleted.`)) return;
    await fetch(`/api/pitches/${p.id}`, { method: "DELETE" });
    refresh();
  }

  async function removeTeam(t: Team) {
    if (!confirm(`Delete "${t.name}"? All this team's bookings will also be deleted.`)) return;
    await fetch(`/api/teams/${t.id}`, { method: "DELETE" });
    refresh();
  }

  const inputCls =
    "flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200";
  const addBtnCls =
    "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50";

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-slate-900">⚽ Teams &amp; pitches</h1>
          <Link
            href="/"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Back to calendar
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 font-semibold text-slate-900">Pitches</h2>
          <p className="mb-4 text-sm text-slate-500">
            Clashes are checked per pitch — two teams can never book the same pitch at the same
            time.
          </p>
          <ul className="mb-4 divide-y divide-slate-100">
            {pitches.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-800">{p.name}</span>
                <button
                  onClick={() => removePitch(p)}
                  className="text-xs text-red-500 hover:underline"
                >
                  delete
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder="e.g. Bottom Pitch"
              value={newPitch}
              onChange={(e) => setNewPitch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newPitch.trim() && addPitch()}
            />
            <button onClick={addPitch} disabled={!newPitch.trim()} className={addBtnCls}>
              Add
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-1 font-semibold text-slate-900">Teams</h2>
          <p className="mb-4 text-sm text-slate-500">
            Each team gets a colour so its bookings stand out on the calendar.
          </p>
          <ul className="mb-4 divide-y divide-slate-100">
            {teams.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span className="inline-flex items-center gap-2 text-slate-800">
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-sm"
                    style={{ backgroundColor: t.colour }}
                  />
                  {t.name}
                </span>
                <button
                  onClick={() => removeTeam(t)}
                  className="text-xs text-red-500 hover:underline"
                >
                  delete
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder="e.g. U16s"
              value={newTeam}
              onChange={(e) => setNewTeam(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newTeam.trim() && addTeam()}
            />
            <input
              type="color"
              className="h-9 w-12 cursor-pointer rounded-lg border border-slate-300"
              value={newColour}
              onChange={(e) => setNewColour(e.target.value)}
              title="Team colour"
            />
            <button onClick={addTeam} disabled={!newTeam.trim()} className={addBtnCls}>
              Add
            </button>
          </div>
        </section>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 md:col-span-2">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
