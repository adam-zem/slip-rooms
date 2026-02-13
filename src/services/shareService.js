// src/services/shareService.js
// Sharing service for SlipRooms website

import { getOrCreateConversation } from "./dmService";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// Base URL for share links
const BASE_URL = "https://sliprooms.com";

// Generate share links
export function getRoomShareLink(roomId) {
  return `${BASE_URL}/room/${roomId}`;
}

export function getPostShareLink(postId) {
  return `${BASE_URL}/post/${postId}`;
}

// Copy link to clipboard
export async function copyRoomLink(roomId) {
  try {
    const link = getRoomShareLink(roomId);
    await navigator.clipboard.writeText(link);
    return true;
  } catch (error) {
    console.error("Error copying room link:", error);
    // Fallback for older browsers
    try {
      const textArea = document.createElement("textarea");
      textArea.value = getRoomShareLink(roomId);
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      return true;
    } catch {
      return false;
    }
  }
}

export async function copyPostLink(postId) {
  try {
    const link = getPostShareLink(postId);
    await navigator.clipboard.writeText(link);
    return true;
  } catch (error) {
    console.error("Error copying post link:", error);
    // Fallback for older browsers
    try {
      const textArea = document.createElement("textarea");
      textArea.value = getPostShareLink(postId);
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      return true;
    } catch {
      return false;
    }
  }
}

// Share via native share API (for mobile browsers)
export async function shareRoomViaSMS(room) {
  const link = getRoomShareLink(room.id);
  const text = `Check out this room on SlipRooms: ${room.name}\n${link}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: room.name,
        text: text,
        url: link,
      });
      return true;
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Error sharing:", error);
      }
      return false;
    }
  } else {
    // Fallback: Open SMS link (works on mobile)
    window.open(`sms:?body=${encodeURIComponent(text)}`, "_blank");
    return true;
  }
}

export async function sharePostViaSMS(post) {
  const link = getPostShareLink(post.id);
  const preview = post.text
    ? post.text.slice(0, 100) + (post.text.length > 100 ? "..." : "")
    : "Check out this post";
  const text = `${post.username ? `@${post.username}: ` : ""}${preview}\n${link}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: post.username ? `@${post.username}'s post` : "SlipRooms Post",
        text: text,
        url: link,
      });
      return true;
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Error sharing:", error);
      }
      return false;
    }
  } else {
    // Fallback: Open SMS link (works on mobile)
    window.open(`sms:?body=${encodeURIComponent(text)}`, "_blank");
    return true;
  }
}

// Send shared content via DM
export async function sendSharedRoomDM(
  senderId,
  senderProfile,
  recipientId,
  recipientProfile,
  room
) {
  try {
    // Get or create conversation
    const conversation = await getOrCreateConversation(
      senderId,
      recipientId,
      {
        username: senderProfile.username,
        avatarEmoji: senderProfile.avatarEmoji,
        profilePicture: senderProfile.profilePicture,
      },
      {
        username: recipientProfile.username,
        avatarEmoji: recipientProfile.avatarEmoji,
        profilePicture: recipientProfile.profilePicture,
      }
    );

    // Send the shared room as a special message
    const sharedContent = {
      type: "room",
      id: room.id,
      title: room.name,
      subtitle: room.gameName || room.game,
    };

    const messageText = `[Shared Room] ${room.name}`;

    const messageId = await sendSharedContentMessage(
      conversation.id,
      senderId,
      messageText,
      sharedContent
    );

    return messageId;
  } catch (error) {
    console.error("Error sending shared room DM:", error);
    return null;
  }
}

export async function sendSharedPostDM(
  senderId,
  senderProfile,
  recipientId,
  recipientProfile,
  post
) {
  try {
    // Get or create conversation
    const conversation = await getOrCreateConversation(
      senderId,
      recipientId,
      {
        username: senderProfile.username,
        avatarEmoji: senderProfile.avatarEmoji,
        profilePicture: senderProfile.profilePicture,
      },
      {
        username: recipientProfile.username,
        avatarEmoji: recipientProfile.avatarEmoji,
        profilePicture: recipientProfile.profilePicture,
      }
    );

    // Send the shared post as a special message
    const preview = post.text
      ? post.text.slice(0, 60) + (post.text.length > 60 ? "..." : "")
      : "Check out this post";

    const sharedContent = {
      type: "post",
      id: post.id,
      title: post.username ? `@${post.username}` : "Post",
      subtitle: preview,
      imageUrl: post.images?.[0],
    };

    const messageText = `[Shared Post] ${preview}`;

    const messageId = await sendSharedContentMessage(
      conversation.id,
      senderId,
      messageText,
      sharedContent
    );

    return messageId;
  } catch (error) {
    console.error("Error sending shared post DM:", error);
    return null;
  }
}

// Send a message with shared content metadata
async function sendSharedContentMessage(conversationId, senderId, text, sharedContent) {
  try {
    const messagesRef = collection(db, "conversations", conversationId, "messages");
    const conversationRef = doc(db, "conversations", conversationId);

    // Get conversation to find the other participant
    const conversationSnap = await getDoc(conversationRef);
    if (!conversationSnap.exists()) {
      throw new Error("Conversation not found");
    }

    const conversationData = conversationSnap.data();
    const otherUserId = conversationData.participants.find((id) => id !== senderId);

    // Add the message with shared content
    const messageDoc = await addDoc(messagesRef, {
      senderId,
      text,
      timestamp: serverTimestamp(),
      read: false,
      sharedContent,
    });

    // Update conversation with last message info
    await updateDoc(conversationRef, {
      lastMessage: text,
      lastMessageTime: serverTimestamp(),
      lastMessageSender: senderId,
      [`unreadCount.${otherUserId}`]: (conversationData.unreadCount?.[otherUserId] || 0) + 1,
    });

    return messageDoc.id;
  } catch (error) {
    console.error("Error sending shared content message:", error);
    return null;
  }
}

export default {
  getRoomShareLink,
  getPostShareLink,
  copyRoomLink,
  copyPostLink,
  shareRoomViaSMS,
  sharePostViaSMS,
  sendSharedRoomDM,
  sendSharedPostDM,
};
