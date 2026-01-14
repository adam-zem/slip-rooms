// src/hooks/useGames.js
import { useState, useEffect, useCallback } from "react";
import { fetchAllGames } from "../services/espnService";

const POLL_INTERVAL = 30000; // 30 seconds for live updates

export function useGames() {
  const [gamesBySport, setGamesBySport] = useState({
    nfl: [],
    nba: [],
    mlb: [],
    nhl: [],
    soccer: [],
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

  return {
    gamesBySport,
    loading,
    error,
    lastUpdated,
    refresh,
    getGamesForSport,
    getGameById,
    getLiveGames,
  };
}

export default useGames;
