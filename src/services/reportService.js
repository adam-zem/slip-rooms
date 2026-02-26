// src/services/reportService.js
// Service for handling content reports (posts, messages, users)

import { db } from "../firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";

const REPORT_REASONS = {
  spam: "Spam or misleading",
  harassment: "Harassment or bullying",
  hate: "Hate speech or symbols",
  violence: "Violence or dangerous behavior",
  nudity: "Nudity or sexual content",
  illegal: "Illegal activities",
  impersonation: "Impersonation",
  other: "Other",
};

/**
 * Submit a report for content (post, message, or user)
 * @param {Object} params - Report parameters
 * @param {string} params.reporterId - ID of user submitting report
 * @param {string} params.contentType - Type: "post", "message", "user", "comment"
 * @param {string} params.contentId - ID of reported content
 * @param {string} params.reason - Report reason key
 * @param {string} [params.details] - Additional details
 * @param {Object} [params.contentSnapshot] - Snapshot of content for review
 */
export async function submitReport({
  reporterId,
  contentType,
  contentId,
  reason,
  details = "",
  contentSnapshot = {},
}) {
  if (!reporterId || !contentType || !contentId || !reason) {
    throw new Error("Missing required report fields");
  }

  const reportData = {
    reporterId,
    contentType,
    contentId,
    reason,
    reasonLabel: REPORT_REASONS[reason] || reason,
    details,
    contentSnapshot,
    status: "pending", // pending, reviewed, actioned, dismissed
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, "reports"), reportData);
  return docRef.id;
}

/**
 * Check if user has already reported this content
 */
export async function hasUserReported(reporterId, contentType, contentId) {
  const q = query(
    collection(db, "reports"),
    where("reporterId", "==", reporterId),
    where("contentType", "==", contentType),
    where("contentId", "==", contentId)
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

export { REPORT_REASONS };
