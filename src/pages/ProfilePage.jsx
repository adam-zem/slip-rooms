// src/pages/ProfilePage.jsx
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { getProfile, updateProfile, searchUsers, createProfileIfMissing } from "../services/profileService";
import { getFriends, getPendingRequests, sendFriendRequest, acceptFriendRequest, declineFriendRequest, removeFriend, checkFriendship } from "../services/friendsService";
import { getGreatestHits, addGreatestHit, deleteGreatestHit, fileToBase64 } from "../services/greatestHitsService";
import "./ProfilePage.css";

// Tab constants
const TABS = {
  GREATEST_HITS: "greatest-hits",
  FRIENDS: "friends",
};

// Level emoji based on level
function getLevelEmoji(level) {
  if (level >= 20) return "👑";
  if (level >= 15) return "🔥";
  if (level >= 10) return "⭐";
  if (level >= 5) return "💪";
  return "🐣";
}

function ProfilePage() {
  const { userId: paramUserId } = useParams();
  const navigate = useNavigate();
  const { user, userProfile, authReady, refreshProfile } = useAuth();

  // Determine whose profile we're viewing
  const isOwnProfile = !paramUserId || paramUserId === user?.uid;
  const targetUserId = paramUserId || user?.uid;

  // Profile state
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(TABS.GREATEST_HITS);

  // Friends state
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [friendRequestSent, setFriendRequestSent] = useState(false);

  // Greatest Hits state
  const [hits, setHits] = useState([]);
  const [hitsLoading, setHitsLoading] = useState(false);
  const [showUploadHit, setShowUploadHit] = useState(false);
  const [uploadData, setUploadData] = useState({ caption: "", sport: "nfl", odds: "", payout: "" });
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Profile picture upload
  const [uploadingPic, setUploadingPic] = useState(false);
  const profilePicRef = useRef(null);
  const hitFileRef = useRef(null);

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Friend search state
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Load profile data
  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        let profileData = await getProfile(targetUserId);

        // If viewing own profile and it doesn't exist, create it
        if (!profileData && isOwnProfile && user) {
          profileData = await createProfileIfMissing(user.uid, {
            username: userProfile?.username || user.displayName || user.email?.split("@")[0] || "User",
            email: user.email || "",
          });
        }

        if (profileData) {
          setProfile(profileData);
          setSettingsForm({
            bio: profileData.bio || "",
            avatarEmoji: profileData.avatarEmoji || "🔥",
            avatarColor: profileData.avatarColor || "green",
            favoriteMarket: profileData.favoriteMarket || "NFL",
            publicProfile: profileData.publicProfile !== false,
          });
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoading(false);
      }
    }

    if (targetUserId) {
      loadProfile();
    } else {
      setLoading(false);
    }
  }, [targetUserId, user?.uid, isOwnProfile, user, userProfile]);

  // Check friendship status when viewing another profile
  useEffect(() => {
    async function checkFriendStatus() {
      if (!isOwnProfile && user?.uid && targetUserId) {
        const areFriends = await checkFriendship(user.uid, targetUserId);
        setIsFriend(areFriends);
      }
    }
    checkFriendStatus();
  }, [isOwnProfile, user?.uid, targetUserId]);

  // Load friends when tab changes
  useEffect(() => {
    async function loadFriends() {
      if (activeTab !== TABS.FRIENDS) return;

      setFriendsLoading(true);
      try {
        const [friendsList, requests] = await Promise.all([
          getFriends(targetUserId),
          isOwnProfile ? getPendingRequests(targetUserId) : Promise.resolve([]),
        ]);
        setFriends(friendsList);
        setPendingRequests(requests);
      } catch (error) {
        console.error("Error loading friends:", error);
      } finally {
        setFriendsLoading(false);
      }
    }

    loadFriends();
  }, [activeTab, targetUserId, isOwnProfile]);

  // Load greatest hits when tab changes
  useEffect(() => {
    async function loadHits() {
      if (activeTab !== TABS.GREATEST_HITS) return;

      setHitsLoading(true);
      try {
        const hitsList = await getGreatestHits(targetUserId);
        setHits(hitsList);
      } catch (error) {
        console.error("Error loading hits:", error);
      } finally {
        setHitsLoading(false);
      }
    }

    loadHits();
  }, [activeTab, targetUserId]);

  // Search users
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (searchTerm.length >= 2) {
        setSearching(true);
        try {
          const results = await searchUsers(searchTerm, user?.uid);
          setSearchResults(results);
        } catch (error) {
          console.error("Search error:", error);
        } finally {
          setSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimer);
  }, [searchTerm, user?.uid]);

  // Profile picture upload handler
  const handleProfilePicUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    setUploadingPic(true);
    try {
      // Upload to Firebase Storage
      const storageRef = ref(storage, `profilePics/${user.uid}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Update profile with new picture URL
      await updateProfile(user.uid, { profilePicture: downloadURL });

      // Update local state
      setProfile((prev) => ({ ...prev, profilePicture: downloadURL }));
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      alert("Failed to upload. Please try again.");
    } finally {
      setUploadingPic(false);
    }
  };

  // Greatest hit file select
  const handleHitFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setUploadPreview(base64);
    } catch (error) {
      console.error("Error reading file:", error);
    }
  };

  // Upload greatest hit
  const handleUploadHit = async () => {
    if (!uploadPreview || !user?.uid) return;

    setUploading(true);
    try {
      await addGreatestHit(user.uid, {
        imageUrl: uploadPreview,
        caption: uploadData.caption,
        sport: uploadData.sport,
        odds: uploadData.odds,
        payout: uploadData.payout,
      });

      const hitsList = await getGreatestHits(targetUserId);
      setHits(hitsList);

      setShowUploadHit(false);
      setUploadPreview(null);
      setUploadData({ caption: "", sport: "nfl", odds: "", payout: "" });
    } catch (error) {
      console.error("Error uploading hit:", error);
      alert("Failed to upload. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteHit = async (hitId) => {
    if (!confirm("Delete this greatest hit?")) return;

    try {
      await deleteGreatestHit(hitId, user.uid);
      setHits((prev) => prev.filter((h) => h.id !== hitId));
    } catch (error) {
      console.error("Error deleting hit:", error);
    }
  };

  // Save settings
  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await updateProfile(user.uid, settingsForm);
      await refreshProfile();
      const profileData = await getProfile(user.uid);
      setProfile(profileData);
      setShowSettings(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Friend actions
  const handleSendFriendRequest = async (toUserId) => {
    try {
      await sendFriendRequest(user.uid, toUserId);
      if (toUserId === targetUserId) {
        setFriendRequestSent(true);
      }
      setSearchResults((prev) =>
        prev.map((u) => (u.id === toUserId ? { ...u, requestSent: true } : u))
      );
    } catch (error) {
      alert(error.message);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await acceptFriendRequest(requestId);
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      const friendsList = await getFriends(targetUserId);
      setFriends(friendsList);
    } catch (error) {
      console.error("Error accepting request:", error);
    }
  };

  const handleDeclineRequest = async (requestId) => {
    try {
      await declineFriendRequest(requestId);
      setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (error) {
      console.error("Error declining request:", error);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!confirm("Remove this friend?")) return;

    try {
      await removeFriend(user.uid, friendId);
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
      if (friendId === targetUserId) {
        setIsFriend(false);
      }
    } catch (error) {
      console.error("Error removing friend:", error);
    }
  };

  // Auth checks
  if (!authReady) {
    return (
      <div className="profile-page">
        <div className="profile-loading">
          <div className="profile-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-page">
        <div className="profile-not-found">
          <h2>Please Log In</h2>
          <p>You need to be logged in to view profiles.</p>
          <button onClick={() => navigate("/")} className="profile-back-btn">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">
          <div className="profile-spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-page">
        <div className="profile-not-found">
          <h2>Profile Not Found</h2>
          <p>This user doesn't exist or their profile is private.</p>
          <button onClick={() => navigate("/")} className="profile-back-btn">
            Back to Rooms
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* Header bar */}
      <div className="profile-header-bar">
        <button onClick={() => navigate("/")} className="profile-back-btn">
          ← Back to Rooms
        </button>
        {isOwnProfile && (
          <button className="profile-settings-btn" onClick={() => setShowSettings(true)}>
            ⚙️
          </button>
        )}
      </div>

      {/* Main profile content */}
      <div className="profile-content">
        {/* Profile card - left/top section */}
        <div className="profile-card">
          {/* Profile picture */}
          <div
            className={`profile-picture ${isOwnProfile ? "editable" : ""}`}
            onClick={() => isOwnProfile && profilePicRef.current?.click()}
          >
            {uploadingPic ? (
              <div className="profile-pic-loading">
                <div className="profile-spinner-small"></div>
              </div>
            ) : profile.profilePicture ? (
              <img src={profile.profilePicture} alt={profile.username} />
            ) : (
              <div className={`profile-pic-emoji profile-avatar-${profile.avatarColor}`}>
                {profile.avatarEmoji}
              </div>
            )}
            {isOwnProfile && (
              <div className="profile-pic-overlay">
                <span>📷</span>
              </div>
            )}
            <input
              ref={profilePicRef}
              type="file"
              accept="image/*"
              onChange={handleProfilePicUpload}
              style={{ display: "none" }}
            />
          </div>

          {/* Username */}
          <h1 className="profile-username">{profile.username}</h1>

          {/* Level badge */}
          <div className="profile-level-badge">
            <span className="profile-level">LVL {profile.level}</span>
            <span className="profile-level-emoji">{getLevelEmoji(profile.level)}</span>
            <span className="profile-title">{profile.title}</span>
          </div>

          {/* XP Progress bar */}
          <div className="profile-xp-bar-container">
            <div className="profile-xp-bar">
              <div
                className="profile-xp-fill"
                style={{ width: `${profile.progress || 0}%` }}
              ></div>
            </div>
            <span className="profile-xp-text">
              {profile.xp} / {profile.nextLevelXP || "MAX"} XP
            </span>
          </div>

          {/* Bio */}
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}

          {/* Action button */}
          {isOwnProfile ? (
            <button className="profile-action-btn edit" onClick={() => setShowSettings(true)}>
              Edit Profile
            </button>
          ) : isFriend ? (
            <button
              className="profile-action-btn friends"
              onClick={() => handleRemoveFriend(targetUserId)}
            >
              ✓ Friends
            </button>
          ) : friendRequestSent ? (
            <button className="profile-action-btn pending" disabled>
              Request Sent
            </button>
          ) : (
            <button
              className="profile-action-btn add"
              onClick={() => handleSendFriendRequest(targetUserId)}
            >
              + Add Friend
            </button>
          )}

          {/* Stats */}
          <div className="profile-stats">
            <div className="profile-stat">
              <span className="profile-stat-value">{profile.totalMessages || 0}</span>
              <span className="profile-stat-label">Messages</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-value">{profile.friendCount || 0}</span>
              <span className="profile-stat-label">Friends</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-value">{profile.hitCount || 0}</span>
              <span className="profile-stat-label">Hits</span>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="profile-main">
          {/* Tabs */}
          <div className="profile-tabs">
            <button
              className={`profile-tab ${activeTab === TABS.GREATEST_HITS ? "active" : ""}`}
              onClick={() => setActiveTab(TABS.GREATEST_HITS)}
            >
              Greatest Hits
            </button>
            <button
              className={`profile-tab ${activeTab === TABS.FRIENDS ? "active" : ""}`}
              onClick={() => setActiveTab(TABS.FRIENDS)}
            >
              Friends
              {pendingRequests.length > 0 && (
                <span className="profile-tab-badge">{pendingRequests.length}</span>
              )}
            </button>
          </div>

          {/* Tab content */}
          <div className="profile-tab-content">
            {/* GREATEST HITS TAB */}
            {activeTab === TABS.GREATEST_HITS && (
              <div className="profile-hits">
                {isOwnProfile && (
                  <button
                    className="profile-upload-btn"
                    onClick={() => setShowUploadHit(true)}
                  >
                    + Upload Greatest Hit
                  </button>
                )}

                {hitsLoading ? (
                  <div className="profile-loading-small">Loading hits...</div>
                ) : hits.length === 0 ? (
                  <div className="profile-empty">
                    <p>No greatest hits yet</p>
                    {isOwnProfile && (
                      <p className="profile-empty-sub">
                        Show off your winning bet slips!
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="profile-hits-grid">
                    {hits.map((hit) => (
                      <div key={hit.id} className="profile-hit-card">
                        <img
                          src={hit.imageUrl}
                          alt={hit.caption || "Greatest hit"}
                          className="profile-hit-image"
                        />
                        <div className="profile-hit-overlay">
                          {hit.caption && (
                            <p className="profile-hit-caption">{hit.caption}</p>
                          )}
                          <div className="profile-hit-details">
                            {hit.sport && (
                              <span className="profile-hit-tag">
                                {hit.sport.toUpperCase()}
                              </span>
                            )}
                            {hit.odds && (
                              <span className="profile-hit-tag">{hit.odds}</span>
                            )}
                            {hit.payout && (
                              <span className="profile-hit-tag payout">{hit.payout}</span>
                            )}
                          </div>
                          {isOwnProfile && (
                            <button
                              className="profile-hit-delete"
                              onClick={() => handleDeleteHit(hit.id)}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* FRIENDS TAB */}
            {activeTab === TABS.FRIENDS && (
              <div className="profile-friends">
                {isOwnProfile && (
                  <>
                    {/* Search */}
                    <div className="profile-search">
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      {searching && <span className="profile-search-spinner"></span>}
                    </div>

                    {/* Search results */}
                    {searchResults.length > 0 && (
                      <div className="profile-search-results">
                        {searchResults.map((u) => (
                          <div key={u.id} className="profile-friend-row">
                            <div
                              className={`profile-friend-avatar profile-avatar-${u.avatarColor}`}
                            >
                              {u.avatarEmoji}
                            </div>
                            <div className="profile-friend-info">
                              <span
                                className="profile-friend-name"
                                onClick={() => navigate(`/profile/${u.id}`)}
                              >
                                {u.username}
                              </span>
                              <span className="profile-friend-level">LVL {u.level}</span>
                            </div>
                            {u.requestSent ? (
                              <span className="profile-friend-status">Sent</span>
                            ) : (
                              <button
                                className="profile-friend-add-btn"
                                onClick={() => handleSendFriendRequest(u.id)}
                              >
                                Add
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pending requests */}
                    {pendingRequests.length > 0 && (
                      <div className="profile-requests">
                        <h3>Friend Requests</h3>
                        {pendingRequests.map((req) => (
                          <div key={req.id} className="profile-friend-row request">
                            <div className="profile-friend-avatar">{req.fromAvatar}</div>
                            <div className="profile-friend-info">
                              <span className="profile-friend-name">{req.fromUsername}</span>
                            </div>
                            <div className="profile-request-actions">
                              <button
                                className="profile-request-accept"
                                onClick={() => handleAcceptRequest(req.id)}
                              >
                                ✓
                              </button>
                              <button
                                className="profile-request-decline"
                                onClick={() => handleDeclineRequest(req.id)}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Friends list */}
                <div className="profile-friends-list">
                  <h3>{isOwnProfile ? "Your Friends" : `${profile.username}'s Friends`}</h3>
                  {friendsLoading ? (
                    <div className="profile-loading-small">Loading...</div>
                  ) : friends.length === 0 ? (
                    <div className="profile-empty">
                      <p>No friends yet</p>
                    </div>
                  ) : (
                    friends.map((friend) => (
                      <div key={friend.id} className="profile-friend-row">
                        <div
                          className={`profile-friend-avatar profile-avatar-${friend.avatarColor}`}
                        >
                          {friend.avatarEmoji}
                        </div>
                        <div className="profile-friend-info">
                          <span
                            className="profile-friend-name"
                            onClick={() => navigate(`/profile/${friend.id}`)}
                          >
                            {friend.username}
                          </span>
                          <span className="profile-friend-level">
                            LVL {Math.min(20, Math.floor((friend.xp || 0) / 100) + 1)}
                          </span>
                        </div>
                        {isOwnProfile && (
                          <button
                            className="profile-friend-remove"
                            onClick={() => handleRemoveFriend(friend.id)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Hit Modal */}
      {showUploadHit && (
        <div className="profile-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowUploadHit(false)}>
          <div className="profile-modal">
            <h2>Upload Greatest Hit</h2>
            <p className="profile-modal-sub">Show off your winning slip!</p>

            <div className="profile-upload-area" onClick={() => !uploadPreview && hitFileRef.current?.click()}>
              {uploadPreview ? (
                <div className="profile-upload-preview">
                  <img src={uploadPreview} alt="Preview" />
                  <button
                    className="profile-upload-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadPreview(null);
                    }}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="profile-upload-placeholder">
                  <span>📸</span>
                  <p>Click to select image</p>
                </div>
              )}
              <input
                ref={hitFileRef}
                type="file"
                accept="image/*"
                onChange={handleHitFileSelect}
                style={{ display: "none" }}
              />
            </div>

            <div className="profile-upload-form">
              <input
                type="text"
                placeholder="Caption (optional)"
                value={uploadData.caption}
                onChange={(e) => setUploadData((p) => ({ ...p, caption: e.target.value }))}
              />
              <div className="profile-upload-row">
                <select
                  value={uploadData.sport}
                  onChange={(e) => setUploadData((p) => ({ ...p, sport: e.target.value }))}
                >
                  <option value="nfl">NFL</option>
                  <option value="nba">NBA</option>
                  <option value="mlb">MLB</option>
                  <option value="nhl">NHL</option>
                  <option value="soccer">Soccer</option>
                </select>
                <input
                  type="text"
                  placeholder="Odds"
                  value={uploadData.odds}
                  onChange={(e) => setUploadData((p) => ({ ...p, odds: e.target.value }))}
                />
                <input
                  type="text"
                  placeholder="Payout"
                  value={uploadData.payout}
                  onChange={(e) => setUploadData((p) => ({ ...p, payout: e.target.value }))}
                />
              </div>
            </div>

            <div className="profile-modal-actions">
              <button className="profile-modal-btn secondary" onClick={() => setShowUploadHit(false)}>
                Cancel
              </button>
              <button
                className="profile-modal-btn primary"
                onClick={handleUploadHit}
                disabled={!uploadPreview || uploading}
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="profile-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowSettings(false)}>
          <div className="profile-modal settings-modal">
            <h2>Edit Profile</h2>

            {/* Avatar emoji picker */}
            <div className="settings-section">
              <label>Avatar Emoji</label>
              <div className="settings-emoji-grid">
                {["🔥", "😭", "😅", "🤞", "💰", "🍀", "🧱", "🤯", "😡"].map((emoji) => (
                  <button
                    key={emoji}
                    className={`settings-emoji ${settingsForm.avatarEmoji === emoji ? "active" : ""}`}
                    onClick={() => setSettingsForm((p) => ({ ...p, avatarEmoji: emoji }))}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Avatar color picker */}
            <div className="settings-section">
              <label>Avatar Color</label>
              <div className="settings-color-grid">
                {["green", "blue", "orange", "red", "purple"].map((color) => (
                  <button
                    key={color}
                    className={`settings-color profile-avatar-${color} ${settingsForm.avatarColor === color ? "active" : ""}`}
                    onClick={() => setSettingsForm((p) => ({ ...p, avatarColor: color }))}
                  />
                ))}
              </div>
            </div>

            {/* Bio */}
            <div className="settings-section">
              <label>Bio</label>
              <textarea
                value={settingsForm.bio}
                onChange={(e) => setSettingsForm((p) => ({ ...p, bio: e.target.value }))}
                placeholder="Tell us about yourself..."
                maxLength={200}
              />
              <span className="settings-char-count">{settingsForm.bio?.length || 0}/200</span>
            </div>

            {/* Favorite market */}
            <div className="settings-section">
              <label>Favorite Market</label>
              <select
                value={settingsForm.favoriteMarket}
                onChange={(e) => setSettingsForm((p) => ({ ...p, favoriteMarket: e.target.value }))}
              >
                <option value="NFL">NFL</option>
                <option value="NBA">NBA</option>
                <option value="MLB">MLB</option>
                <option value="NHL">NHL</option>
                <option value="Soccer">Soccer</option>
              </select>
            </div>

            {/* Privacy */}
            <div className="settings-section">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={settingsForm.publicProfile}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, publicProfile: e.target.checked }))}
                />
                <span className="settings-toggle-slider"></span>
                <span>Public Profile</span>
              </label>
            </div>

            <div className="profile-modal-actions">
              <button className="profile-modal-btn secondary" onClick={() => setShowSettings(false)}>
                Cancel
              </button>
              <button
                className="profile-modal-btn primary"
                onClick={handleSaveSettings}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;
