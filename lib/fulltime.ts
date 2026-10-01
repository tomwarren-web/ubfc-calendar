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
    // "Upper Beeding" — Southern Combination Football League (2026-27)
    appTeam: "First Team",
    url: "https://fulltime.thefa.com/displayTeam.html?divisionseason=665376135&teamID=449068268",
    homePitch: "Main Pitch",
    durationMin: 120,
  },
  {
    // "Upper Beeding Reserves" — West Sussex Football League (2026-27)
    appTeam: "Reserve Team",
    url: "https://fulltime.thefa.com/displayTeam.html?divisionseason=299191871&teamID=325030964",
    homePitch: "Main Pitch",
    durationMin: 120,
  },
  {
    // "Upper Beeding Sunday" — SSFL cup competitions (2026-27)
    appTeam: "Sunday Team",
    url: "https://fulltime.thefa.com/displayTeam.html?divisionseason=853007003&teamID=648487847",
    homePitch: "Main Pitch",
    durationMin: 120,
  },
  {
    // "Upper Beeding Sunday" — SSFL league division (2026-27). A team can have
    // several FA pages, one per competition; each gets its own config entry.
    appTeam: "Sunday Team",
    url: "https://fulltime.thefa.com/displayTeam.html?divisionseason=691249596&teamID=648487847",
    homePitch: "Main Pitch",
    durationMin: 120,
  },
  {
    // "Upper Beeding U11" — Horsham & District Youth FL, U11 Umbro (2026-27)
    appTeam: "U11's",
    url: "https://fulltime.thefa.com/displayTeam.html?divisionseason=890791379&teamID=714938495",
    homePitch: "7v7 Pitch",
    durationMin: 90,
  },
  {
    // "Upper Beeding U12" — Horsham & District Youth FL, U12A (2026-27)
    appTeam: "U12's",
    url: "https://fulltime.thefa.com/displayTeam.html?divisionseason=179178909&teamID=836078784",
    homePitch: "Main Pitch",
    durationMin: 90,
  },
  {
    // "Upper Beeding U16" — Mid Sussex Youth FL, U16 Division 4 (2026-27)
    appTeam: "U16's",
    url: "https://fulltime.thefa.com/displayTeam.html?divisionseason=167235657&teamID=526717235",
    homePitch: "Main Pitch",
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
  homeScore: number | null;
  awayScore: number | null;
}

export interface FullTimeFixtureDetail {
  lineup: string[];
  substitutes: string[];
  goalscorers: string[];
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
    if (!dateMatch) continue;

    const [, dd, mm, yy] = dateMatch;
    const timeMatch = row.match(/(\d{2}):(\d{2})/);
    const startMin = timeMatch
      ? Number(timeMatch[1]) * 60 + Number(timeMatch[2])
      : 10 * 60;

    // Walk the cells so optional columns (venue, competition, status) land right
    const cells = [...row.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)].map(
      (m) => ({
        attrs: m[1],
        text: stripTags(m[2]),
      }),
    );
    const homeIdx = cells.findIndex((c) => c.attrs.includes("home-team"));
    const awayIdx = cells.findIndex((c) => c.attrs.includes("road-team"));
    if (homeIdx === -1 || awayIdx === -1) continue;

    const statusCell = cells.find((c) => c.attrs.includes("status-notes"));
    const scoreText = cells
      .slice(homeIdx + 1, awayIdx)
      .map((cell) => cell.text)
      .join(" ");
    const scoreMatch = scoreText.match(/(\d+)\s*[-–]\s*(\d+)/);
    // After the away-team cell, "left cell-divider" cells are venue then
    // competition when both exist, or just competition when there's no venue
    // column (competitions are short codes; venues are longer ground names).
    // (team pages mark these cells "left", league pages "left cell-divider")
    const trailing = cells
      .slice(awayIdx + 1)
      .filter((c) => c.attrs.includes("left") && c.text.length > 0);
    let venue: string | null = null;
    let competition: string | null = null;
    if (trailing.length >= 2) {
      venue = trailing[0].text;
      competition = trailing[1].text;
    } else if (trailing.length === 1) {
      competition = trailing[0].text;
    }

    // County Cup rows carry no fixture link, so synthesise a stable key from
    // the date and team names instead.
    const slug = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 30);
    const fixtureId =
      idMatch?.[1] ??
      `x-20${yy}${mm}${dd}-${slug(cells[homeIdx].text)}-${slug(cells[awayIdx].text)}`;

    fixtures.push({
      fixtureId,
      date: `20${yy}-${mm}-${dd}`,
      startMin,
      homeTeam: cells[homeIdx].text,
      awayTeam: cells[awayIdx].text,
      venue,
      competition,
      status: statusCell && statusCell.text ? statusCell.text : null,
      homeScore: scoreMatch ? Number(scoreMatch[1]) : null,
      awayScore: scoreMatch ? Number(scoreMatch[2]) : null,
    });
  }

  return fixtures;
}

/** Extracts the Upcoming Fixtures section of a displayTeam.html page. */
export function parseUpcomingFixtures(pageHtml: string): FullTimeFixture[] {
  const sectionStart = pageHtml.indexOf("Upcoming Fixtures");
  if (sectionStart === -1) {
    throw new Error(
      "page layout changed: no 'Upcoming Fixtures' section found",
    );
  }
  const section = pageHtml.slice(sectionStart);
  const tableEnd = section.indexOf("</table>");
  if (
    tableEnd === -1 ||
    /no fixtures to show/i.test(
      section.slice(0, tableEnd === -1 ? 2000 : tableEnd),
    )
  ) {
    return [];
  }
  return parseFixtureTable(section.slice(0, tableEnd + 8));
}

/** Finds completed fixtures across the page's results tables. */
export function parseResults(pageHtml: string): FullTimeFixture[] {
  const tables = pageHtml.match(/<table[^>]*>[\s\S]*?<\/table>/gi) ?? [];
  const results = tables
    .flatMap(parseFixtureTable)
    .filter(
      (fixture) => fixture.homeScore !== null && fixture.awayScore !== null,
    );
  return [
    ...new Map(results.map((fixture) => [fixture.fixtureId, fixture])).values(),
  ];
}

function playerNames(section: string): string[] {
  return [...section.matchAll(/class=["'][^"']*\bname\b[^"']*["'][^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean);
}

/** Parses the selected club side of a public displayFixture.html page. */
export function parseFixtureDetail(pageHtml: string, clubIsHome: boolean): FullTimeFixtureDetail {
  const sideClass = clubIsHome ? "home-team" : "road-team";
  const statisticsStart = pageHtml.search(/class=["'][^"']*\bfixture-lineup-statistics\b/i);
  const statistics = statisticsStart >= 0 ? pageHtml.slice(statisticsStart) : pageHtml;
  const sideStart = statistics.search(new RegExp(`class=["'][^"']*\\b${sideClass}\\b`, "i"));
  if (sideStart === -1) return { lineup: [], substitutes: [], goalscorers: [] };
  const remainder = statistics.slice(sideStart);
  const nextSide = clubIsHome
    ? remainder.slice(1).search(/class=["'][^"']*\broad-team\b/i)
    : remainder.search(/<h2[^>]*>\s*Additional Stats/i);
  const side = nextSide >= 0 ? remainder.slice(0, clubIsHome ? nextSide + 1 : nextSide) : remainder;
  const startersStart = side.search(/class=["'][^"']*\bstarters\b/i);
  const subsStart = side.search(/class=["'][^"']*\bsubs\b/i);
  const starters = startersStart >= 0 ? side.slice(startersStart, subsStart >= 0 ? subsStart : undefined) : "";
  const substitutes = subsStart >= 0 ? side.slice(subsStart) : "";
  const goalscorers: string[] = [];
  const playerBlocks = starters.match(/class=["'][^"']*\bplayer\b[^"']*["'][\s\S]*?(?=class=["'][^"']*\bplayer\b|$)/gi) ?? [];
  for (const block of playerBlocks) {
    if (!/ft-icon\s+ball/i.test(block)) continue;
    const name = playerNames(block)[0];
    if (name) goalscorers.push(name);
  }
  return {
    lineup: playerNames(starters),
    substitutes: playerNames(substitutes),
    goalscorers: [...new Set(goalscorers)],
  };
}
