// src/services/greatestHitsService.js
// Greatest Hits - winning bet slip screenshots
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Add a greatest hit (bet slip screenshot)
 * Note: In production, you'd upload the image to Firebase Storage first
 * For now, we'll store the image as a base64 data URL
 */
export async function addGreatestHit(userId, hitData) {
  if (!userId) throw new Error("User ID required");

  const hitsRef = collection(db, "greatestHits");

  const newHit = await addDoc(hitsRef, {
    userId,
    imageUrl: hitData.imageUrl, // Base64 or Firebase Storage URL
    caption: hitData.caption || "",
    sport: hitData.sport || "unknown",
    odds: hitData.odds || "",
    payout: hitData.payout || "",
    createdAt: serverTimestamp(),
  });

  return newHit.id;
}

/**
 * Get all greatest hits for a user
 */
export async function getGreatestHits(userId, maxResults = 20) {
  const hitsRef = collection(db, "greatestHits");
  const q = query(
    hitsRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(maxResults)
  );

  const snapshot = await getDocs(q);
  const hits = [];

  snapshot.forEach((doc) => {
    hits.push({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
    });
  });

  return hits;
}

/**
 * Delete a greatest hit
 */
export async function deleteGreatestHit(hitId, userId) {
  const hitRef = doc(db, "greatestHits", hitId);
  const hitSnap = await getDoc(hitRef);

  if (!hitSnap.exists()) {
    throw new Error("Hit not found");
  }

  // Verify ownership
  if (hitSnap.data().userId !== userId) {
    throw new Error("Not authorized to delete this hit");
  }

  await deleteDoc(hitRef);
}

/**
 * Get hit count for a user
 */
export async function getHitCount(userId) {
  const hitsRef = collection(db, "greatestHits");
  const q = query(hitsRef, where("userId", "==", userId));
  const snapshot = await getDocs(q);
  return snapshot.size;
}

/**
 * Convert file to base64 for storage
 * Use this on the frontend before calling addGreatestHit
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

export default {
  addGreatestHit,
  getGreatestHits,
  deleteGreatestHit,
  getHitCount,
  fileToBase64,
};
