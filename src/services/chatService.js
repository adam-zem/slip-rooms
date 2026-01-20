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
import {
  joinRoomWithPresence,
  leaveRoomWithPresence,
  cleanupOnUnload,
} from "./presenceService";

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
 * Join a room - uses presence service for accurate tracking
 * Includes heartbeat and automatic disconnect cleanup
 */
export async function joinRoom(roomId, userId) {
  console.log("[chatService] joinRoom called - roomId:", roomId, "userId:", userId);
  if (!roomId || !userId) {
    console.warn("[chatService] joinRoom - missing params, skipping");
    return;
  }
  await joinRoomWithPresence(roomId, userId);
  console.log("[chatService] joinRoom completed");
}

/**
 * Leave a room - uses presence service for accurate tracking
 */
export async function leaveRoom(roomId, userId) {
  if (!roomId || !userId) return;
  await leaveRoomWithPresence(roomId, userId);
}

// Re-export cleanup function for page unload handling
export { cleanupOnUnload };

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
 * Supports different message types: text, image, gif
 * @param {string} roomId - Room ID
 * @param {object} message - Message object with type and content
 */
export async function sendMessage(roomId, message) {
  const messagesRef = collection(db, "rooms", roomId, "messages");

  // Build message document based on type
  const messageDoc = {
    username: message.username,
    oddie: message.oddie || null,
    timestamp: serverTimestamp(),
    userId: message.userId || null,
    type: message.type || "text", // text, image, gif
  };

  // Add type-specific fields
  if (message.type === "image") {
    messageDoc.imageUrl = message.imageUrl;
    messageDoc.text = null;
  } else if (message.type === "gif") {
    messageDoc.gifUrl = message.gifUrl;
    messageDoc.text = null;
  } else {
    // Default to text type
    messageDoc.text = message.text;
    messageDoc.type = "text";
  }

  const docRef = await addDoc(messagesRef, messageDoc);

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
        const data = doc.data();
        rooms.push({ id: doc.id, ...data });
      });
      // Log rooms with users for debugging
      const roomsWithUsers = rooms.filter(r => (r.userCount || 0) > 0);
      if (roomsWithUsers.length > 0) {
        console.log("[Rooms] Rooms with users:", roomsWithUsers.map(r => ({
          id: r.id,
          name: r.name,
          userCount: r.userCount,
          activeUsers: r.activeUsers,
        })));
      }
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
