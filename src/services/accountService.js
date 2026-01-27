// src/services/accountService.js
// Account management - handles account deletion and cleanup

import {
  collection,
  doc,
  getDocs,
  getDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
  setDoc,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { deleteUser } from "firebase/auth";
import { db, storage, auth } from "../firebase";

/**
 * Delete all user data and account
 * This is a destructive operation that cannot be undone
 */
export async function deleteUserAccount(userId) {
  if (!userId) throw new Error("User ID required");

  const user = auth.currentUser;
  if (!user || user.uid !== userId) {
    throw new Error("Not authorized to delete this account");
  }

  console.log("Starting account deletion for user:", userId);

  try {
    // 1. Delete greatest hits
    await deleteGreatestHits(userId);
    console.log("Deleted greatest hits");

    // 2. Delete friendships (both directions)
    await deleteFriendships(userId);
    console.log("Deleted friendships");

    // 3. Delete friend requests (sent and received)
    await deleteFriendRequests(userId);
    console.log("Deleted friend requests");

    // 4. Delete conversations and messages
    await deleteConversations(userId);
    console.log("Deleted conversations");

    // 5. Delete room submissions
    await deleteRoomSubmissions(userId);
    console.log("Deleted room submissions");

    // 6. Delete messages in room chats (optional - just removes user's messages)
    await deleteRoomMessages(userId);
    console.log("Deleted room messages");

    // 7. Delete profile picture from storage
    await deleteProfilePicture(userId);
    console.log("Deleted profile picture");

    // 8. Delete user document from Firestore
    await deleteDoc(doc(db, "users", userId));
    console.log("Deleted user document");

    // 9. Finally, delete the Firebase Auth account
    await deleteUser(user);
    console.log("Deleted Firebase Auth account");

    return true;
  } catch (error) {
    console.error("Error deleting account:", error);
    throw error;
  }
}

/**
 * Delete all greatest hits for a user
 */
async function deleteGreatestHits(userId) {
  const hitsRef = collection(db, "greatestHits");
  const q = query(hitsRef, where("userId", "==", userId));
  const snapshot = await getDocs(q);

  const batch = writeBatch(db);
  snapshot.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  if (snapshot.docs.length > 0) {
    await batch.commit();
  }
}

/**
 * Delete all friendships for a user (both directions)
 */
async function deleteFriendships(userId) {
  const friendshipsRef = collection(db, "friendships");

  // Get friendships where user is user1
  const q1 = query(friendshipsRef, where("user1", "==", userId));
  const snapshot1 = await getDocs(q1);

  // Get friendships where user is user2
  const q2 = query(friendshipsRef, where("user2", "==", userId));
  const snapshot2 = await getDocs(q2);

  const batch = writeBatch(db);

  snapshot1.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  snapshot2.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  const totalDocs = snapshot1.docs.length + snapshot2.docs.length;
  if (totalDocs > 0) {
    await batch.commit();
  }
}

/**
 * Delete all friend requests for a user (sent and received)
 */
async function deleteFriendRequests(userId) {
  const requestsRef = collection(db, "friendRequests");

  // Requests sent by user
  const q1 = query(requestsRef, where("from", "==", userId));
  const snapshot1 = await getDocs(q1);

  // Requests sent to user
  const q2 = query(requestsRef, where("to", "==", userId));
  const snapshot2 = await getDocs(q2);

  const batch = writeBatch(db);

  snapshot1.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  snapshot2.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  const totalDocs = snapshot1.docs.length + snapshot2.docs.length;
  if (totalDocs > 0) {
    await batch.commit();
  }
}

/**
 * Delete all conversations for a user and their messages
 */
async function deleteConversations(userId) {
  const conversationsRef = collection(db, "conversations");
  const q = query(conversationsRef, where("participants", "array-contains", userId));
  const snapshot = await getDocs(q);

  for (const docSnap of snapshot.docs) {
    // Delete all messages in the conversation first
    const messagesRef = collection(db, "conversations", docSnap.id, "messages");
    const messagesSnapshot = await getDocs(messagesRef);

    const batch = writeBatch(db);
    messagesSnapshot.docs.forEach((msgDoc) => {
      batch.delete(msgDoc.ref);
    });

    if (messagesSnapshot.docs.length > 0) {
      await batch.commit();
    }

    // Delete the conversation document
    await deleteDoc(docSnap.ref);
  }
}

/**
 * Delete room submissions by user
 */
async function deleteRoomSubmissions(userId) {
  const submissionsRef = collection(db, "roomSubmissions");
  const q = query(submissionsRef, where("oddieid", "==", userId));
  const snapshot = await getDocs(q);

  const batch = writeBatch(db);
  snapshot.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  if (snapshot.docs.length > 0) {
    await batch.commit();
  }
}

/**
 * Delete user's messages from room chats
 * Note: This removes messages from all rooms where user has posted
 */
async function deleteRoomMessages(userId) {
  const roomsRef = collection(db, "rooms");
  const roomsSnapshot = await getDocs(roomsRef);

  for (const roomDoc of roomsSnapshot.docs) {
    const messagesRef = collection(db, "rooms", roomDoc.id, "messages");
    const q = query(messagesRef, where("userId", "==", userId));
    const messagesSnapshot = await getDocs(q);

    if (messagesSnapshot.docs.length > 0) {
      const batch = writeBatch(db);
      messagesSnapshot.docs.forEach((msgDoc) => {
        batch.delete(msgDoc.ref);
      });
      await batch.commit();
    }
  }
}

/**
 * Delete profile picture from Firebase Storage
 */
async function deleteProfilePicture(userId) {
  try {
    const profilePicRef = ref(storage, `profilePics/${userId}`);
    await deleteObject(profilePicRef);
  } catch (error) {
    // Ignore if profile picture doesn't exist
    if (error.code !== "storage/object-not-found") {
      console.warn("Could not delete profile picture:", error);
    }
  }
}

/**
 * Check if a username is available (case-insensitive)
 * @param {string} username - The username to check
 * @param {string} excludeUserId - Optional user ID to exclude (for editing own username)
 * @returns {Promise<{available: boolean, existingUser?: string}>}
 */
export async function checkUsernameAvailable(username, excludeUserId = null) {
  if (!username) return { available: false };

  const usernameLower = username.trim().toLowerCase();

  // Check the usernames collection (stores lowercase usernames -> userId mapping)
  const usernameDoc = await getDoc(doc(db, "usernames", usernameLower));

  if (usernameDoc.exists()) {
    const ownerId = usernameDoc.data().userId;
    // If it's the same user, it's available (they already own it)
    if (excludeUserId && ownerId === excludeUserId) {
      return { available: true };
    }
    return { available: false, existingUser: ownerId };
  }

  return { available: true };
}

/**
 * Reserve a username for a user (case-insensitive)
 * Call this when creating a new user account
 * @param {string} username - The username to reserve
 * @param {string} userId - The user's ID
 */
export async function reserveUsername(username, userId) {
  if (!username || !userId) throw new Error("Username and userId required");

  const usernameLower = username.trim().toLowerCase();

  // Check if already taken
  const { available } = await checkUsernameAvailable(username, userId);
  if (!available) {
    throw new Error("Username is already taken");
  }

  // Reserve the username
  await setDoc(doc(db, "usernames", usernameLower), {
    userId,
    username: username.trim(), // Store original casing
    createdAt: new Date().toISOString(),
  });
}

/**
 * Release a username (call when deleting account or changing username)
 * @param {string} username - The username to release
 */
export async function releaseUsername(username) {
  if (!username) return;
  const usernameLower = username.trim().toLowerCase();
  await deleteDoc(doc(db, "usernames", usernameLower));
}

/**
 * Migration: Reserve all existing usernames
 * Run this once to protect existing users' usernames
 * @returns {Promise<{migrated: number, skipped: number, errors: number}>}
 */
export async function migrateExistingUsernames() {
  const usersSnapshot = await getDocs(collection(db, "users"));

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const username = userData.username;

    if (!username) {
      skipped++;
      continue;
    }

    const usernameLower = username.trim().toLowerCase();

    try {
      // Check if already reserved
      const existingDoc = await getDoc(doc(db, "usernames", usernameLower));

      if (existingDoc.exists()) {
        // Already reserved - skip
        skipped++;
        continue;
      }

      // Reserve the username
      await setDoc(doc(db, "usernames", usernameLower), {
        userId: userDoc.id,
        username: username.trim(),
        createdAt: userData.createdAt || new Date().toISOString(),
        migratedAt: new Date().toISOString(),
      });

      migrated++;
    } catch (err) {
      console.error(`Failed to migrate username ${username}:`, err);
      errors++;
    }
  }

  return { migrated, skipped, errors };
}

/**
 * Delete all users except specified usernames (case-insensitive)
 * WARNING: This is destructive and cannot be undone!
 * @param {string[]} keepUsernames - Usernames to keep (case-insensitive)
 * @returns {Promise<{deleted: number, kept: number, errors: number}>}
 */
export async function deleteAllUsersExcept(keepUsernames = []) {
  const keepLower = keepUsernames.map(u => u.toLowerCase());

  const usersSnapshot = await getDocs(collection(db, "users"));

  let deleted = 0;
  let kept = 0;
  let errors = 0;

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const username = userData.username || "";
    const usernameLower = username.toLowerCase();

    // Check if this user should be kept
    if (keepLower.includes(usernameLower)) {
      console.log(`Keeping user: ${username}`);
      kept++;

      // Make sure their username is reserved
      try {
        await setDoc(doc(db, "usernames", usernameLower), {
          userId: userDoc.id,
          username: username,
          createdAt: userData.createdAt || new Date().toISOString(),
        });
      } catch (e) {
        console.error(`Failed to reserve username for ${username}:`, e);
      }
      continue;
    }

    // Delete this user
    try {
      // Delete user document
      await deleteDoc(doc(db, "users", userDoc.id));

      // Delete their username reservation if exists
      if (usernameLower) {
        try {
          await deleteDoc(doc(db, "usernames", usernameLower));
        } catch (e) {
          // Ignore if doesn't exist
        }
      }

      console.log(`Deleted user: ${username || userDoc.id}`);
      deleted++;
    } catch (err) {
      console.error(`Failed to delete user ${username || userDoc.id}:`, err);
      errors++;
    }
  }

  // Also clean up any orphaned username reservations
  const usernamesSnapshot = await getDocs(collection(db, "usernames"));
  for (const unDoc of usernamesSnapshot.docs) {
    if (!keepLower.includes(unDoc.id)) {
      try {
        await deleteDoc(doc(db, "usernames", unDoc.id));
      } catch (e) {
        // Ignore
      }
    }
  }

  return { deleted, kept, errors };
}

export default {
  deleteUserAccount,
  checkUsernameAvailable,
  reserveUsername,
  releaseUsername,
  migrateExistingUsernames,
  deleteAllUsersExcept,
};
