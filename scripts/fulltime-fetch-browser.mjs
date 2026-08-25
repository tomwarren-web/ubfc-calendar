// UBFC Calendar — FA Full-Time fetcher (real-browser edition)
//
// Aug 2026: the FA put fulltime.thefa.com behind Cloudflare bot protection.
// curl/node/headless browsers all get 403; only a real browser passes. This
// script drives the locally-installed Edge (headed, off-screen) via
// playwright-core with a persistent profile so the Cloudflare clearance
// cookie survives between runs, extracts each team's "Upcoming Fixtures"
// section, and posts the HTML to the calendar's sync endpoint.
//
// Run from the repo root (needs node_modules): node scripts/fulltime-fetch-browser.mjs

import { chromium } from "playwright-core";
import fs from "fs";
import path from "path";
import os from "os";

const SITE = "https://ubfc-calendar.netlify.app";
const secret = fs
  .readFileSync(path.join(os.homedir(), ".ubfc", "sync-secret.txt"), "utf8")
  .trim();

const config = await (await fetch(`${SITE}/api/fulltime-sync?key=${secret}`)).json();
console.log(`Teams configured: ${config.length}`);

const profileDir = path.join(os.homedir(), ".ubfc", "edge-profile");
const context = await chromium.launchPersistentContext(profileDir, {
  channel: "msedge",
  headless: false, // headless is fingerprinted and blocked; headed passes
  viewport: { width: 1200, height: 900 },
  args: ["--window-position=-2400,0"], // keep the window off-screen
});

const pages = [];
try {
  const page = await context.newPage();
  for (const team of config) {
    try {
      await page.goto(team.url, { waitUntil: "domcontentloaded", timeout: 45000 });
      // Give a Cloudflare managed challenge time to auto-pass if one appears
      await page
        .waitForSelector("text=Upcoming Fixtures", { timeout: 30000 })
        .catch(() => null);
      const html = await page.content();
      if (!html.includes("Upcoming Fixtures")) {
        console.warn(`WARN: ${team.appTeam}: page did not render fixtures (blocked?)`);
        continue;
      }
      const start = html.indexOf("Upcoming Fixtures");
      const end = html.indexOf("</table>", start);
      pages.push({
        appTeam: team.appTeam,
        html: html.slice(start, end === -1 ? start + 2000 : end + 8),
      });
      console.log(`Fetched: ${team.appTeam}`);
    } catch (err) {
      console.warn(`WARN: ${team.appTeam}: ${err.message}`);
    }
  }
} finally {
  await context.close();
}

const res = await fetch(`${SITE}/api/fulltime-sync`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-sync-key": secret },
  body: JSON.stringify({ pages }),
});
const report = await res.json();
console.log(JSON.stringify(report, null, 2));
if ((report.errors ?? []).length > 0) process.exit(1);
