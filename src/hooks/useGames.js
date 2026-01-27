// src/hooks/useGames.js
import { useState, useEffect, useCallback } from "react";
import { fetchAllGames } from "../services/espnService";

const POLL_INTERVAL = 30000; // 30 seconds for live updates
const RECENT_GAME_WINDOW = 2 * 60 * 60 * 1000; // 2 hours in ms

/**
 * Estimate how close a game is to ending (higher = closer to end)
 * Used for sorting live games
 */
function getGameProgress(game, sportId) {
  const period = game.status?.period || 0;
  const clock = game.status?.clock || "";

  // Parse clock (formats like "12:34", "5:00", "0.0")
  let clockSeconds = 0;
  if (clock) {
    const parts = clock.split(":").map(Number);
    if (parts.length === 2) {
      clockSeconds = parts[0] * 60 + parts[1];
    } else if (parts.length === 1) {
      clockSeconds = parseFloat(parts[0]) || 0;
    }
  }

  // Calculate progress based on sport
  // Returns 0-100 where 100 is game nearly over
  switch (sportId) {
    case "nfl":
    case "nba": {
      // 4 quarters, 12 min (NFL) or 12 min (NBA)
      const totalPeriods = 4;
      const periodLength = sportId === "nfl" ? 15 * 60 : 12 * 60;
      const elapsedInPeriod = periodLength - clockSeconds;
      const totalElapsed = (period - 1) * periodLength + elapsedInPeriod;
      const totalGame = totalPeriods * periodLength;
      return (totalElapsed / totalGame) * 100;
    }
    case "nhl": {
      // 3 periods, 20 min each
      const periodLength = 20 * 60;
      const elapsedInPeriod = periodLength - clockSeconds;
      const totalElapsed = (period - 1) * periodLength + elapsedInPeriod;
      const totalGame = 3 * periodLength;
      return (totalElapsed / totalGame) * 100;
    }
    case "mlb": {
      // 9 innings, use period as progress
      return (period / 9) * 100;
    }
    case "soccer": {
      // 2 halves, 45 min each
      const halfLength = 45 * 60;
      const elapsedInHalf = halfLength - clockSeconds;
      const totalElapsed = (period - 1) * halfLength + elapsedInHalf;
      return (totalElapsed / (2 * halfLength)) * 100;
    }
    case "ufc": {
      // UFC fights are 3 rounds (5 for championship)
      const totalRounds = 5; // Use 5 as max
      return (period / totalRounds) * 100;
    }
    default:
      return period * 10; // Fallback
  }
}

/**
 * Filter and sort games for display
 * - Excludes final/completed games
 * - Live games first (sorted by closest to ending)
 * - Scheduled games after (sorted by start time)
 */
function filterAndSortGames(games, sportId) {
  // Filter out final games
  const activeGames = games.filter(g => !g.isFinal && g.status?.state !== "final");

  // Separate live and scheduled
  const liveGames = activeGames.filter(g => g.isLive);
  const scheduledGames = activeGames.filter(g => g.isScheduled || g.status?.state === "scheduled");
  const otherGames = activeGames.filter(g => !g.isLive && !g.isScheduled && g.status?.state !== "scheduled");

  // Sort live games by progress (closest to ending first)
  liveGames.sort((a, b) => getGameProgress(b, sportId) - getGameProgress(a, sportId));

  // Sort scheduled games by start time
  scheduledGames.sort((a, b) => new Date(a.date) - new Date(b.date));

  return [...liveGames, ...scheduledGames, ...otherGames];
}

/**
 * Get recently ended games (within the last 2 hours)
 */
function getRecentlyEndedGames(games) {
  const now = Date.now();
  return games
    .filter(g => g.isFinal || g.status?.state === "final")
    .filter(g => {
      // ESPN doesn't give us exact end time, so we use the scheduled start
      // and assume games last ~3 hours for most sports
      const gameDate = new Date(g.date).getTime();
      const estimatedEndTime = gameDate + 3 * 60 * 60 * 1000; // 3 hours after start
      return now - estimatedEndTime < RECENT_GAME_WINDOW;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date)); // Most recent first
}

export function useGames() {
  const [gamesBySport, setGamesBySport] = useState({
    nfl: [],
    nba: [],
    mlb: [],
    nhl: [],
    soccer: [],
    ufc: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchAllGames();
      setGamesBySport(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("Failed to fetch games:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll for updates (only if there are live games)
  useEffect(() => {
    const hasLiveGames = Object.values(gamesBySport).some((games) =>
      games.some((g) => g.isLive)
    );

    if (!hasLiveGames) return;

    const interval = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [gamesBySport, refresh]);

  // Get games for a specific sport
  const getGamesForSport = useCallback(
    (sportId) => {
      return gamesBySport[sportId] || [];
    },
    [gamesBySport]
  );

  // Get a specific game by ID
  const getGameById = useCallback(
    (gameId) => {
      for (const games of Object.values(gamesBySport)) {
        const game = games.find((g) => g.id === gameId);
        if (game) return game;
      }
      return null;
    },
    [gamesBySport]
  );

  // Get all live games across all sports
  const getLiveGames = useCallback(() => {
    const live = [];
    Object.entries(gamesBySport).forEach(([sportId, games]) => {
      games
        .filter((g) => g.isLive)
        .forEach((g) => live.push({ ...g, sportId }));
    });
    return live;
  }, [gamesBySport]);

  // Get active games for a sport (filtered and sorted, no finals)
  const getActiveGames = useCallback(
    (sportId) => {
      const games = gamesBySport[sportId] || [];
      return filterAndSortGames(games, sportId);
    },
    [gamesBySport]
  );

  // Get recently ended games for a sport
  const getRecentGames = useCallback(
    (sportId) => {
      const games = gamesBySport[sportId] || [];
      return getRecentlyEndedGames(games);
    },
    [gamesBySport]
  );

  // Get only LIVE games for a sport (in progress right now)
  const getLiveGamesForSport = useCallback(
    (sportId) => {
      const games = gamesBySport[sportId] || [];
      return games
        .filter((g) => g.isLive)
        .sort((a, b) => getGameProgress(b, sportId) - getGameProgress(a, sportId));
    },
    [gamesBySport]
  );

  // Get only UPCOMING games for a sport (scheduled, not started, not final)
  const getUpcomingGames = useCallback(
    (sportId) => {
      const games = gamesBySport[sportId] || [];
      return games
        .filter((g) => g.isScheduled && !g.isFinal && !g.isLive)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    },
    [gamesBySport]
  );

  return {
    gamesBySport,
    loading,
    error,
    lastUpdated,
    refresh,
    getGamesForSport,
    getGameById,
    getLiveGames,
    getActiveGames,
    getRecentGames,
    getLiveGamesForSport,
    getUpcomingGames,
  };
}

export default useGames;
