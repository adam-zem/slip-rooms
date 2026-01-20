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
 * Position config - which stats category to use and whether to limit (single player positions)
 * For multi-player positions, show ALL healthy players sorted by stats
 */
const POSITION_CONFIG = {
  QB: { category: "passingLeader", singlePlayer: true },  // Only show 1 healthy QB
  RB: { category: "rushingLeader", singlePlayer: false }, // Show all RBs sorted by rushing yards
  WR: { category: "receivingLeader", singlePlayer: false }, // Show all WRs sorted by receiving yards
  TE: { category: "receivingLeader", singlePlayer: false }, // Show all TEs sorted by receiving yards
  K: { category: null, singlePlayer: true },
  // NBA
  G: { category: null, singlePlayer: false },
  F: { category: null, singlePlayer: false },
  C: { category: null, singlePlayer: false },
  DEFAULT: { category: null, singlePlayer: false },
};

/**
 * Injury statuses that mean player is OUT and should be filtered
 */
const INJURED_STATUSES = ["Out", "Injured Reserve", "IR", "Doubtful", "Suspended", "Physically Unable to Perform", "PUP"];
const INJURED_ABBREVIATIONS = ["O", "IR", "D", "SUSP", "PUP"];

/**
 * Fetch team leaders (stats leaders) - this shows who's actually PLAYING
 * Much more accurate than depth charts for identifying starters
 */
async function fetchTeamLeaders(sport, teamId) {
  const cacheKey = `leaders_${sport}_${teamId}`;
  const cached = rosterCache.get(cacheKey);

  if (isCacheValid(cached)) {
    return cached.data;
  }

  try {
    // Use ESPN core API for team leaders - type 2 = regular season, 3 = postseason
    // Try postseason first (current), fall back to regular season
    let url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/types/3/teams/${teamId}/leaders`;

    console.log("[PlayerService] Fetching team leaders:", url);
    let response = await fetch(url);

    // If postseason fails, try regular season
    if (!response.ok) {
      url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/types/2/teams/${teamId}/leaders`;
      console.log("[PlayerService] Trying regular season leaders:", url);
      response = await fetch(url);
    }

    if (!response.ok) {
      console.log("[PlayerService] Leaders not available for team", teamId);
      return null;
    }

    const data = await response.json();
    const leaders = {
      passingLeader: [],
      rushingLeader: [],
      receivingLeader: [],
    };

    // Parse categories
    if (data.categories) {
      for (const cat of data.categories) {
        const catName = cat.name;
        if (!leaders[catName]) continue;

        // Get athlete refs from leaders
        for (const leader of (cat.leaders || [])) {
          const athleteRef = leader.athlete?.$ref;
          if (athleteRef) {
            // Extract athlete ID from ref URL
            const idMatch = athleteRef.match(/athletes\/(\d+)/);
            if (idMatch) {
              leaders[catName].push({
                id: idMatch[1],
                ref: athleteRef,
                value: leader.value || 0,
              });
            }
          }
        }
      }
    }

    // Cache the result
    rosterCache.set(cacheKey, {
      data: leaders,
      timestamp: Date.now(),
    });

    console.log("[PlayerService] Parsed team leaders for team", teamId,
      "- passing:", leaders.passingLeader.length,
      "rushing:", leaders.rushingLeader.length,
      "receiving:", leaders.receivingLeader.length);

    return leaders;
  } catch (error) {
    console.error(`Error fetching leaders for team ${teamId}:`, error);
    return null;
  }
}

/**
 * Check if an athlete is injured (Out, IR, etc.)
 * ESPN returns injury data inline in the athlete response, so we check that first
 */
function checkAthleteInjury(athleteId, injuries) {
  if (!injuries || injuries.length === 0) return false;

  try {
    // Check the most recent injury - ESPN includes full data inline
    const injury = injuries[0];
    if (!injury) return false;

    const status = injury.status || "";
    const abbrev = injury.type?.abbreviation || "";

    const isOut = INJURED_STATUSES.some(s => status.toLowerCase().includes(s.toLowerCase())) ||
                  INJURED_ABBREVIATIONS.includes(abbrev);

    if (isOut) {
      console.log(`[PlayerService] Player ${athleteId} is OUT - status: ${status}, abbrev: ${abbrev}, injury: ${injury.details?.type || 'unknown'}`);
    }

    return isOut;
  } catch (error) {
    console.error(`Error checking injury for ${athleteId}:`, error);
    return false;
  }
}

/**
 * Fetch athlete details to get name, position, and injury status
 */
async function fetchAthleteDetails(athleteId, checkInjury = true) {
  const cacheKey = `athlete_${athleteId}_${checkInjury}`;
  const cached = rosterCache.get(cacheKey);

  if (isCacheValid(cached)) {
    return cached.data;
  }

  try {
    const url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/athletes/${athleteId}`;
    const response = await fetch(url);

    if (!response.ok) return null;

    const data = await response.json();

    // Check injury status if requested - ESPN includes injury data inline
    let isInjured = false;
    if (checkInjury && data.injuries && data.injuries.length > 0) {
      isInjured = checkAthleteInjury(athleteId, data.injuries);
    }

    const athlete = {
      id: data.id,
      name: data.fullName || data.displayName,
      position: data.position?.abbreviation || "",
      team: "", // Will be filled in by caller
      isInjured,
    };

    rosterCache.set(cacheKey, {
      data: athlete,
      timestamp: Date.now(),
    });

    return athlete;
  } catch (error) {
    console.error(`Error fetching athlete ${athleteId}:`, error);
    return null;
  }
}

/**
 * Fetch depth chart for a team and get players by position in depth chart order
 */
async function fetchDepthChartByPosition(sport, teamId, position) {
  const cacheKey = `depthchart_${sport}_${teamId}`;
  const cached = rosterCache.get(cacheKey);

  let depthData;
  if (isCacheValid(cached)) {
    depthData = cached.data;
  } else {
    try {
      const url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2025/teams/${teamId}/depthcharts`;
      console.log("[PlayerService] Fetching depth chart:", url);
      const response = await fetch(url);
      if (!response.ok) {
        console.log("[PlayerService] Depth chart not available for team", teamId);
        return [];
      }
      depthData = await response.json();
      rosterCache.set(cacheKey, { data: depthData, timestamp: Date.now() });
    } catch (error) {
      console.error(`[PlayerService] Error fetching depth chart for team ${teamId}:`, error);
      return [];
    }
  }

  // Find the offensive depth chart (usually "3WR 1TE" or similar)
  const offensiveChart = depthData.items?.find(chart =>
    chart.name?.includes("WR") || chart.name?.includes("Offense") || chart.positions?.qb
  );

  if (!offensiveChart) {
    console.log("[PlayerService] No offensive depth chart found");
    return [];
  }

  // Find the position in the depth chart
  const posKey = position.toLowerCase();
  const positionData = offensiveChart.positions?.[posKey];

  if (!positionData?.athletes) {
    console.log(`[PlayerService] No ${position} found in depth chart`);
    return [];
  }

  // Sort by rank and extract athlete IDs
  const sortedAthletes = [...positionData.athletes].sort((a, b) => a.rank - b.rank);
  const athleteIds = sortedAthletes.map(a => {
    // Extract ID from ref URL
    const ref = a.athlete?.$ref || "";
    const match = ref.match(/athletes\/(\d+)/);
    return match ? match[1] : null;
  }).filter(Boolean);

  console.log(`[PlayerService] Depth chart order for ${position}:`, athleteIds);
  return athleteIds;
}

/**
 * Fetch healthy players from depth chart for a team
 * Uses depth chart order to get the actual starter
 */
async function fetchHealthyPlayersFromDepthChart(sport, teamId, teamAbbrev, positions) {
  try {
    const position = positions[0]?.toUpperCase() || "QB";

    // Get athlete IDs in depth chart order
    const depthChartIds = await fetchDepthChartByPosition(sport, teamId, position);

    if (depthChartIds.length === 0) {
      console.log("[PlayerService] No depth chart data, falling back to roster");
      return fetchHealthyPlayersFromRoster(sport, teamId, teamAbbrev, positions);
    }

    // Check injury status for each player in depth chart order
    const healthyPlayers = [];
    for (const athleteId of depthChartIds) {
      const details = await fetchAthleteDetails(athleteId, true);
      if (details && !details.isInjured) {
        healthyPlayers.push({
          ...details,
          team: teamAbbrev,
          statValue: 0, // No stats, but healthy
        });
        console.log(`[PlayerService] Found healthy player from depth chart: ${details.name}`);
      } else if (details?.isInjured) {
        console.log(`[PlayerService] Depth chart player ${details?.name || athleteId} is injured, checking next...`);
      }
    }

    return healthyPlayers;
  } catch (error) {
    console.error(`[PlayerService] Error fetching from depth chart for team ${teamId}:`, error);
    return [];
  }
}

/**
 * Fetch roster players by position for a team, checking injury status
 * Fallback when depth chart is not available
 */
async function fetchHealthyPlayersFromRoster(sport, teamId, teamAbbrev, positions) {
  try {
    const roster = await fetchTeamRoster(sport, teamId);
    if (!roster || roster.length === 0) return [];

    // Filter by position
    const posSet = new Set(positions.map(p => p.toUpperCase()));
    const positionPlayers = roster.filter(player => {
      const playerPos = (player.position || "").toUpperCase();
      return posSet.has(playerPos);
    });

    // Check injury status for each player
    const healthyPlayers = [];
    for (const player of positionPlayers) {
      const details = await fetchAthleteDetails(player.id, true);
      if (details && !details.isInjured) {
        healthyPlayers.push({
          ...details,
          team: teamAbbrev,
          statValue: 0, // No stats, but healthy
        });
      } else if (details?.isInjured) {
        console.log(`[PlayerService] Roster player ${details.name} is injured, skipping`);
      }
    }

    return healthyPlayers;
  } catch (error) {
    console.error(`[PlayerService] Error fetching roster for team ${teamId}:`, error);
    return [];
  }
}

/**
 * Get players from team leaders for both teams
 * This uses actual stats to determine who's playing
 * Filters out injured players and returns all healthy players sorted by stats
 * Falls back to roster if no healthy player found in stats leaders
 */
async function getStartersFromLeaders(sport, gameData, positions) {
  if (sport?.toLowerCase() !== "nfl") {
    return { starters: [], starterIds: new Set() };
  }

  const awayTeamId = gameData?.away?.id || gameData?.awayTeam?.id;
  const homeTeamId = gameData?.home?.id || gameData?.homeTeam?.id;
  const awayAbbrev = gameData?.away?.abbrev || gameData?.awayTeam?.abbreviation || "";
  const homeAbbrev = gameData?.home?.abbrev || gameData?.homeTeam?.abbreviation || "";

  console.log("[PlayerService] Getting players from leaders for teams:", awayTeamId, homeTeamId, "positions:", positions);

  const [awayLeaders, homeLeaders] = await Promise.all([
    awayTeamId ? fetchTeamLeaders(sport, awayTeamId) : Promise.resolve(null),
    homeTeamId ? fetchTeamLeaders(sport, homeTeamId) : Promise.resolve(null),
  ]);

  const starterIds = new Set();
  const starters = [];

  // Determine which leader category to use based on position
  const requestedPos = positions[0]?.toUpperCase() || "";
  const posConfig = POSITION_CONFIG[requestedPos] || POSITION_CONFIG.DEFAULT;
  const category = posConfig.category;
  const isSinglePlayer = posConfig.singlePlayer;

  if (!category) {
    console.log("[PlayerService] No leader category for position:", requestedPos);
    return { starters: [], starterIds: new Set() };
  }

  // Process both teams - track which teams we found healthy starters for
  const teamsData = [
    { teamId: awayTeamId, leaders: awayLeaders, abbrev: awayAbbrev },
    { teamId: homeTeamId, leaders: homeLeaders, abbrev: homeAbbrev },
  ];

  const teamsWithHealthyStarter = new Set();

  for (const { teamId, leaders, abbrev } of teamsData) {
    if (!leaders || !leaders[category]) continue;

    // Get all players from this category (they're already sorted by stats)
    const allPlayers = leaders[category];
    let foundHealthyForTeam = false;

    for (const player of allPlayers) {
      // Fetch athlete details including injury check
      const details = await fetchAthleteDetails(player.id, true);

      if (!details) continue;

      // Skip injured players
      if (details.isInjured) {
        console.log(`[PlayerService] Skipping injured player: ${details.name}`);
        continue;
      }

      // For single-player positions (QB), only take the first healthy player per team
      if (isSinglePlayer && foundHealthyForTeam) {
        continue;
      }

      starterIds.add(String(player.id));
      starters.push({
        ...details,
        team: abbrev,
        statValue: player.value, // Keep stat value for sorting
      });

      if (isSinglePlayer) {
        foundHealthyForTeam = true;
        teamsWithHealthyStarter.add(abbrev);
      }
    }
  }

  // FALLBACK: For single-player positions, if a team has no healthy starter from stats,
  // use the depth chart to find the actual starter/backup
  if (isSinglePlayer) {
    for (const { teamId, abbrev } of teamsData) {
      if (!teamsWithHealthyStarter.has(abbrev) && teamId) {
        console.log(`[PlayerService] No healthy ${requestedPos} found in stats for ${abbrev}, checking depth chart...`);
        const depthChartPlayers = await fetchHealthyPlayersFromDepthChart(sport, teamId, abbrev, positions);

        if (depthChartPlayers.length > 0) {
          // Take the first healthy player from depth chart (the actual starter)
          const starter = depthChartPlayers[0];
          console.log(`[PlayerService] Found starter from depth chart: ${starter.name} (${abbrev})`);
          starterIds.add(String(starter.id));
          starters.push(starter);
          teamsWithHealthyStarter.add(abbrev);
        }
      }
    }
  }

  // Sort by stat value (best first) but keep teams grouped
  starters.sort((a, b) => {
    // First sort by team to group them
    const teamCompare = (a.team || "").localeCompare(b.team || "");
    if (teamCompare !== 0) return teamCompare;
    // Then by stat value (higher is better)
    return (b.statValue || 0) - (a.statValue || 0);
  });

  console.log("[PlayerService] Found", starters.length, "healthy players from leaders:", starters.map(s => `${s.name} (${s.team})`));
  return { starters, starterIds };
}

/**
 * Filter players to only include actual starters based on stats leaders
 */
async function filterToStarters(players, sport, gameData, positions) {
  if (!players || players.length === 0) return players;
  if (!positions || positions.length === 0) return players;

  // For non-NFL sports, just limit by team for now
  if (sport?.toLowerCase() !== "nfl") {
    return limitByTeam(players, positions);
  }

  try {
    const { starters, starterIds } = await getStartersFromLeaders(sport, gameData, positions);

    // If we got leaders data with actual starters, return those directly
    if (starters.length > 0) {
      console.log("[PlayerService] Using starters from leaders:", starters.length);
      return starters;
    }

    // If we got IDs but no details, filter the roster
    if (starterIds.size > 0) {
      const filtered = players.filter(player => {
        const playerId = String(player.id || "");
        return starterIds.has(playerId);
      });

      if (filtered.length > 0) {
        console.log("[PlayerService] Filtered to", filtered.length, "starters by ID");
        return filtered;
      }
    }
  } catch (error) {
    console.error("[PlayerService] Error filtering to starters:", error);
  }

  // Fallback: limit by team
  console.log("[PlayerService] Falling back to limit by team");
  return limitByTeam(players, positions);
}

/**
 * Simple fallback: return players grouped by team
 * For single-player positions, limit to 1 per team; otherwise return all
 */
function limitByTeam(players, positions) {
  if (!players || players.length === 0) return players;

  const requestedPos = positions[0]?.toUpperCase() || "";
  const posConfig = POSITION_CONFIG[requestedPos] || POSITION_CONFIG.DEFAULT;
  const isSinglePlayer = posConfig.singlePlayer;

  // Group by team
  const byTeam = {};
  players.forEach(player => {
    const team = player.team || "UNKNOWN";
    if (!byTeam[team]) byTeam[team] = [];
    byTeam[team].push(player);
  });

  const result = [];
  Object.values(byTeam).forEach(teamPlayers => {
    if (isSinglePlayer) {
      // Only take first player for single-player positions
      result.push(teamPlayers[0]);
    } else {
      // Take all players for multi-player positions
      result.push(...teamPlayers);
    }
  });

  return result.length > 0 ? result : players.slice(0, 10);
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
    console.log("[PlayerService] Getting players for game:", gameData?.id, "sport:", sport);

    // First try to get players from game summary (most relevant players)
    if (gameData?.id) {
      allPlayers = await fetchPlayersFromGame(sport, gameData.id);
      console.log("[PlayerService] Got", allPlayers.length, "players from game summary");
    }

    // If that didn't work, try fetching rosters for both teams
    if (allPlayers.length === 0) {
      // Check multiple possible paths for team IDs
      const awayTeamId = gameData?.away?.id || gameData?.awayTeam?.id || gameData?.awayTeam?.team?.id;
      const homeTeamId = gameData?.home?.id || gameData?.homeTeam?.id || gameData?.homeTeam?.team?.id;

      console.log("[PlayerService] Fetching rosters - awayTeamId:", awayTeamId, "homeTeamId:", homeTeamId);

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

    // Filter to starters using depth chart data (for NFL) or limit by team (other sports)
    filteredPlayers = await filterToStarters(filteredPlayers, sport, gameData, positions);

    // Sort by team then name for clean display
    filteredPlayers.sort((a, b) => {
      const teamCompare = (a.team || "").localeCompare(b.team || "");
      if (teamCompare !== 0) return teamCompare;
      return (a.name || "").localeCompare(b.name || "");
    });

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
