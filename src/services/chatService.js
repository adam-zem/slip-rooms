// src/services/chatService.js
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  limit,
  increment,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Create or update a room in Firestore
 */
export async function createRoom(roomData) {
  const roomRef = doc(db, "rooms", roomData.id);

  await setDoc(roomRef, {
    id: roomData.id,
    name: roomData.name,
    game: roomData.game,
    gameId: roomData.gameId,
    odds: roomData.odds,
    sportId: roomData.sportId,
    createdAt: serverTimestamp(),
    createdBy: roomData.createdBy || "anonymous",
    userCount: 0, // Initialize user count
    activeUsers: [], // Track who's in the room
  });

  return roomRef.id;
}

/**
 * Join a room - increment user count and add to active users
 */
export async function joinRoom(roomId, userId) {
  if (!roomId || !userId) return;

  const roomRef = doc(db, "rooms", roomId);

  try {
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;

    const roomData = roomSnap.data();
    const activeUsers = roomData.activeUsers || [];

    // Don't add if already in the room
    if (activeUsers.includes(userId)) return;

    await updateDoc(roomRef, {
      userCount: increment(1),
      activeUsers: [...activeUsers, userId],
    });
  } catch (error) {
    console.error("Error joining room:", error);
  }
}

/**
 * Leave a room - decrement user count and remove from active users
 */
export async function leaveRoom(roomId, userId) {
  if (!roomId || !userId) return;

  const roomRef = doc(db, "rooms", roomId);

  try {
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;

    const roomData = roomSnap.data();
    const activeUsers = roomData.activeUsers || [];

    // Only decrement if user was in the room
    if (!activeUsers.includes(userId)) return;

    const newActiveUsers = activeUsers.filter((id) => id !== userId);
    const newCount = Math.max(0, (roomData.userCount || 1) - 1);

    await updateDoc(roomRef, {
      userCount: newCount,
      activeUsers: newActiveUsers,
    });
  } catch (error) {
    console.error("Error leaving room:", error);
  }
}

/**
 * Get a room by ID
 */
export async function getRoom(roomId) {
  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);

  if (roomSnap.exists()) {
    return { id: roomSnap.id, ...roomSnap.data() };
  }
  return null;
}

/**
 * Get all rooms for a sport
 */
export async function getRoomsBySport(sportId) {
  const roomsRef = collection(db, "rooms");
  const q = query(roomsRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  const rooms = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.sportId === sportId) {
      rooms.push({ id: doc.id, ...data });
    }
  });

  return rooms;
}

/**
 * Send a message to a room
 */
export async function sendMessage(roomId, message) {
  const messagesRef = collection(db, "rooms", roomId, "messages");

  const docRef = await addDoc(messagesRef, {
    username: message.username,
    text: message.text,
    oddie: message.oddie || null, // User's emoji/avatar
    timestamp: serverTimestamp(),
    userId: message.userId || null,
  });

  return docRef.id;
}

/**
 * Subscribe to messages in a room (real-time)
 * Returns an unsubscribe function
 */
export function subscribeToMessages(roomId, callback, messageLimit = 100) {
  const messagesRef = collection(db, "rooms", roomId, "messages");
  const q = query(
    messagesRef,
    orderBy("timestamp", "asc"),
    limit(messageLimit)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const messages = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        ...data,
        // Convert Firestore timestamp to ISO string for consistency
        timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
      });
    });
    callback(messages);
  }, (error) => {
    console.error("Error listening to messages:", error);
    callback([]);
  });

  return unsubscribe;
}

/**
 * Delete a room and its messages
 */
export async function deleteRoom(roomId) {
  // Note: In production, you'd want to delete the subcollection too
  // For now, we'll just delete the room document
  const roomRef = doc(db, "rooms", roomId);
  const { deleteDoc } = await import("firebase/firestore");
  await deleteDoc(roomRef);
}

/**
 * Subscribe to ALL rooms in real-time (for TOP SWEAT tracking)
 * Returns an unsubscribe function
 */
export function subscribeToAllRooms(callback) {
  const roomsRef = collection(db, "rooms");
  const q = query(roomsRef, orderBy("createdAt", "desc"));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const rooms = [];
      snapshot.forEach((doc) => {
        rooms.push({ id: doc.id, ...doc.data() });
      });
      callback(rooms);
    },
    (error) => {
      console.error("Error subscribing to rooms:", error);
      callback([]);
    }
  );

  return unsubscribe;
}

/**
 * Subscribe to rooms for a specific sport in real-time
 * Returns an unsubscribe function
 */
export function subscribeToRoomsBySport(sportId, callback) {
  const roomsRef = collection(db, "rooms");
  const q = query(roomsRef, where("sportId", "==", sportId), orderBy("createdAt", "desc"));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const rooms = [];
      snapshot.forEach((doc) => {
        rooms.push({ id: doc.id, ...doc.data() });
      });
      callback(rooms);
    },
    (error) => {
      console.error("Error subscribing to rooms:", error);
      callback([]);
    }
  );

  return unsubscribe;
}

export default {
  createRoom,
  getRoom,
  getRoomsBySport,
  sendMessage,
  subscribeToMessages,
  deleteRoom,
  joinRoom,
  leaveRoom,
  subscribeToAllRooms,
  subscribeToRoomsBySport,
};
