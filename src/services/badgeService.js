// Badge Service - Manage user badges
import { doc, getDoc, updateDoc, arrayUnion, collection, getCountFromServer, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// Badge definitions
export const BADGES = {
  rookie: {
    id: "rookie",
    name: "Rookie",
    description: "Joined SlipRooms",
    category: "account",
    rarity: "common",
  },
  founding_father: {
    id: "founding_father",
    name: "Founding Father",
    description: "One of the first 100 to join SlipRooms. This badge can never be earned again.",
    category: "account",
    rarity: "legendary",
  },
};

// Total badge slots to show in the collection (including locked)
export const TOTAL_BADGE_SLOTS = 30;

// Maximum users who can get Founding Father badge
export const FOUNDING_FATHER_LIMIT = 100;

// Get all badge definitions
export function getAllBadges() {
  return Object.values(BADGES);
}

// Get a specific badge definition
export function getBadgeInfo(badgeId) {
  return BADGES[badgeId] || null;
}

// Get user's badges from Firestore
export async function getUserBadges(userId) {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return [];

    const data = userDoc.data();
    return data.badges || [];
  } catch (error) {
    console.error("Error fetching user badges:", error);
    return [];
  }
}

// Check if user has a specific badge
export async function hasBadge(userId, badgeId) {
  const badges = await getUserBadges(userId);
  return badges.some(b => b.badgeId === badgeId);
}

// Get total user count
export async function getUserCount() {
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getCountFromServer(usersRef);
    return snapshot.data().count;
  } catch (error) {
    console.error("Error getting user count:", error);
    return 0;
  }
}

// Award a badge to a user
export async function awardBadge(userId, badgeId) {
  try {
    // Check if badge exists
    const badgeInfo = getBadgeInfo(badgeId);
    if (!badgeInfo) {
      throw new Error(`Badge ${badgeId} does not exist`);
    }

    // Check if user already has this badge
    const alreadyHas = await hasBadge(userId, badgeId);
    if (alreadyHas) {
      return { success: false, reason: "already_has_badge" };
    }

    // Award the badge
    const userRef = doc(db, "users", userId);
    const newBadge = {
      badgeId,
      unlockedAt: new Date().toISOString(),
    };

    await updateDoc(userRef, {
      badges: arrayUnion(newBadge),
    });

    return { success: true, badge: newBadge };
  } catch (error) {
    console.error("Error awarding badge:", error);
    throw error;
  }
}

// Award the Rookie badge
export async function awardRookieBadge(userId) {
  return awardBadge(userId, "rookie");
}

// Award the Founding Father badge (only if under 100 users)
export async function awardFoundingFatherBadge(userId) {
  try {
    const userCount = await getUserCount();
    if (userCount <= FOUNDING_FATHER_LIMIT) {
      return awardBadge(userId, "founding_father");
    }
    return { success: false, reason: "limit_reached" };
  } catch (error) {
    console.error("Error awarding founding father badge:", error);
    return { success: false, reason: "error" };
  }
}

// Award initial badges on signup (rookie + founding father if eligible)
export async function awardSignupBadges(userId) {
  try {
    // Always award rookie
    await awardRookieBadge(userId);

    // Award founding father if under limit
    await awardFoundingFatherBadge(userId);
  } catch (error) {
    console.error("Error awarding signup badges:", error);
  }
}

// Set the badge to display next to username
export async function setDisplayBadge(userId, badgeId) {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      displayBadge: badgeId,
    });
    return true;
  } catch (error) {
    console.error("Error setting display badge:", error);
    return false;
  }
}

// Remove display badge (show nothing next to name)
export async function removeDisplayBadge(userId) {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      displayBadge: null,
    });
    return true;
  } catch (error) {
    console.error("Error removing display badge:", error);
    return false;
  }
}

// Get user's display badge ID
export async function getDisplayBadge(userId) {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return null;

    const data = userDoc.data();
    return data.displayBadge || null;
  } catch (error) {
    console.error("Error fetching display badge:", error);
    return null;
  }
}

// Ensure user has rookie badge (call this on profile load)
export async function ensureRookieBadge(userId) {
  try {
    const has = await hasBadge(userId, "rookie");
    if (!has) {
      await awardRookieBadge(userId);
    }
  } catch (error) {
    console.error("Error ensuring rookie badge:", error);
  }
}

// Ensure user has founding father badge (for existing users under limit)
export async function ensureFoundingFatherBadge(userId) {
  try {
    const has = await hasBadge(userId, "founding_father");
    if (!has) {
      const userCount = await getUserCount();
      if (userCount <= FOUNDING_FATHER_LIMIT) {
        await awardBadge(userId, "founding_father");
      }
    }
  } catch (error) {
    console.error("Error ensuring founding father badge:", error);
  }
}

// Migration: Award founding father to all existing users (run once)
export async function migrateFoundingFatherBadges() {
  try {
    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);

    let awarded = 0;
    for (const userDoc of snapshot.docs) {
      const userId = userDoc.id;
      const data = userDoc.data();
      const badges = data.badges || [];

      // Check if user already has founding father
      const hasFF = badges.some(b => b.badgeId === "founding_father");
      if (!hasFF) {
        const newBadge = {
          badgeId: "founding_father",
          unlockedAt: new Date().toISOString(),
        };

        await updateDoc(doc(db, "users", userId), {
          badges: arrayUnion(newBadge),
        });
        awarded++;
      }
    }

    console.log(`Migration complete: Awarded Founding Father badge to ${awarded} users`);
    return awarded;
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  }
}

// Legacy aliases for compatibility
export const setFeaturedBadge = setDisplayBadge;
export const removeFeaturedBadge = removeDisplayBadge;
export const getFeaturedBadge = getDisplayBadge;
export const ensureVerifiedDegenBadge = ensureRookieBadge;
