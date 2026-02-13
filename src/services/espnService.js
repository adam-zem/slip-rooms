// src/services/espnService.js

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

const SPORT_ENDPOINTS = {
  nfl: `${ESPN_BASE}/football/nfl/scoreboard`,
  nba: `${ESPN_BASE}/basketball/nba/scoreboard`,
  mlb: `${ESPN_BASE}/baseball/mlb/scoreboard`,
  nhl: `${ESPN_BASE}/hockey/nhl/scoreboard`,
  soccer: `${ESPN_BASE}/soccer/usa.1/scoreboard`, // MLS
  ufc: `${ESPN_BASE}/mma/ufc/scoreboard`, // UFC
};

// Individual sports (non-team based)
const INDIVIDUAL_SPORTS = ["ufc"];

// How many days ahead to fetch upcoming games (14 days to capture Super Bowl, etc.)
const DAYS_AHEAD = 14;

/**
 * Format date as YYYYMMDD for ESPN API
 */
function formatDateForAPI(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Get date range string for ESPN API (YYYYMMDD-YYYYMMDD)
 */
function getDateRange(daysAhead = DAYS_AHEAD) {
  const today = new Date();
  const endDate = new Date();
  endDate.setDate(today.getDate() + daysAhead);
  return `${formatDateForAPI(today)}-${formatDateForAPI(endDate)}`;
}

// Season type IDs from ESPN API
// 1 = Preseason/Spring Training
// 2 = Regular Season
// 3 = Postseason
// 4 = Offseason
const SEASON_TYPES = {
  PRESEASON: 1,
  REGULAR: 2,
  POSTSEASON: 3,
  OFFSEASON: 4,
};

/**
 * Check if a game should be shown based on sport and season type
 * Filters out preseason/exhibition games that people don't bet on
 */
function shouldShowGame(event, sportId) {
  const seasonType = event.season?.type;
  const seasonSlug = event.season?.slug || "";
  const competitionType = event.competitions?.[0]?.type?.abbreviation || "";
  const gameName = (event.name || event.shortName || "").toLowerCase();

  // Sport-specific filtering
  switch (sportId) {
    case "mlb":
      // Hide ALL spring training and exhibition games
      if (seasonType === SEASON_TYPES.PRESEASON) return false;
      if (seasonSlug === "preseason") return false;
      if (competitionType === "EXH") return false;
      break;

    case "nfl":
      // Hide preseason games (Hall of Fame game, preseason weeks)
      if (seasonType === SEASON_TYPES.PRESEASON) return false;
      if (seasonSlug === "preseason") return false;
      // FILTER OUT PRO BOWL - it's an all-star exhibition game
      if (gameName.includes("pro bowl")) return false;
      if (gameName.includes("afc vs nfc") || gameName.includes("nfc vs afc")) return false;
      break;

    case "nba":
      // Hide preseason games
      if (seasonType === SEASON_TYPES.PRESEASON) return false;
      if (seasonSlug === "preseason") return false;
      break;

    case "nhl":
      // Hide preseason games
      if (seasonType === SEASON_TYPES.PRESEASON) return false;
      if (seasonSlug === "preseason") return false;
      break;

    case "soccer":
      // Show all soccer - leagues handle their own scheduling
      return true;

    case "ufc":
      // Show all UFC events
      return true;

    default:
      break;
  }

  // Default: show if we couldn't determine otherwise
  return true;
}

/**
 * Parse ESPN competitor data into a simpler team object
 */
function parseTeam(competitor) {
  const team = competitor.team || {};
  return {
    id: team.id,
    name: team.displayName || team.name || "TBD",
    abbreviation: team.abbreviation || "TBD",
    logo: team.logo,
    score: parseInt(competitor.score, 10) || 0,
    isHome: competitor.homeAway === "home",
    winner: competitor.winner || false,
    linescores: (competitor.linescores || []).map((ls) => ({
      period: ls.period,
      value: parseInt(ls.value, 10) || 0,
    })),
  };
}

/**
 * Parse UFC event data - returns an ARRAY of fights (each fight is separate like an NFL game)
 * Each fight becomes its own "game" that users can bet on individually
 */
function parseUFCEvent(event) {
  const competitions = event.competitions || [];
  const eventName = event.shortName || event.name;
  const eventDate = event.date;
  const fights = [];

  const parseFighter = (c) => {
    const athlete = c.athlete || {};
    const record = c.records?.find(r => r.type === "total")?.summary || "";
    return {
      id: c.id || athlete.id,
      name: athlete.displayName || athlete.fullName || "TBD",
      shortName: athlete.shortName || athlete.displayName || "TBD",
      record: record,
      winner: c.winner || false,
      headshot: athlete.headshot?.href || null,
      country: athlete.flag?.alt || "",
    };
  };

  // Each competition (fight) becomes its own separate game entry
  for (const competition of competitions) {
    const competitors = competition.competitors || [];
    if (competitors.length >= 2) {
      const fighter1 = parseFighter(competitors[0]);
      const fighter2 = parseFighter(competitors[1]);
      const weightClass = competition.type?.abbreviation || competition.type?.text || "";

      // Determine fight state from competition status
      const compStatus = competition.status || {};
      const compStatusType = compStatus.type || {};
      const statusId = parseInt(compStatusType.id, 10);
      let gameState = "scheduled";
      if (statusId === 1) gameState = "scheduled";
      else if (statusId === 2 || statusId === 22 || statusId === 23) gameState = "live";
      else if (statusId === 3) gameState = "final";
      else if (statusId === 5 || statusId === 6) gameState = "postponed";

      fights.push({
        id: competition.id,
        uid: competition.uid,
        name: `${fighter1.name} vs ${fighter2.name}`,
        shortName: `${fighter1.shortName} vs ${fighter2.shortName}`,
        date: competition.date || eventDate,
        venue: competition.venue?.fullName || "",
        eventName: eventName, // Parent event name (e.g., "UFC 324")

        // Fight-specific data (similar to team sports structure)
        fighter1: fighter1,
        fighter2: fighter2,
        weightClass: weightClass,

        // For compatibility with team sport display
        awayTeam: {
          id: fighter1.id,
          name: fighter1.name,
          abbreviation: fighter1.shortName,
          logo: fighter1.headshot,
          score: fighter1.winner ? "W" : "",
        },
        homeTeam: {
          id: fighter2.id,
          name: fighter2.name,
          abbreviation: fighter2.shortName,
          logo: fighter2.headshot,
          score: fighter2.winner ? "W" : "",
        },

        status: {
          state: gameState,
          period: compStatus.period || 0,
          clock: compStatus.displayClock || "",
          detail: compStatusType.detail || compStatusType.description || "",
          description: compStatusType.description || "",
        },

        isLive: gameState === "live",
        isFinal: gameState === "final",
        isScheduled: gameState === "scheduled",

        // Mark as UFC fight for special rendering
        sportType: "ufc",
        isFight: true,
      });
    }
  }

  return fights;
}

/**
 * Parse ESPN event/game data into a simpler game object
 */
function parseGame(event) {
  const competition = event.competitions?.[0] || {};
  const status = event.status || {};
  const statusType = status.type || {};

  // Get home and away teams
  const competitors = competition.competitors || [];
  const homeTeam = competitors.find((c) => c.homeAway === "home");
  const awayTeam = competitors.find((c) => c.homeAway === "away");

  // Determine game state
  const statusId = parseInt(statusType.id, 10);
  let gameState = "scheduled"; // default
  if (statusId === 1) gameState = "scheduled";
  else if (statusId === 2 || statusId === 22 || statusId === 23) gameState = "live";
  else if (statusId === 3) gameState = "final";
  else if (statusId === 5 || statusId === 6) gameState = "postponed";

  return {
    id: event.id,
    uid: event.uid,
    name: event.name,
    shortName: event.shortName,
    date: event.date,
    venue: competition.venue?.fullName || "",

    homeTeam: homeTeam ? parseTeam(homeTeam) : null,
    awayTeam: awayTeam ? parseTeam(awayTeam) : null,

    status: {
      state: gameState,
      period: status.period || 0,
      clock: status.displayClock || "",
      detail: statusType.detail || statusType.description || "",
      description: statusType.description || "",
    },

    // For live games
    isLive: gameState === "live",
    isFinal: gameState === "final",
    isScheduled: gameState === "scheduled",
  };
}

/**
 * Fetch games for a specific sport (includes next 7 days)
 */
export async function fetchGames(sportId) {
  const baseEndpoint = SPORT_ENDPOINTS[sportId];
  if (!baseEndpoint) {
    console.warn(`Unknown sport: ${sportId}`);
    return [];
  }

  // Add date range to get upcoming games
  const dateRange = getDateRange();
  const endpoint = `${baseEndpoint}?dates=${dateRange}`;

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }

    const data = await response.json();
    const events = data.events || [];

    // Filter out preseason/exhibition games, then parse with appropriate parser
    const filteredEvents = events.filter((event) => shouldShowGame(event, sportId));

    // Use sport-specific parsers for individual sports
    if (sportId === "ufc") {
      // UFC: parseUFCEvent returns an array of fights per event, so flatten them
      return filteredEvents.flatMap(parseUFCEvent);
    }

    // Default team sport parser
    return filteredEvents.map(parseGame);
  } catch (error) {
    console.error(`Failed to fetch ${sportId} games:`, error);
    return [];
  }
}

/**
 * Fetch games for all sports
 */
export async function fetchAllGames() {
  const sportIds = Object.keys(SPORT_ENDPOINTS);

  const results = await Promise.all(
    sportIds.map(async (sportId) => {
      const games = await fetchGames(sportId);
      return { sportId, games };
    })
  );

  // Return as an object keyed by sport
  const gamesBySport = {};
  results.forEach(({ sportId, games }) => {
    gamesBySport[sportId] = games;
  });

  return gamesBySport;
}

/**
 * Get period label based on sport
 */
export function getPeriodLabel(sportId, period) {
  if (!period) return "";

  switch (sportId) {
    case "nfl":
    case "nba":
      return `Q${period}`;
    case "nhl":
      return `P${period}`;
    case "mlb":
      return period <= 9 ? `${period}${getOrdinalSuffix(period)}` : `${period}th`;
    case "soccer":
      return period === 1 ? "1H" : "2H";
    case "ufc":
      return `Round ${period}`;
    default:
      return `${period}`;
  }
}

function getOrdinalSuffix(n) {
  if (n === 1) return "st";
  if (n === 2) return "nd";
  if (n === 3) return "rd";
  return "th";
}

export default {
  fetchGames,
  fetchAllGames,
  getPeriodLabel,
};
