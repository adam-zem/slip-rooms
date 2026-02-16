// src/pages/ProfilePage.jsx - Profile with Social Wall
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
import {
  createPost,
  subscribeToUserPosts,
  getUserOriginalPosts,
  getUserPostsWithReposts,
  getUserReplies,
  getUserMediaPosts,
  getUserLikedPosts,
  thumbsUpPost,
  removeThumbsUp,
  thumbsDownPost,
  removeThumbsDown,
  repost,
  unrepost,
  deletePost,
  subscribeToComments,
  addComment,
} from "../services/postsService";
import ShareModal from "../components/ShareModal";
import "./ProfilePage.css";

// Avatar colors
const COLOR_MAP = {
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a855f7",
  orange: "#f97316",
  red: "#ef4444",
  pink: "#ec4899",
};

function getLevelEmoji(level) {
  if (level >= 20) return "👑";
  if (level >= 15) return "🔥";
  if (level >= 10) return "⭐";
  if (level >= 5) return "💪";
  return "🐣";
}

function formatTimeAgo(date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

// Post Card Component
function PostCard({
  post,
  currentUserId,
  onThumbsUp,
  onThumbsDown,
  onComment,
  onDelete,
  onShare,
  onUserClick,
}) {
  const hasThumbsUp = (post.thumbsUp || []).includes(currentUserId);
  const hasThumbsDown = (post.thumbsDown || []).includes(currentUserId);
  const isOwner = post.userId === currentUserId;
  const avatarColor = COLOR_MAP[post.userAvatarColor || "green"] || COLOR_MAP.green;

  return (
    <div className="profile-post-card">
      <div className="profile-post-header">
        <button className="profile-post-user-info" onClick={() => onUserClick(post.userId)}>
          {post.userProfilePicture ? (
            <img src={post.userProfilePicture} alt="" className="profile-post-avatar" />
          ) : (
            <div className="profile-post-avatar-placeholder" style={{ backgroundColor: avatarColor + "30", borderColor: avatarColor }}>
              <span>{post.userAvatar}</span>
            </div>
          )}
          <div className="profile-post-user-text">
            <span className="profile-post-display-name">{post.displayName || post.username}</span>
            <span className="profile-post-handle">@{post.username?.toLowerCase()}</span>
            <span className="profile-post-dot">·</span>
            <span className="profile-post-time">{formatTimeAgo(post.createdAt)}</span>
          </div>
        </button>
        {isOwner && (
          <button className="profile-post-menu" onClick={onDelete}>...</button>
        )}
      </div>

      {post.text && <p className="profile-post-text">{post.text}</p>}

      {post.images.length > 0 && (
        <div className={`profile-post-images ${post.images.length === 1 ? "single" : "double"}`}>
          {post.images.map((img, idx) => (
            <img key={idx} src={img} alt="" className="profile-post-image" />
          ))}
        </div>
      )}

      <div className="profile-post-actions">
        <button className={`profile-post-action ${hasThumbsUp ? "active-up" : ""}`} onClick={onThumbsUp}>
          <span className="action-icon">{hasThumbsUp ? "👍" : "👍"}</span>
          {post.thumbsUpCount > 0 && <span className="action-count">{post.thumbsUpCount}</span>}
        </button>
        <button className={`profile-post-action ${hasThumbsDown ? "active-down" : ""}`} onClick={onThumbsDown}>
          <span className="action-icon">{hasThumbsDown ? "👎" : "👎"}</span>
          {post.thumbsDownCount > 0 && <span className="action-count">{post.thumbsDownCount}</span>}
        </button>
        <button className="profile-post-action" onClick={onComment}>
          <span className="action-icon">💬</span>
          {post.commentsCount > 0 && <span className="action-count">{post.commentsCount}</span>}
        </button>
        <button className="profile-post-action" onClick={onShare}>
          <span className="action-icon">↗️</span>
        </button>
      </div>
    </div>
  );
}

// Comments Modal
function CommentsModal({ post, currentUser, userProfile, onClose }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const commentsEndRef = useRef(null);

  useEffect(() => {
    if (!post) return;
    const unsubscribe = subscribeToComments(post.id, setComments);
    return () => unsubscribe();
  }, [post?.id]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const handleSend = async () => {
    if (!newComment.trim() || !post || sending) return;
    setSending(true);
    try {
      await addComment(post.id, currentUser.uid, {
        username: userProfile?.username || "User",
        avatarEmoji: userProfile?.avatarEmoji || "🔥",
        avatarColor: userProfile?.avatarColor || "green",
        profilePicture: userProfile?.profilePicture || null,
      }, newComment);
      setNewComment("");
    } catch (error) {
      console.error("Error posting comment:", error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="profile-comments-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-comments-header">
          <h3>Comments</h3>
          <button className="close-x" onClick={onClose}>&times;</button>
        </div>
        <div className="profile-comments-list">
          {comments.length === 0 ? (
            <div className="profile-comments-empty">
              <p>No comments yet</p>
              <p className="sub">Be the first to comment!</p>
            </div>
          ) : (
            comments.map((comment) => {
              const color = COLOR_MAP[comment.userAvatarColor || "green"] || COLOR_MAP.green;
              return (
                <div key={comment.id} className="profile-comment-item">
                  {comment.userProfilePicture ? (
                    <img src={comment.userProfilePicture} alt="" className="profile-comment-avatar" />
                  ) : (
                    <div className="profile-comment-avatar-placeholder" style={{ backgroundColor: color + "30" }}>
                      <span>{comment.userAvatar}</span>
                    </div>
                  )}
                  <div className="profile-comment-content">
                    <div className="profile-comment-bubble">
                      <span className="profile-comment-username">{comment.username}</span>
                      <p className="profile-comment-text">{comment.text}</p>
                    </div>
                    <span className="profile-comment-time">{formatTimeAgo(comment.createdAt)}</span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={commentsEndRef} />
        </div>
        <div className="profile-comment-input-container">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a comment..."
            maxLength={500}
          />
          <button className="profile-comment-send-btn" onClick={handleSend} disabled={!newComment.trim() || sending}>
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
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

  // Posts state
  const [posts, setPosts] = useState([]);
  const [newPostText, setNewPostText] = useState("");
  const [newPostImages, setNewPostImages] = useState([]);
  const [isPosting, setIsPosting] = useState(false);
  const [commentsPost, setCommentsPost] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharePost, setSharePost] = useState(null);
  const postImageRef = useRef(null);

  // Profile tabs
  const [activeTab, setActiveTab] = useState('posts');
  const [tabLoading, setTabLoading] = useState(false);

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

  // Load posts based on active tab
  useEffect(() => {
    if (!targetUserId) return;

    const loadTabData = async () => {
      setTabLoading(true);
      try {
        let data = [];
        switch (activeTab) {
          case 'posts':
            // Include reposts in the posts tab
            data = await getUserPostsWithReposts(targetUserId);
            break;
          case 'replies':
            data = await getUserReplies(targetUserId);
            break;
          case 'media':
            data = await getUserMediaPosts(targetUserId);
            break;
          case 'likes':
            data = await getUserLikedPosts(targetUserId);
            break;
          default:
            data = await getUserPostsWithReposts(targetUserId);
        }
        setPosts(data);
      } catch (error) {
        console.error('Error loading tab data:', error);
      } finally {
        setTabLoading(false);
      }
    };

    loadTabData();
  }, [targetUserId, activeTab]);

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

  const handleAcceptRequest = async (requestId) => {
    try {
      await acceptFriendRequest(requestId);
      setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
      const updatedFriends = await getFriends(user.uid);
      setFriends(updatedFriends);
    } catch (err) {
      console.error("Accept request error:", err);
      alert("Failed to accept request");
    }
  };

  const handleDeclineRequest = async (requestId) => {
    try {
      await declineFriendRequest(requestId);
      setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      console.error("Decline request error:", err);
      alert("Failed to decline request");
    }
  };

  // Post handlers
  const handlePickPostImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return alert("Please select an image");
    if (file.size > 5 * 1024 * 1024) return alert("Max 5MB");
    if (newPostImages.length >= 2) return alert("Max 2 images per post");
    setNewPostImages([...newPostImages, file]);
  };

  const handleRemovePostImage = (index) => {
    setNewPostImages(newPostImages.filter((_, i) => i !== index));
  };

  const handleCreatePost = async () => {
    if (!newPostText.trim() && newPostImages.length === 0) {
      alert("Please write something or add an image");
      return;
    }
    setIsPosting(true);
    try {
      await createPost(
        user.uid,
        {
          username: userProfile?.username || "User",
          avatarEmoji: userProfile?.avatarEmoji || "🔥",
          avatarColor: userProfile?.avatarColor || "green",
          profilePicture: userProfile?.profilePicture || null,
        },
        newPostText,
        newPostImages
      );
      setNewPostText("");
      setNewPostImages([]);
    } catch (err) {
      console.error("Error creating post:", err);
      alert("Failed to create post");
    } finally {
      setIsPosting(false);
    }
  };

  const handleThumbsUp = async (post) => {
    if (!user?.uid) return;
    const hasThumbsUp = (post.thumbsUp || []).includes(user.uid);
    const hasThumbsDown = (post.thumbsDown || []).includes(user.uid);

    // Optimistic update
    setPosts((prev) => prev.map((p) => {
      if (p.id !== post.id) return p;
      if (hasThumbsUp) {
        return { ...p, thumbsUp: p.thumbsUp.filter((id) => id !== user.uid), thumbsUpCount: p.thumbsUpCount - 1 };
      } else {
        return {
          ...p,
          thumbsUp: [...p.thumbsUp, user.uid],
          thumbsUpCount: p.thumbsUpCount + 1,
          thumbsDown: hasThumbsDown ? p.thumbsDown.filter((id) => id !== user.uid) : p.thumbsDown,
          thumbsDownCount: hasThumbsDown ? p.thumbsDownCount - 1 : p.thumbsDownCount,
        };
      }
    }));

    try {
      if (hasThumbsUp) {
        await removeThumbsUp(post.id, user.uid);
      } else {
        await thumbsUpPost(post.id, user.uid, hasThumbsDown);
      }
    } catch (err) {
      console.error("Error toggling thumbs up:", err);
    }
  };

  const handleThumbsDown = async (post) => {
    if (!user?.uid) return;
    const hasThumbsUp = (post.thumbsUp || []).includes(user.uid);
    const hasThumbsDown = (post.thumbsDown || []).includes(user.uid);

    // Optimistic update
    setPosts((prev) => prev.map((p) => {
      if (p.id !== post.id) return p;
      if (hasThumbsDown) {
        return { ...p, thumbsDown: p.thumbsDown.filter((id) => id !== user.uid), thumbsDownCount: p.thumbsDownCount - 1 };
      } else {
        return {
          ...p,
          thumbsDown: [...p.thumbsDown, user.uid],
          thumbsDownCount: p.thumbsDownCount + 1,
          thumbsUp: hasThumbsUp ? p.thumbsUp.filter((id) => id !== user.uid) : p.thumbsUp,
          thumbsUpCount: hasThumbsUp ? p.thumbsUpCount - 1 : p.thumbsUpCount,
        };
      }
    }));

    try {
      if (hasThumbsDown) {
        await removeThumbsDown(post.id, user.uid);
      } else {
        await thumbsDownPost(post.id, user.uid, hasThumbsUp);
      }
    } catch (err) {
      console.error("Error toggling thumbs down:", err);
    }
  };

  const handleDeletePost = async (post) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await deletePost(post.id);
    } catch (err) {
      console.error("Error deleting post:", err);
    }
  };

  const handleSharePost = (post) => {
    setSharePost(post);
    setShareModalOpen(true);
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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE" && deleteConfirmText !== profile?.username) return;
    setIsDeleting(true);
    try {
      await deleteUserAccount(user.uid);
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
  const avatarColor = COLOR_MAP[profile?.avatarColor || "green"] || COLOR_MAP.green;

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
          <input ref={profilePicRef} type="file" accept="image/*" onChange={handlePicUpload} hidden />
        </div>

        {/* Display Name + Handle */}
        <h1 className="display-name">{profile.displayName || profile.username}</h1>
        <span className="profile-handle">@{profile.username?.toLowerCase()}</span>
        {isOwnProfile && (
          <button
            className="edit-display-name-btn"
            onClick={() => {
              const newName = prompt("Edit Display Name\n\nYour display name can include emojis, spaces, and special characters. Your @handle cannot be changed.", profile.displayName || profile.username || "");
              if (newName && newName.trim()) {
                const trimmed = newName.trim().slice(0, 30);
                updateProfile(user.uid, { displayName: trimmed }).then(() => {
                  setProfile(prev => ({ ...prev, displayName: trimmed }));
                }).catch(() => alert("Failed to update display name"));
              }
            }}
          >
            ✏️ Edit Display Name
          </button>
        )}

        {/* Level Badge */}
        <div className="level-badge">
          LVL {profile.level} {getLevelEmoji(profile.level)} {profile.title}
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

        {/* Friend Requests Section */}
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
                    <button className="request-btn accept" onClick={() => handleAcceptRequest(req.id)}>Accept</button>
                    <button className="request-btn decline" onClick={() => handleDeclineRequest(req.id)}>Decline</button>
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

        {/* Create Post Section (only on own profile) */}
        {isOwnProfile && (
          <div className="create-post-section">
            <div className="create-post-header">
              {userProfile?.profilePicture ? (
                <img src={userProfile.profilePicture} alt="" className="create-post-avatar" />
              ) : (
                <div className="create-post-avatar-placeholder" style={{ backgroundColor: avatarColor + "30" }}>
                  <span>{userProfile?.avatarEmoji || "🔥"}</span>
                </div>
              )}
              <textarea
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                placeholder="What's on your mind?"
                maxLength={500}
                className="create-post-input"
              />
            </div>

            {newPostImages.length > 0 && (
              <div className="create-post-previews">
                {newPostImages.map((file, idx) => (
                  <div key={idx} className="create-post-preview">
                    <img src={URL.createObjectURL(file)} alt="" />
                    <button className="remove-preview" onClick={() => handleRemovePostImage(idx)}>&times;</button>
                  </div>
                ))}
              </div>
            )}

            <div className="create-post-actions">
              <button
                className="add-image-btn"
                onClick={() => postImageRef.current?.click()}
                disabled={newPostImages.length >= 2}
              >
                📷 Photo ({newPostImages.length}/2)
              </button>
              <button
                className="post-btn"
                onClick={handleCreatePost}
                disabled={(!newPostText.trim() && newPostImages.length === 0) || isPosting}
              >
                {isPosting ? "Posting..." : "Post"}
              </button>
              <input ref={postImageRef} type="file" accept="image/*" onChange={handlePickPostImage} hidden />
            </div>
          </div>
        )}

        {/* Profile Tabs */}
        {!isPrivate && (
          <div className="profile-tabs">
            <button
              className={`profile-tab ${activeTab === 'posts' ? 'active' : ''}`}
              onClick={() => setActiveTab('posts')}
            >
              POSTS
            </button>
            <button
              className={`profile-tab ${activeTab === 'replies' ? 'active' : ''}`}
              onClick={() => setActiveTab('replies')}
            >
              REPLIES
            </button>
            <button
              className={`profile-tab ${activeTab === 'media' ? 'active' : ''}`}
              onClick={() => setActiveTab('media')}
            >
              MEDIA
            </button>
            <button
              className={`profile-tab ${activeTab === 'likes' ? 'active' : ''}`}
              onClick={() => setActiveTab('likes')}
            >
              LIKES
            </button>
          </div>
        )}

        {/* Wall / Posts Section */}
        {!isPrivate && (
          <div className="wall-section">
            {tabLoading ? (
              <div className="tab-loading">
                <div className="spinner" />
              </div>
            ) : posts.length === 0 ? (
              <div className="wall-empty">
                <span>📝</span>
                <p>
                  {activeTab === 'posts' && "No posts yet"}
                  {activeTab === 'replies' && "No replies yet"}
                  {activeTab === 'media' && "No media posts yet"}
                  {activeTab === 'likes' && "No liked posts yet"}
                </p>
                <p className="sub">
                  {activeTab === 'posts' && isOwnProfile && "Share what's on your mind!"}
                  {activeTab === 'replies' && "Reply to posts to see them here"}
                  {activeTab === 'media' && "Posts with images will appear here"}
                  {activeTab === 'likes' && "Like posts to see them here"}
                </p>
              </div>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={user?.uid || ""}
                  onThumbsUp={() => handleThumbsUp(post)}
                  onThumbsDown={() => handleThumbsDown(post)}
                  onComment={() => setCommentsPost(post)}
                  onDelete={() => handleDeletePost(post)}
                  onShare={() => handleSharePost(post)}
                  onUserClick={(userId) => navigate(`/profile/${userId}`)}
                />
              ))
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

      {/* Comments Modal */}
      {commentsPost && (
        <CommentsModal
          post={commentsPost}
          currentUser={user}
          userProfile={userProfile}
          onClose={() => setCommentsPost(null)}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => { setShareModalOpen(false); setSharePost(null); }}
        type="post"
        post={sharePost}
        currentUser={user}
        userProfile={userProfile}
      />

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
                    {f.profilePicture ? (
                      <img src={f.profilePicture} alt={f.username} className="friend-avatar-img" />
                    ) : (
                      <span className="friend-emoji">{f.avatarEmoji || "🔥"}</span>
                    )}
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
