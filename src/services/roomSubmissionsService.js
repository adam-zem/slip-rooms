// src/services/roomSubmissionsService.js
// Handles room submission operations for user-submitted rooms pending approval

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const SUBMISSIONS_COLLECTION = "roomSubmissions";

/**
 * Submit a new room for approval
 * @param {Object} submission - The submission data
 * @param {string} submission.oddie - User's emoji/avatar
 * @param {string} submission.oddiename - Username
 * @param {string} submission.oddieid - User's ID
 * @param {string} submission.sport - Sport ID (nfl, nba, etc.)
 * @param {string} submission.game - Game string (team vs team)
 * @param {string} submission.gameId - ESPN game ID
 * @param {string} submission.prop - The bet/prop description (ALL CAPS)
 * @returns {Promise<string>} - The submission ID
 */
export async function submitRoom(submission) {
  const docRef = await addDoc(collection(db, SUBMISSIONS_COLLECTION), {
    ...submission,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Get all pending submissions (for admin)
 * @returns {Promise<Array>} - Array of pending submissions
 */
export async function getPendingSubmissions() {
  const q = query(
    collection(db, SUBMISSIONS_COLLECTION),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate?.() || new Date(),
  }));
}

/**
 * Subscribe to pending submissions (real-time updates for admin)
 * @param {Function} callback - Called with array of submissions
 * @returns {Function} - Unsubscribe function
 */
export function subscribeToPendingSubmissions(callback) {
  const q = query(
    collection(db, SUBMISSIONS_COLLECTION),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const submissions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(),
    }));
    callback(submissions);
  });
}

/**
 * Approve a submission and create a room
 * @param {string} submissionId - The submission ID
 * @param {string} odds - The odds set by admin
 * @returns {Promise<Object>} - The submission data for room creation
 */
export async function approveSubmission(submissionId, odds) {
  const docRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
  await updateDoc(docRef, {
    status: "approved",
    odds,
    approvedAt: serverTimestamp(),
  });
}

/**
 * Reject a submission
 * @param {string} submissionId - The submission ID
 * @param {string} reason - Optional rejection reason
 */
export async function rejectSubmission(submissionId, reason = "") {
  const docRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);
  await updateDoc(docRef, {
    status: "rejected",
    rejectionReason: reason,
    rejectedAt: serverTimestamp(),
  });
}

/**
 * Delete a submission (cleanup)
 * @param {string} submissionId - The submission ID
 */
export async function deleteSubmission(submissionId) {
  await deleteDoc(doc(db, SUBMISSIONS_COLLECTION, submissionId));
}

/**
 * Get submission stats for admin dashboard
 * @returns {Promise<Object>} - Stats object with counts
 */
export async function getSubmissionStats() {
  const allDocs = await getDocs(collection(db, SUBMISSIONS_COLLECTION));

  let pending = 0;
  let approvedToday = 0;
  let rejected = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  allDocs.forEach((doc) => {
    const data = doc.data();
    if (data.status === "pending") pending++;
    if (data.status === "rejected") rejected++;
    if (data.status === "approved") {
      const approvedAt = data.approvedAt?.toDate?.();
      if (approvedAt && approvedAt >= today) {
        approvedToday++;
      }
    }
  });

  return { pending, approvedToday, rejected };
}
