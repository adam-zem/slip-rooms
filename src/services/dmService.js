// src/services/dmService.js
// Direct messaging service for SlipRooms

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Generate a consistent conversation ID from two user IDs
 * Always sorts alphabetically so the same pair always gets the same ID
 */
export function getConversationId(userId1, userId2) {
  return [userId1, userId2].sort().join("_");
}

/**
 * Get or create a conversation between two users
 */
export async function getOrCreateConversation(userId1, userId2, user1Data = {}, user2Data = {}) {
  const conversationId = getConversationId(userId1, userId2);
  const conversationRef = doc(db, "conversations", conversationId);
  const conversationSnap = await getDoc(conversationRef);

  if (conversationSnap.exists()) {
    return { id: conversationId, ...conversationSnap.data() };
  }

  // Create new conversation
  const newConversation = {
    participants: [userId1, userId2],
    participantData: {
      [userId1]: {
        username: user1Data.username || "User",
        avatarEmoji: user1Data.avatarEmoji || "🔥",
        profilePicture: user1Data.profilePicture || null,
      },
      [userId2]: {
        username: user2Data.username || "User",
        avatarEmoji: user2Data.avatarEmoji || "🔥",
        profilePicture: user2Data.profilePicture || null,
      },
    },
    lastMessage: "Conversation started",
    lastMessageTime: serverTimestamp(),
    createdAt: serverTimestamp(),
    unreadCount: {
      [userId1]: 0,
      [userId2]: 0,
    },
  };

  await setDoc(conversationRef, newConversation);
  return { id: conversationId, ...newConversation };
}

/**
 * Send a message in a conversation
 */
export async function sendMessage(conversationId, senderId, text) {
  if (!text.trim()) return null;

  const messagesRef = collection(db, "conversations", conversationId, "messages");
  const conversationRef = doc(db, "conversations", conversationId);

  // Get conversation to find the other participant
  const conversationSnap = await getDoc(conversationRef);
  if (!conversationSnap.exists()) {
    throw new Error("Conversation not found");
  }

  const conversationData = conversationSnap.data();
  const otherUserId = conversationData.participants.find((id) => id !== senderId);

  // Add the message
  const messageDoc = await addDoc(messagesRef, {
    senderId,
    text: text.trim(),
    timestamp: serverTimestamp(),
    read: false,
  });

  // Update conversation with last message info and increment unread for other user
  await updateDoc(conversationRef, {
    lastMessage: text.trim(),
    lastMessageTime: serverTimestamp(),
    lastMessageSender: senderId,
    [`unreadCount.${otherUserId}`]: (conversationData.unreadCount?.[otherUserId] || 0) + 1,
  });

  return messageDoc.id;
}

/**
 * Get all conversations for a user
 */
export async function getConversations(userId) {
  const conversationsRef = collection(db, "conversations");
  const q = query(
    conversationsRef,
    where("participants", "array-contains", userId),
    orderBy("lastMessageTime", "desc")
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    lastMessageTime: doc.data().lastMessageTime?.toDate?.() || null,
  }));
}

/**
 * Subscribe to conversations for a user (real-time)
 */
export function subscribeToConversations(userId, callback) {
  const conversationsRef = collection(db, "conversations");
  const q = query(
    conversationsRef,
    where("participants", "array-contains", userId),
    orderBy("lastMessageTime", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const conversations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      lastMessageTime: doc.data().lastMessageTime?.toDate?.() || null,
    }));
    callback(conversations);
  });
}

/**
 * Get messages in a conversation
 */
export async function getMessages(conversationId, messageLimit = 50) {
  const messagesRef = collection(db, "conversations", conversationId, "messages");
  const q = query(messagesRef, orderBy("timestamp", "asc"), limit(messageLimit));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp?.toDate?.() || new Date(),
  }));
}

/**
 * Subscribe to messages in a conversation (real-time)
 */
export function subscribeToMessages(conversationId, callback) {
  const messagesRef = collection(db, "conversations", conversationId, "messages");
  const q = query(messagesRef, orderBy("timestamp", "asc"));

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate?.() || new Date(),
    }));
    callback(messages);
  });
}

/**
 * Mark all messages in a conversation as read for a user
 */
export async function markConversationAsRead(conversationId, userId) {
  const conversationRef = doc(db, "conversations", conversationId);

  await updateDoc(conversationRef, {
    [`unreadCount.${userId}`]: 0,
  });
}

/**
 * Get total unread message count for a user
 */
export async function getTotalUnreadCount(userId) {
  const conversations = await getConversations(userId);
  return conversations.reduce((total, conv) => {
    return total + (conv.unreadCount?.[userId] || 0);
  }, 0);
}

/**
 * Subscribe to total unread count (real-time)
 */
export function subscribeToUnreadCount(userId, callback) {
  return subscribeToConversations(userId, (conversations) => {
    const total = conversations.reduce((sum, conv) => {
      return sum + (conv.unreadCount?.[userId] || 0);
    }, 0);
    callback(total);
  });
}

/**
 * Update participant data in a conversation (when profile changes)
 */
export async function updateParticipantData(conversationId, userId, userData) {
  const conversationRef = doc(db, "conversations", conversationId);

  await updateDoc(conversationRef, {
    [`participantData.${userId}`]: {
      username: userData.username || "User",
      avatarEmoji: userData.avatarEmoji || "🔥",
      profilePicture: userData.profilePicture || null,
    },
  });
}

export default {
  getConversationId,
  getOrCreateConversation,
  sendMessage,
  getConversations,
  subscribeToConversations,
  getMessages,
  subscribeToMessages,
  markConversationAsRead,
  getTotalUnreadCount,
  subscribeToUnreadCount,
  updateParticipantData,
};
