// src/services/adminService.js
// Comprehensive admin functionality for SlipRooms

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
  getDocs,
  limit,
  Timestamp,
  writeBatch,
  increment,
} from "firebase/firestore";
import { db } from "../firebase";

// ==================== ADMIN SETTINGS ====================

/**
 * Get admin settings (room approval mode, etc.)
 */
export async function getAdminSettings() {
  try {
    const settingsRef = doc(db, "settings", "admin");
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      return snap.data();
    }
    // Return defaults if not set
    return {
      roomApprovalMode: false,
      topSweatBanner: null,
    };
  } catch (error) {
    console.error("[getAdminSettings] Error:", error);
    return { roomApprovalMode: false, topSweatBanner: null };
  }
}

/**
 * Update admin settings
 */
export async function updateAdminSettings(settings) {
  try {
    const settingsRef = doc(db, "settings", "admin");
    await setDoc(settingsRef, {
      ...settings,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    return { success: true };
  } catch (error) {
    console.error("[updateAdminSettings] Error:", error);
    throw error;
  }
}

/**
 * Subscribe to admin settings changes
 */
export function subscribeToAdminSettings(callback) {
  const settingsRef = doc(db, "settings", "admin");
  return onSnapshot(settingsRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data());
    } else {
      callback({ roomApprovalMode: false, topSweatBanner: null });
    }
  });
}

// ==================== ROOM MANAGEMENT ====================

/**
 * Pin/unpin a room (pinned rooms show at top of trending)
 */
export async function toggleRoomPin(roomId, pinned, adminId) {
  try {
    const roomRef = doc(db, "rooms", roomId);
    await updateDoc(roomRef, {
      pinned: pinned,
      pinnedAt: pinned ? serverTimestamp() : null,
      pinnedBy: pinned ? adminId : null,
    });
    await logAdminAction(adminId, pinned ? "pin_room" : "unpin_room", { roomId });
    return { success: true };
  } catch (error) {
    console.error("[toggleRoomPin] Error:", error);
    throw error;
  }
}

/**
 * Lock/unlock a room (locked = read-only)
 */
export async function toggleRoomLock(roomId, locked, adminId) {
  try {
    const roomRef = doc(db, "rooms", roomId);
    await updateDoc(roomRef, {
      locked: locked,
      lockedAt: locked ? serverTimestamp() : null,
      lockedBy: locked ? adminId : null,
    });
    await logAdminAction(adminId, locked ? "lock_room" : "unlock_room", { roomId });
    return { success: true };
  } catch (error) {
    console.error("[toggleRoomLock] Error:", error);
    throw error;
  }
}

/**
 * Archive a room
 */
export async function archiveRoom(roomId, adminId) {
  try {
    const roomRef = doc(db, "rooms", roomId);
    await updateDoc(roomRef, {
      status: "archived",
      archivedAt: serverTimestamp(),
      archivedBy: adminId,
    });
    await logAdminAction(adminId, "archive_room", { roomId });
    return { success: true };
  } catch (error) {
    console.error("[archiveRoom] Error:", error);
    throw error;
  }
}

/**
 * Delete a room permanently
 */
export async function deleteRoom(roomId, adminId) {
  try {
    // Get room info for logging before deleting
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);
    const roomName = roomSnap.exists() ? roomSnap.data().name : roomId;

    await deleteDoc(roomRef);
    await logAdminAction(adminId, "delete_room", { roomId, roomName });
    return { success: true };
  } catch (error) {
    console.error("[deleteRoom] Error:", error);
    throw error;
  }
}

/**
 * Subscribe to all rooms (for admin management)
 */
export function subscribeToAllRooms(callback) {
  const q = query(
    collection(db, "rooms"),
    orderBy("userCount", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const rooms = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(rooms);
  });
}

// ==================== USER MANAGEMENT ====================

/**
 * Get all users
 */
export function subscribeToAllUsers(callback) {
  const q = query(
    collection(db, "users"),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(users);
  });
}

/**
 * Mute a user
 * @param {string} userId - User to mute
 * @param {number} duration - Duration in minutes (0 = permanent)
 * @param {string} adminId - Admin performing the action
 * @param {string} reason - Reason for mute
 */
export async function muteUser(userId, duration, adminId, reason = "") {
  try {
    const userRef = doc(db, "users", userId);
    const muteUntil = duration > 0
      ? Timestamp.fromDate(new Date(Date.now() + duration * 60 * 1000))
      : null; // null = permanent

    await updateDoc(userRef, {
      muted: true,
      muteUntil: muteUntil,
      mutedAt: serverTimestamp(),
      mutedBy: adminId,
      muteReason: reason,
    });

    // Get username for logging
    const userSnap = await getDoc(userRef);
    const username = userSnap.exists() ? userSnap.data().username : userId;

    await logAdminAction(adminId, "mute_user", {
      userId,
      username,
      duration: duration > 0 ? `${duration} minutes` : "permanent",
      reason
    });
    return { success: true };
  } catch (error) {
    console.error("[muteUser] Error:", error);
    throw error;
  }
}

/**
 * Unmute a user
 */
export async function unmuteUser(userId, adminId) {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      muted: false,
      muteUntil: null,
      mutedAt: null,
      mutedBy: null,
      muteReason: null,
    });

    const userSnap = await getDoc(userRef);
    const username = userSnap.exists() ? userSnap.data().username : userId;

    await logAdminAction(adminId, "unmute_user", { userId, username });
    return { success: true };
  } catch (error) {
    console.error("[unmuteUser] Error:", error);
    throw error;
  }
}

/**
 * Ban a user
 * @param {string} userId - User to ban
 * @param {number} duration - Duration in minutes (0 = permanent)
 * @param {string} adminId - Admin performing the action
 * @param {string} reason - Reason for ban
 */
export async function banUser(userId, duration, adminId, reason = "") {
  try {
    const userRef = doc(db, "users", userId);
    const banUntil = duration > 0
      ? Timestamp.fromDate(new Date(Date.now() + duration * 60 * 1000))
      : null; // null = permanent

    await updateDoc(userRef, {
      banned: true,
      banUntil: banUntil,
      bannedAt: serverTimestamp(),
      bannedBy: adminId,
      banReason: reason,
    });

    const userSnap = await getDoc(userRef);
    const username = userSnap.exists() ? userSnap.data().username : userId;

    await logAdminAction(adminId, "ban_user", {
      userId,
      username,
      duration: duration > 0 ? `${duration} minutes` : "permanent",
      reason
    });
    return { success: true };
  } catch (error) {
    console.error("[banUser] Error:", error);
    throw error;
  }
}

/**
 * Unban a user
 */
export async function unbanUser(userId, adminId) {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      banned: false,
      banUntil: null,
      bannedAt: null,
      bannedBy: null,
      banReason: null,
    });

    const userSnap = await getDoc(userRef);
    const username = userSnap.exists() ? userSnap.data().username : userId;

    await logAdminAction(adminId, "unban_user", { userId, username });
    return { success: true };
  } catch (error) {
    console.error("[unbanUser] Error:", error);
    throw error;
  }
}

/**
 * Check if user is muted (and if mute has expired)
 */
export async function checkUserMuteStatus(userId) {
  try {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);

    if (!snap.exists()) return { muted: false };

    const data = snap.data();
    if (!data.muted) return { muted: false };

    // Check if temporary mute has expired
    if (data.muteUntil) {
      const muteUntil = data.muteUntil.toDate();
      if (muteUntil <= new Date()) {
        // Mute expired, auto-unmute
        await updateDoc(userRef, {
          muted: false,
          muteUntil: null,
        });
        return { muted: false };
      }
      return { muted: true, until: muteUntil, reason: data.muteReason };
    }

    // Permanent mute
    return { muted: true, permanent: true, reason: data.muteReason };
  } catch (error) {
    console.error("[checkUserMuteStatus] Error:", error);
    return { muted: false };
  }
}

/**
 * Check if user is banned (and if ban has expired)
 */
export async function checkUserBanStatus(userId) {
  try {
    const userRef = doc(db, "users", userId);
    const snap = await getDoc(userRef);

    if (!snap.exists()) return { banned: false };

    const data = snap.data();
    if (!data.banned) return { banned: false };

    // Check if temporary ban has expired
    if (data.banUntil) {
      const banUntil = data.banUntil.toDate();
      if (banUntil <= new Date()) {
        // Ban expired, auto-unban
        await updateDoc(userRef, {
          banned: false,
          banUntil: null,
        });
        return { banned: false };
      }
      return { banned: true, until: banUntil, reason: data.banReason };
    }

    // Permanent ban
    return { banned: true, permanent: true, reason: data.banReason };
  } catch (error) {
    console.error("[checkUserBanStatus] Error:", error);
    return { banned: false };
  }
}

/**
 * Fully delete a user account (admin action)
 * Removes user doc, username reservation, and logs the action
 */
export async function adminDeleteUser(userId, adminId) {
  try {
    // Get user data first for logging
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error("User not found");
    }

    const userData = userSnap.data();
    const username = userData.username || "";

    // Delete username reservation
    if (username) {
      const usernameLower = username.toLowerCase();
      try {
        await deleteDoc(doc(db, "usernames", usernameLower));
      } catch (e) {
        // Ignore if doesn't exist
      }
    }

    // Delete user document
    await deleteDoc(userRef);

    // Log the action
    await logAdminAction(adminId, "delete_user_account", {
      userId,
      username,
      email: userData.email,
    });

    return { success: true, username };
  } catch (error) {
    console.error("[adminDeleteUser] Error:", error);
    throw error;
  }
}

// ==================== MESSAGE MANAGEMENT ====================

/**
 * Delete a message
 */
export async function deleteMessage(roomId, messageId, adminId) {
  try {
    const messageRef = doc(db, "rooms", roomId, "messages", messageId);
    const messageSnap = await getDoc(messageRef);
    const messageData = messageSnap.exists() ? messageSnap.data() : {};

    await deleteDoc(messageRef);

    await logAdminAction(adminId, "delete_message", {
      roomId,
      messageId,
      messageText: messageData.text?.substring(0, 50) || "[media]",
      messageAuthor: messageData.username,
    });
    return { success: true };
  } catch (error) {
    console.error("[deleteMessage] Error:", error);
    throw error;
  }
}

/**
 * Send system announcement to a room
 */
export async function sendAnnouncement(roomId, text, adminId) {
  try {
    const messagesRef = collection(db, "rooms", roomId, "messages");
    const messageId = `announcement-${Date.now()}`;

    await setDoc(doc(messagesRef, messageId), {
      id: messageId,
      type: "announcement",
      text: text,
      username: "SYSTEM",
      oddie: "📢",
      createdAt: serverTimestamp(),
      isAnnouncement: true,
      adminId: adminId,
    });

    await logAdminAction(adminId, "send_announcement", { roomId, text });
    return { success: true };
  } catch (error) {
    console.error("[sendAnnouncement] Error:", error);
    throw error;
  }
}

/**
 * Send announcement to all rooms
 */
export async function sendGlobalAnnouncement(text, adminId) {
  try {
    const roomsSnap = await getDocs(query(
      collection(db, "rooms"),
      where("status", "!=", "archived")
    ));

    const batch = writeBatch(db);
    let count = 0;

    roomsSnap.docs.forEach((roomDoc) => {
      const messagesRef = collection(db, "rooms", roomDoc.id, "messages");
      const messageId = `announcement-${Date.now()}-${count}`;

      batch.set(doc(messagesRef, messageId), {
        id: messageId,
        type: "announcement",
        text: text,
        username: "SYSTEM",
        oddie: "📢",
        createdAt: serverTimestamp(),
        isAnnouncement: true,
        adminId: adminId,
      });
      count++;
    });

    await batch.commit();
    await logAdminAction(adminId, "send_global_announcement", { text, roomCount: count });
    return { success: true, roomCount: count };
  } catch (error) {
    console.error("[sendGlobalAnnouncement] Error:", error);
    throw error;
  }
}

// ==================== ADMIN MANAGEMENT ====================

/**
 * Get all admins
 */
export async function getAllAdmins() {
  try {
    const q = query(
      collection(db, "users"),
      where("isAdmin", "==", true)
    );
    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("[getAllAdmins] Error:", error);
    return [];
  }
}

/**
 * Subscribe to admin list
 */
export function subscribeToAdmins(callback) {
  const q = query(
    collection(db, "users"),
    where("isAdmin", "==", true)
  );
  return onSnapshot(q, (snapshot) => {
    const admins = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    callback(admins);
  });
}

/**
 * Add admin status to a user
 */
export async function addAdmin(userId, adminId) {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      isAdmin: true,
      adminSince: serverTimestamp(),
      promotedBy: adminId,
    });

    const userSnap = await getDoc(userRef);
    const username = userSnap.exists() ? userSnap.data().username : userId;

    await logAdminAction(adminId, "add_admin", { userId, username });
    return { success: true };
  } catch (error) {
    console.error("[addAdmin] Error:", error);
    throw error;
  }
}

/**
 * Remove admin status from a user
 */
export async function removeAdmin(userId, adminId) {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    const username = userSnap.exists() ? userSnap.data().username : userId;

    await updateDoc(userRef, {
      isAdmin: false,
      adminSince: null,
      promotedBy: null,
    });

    await logAdminAction(adminId, "remove_admin", { userId, username });
    return { success: true };
  } catch (error) {
    console.error("[removeAdmin] Error:", error);
    throw error;
  }
}

// ==================== ADMIN ACTIVITY LOG ====================

/**
 * Log an admin action
 */
export async function logAdminAction(adminId, action, details = {}) {
  try {
    const logsRef = collection(db, "adminLogs");
    const logId = `${Date.now()}-${adminId}`;

    // Get admin username
    const adminRef = doc(db, "users", adminId);
    const adminSnap = await getDoc(adminRef);
    const adminUsername = adminSnap.exists() ? adminSnap.data().username : adminId;

    await setDoc(doc(logsRef, logId), {
      id: logId,
      adminId,
      adminUsername,
      action,
      details,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("[logAdminAction] Error:", error);
    // Don't throw - logging failures shouldn't break the main action
  }
}

/**
 * Subscribe to admin activity logs
 */
export function subscribeToAdminLogs(callback, limitCount = 100) {
  const q = query(
    collection(db, "adminLogs"),
    orderBy("timestamp", "desc"),
    limit(limitCount)
  );

  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(logs);
  });
}

// ==================== STATS ====================

/**
 * Get dashboard stats
 */
export async function getDashboardStats() {
  try {
    // Get active rooms count
    const roomsSnap = await getDocs(query(
      collection(db, "rooms"),
      where("status", "!=", "archived")
    ));
    const activeRooms = roomsSnap.size;

    // Get total users count
    const usersSnap = await getDocs(collection(db, "users"));
    const totalUsers = usersSnap.size;

    // Get today's messages (approximate - count rooms with recent activity)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(today);

    // Count total messages across all rooms (this is expensive, so we'll estimate)
    let totalMessages = 0;
    let messagesToday = 0;

    // Get top rooms for most active
    const topRoomsSnap = await getDocs(query(
      collection(db, "rooms"),
      orderBy("userCount", "desc"),
      limit(1)
    ));
    const mostActiveRoom = topRoomsSnap.docs[0]?.data() || null;

    return {
      activeRooms,
      totalUsers,
      totalMessages,
      messagesToday,
      mostActiveRoom: mostActiveRoom ? {
        id: topRoomsSnap.docs[0].id,
        name: mostActiveRoom.name,
        userCount: mostActiveRoom.userCount || 0,
      } : null,
    };
  } catch (error) {
    console.error("[getDashboardStats] Error:", error);
    return {
      activeRooms: 0,
      totalUsers: 0,
      totalMessages: 0,
      messagesToday: 0,
      mostActiveRoom: null,
    };
  }
}

/**
 * Get online users count (users with recent presence)
 */
export async function getOnlineUsersCount() {
  try {
    const fiveMinAgo = Timestamp.fromDate(new Date(Date.now() - 5 * 60 * 1000));
    const presenceSnap = await getDocs(query(
      collection(db, "presence"),
      where("lastSeen", ">=", fiveMinAgo)
    ));
    return presenceSnap.size;
  } catch (error) {
    console.error("[getOnlineUsersCount] Error:", error);
    return 0;
  }
}

// ==================== TOP SWEAT BANNER ====================

/**
 * Set the top sweat banner content
 */
export async function setTopSweatBanner(roomId, customText, adminId) {
  try {
    const settingsRef = doc(db, "settings", "admin");
    await setDoc(settingsRef, {
      topSweatBanner: {
        roomId: roomId || null,
        customText: customText || null,
        setAt: serverTimestamp(),
        setBy: adminId,
      },
    }, { merge: true });

    await logAdminAction(adminId, "set_top_sweat", { roomId, customText });
    return { success: true };
  } catch (error) {
    console.error("[setTopSweatBanner] Error:", error);
    throw error;
  }
}

/**
 * Clear the top sweat banner
 */
export async function clearTopSweatBanner(adminId) {
  try {
    const settingsRef = doc(db, "settings", "admin");
    await setDoc(settingsRef, {
      topSweatBanner: null,
    }, { merge: true });

    await logAdminAction(adminId, "clear_top_sweat", {});
    return { success: true };
  } catch (error) {
    console.error("[clearTopSweatBanner] Error:", error);
    throw error;
  }
}

export default {
  // Settings
  getAdminSettings,
  updateAdminSettings,
  subscribeToAdminSettings,
  // Room Management
  toggleRoomPin,
  toggleRoomLock,
  archiveRoom,
  deleteRoom,
  subscribeToAllRooms,
  // User Management
  subscribeToAllUsers,
  muteUser,
  unmuteUser,
  banUser,
  unbanUser,
  checkUserMuteStatus,
  checkUserBanStatus,
  // Message Management
  deleteMessage,
  sendAnnouncement,
  sendGlobalAnnouncement,
  // Admin Management
  getAllAdmins,
  subscribeToAdmins,
  addAdmin,
  removeAdmin,
  // Logs
  logAdminAction,
  subscribeToAdminLogs,
  // Stats
  getDashboardStats,
  getOnlineUsersCount,
  // Top Sweat
  setTopSweatBanner,
  clearTopSweatBanner,
};
