// src/services/blockService.js
// Service for blocking/unblocking users - TWO-WAY blocking
// Users I've blocked AND users who have blocked me are all invisible

import { db } from "../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";

/**
 * Block a user
 * - Adds to blocker's blockedUsers array (users I've blocked)
 * - Adds to blocked user's blockedBy array (users who have blocked me)
 * - Removes friendships in both directions
 * - Removes pending friend requests in both directions
 */
export async function blockUser(blockerId, blockedUserId) {
  if (!blockerId || !blockedUserId) {
    throw new Error("Missing user IDs");
  }

  if (blockerId === blockedUserId) {
    throw new Error("Cannot block yourself");
  }

  // Get both user profiles
  const [blockerDoc, blockedUserDoc] = await Promise.all([
    getDoc(doc(db, "users", blockerId)),
    getDoc(doc(db, "users", blockedUserId)),
  ]);

  const blockerData = blockerDoc.exists() ? blockerDoc.data() : {};
  const blockedUserData = blockedUserDoc.exists() ? blockedUserDoc.data() : {};

  // STEP 1: Update blocker's own document (this should always work)
  // This is the most important operation - it ensures the blocker won't see the blocked user
  const blockerRef = doc(db, "users", blockerId);
  await updateDoc(blockerRef, {
    blockedUsers: arrayUnion({
      id: blockedUserId,
      username: blockedUserData.username || "Unknown",
      displayName: blockedUserData.displayName || null,
      profilePicture: blockedUserData.profilePicture || null,
      avatarEmoji: blockedUserData.avatarEmoji || "🔥",
      avatarColor: blockedUserData.avatarColor || "green",
      blockedAt: new Date(),
    }),
  });

  // STEP 2: Try to update blocked user's blockedBy array (for two-way blocking)
  // This might fail if rules don't allow it, but blocking still works one-way
  if (blockedUserDoc.exists()) {
    try {
      const blockedUserRef = doc(db, "users", blockedUserId);
      await updateDoc(blockedUserRef, {
        blockedBy: arrayUnion({
          id: blockerId,
          username: blockerData.username || "Unknown",
          blockedAt: new Date(),
        }),
      });
    } catch (error) {
      // Log but don't fail - one-way blocking still works
      console.warn("[blockService] Could not update blockedBy on target user:", error);
    }
  }

  // STEP 3: Clean up friendships and friend requests in a batch
  // These are optional - if they fail, blocking still works
  try {
    const batch = writeBatch(db);

    // Remove friendships in both directions
    const friendship1Id = `${blockerId}_${blockedUserId}`;
    const friendship2Id = `${blockedUserId}_${blockerId}`;
    batch.delete(doc(db, "friendships", friendship1Id));
    batch.delete(doc(db, "friendships", friendship2Id));

    // Remove any pending friend requests in both directions
    const request1Id = `${blockerId}_${blockedUserId}`;
    const request2Id = `${blockedUserId}_${blockerId}`;
    batch.delete(doc(db, "friendRequests", request1Id));
    batch.delete(doc(db, "friendRequests", request2Id));

    await batch.commit();
  } catch (error) {
    // Log but don't fail - blocking still works even if cleanup fails
    console.warn("[blockService] Could not clean up friendships/requests:", error);
  }
}

/**
 * Unblock a user
 * - Removes from blocker's blockedUsers array
 * - Removes from blocked user's blockedBy array
 */
export async function unblockUser(blockerId, blockedUserId) {
  if (!blockerId || !blockedUserId) {
    throw new Error("Missing user IDs");
  }

  const batch = writeBatch(db);

  // Get both user documents
  const [blockerDoc, blockedUserDoc] = await Promise.all([
    getDoc(doc(db, "users", blockerId)),
    getDoc(doc(db, "users", blockedUserId)),
  ]);

  // Remove from blocker's blockedUsers
  if (blockerDoc.exists()) {
    const blockedUsers = blockerDoc.data().blockedUsers || [];
    const blockedUser = blockedUsers.find((u) => u.id === blockedUserId);

    if (blockedUser) {
      batch.update(doc(db, "users", blockerId), {
        blockedUsers: arrayRemove(blockedUser),
      });
    }
  }

  // Remove from blocked user's blockedBy
  if (blockedUserDoc.exists()) {
    const blockedBy = blockedUserDoc.data().blockedBy || [];
    const blockerEntry = blockedBy.find((u) => u.id === blockerId);

    if (blockerEntry) {
      batch.update(doc(db, "users", blockedUserId), {
        blockedBy: arrayRemove(blockerEntry),
      });
    }
  }

  await batch.commit();
}

/**
 * Check if user A has blocked user B
 */
export async function isUserBlocked(blockerId, targetUserId) {
  if (!blockerId || !targetUserId) return false;

  const blockerDoc = await getDoc(doc(db, "users", blockerId));
  if (!blockerDoc.exists()) return false;

  const blockedUsers = blockerDoc.data().blockedUsers || [];
  return blockedUsers.some((u) => u.id === targetUserId);
}

/**
 * Check if either user has blocked the other (two-way check)
 */
export async function isBlockedEitherWay(userId1, userId2) {
  if (!userId1 || !userId2) return false;

  const [doc1, doc2] = await Promise.all([
    getDoc(doc(db, "users", userId1)),
    getDoc(doc(db, "users", userId2)),
  ]);

  // Check if user1 blocked user2
  if (doc1.exists()) {
    const blockedUsers = doc1.data().blockedUsers || [];
    if (blockedUsers.some((u) => u.id === userId2)) {
      return true;
    }
  }

  // Check if user2 blocked user1
  if (doc2.exists()) {
    const blockedUsers = doc2.data().blockedUsers || [];
    if (blockedUsers.some((u) => u.id === userId1)) {
      return true;
    }
  }

  return false;
}

/**
 * Get list of users I've blocked
 */
export async function getBlockedUsers(userId) {
  if (!userId) return [];

  const userDoc = await getDoc(doc(db, "users", userId));
  if (!userDoc.exists()) return [];

  const blockedUsers = userDoc.data().blockedUsers || [];

  // Convert Firestore timestamps to Dates
  return blockedUsers.map((u) => ({
    ...u,
    blockedAt: u.blockedAt?.toDate?.() || new Date(u.blockedAt),
  }));
}

/**
 * Get complete set of user IDs that should be hidden from the current user
 * This includes: users I've blocked + users who have blocked me
 */
export async function getAllBlockedUserIds(userId) {
  if (!userId) return new Set();

  const userDoc = await getDoc(doc(db, "users", userId));
  if (!userDoc.exists()) return new Set();

  const data = userDoc.data();
  const blockedUsers = data.blockedUsers || [];
  const blockedBy = data.blockedBy || [];

  const allBlocked = new Set();

  // Add users I've blocked
  blockedUsers.forEach((u) => allBlocked.add(u.id));

  // Add users who have blocked me
  blockedBy.forEach((u) => allBlocked.add(u.id));

  return allBlocked;
}

/**
 * Check block relationship for profile view
 * Returns: { iBlocked: boolean, theyBlockedMe: boolean }
 */
export async function getBlockRelationship(currentUserId, targetUserId) {
  if (!currentUserId || !targetUserId) {
    return { iBlocked: false, theyBlockedMe: false };
  }

  const [currentUserDoc, targetUserDoc] = await Promise.all([
    getDoc(doc(db, "users", currentUserId)),
    getDoc(doc(db, "users", targetUserId)),
  ]);

  let iBlocked = false;
  let theyBlockedMe = false;

  if (currentUserDoc.exists()) {
    const blockedUsers = currentUserDoc.data().blockedUsers || [];
    iBlocked = blockedUsers.some((u) => u.id === targetUserId);
  }

  if (targetUserDoc.exists()) {
    const blockedUsers = targetUserDoc.data().blockedUsers || [];
    theyBlockedMe = blockedUsers.some((u) => u.id === currentUserId);
  }

  return { iBlocked, theyBlockedMe };
}

/**
 * Filter an array of items to remove those from blocked users
 * Items must have a userId or authorId or oddieid property
 */
export function filterBlockedContent(items, blockedUserIds) {
  if (!blockedUserIds || blockedUserIds.size === 0) return items;

  return items.filter((item) => {
    const itemUserId = item.userId || item.authorId || item.oddieid || item.senderId;
    return !itemUserId || !blockedUserIds.has(itemUserId);
  });
}
