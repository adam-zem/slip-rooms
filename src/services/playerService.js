// src/services/playerService.js
// Fetches real player/roster data from ESPN API with caching

// Cache for roster data - persists for the session
const rosterCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// ESPN API base URLs by sport
const ESPN_API = {
  nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl",
  nba: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba",
  mlb: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb",
  nhl: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl",
  soccer: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1", // Premier League
};

/**
 * Get cache key for a team roster
 */
function getCacheKey(sport, teamId) {
  return `${sport}_${teamId}`;
}

/**
 * Check if cached data is still valid
 */
function isCacheValid(cacheEntry) {
  return cacheEntry && Date.now() - cacheEntry.timestamp < CACHE_DURATION;
}

/**
 * Fetch roster for a specific team
 */
async function fetchTeamRoster(sport, teamId) {
  const cacheKey = getCacheKey(sport, teamId);
  const cached = rosterCache.get(cacheKey);

  if (isCacheValid(cached)) {
    return cached.data;
  }

  try {
    const baseUrl = ESPN_API[sport?.toLowerCase()] || ESPN_API.nfl;
    const url = `${baseUrl}/teams/${teamId}/roster`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch roster: ${response.status}`);
    }

    const data = await response.json();
    const players = parseRosterData(data, sport);

    // Cache the result
    rosterCache.set(cacheKey, {
      data: players,
      timestamp: Date.now(),
    });

    return players;
  } catch (error) {
    console.error(`Error fetching roster for ${sport} team ${teamId}:`, error);
    return [];
  }
}

/**
 * Parse ESPN roster response into our player format
 */
function parseRosterData(data, sport) {
  const players = [];

  try {
    // ESPN roster data can be in different formats
    const athletes = data.athletes || data.roster || [];

    // Handle grouped roster (by position category)
    if (Array.isArray(athletes) && athletes[0]?.items) {
      athletes.forEach(group => {
        group.items?.forEach(player => {
          players.push(formatPlayer(player, sport));
        });
      });
    }
    // Handle flat roster
    else if (Array.isArray(athletes)) {
      athletes.forEach(player => {
        players.push(formatPlayer(player, sport));
      });
    }
  } catch (error) {
    console.error("Error parsing roster data:", error);
  }

  return players.filter(p => p.name); // Filter out any invalid entries
}

/**
 * Format a single player object
 */
function formatPlayer(player, sport) {
  return {
    id: player.id || player.athlete?.id,
    name: player.fullName || player.displayName || player.athlete?.fullName || player.athlete?.displayName || "",
    position: player.position?.abbreviation || player.position?.name || "",
    team: player.team?.abbreviation || "",
    teamId: player.team?.id || "",
    jersey: player.jersey || "",
    headshot: player.headshot?.href || player.athlete?.headshot?.href || "",
  };
}

/**
 * Try to extract players from game data (competitors have roster info)
 */
async function fetchPlayersFromGame(sport, gameId) {
  try {
    const baseUrl = ESPN_API[sport?.toLowerCase()] || ESPN_API.nfl;
    const url = `${baseUrl}/summary?event=${gameId}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch game: ${response.status}`);
    }

    const data = await response.json();
    const players = [];

    // Extract from boxscore if available
    if (data.boxscore?.players) {
      data.boxscore.players.forEach(teamData => {
        const teamAbbrev = teamData.team?.abbreviation || "";
        teamData.statistics?.forEach(statGroup => {
          statGroup.athletes?.forEach(athlete => {
            if (athlete.athlete) {
              players.push({
                id: athlete.athlete.id,
                name: athlete.athlete.displayName || athlete.athlete.shortName,
                position: athlete.athlete.position?.abbreviation || "",
                team: teamAbbrev,
                teamId: teamData.team?.id,
              });
            }
          });
        });
      });
    }

    // Extract from rosters if available
    if (data.rosters) {
      data.rosters.forEach(roster => {
        const teamAbbrev = roster.team?.abbreviation || "";
        roster.roster?.forEach(player => {
          players.push({
            id: player.id,
            name: player.displayName || player.fullName,
            position: player.position?.abbreviation || "",
            team: teamAbbrev,
            teamId: roster.team?.id,
          });
        });
      });
    }

    // Deduplicate by player ID
    const uniquePlayers = [];
    const seenIds = new Set();
    players.forEach(p => {
      if (p.id && !seenIds.has(p.id)) {
        seenIds.add(p.id);
        uniquePlayers.push(p);
      }
    });

    return uniquePlayers;
  } catch (error) {
    console.error(`Error fetching players from game ${gameId}:`, error);
    return [];
  }
}

/**
 * Get players for a game, filtered by positions
 * This is the main function to use
 */
export async function getPlayersForGame(sport, gameData, positions = []) {
  const cacheKey = `game_${gameData?.id}_${positions.join("_")}`;
  const cached = rosterCache.get(cacheKey);

  if (isCacheValid(cached)) {
    return cached.data;
  }

  let allPlayers = [];

  try {
    // First try to get players from game summary (most relevant players)
    if (gameData?.id) {
      allPlayers = await fetchPlayersFromGame(sport, gameData.id);
    }

    // If that didn't work, try fetching rosters for both teams
    if (allPlayers.length === 0) {
      const awayTeamId = gameData?.away?.id || gameData?.awayTeam?.id;
      const homeTeamId = gameData?.home?.id || gameData?.homeTeam?.id;

      const [awayRoster, homeRoster] = await Promise.all([
        awayTeamId ? fetchTeamRoster(sport, awayTeamId) : Promise.resolve([]),
        homeTeamId ? fetchTeamRoster(sport, homeTeamId) : Promise.resolve([]),
      ]);

      // Add team abbreviations if not present
      const awayAbbrev = gameData?.away?.abbrev || gameData?.awayTeam?.abbreviation || "";
      const homeAbbrev = gameData?.home?.abbrev || gameData?.homeTeam?.abbreviation || "";

      awayRoster.forEach(p => { if (!p.team) p.team = awayAbbrev; });
      homeRoster.forEach(p => { if (!p.team) p.team = homeAbbrev; });

      allPlayers = [...awayRoster, ...homeRoster];
    }

    // Filter by positions if specified
    let filteredPlayers = allPlayers;
    if (positions.length > 0) {
      const posSet = new Set(positions.map(p => p.toUpperCase()));
      filteredPlayers = allPlayers.filter(player => {
        const playerPos = (player.position || "").toUpperCase();
        return posSet.has(playerPos) ||
               positions.some(p => playerPos.includes(p.toUpperCase()));
      });
    }

    // Sort by name for consistent display
    filteredPlayers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    // Cache the filtered result
    rosterCache.set(cacheKey, {
      data: filteredPlayers,
      timestamp: Date.now(),
    });

    return filteredPlayers;
  } catch (error) {
    console.error("Error getting players for game:", error);
    return [];
  }
}

/**
 * Get players filtered by position for a specific category
 */
export async function getPlayersForCategory(sport, gameData, category) {
  const positions = category?.positions || [];
  return getPlayersForGame(sport, gameData, positions);
}

/**
 * Clear the roster cache (useful for testing or forcing refresh)
 */
export function clearRosterCache() {
  rosterCache.clear();
}

/**
 * Get team options for game line bets
 */
export function getTeamsForGame(gameData) {
  const teams = [];

  if (gameData?.away?.abbrev || gameData?.awayTeam?.abbreviation) {
    teams.push({
      name: gameData.away?.name || gameData.awayTeam?.displayName || gameData.away?.abbrev || gameData.awayTeam?.abbreviation,
      abbrev: gameData.away?.abbrev || gameData.awayTeam?.abbreviation,
      isAway: true,
    });
  }

  if (gameData?.home?.abbrev || gameData?.homeTeam?.abbreviation) {
    teams.push({
      name: gameData.home?.name || gameData.homeTeam?.displayName || gameData.home?.abbrev || gameData.homeTeam?.abbreviation,
      abbrev: gameData.home?.abbrev || gameData.homeTeam?.abbreviation,
      isHome: true,
    });
  }

  return teams;
}

export default {
  getPlayersForGame,
  getPlayersForCategory,
  getTeamsForGame,
  clearRosterCache,
};
