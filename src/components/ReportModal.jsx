// src/components/ReportModal.jsx
// Modal for reporting posts, messages, comments, or users

import { useState } from "react";
import { submitReport, REPORT_REASONS } from "../services/reportService";
import "./ReportModal.css";

export default function ReportModal({
  isOpen,
  onClose,
  contentType, // "post" | "message" | "comment" | "user"
  contentId,
  contentSnapshot, // Optional snapshot of the content for review
  reporterId,
}) {
  const [selectedReason, setSelectedReason] = useState(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    if (!selectedReason || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await submitReport({
        reporterId,
        contentType,
        contentId,
        reason: selectedReason,
        details: details.trim(),
        contentSnapshot,
      });
      setSubmitted(true);
    } catch (err) {
      console.error("Error submitting report:", err);
      setError("Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDetails("");
    setSubmitted(false);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const contentTypeLabel = {
    post: "post",
    message: "message",
    comment: "comment",
    user: "user",
  }[contentType] || "content";

  return (
    <div className="report-modal-overlay" onClick={handleClose}>
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        {submitted ? (
          // Success state
          <div className="report-success">
            <div className="report-success-icon">
              <svg viewBox="0 0 24 24" width="48" height="48">
                <path fill="#22c55e" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <h2>Thanks for reporting</h2>
            <p>We'll review this {contentTypeLabel} and take action if it violates our Community Guidelines.</p>
            <button className="report-done-btn" onClick={handleClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="report-modal-header">
              <h2>Report {contentTypeLabel}</h2>
              <button className="report-close-btn" onClick={handleClose}>
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z"/>
                </svg>
              </button>
            </div>

            {/* Description */}
            <p className="report-description">
              Why are you reporting this {contentTypeLabel}?
            </p>

            {/* Reason options */}
            <div className="report-reasons">
              {Object.entries(REPORT_REASONS).map(([key, label]) => (
                <button
                  key={key}
                  className={`report-reason ${selectedReason === key ? "selected" : ""}`}
                  onClick={() => setSelectedReason(key)}
                >
                  <span className="report-reason-label">{label}</span>
                  <span className="report-reason-check">
                    {selectedReason === key && (
                      <svg viewBox="0 0 24 24" width="20" height="20">
                        <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    )}
                  </span>
                </button>
              ))}
            </div>

            {/* Additional details */}
            {selectedReason && (
              <div className="report-details">
                <textarea
                  placeholder="Add additional details (optional)"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={500}
                />
              </div>
            )}

            {/* Error message */}
            {error && <div className="report-error">{error}</div>}

            {/* Submit button */}
            <button
              className="report-submit-btn"
              onClick={handleSubmit}
              disabled={!selectedReason || submitting}
            >
              {submitting ? "Submitting..." : "Submit Report"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
