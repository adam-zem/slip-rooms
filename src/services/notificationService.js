// src/services/notificationService.js
// Notification system for SlipRooms website - handles replies, mentions, likes, etc.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function mapDocToNotification(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    userId: data.userId || "",
    type: data.type || "mention",
    fromUserId: data.fromUserId || "",
    fromUsername: data.fromUsername || "",
    fromAvatar: data.fromAvatar || "🔥",
    fromAvatarColor: data.fromAvatarColor || "green",
    fromProfilePicture: data.fromProfilePicture || null,
    postId: data.postId,
    postText: data.postText,
    message: data.message || "",
    read: data.read || false,
    createdAt: data.createdAt?.toDate?.() || new Date(),
  };
}

// =============================================================================
// CREATE NOTIFICATIONS
// =============================================================================

export async function createNotification({
  userId,
  type,
  fromUserId,
  fromUserData,
  postId,
  postText,
  message,
}) {
  // Don't create notification if user is notifying themselves
  if (userId === fromUserId) {
    return {
      id: "",
      userId,
      type,
      fromUserId,
      fromUsername: fromUserData.username,
      fromAvatar: fromUserData.avatarEmoji,
      fromAvatarColor: fromUserData.avatarColor,
      fromProfilePicture: fromUserData.profilePicture,
      postId,
      postText,
      message,
      read: true,
      createdAt: new Date(),
    };
  }

  const notificationsRef = collection(db, "notifications");
  const docRef = await addDoc(notificationsRef, {
    userId,
    type,
    fromUserId,
    fromUsername: fromUserData.username,
    fromAvatar: fromUserData.avatarEmoji || "🔥",
    fromAvatarColor: fromUserData.avatarColor || "green",
    fromProfilePicture: fromUserData.profilePicture || null,
    postId: postId || null,
    postText: postText ? postText.substring(0, 100) : null,
    message,
    read: false,
    createdAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    userId,
    type,
    fromUserId,
    fromUsername: fromUserData.username,
    fromAvatar: fromUserData.avatarEmoji || "🔥",
    fromAvatarColor: fromUserData.avatarColor || "green",
    fromProfilePicture: fromUserData.profilePicture || null,
    postId,
    postText: postText ? postText.substring(0, 100) : undefined,
    message,
    read: false,
    createdAt: new Date(),
  };
}

/**
 * Create a reply notification
 */
export async function createReplyNotification(
  replyToUserId,
  fromUserId,
  fromUserData,
  postId,
  replyText
) {
  if (replyToUserId === fromUserId) return null;

  return createNotification({
    userId: replyToUserId,
    type: "reply",
    fromUserId,
    fromUserData,
    postId,
    postText: replyText,
    message: `${fromUserData.username} replied to your post`,
  });
}

/**
 * Create mention notifications for all mentioned users
 */
export async function createMentionNotifications(
  mentionedUserIds,
  fromUserId,
  fromUserData,
  postId,
  postText
) {
  for (const userId of mentionedUserIds) {
    if (userId === fromUserId) continue;

    try {
      await createNotification({
        userId,
        type: "mention",
        fromUserId,
        fromUserData,
        postId,
        postText,
        message: `${fromUserData.username} mentioned you`,
      });
    } catch (error) {
      console.error(`[NotificationService] Failed to create mention notification for ${userId}:`, error);
    }
  }
}

/**
 * Create a like notification
 */
export async function createLikeNotification(
  postAuthorId,
  fromUserId,
  fromUserData,
  postId,
  postText
) {
  if (postAuthorId === fromUserId) return null;

  return createNotification({
    userId: postAuthorId,
    type: "like",
    fromUserId,
    fromUserData,
    postId,
    postText,
    message: `${fromUserData.username} liked your post`,
  });
}

// =============================================================================
// GET NOTIFICATIONS
// =============================================================================

/**
 * Get notifications for a user
 */
export async function getNotifications(userId, notificationLimit = 50) {
  const notificationsRef = collection(db, "notifications");

  try {
    const q = query(
      notificationsRef,
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(notificationLimit)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(mapDocToNotification);
  } catch (error) {
    console.log("[NotificationService] Index not ready, using fallback query");
    const fallbackQ = query(
      notificationsRef,
      where("userId", "==", userId),
      limit(notificationLimit)
    );
    const snapshot = await getDocs(fallbackQ);
    const notifications = snapshot.docs.map(mapDocToNotification);
    return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

/**
 * Subscribe to notifications (real-time)
 */
export function subscribeToNotifications(userId, callback, notificationLimit = 50) {
  const notificationsRef = collection(db, "notifications");

  const q = query(
    notificationsRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(notificationLimit)
  );

  let unsubscribeFallback = null;

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs.map(mapDocToNotification);
      callback(notifications);
    },
    (error) => {
      console.log("[NotificationService] Index not ready, using fallback subscription");
      const fallbackQ = query(
        notificationsRef,
        where("userId", "==", userId),
        limit(notificationLimit)
      );

      unsubscribeFallback = onSnapshot(
        fallbackQ,
        (fallbackSnapshot) => {
          const notifications = fallbackSnapshot.docs.map(mapDocToNotification);
          notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          callback(notifications);
        },
        (fallbackError) => {
          console.error("[NotificationService] Subscription failed:", fallbackError);
          callback([]);
        }
      );
    }
  );

  return () => {
    unsubscribe();
    if (unsubscribeFallback) unsubscribeFallback();
  };
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId) {
  const notificationsRef = collection(db, "notifications");

  try {
    const q = query(
      notificationsRef,
      where("userId", "==", userId),
      where("read", "==", false)
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error("[NotificationService] Error getting unread count:", error);
    return 0;
  }
}

/**
 * Subscribe to unread notification count (real-time)
 */
export function subscribeToUnreadCount(userId, callback) {
  const notificationsRef = collection(db, "notifications");

  const q = query(
    notificationsRef,
    where("userId", "==", userId),
    where("read", "==", false)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.size);
    },
    (error) => {
      console.error("[NotificationService] Error subscribing to unread count:", error);
      callback(0);
    }
  );
}

// =============================================================================
// MARK AS READ
// =============================================================================

/**
 * Mark a single notification as read
 */
export async function markAsRead(notificationId) {
  const notificationRef = doc(db, "notifications", notificationId);
  await updateDoc(notificationRef, { read: true });
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId) {
  const notificationsRef = collection(db, "notifications");
  const q = query(
    notificationsRef,
    where("userId", "==", userId),
    where("read", "==", false)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, { read: true });
  });

  await batch.commit();
}

// =============================================================================
// DELETE NOTIFICATIONS
// =============================================================================

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId) {
  const notificationRef = doc(db, "notifications", notificationId);
  await deleteDoc(notificationRef);
}

/**
 * Delete all notifications for a user
 */
export async function deleteAllNotifications(userId) {
  const notificationsRef = collection(db, "notifications");
  const q = query(notificationsRef, where("userId", "==", userId));

  const snapshot = await getDocs(q);

  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  await batch.commit();
}

export default {
  createNotification,
  createReplyNotification,
  createMentionNotifications,
  createLikeNotification,
  getNotifications,
  subscribeToNotifications,
  getUnreadCount,
  subscribeToUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
};
