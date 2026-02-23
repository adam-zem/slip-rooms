// src/services/recentRoomsService.js
// Manages recently visited rooms using localStorage

const RECENT_ROOMS_KEY = "sliprooms_recent_rooms";
const MAX_RECENT_ROOMS = 8;
const EXPIRATION_MS = 20 * 60 * 1000; // 20 minutes

/**
 * Get all recent rooms, filtering out expired ones
 */
export function getRecentRooms() {
  try {
    const stored = localStorage.getItem(RECENT_ROOMS_KEY);
    if (!stored) return [];

    const rooms = JSON.parse(stored);
    const now = Date.now();

    // Filter out expired rooms (older than 20 minutes)
    const validRooms = rooms.filter((room) => now - room.visitedAt < EXPIRATION_MS);

    // If we filtered some out, save the updated list
    if (validRooms.length !== rooms.length) {
      localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(validRooms));
    }

    return validRooms;
  } catch (error) {
    console.log("[RecentRooms] Error getting recent rooms:", error);
    return [];
  }
}

/**
 * Add or update a room in the recent list
 */
export function addRecentRoom(room) {
  try {
    const currentRooms = getRecentRooms();
    const now = Date.now();

    // Remove if already exists (we'll add it to the front)
    const filtered = currentRooms.filter((r) => r.id !== room.id);

    // Add to front of list
    const newRoom = {
      id: room.id,
      name: room.name,
      gameName: room.gameName || room.game || "",
      sport: room.sport || "",
      visitedAt: now,
    };

    const updated = [newRoom, ...filtered].slice(0, MAX_RECENT_ROOMS);

    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.log("[RecentRooms] Error adding recent room:", error);
  }
}

/**
 * Remove a specific room from the recent list
 */
export function removeRecentRoom(roomId) {
  try {
    const currentRooms = getRecentRooms();
    const filtered = currentRooms.filter((r) => r.id !== roomId);

    localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.log("[RecentRooms] Error removing recent room:", error);
  }
}

/**
 * Clear all recent rooms
 */
export function clearRecentRooms() {
  try {
    localStorage.removeItem(RECENT_ROOMS_KEY);
  } catch (error) {
    console.log("[RecentRooms] Error clearing recent rooms:", error);
  }
}

/**
 * Remove rooms that no longer exist (pass in current valid room IDs)
 */
export function cleanupDeletedRooms(validRoomIds) {
  try {
    const currentRooms = getRecentRooms();
    const validSet = new Set(validRoomIds);

    const filtered = currentRooms.filter((r) => validSet.has(r.id));

    if (filtered.length !== currentRooms.length) {
      localStorage.setItem(RECENT_ROOMS_KEY, JSON.stringify(filtered));
    }
  } catch (error) {
    console.log("[RecentRooms] Error cleaning up deleted rooms:", error);
  }
}

export default {
  getRecentRooms,
  addRecentRoom,
  removeRecentRoom,
  clearRecentRooms,
  cleanupDeletedRooms,
};
