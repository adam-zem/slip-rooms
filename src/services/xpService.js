// src/services/xpService.js
// XP and Level system for SlipRooms
import {
  doc,
  getDoc,
  updateDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// Level thresholds - exponential curve keeps it interesting
// Each level requires more XP than the last
const LEVEL_THRESHOLDS = [
  0,      // Level 1: 0 XP
  100,    // Level 2: 100 XP
  300,    // Level 3: 300 XP
  600,    // Level 4: 600 XP
  1000,   // Level 5: 1,000 XP
  1500,   // Level 6: 1,500 XP
  2200,   // Level 7: 2,200 XP
  3000,   // Level 8: 3,000 XP
  4000,   // Level 9: 4,000 XP
  5200,   // Level 10: 5,200 XP (Veteran)
  6600,   // Level 11: 6,600 XP
  8200,   // Level 12: 8,200 XP
  10000,  // Level 13: 10,000 XP
  12000,  // Level 14: 12,000 XP
  14500,  // Level 15: 14,500 XP (Legend)
  17500,  // Level 16: 17,500 XP
  21000,  // Level 17: 21,000 XP
  25000,  // Level 18: 25,000 XP
  30000,  // Level 19: 30,000 XP
  36000,  // Level 20: 36,000 XP (GOAT)
];

// XP rewards for different actions
export const XP_REWARDS = {
  SEND_MESSAGE: 5,           // Basic chat message
  CREATE_ROOM: 25,           // Create a new room
  JOIN_ROOM: 10,             // Join a room
  TOP_SWEAT_BONUS: 50,       // Be in the TOP SWEAT room when it changes
  FIRST_MESSAGE_DAILY: 20,   // First message of the day
  STREAK_BONUS: 15,          // Daily login streak (per day)
  UPLOAD_GREATEST_HIT: 30,   // Upload a greatest hit image
  FRIEND_ADDED: 20,          // When friend request is accepted
};

// Level titles for display
const LEVEL_TITLES = {
  1: "Rookie",
  2: "Newbie",
  3: "Regular",
  4: "Active",
  5: "Committed",
  6: "Dedicated",
  7: "Seasoned",
  8: "Expert",
  9: "Pro",
  10: "Veteran",
  11: "Elite",
  12: "Master",
  13: "Champion",
  14: "Ace",
  15: "Legend",
  16: "Mythic",
  17: "Immortal",
  18: "Divine",
  19: "Transcendent",
  20: "GOAT",
};

/**
 * Calculate level from total XP
 */
export function calculateLevel(xp) {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return Math.min(level, 20); // Cap at level 20
}

/**
 * Get XP required for next level
 */
export function getXPForNextLevel(currentLevel) {
  if (currentLevel >= 20) return null; // Max level
  return LEVEL_THRESHOLDS[currentLevel]; // Array is 0-indexed, so currentLevel gives next threshold
}

/**
 * Get progress percentage to next level
 */
export function getLevelProgress(xp) {
  const level = calculateLevel(xp);
  if (level >= 20) return 100;

  const currentThreshold = LEVEL_THRESHOLDS[level - 1];
  const nextThreshold = LEVEL_THRESHOLDS[level];
  const xpInLevel = xp - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;

  return Math.floor((xpInLevel / xpNeeded) * 100);
}

/**
 * Get level title
 */
export function getLevelTitle(level) {
  return LEVEL_TITLES[level] || "Unknown";
}

/**
 * Get user's XP and level data
 */
export async function getUserXP(userId) {
  if (!userId) return { xp: 0, level: 1, title: "Rookie" };

  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return { xp: 0, level: 1, title: "Rookie", progress: 0 };
    }

    const data = userSnap.data();
    const xp = data.xp || 0;
    const level = calculateLevel(xp);

    return {
      xp,
      level,
      title: getLevelTitle(level),
      progress: getLevelProgress(xp),
      nextLevelXP: getXPForNextLevel(level),
    };
  } catch (error) {
    console.error("Error getting user XP:", error);
    return { xp: 0, level: 1, title: "Rookie", progress: 0 };
  }
}

/**
 * Award XP to a user
 * Returns { newXP, newLevel, leveledUp }
 */
export async function awardXP(userId, amount, reason = "unknown") {
  if (!userId || !amount) return null;

  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return null;
    }

    const oldData = userSnap.data();
    const oldXP = oldData.xp || 0;
    const oldLevel = calculateLevel(oldXP);

    const newXP = oldXP + amount;
    const newLevel = calculateLevel(newXP);
    const leveledUp = newLevel > oldLevel;

    // Update in Firestore
    await updateDoc(userRef, {
      xp: increment(amount),
      lastXPGain: serverTimestamp(),
      lastXPReason: reason,
    });

    return {
      newXP,
      newLevel,
      leveledUp,
      title: getLevelTitle(newLevel),
      progress: getLevelProgress(newXP),
    };
  } catch (error) {
    console.error("Error awarding XP:", error);
    return null;
  }
}

/**
 * Award XP for sending a message (with daily bonus check)
 */
export async function awardMessageXP(userId) {
  if (!userId) return null;

  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return null;

    const data = userSnap.data();
    const lastMessageDate = data.lastMessageDate?.toDate?.();
    const today = new Date().toDateString();
    const isFirstToday = !lastMessageDate || lastMessageDate.toDateString() !== today;

    // Calculate XP: base + daily bonus if first message today
    const xpAmount = XP_REWARDS.SEND_MESSAGE + (isFirstToday ? XP_REWARDS.FIRST_MESSAGE_DAILY : 0);

    // Update message date if first today
    const updates = {
      xp: increment(xpAmount),
      totalMessages: increment(1),
      lastXPGain: serverTimestamp(),
      lastXPReason: isFirstToday ? "first_message_daily" : "send_message",
    };

    if (isFirstToday) {
      updates.lastMessageDate = serverTimestamp();
    }

    await updateDoc(userRef, updates);

    const newXP = (data.xp || 0) + xpAmount;
    return {
      xpGained: xpAmount,
      isFirstToday,
      newXP,
      newLevel: calculateLevel(newXP),
    };
  } catch (error) {
    console.error("Error awarding message XP:", error);
    return null;
  }
}

export default {
  calculateLevel,
  getXPForNextLevel,
  getLevelProgress,
  getLevelTitle,
  getUserXP,
  awardXP,
  awardMessageXP,
  XP_REWARDS,
  LEVEL_THRESHOLDS,
};
