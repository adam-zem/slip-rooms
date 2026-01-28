// src/services/sportRelevanceService.js
// Dynamically order sports by relevance (live games, today's games, upcoming)

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
 */
function calculateGameStats(games) {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const in48h = new Date();
  in48h.setHours(in48h.getHours() + 48);

  let liveGames = 0;
  let todayGames = 0;
  let next48hGames = 0;

  games.forEach((game) => {
    if (isGameFinal(game)) return;

    if (isGameLive(game)) {
      liveGames++;
      todayGames++;
      next48hGames++;
      return;
    }

    const gameTime = new Date(game.date).getTime();

    if (gameTime >= todayStart.getTime() && gameTime <= todayEnd.getTime()) {
      todayGames++;
      next48hGames++;
    } else if (gameTime <= in48h.getTime()) {
      next48hGames++;
    }
  });

  return { liveGames, todayGames, next48hGames };
}

/**
 * Calculate relevance score
 * Live games are worth the most, then today, then 48h
 */
function calculateRelevanceScore(stats) {
  return stats.liveGames * 1000 + stats.todayGames * 100 + stats.next48hGames * 10;
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

    return {
      ...sport,
      ...stats,
      relevanceScore,
      rooms: [], // Initialize empty rooms array
    };
  });

  // Sort by relevance score (highest first)
  const sorted = sportsWithRelevance.sort((a, b) => b.relevanceScore - a.relevanceScore);

  console.log(
    "[sportRelevance] Sorted sports:",
    sorted.map((s) => `${s.id}: live=${s.liveGames}, today=${s.todayGames}, score=${s.relevanceScore}`)
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
    // Return default order on error
    return SPORT_CONFIGS.map((sport) => ({
      ...sport,
      liveGames: 0,
      todayGames: 0,
      next48hGames: 0,
      relevanceScore: 0,
      rooms: [],
    }));
  }
}

export default {
  getSortedSports,
  getSortedSportsFromData,
};
