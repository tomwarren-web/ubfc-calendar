import { enrichMatchReport, getMatchReports, type MatchReport } from "./db";

export const X_ACCOUNT_HANDLE = "upperbeedingfc";

interface XPost {
  id: string;
  text: string;
  created_at: string;
}

interface XResponse {
  data?: XPost[];
  meta?: { next_token?: string };
}

async function xJson<T>(url: string, bearerToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${bearerToken}`, Accept: "application/json" },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`X API returned ${response.status}: ${detail.slice(0, 300)}`);
  }
  return (await response.json()) as T;
}

async function getUserId(bearerToken: string): Promise<string> {
  const payload = await xJson<{ data?: { id?: string } }>(
    `https://api.x.com/2/users/by/username/${X_ACCOUNT_HANDLE}`,
    bearerToken,
  );
  if (!payload.data?.id) throw new Error(`X account @${X_ACCOUNT_HANDLE} was not found`);
  return payload.data.id;
}

async function getPosts(bearerToken: string, from: string, to: string): Promise<XPost[]> {
  const userId = await getUserId(bearerToken);
  const posts: XPost[] = [];
  let nextToken: string | undefined;
  for (let page = 0; page < 10; page++) {
    const url = new URL(`https://api.x.com/2/users/${userId}/tweets`);
    url.searchParams.set("start_time", `${from}T00:00:00Z`);
    url.searchParams.set("end_time", `${to}T23:59:59Z`);
    url.searchParams.set("max_results", "100");
    url.searchParams.set("exclude", "retweets,replies");
    url.searchParams.set("tweet.fields", "created_at");
    if (nextToken) url.searchParams.set("pagination_token", nextToken);
    const payload = await xJson<XResponse>(url.toString(), bearerToken);
    posts.push(...(payload.data ?? []));
    nextToken = payload.meta?.next_token;
    if (!nextToken) break;
  }
  return posts;
}

function matchWindow(report: MatchReport, post: XPost): boolean {
  const kickoff = new Date(`${report.date}T${String(Math.floor(report.startMin / 60)).padStart(2, "0")}:${String(report.startMin % 60).padStart(2, "0")}:00Z`).getTime();
  const posted = new Date(post.created_at).getTime();
  if (posted < kickoff - 6 * 60 * 60 * 1000 || posted > kickoff + 36 * 60 * 60 * 1000) return false;
  const opponent = (report.homeTeam.toLowerCase().includes("upper beeding") ? report.awayTeam : report.homeTeam).toLowerCase();
  const words = opponent.split(/\W+/).filter((word) => word.length >= 4);
  const text = post.text.toLowerCase();
  return words.some((word) => text.includes(word)) || /\b(lineup|team sheet|starting xi|goal|half.?time|full.?time|result|ft)\b/i.test(post.text);
}

function extractGoalscorers(posts: XPost[]): string[] {
  const names: string[] = [];
  for (const post of posts) {
    const match = post.text.match(/\bGOAL(?:\s+\d{1,3}[’']?)?\s*[|:\-–]\s*([A-Z][A-Za-z’'\-]+(?:\s+[A-Z][A-Za-z’'\-]+){0,2})/);
    if (match?.[1]) names.push(match[1].trim());
  }
  return [...new Set(names)];
}

export async function enrichReportsFromX(
  bearerToken: string,
  from: string,
  to: string,
): Promise<{ reportsChecked: number; reportsUpdated: number; postsRead: number }> {
  const [reports, posts] = await Promise.all([getMatchReports(from, to), getPosts(bearerToken, from, to)]);
  let reportsUpdated = 0;
  for (const report of reports) {
    const matches = posts.filter((post) => matchWindow(report, post));
    if (!matches.length) continue;
    await enrichMatchReport(report.sourceRef, {
      goalscorers: extractGoalscorers(matches),
      sourcePosts: matches.map((post) => `https://x.com/${X_ACCOUNT_HANDLE}/status/${post.id}`),
    });
    reportsUpdated++;
  }
  return { reportsChecked: reports.length, reportsUpdated, postsRead: posts.length };
}
