// src/services/espnService.js

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

const SPORT_ENDPOINTS = {
  nfl: `${ESPN_BASE}/football/nfl/scoreboard`,
  nba: `${ESPN_BASE}/basketball/nba/scoreboard`,
  mlb: `${ESPN_BASE}/baseball/mlb/scoreboard`,
  nhl: `${ESPN_BASE}/hockey/nhl/scoreboard`,
  soccer: `${ESPN_BASE}/soccer/usa.1/scoreboard`, // MLS
};

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
 * Fetch games for a specific sport
 */
export async function fetchGames(sportId) {
  const endpoint = SPORT_ENDPOINTS[sportId];
  if (!endpoint) {
    console.warn(`Unknown sport: ${sportId}`);
    return [];
  }

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }

    const data = await response.json();
    const events = data.events || [];

    return events.map(parseGame);
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
