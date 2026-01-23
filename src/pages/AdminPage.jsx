// src/pages/AdminPage.jsx - Admin Dashboard
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  subscribeToPendingSubmissions,
  approveSubmission,
  rejectSubmission,
  getSubmissionStats,
} from "../services/roomSubmissionsService";
import {
  subscribeToBannedWords,
  subscribeToFilterLogs,
  addBannedWord,
  toggleBannedWord,
  deleteBannedWord,
  populateDefaultBannedWords,
} from "../services/filterService";
import {
  getAdminSettings,
  updateAdminSettings,
  subscribeToAdminSettings,
  toggleRoomPin,
  toggleRoomLock,
  archiveRoom,
  deleteRoom,
  subscribeToAllRooms,
  subscribeToAllUsers,
  muteUser,
  unmuteUser,
  banUser,
  unbanUser,
  subscribeToAdmins,
  addAdmin,
  removeAdmin,
  subscribeToAdminLogs,
  getDashboardStats,
  getOnlineUsersCount,
  setTopSweatBanner,
  clearTopSweatBanner,
  sendAnnouncement,
  sendGlobalAnnouncement,
  deleteMessage,
  adminDeleteUser,
} from "../services/adminService";
import { migrateExistingUsernames, releaseUsername } from "../services/accountService";
import "./AdminPage.css";

function AdminPage() {
  const navigate = useNavigate();
  const { user, userProfile, authReady, isAdmin } = useAuth();

  // Active section
  const [activeSection, setActiveSection] = useState("stats");

  // Settings
  const [settings, setSettings] = useState({ roomApprovalMode: false });

  // Stats
  const [stats, setStats] = useState({
    activeRooms: 0,
    totalUsers: 0,
    onlineUsers: 0,
    mostActiveRoom: null,
  });

  // Rooms
  const [rooms, setRooms] = useState([]);
  const [roomSearch, setRoomSearch] = useState("");
  const [roomSort, setRoomSort] = useState("active"); // active, newest, alpha

  // Users
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState("all"); // all, online, muted, banned

  // Submissions (for approval mode)
  const [submissions, setSubmissions] = useState([]);
  const [submissionStats, setSubmissionStats] = useState({ pending: 0 });

  // Admins
  const [admins, setAdmins] = useState([]);
  const [newAdminUsername, setNewAdminUsername] = useState("");

  // Activity Logs
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState("all");

  // Top Sweat Banner
  const [bannerRoomId, setBannerRoomId] = useState("");
  const [bannerCustomText, setBannerCustomText] = useState("");

  // Announcement
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementRoomId, setAnnouncementRoomId] = useState("global");

  // Modals
  const [muteModal, setMuteModal] = useState(null);
  const [banModal, setBanModal] = useState(null);
  const [muteDuration, setMuteDuration] = useState(60);
  const [banDuration, setBanDuration] = useState(1440);
  const [actionReason, setActionReason] = useState("");
  const [selectedUser, setSelectedUser] = useState(null); // User detail modal
  const [migrationResult, setMigrationResult] = useState(null);
  const [migrating, setMigrating] = useState(false);

  // Word Filters
  const [bannedWords, setBannedWords] = useState([]);
  const [filterLogs, setFilterLogs] = useState([]);
  const [newBannedWord, setNewBannedWord] = useState("");
  const [newWordCategory, setNewWordCategory] = useState("general");
  const [filterLogsExpanded, setFilterLogsExpanded] = useState(false);
  const [populatingWords, setPopulatingWords] = useState(false);
  const [wordSearchQuery, setWordSearchQuery] = useState("");

  // Loading
  const [loading, setLoading] = useState(true);

  // Redirect non-admins away
  useEffect(() => {
    if (authReady && (!user || !isAdmin)) {
      navigate("/");
    }
  }, [authReady, user, isAdmin, navigate]);

  // Load all data
  useEffect(() => {
    if (!authReady || !isAdmin) return;

    const unsubscribers = [];

    // Subscribe to settings
    unsubscribers.push(subscribeToAdminSettings(setSettings));

    // Subscribe to rooms
    unsubscribers.push(subscribeToAllRooms(setRooms));

    // Subscribe to users
    unsubscribers.push(subscribeToAllUsers(setUsers));

    // Subscribe to admins
    unsubscribers.push(subscribeToAdmins(setAdmins));

    // Subscribe to logs
    unsubscribers.push(subscribeToAdminLogs(setLogs, 200));

    // Subscribe to submissions (for approval mode)
    unsubscribers.push(subscribeToPendingSubmissions(setSubmissions));

    // Subscribe to banned words
    unsubscribers.push(subscribeToBannedWords(setBannedWords));

    // Subscribe to filter logs
    unsubscribers.push(subscribeToFilterLogs(setFilterLogs, 100));

    // Load stats
    const loadStats = async () => {
      const dashStats = await getDashboardStats();
      const onlineCount = await getOnlineUsersCount();
      setStats({
        ...dashStats,
        onlineUsers: onlineCount,
      });
      setLoading(false);
    };
    loadStats();

    // Refresh stats every 30 seconds
    const statsInterval = setInterval(loadStats, 30000);

    return () => {
      unsubscribers.forEach((unsub) => unsub());
      clearInterval(statsInterval);
    };
  }, [authReady, isAdmin]);

  // Filter and sort rooms
  const filteredRooms = useMemo(() => {
    let result = rooms.filter((r) => r.status !== "archived");

    if (roomSearch) {
      const search = roomSearch.toLowerCase();
      result = result.filter(
        (r) =>
          r.name?.toLowerCase().includes(search) ||
          r.gameName?.toLowerCase().includes(search)
      );
    }

    switch (roomSort) {
      case "newest":
        result.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        break;
      case "alpha":
        result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      default: // active
        result.sort((a, b) => (b.userCount || 0) - (a.userCount || 0));
    }

    // Pinned rooms first
    result.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    return result;
  }, [rooms, roomSearch, roomSort]);

  // Filter users
  const filteredUsers = useMemo(() => {
    let result = [...users];

    if (userSearch) {
      const search = userSearch.toLowerCase();
      result = result.filter(
        (u) =>
          u.username?.toLowerCase().includes(search) ||
          u.email?.toLowerCase().includes(search)
      );
    }

    switch (userFilter) {
      case "muted":
        result = result.filter((u) => u.muted);
        break;
      case "banned":
        result = result.filter((u) => u.banned);
        break;
      case "online":
        // Would need presence data
        break;
    }

    // Muted/banned at top
    result.sort((a, b) => {
      if (a.banned && !b.banned) return -1;
      if (!a.banned && b.banned) return 1;
      if (a.muted && !b.muted) return -1;
      if (!a.muted && b.muted) return 1;
      return 0;
    });

    return result;
  }, [users, userSearch, userFilter]);

  // Handlers
  const handleToggleApprovalMode = async () => {
    await updateAdminSettings({ roomApprovalMode: !settings.roomApprovalMode });
  };

  const handlePinRoom = async (roomId, currentlyPinned) => {
    await toggleRoomPin(roomId, !currentlyPinned, user.uid);
  };

  const handleLockRoom = async (roomId, currentlyLocked) => {
    await toggleRoomLock(roomId, !currentlyLocked, user.uid);
  };

  const handleArchiveRoom = async (roomId) => {
    if (!confirm("Archive this room?")) return;
    await archiveRoom(roomId, user.uid);
  };

  const handleDeleteRoom = async (roomId, roomName) => {
    if (!confirm(`Permanently delete "${roomName}"?`)) return;
    await deleteRoom(roomId, user.uid);
  };

  const handleMuteUser = async () => {
    if (!muteModal) return;
    await muteUser(muteModal.id, muteDuration, user.uid, actionReason);
    setMuteModal(null);
    setMuteDuration(60);
    setActionReason("");
  };

  const handleUnmuteUser = async (userId) => {
    await unmuteUser(userId, user.uid);
  };

  const handleBanUser = async () => {
    if (!banModal) return;
    await banUser(banModal.id, banDuration, user.uid, actionReason);
    setBanModal(null);
    setBanDuration(1440);
    setActionReason("");
  };

  const handleUnbanUser = async (userId) => {
    await unbanUser(userId, user.uid);
  };

  const handleAddAdmin = async () => {
    if (!newAdminUsername.trim()) return;
    const targetUser = users.find(
      (u) => u.username?.toLowerCase() === newAdminUsername.toLowerCase()
    );
    if (!targetUser) {
      alert("User not found");
      return;
    }
    if (targetUser.isAdmin) {
      alert("User is already an admin");
      return;
    }
    await addAdmin(targetUser.id, user.uid);
    setNewAdminUsername("");
  };

  const handleRemoveAdmin = async (adminId, username) => {
    if (adminId === user.uid) {
      alert("You cannot remove yourself as admin");
      return;
    }
    if (!confirm(`Remove admin status from ${username}?`)) return;
    await removeAdmin(adminId, user.uid);
  };

  const handleSetBanner = async () => {
    await setTopSweatBanner(bannerRoomId || null, bannerCustomText || null, user.uid);
    alert("Banner updated!");
  };

  const handleClearBanner = async () => {
    await clearTopSweatBanner(user.uid);
    setBannerRoomId("");
    setBannerCustomText("");
    alert("Banner cleared!");
  };

  const handleSendAnnouncement = async () => {
    if (!announcementText.trim()) return;
    if (announcementRoomId === "global") {
      const result = await sendGlobalAnnouncement(announcementText, user.uid);
      alert(`Sent to ${result.roomCount} rooms!`);
    } else {
      await sendAnnouncement(announcementRoomId, announcementText, user.uid);
      alert("Announcement sent!");
    }
    setAnnouncementText("");
  };

  // Format helpers
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
  };

  const getActionLabel = (action) => {
    const labels = {
      pin_room: "Pinned room",
      unpin_room: "Unpinned room",
      lock_room: "Locked room",
      unlock_room: "Unlocked room",
      archive_room: "Archived room",
      delete_room: "Deleted room",
      mute_user: "Muted user",
      unmute_user: "Unmuted user",
      ban_user: "Banned user",
      unban_user: "Unbanned user",
      add_admin: "Added admin",
      remove_admin: "Removed admin",
      delete_message: "Deleted message",
      send_announcement: "Sent announcement",
      send_global_announcement: "Sent global announcement",
      set_top_sweat: "Set top sweat banner",
      clear_top_sweat: "Cleared top sweat banner",
    };
    return labels[action] || action;
  };

  // Loading state
  if (!authReady || loading) {
    return (
      <div className="admin-page">
        <div className="admin-loading">
          <div className="spinner" />
          <p>Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  // Not authorized
  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="admin-page">
      {/* Top Bar */}
      <header className="admin-header">
        <div className="admin-header-left">
          <button className="back-btn" onClick={() => navigate("/")}>
            ← Back to Site
          </button>
          <h1>Admin Dashboard</h1>
        </div>
        <div className="admin-header-right">
          <div className="approval-toggle">
            <span>Room Approval Mode</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.roomApprovalMode}
                onChange={handleToggleApprovalMode}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className={settings.roomApprovalMode ? "status-on" : "status-off"}>
              {settings.roomApprovalMode ? "ON" : "OFF"}
            </span>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="admin-nav">
        <button
          className={activeSection === "stats" ? "active" : ""}
          onClick={() => setActiveSection("stats")}
        >
          📊 Stats
        </button>
        <button
          className={activeSection === "rooms" ? "active" : ""}
          onClick={() => setActiveSection("rooms")}
        >
          🏠 Rooms ({filteredRooms.length})
        </button>
        <button
          className={activeSection === "users" ? "active" : ""}
          onClick={() => setActiveSection("users")}
        >
          👥 Users ({users.length})
        </button>
        {settings.roomApprovalMode && (
          <button
            className={activeSection === "submissions" ? "active" : ""}
            onClick={() => setActiveSection("submissions")}
          >
            📝 Submissions ({submissions.length})
          </button>
        )}
        <button
          className={activeSection === "content" ? "active" : ""}
          onClick={() => setActiveSection("content")}
        >
          📢 Content
        </button>
        <button
          className={activeSection === "filters" ? "active" : ""}
          onClick={() => setActiveSection("filters")}
        >
          🚫 Word Filters ({bannedWords.length})
        </button>
        <button
          className={activeSection === "admins" ? "active" : ""}
          onClick={() => setActiveSection("admins")}
        >
          🛡️ Admins ({admins.length})
        </button>
        <button
          className={activeSection === "logs" ? "active" : ""}
          onClick={() => setActiveSection("logs")}
        >
          📋 Logs
        </button>
      </nav>

      <div className="admin-content">
        {/* STATS SECTION */}
        {activeSection === "stats" && (
          <div className="admin-section">
            <h2>Quick Stats</h2>
            <div className="admin-stats-grid">
              <div className="stat-card">
                <span className="stat-icon">🏠</span>
                <span className="stat-value">{stats.activeRooms}</span>
                <span className="stat-label">Active Rooms</span>
              </div>
              <div className="stat-card">
                <span className="stat-icon">🟢</span>
                <span className="stat-value">{stats.onlineUsers}</span>
                <span className="stat-label">Users Online</span>
              </div>
              <div className="stat-card">
                <span className="stat-icon">👥</span>
                <span className="stat-value">{stats.totalUsers}</span>
                <span className="stat-label">Total Users</span>
              </div>
              {stats.mostActiveRoom && (
                <div
                  className="stat-card clickable"
                  onClick={() => navigate(`/?room=${stats.mostActiveRoom.id}`)}
                >
                  <span className="stat-icon">🔥</span>
                  <span className="stat-value">{stats.mostActiveRoom.userCount}</span>
                  <span className="stat-label">
                    Most Active: {stats.mostActiveRoom.name?.substring(0, 20)}...
                  </span>
                </div>
              )}
            </div>

            {/* Migration Tool */}
            <div className="admin-tool-card">
              <h3>Username Migration</h3>
              <p>Reserve all existing usernames to prevent duplicates.</p>
              <button
                className="action-btn success"
                onClick={async () => {
                  if (!confirm("This will reserve all existing usernames. Continue?")) return;
                  setMigrating(true);
                  setMigrationResult(null);
                  try {
                    const result = await migrateExistingUsernames();
                    setMigrationResult(result);
                  } catch (err) {
                    setMigrationResult({ error: err.message });
                  }
                  setMigrating(false);
                }}
                disabled={migrating}
              >
                {migrating ? "Migrating..." : "Run Migration"}
              </button>
              {migrationResult && (
                <div className="migration-result">
                  {migrationResult.error ? (
                    <span className="error">Error: {migrationResult.error}</span>
                  ) : (
                    <span className="success">
                      Migrated: {migrationResult.migrated} | Skipped: {migrationResult.skipped} | Errors: {migrationResult.errors}
                    </span>
                  )}
                </div>
              )}
            </div>

                      </div>
        )}

        {/* ROOMS SECTION */}
        {activeSection === "rooms" && (
          <div className="admin-section">
            <div className="section-header">
              <h2>Room Management</h2>
              <div className="section-controls">
                <input
                  type="text"
                  placeholder="Search rooms..."
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  className="search-input"
                />
                <select
                  value={roomSort}
                  onChange={(e) => setRoomSort(e.target.value)}
                  className="sort-select"
                >
                  <option value="active">Most Active</option>
                  <option value="newest">Newest</option>
                  <option value="alpha">Alphabetical</option>
                </select>
              </div>
            </div>

            <div className="rooms-list">
              {filteredRooms.length === 0 ? (
                <div className="empty-state">No rooms found</div>
              ) : (
                filteredRooms.map((room) => (
                  <div
                    key={room.id}
                    className={`room-card ${room.locked ? "locked" : ""} ${room.pinned ? "pinned" : ""}`}
                  >
                    <div className="room-info">
                      <div className="room-name">
                        {room.pinned && <span className="room-badge pin">📌</span>}
                        {room.locked && <span className="room-badge lock">🔒</span>}
                        {room.name}
                      </div>
                      <div className="room-meta">
                        <span>{room.userCount || 0} users</span>
                        <span>•</span>
                        <span>{room.sport?.toUpperCase()}</span>
                        <span>•</span>
                        <span>{room.gameName}</span>
                      </div>
                    </div>
                    <div className="room-actions">
                      <button
                        className={`action-btn ${room.pinned ? "active" : ""}`}
                        onClick={() => handlePinRoom(room.id, room.pinned)}
                        title={room.pinned ? "Unpin" : "Pin"}
                      >
                        📌
                      </button>
                      <button
                        className={`action-btn ${room.locked ? "active" : ""}`}
                        onClick={() => handleLockRoom(room.id, room.locked)}
                        title={room.locked ? "Unlock" : "Lock"}
                      >
                        🔒
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => handleArchiveRoom(room.id)}
                        title="Archive"
                      >
                        📁
                      </button>
                      <button
                        className="action-btn danger"
                        onClick={() => handleDeleteRoom(room.id, room.name)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* USERS SECTION */}
        {activeSection === "users" && (
          <div className="admin-section">
            <div className="section-header">
              <h2>User Management</h2>
              <div className="section-controls">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="search-input"
                />
                <select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Users</option>
                  <option value="muted">Muted</option>
                  <option value="banned">Banned</option>
                </select>
              </div>
            </div>

            <div className="users-list">
              {filteredUsers.length === 0 ? (
                <div className="empty-state">No users found</div>
              ) : (
                filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    className={`user-card ${u.banned ? "banned" : ""} ${u.muted ? "muted" : ""}`}
                  >
                    <div className="user-info clickable" onClick={() => setSelectedUser(u)}>
                      <div className="user-avatar">{u.avatar || "🔥"}</div>
                      <div className="user-details">
                        <div className="user-name">
                          {u.username || "Anonymous"}
                          {u.isAdmin && <span className="admin-badge">ADMIN</span>}
                        </div>
                        <div className="user-status">
                          {u.banned && (
                            <span className="status-badge banned">
                              BANNED {u.banUntil ? `until ${formatTime(u.banUntil)}` : "(permanent)"}
                            </span>
                          )}
                          {u.muted && (
                            <span className="status-badge muted">
                              MUTED {u.muteUntil ? `until ${formatTime(u.muteUntil)}` : "(permanent)"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="user-actions">
                      {u.muted ? (
                        <button
                          className="action-btn success"
                          onClick={() => handleUnmuteUser(u.id)}
                        >
                          Unmute
                        </button>
                      ) : (
                        <button
                          className="action-btn warning"
                          onClick={() => setMuteModal(u)}
                        >
                          Mute
                        </button>
                      )}
                      {u.banned ? (
                        <button
                          className="action-btn success"
                          onClick={() => handleUnbanUser(u.id)}
                        >
                          Unban
                        </button>
                      ) : (
                        <button
                          className="action-btn danger"
                          onClick={() => setBanModal(u)}
                        >
                          Ban
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* SUBMISSIONS SECTION */}
        {activeSection === "submissions" && settings.roomApprovalMode && (
          <div className="admin-section">
            <h2>Room Submissions</h2>
            <p className="section-description">
              Review and approve room submissions from users.
            </p>

            {submissions.length === 0 ? (
              <div className="empty-state">
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
                        className="action-btn danger"
                        onClick={() => rejectSubmission(sub.id)}
                      >
                        Reject
                      </button>
                      <button
                        className="action-btn success"
                        onClick={() => approveSubmission(sub.id, "-110")}
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CONTENT SECTION */}
        {activeSection === "content" && (
          <div className="admin-section">
            <h2>Content Control</h2>

            {/* Top Sweat Banner */}
            <div className="content-card">
              <h3>Top Sweat Banner</h3>
              <p>Set a custom room to feature in the top sweat banner.</p>
              <div className="content-form">
                <select
                  value={bannerRoomId}
                  onChange={(e) => setBannerRoomId(e.target.value)}
                  className="form-select"
                >
                  <option value="">Select a room...</option>
                  {filteredRooms.slice(0, 50).map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name} ({room.userCount || 0} users)
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Or enter custom text..."
                  value={bannerCustomText}
                  onChange={(e) => setBannerCustomText(e.target.value)}
                  className="form-input"
                />
                <div className="form-actions">
                  <button className="action-btn success" onClick={handleSetBanner}>
                    Set Banner
                  </button>
                  <button className="action-btn" onClick={handleClearBanner}>
                    Clear Banner
                  </button>
                </div>
              </div>
            </div>

            {/* Announcement */}
            <div className="content-card">
              <h3>Send Announcement</h3>
              <p>Send a system message to rooms.</p>
              <div className="content-form">
                <select
                  value={announcementRoomId}
                  onChange={(e) => setAnnouncementRoomId(e.target.value)}
                  className="form-select"
                >
                  <option value="global">📢 All Rooms (Global)</option>
                  {filteredRooms.slice(0, 50).map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
                <textarea
                  placeholder="Enter announcement message..."
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  className="form-textarea"
                  rows={3}
                />
                <button
                  className="action-btn success"
                  onClick={handleSendAnnouncement}
                  disabled={!announcementText.trim()}
                >
                  Send Announcement
                </button>
              </div>
            </div>
          </div>
        )}

        {/* WORD FILTERS SECTION */}
        {activeSection === "filters" && (
          <div className="admin-section">
            <h2>Word Filters</h2>
            <p className="section-description">
              Manage banned words and phrases. Messages containing these words will be blocked.
            </p>

            {/* Add New Word */}
            <div className="content-card">
              <h3>Add Banned Word</h3>
              <div className="content-form add-word-form">
                <input
                  type="text"
                  placeholder="Enter word or phrase..."
                  value={newBannedWord}
                  onChange={(e) => setNewBannedWord(e.target.value)}
                  className="form-input"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newBannedWord.trim()) {
                      addBannedWord(newBannedWord, newWordCategory)
                        .then(() => setNewBannedWord(""))
                        .catch((err) => alert(err.message));
                    }
                  }}
                />
                <select
                  value={newWordCategory}
                  onChange={(e) => setNewWordCategory(e.target.value)}
                  className="form-select category-select"
                >
                  <option value="general">General</option>
                  <option value="profanity">Profanity</option>
                  <option value="racial">Racial Slur</option>
                  <option value="homophobic">Homophobic</option>
                  <option value="ableist">Ableist</option>
                  <option value="violence">Violence/Threats</option>
                </select>
                <button
                  className="action-btn success"
                  onClick={() => {
                    if (!newBannedWord.trim()) return;
                    addBannedWord(newBannedWord, newWordCategory)
                      .then(() => setNewBannedWord(""))
                      .catch((err) => alert(err.message));
                  }}
                >
                  Add Word
                </button>
              </div>

              {/* Populate Defaults Button */}
              <div className="populate-defaults">
                <button
                  className="action-btn"
                  onClick={async () => {
                    if (!confirm("This will add default profanity, slurs, and offensive terms to the filter. Continue?")) return;
                    setPopulatingWords(true);
                    try {
                      const count = await populateDefaultBannedWords();
                      alert(`Added ${count} new words to the filter.`);
                    } catch (err) {
                      alert("Error: " + err.message);
                    }
                    setPopulatingWords(false);
                  }}
                  disabled={populatingWords}
                >
                  {populatingWords ? "Adding..." : "Populate Default Words"}
                </button>
                <span className="hint">Adds common profanity, slurs, and offensive terms</span>
              </div>
            </div>

            {/* Banned Words List */}
            <div className="content-card">
              <div className="card-header">
                <h3>Banned Words ({bannedWords.length})</h3>
                <input
                  type="text"
                  placeholder="Search words..."
                  value={wordSearchQuery}
                  onChange={(e) => setWordSearchQuery(e.target.value)}
                  className="search-input small"
                />
              </div>

              <div className="banned-words-list">
                {bannedWords.length === 0 ? (
                  <div className="empty-state">
                    <span>📝</span>
                    <p>No banned words yet. Add some above or populate defaults.</p>
                  </div>
                ) : (
                  bannedWords
                    .filter((w) =>
                      !wordSearchQuery ||
                      w.word.toLowerCase().includes(wordSearchQuery.toLowerCase()) ||
                      w.category?.toLowerCase().includes(wordSearchQuery.toLowerCase())
                    )
                    .map((wordObj) => (
                      <div
                        key={wordObj.id}
                        className={`banned-word-item ${!wordObj.enabled ? "disabled" : ""}`}
                      >
                        <div className="word-info">
                          <span className="word-text">{wordObj.word}</span>
                          <span className={`word-category ${wordObj.category}`}>
                            {wordObj.category || "general"}
                          </span>
                        </div>
                        <div className="word-actions">
                          <label className="toggle-switch small">
                            <input
                              type="checkbox"
                              checked={wordObj.enabled}
                              onChange={() => toggleBannedWord(wordObj.id, !wordObj.enabled)}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                          <button
                            className="action-btn danger small"
                            onClick={() => {
                              if (confirm(`Delete "${wordObj.word}" from filter?`)) {
                                deleteBannedWord(wordObj.id);
                              }
                            }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Filter Logs */}
            <div className="content-card">
              <div
                className="card-header clickable"
                onClick={() => setFilterLogsExpanded(!filterLogsExpanded)}
              >
                <h3>Filter Violation Logs ({filterLogs.length})</h3>
                <span className="expand-icon">{filterLogsExpanded ? "▼" : "▶"}</span>
              </div>

              {filterLogsExpanded && (
                <div className="filter-logs-list">
                  {filterLogs.length === 0 ? (
                    <div className="empty-state">
                      <span>✅</span>
                      <p>No filter violations recorded yet.</p>
                    </div>
                  ) : (
                    filterLogs.map((log) => (
                      <div key={log.id} className="filter-log-item">
                        <div className="log-time">{formatTime(log.timestamp)}</div>
                        <div className="log-user">@{log.username}</div>
                        <div className="log-context">{log.context}</div>
                        <div className="log-matched">
                          Blocked: <span className="matched-word">{log.matchedWord}</span>
                        </div>
                        <div className="log-original" title={log.originalText}>
                          "{log.originalText?.substring(0, 50)}{log.originalText?.length > 50 ? "..." : ""}"
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ADMINS SECTION */}
        {activeSection === "admins" && (
          <div className="admin-section">
            <h2>Admin Management</h2>

            {/* Add Admin */}
            <div className="add-admin-form">
              <input
                type="text"
                placeholder="Enter username to add as admin..."
                value={newAdminUsername}
                onChange={(e) => setNewAdminUsername(e.target.value)}
                className="form-input"
              />
              <button className="action-btn success" onClick={handleAddAdmin}>
                Add Admin
              </button>
            </div>

            {/* Admin List */}
            <div className="admins-list">
              {admins.map((admin) => (
                <div key={admin.id} className="admin-card">
                  <div className="admin-info">
                    <div className="admin-avatar">{admin.avatar || "🛡️"}</div>
                    <div className="admin-details">
                      <div className="admin-name">{admin.username}</div>
                      <div className="admin-since">
                        Admin since {formatTime(admin.adminSince)}
                      </div>
                    </div>
                  </div>
                  {admin.id !== user.uid && (
                    <button
                      className="action-btn danger"
                      onClick={() => handleRemoveAdmin(admin.id, admin.username)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LOGS SECTION */}
        {activeSection === "logs" && (
          <div className="admin-section">
            <h2>Admin Activity Log</h2>

            <div className="logs-list">
              {logs.length === 0 ? (
                <div className="empty-state">No activity logged yet</div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="log-entry">
                    <div className="log-time">{formatTime(log.timestamp)}</div>
                    <div className="log-content">
                      <span className="log-admin">{log.adminUsername}</span>
                      <span className="log-action">{getActionLabel(log.action)}</span>
                      {log.details?.roomName && (
                        <span className="log-detail">"{log.details.roomName}"</span>
                      )}
                      {log.details?.username && (
                        <span className="log-detail">@{log.details.username}</span>
                      )}
                      {log.details?.duration && (
                        <span className="log-detail">for {log.details.duration}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mute Modal */}
      {muteModal && (
        <div className="modal-overlay" onClick={() => setMuteModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Mute {muteModal.username}</h2>
            <div className="modal-form">
              <label>Duration</label>
              <select
                value={muteDuration}
                onChange={(e) => setMuteDuration(Number(e.target.value))}
                className="form-select"
              >
                <option value={10}>10 minutes</option>
                <option value={60}>1 hour</option>
                <option value={1440}>24 hours</option>
                <option value={10080}>1 week</option>
                <option value={0}>Permanent</option>
              </select>
              <label>Reason (optional)</label>
              <input
                type="text"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Reason for mute..."
                className="form-input"
              />
            </div>
            <div className="modal-actions">
              <button className="action-btn" onClick={() => setMuteModal(null)}>
                Cancel
              </button>
              <button className="action-btn warning" onClick={handleMuteUser}>
                Mute User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban Modal */}
      {banModal && (
        <div className="modal-overlay" onClick={() => setBanModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Ban {banModal.username}</h2>
            <div className="modal-form">
              <label>Duration</label>
              <select
                value={banDuration}
                onChange={(e) => setBanDuration(Number(e.target.value))}
                className="form-select"
              >
                <option value={1440}>24 hours</option>
                <option value={10080}>1 week</option>
                <option value={43200}>30 days</option>
                <option value={0}>Permanent</option>
              </select>
              <label>Reason (optional)</label>
              <input
                type="text"
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Reason for ban..."
                className="form-input"
              />
            </div>
            <div className="modal-actions">
              <button className="action-btn" onClick={() => setBanModal(null)}>
                Cancel
              </button>
              <button className="action-btn danger" onClick={handleBanUser}>
                Ban User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal user-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedUser(null)}>×</button>
            <div className="user-detail-header">
              <div className="user-detail-avatar">{selectedUser.avatar || "🔥"}</div>
              <h2>{selectedUser.username || "Anonymous"}</h2>
              {selectedUser.isAdmin && <span className="admin-badge">ADMIN</span>}
            </div>

            <div className="user-detail-info">
              <div className="detail-row">
                <span className="detail-label">User ID</span>
                <span className="detail-value mono">{selectedUser.id}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Email</span>
                <span className="detail-value">{selectedUser.email || "N/A"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Joined</span>
                <span className="detail-value">{formatTime(selectedUser.createdAt)}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Provider</span>
                <span className="detail-value">{selectedUser.provider || "email"}</span>
              </div>
              {selectedUser.muted && (
                <div className="detail-row warning">
                  <span className="detail-label">Muted</span>
                  <span className="detail-value">
                    {selectedUser.muteUntil ? `Until ${formatTime(selectedUser.muteUntil)}` : "Permanent"}
                    {selectedUser.muteReason && ` - ${selectedUser.muteReason}`}
                  </span>
                </div>
              )}
              {selectedUser.banned && (
                <div className="detail-row danger">
                  <span className="detail-label">Banned</span>
                  <span className="detail-value">
                    {selectedUser.banUntil ? `Until ${formatTime(selectedUser.banUntil)}` : "Permanent"}
                    {selectedUser.banReason && ` - ${selectedUser.banReason}`}
                  </span>
                </div>
              )}
            </div>

            <div className="user-detail-actions">
              {selectedUser.muted ? (
                <button className="action-btn success" onClick={() => { handleUnmuteUser(selectedUser.id); setSelectedUser(null); }}>
                  Unmute
                </button>
              ) : (
                <button className="action-btn warning" onClick={() => { setMuteModal(selectedUser); setSelectedUser(null); }}>
                  Mute
                </button>
              )}
              {selectedUser.banned ? (
                <button className="action-btn success" onClick={() => { handleUnbanUser(selectedUser.id); setSelectedUser(null); }}>
                  Unban
                </button>
              ) : (
                <button className="action-btn danger" onClick={() => { setBanModal(selectedUser); setSelectedUser(null); }}>
                  Ban
                </button>
              )}
            </div>

            <div className="user-detail-delete">
              <button
                className="action-btn danger full-width"
                onClick={async () => {
                  const confirmText = prompt(`Type "${selectedUser.username}" to permanently delete this account:`);
                  if (confirmText !== selectedUser.username) return;

                  try {
                    await adminDeleteUser(selectedUser.id, user.uid);
                    alert(`Account "${selectedUser.username}" has been deleted.`);
                    setSelectedUser(null);
                  } catch (err) {
                    alert("Failed to delete account: " + err.message);
                  }
                }}
              >
                Delete Account Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
