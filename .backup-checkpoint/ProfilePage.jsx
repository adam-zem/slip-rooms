// src/pages/ProfilePage.jsx - Clean Minimal Profile
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useAuth } from "../contexts/AuthContext";
import { getProfile, updateProfile, createProfileIfMissing } from "../services/profileService";
import { getFriends, sendFriendRequest, removeFriend, checkFriendship, getPendingRequests, acceptFriendRequest, declineFriendRequest } from "../services/friendsService";
import { getGreatestHits, addGreatestHit, deleteGreatestHit, fileToBase64 } from "../services/greatestHitsService";
import { deleteUserAccount } from "../services/accountService";
import "./ProfilePage.css";

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
  const { user, userProfile, authReady, isAdmin } = useAuth();

  const isOwnProfile = !paramUserId || paramUserId === user?.uid;
  const targetUserId = paramUserId || user?.uid;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [isFriend, setIsFriend] = useState(false);
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [hits, setHits] = useState([]);
  const [hitsLoading, setHitsLoading] = useState(false);

  // Friend requests (only for own profile)
  const [friendRequests, setFriendRequests] = useState([]);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedHit, setSelectedHit] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Editing
  const [editingBio, setEditingBio] = useState(false);
  const [bioValue, setBioValue] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);

  // Upload form
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadData, setUploadData] = useState({ caption: "", sport: "nfl", odds: "", payout: "" });
  const [uploading, setUploading] = useState(false);

  const profilePicRef = useRef(null);
  const hitFileRef = useRef(null);

  // Load profile
  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        let data = await getProfile(targetUserId);
        if (!data && isOwnProfile && user) {
          data = await createProfileIfMissing(user.uid, {
            username: userProfile?.username || user.displayName || user.email?.split("@")[0] || "User",
            email: user.email || "",
          });
        }
        if (data) {
          setProfile(data);
          setBioValue(data.bio || "");
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        setLoading(false);
      }
    }
    if (targetUserId) loadProfile();
    else setLoading(false);
  }, [targetUserId, user?.uid, isOwnProfile, user, userProfile]);

  // Check friendship
  useEffect(() => {
    async function check() {
      if (!isOwnProfile && user?.uid && targetUserId) {
        const result = await checkFriendship(user.uid, targetUserId);
        setIsFriend(result);
      }
    }
    check();
  }, [isOwnProfile, user?.uid, targetUserId]);

  // Load friends
  useEffect(() => {
    async function load() {
      if (!targetUserId) return;
      try {
        const list = await getFriends(targetUserId);
        setFriends(list);
      } catch (err) {
        console.error("Error loading friends:", err);
      }
    }
    load();
  }, [targetUserId]);

  // Load friend requests (only for own profile)
  useEffect(() => {
    async function loadRequests() {
      if (!isOwnProfile || !user?.uid) return;
      try {
        const requests = await getPendingRequests(user.uid);
        setFriendRequests(requests);
      } catch (err) {
        console.error("Error loading friend requests:", err);
      }
    }
    loadRequests();
  }, [isOwnProfile, user?.uid]);

  // Load hits
  useEffect(() => {
    async function load() {
      if (!targetUserId || !profile) return;
      if (!isOwnProfile && !profile.publicProfile && !isFriend) return;
      setHitsLoading(true);
      try {
        const list = await getGreatestHits(targetUserId);
        setHits(list);
      } catch (err) {
        console.error("Error loading hits:", err);
      } finally {
        setHitsLoading(false);
      }
    }
    if (profile) load();
  }, [targetUserId, profile, isOwnProfile, isFriend]);

  // Profile picture upload
  const handlePicUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    if (!file.type.startsWith("image/")) return alert("Please select an image");
    if (file.size > 5 * 1024 * 1024) return alert("Max 5MB");

    setUploadingPic(true);
    try {
      const storageRef = ref(storage, `profilePics/${user.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateProfile(user.uid, { profilePicture: url });
      setProfile((p) => ({ ...p, profilePicture: url }));
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed");
    } finally {
      setUploadingPic(false);
    }
  };

  // Bio save
  const handleSaveBio = async () => {
    if (!user?.uid) return;
    setSavingBio(true);
    try {
      await updateProfile(user.uid, { bio: bioValue });
      setProfile((p) => ({ ...p, bio: bioValue }));
      setEditingBio(false);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSavingBio(false);
    }
  };

  // Privacy toggle
  const togglePrivacy = async () => {
    if (!user?.uid || !isOwnProfile) return;
    const newVal = !profile.publicProfile;
    try {
      await updateProfile(user.uid, { publicProfile: newVal });
      setProfile((p) => ({ ...p, publicProfile: newVal }));
    } catch (err) {
      console.error("Privacy toggle error:", err);
    }
  };

  // Friend actions
  const handleAddFriend = async () => {
    try {
      await sendFriendRequest(user.uid, targetUserId);
      setFriendRequestSent(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRemoveFriend = async () => {
    if (!confirm("Remove friend?")) return;
    try {
      await removeFriend(user.uid, targetUserId);
      setIsFriend(false);
    } catch (err) {
      console.error("Remove error:", err);
    }
  };

  // Accept friend request
  const handleAcceptRequest = async (requestId) => {
    try {
      await acceptFriendRequest(requestId);
      // Remove from local state
      setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
      // Refresh friends list
      const updatedFriends = await getFriends(user.uid);
      setFriends(updatedFriends);
    } catch (err) {
      console.error("Accept request error:", err);
      alert("Failed to accept request");
    }
  };

  // Decline friend request
  const handleDeclineRequest = async (requestId) => {
    try {
      await declineFriendRequest(requestId);
      // Remove from local state
      setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      console.error("Decline request error:", err);
      alert("Failed to decline request");
    }
  };

  // Hit upload
  const handleHitFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return alert("Please select an image");
    if (file.size > 5 * 1024 * 1024) return alert("Max 5MB");
    try {
      const base64 = await fileToBase64(file);
      setUploadPreview(base64);
    } catch (err) {
      console.error("File read error:", err);
    }
  };

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
      const list = await getGreatestHits(targetUserId);
      setHits(list);
      setShowUpload(false);
      setUploadPreview(null);
      setUploadData({ caption: "", sport: "nfl", odds: "", payout: "" });
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteHit = async (id) => {
    if (!confirm("Delete this hit?")) return;
    try {
      await deleteGreatestHit(id, user.uid);
      setHits((h) => h.filter((x) => x.id !== id));
      setSelectedHit(null);
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  // Delete account handler
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE" && deleteConfirmText !== profile?.username) {
      return;
    }

    setIsDeleting(true);
    try {
      await deleteUserAccount(user.uid);
      // User will be signed out automatically after auth deletion
      navigate("/");
    } catch (err) {
      console.error("Delete account error:", err);
      if (err.code === "auth/requires-recent-login") {
        alert("For security reasons, please log out and log back in before deleting your account.");
      } else {
        alert("Failed to delete account. Please try again.");
      }
      setIsDeleting(false);
    }
  };

  const isPrivate = !isOwnProfile && profile && !profile.publicProfile && !isFriend;

  // Loading states
  if (!authReady || loading) {
    return (
      <div className="profile-page">
        <div className="profile-center">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile-page">
        <div className="profile-center">
          <p>Please log in to view profiles</p>
          <button className="btn" onClick={() => navigate("/")}>Go to Login</button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-page">
        <div className="profile-center">
          <p>Profile not found</p>
          <button className="btn" onClick={() => navigate("/")}>Back to Rooms</button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* Settings Gear */}
      {isOwnProfile && (
        <button className="settings-gear" onClick={() => setShowSettings(true)}>⚙️</button>
      )}

      {/* Back Button */}
      <button className="back-btn" onClick={() => navigate("/")}>← Back</button>

      {/* Main Content */}
      <div className="profile-content">
        {/* Profile Picture */}
        <div
          className={`avatar ${isOwnProfile ? "editable" : ""}`}
          onClick={() => isOwnProfile && profilePicRef.current?.click()}
        >
          {uploadingPic ? (
            <div className="spinner-small" />
          ) : profile.profilePicture ? (
            <img src={profile.profilePicture} alt={profile.username} />
          ) : (
            <span className="avatar-emoji">{profile.avatarEmoji || "🔥"}</span>
          )}
          {isOwnProfile && <div className="avatar-hover">📷</div>}
          <input
            ref={profilePicRef}
            type="file"
            accept="image/*"
            onChange={handlePicUpload}
            hidden
          />
        </div>

        {/* Username */}
        <h1 className="username">{profile.username}</h1>

        {/* Level Badge */}
        <div className="level-badge">
          LVL {profile.level} {getLevelEmoji(profile.level)} {profile.title}
        </div>

        {/* XP Bar */}
        <div className="xp-bar">
          <div className="xp-fill" style={{ width: `${profile.progress || 0}%` }} />
        </div>

        {/* Bio */}
        {!isPrivate && (
          <div className="bio-section">
            {editingBio ? (
              <div className="bio-edit">
                <textarea
                  value={bioValue}
                  onChange={(e) => setBioValue(e.target.value)}
                  placeholder="Write something about yourself..."
                  maxLength={200}
                />
                <div className="bio-actions">
                  <span className="char-count">{bioValue.length}/200</span>
                  <button className="btn-small" onClick={() => { setEditingBio(false); setBioValue(profile.bio || ""); }}>Cancel</button>
                  <button className="btn-small primary" onClick={handleSaveBio} disabled={savingBio}>
                    {savingBio ? "..." : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="bio-text">
                {profile.bio || (isOwnProfile ? "No bio yet" : "No bio")}
                {isOwnProfile && (
                  <button className="edit-icon" onClick={() => setEditingBio(true)}>✏️</button>
                )}
              </p>
            )}
          </div>
        )}

        {/* Privacy Badge */}
        {isOwnProfile ? (
          <button className="privacy-btn" onClick={togglePrivacy}>
            {profile.publicProfile ? "🌐 Public" : "🔒 Private"}
          </button>
        ) : (
          <span className={`privacy-badge ${profile.publicProfile ? "public" : "private"}`}>
            {profile.publicProfile ? "🌐 Public" : "🔒 Private"}
          </span>
        )}

        {/* Friends Button */}
        {!isPrivate && (
          <button className="friends-btn" onClick={() => setShowFriends(true)}>
            {friends.length} Friends
            {isOwnProfile && friendRequests.length > 0 && (
              <span className="request-badge">{friendRequests.length} pending</span>
            )}
          </button>
        )}

        {/* Friend Requests Section (only on own profile, only if has requests) */}
        {isOwnProfile && friendRequests.length > 0 && (
          <div className="friend-requests-section">
            <h3 className="requests-title">Friend Requests</h3>
            <div className="requests-list">
              {friendRequests.map((req) => (
                <div key={req.id} className="request-card">
                  <div className="request-user" onClick={() => navigate(`/profile/${req.from}`)}>
                    {req.fromProfilePic ? (
                      <img src={req.fromProfilePic} alt={req.fromUsername} className="request-pic" />
                    ) : (
                      <span className="request-emoji">{req.fromAvatar}</span>
                    )}
                    <div className="request-info">
                      <span className="request-name">{req.fromUsername}</span>
                      <span className="request-level">LVL {req.fromLevel} • {req.fromTitle}</span>
                    </div>
                  </div>
                  <div className="request-actions">
                    <button
                      className="request-btn accept"
                      onClick={() => handleAcceptRequest(req.id)}
                    >
                      Accept
                    </button>
                    <button
                      className="request-btn decline"
                      onClick={() => handleDeclineRequest(req.id)}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friend Action (viewing other profiles) */}
        {!isOwnProfile && (
          <div className="friend-action">
            {isFriend ? (
              <button className="btn friend-active" onClick={handleRemoveFriend}>✓ Friends</button>
            ) : friendRequestSent ? (
              <button className="btn" disabled>Request Sent</button>
            ) : (
              <button className="btn primary" onClick={handleAddFriend}>+ Add Friend</button>
            )}
          </div>
        )}

        {/* Greatest Hits */}
        <div className="hits-section">
          <h2 className="hits-title">Greatest Hits</h2>

          {isPrivate ? (
            <div className="private-message">
              <span className="lock-icon">🔒</span>
              <p>This profile is private</p>
              <p className="sub">Add {profile.username} as a friend to see their hits</p>
            </div>
          ) : hitsLoading ? (
            <div className="hits-loading"><div className="spinner-small" /></div>
          ) : hits.length === 0 ? (
            <div className="hits-empty">
              <span>🏆</span>
              <p>No hits yet</p>
              {isOwnProfile && (
                <button className="btn primary" onClick={() => setShowUpload(true)}>+ Upload Hit</button>
              )}
            </div>
          ) : (
            <>
              <div className="hits-grid">
                {hits.map((hit) => (
                  <div key={hit.id} className="hit-card" onClick={() => setSelectedHit(hit)}>
                    <img src={hit.imageUrl} alt={hit.caption || "Hit"} />
                    {hit.payout && <span className="hit-payout">{hit.payout}</span>}
                  </div>
                ))}
              </div>
              {isOwnProfile && (
                <button className="btn upload-btn" onClick={() => setShowUpload(true)}>+ Upload Hit</button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Settings</h2>
            <div className="settings-list">
              <label className="setting-row">
                <span>🔔 Notifications</span>
                <input type="checkbox" defaultChecked />
              </label>
              <label className="setting-row">
                <span>🔊 Sound Effects</span>
                <input type="checkbox" defaultChecked />
              </label>
            </div>
            {isAdmin && (
              <button className="btn admin-link" onClick={() => { setShowSettings(false); navigate("/admin"); }}>
                🛡️ Admin Dashboard
              </button>
            )}
            <button className="btn logout-btn" onClick={handleLogout}>🚪 Log Out</button>
            <div className="settings-divider" />
            <button
              className="btn delete-account-btn"
              onClick={() => { setShowSettings(false); setShowDeleteConfirm(true); }}
            >
              Delete Account
            </button>
            <button className="btn modal-close" onClick={() => setShowSettings(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Friends Modal */}
      {showFriends && (
        <div className="modal-overlay" onClick={() => setShowFriends(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Friends ({friends.length})</h2>
            {friends.length === 0 ? (
              <p className="empty-text">No friends yet</p>
            ) : (
              <div className="friends-list">
                {friends.map((f) => (
                  <div key={f.id} className="friend-row" onClick={() => { setShowFriends(false); navigate(`/profile/${f.id}`); }}>
                    <span className="friend-emoji">{f.avatarEmoji || "🔥"}</span>
                    <span className="friend-name">{f.username}</span>
                  </div>
                ))}
              </div>
            )}
            <button className="btn modal-close" onClick={() => setShowFriends(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Upload Hit</h2>
            <div className="upload-area" onClick={() => !uploadPreview && hitFileRef.current?.click()}>
              {uploadPreview ? (
                <div className="upload-preview">
                  <img src={uploadPreview} alt="Preview" />
                  <button className="remove-preview" onClick={(e) => { e.stopPropagation(); setUploadPreview(null); }}>×</button>
                </div>
              ) : (
                <div className="upload-placeholder">
                  <span>📸</span>
                  <p>Click to select</p>
                </div>
              )}
              <input ref={hitFileRef} type="file" accept="image/*" onChange={handleHitFile} hidden />
            </div>
            <input
              type="text"
              className="input"
              placeholder="Caption (optional)"
              value={uploadData.caption}
              onChange={(e) => setUploadData((d) => ({ ...d, caption: e.target.value }))}
            />
            <div className="upload-row">
              <select
                className="input"
                value={uploadData.sport}
                onChange={(e) => setUploadData((d) => ({ ...d, sport: e.target.value }))}
              >
                <option value="nfl">NFL</option>
                <option value="nba">NBA</option>
                <option value="mlb">MLB</option>
                <option value="nhl">NHL</option>
                <option value="soccer">Soccer</option>
              </select>
              <input
                type="text"
                className="input"
                placeholder="Odds"
                value={uploadData.odds}
                onChange={(e) => setUploadData((d) => ({ ...d, odds: e.target.value }))}
              />
              <input
                type="text"
                className="input"
                placeholder="Payout"
                value={uploadData.payout}
                onChange={(e) => setUploadData((d) => ({ ...d, payout: e.target.value }))}
              />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowUpload(false)}>Cancel</button>
              <button className="btn primary" onClick={handleUploadHit} disabled={!uploadPreview || uploading}>
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hit Viewer Modal */}
      {selectedHit && (
        <div className="modal-overlay" onClick={() => setSelectedHit(null)}>
          <div className="modal hit-viewer" onClick={(e) => e.stopPropagation()}>
            <img src={selectedHit.imageUrl} alt={selectedHit.caption || "Hit"} />
            <div className="hit-info">
              {selectedHit.caption && <p>{selectedHit.caption}</p>}
              <div className="hit-tags">
                {selectedHit.sport && <span className="tag">{selectedHit.sport.toUpperCase()}</span>}
                {selectedHit.odds && <span className="tag">{selectedHit.odds}</span>}
                {selectedHit.payout && <span className="tag green">{selectedHit.payout}</span>}
              </div>
              {isOwnProfile && (
                <button className="btn delete-btn" onClick={() => handleDeleteHit(selectedHit.id)}>Delete</button>
              )}
            </div>
            <button className="close-x" onClick={() => setSelectedHit(null)}>×</button>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => !isDeleting && setShowDeleteConfirm(false)}>
          <div className="modal delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-warning-icon">⚠️</div>
            <h2 className="delete-title">Delete Account</h2>
            <p className="delete-warning">
              Are you sure you want to delete your account? This action cannot be undone.
              All your data, messages, friends, and greatest hits will be permanently deleted.
            </p>
            <p className="delete-instruction">
              Type <strong>DELETE</strong> or your username <strong>{profile?.username}</strong> to confirm:
            </p>
            <input
              type="text"
              className="input delete-confirm-input"
              placeholder="Type DELETE or your username"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              disabled={isDeleting}
              autoComplete="off"
            />
            <div className="modal-actions">
              <button
                className="btn"
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="btn delete-confirm-btn"
                onClick={handleDeleteAccount}
                disabled={isDeleting || (deleteConfirmText !== "DELETE" && deleteConfirmText !== profile?.username)}
              >
                {isDeleting ? "Deleting..." : "Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfilePage;
