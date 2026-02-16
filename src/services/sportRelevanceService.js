// src/services/sportRelevanceService.js
// Dynamically order sports by relevance (live games, today's games, upcoming)
// OUT OF SEASON sports go to the bottom of the list

import { fetchAllGames } from "./espnService";

// Sport configurations
const SPORT_CONFIGS = [
  { id: "nfl", label: "NFL" },
  { id: "nba", label: "NBA" },
  { id: "mlb", label: "MLB" },
  { id: "nhl", label: "NHL" },
  { id: "soccer", label: "Soccer" },
  { id: "ufc", label: "UFC" },
];

/**
 * Check if a game is live
 */
function isGameLive(game) {
  return game.isLive === true;
}

/**
 * Check if a game is final/finished
 */
function isGameFinal(game) {
  return game.isFinal === true || game.status?.state === "final";
}

/**
 * Calculate relevance stats for games
 * Now tracks weekGames (7 days) for offseason detection
 */
function calculateGameStats(games) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);

  let liveGames = 0;
  let todayGames = 0;
  let weekGames = 0;

  games.forEach((game) => {
    if (isGameFinal(game)) return;

    if (isGameLive(game)) {
      liveGames++;
      todayGames++;
      weekGames++;
      return;
    }

    const gameTime = new Date(game.date).getTime();

    // Today's games (scheduled, not started yet)
    if (gameTime >= todayStart.getTime() && gameTime <= todayEnd.getTime()) {
      todayGames++;
      weekGames++;
    }
    // This week's games (next 7 days)
    else if (gameTime > todayEnd.getTime() && gameTime <= weekEnd.getTime()) {
      weekGames++;
    }
  });

  return { liveGames, todayGames, weekGames };
}

/**
 * Calculate relevance score
 * Live games = 100 points each (highest priority)
 * Today's games = 10 points each
 * Week's games = 1 point each
 */
function calculateRelevanceScore(stats) {
  return stats.liveGames * 100 + stats.todayGames * 10 + stats.weekGames * 1;
}

/**
 * Get sports sorted by relevance using existing game data
 * @param {Object} gamesBySport - Object with sport IDs as keys and game arrays as values
 * @returns {Array} - Sorted array of sport configs with relevance data
 */
export function getSortedSportsFromData(gamesBySport) {
  const sportsWithRelevance = SPORT_CONFIGS.map((sport) => {
    const games = gamesBySport[sport.id] || [];
    const stats = calculateGameStats(games);
    const relevanceScore = calculateRelevanceScore(stats);

    // Sport is "offseason" if no games in the next 7 days
    const isOffseason = stats.weekGames === 0;

    return {
      ...sport,
      ...stats,
      relevanceScore,
      isOffseason,
      rooms: [], // Initialize empty rooms array
    };
  });

  // Sort by relevance score (highest first)
  // Offseason sports (no games in next 7 days) go to the bottom
  const sorted = sportsWithRelevance.sort((a, b) => {
    // First, sort by offseason status (in-season first)
    if (a.isOffseason && !b.isOffseason) return 1;
    if (!a.isOffseason && b.isOffseason) return -1;
    // Then by relevance score
    return b.relevanceScore - a.relevanceScore;
  });

  console.log(
    "[sportRelevance] Sorted sports:",
    sorted.map((s) => `${s.id}(${s.relevanceScore}${s.isOffseason ? " OFF" : ""})`)
  );

  return sorted;
}

/**
 * Get sports sorted by relevance by fetching fresh game data
 * Use this if you don't already have game data available
 */
export async function getSortedSports() {
  try {
    console.log("[sportRelevance] Fetching games for all sports...");
    const gamesBySport = await fetchAllGames();
    return getSortedSportsFromData(gamesBySport);
  } catch (error) {
    console.error("[sportRelevance] Error fetching games:", error);
    // Return default order on error - assume all are offseason
    return SPORT_CONFIGS.map((sport) => ({
      ...sport,
      liveGames: 0,
      todayGames: 0,
      weekGames: 0,
      relevanceScore: 0,
      isOffseason: true,
      rooms: [],
    }));
  }
}

export default {
  getSortedSports,
  getSortedSportsFromData,
};
