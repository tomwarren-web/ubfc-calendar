// One-shot: trigger a Netlify build of the latest commit (used to release
// deploys that were blocked by the monthly credit ceiling).
import fs from "fs";
import path from "path";
import os from "os";

const configPath = path.join(os.homedir(), "AppData", "Roaming", "netlify", "Config", "config.json");
const token = Object.values(JSON.parse(fs.readFileSync(configPath, "utf8")).users ?? {})[0]?.auth?.token;
const SITE = "d935f138-123c-4691-9687-c120c05ce13e";

const res = await fetch(`https://api.netlify.com/api/v1/sites/${SITE}/builds`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ clear_cache: false }),
});
console.log("trigger build:", res.status, await res.text());
