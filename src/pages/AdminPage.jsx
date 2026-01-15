// src/pages/AdminPage.jsx - Admin Dashboard
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  subscribeToPendingSubmissions,
  approveSubmission,
  rejectSubmission,
  getSubmissionStats,
} from "../services/roomSubmissionsService";
import { createRoom } from "../services/chatService";
import "./AdminPage.css";

function AdminPage() {
  const navigate = useNavigate();
  const { user, authReady, isAdmin } = useAuth();

  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approvedToday: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);

  // Approve modal state
  const [approveModal, setApproveModal] = useState(null); // submission being approved
  const [approveOdds, setApproveOdds] = useState("");
  const [approving, setApproving] = useState(false);

  // Redirect non-admins away
  useEffect(() => {
    if (authReady && (!user || !isAdmin)) {
      navigate("/");
    }
  }, [authReady, user, isAdmin, navigate]);

  // Subscribe to pending submissions
  useEffect(() => {
    if (!authReady || !isAdmin) return;

    const unsubscribe = subscribeToPendingSubmissions((subs) => {
      setSubmissions(subs);
      setLoading(false);
    });

    // Load stats
    getSubmissionStats().then(setStats).catch(console.error);

    return () => unsubscribe();
  }, [authReady, isAdmin]);

  // Handle approve
  const handleApprove = async () => {
    if (!approveModal || !approveOdds.trim()) return;

    setApproving(true);
    try {
      console.log("Step 1: Creating room data...");
      // Create the room
      const newRoom = {
        id: `room-${Date.now()}`,
        gameId: approveModal.gameId,
        name: approveModal.prop,
        game: approveModal.game,
        odds: approveOdds.trim(),
        sportId: approveModal.sport,
        createdBy: approveModal.oddieid || "anonymous",
      };
      console.log("Room data:", newRoom);

      console.log("Step 2: Saving room to Firestore...");
      await createRoom(newRoom);
      console.log("Step 2 complete: Room created!");

      console.log("Step 3: Marking submission as approved...");
      await approveSubmission(approveModal.id, approveOdds.trim());
      console.log("Step 3 complete: Submission approved!");

      console.log("Step 4: Refreshing stats...");
      const newStats = await getSubmissionStats();
      setStats(newStats);
      console.log("Step 4 complete: Stats refreshed!");

      // Close modal
      setApproveModal(null);
      setApproveOdds("");
    } catch (err) {
      console.error("Failed to approve submission:", err);
      console.error("Error code:", err.code);
      console.error("Error message:", err.message);
      console.error("Submission data:", approveModal);
      alert(`Failed to approve: ${err.message || err.code || "Unknown error"}`);
    } finally {
      setApproving(false);
    }
  };

  // Handle reject
  const handleReject = async (submission) => {
    if (!confirm(`Reject "${submission.prop}" by ${submission.oddiename}?`)) return;

    try {
      await rejectSubmission(submission.id);

      // Refresh stats
      const newStats = await getSubmissionStats();
      setStats(newStats);
    } catch (err) {
      console.error("Failed to reject submission:", err);
    }
  };

  // Format timestamp
  const formatTime = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Loading state
  if (!authReady) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  // Not authorized
  if (!user || !isAdmin) {
    return null; // Will redirect
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <button className="back-btn" onClick={() => navigate("/")}>
          ← Back to Rooms
        </button>
        <h1>Admin Dashboard</h1>
      </header>

      <div className="admin-content">
        {/* Quick Stats */}
        <div className="admin-section">
          <h2>Quick Stats</h2>
          <div className="admin-stats">
            <div className="admin-stat">
              <span className="stat-value">{stats.pending}</span>
              <span className="stat-label">Pending</span>
            </div>
            <div className="admin-stat">
              <span className="stat-value">{stats.approvedToday}</span>
              <span className="stat-label">Approved Today</span>
            </div>
            <div className="admin-stat">
              <span className="stat-value">{stats.rejected}</span>
              <span className="stat-label">Rejected</span>
            </div>
          </div>
        </div>

        {/* Room Submissions */}
        <div className="admin-section">
          <h2>Room Submissions</h2>
          <p className="admin-description">
            Review and approve room submissions from users. Add odds before approving.
          </p>

          {loading ? (
            <div className="admin-loading-inline">
              <div className="spinner" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="admin-empty">
              <span>📭</span>
              <p>No pending submissions</p>
            </div>
          ) : (
            <div className="submissions-list">
              {submissions.map((sub) => (
                <div key={sub.id} className="submission-card">
                  <div className="submission-header">
                    <span className="submission-oddie">{sub.oddie}</span>
                    <span className="submission-user">{sub.oddiename}</span>
                    <span className="submission-time">{formatTime(sub.createdAt)}</span>
                  </div>

                  <div className="submission-body">
                    <div className="submission-sport">{sub.sport?.toUpperCase()}</div>
                    <div className="submission-game">{sub.game}</div>
                    <div className="submission-prop">{sub.prop}</div>
                  </div>

                  <div className="submission-actions">
                    <button
                      className="action-btn reject-btn"
                      onClick={() => handleReject(sub)}
                    >
                      Reject
                    </button>
                    <button
                      className="action-btn approve-btn"
                      onClick={() => {
                        setApproveModal(sub);
                        setApproveOdds("");
                      }}
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Admin Actions */}
        <div className="admin-section">
          <h2>Admin Actions</h2>
          <div className="admin-actions">
            <button className="admin-action-btn" onClick={() => navigate("/")}>
              View Live Rooms
            </button>
          </div>
        </div>
      </div>

      {/* Approve Modal */}
      {approveModal && (
        <div className="modal-overlay" onClick={() => !approving && setApproveModal(null)}>
          <div className="approve-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Approve Room</h2>

            <div className="approve-preview">
              <div className="preview-row">
                <span className="preview-label">Submitter</span>
                <span className="preview-value">
                  {approveModal.oddie} {approveModal.oddiename}
                </span>
              </div>
              <div className="preview-row">
                <span className="preview-label">Sport</span>
                <span className="preview-value">{approveModal.sport?.toUpperCase()}</span>
              </div>
              <div className="preview-row">
                <span className="preview-label">Game</span>
                <span className="preview-value">{approveModal.game}</span>
              </div>
              <div className="preview-row">
                <span className="preview-label">Prop</span>
                <span className="preview-value prop">{approveModal.prop}</span>
              </div>
            </div>

            <div className="approve-odds-field">
              <label>Set Odds</label>
              <input
                type="text"
                placeholder="e.g., -110, +150, 2.5"
                value={approveOdds}
                onChange={(e) => setApproveOdds(e.target.value)}
                disabled={approving}
                autoFocus
              />
              <p className="field-hint">Enter the odds for this bet</p>
            </div>

            <div className="approve-actions">
              <button
                className="modal-btn cancel-btn"
                onClick={() => setApproveModal(null)}
                disabled={approving}
              >
                Cancel
              </button>
              <button
                className="modal-btn confirm-btn"
                onClick={handleApprove}
                disabled={!approveOdds.trim() || approving}
              >
                {approving ? "Creating Room..." : "Create Room"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
