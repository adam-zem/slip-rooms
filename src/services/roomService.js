// src/services/roomService.js
// Room system with hash-based IDs for the Betting Menu

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Generate a unique room ID from prop selections
 * Uses player ID (from ESPN) to guarantee uniqueness - no duplicates possible
 * Format: gameId_playerId_stat_line_direction
 * e.g., "401547417_12345_passingyards_275_5_over"
 */
export function generateRoomId(gameId, playerId, stat, line, direction) {
  const sanitize = (str) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .substring(0, 30);

  // Use player ID directly - this is the key to preventing duplicates
  // Player IDs from ESPN are unique and consistent
  const playerKey = String(playerId).replace(/[^a-z0-9]/gi, "").toLowerCase();
  const statKey = sanitize(stat);
  const lineKey = String(line).replace(".", "_");
  const dirKey = direction.toLowerCase();

  return `${gameId}_${playerKey}_${statKey}_${lineKey}_${dirKey}`;
}

/**
 * Generate a display name for the room
 * e.g., "JOSH ALLEN OVER 275.5 PASS YDS"
 */
export function generateRoomName(player, stat, line, direction) {
  const statAbbrev = {
    "Passing Yards": "PASS YDS",
    "Passing TDs": "PASS TDs",
    "Interceptions": "INTs",
    "Rushing Yards": "RUSH YDS",
    "Rushing TDs": "RUSH TDs",
    "Longest Rush": "LONG RUSH",
    "Receiving Yards": "REC YDS",
    "Receptions": "RECS",
    "Receiving TDs": "REC TDs",
    "Spread": "SPREAD",
    "Moneyline": "ML",
    "Over/Under": "TOTAL",
    "First TD Scorer": "1ST TD",
    "Anytime TD": "ANY TD",
  };

  const statDisplay = statAbbrev[stat] || stat.toUpperCase();
  const playerName = player.split(" (")[0].toUpperCase(); // Remove team suffix if present

  return `${playerName} ${direction.toUpperCase()} ${line} ${statDisplay}`;
}

/**
 * Join or create a room - the magic function
 * Returns the room data and whether it was newly created
 *
 * @param {Object} params
 * @param {string} params.gameId - ESPN game ID
 * @param {string} params.gameName - Display name for the game (e.g., "BUF vs BAL")
 * @param {string} params.playerId - ESPN player ID (ensures uniqueness)
 * @param {string} params.playerName - Display name for the player
 * @param {string} params.stat - The stat type (e.g., "Passing Yards")
 * @param {string|number} params.line - The line number (e.g., 275.5)
 * @param {string} params.direction - "over" or "under"
 * @param {string} params.sport - Sport ID (nfl, nba, etc.)
 */
export async function joinOrCreateRoom({
  gameId,
  gameName,
  playerId,
  playerName,
  stat,
  line,
  direction,
  sport,
}) {
  // Use playerId for room ID generation (guarantees uniqueness)
  const roomId = generateRoomId(gameId, playerId, stat, line, direction);
  // Use playerName for display
  const roomName = generateRoomName(playerName, stat, line, direction);
  const roomRef = doc(db, "rooms", roomId);

  try {
    const roomSnap = await getDoc(roomRef);

    if (roomSnap.exists()) {
      // Room exists - update activity
      await updateDoc(roomRef, {
        lastActivity: serverTimestamp(),
      });

      return {
        roomId,
        room: roomSnap.data(),
        created: false,
      };
    } else {
      // Create new room
      const newRoom = {
        id: roomId,
        name: roomName,
        gameId,
        gameName,
        playerId, // Store player ID for reference
        playerName, // Store display name
        stat,
        line,
        direction,
        sport: sport || "nfl",
        userCount: 0,
        messageCount: 0,
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
        visibleActive: true,
      };

      await setDoc(roomRef, newRoom);

      return {
        roomId,
        room: newRoom,
        created: true,
      };
    }
  } catch (error) {
    console.error("Error in joinOrCreateRoom:", error);
    throw error;
  }
}

/**
 * Get a single room by ID
 */
export async function getRoom(roomId) {
  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);
  return roomSnap.exists() ? { id: roomSnap.id, ...roomSnap.data() } : null;
}

/**
 * Subscribe to active rooms (rooms with activity in last 30 minutes)
 * Sorted by user count (most active first)
 */
export function subscribeToActiveRooms(callback, sport = null) {
  const thirtyMinAgo = Timestamp.fromDate(
    new Date(Date.now() - 30 * 60 * 1000)
  );

  let q;
  if (sport) {
    q = query(
      collection(db, "rooms"),
      where("sport", "==", sport),
      where("lastActivity", ">=", thirtyMinAgo),
      orderBy("lastActivity", "desc")
    );
  } else {
    q = query(
      collection(db, "rooms"),
      where("lastActivity", ">=", thirtyMinAgo),
      orderBy("lastActivity", "desc")
    );
  }

  return onSnapshot(q, (snapshot) => {
    const rooms = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    // Sort by userCount client-side (Firestore can only order by one inequality field)
    rooms.sort((a, b) => (b.userCount || 0) - (a.userCount || 0));
    callback(rooms);
  });
}

/**
 * Subscribe to trending rooms across all games
 * Shows rooms with most users
 * @param {Function} callback - Called with array of trending rooms
 * @param {number} limit - Max number of rooms to return
 * @param {string} sport - Optional sport filter (e.g., "nfl", "nba")
 */
export function subscribeToTrendingRooms(callback, limit = 10, sport = null) {
  const thirtyMinAgo = Timestamp.fromDate(
    new Date(Date.now() - 30 * 60 * 1000)
  );

  const q = query(
    collection(db, "rooms"),
    where("lastActivity", ">=", thirtyMinAgo),
    orderBy("lastActivity", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    let rooms = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

    // Filter by sport if specified
    if (sport) {
      const sportLower = sport.toLowerCase();
      rooms = rooms.filter(r => (r.sport || "").toLowerCase() === sportLower);
    }

    // Sort by user count and limit
    rooms = rooms
      .sort((a, b) => (b.userCount || 0) - (a.userCount || 0))
      .slice(0, limit);

    // Log trending rooms data for debugging
    const roomsWithUsers = rooms.filter(r => (r.userCount || 0) > 0);
    if (roomsWithUsers.length > 0) {
      console.log("[TrendingRooms] Rooms with users:", roomsWithUsers.map(r => ({
        id: r.id,
        name: r.name,
        sport: r.sport,
        userCount: r.userCount,
      })));
    } else {
      console.log("[TrendingRooms] No rooms with users for sport:", sport || "all", "total rooms:", rooms.length);
    }

    callback(rooms);
  });
}

/**
 * Subscribe to rooms for a specific game
 */
export function subscribeToGameRooms(gameId, callback) {
  const q = query(
    collection(db, "rooms"),
    where("gameId", "==", gameId),
    orderBy("lastActivity", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const rooms = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    rooms.sort((a, b) => (b.userCount || 0) - (a.userCount || 0));
    callback(rooms);
  });
}

/**
 * Update room activity (call when user sends a message)
 */
export async function updateRoomActivity(roomId) {
  const roomRef = doc(db, "rooms", roomId);
  try {
    await updateDoc(roomRef, {
      lastActivity: serverTimestamp(),
      messageCount: increment(1),
    });
  } catch (error) {
    console.error("Error updating room activity:", error);
  }
}

/**
 * Update user count for a room
 */
export async function updateRoomUserCount(roomId, delta) {
  const roomRef = doc(db, "rooms", roomId);
  try {
    await updateDoc(roomRef, {
      userCount: increment(delta),
      lastActivity: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating user count:", error);
  }
}

/**
 * Search rooms by name, player, or team
 */
export async function searchRooms(searchTerm) {
  // Since Firestore doesn't support full-text search,
  // we'll fetch active rooms and filter client-side
  const thirtyMinAgo = Timestamp.fromDate(
    new Date(Date.now() - 60 * 60 * 1000) // Search in rooms from last hour
  );

  const q = query(
    collection(db, "rooms"),
    where("lastActivity", ">=", thirtyMinAgo),
    orderBy("lastActivity", "desc")
  );

  return new Promise((resolve) => {
    const unsubscribe = onSnapshot(q, (snapshot) => {
      unsubscribe();
      const term = searchTerm.toLowerCase();
      const rooms = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter(
          (room) =>
            room.name?.toLowerCase().includes(term) ||
            room.player?.toLowerCase().includes(term) ||
            room.gameName?.toLowerCase().includes(term)
        )
        .sort((a, b) => (b.userCount || 0) - (a.userCount || 0));
      resolve(rooms);
    });
  });
}

// Sport-specific betting menu categories
export const BETTING_CATEGORIES_BY_SPORT = {
  nfl: [
    {
      id: "gameLines",
      name: "Game Lines",
      emoji: "🏈",
      description: "Spread, Moneyline, Total",
      stats: ["Spread", "Moneyline", "Total"],
      requiresPlayer: false,
      teamBased: true,
    },
    {
      id: "qbProps",
      name: "QB Props",
      emoji: "🎯",
      description: "Passing Yds, Passing TDs, INTs, Rushing Yds",
      stats: ["Passing Yards", "Passing TDs", "Interceptions", "Rushing Yards"],
      requiresPlayer: true,
      positions: ["QB"],
    },
    {
      id: "rushingProps",
      name: "Rushing Props",
      emoji: "🏃",
      description: "Rush Yds, Rush TDs",
      stats: ["Rushing Yards", "Rushing TDs"],
      requiresPlayer: true,
      positions: ["RB", "QB", "WR"],
    },
    {
      id: "receivingProps",
      name: "Receiving Props",
      emoji: "🙌",
      description: "Rec Yds, Receptions, Rec TDs",
      stats: ["Receiving Yards", "Receptions", "Receiving TDs"],
      requiresPlayer: true,
      positions: ["WR", "TE", "RB"],
    },
    {
      id: "trending",
      name: "Trending",
      emoji: "🔥",
      description: "Hottest rooms for this game",
      stats: [],
      requiresPlayer: false,
      isTrending: true,
    },
  ],
  nba: [
    {
      id: "gameLines",
      name: "Game Lines",
      emoji: "🏀",
      description: "Spread, Moneyline, Total",
      stats: ["Spread", "Moneyline", "Total"],
      requiresPlayer: false,
      teamBased: true,
    },
    {
      id: "pointsProps",
      name: "Points Props",
      emoji: "🎯",
      description: "Player Points",
      stats: ["Points"],
      requiresPlayer: true,
      positions: ["G", "F", "C", "G-F", "F-C", "F-G"],
    },
    {
      id: "reboundsProps",
      name: "Rebounds Props",
      emoji: "🏀",
      description: "Player Rebounds",
      stats: ["Rebounds"],
      requiresPlayer: true,
      positions: ["C", "F", "F-C", "G-F", "G", "F-G"],
    },
    {
      id: "assistsProps",
      name: "Assists Props",
      emoji: "🎯",
      description: "Player Assists",
      stats: ["Assists"],
      requiresPlayer: true,
      positions: ["G", "G-F", "F", "F-G", "C", "F-C"],
    },
    {
      id: "comboProps",
      name: "Combo Props",
      emoji: "📊",
      description: "Pts+Reb+Ast",
      stats: ["Pts+Reb+Ast", "Pts+Reb", "Pts+Ast"],
      requiresPlayer: true,
      positions: ["G", "F", "C", "G-F", "F-C", "F-G"],
    },
    {
      id: "trending",
      name: "Trending",
      emoji: "🔥",
      description: "Hottest rooms for this game",
      stats: [],
      requiresPlayer: false,
      isTrending: true,
    },
  ],
  mlb: [
    {
      id: "gameLines",
      name: "Game Lines",
      emoji: "⚾",
      description: "Moneyline, Run Line, Total",
      stats: ["Moneyline", "Run Line", "Total"],
      requiresPlayer: false,
      teamBased: true,
    },
    {
      id: "pitcherProps",
      name: "Pitcher Props",
      emoji: "🎯",
      description: "Strikeouts, Earned Runs",
      stats: ["Strikeouts", "Earned Runs", "Hits Allowed"],
      requiresPlayer: true,
      positions: ["P", "SP", "RP"],
    },
    {
      id: "batterProps",
      name: "Batter Props",
      emoji: "🏏",
      description: "Hits, HRs, RBIs",
      stats: ["Hits", "Home Runs", "RBIs", "Total Bases"],
      requiresPlayer: true,
      positions: ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "OF", "IF"],
    },
    {
      id: "trending",
      name: "Trending",
      emoji: "🔥",
      description: "Hottest rooms for this game",
      stats: [],
      requiresPlayer: false,
      isTrending: true,
    },
  ],
  nhl: [
    {
      id: "gameLines",
      name: "Game Lines",
      emoji: "🏒",
      description: "Puckline, Moneyline, Total",
      stats: ["Puckline", "Moneyline", "Total"],
      requiresPlayer: false,
      teamBased: true,
    },
    {
      id: "goalsProps",
      name: "Goals Props",
      emoji: "🎯",
      description: "Player Goals, Assists, Points",
      stats: ["Goals", "Assists", "Points"],
      requiresPlayer: true,
      positions: ["C", "LW", "RW", "D", "F"],
    },
    {
      id: "goalieProps",
      name: "Goalie Props",
      emoji: "🥅",
      description: "Saves",
      stats: ["Saves", "Goals Against"],
      requiresPlayer: true,
      positions: ["G"],
    },
    {
      id: "trending",
      name: "Trending",
      emoji: "🔥",
      description: "Hottest rooms for this game",
      stats: [],
      requiresPlayer: false,
      isTrending: true,
    },
  ],
  soccer: [
    {
      id: "gameLines",
      name: "Game Lines",
      emoji: "⚽",
      description: "Moneyline, Draw, Total Goals",
      stats: ["Moneyline", "Draw", "Total Goals"],
      requiresPlayer: false,
      teamBased: true,
    },
    {
      id: "playerProps",
      name: "Player Props",
      emoji: "🎯",
      description: "Goals, Assists, Shots",
      stats: ["Goals", "Assists", "Shots on Target"],
      requiresPlayer: true,
      positions: ["F", "M", "D", "GK", "Forward", "Midfielder", "Defender", "Goalkeeper"],
    },
    {
      id: "trending",
      name: "Trending",
      emoji: "🔥",
      description: "Hottest rooms for this game",
      stats: [],
      requiresPlayer: false,
      isTrending: true,
    },
  ],
};

// Helper to get categories for a sport
export function getBettingCategories(sport) {
  return BETTING_CATEGORIES_BY_SPORT[sport?.toLowerCase()] || BETTING_CATEGORIES_BY_SPORT.nfl;
}

// Common lines for different stat types (all sports)
export const COMMON_LINES = {
  // NFL
  "Passing Yards": [174.5, 199.5, 224.5, 249.5, 274.5, 299.5],
  "Passing TDs": [0.5, 1.5, 2.5, 3.5],
  "Interceptions": [0.5, 1.5],
  "Rushing Yards": [39.5, 49.5, 59.5, 69.5, 79.5, 99.5],
  "Rushing TDs": [0.5, 1.5],
  "Receiving Yards": [39.5, 49.5, 59.5, 69.5, 79.5, 99.5],
  "Receptions": [3.5, 4.5, 5.5, 6.5, 7.5],
  "Receiving TDs": [0.5, 1.5],

  // NBA
  "Points": [14.5, 19.5, 24.5, 29.5, 34.5, 39.5],
  "Rebounds": [4.5, 6.5, 8.5, 10.5, 12.5],
  "Assists": [3.5, 5.5, 7.5, 9.5, 11.5],
  "Pts+Reb+Ast": [24.5, 29.5, 34.5, 39.5, 44.5, 49.5],
  "Pts+Reb": [19.5, 24.5, 29.5, 34.5, 39.5],
  "Pts+Ast": [19.5, 24.5, 29.5, 34.5, 39.5],

  // MLB
  "Strikeouts": [4.5, 5.5, 6.5, 7.5, 8.5],
  "Earned Runs": [1.5, 2.5, 3.5],
  "Hits Allowed": [4.5, 5.5, 6.5, 7.5],
  "Hits": [0.5, 1.5, 2.5],
  "Home Runs": [0.5, 1.5],
  "RBIs": [0.5, 1.5, 2.5],
  "Total Bases": [0.5, 1.5, 2.5, 3.5],
  "Run Line": [-1.5, 1.5],

  // NHL
  "Goals": [0.5, 1.5],
  "Saves": [24.5, 27.5, 30.5, 33.5],
  "Goals Against": [1.5, 2.5, 3.5],

  // Soccer
  "Shots on Target": [0.5, 1.5, 2.5],
  "Total Goals": [1.5, 2.5, 3.5, 4.5],

  // Game Lines (all sports)
  "Spread": [-14.5, -10.5, -7.5, -6.5, -3.5, -2.5, -1.5, 1.5, 2.5, 3.5, 6.5, 7.5, 10.5, 14.5],
  "Puckline": [-1.5, 1.5],
  "Moneyline": [],
  "Draw": [],
  "Total": [37.5, 40.5, 43.5, 45.5, 47.5, 49.5, 51.5, 54.5, 200.5, 210.5, 220.5, 230.5],
};

export default {
  generateRoomId,
  generateRoomName,
  joinOrCreateRoom,
  getRoom,
  subscribeToActiveRooms,
  subscribeToTrendingRooms,
  subscribeToGameRooms,
  updateRoomActivity,
  updateRoomUserCount,
  searchRooms,
  getBettingCategories,
  BETTING_CATEGORIES_BY_SPORT,
  COMMON_LINES,
};
