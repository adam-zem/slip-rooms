// src/services/roomService.js
// Room system with hash-based IDs for the Betting Menu

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  Timestamp,
  getDocs,
  writeBatch,
  arrayUnion,
  arrayRemove,
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
 * e.g., "LOS ANGELES RAMS ML" (for moneyline)
 * e.g., "BRONCOS +3.5" (for spread)
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
    "Total": "TOTAL",
    "First TD Scorer": "1ST TD",
    "Anytime TD": "ANY TD",
    // UFC
    "Fight Winner": "TO WIN",
    "KO/TKO": "BY KO/TKO",
    "Submission": "BY SUB",
    "Decision": "BY DEC",
  };

  const playerName = player.split(" (")[0].toUpperCase(); // Remove team suffix if present

  // Special formatting for different bet types
  if (stat === "Moneyline") {
    // Moneyline: "LOS ANGELES RAMS ML"
    return `${playerName} ML`;
  }

  if (stat === "Spread") {
    // Spread: "BRONCOS +3.5" (line already includes +/-)
    return `${playerName} ${line}`;
  }

  if (stat === "Total") {
    // Total: "OVER 45.5" or "UNDER 45.5"
    return `${direction.toUpperCase()} ${line}`;
  }

  // UFC - Fight Winner
  if (stat === "Fight Winner") {
    return `${playerName} ${statAbbrev[stat]}`;
  }

  // UFC - Method of victory
  if (stat === "KO/TKO" || stat === "Submission" || stat === "Decision") {
    return `${playerName} ${statAbbrev[stat]}`;
  }

  // Default for player props: "PLAYER OVER 275.5 PASS YDS"
  const statDisplay = statAbbrev[stat] || stat.toUpperCase();
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
        status: "active", // active, archived
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
 * Subscribe to a single room for real-time updates
 * Useful for detecting when a room is deleted (game ended)
 * @param {string} roomId - The room ID to subscribe to
 * @param {Function} onUpdate - Called with room data on updates
 * @param {Function} onDeleted - Called when room is deleted
 */
export function subscribeToRoom(roomId, onUpdate, onDeleted) {
  const roomRef = doc(db, "rooms", roomId);

  return onSnapshot(roomRef, (snapshot) => {
    if (snapshot.exists()) {
      const roomData = { id: snapshot.id, ...snapshot.data() };
      onUpdate(roomData);
    } else {
      // Room was deleted
      onDeleted();
    }
  }, (error) => {
    console.error("[subscribeToRoom] Error:", error);
    // Treat permission errors as deletion
    if (error.code === "permission-denied") {
      onDeleted();
    }
  });
}

/**
 * Subscribe to active rooms (all non-archived rooms)
 * Sorted by user count (most active first)
 * Rooms persist until their game ends or admin deletes them
 */
export function subscribeToActiveRooms(callback, sport = null) {
  // Query all rooms, we'll filter client-side for flexibility
  const q = query(
    collection(db, "rooms"),
    orderBy("userCount", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    let rooms = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      // Filter out archived rooms
      .filter(r => r.status !== "archived");

    // Filter by sport if specified
    if (sport) {
      const sportLower = sport.toLowerCase();
      rooms = rooms.filter(r => (r.sport || "").toLowerCase() === sportLower);
    }

    // Sort by userCount client-side
    rooms.sort((a, b) => (b.userCount || 0) - (a.userCount || 0));
    callback(rooms);
  });
}

/**
 * Subscribe to trending rooms across all games
 * Shows active rooms sorted by user count (most users first)
 * Only shows rooms that are NOT archived
 * @param {Function} callback - Called with array of trending rooms
 * @param {number} limit - Max number of rooms to return (default 100)
 * @param {string} sport - Optional sport filter (e.g., "nfl", "nba")
 */
export function subscribeToTrendingRooms(callback, limit = 100, sport = null) {
  // Query all rooms, filter archived ones client-side
  // (Firestore "in" doesn't work with null/undefined values)
  const q = query(
    collection(db, "rooms"),
    orderBy("userCount", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    let rooms = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      // Only show active rooms (status is "active" or undefined/null for legacy rooms)
      // Exclude archived rooms
      .filter(r => r.status !== "archived");

    // Filter by sport if specified
    if (sport) {
      const sportLower = sport.toLowerCase();
      rooms = rooms.filter(r => (r.sport || "").toLowerCase() === sportLower);
    }

    // Sort by user count (most active first), then by creation time
    rooms = rooms
      .sort((a, b) => {
        const userDiff = (b.userCount || 0) - (a.userCount || 0);
        if (userDiff !== 0) return userDiff;
        // If same user count, sort by most recent
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      })
      .slice(0, limit);

    callback(rooms);
  });
}

/**
 * Subscribe to rooms for a specific game
 * Shows all active (non-archived) rooms for the game
 * Real-time sync - rooms appear/disappear immediately when created/deleted
 */
export function subscribeToGameRooms(gameId, callback) {
  const q = query(
    collection(db, "rooms"),
    where("gameId", "==", gameId)
  );

  return onSnapshot(q, (snapshot) => {
    let rooms = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      // Filter out archived rooms
      .filter(r => r.status !== "archived");

    // Sort by user count (most active first)
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
 * Update user count for a room (legacy - use joinRoom/leaveRoom instead)
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
 * Join a room - adds user to activeUsers array
 * This provides proper participant tracking with grace period support
 * @param {string} roomId - The room to join
 * @param {string} userId - The user joining
 */
export async function joinRoom(roomId, userId) {
  if (!roomId || !userId) return;

  const roomRef = doc(db, "rooms", roomId);
  try {
    await updateDoc(roomRef, {
      activeUsers: arrayUnion(userId),
      userCount: increment(1),
      lastActivity: serverTimestamp(),
    });
  } catch (error) {
    // Room might have been deleted
    if (error.code === "not-found" || error.code === "permission-denied") {
      console.log("[joinRoom] Room not found or no permission:", roomId);
    } else {
      console.error("[joinRoom] Error:", error);
    }
  }
}

/**
 * Leave a room - removes user from activeUsers array
 * Gracefully handles deleted rooms
 * @param {string} roomId - The room to leave
 * @param {string} userId - The user leaving
 */
export async function leaveRoom(roomId, userId) {
  if (!roomId || !userId) return;

  const roomRef = doc(db, "rooms", roomId);
  try {
    await updateDoc(roomRef, {
      activeUsers: arrayRemove(userId),
      userCount: increment(-1),
      lastActivity: serverTimestamp(),
    });
  } catch (error) {
    // Silently handle errors - room might have been deleted
    // This is expected during logout or when rooms are cleaned up
    if (error.code === "not-found" || error.code === "permission-denied") {
      // Expected - room was deleted or user logged out
    } else {
      console.error("[leaveRoom] Error:", error);
    }
  }
}

/**
 * Find duplicate rooms (rooms with same gameId, stat, line, direction)
 * Useful for cleanup
 */
export async function findDuplicateRooms() {
  try {
    const q = query(collection(db, "rooms"));
    const snapshot = await getDocs(q);

    const roomsByKey = {};
    const duplicates = [];

    snapshot.docs.forEach(docSnap => {
      const room = { id: docSnap.id, ...docSnap.data() };
      const key = `${room.gameId}_${room.stat}_${room.line}_${room.direction}`;

      if (!roomsByKey[key]) {
        roomsByKey[key] = room;
      } else {
        // This is a duplicate - keep the one with more users
        const existing = roomsByKey[key];
        if ((room.userCount || 0) > (existing.userCount || 0)) {
          duplicates.push(existing);
          roomsByKey[key] = room;
        } else {
          duplicates.push(room);
        }
      }
    });

    return duplicates;
  } catch (error) {
    console.error("[findDuplicateRooms] Error:", error);
    return [];
  }
}

/**
 * Clean up duplicate rooms - keeps the room with most users
 */
export async function cleanupDuplicateRooms() {
  try {
    const duplicates = await findDuplicateRooms();

    if (duplicates.length === 0) {
      console.log("[cleanupDuplicateRooms] No duplicates found");
      return { deleted: 0 };
    }

    const batch = writeBatch(db);
    duplicates.forEach(room => {
      batch.delete(doc(db, "rooms", room.id));
    });

    await batch.commit();
    console.log(`[cleanupDuplicateRooms] Deleted ${duplicates.length} duplicate rooms`);

    return { deleted: duplicates.length };
  } catch (error) {
    console.error("[cleanupDuplicateRooms] Error:", error);
    throw error;
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
  ufc: [
    {
      id: "fightWinner",
      name: "Fight Winner",
      emoji: "🥊",
      description: "Pick the winner of the fight",
      stats: ["Fight Winner"],
      requiresPlayer: true,
      isIndividualSport: true,
      useEventCompetitors: true,
      directPick: true,
    },
    {
      id: "methodOfVictory",
      name: "Method of Victory",
      emoji: "💥",
      description: "KO/TKO, Submission, Decision",
      stats: ["KO/TKO", "Submission", "Decision"],
      requiresPlayer: true,
      isIndividualSport: true,
      useEventCompetitors: true,
      directPick: true,
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

  // UFC
  "Fight Winner": [],
  "KO/TKO": [],
  "Submission": [],
  "Decision": [],
};

/**
 * Archive all rooms for a specific game
 * Called when a game ends
 * @param {string} gameId - The ESPN game ID
 */
export async function archiveRoomsForGame(gameId) {
  try {
    const q = query(
      collection(db, "rooms"),
      where("gameId", "==", gameId)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log(`[archiveRoomsForGame] No rooms found for game ${gameId}`);
      return { archived: 0 };
    }

    const batch = writeBatch(db);
    let count = 0;

    snapshot.docs.forEach((docSnap) => {
      const roomRef = doc(db, "rooms", docSnap.id);
      batch.update(roomRef, {
        status: "archived",
        archivedAt: serverTimestamp(),
      });
      count++;
    });

    await batch.commit();
    console.log(`[archiveRoomsForGame] Archived ${count} rooms for game ${gameId}`);

    return { archived: count };
  } catch (error) {
    console.error("[archiveRoomsForGame] Error:", error);
    throw error;
  }
}

/**
 * Delete a room (admin only)
 * @param {string} roomId - The room ID to delete
 */
export async function deleteRoom(roomId) {
  try {
    const roomRef = doc(db, "rooms", roomId);
    await deleteDoc(roomRef);
    console.log(`[deleteRoom] Deleted room ${roomId}`);
    return { success: true };
  } catch (error) {
    console.error("[deleteRoom] Error:", error);
    throw error;
  }
}

/**
 * Archive a single room (soft delete)
 * @param {string} roomId - The room ID to archive
 */
export async function archiveRoom(roomId) {
  try {
    const roomRef = doc(db, "rooms", roomId);
    await updateDoc(roomRef, {
      status: "archived",
      archivedAt: serverTimestamp(),
    });
    console.log(`[archiveRoom] Archived room ${roomId}`);
    return { success: true };
  } catch (error) {
    console.error("[archiveRoom] Error:", error);
    throw error;
  }
}

/**
 * Clean up all archived rooms (permanent delete)
 * Call this periodically to free up space
 */
export async function cleanupArchivedRooms() {
  try {
    const q = query(
      collection(db, "rooms"),
      where("status", "==", "archived")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log("[cleanupArchivedRooms] No archived rooms to clean up");
      return { deleted: 0 };
    }

    const batch = writeBatch(db);
    let count = 0;

    snapshot.docs.forEach((docSnap) => {
      batch.delete(doc(db, "rooms", docSnap.id));
      count++;
    });

    await batch.commit();
    console.log(`[cleanupArchivedRooms] Deleted ${count} archived rooms`);

    return { deleted: count };
  } catch (error) {
    console.error("[cleanupArchivedRooms] Error:", error);
    throw error;
  }
}

/**
 * Get all rooms (for admin debugging)
 */
export async function getAllRooms() {
  try {
    const q = query(collection(db, "rooms"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("[getAllRooms] Error:", error);
    throw error;
  }
}

/**
 * Bulk delete rooms by IDs (admin only)
 */
export async function bulkDeleteRooms(roomIds) {
  try {
    const batch = writeBatch(db);
    roomIds.forEach(roomId => {
      batch.delete(doc(db, "rooms", roomId));
    });
    await batch.commit();
    console.log(`[bulkDeleteRooms] Deleted ${roomIds.length} rooms`);
    return { deleted: roomIds.length };
  } catch (error) {
    console.error("[bulkDeleteRooms] Error:", error);
    throw error;
  }
}

export default {
  generateRoomId,
  generateRoomName,
  joinOrCreateRoom,
  getRoom,
  subscribeToRoom,
  subscribeToActiveRooms,
  subscribeToTrendingRooms,
  subscribeToGameRooms,
  updateRoomActivity,
  updateRoomUserCount,
  joinRoom,
  leaveRoom,
  findDuplicateRooms,
  cleanupDuplicateRooms,
  searchRooms,
  getBettingCategories,
  archiveRoomsForGame,
  deleteRoom,
  archiveRoom,
  cleanupArchivedRooms,
  getAllRooms,
  bulkDeleteRooms,
  BETTING_CATEGORIES_BY_SPORT,
  COMMON_LINES,
};
