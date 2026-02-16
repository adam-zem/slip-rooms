// src/services/profileService.js
// Profile data service for SlipRooms
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  collection,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { calculateLevel, getLevelTitle, getLevelProgress, getXPForNextLevel } from "./xpService";
import { getFriendCount } from "./friendsService";
import { getHitCount } from "./greatestHitsService";

/**
 * Get full profile data for a user
 */
export async function getProfile(userId) {
  if (!userId) return null;

  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.log("Profile not found for userId:", userId);
      return null;
    }

    const data = userSnap.data();
    const xp = data.xp || 0;
    const level = calculateLevel(xp);

    // Get additional counts - wrap in try/catch to avoid failures
    let friendCount = 0;
    let hitCount = 0;

    try {
      [friendCount, hitCount] = await Promise.all([
        getFriendCount(userId).catch(() => 0),
        getHitCount(userId).catch(() => 0),
      ]);
    } catch (countError) {
      console.warn("Error getting counts:", countError);
    }

    return {
      id: userId,
      username: data.username || "Unknown",
      email: data.email || "",
      bio: data.bio || "",
      avatarEmoji: data.avatarEmoji || "🔥",
      avatarColor: data.avatarColor || "green",
      favoriteMarket: data.favoriteMarket || "NFL",
      publicProfile: data.publicProfile !== false, // Default true
      profilePicture: data.profilePicture || null,
      xp,
      level,
      title: getLevelTitle(level),
      progress: getLevelProgress(xp),
      nextLevelXP: getXPForNextLevel(level),
      totalMessages: data.totalMessages || 0,
      friendCount,
      hitCount,
      createdAt: data.createdAt || null,
    };
  } catch (error) {
    console.error("Error getting profile:", error);
    return null;
  }
}

/**
 * Create a profile if one doesn't exist (fallback for existing users)
 * Returns the profile data after creation
 */
export async function createProfileIfMissing(userId, userData) {
  if (!userId) return null;

  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    // If profile already exists, just return it
    if (userSnap.exists()) {
      return getProfile(userId);
    }

    // Create new profile
    const newProfile = {
      username: userData.username || "User",
      email: userData.email || "",
      bio: "",
      avatarEmoji: "🔥",
      avatarColor: "green",
      favoriteMarket: "NFL",
      publicProfile: true,
      xp: 0,
      totalMessages: 0,
      createdAt: new Date().toISOString(),
      provider: "legacy", // Mark as legacy user
    };

    await setDoc(userRef, newProfile);
    console.log("Created missing profile for user:", userId);

    // Return the full profile data
    return getProfile(userId);
  } catch (error) {
    console.error("Error creating profile:", error);
    return null;
  }
}

/**
 * Update user profile
 */
export async function updateProfile(userId, updates) {
  if (!userId) throw new Error("User ID required");

  const userRef = doc(db, "users", userId);

  // Only allow certain fields to be updated
  const allowedFields = [
    "bio",
    "avatarEmoji",
    "avatarColor",
    "favoriteMarket",
    "publicProfile",
    "notifications",
    "soundEffects",
    "profilePicture",
  ];

  const safeUpdates = {};
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      safeUpdates[field] = updates[field];
    }
  }

  if (Object.keys(safeUpdates).length === 0) {
    return;
  }

  safeUpdates.updatedAt = serverTimestamp();

  await updateDoc(userRef, safeUpdates);
}

/**
 * Search users by username
 */
export async function searchUsers(searchTerm, currentUserId, maxResults = 10) {
  if (!searchTerm || searchTerm.length < 2) return [];

  const usersRef = collection(db, "users");
  // Note: Firestore doesn't support LIKE queries, so we use range query
  const searchLower = searchTerm.toLowerCase();
  const searchUpper = searchLower + "\uf8ff";

  const q = query(
    usersRef,
    where("username", ">=", searchLower),
    where("username", "<=", searchUpper)
  );

  const snapshot = await getDocs(q);
  const users = [];

  snapshot.forEach((doc) => {
    if (doc.id !== currentUserId) {
      const data = doc.data();
      // Only show public profiles
      if (data.publicProfile !== false) {
        users.push({
          id: doc.id,
          username: data.username,
          displayName: data.displayName || data.username,
          avatarEmoji: data.avatarEmoji || "🔥",
          avatarColor: data.avatarColor || "green",
          profilePicture: data.profilePicture || null,
          level: calculateLevel(data.xp || 0),
        });
      }
    }
  });

  return users.slice(0, maxResults);
}

/**
 * Get user by username
 */
export async function getUserByUsername(username) {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("username", "==", username));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  };
}

export default {
  getProfile,
  createProfileIfMissing,
  updateProfile,
  searchUsers,
  getUserByUsername,
};
