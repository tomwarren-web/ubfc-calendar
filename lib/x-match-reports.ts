import {
  enrichMatchReport,
  getMatchReports,
  type MatchReport,
  type MatchReportSection,
} from "./db";

export const X_ACCOUNT_HANDLE = "upperbeedingfc";

const OPPONENT_X_ACCOUNTS: Record<string, string> = {
  ferring: "_FerringFC",
  "brighton electricity": "BrightonLeccyTV",
  southwater: "Southwater_FC",
  rustington: "Rustington_FC",
  "td shipley": "TDShipley_FC",
  "chichester city b": "ChiCityFCB",
  rudgwick: "Rudgwick_FC",
  copthorne: "CopthorneFC",
  "worthing town": "WorthingTownFC",
  bosham: "BoshamFC",
  "asc brighton rangers": "OfficialASCBR",
  alfold: "Alfold_FC",
  storrington: "StorringtonFC",
  hurstpierpoint: "hurstpierpoint1",
};

interface XPost {
  id: string;
  text: string;
  created_at: string;
  account: string;
}

interface RawXPost {
  id: string;
  text: string;
  created_at: string;
}

interface XResponse {
  data?: RawXPost[];
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

function opponentName(report: MatchReport): string {
  return report.homeTeam.toLowerCase().includes("upper beeding") ? report.awayTeam : report.homeTeam;
}

function opponentHandle(report: MatchReport): string | undefined {
  const opponent = opponentName(report).toLowerCase();
  return Object.entries(OPPONENT_X_ACCOUNTS).find(([name]) => opponent.includes(name))?.[1];
}

async function getUserIds(bearerToken: string, handles: string[]): Promise<Map<string, string>> {
  const url = new URL("https://api.x.com/2/users/by");
  url.searchParams.set("usernames", handles.join(","));
  const payload = await xJson<{ data?: Array<{ id: string; username: string }> }>(url.toString(), bearerToken);
  return new Map((payload.data ?? []).map((user) => [user.username.toLowerCase(), user.id]));
}

async function getAccountPosts(
  bearerToken: string,
  account: string,
  userId: string,
  from: string,
  to: string,
): Promise<XPost[]> {
  const posts: XPost[] = [];
  let nextToken: string | undefined;
  for (let page = 0; page < 5; page++) {
    const url = new URL(`https://api.x.com/2/users/${userId}/tweets`);
    url.searchParams.set("start_time", `${from}T00:00:00Z`);
    url.searchParams.set("end_time", `${to}T23:59:59Z`);
    url.searchParams.set("max_results", "100");
    url.searchParams.set("exclude", "retweets,replies");
    url.searchParams.set("tweet.fields", "created_at");
    if (nextToken) url.searchParams.set("pagination_token", nextToken);
    const payload = await xJson<XResponse>(url.toString(), bearerToken);
    posts.push(...(payload.data ?? []).map((post) => ({ ...post, account })));
    nextToken = payload.meta?.next_token;
    if (!nextToken) break;
  }
  return posts;
}

async function getPosts(
  bearerToken: string,
  handles: string[],
  from: string,
  to: string,
): Promise<XPost[]> {
  const userIds = await getUserIds(bearerToken, handles);
  const groups = await Promise.all(handles.map(async (handle) => {
    const userId = userIds.get(handle.toLowerCase());
    return userId ? getAccountPosts(bearerToken, handle, userId, from, to) : [];
  }));
  return groups.flat();
}

function matchWindow(report: MatchReport, post: XPost): boolean {
  const kickoff = new Date(`${report.date}T${String(Math.floor(report.startMin / 60)).padStart(2, "0")}:${String(report.startMin % 60).padStart(2, "0")}:00Z`).getTime();
  const posted = new Date(post.created_at).getTime();
  if (posted < kickoff - 8 * 60 * 60 * 1000 || posted > kickoff + 30 * 60 * 60 * 1000) return false;
  const text = post.text.toLowerCase();
  const opponentWords = opponentName(report).toLowerCase().split(/\W+/).filter((word) => word.length >= 4);
  const isClubAccount = post.account.toLowerCase() === X_ACCOUNT_HANDLE;
  if (isClubAccount) {
    return opponentWords.some((word) => text.includes(word)) || /\b(matchday|team news|lineup|team sheet|starting xi|kick.?off|goal|half.?time|full.?time|result|substitution|ht|ft)\b/i.test(post.text);
  }
  return /\b(upper beeding|beeding|ubfc)\b/i.test(post.text) || /\b(matchday|kick.?off|goal|half.?time|full.?time|result|ht|ft)\b/i.test(post.text);
}

function extractGoalscorers(posts: XPost[]): string[] {
  const names: string[] = [];
  for (const post of posts) {
    const patterns = [
      /\bGOAL(?:\s+\d{1,3}[’']?)?\s*[|:\-–]\s*([A-Z][A-Za-z’'\-]+(?:\s+[A-Z][A-Za-z’'\-]+){0,2})/,
      /\b([A-Z][A-Za-z’'\-]+(?:\s+[A-Z][A-Za-z’'\-]+)?)\s+with\s+(?:the|our)\s+(?:equaliser|goal)/i,
    ];
    for (const pattern of patterns) {
      const match = post.text.match(pattern);
      if (match?.[1]) names.push(match[1].trim());
    }
  }
  return [...new Set(names)];
}

function naturalList(items: string[]): string {
  if (items.length < 2) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function outcomeSentence(report: MatchReport): string {
  const atHome = report.homeTeam.toLowerCase().includes("upper beeding");
  const ubfcScore = atHome ? report.homeScore : report.awayScore;
  const oppositionScore = atHome ? report.awayScore : report.homeScore;
  const opponent = opponentName(report);
  if (ubfcScore > oppositionScore) return `Upper Beeding secured a ${ubfcScore}–${oppositionScore} ${atHome ? "home" : "away"} win over ${opponent}.`;
  if (ubfcScore < oppositionScore) return `Upper Beeding were beaten ${oppositionScore}–${ubfcScore} ${atHome ? "at home by" : "away at"} ${opponent}.`;
  return `Upper Beeding took a point from a ${ubfcScore}–${oppositionScore} draw ${atHome ? "at home to" : "away at"} ${opponent}.`;
}

function substitutionSentences(text: string): string[] {
  const sentences: string[] = [];
  const pattern = /ON:\s*([^\n\r]+)[\s\S]*?OFF:\s*([^\n\r]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) sentences.push(`${match[1].trim()} replaced ${match[2].trim()}.`);
  return sentences;
}

function buildNarrative(report: MatchReport, posts: XPost[]): MatchReportSection[] {
  const scorers = report.goalscorers.length ? report.goalscorers : extractGoalscorers(posts);
  const summary = [
    outcomeSentence(report),
    scorers.length ? `${naturalList(scorers)} ${scorers.length === 1 ? "was" : "were"} on target for Beeding.` : "",
  ].filter(Boolean).join(" ");

  const firstHalf: string[] = [];
  const secondHalf: string[] = [];
  const ordered = [...posts].sort((a, b) => a.created_at.localeCompare(b.created_at));
  let phase: "first" | "second" = "first";
  for (const post of ordered) {
    const text = post.text;
    if (/second half|restart/i.test(text)) phase = "second";
    if (/penalty/i.test(text) && /score|goal/i.test(text)) {
      const opponent = opponentName(report);
      const sentence = /beeding|ubfc/i.test(text)
        ? "Upper Beeding found the net from the penalty spot."
        : `${opponent} opened the scoring from the penalty spot.`;
      firstHalf.push(sentence);
    }
    const halfTime = text.match(/(\d+)\s*[-–]\s*(\d+).*\bHT\b/i);
    if (halfTime) {
      const score = `${halfTime[1]}–${halfTime[2]}`;
      if (/down/i.test(text)) firstHalf.push(`Beeding went into the interval trailing ${score}.`);
      else if (/ahead|up/i.test(text)) firstHalf.push(`Beeding held a ${score} lead at the interval.`);
      else firstHalf.push(`The half-time score was ${score}.`);
      phase = "second";
    }
    if (/equalis/i.test(text)) {
      const scorer = scorers[0] || "Upper Beeding";
      secondHalf.push(`${scorer} brought Beeding level after the restart.`);
    } else if (/\bgoal/i.test(text) && !/penalty/i.test(text) && scorers.length) {
      const sentence = `${scorers[0]} found the net for Beeding.`;
      (phase === "first" ? firstHalf : secondHalf).push(sentence);
    }
    secondHalf.push(...substitutionSentences(text));
  }

  const sections: MatchReportSection[] = [{ heading: "Match summary", body: summary }];
  if (firstHalf.length) sections.push({ heading: "First half", body: [...new Set(firstHalf)].join(" ") });
  if (secondHalf.length) sections.push({ heading: "Second half", body: [...new Set(secondHalf)].join(" ") });
  if (report.lineup.length) {
    const selection = `Upper Beeding's starting XI was ${naturalList(report.lineup)}.${report.substitutes.length ? ` ${naturalList(report.substitutes)} were named among the substitutes.` : ""}`;
    sections.push({ heading: "Team selection", body: selection });
  }
  return sections;
}

export async function enrichReportsFromX(
  bearerToken: string,
  from: string,
  to: string,
): Promise<{ reportsChecked: number; reportsUpdated: number; postsRead: number; accountsRead: number }> {
  const reports = await getMatchReports(from, to);
  const handles = [...new Set([X_ACCOUNT_HANDLE, ...reports.map(opponentHandle).filter((handle): handle is string => Boolean(handle))])];
  const posts = await getPosts(bearerToken, handles, from, to);
  let reportsUpdated = 0;
  for (const report of reports) {
    const relevantHandles = new Set([X_ACCOUNT_HANDLE.toLowerCase(), opponentHandle(report)?.toLowerCase()]);
    const matches = posts.filter((post) => relevantHandles.has(post.account.toLowerCase()) && matchWindow(report, post));
    const goalscorers = report.goalscorers.length ? report.goalscorers : extractGoalscorers(matches);
    await enrichMatchReport(report.sourceRef, {
      goalscorers,
      sourcePosts: matches.map((post) => `https://x.com/${post.account}/status/${post.id}`),
      reportSections: buildNarrative(report, matches),
    });
    reportsUpdated++;
  }
  return { reportsChecked: reports.length, reportsUpdated, postsRead: posts.length, accountsRead: handles.length };
}
