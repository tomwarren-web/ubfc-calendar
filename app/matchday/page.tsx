"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BookingWithNames } from "@/lib/types";
import type { MatchContacts } from "@/lib/db";
import { formatMin } from "@/lib/time";
import { mailtoDraft, renderConfirmation } from "@/lib/matchday";
import ClubLogo from "@/components/ClubLogo";

interface Entry {
  booking: BookingWithNames;
  contacts: MatchContacts;
  sameDayHomeGames: BookingWithNames[];
}

function niceDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function MatchdayPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/matchday")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function updateContacts(bookingId: number, patch: Partial<MatchContacts>) {
    setEntries((es) =>
      es.map((e) =>
        e.booking.id === bookingId ? { ...e, contacts: { ...e.contacts, ...patch } } : e
      )
    );
  }

  async function save(entry: Entry) {
    await fetch("/api/matchday", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry.contacts),
    });
    setSavedId(entry.booking.id);
    setTimeout(() => setSavedId(null), 2000);
  }

  const inputCls =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-gold focus:outline-none focus:ring-2 focus:ring-accent/40";
  const labelCls = "block text-xs font-medium text-slate-500 mb-1";

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b-4 border-gold bg-navy">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <ClubLogo className="h-10 w-auto" />
            <h1 className="text-lg font-bold text-white">Match confirmations</h1>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-gold/60 px-3 py-1.5 text-sm font-medium text-gold hover:bg-white/10"
          >
            ← Back to calendar
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        <p className="text-sm text-slate-600">
          Home fixtures in the next 28 days. Fill in the referee and opposition contact,
          save, then <strong>Open email draft</strong> — your email app opens with the
          confirmation ready to send. Opposition contacts are remembered for next time.
        </p>

        {!loaded && <p className="text-sm text-slate-500">Loading…</p>}
        {loaded && entries.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-6 text-center text-sm text-slate-500">
            No home fixtures in the next 28 days.
          </p>
        )}

        {entries.map((entry) => {
          const { booking: b, contacts: c } = entry;
          const rendered = renderConfirmation(b, c, entry.sameDayHomeGames);
          const recipients = [c.refereeEmail, c.oppositionEmail].filter((e) => e.trim());
          const draftUrl = mailtoDraft(recipients, rendered.subject, rendered.body);
          const missing = [
            !c.refereeEmail.trim() && "referee email",
            !c.oppositionEmail.trim() && "opposition email",
          ].filter(Boolean);

          return (
            <section
              key={b.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-bold text-navy">
                  {b.teamName} — {b.title ?? "fixture"}
                </h2>
                <span className="text-sm font-semibold text-slate-600">
                  {niceDate(b.date)} · KO {formatMin(b.startMin)} · {b.pitchName}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Referee name</label>
                  <input
                    className={inputCls}
                    value={c.refereeName}
                    onChange={(e) => updateContacts(b.id, { refereeName: e.target.value })}
                    placeholder="e.g. Dominic Giacomelli"
                  />
                </div>
                <div>
                  <label className={labelCls}>Referee email</label>
                  <input
                    className={inputCls}
                    type="email"
                    value={c.refereeEmail}
                    onChange={(e) => updateContacts(b.id, { refereeEmail: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Opposition club</label>
                  <input
                    className={inputCls}
                    value={c.oppositionName}
                    onChange={(e) => updateContacts(b.id, { oppositionName: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>Opposition contact email</label>
                  <input
                    className={inputCls}
                    type="email"
                    value={c.oppositionEmail}
                    onChange={(e) => updateContacts(b.id, { oppositionEmail: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelCls}>League / competition</label>
                  <input
                    className={inputCls}
                    value={c.league}
                    onChange={(e) => updateContacts(b.id, { league: e.target.value })}
                    placeholder="e.g. West Sussex Football League Division 2 North"
                  />
                </div>
                <div>
                  <label className={labelCls}>Extra note (optional, added to the email)</label>
                  <input
                    className={inputCls}
                    value={c.notes}
                    onChange={(e) => updateContacts(b.id, { notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => save(entry)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {savedId === b.id ? "Saved ✓" : "Save details"}
                </button>
                <a
                  href={draftUrl}
                  onClick={() => save(entry)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold ${
                    recipients.length
                      ? "bg-gold text-navy hover:bg-accent"
                      : "pointer-events-none bg-slate-200 text-slate-400"
                  }`}
                >
                  Open email draft →
                </a>
                <button
                  onClick={() => setPreviewId(previewId === b.id ? null : b.id)}
                  className="rounded-lg px-3 py-2 text-sm text-slate-500 underline hover:text-navy"
                >
                  {previewId === b.id ? "Hide preview" : "Preview email"}
                </button>
                {missing.length > 0 && (
                  <span className="text-xs font-medium text-red-600">
                    Missing: {missing.join(", ")}
                  </span>
                )}
              </div>

              {previewId === b.id && (
                <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
                  {`To: ${recipients.join(", ") || "(no recipients yet)"}\nSubject: ${rendered.subject}\n\n${rendered.body}`}
                </pre>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
