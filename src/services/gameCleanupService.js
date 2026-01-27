// src/services/gameCleanupService.js
// Automatic room cleanup when games end

import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { fetchGames } from "./espnService";

// Cache of known finished game IDs to avoid redundant checks
const finishedGameIds = new Set();

// Listeners for game end events
const gameEndListeners = [];

/**
 * Register a listener for when a game ends
 * @param {Function} callback - Called with { gameId, rooms } when game ends
 */
export function onGameEnd(callback) {
  gameEndListeners.push(callback);
  return () => {
    const index = gameEndListeners.indexOf(callback);
    if (index > -1) gameEndListeners.splice(index, 1);
  };
}

/**
 * Notify all listeners that a game has ended
 */
function notifyGameEnd(gameId, deletedRooms) {
  gameEndListeners.forEach((cb) => {
    try {
      cb({ gameId, rooms: deletedRooms });
    } catch (e) {
      console.error("[gameCleanup] Listener error:", e);
    }
  });
}

/**
 * Delete all rooms for a specific game
 * Returns the list of deleted room IDs
 */
export async function deleteRoomsForGame(gameId) {
  try {
    const q = query(
      collection(db, "rooms"),
      where("gameId", "==", gameId)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log(`[gameCleanup] No rooms found for game ${gameId}`);
      return [];
    }

    const batch = writeBatch(db);
    const deletedRoomIds = [];

    snapshot.docs.forEach((docSnap) => {
      batch.delete(doc(db, "rooms", docSnap.id));
      deletedRoomIds.push(docSnap.id);
    });

    await batch.commit();
    console.log(`[gameCleanup] Deleted ${deletedRoomIds.length} rooms for game ${gameId}`);

    return deletedRoomIds;
  } catch (error) {
    console.error("[gameCleanup] Error deleting rooms:", error);
    return [];
  }
}

/**
 * Check a list of games and delete rooms for any that have ended
 * @param {Array} games - Array of game objects from ESPN
 * @returns {Object} - { gamesProcessed, roomsDeleted }
 */
export async function checkAndCleanupGames(games) {
  let gamesProcessed = 0;
  let roomsDeleted = 0;

  for (const game of games) {
    // Skip if already processed
    if (finishedGameIds.has(game.id)) continue;

    // Check if game is final
    if (game.isFinal || game.status?.state === "final") {
      console.log(`[gameCleanup] Game ${game.id} has ended, cleaning up rooms`);

      const deletedRooms = await deleteRoomsForGame(game.id);
      finishedGameIds.add(game.id);
      gamesProcessed++;
      roomsDeleted += deletedRooms.length;

      // Notify listeners
      if (deletedRooms.length > 0) {
        notifyGameEnd(game.id, deletedRooms);
      }
    }
  }

  return { gamesProcessed, roomsDeleted };
}

/**
 * Get all rooms and check if their associated games have ended
 * Deletes orphaned rooms (game ended 4+ hours ago or game not found)
 */
export async function cleanupOrphanedRooms() {
  console.log("[gameCleanup] Running orphaned room cleanup...");

  try {
    // Get all active rooms
    const roomsQuery = query(collection(db, "rooms"));
    const roomsSnapshot = await getDocs(roomsQuery);

    if (roomsSnapshot.empty) {
      console.log("[gameCleanup] No rooms to check");
      return { checked: 0, deleted: 0 };
    }

    // Group rooms by gameId
    const roomsByGame = {};
    roomsSnapshot.docs.forEach((docSnap) => {
      const room = { id: docSnap.id, ...docSnap.data() };
      const gameId = room.gameId;
      if (!roomsByGame[gameId]) {
        roomsByGame[gameId] = [];
      }
      roomsByGame[gameId].push(room);
    });

    const gameIds = Object.keys(roomsByGame);
    console.log(`[gameCleanup] Checking ${gameIds.length} games with rooms`);

    // Fetch current games for all sports
    const sports = ["nfl", "nba", "mlb", "nhl", "soccer", "ufc"];
    const allGames = [];

    for (const sport of sports) {
      try {
        const games = await fetchGames(sport);
        allGames.push(...games);
      } catch (e) {
        console.error(`[gameCleanup] Error fetching ${sport} games:`, e);
      }
    }

    // Create a map for quick lookup
    const gameMap = {};
    allGames.forEach((game) => {
      gameMap[game.id] = game;
    });

    let deleted = 0;
    const batch = writeBatch(db);
    const roomsToDelete = [];

    for (const gameId of gameIds) {
      const game = gameMap[gameId];
      const rooms = roomsByGame[gameId];

      if (!game) {
        // Game not found in ESPN data - check room creation time
        // If room is older than 4 hours, delete it
        for (const room of rooms) {
          const createdAt = room.createdAt?.toMillis?.() || room.createdAt?.seconds * 1000 || 0;
          const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;

          if (createdAt < fourHoursAgo) {
            console.log(`[gameCleanup] Orphaned room ${room.id} (game ${gameId} not found, room is old)`);
            batch.delete(doc(db, "rooms", room.id));
            roomsToDelete.push(room.id);
            deleted++;
          }
        }
      } else if (game.isFinal || game.status?.state === "final") {
        // Game has ended - delete all rooms
        console.log(`[gameCleanup] Game ${gameId} is final, deleting ${rooms.length} rooms`);
        for (const room of rooms) {
          batch.delete(doc(db, "rooms", room.id));
          roomsToDelete.push(room.id);
          deleted++;
        }
        finishedGameIds.add(gameId);
        notifyGameEnd(gameId, roomsToDelete);
      }
    }

    if (deleted > 0) {
      await batch.commit();
      console.log(`[gameCleanup] Cleanup complete: ${deleted} rooms deleted`);
    } else {
      console.log("[gameCleanup] No orphaned rooms found");
    }

    return { checked: roomsSnapshot.size, deleted };
  } catch (error) {
    console.error("[gameCleanup] Cleanup error:", error);
    return { checked: 0, deleted: 0, error };
  }
}

/**
 * Start monitoring games for completion
 * Call this when the app loads
 * @param {Function} getGamesBySport - Function that returns current games by sport
 * @param {number} interval - Check interval in ms (default 30 seconds)
 */
export function startGameMonitor(getGamesBySport, interval = 30000) {
  console.log("[gameCleanup] Starting game monitor...");

  // Run initial cleanup
  cleanupOrphanedRooms();

  // Set up periodic check
  const checkGames = async () => {
    try {
      const gamesBySport = getGamesBySport();
      const allGames = Object.values(gamesBySport).flat();

      if (allGames.length > 0) {
        await checkAndCleanupGames(allGames);
      }
    } catch (e) {
      console.error("[gameCleanup] Monitor error:", e);
    }
  };

  const intervalId = setInterval(checkGames, interval);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
    console.log("[gameCleanup] Game monitor stopped");
  };
}

/**
 * Check if a specific game has ended
 * @param {string} gameId - The ESPN game ID
 * @param {string} sport - The sport type
 */
export async function isGameEnded(gameId, sport) {
  try {
    const games = await fetchGames(sport);
    const game = games.find((g) => g.id === gameId);

    if (!game) {
      // Game not found - might be old, check if rooms exist
      return true; // Assume ended if not in current data
    }

    return game.isFinal || game.status?.state === "final";
  } catch (error) {
    console.error("[gameCleanup] Error checking game status:", error);
    return false;
  }
}

/**
 * Force cleanup of a specific game's rooms
 * Called from admin or when game end is detected
 */
export async function forceCleanupGame(gameId) {
  console.log(`[gameCleanup] Force cleanup for game ${gameId}`);
  const deletedRooms = await deleteRoomsForGame(gameId);
  finishedGameIds.add(gameId);

  if (deletedRooms.length > 0) {
    notifyGameEnd(gameId, deletedRooms);
  }

  return deletedRooms;
}

export default {
  deleteRoomsForGame,
  checkAndCleanupGames,
  cleanupOrphanedRooms,
  startGameMonitor,
  isGameEnded,
  forceCleanupGame,
  onGameEnd,
};
