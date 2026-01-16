// src/services/accountService.js
// Account management - handles account deletion and cleanup

import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  query,
  where,
  writeBatch,
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

export default {
  deleteUserAccount,
};
