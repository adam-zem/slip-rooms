// src/services/espnService.js

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

const SPORT_ENDPOINTS = {
  nfl: `${ESPN_BASE}/football/nfl/scoreboard`,
  nba: `${ESPN_BASE}/basketball/nba/scoreboard`,
  mlb: `${ESPN_BASE}/baseball/mlb/scoreboard`,
  nhl: `${ESPN_BASE}/hockey/nhl/scoreboard`,
  soccer: `${ESPN_BASE}/soccer/usa.1/scoreboard`, // MLS
};

// How many days ahead to fetch upcoming games
const DAYS_AHEAD = 7;

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

  // Always show regular season and postseason
  if (seasonType === SEASON_TYPES.REGULAR || seasonType === SEASON_TYPES.POSTSEASON) {
    return true;
  }

  // Sport-specific preseason filtering
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

    // Filter out preseason/exhibition games, then parse
    return events
      .filter((event) => shouldShowGame(event, sportId))
      .map(parseGame);
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
