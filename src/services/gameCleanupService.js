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
      try {
        const deletedRooms = await deleteRoomsForGame(game.id);
        finishedGameIds.add(game.id);
        gamesProcessed++;
        roomsDeleted += deletedRooms.length;

        // Notify listeners
        if (deletedRooms.length > 0) {
          notifyGameEnd(game.id, deletedRooms);
        }
      } catch (error) {
        // Silently handle permission errors - cleanup handled server-side
        if (!error?.message?.includes("permission")) {
          console.warn("[gameCleanup] Error cleaning up game:", game.id);
        }
      }
    }
  }

  return { gamesProcessed, roomsDeleted };
}

/**
 * Get all rooms and check if their associated games have ended
 * Deletes orphaned rooms (game ended 4+ hours ago or game not found)
 * Note: This operation requires admin permissions. Regular users will
 * silently skip cleanup - this is handled server-side by Cloud Functions.
 */
export async function cleanupOrphanedRooms() {
  // Skip cleanup silently for regular users - this prevents permission errors
  // The actual cleanup is handled by Firebase Cloud Functions with admin privileges
  // This client-side version is only for admin users in the app
  try {
    // Get all active rooms
    const roomsQuery = query(collection(db, "rooms"));
    const roomsSnapshot = await getDocs(roomsQuery);

    if (roomsSnapshot.empty) {
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

    // Fetch current games for all sports
    const sports = ["nfl", "nba", "mlb", "nhl", "soccer", "ufc"];
    const allGames = [];

    for (const sport of sports) {
      try {
        const games = await fetchGames(sport);
        allGames.push(...games);
      } catch (e) {
        // Silently ignore fetch errors - not critical for user experience
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
            batch.delete(doc(db, "rooms", room.id));
            roomsToDelete.push(room.id);
            deleted++;
          }
        }
      } else if (game.isFinal || game.status?.state === "final") {
        // Game has ended - delete all rooms
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
    }

    return { checked: roomsSnapshot.size, deleted };
  } catch (error) {
    // Handle permission errors gracefully - regular users can't delete rooms
    // This is expected behavior, not an error to show to users
    if (error?.code === "permission-denied" || error?.message?.includes("permission")) {
      // Silently ignore permission errors - cleanup will be handled server-side
      return { checked: 0, deleted: 0, skipped: true };
    }
    // Log other errors but don't throw - prevent red error screens
    console.warn("[gameCleanup] Cleanup skipped:", error?.message || error);
    return { checked: 0, deleted: 0, error: error?.message };
  }
}

/**
 * Start monitoring games for completion
 * Call this when the app loads
 * @param {Function} getGamesBySport - Function that returns current games by sport
 * @param {number} interval - Check interval in ms (default 30 seconds)
 */
export function startGameMonitor(getGamesBySport, interval = 30000) {
  // Run initial cleanup silently (will be skipped for non-admin users)
  cleanupOrphanedRooms().catch(() => {
    // Silently ignore any errors - cleanup is non-critical for user experience
  });

  // Set up periodic check
  const checkGames = async () => {
    try {
      const gamesBySport = getGamesBySport();
      const allGames = Object.values(gamesBySport).flat();

      if (allGames.length > 0) {
        await checkAndCleanupGames(allGames);
      }
    } catch (e) {
      // Silently ignore errors - cleanup is handled server-side
    }
  };

  const intervalId = setInterval(checkGames, interval);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
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
