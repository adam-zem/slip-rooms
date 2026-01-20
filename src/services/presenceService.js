// src/services/presenceService.js
// Handles real-time user presence tracking with heartbeats and automatic cleanup
// Uses Firestore for heartbeats (RTDB optional for onDisconnect)

import { rtdb, db } from "../firebase";
import {
  ref,
  set,
  onDisconnect,
  remove,
  get,
} from "firebase/database";
import {
  doc,
  updateDoc,
  getDoc,
  collection,
  getDocs,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";

// Constants
const HEARTBEAT_INTERVAL = 15000; // 15 seconds
const PRESENCE_TIMEOUT = 30000; // 30 seconds - consider user gone if no heartbeat
const CLEANUP_INTERVAL = 60000; // 1 minute - run cleanup periodically

// Store active heartbeat intervals
let heartbeatInterval = null;
let cleanupInterval = null;
let currentRoomId = null;
let currentUserId = null;
let rtdbAvailable = false; // RTDB disabled - using Firestore only

/**
 * Join a room with presence tracking
 * Sets up onDisconnect handler (if RTDB available) and starts heartbeat
 */
export async function joinRoomWithPresence(roomId, userId) {
  if (!roomId || !userId) {
    console.warn("[Presence] joinRoomWithPresence called with missing params:", { roomId, userId });
    return;
  }

  console.log(`[Presence] Joining room ${roomId} as user ${userId}`);

  // Leave previous room if any
  if (currentRoomId && currentRoomId !== roomId) {
    console.log(`[Presence] Leaving previous room ${currentRoomId}`);
    await leaveRoomWithPresence(currentRoomId, currentUserId);
  }

  currentRoomId = roomId;
  currentUserId = userId;

  const now = Date.now();

  // Try to set up RTDB presence (optional - may not be available)
  if (rtdbAvailable) {
    try {
      const presenceRef = ref(rtdb, `presence/${roomId}/${userId}`);
      await set(presenceRef, {
        oddie: userId,
        joinedAt: now,
        lastHeartbeat: now,
      });
      // Set up onDisconnect to automatically remove when user disconnects
      await onDisconnect(presenceRef).remove();
    } catch (error) {
      console.warn("[Presence] RTDB not available, using Firestore-only mode:", error.message);
      rtdbAvailable = false;
    }
  }

  // Update Firestore room with user in activeUsers and heartbeat
  await addUserToRoom(roomId, userId);

  // Start heartbeat (uses Firestore)
  startHeartbeat(roomId, userId);

  // Note: Don't start cleanup interval here - let it be managed by App.real.jsx
  // to avoid race conditions on page load

  console.log(`[Presence] Successfully joined room ${roomId}`);
}

/**
 * Leave a room - removes presence and stops heartbeat
 */
export async function leaveRoomWithPresence(roomId, userId) {
  if (!roomId || !userId) return;

  try {
    // Remove from Realtime Database (if available)
    if (rtdbAvailable) {
      try {
        const presenceRef = ref(rtdb, `presence/${roomId}/${userId}`);
        await remove(presenceRef);
      } catch (error) {
        // Ignore RTDB errors
      }
    }

    // Remove from Firestore activeUsers and decrement count
    await removeUserFromRoom(roomId, userId);

    // Stop heartbeat if leaving current room
    if (roomId === currentRoomId) {
      stopHeartbeat();
      currentRoomId = null;
      currentUserId = null;
    }

    console.log(`[Presence] Left room ${roomId}`);
  } catch (error) {
    console.error("[Presence] Error leaving room:", error);
  }
}

/**
 * Send a heartbeat to indicate user is still active
 * Uses Firestore to store heartbeat in room document
 */
async function sendHeartbeat(roomId, userId) {
  if (!roomId || !userId) return;

  const now = Date.now();

  try {
    // Update heartbeat in Firestore room
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (roomSnap.exists()) {
      const roomData = roomSnap.data();
      const heartbeats = roomData.heartbeats || {};
      heartbeats[userId] = now;

      await updateDoc(roomRef, { heartbeats });
    }

    // Also update RTDB if available
    if (rtdbAvailable) {
      try {
        const presenceRef = ref(rtdb, `presence/${roomId}/${userId}`);
        await set(presenceRef, {
          oddie: userId,
          lastHeartbeat: now,
        });
      } catch (error) {
        // Ignore RTDB errors
      }
    }
  } catch (error) {
    console.error("[Presence] Heartbeat error:", error);
  }
}

/**
 * Start the heartbeat interval
 */
function startHeartbeat(roomId, userId) {
  stopHeartbeat(); // Clear any existing interval

  heartbeatInterval = setInterval(() => {
    sendHeartbeat(roomId, userId);
  }, HEARTBEAT_INTERVAL);
}

/**
 * Stop the heartbeat interval
 */
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Start the cleanup interval (runs once globally)
 */
function startCleanupInterval() {
  if (cleanupInterval) return; // Already running

  cleanupInterval = setInterval(() => {
    cleanupStalePresence();
  }, CLEANUP_INTERVAL);
}

/**
 * Add user to Firestore room activeUsers with initial heartbeat
 */
async function addUserToRoom(roomId, userId) {
  console.log(`[Presence] addUserToRoom called - roomId: ${roomId}, userId: ${userId}`);

  try {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      console.warn("[Presence] Room does not exist:", roomId);
      return;
    }

    const roomData = roomSnap.data();
    console.log(`[Presence] Current room data:`, {
      name: roomData.name,
      currentUserCount: roomData.userCount,
      currentActiveUsers: roomData.activeUsers,
      hasHeartbeats: !!roomData.heartbeats,
    });

    const activeUsers = roomData.activeUsers || [];
    const heartbeats = roomData.heartbeats || {};
    const now = Date.now();

    // Set heartbeat even if already in room (refresh it)
    heartbeats[userId] = now;

    // Only increment count if not already present
    const isNewUser = !activeUsers.includes(userId);
    const newActiveUsers = isNewUser ? [...activeUsers, userId] : activeUsers;
    const newCount = isNewUser ? (roomData.userCount || 0) + 1 : (roomData.userCount || 0);

    console.log(`[Presence] Updating room - isNewUser: ${isNewUser}, newCount: ${Math.max(1, newCount)}, newActiveUsers:`, newActiveUsers);

    await updateDoc(roomRef, {
      activeUsers: newActiveUsers,
      userCount: Math.max(1, newCount), // At least 1 if we're joining
      heartbeats: heartbeats,
      lastActivity: serverTimestamp(), // Keep room in trending list
    });

    console.log(`[Presence] Successfully updated room ${roomId} - userCount now: ${Math.max(1, newCount)}`);
  } catch (error) {
    console.error("[Presence] Error adding user to room:", error);
    console.error("[Presence] Error details:", error.message, error.code);
  }
}

/**
 * Remove user from Firestore room activeUsers and heartbeats
 */
async function removeUserFromRoom(roomId, userId) {
  try {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) return;

    const roomData = roomSnap.data();
    const activeUsers = roomData.activeUsers || [];
    const heartbeats = roomData.heartbeats || {};

    // Only remove if present
    if (!activeUsers.includes(userId)) return;

    const newActiveUsers = activeUsers.filter((id) => id !== userId);
    const newCount = Math.max(0, (roomData.userCount || 1) - 1);

    // Remove heartbeat
    delete heartbeats[userId];

    await updateDoc(roomRef, {
      activeUsers: newActiveUsers,
      userCount: newCount,
      heartbeats: heartbeats,
    });

    console.log(`[Presence] Removed user ${userId} from room ${roomId}, count: ${newCount}`);
  } catch (error) {
    console.error("[Presence] Error removing user from room:", error);
  }
}

/**
 * Get active user count for a room (based on recent heartbeats in Firestore)
 */
export async function getActiveUserCount(roomId) {
  if (!roomId) return 0;

  const now = Date.now();

  try {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) return 0;

    const roomData = roomSnap.data();
    const heartbeats = roomData.heartbeats || {};
    let activeCount = 0;

    Object.values(heartbeats).forEach((lastHeartbeat) => {
      if (now - lastHeartbeat < PRESENCE_TIMEOUT) {
        activeCount++;
      }
    });

    return activeCount;
  } catch (error) {
    console.error("[Presence] Error getting active count:", error);
    return 0;
  }
}

/**
 * Clean up stale presence entries across all rooms
 * Uses Firestore heartbeats to determine stale users
 */
export async function cleanupStalePresence() {
  const now = Date.now();

  try {
    // Get all rooms from Firestore
    const roomsRef = collection(db, "rooms");
    const roomsSnap = await getDocs(roomsRef);

    for (const roomDoc of roomsSnap.docs) {
      const roomData = roomDoc.data();
      const heartbeats = roomData.heartbeats || {};
      const activeUsers = roomData.activeUsers || [];

      // Find stale users (in activeUsers but no recent heartbeat)
      const staleUsers = [];
      const activeUserIds = [];

      activeUsers.forEach((userId) => {
        const lastHeartbeat = heartbeats[userId];
        if (!lastHeartbeat || now - lastHeartbeat > PRESENCE_TIMEOUT) {
          staleUsers.push(userId);
        } else {
          activeUserIds.push(userId);
        }
      });

      // Also check heartbeats for users not in activeUsers (cleanup orphans)
      const cleanedHeartbeats = {};
      Object.entries(heartbeats).forEach(([oddie, lastHeartbeat]) => {
        if (now - lastHeartbeat < PRESENCE_TIMEOUT) {
          cleanedHeartbeats[oddie] = lastHeartbeat;
          if (!activeUserIds.includes(oddie)) {
            activeUserIds.push(oddie);
          }
        }
      });

      // Update room if there are changes
      if (staleUsers.length > 0 || activeUserIds.length !== activeUsers.length) {
        await updateDoc(doc(db, "rooms", roomDoc.id), {
          activeUsers: activeUserIds,
          userCount: activeUserIds.length,
          heartbeats: cleanedHeartbeats,
        });

        if (staleUsers.length > 0) {
          console.log(`[Presence] Cleaned up ${staleUsers.length} stale users from room ${roomDoc.id}`);
        }
      }
    }
  } catch (error) {
    console.error("[Presence] Cleanup error:", error);
  }
}

/**
 * Sync all Firestore room counts based on heartbeats
 * Cleans up stale data and resets counts to accurate values
 */
export async function syncAllRoomCounts() {
  const now = Date.now();

  try {
    // Get all rooms from Firestore
    const roomsRef = collection(db, "rooms");
    const roomsSnap = await getDocs(roomsRef);

    const batch = writeBatch(db);

    for (const roomDoc of roomsSnap.docs) {
      const roomData = roomDoc.data();
      const heartbeats = roomData.heartbeats || {};

      // Count active users based on recent heartbeats
      let activeCount = 0;
      const activeUserIds = [];
      const cleanedHeartbeats = {};

      Object.entries(heartbeats).forEach(([oddie, lastHeartbeat]) => {
        if (now - lastHeartbeat < PRESENCE_TIMEOUT) {
          activeCount++;
          activeUserIds.push(oddie);
          cleanedHeartbeats[oddie] = lastHeartbeat;
        }
      });

      // Update Firestore with accurate count
      batch.update(doc(db, "rooms", roomDoc.id), {
        userCount: activeCount,
        activeUsers: activeUserIds,
        heartbeats: cleanedHeartbeats,
      });
    }

    await batch.commit();
    console.log("[Presence] Synced all room counts");
  } catch (error) {
    console.error("[Presence] Error syncing room counts:", error);
  }
}

/**
 * Reset all room counts to 0 (for initial cleanup)
 */
export async function resetAllRoomCounts() {
  try {
    // Clear RTDB presence if available
    if (rtdbAvailable) {
      try {
        const presenceRef = ref(rtdb, "presence");
        await remove(presenceRef);
      } catch (error) {
        // Ignore RTDB errors
      }
    }

    // Reset all Firestore room counts
    const roomsRef = collection(db, "rooms");
    const roomsSnap = await getDocs(roomsRef);

    const batch = writeBatch(db);

    roomsSnap.docs.forEach((roomDoc) => {
      batch.update(doc(db, "rooms", roomDoc.id), {
        userCount: 0,
        activeUsers: [],
        heartbeats: {},
      });
    });

    await batch.commit();
    console.log("[Presence] Reset all room counts to 0");
  } catch (error) {
    console.error("[Presence] Error resetting room counts:", error);
  }
}

/**
 * Cleanup function to call when user leaves the page
 */
export function cleanupOnUnload() {
  // Try to remove from RTDB if available
  if (rtdbAvailable && currentRoomId && currentUserId) {
    try {
      const presenceRef = ref(rtdb, `presence/${currentRoomId}/${currentUserId}`);
      remove(presenceRef).catch(() => {});
    } catch (error) {
      // Ignore errors
    }
  }
  stopHeartbeat();
}

// Set up beforeunload handler
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", cleanupOnUnload);
}

export default {
  joinRoomWithPresence,
  leaveRoomWithPresence,
  getActiveUserCount,
  cleanupStalePresence,
  syncAllRoomCounts,
  resetAllRoomCounts,
  cleanupOnUnload,
};
