// Parsing and configuration for FA Full-Time fixture sync.
//
// FA Full-Time has no official API (confirmed via their support forum), so we
// read each team's public displayTeam.html page. The markup is server-rendered
// and stable: fixture rows live in a table, each cell linking to
// /displayFixture.html?id=<fixtureId>, which gives us a durable key.

export interface FullTimeTeamConfig {
  /** Team name exactly as it appears in this app's Teams list */
  appTeam: string;
  /** Public FA Full-Time team page (divisionseason changes every season!) */
  url: string;
  /** Pitch name for home games; away games are booked as off-site */
  homePitch: string;
  /** Slot length booked from kick-off */
  durationMin: number;
}

// One entry per team. When a new season's fixtures are published on
// FA Full-Time, update each team's URL (the divisionseason ID changes).
export const FULLTIME_TEAMS: FullTimeTeamConfig[] = [
  {
    appTeam: "U11's",
    url: "https://fulltime.thefa.com/displayTeam.html?divisionseason=30425424&teamID=836078784",
    homePitch: "7v7 Pitch",
    durationMin: 90,
  },
];

/** Recognises our club's side of a fixture, whatever the age-group suffix. */
export const CLUB_PATTERN = /upper\s*beeding/i;

export interface FullTimeFixture {
  fixtureId: string;
  date: string; // YYYY-MM-DD
  startMin: number;
  homeTeam: string;
  awayTeam: string;
  venue: string | null;
  competition: string | null;
  status: string | null;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parses fixture rows out of a Full-Time fixtures table's HTML. */
export function parseFixtureTable(tableHtml: string): FullTimeFixture[] {
  const fixtures: FullTimeFixture[] = [];
  const rowMatches = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];

  for (const row of rowMatches) {
    if (row.includes("<th")) continue; // header row

    const idMatch = row.match(/displayFixture\.html\?id=(\d+)/);
    const dateMatch = row.match(/(\d{2})\/(\d{2})\/(\d{2})/);
    if (!idMatch || !dateMatch) continue;

    const [, dd, mm, yy] = dateMatch;
    const timeMatch = row.match(/(\d{2}):(\d{2})/);
    const startMin = timeMatch ? Number(timeMatch[1]) * 60 + Number(timeMatch[2]) : 10 * 60;

    // Walk the cells so optional columns (venue, competition, status) land right
    const cells = [...row.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)].map((m) => ({
      attrs: m[1],
      text: stripTags(m[2]),
    }));
    const homeIdx = cells.findIndex((c) => c.attrs.includes("home-team"));
    const awayIdx = cells.findIndex((c) => c.attrs.includes("road-team"));
    if (homeIdx === -1 || awayIdx === -1) continue;

    const statusCell = cells.find((c) => c.attrs.includes("status-notes"));
    // After the away-team cell, "left cell-divider" cells are venue then
    // competition when both exist, or just competition when there's no venue
    // column (competitions are short codes; venues are longer ground names).
    const trailing = cells
      .slice(awayIdx + 1)
      .filter((c) => c.attrs.includes("cell-divider") && c.text.length > 0);
    let venue: string | null = null;
    let competition: string | null = null;
    if (trailing.length >= 2) {
      venue = trailing[0].text;
      competition = trailing[1].text;
    } else if (trailing.length === 1) {
      competition = trailing[0].text;
    }

    fixtures.push({
      fixtureId: idMatch[1],
      date: `20${yy}-${mm}-${dd}`,
      startMin,
      homeTeam: cells[homeIdx].text,
      awayTeam: cells[awayIdx].text,
      venue,
      competition,
      status: statusCell && statusCell.text ? statusCell.text : null,
    });
  }

  return fixtures;
}

/** Extracts the Upcoming Fixtures section of a displayTeam.html page. */
export function parseUpcomingFixtures(pageHtml: string): FullTimeFixture[] {
  const sectionStart = pageHtml.indexOf("Upcoming Fixtures");
  if (sectionStart === -1) {
    throw new Error("page layout changed: no 'Upcoming Fixtures' section found");
  }
  const section = pageHtml.slice(sectionStart);
  const tableEnd = section.indexOf("</table>");
  if (tableEnd === -1 || /no fixtures to show/i.test(section.slice(0, tableEnd === -1 ? 2000 : tableEnd))) {
    return [];
  }
  return parseFixtureTable(section.slice(0, tableEnd + 8));
}
