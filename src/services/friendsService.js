// src/services/friendsService.js
// Friends system for SlipRooms
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Send a friend request
 */
export async function sendFriendRequest(fromUserId, toUserId) {
  if (!fromUserId || !toUserId || fromUserId === toUserId) {
    throw new Error("Invalid friend request");
  }

  // Check if request already exists
  const existingRequest = await getFriendRequest(fromUserId, toUserId);
  if (existingRequest) {
    throw new Error("Friend request already sent");
  }

  // Check if already friends
  const areFriends = await checkFriendship(fromUserId, toUserId);
  if (areFriends) {
    throw new Error("Already friends");
  }

  // Create the request
  const requestId = `${fromUserId}_${toUserId}`;
  const requestRef = doc(db, "friendRequests", requestId);

  await setDoc(requestRef, {
    from: fromUserId,
    to: toUserId,
    status: "pending",
    createdAt: serverTimestamp(),
  });

  return requestId;
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequest(requestId) {
  const requestRef = doc(db, "friendRequests", requestId);
  const requestSnap = await getDoc(requestRef);

  if (!requestSnap.exists()) {
    throw new Error("Friend request not found");
  }

  const request = requestSnap.data();
  const { from, to } = request;

  // Create mutual friendship documents
  const friendship1Id = `${from}_${to}`;
  const friendship2Id = `${to}_${from}`;

  await Promise.all([
    setDoc(doc(db, "friendships", friendship1Id), {
      users: [from, to],
      user1: from,
      user2: to,
      createdAt: serverTimestamp(),
    }),
    setDoc(doc(db, "friendships", friendship2Id), {
      users: [to, from],
      user1: to,
      user2: from,
      createdAt: serverTimestamp(),
    }),
    // Delete the request
    deleteDoc(requestRef),
  ]);

  return { from, to };
}

/**
 * Decline a friend request
 */
export async function declineFriendRequest(requestId) {
  const requestRef = doc(db, "friendRequests", requestId);
  await deleteDoc(requestRef);
}

/**
 * Remove a friend
 */
export async function removeFriend(userId, friendId) {
  const friendship1Id = `${userId}_${friendId}`;
  const friendship2Id = `${friendId}_${userId}`;

  await Promise.all([
    deleteDoc(doc(db, "friendships", friendship1Id)),
    deleteDoc(doc(db, "friendships", friendship2Id)),
  ]);
}

/**
 * Check if two users are friends
 */
export async function checkFriendship(userId1, userId2) {
  const friendshipId = `${userId1}_${userId2}`;
  const friendshipRef = doc(db, "friendships", friendshipId);
  const friendshipSnap = await getDoc(friendshipRef);
  return friendshipSnap.exists();
}

/**
 * Get a specific friend request
 */
export async function getFriendRequest(fromUserId, toUserId) {
  const requestId = `${fromUserId}_${toUserId}`;
  const requestRef = doc(db, "friendRequests", requestId);
  const requestSnap = await getDoc(requestRef);

  if (requestSnap.exists()) {
    return { id: requestSnap.id, ...requestSnap.data() };
  }
  return null;
}

/**
 * Get pending friend requests for a user (received)
 */
export async function getPendingRequests(userId) {
  const requestsRef = collection(db, "friendRequests");
  const q = query(
    requestsRef,
    where("to", "==", userId),
    where("status", "==", "pending")
  );

  const snapshot = await getDocs(q);
  const requests = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    // Get the sender's profile
    const senderRef = doc(db, "users", data.from);
    const senderSnap = await getDoc(senderRef);
    const senderData = senderSnap.exists() ? senderSnap.data() : {};

    requests.push({
      id: docSnap.id,
      ...data,
      fromUsername: senderData.username || "Unknown",
      fromDisplayName: senderData.displayName || senderData.username || "Unknown",
      fromAvatar: senderData.avatarEmoji || "🔥",
      fromProfilePic: senderData.profilePicture || null,
      fromDisplayBadge: senderData.displayBadge || null,
    });
  }

  return requests;
}

/**
 * Get sent friend requests (outgoing)
 */
export async function getSentRequests(userId) {
  const requestsRef = collection(db, "friendRequests");
  const q = query(
    requestsRef,
    where("from", "==", userId),
    where("status", "==", "pending")
  );

  const snapshot = await getDocs(q);
  const requests = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    // Get the recipient's profile
    const recipientRef = doc(db, "users", data.to);
    const recipientSnap = await getDoc(recipientRef);
    const recipientData = recipientSnap.exists() ? recipientSnap.data() : {};

    requests.push({
      id: docSnap.id,
      ...data,
      toUsername: recipientData.username || "Unknown",
      toAvatar: recipientData.avatarEmoji || "🔥",
    });
  }

  return requests;
}

/**
 * Get all friends for a user
 */
export async function getFriends(userId) {
  const friendshipsRef = collection(db, "friendships");
  const q = query(friendshipsRef, where("user1", "==", userId));

  const snapshot = await getDocs(q);
  const friends = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const friendId = data.user2;

    // Get friend's profile
    const friendRef = doc(db, "users", friendId);
    const friendSnap = await getDoc(friendRef);

    if (friendSnap.exists()) {
      const friendData = friendSnap.data();
      friends.push({
        id: friendId,
        username: friendData.username || "Unknown",
        avatarEmoji: friendData.avatarEmoji || "🔥",
        avatarColor: friendData.avatarColor || "green",
        profilePicture: friendData.profilePicture || null,
        displayBadge: friendData.displayBadge || null,
        bio: friendData.bio || "",
        createdAt: data.createdAt,
      });
    }
  }

  return friends;
}

/**
 * Subscribe to friend requests in real-time
 */
export function subscribeToFriendRequests(userId, callback) {
  const requestsRef = collection(db, "friendRequests");
  const q = query(
    requestsRef,
    where("to", "==", userId),
    where("status", "==", "pending")
  );

  return onSnapshot(q, async (snapshot) => {
    const requests = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const senderRef = doc(db, "users", data.from);
      const senderSnap = await getDoc(senderRef);
      const senderData = senderSnap.exists() ? senderSnap.data() : {};

      requests.push({
        id: docSnap.id,
        ...data,
        fromUsername: senderData.username || "Unknown",
        fromAvatar: senderData.avatarEmoji || "🔥",
      });
    }

    callback(requests);
  });
}

/**
 * Get friend count for a user
 */
export async function getFriendCount(userId) {
  const friendshipsRef = collection(db, "friendships");
  const q = query(friendshipsRef, where("user1", "==", userId));
  const snapshot = await getDocs(q);
  return snapshot.size;
}

export default {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  checkFriendship,
  getFriendRequest,
  getPendingRequests,
  getSentRequests,
  getFriends,
  subscribeToFriendRequests,
  getFriendCount,
};
