// src/components/TheFloor.jsx
// The Floor - Social feed with Friends and Discover tabs

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getFriends } from "../services/friendsService";
import {
  getFriendsFeedPosts,
  getDiscoverPosts,
  thumbsUpPost,
  removeThumbsUp,
  thumbsDownPost,
  removeThumbsDown,
  deletePost,
  subscribeToComments,
  addComment,
} from "../services/postsService";
import ShareModal from "./ShareModal";
import "./TheFloor.css";

// Avatar colors
const COLOR_MAP = {
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a855f7",
  orange: "#f97316",
  red: "#ef4444",
  pink: "#ec4899",
};

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
  const hasThumbsUp = post.thumbsUp.includes(currentUserId);
  const hasThumbsDown = post.thumbsDown.includes(currentUserId);
  const isOwner = post.userId === currentUserId;
  const avatarColor = COLOR_MAP[post.userAvatarColor || "green"] || COLOR_MAP.green;

  return (
    <div className="floor-post-card">
      <div className="floor-post-header">
        <button
          className="floor-post-user-info"
          onClick={() => onUserClick(post.userId)}
        >
          {post.userProfilePicture ? (
            <img src={post.userProfilePicture} alt="" className="floor-post-avatar" />
          ) : (
            <div
              className="floor-post-avatar-placeholder"
              style={{ backgroundColor: avatarColor + "30", borderColor: avatarColor }}
            >
              <span className="floor-post-avatar-emoji">{post.userAvatar}</span>
            </div>
          )}
          <div className="floor-post-user-text">
            <span className="floor-post-username">{post.username}</span>
            <span className="floor-post-time">{formatTimeAgo(post.createdAt)}</span>
          </div>
        </button>
        {isOwner && (
          <button className="floor-post-menu" onClick={onDelete}>
            <span>...</span>
          </button>
        )}
      </div>

      {post.text && <p className="floor-post-text">{post.text}</p>}

      {post.images.length > 0 && (
        <div className={`floor-post-images ${post.images.length === 1 ? "single" : "double"}`}>
          {post.images.map((img, idx) => (
            <img key={idx} src={img} alt="" className="floor-post-image" />
          ))}
        </div>
      )}

      <div className="floor-post-actions">
        <button
          className={`floor-post-action ${hasThumbsUp ? "active-up" : ""}`}
          onClick={onThumbsUp}
        >
          <span className="action-icon">{hasThumbsUp ? "👍" : "👍"}</span>
          {post.thumbsUpCount > 0 && <span className="action-count">{post.thumbsUpCount}</span>}
        </button>
        <button
          className={`floor-post-action ${hasThumbsDown ? "active-down" : ""}`}
          onClick={onThumbsDown}
        >
          <span className="action-icon">{hasThumbsDown ? "👎" : "👎"}</span>
          {post.thumbsDownCount > 0 && <span className="action-count">{post.thumbsDownCount}</span>}
        </button>
        <button className="floor-post-action" onClick={onComment}>
          <span className="action-icon">💬</span>
          {post.commentsCount > 0 && <span className="action-count">{post.commentsCount}</span>}
        </button>
        <button className="floor-post-action" onClick={onShare}>
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
    <div className="floor-modal-overlay" onClick={onClose}>
      <div className="floor-comments-modal" onClick={(e) => e.stopPropagation()}>
        <div className="floor-comments-header">
          <h3>Comments</h3>
          <button className="floor-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="floor-comments-list">
          {comments.length === 0 ? (
            <div className="floor-comments-empty">
              <p>No comments yet</p>
              <p className="sub">Be the first to comment!</p>
            </div>
          ) : (
            comments.map((comment) => {
              const color = COLOR_MAP[comment.userAvatarColor || "green"] || COLOR_MAP.green;
              return (
                <div key={comment.id} className="floor-comment-item">
                  {comment.userProfilePicture ? (
                    <img src={comment.userProfilePicture} alt="" className="floor-comment-avatar" />
                  ) : (
                    <div className="floor-comment-avatar-placeholder" style={{ backgroundColor: color + "30" }}>
                      <span>{comment.userAvatar}</span>
                    </div>
                  )}
                  <div className="floor-comment-content">
                    <div className="floor-comment-bubble">
                      <span className="floor-comment-username">{comment.username}</span>
                      <p className="floor-comment-text">{comment.text}</p>
                    </div>
                    <span className="floor-comment-time">{formatTimeAgo(comment.createdAt)}</span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={commentsEndRef} />
        </div>
        <div className="floor-comment-input-container">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a comment..."
            maxLength={500}
          />
          <button
            className="floor-comment-send-btn"
            onClick={handleSend}
            disabled={!newComment.trim() || sending}
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TheFloor({ onClose }) {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();

  const [feedTab, setFeedTab] = useState("friends");
  const [friendsFeedPosts, setFriendsFeedPosts] = useState([]);
  const [discoverPosts, setDiscoverPosts] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [commentsPost, setCommentsPost] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharePost, setSharePost] = useState(null);

  // Load friends
  useEffect(() => {
    if (!user?.uid) return;
    const loadFriends = async () => {
      try {
        const friendsList = await getFriends(user.uid);
        setFriends(friendsList);
      } catch (error) {
        console.error("Error loading friends:", error);
      }
    };
    loadFriends();
  }, [user?.uid]);

  // Load feed based on tab
  useEffect(() => {
    const loadFeed = async () => {
      if (!user?.uid) return;
      setLoading(true);
      try {
        if (feedTab === "friends") {
          const friendIds = friends.map((f) => f.id).filter(Boolean);
          const posts = await getFriendsFeedPosts(user.uid, friendIds, 30);
          setFriendsFeedPosts(posts);
        } else {
          const posts = await getDiscoverPosts(30);
          setDiscoverPosts(posts);
        }
      } catch (error) {
        console.error("Error loading feed:", error);
      } finally {
        setLoading(false);
      }
    };
    loadFeed();
  }, [feedTab, friends.length, user?.uid]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (feedTab === "friends") {
        const friendIds = friends.map((f) => f.id).filter(Boolean);
        const posts = await getFriendsFeedPosts(user.uid, friendIds, 30);
        setFriendsFeedPosts(posts);
      } else {
        const posts = await getDiscoverPosts(30);
        setDiscoverPosts(posts);
      }
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const updatePostInFeeds = (postId, updater) => {
    setFriendsFeedPosts((prev) => prev.map((p) => (p.id === postId ? updater(p) : p)));
    setDiscoverPosts((prev) => prev.map((p) => (p.id === postId ? updater(p) : p)));
  };

  const handleThumbsUp = async (post) => {
    if (!user?.uid) return;
    const hasThumbsUp = post.thumbsUp.includes(user.uid);
    const hasThumbsDown = post.thumbsDown.includes(user.uid);

    // Optimistic update
    updatePostInFeeds(post.id, (p) => {
      if (hasThumbsUp) {
        return {
          ...p,
          thumbsUp: p.thumbsUp.filter((id) => id !== user.uid),
          thumbsUpCount: p.thumbsUpCount - 1,
        };
      } else {
        return {
          ...p,
          thumbsUp: [...p.thumbsUp, user.uid],
          thumbsUpCount: p.thumbsUpCount + 1,
          thumbsDown: hasThumbsDown ? p.thumbsDown.filter((id) => id !== user.uid) : p.thumbsDown,
          thumbsDownCount: hasThumbsDown ? p.thumbsDownCount - 1 : p.thumbsDownCount,
        };
      }
    });

    try {
      if (hasThumbsUp) {
        await removeThumbsUp(post.id, user.uid);
      } else {
        await thumbsUpPost(post.id, user.uid, hasThumbsDown);
      }
    } catch (error) {
      console.error("Error toggling thumbs up:", error);
      handleRefresh();
    }
  };

  const handleThumbsDown = async (post) => {
    if (!user?.uid) return;
    const hasThumbsUp = post.thumbsUp.includes(user.uid);
    const hasThumbsDown = post.thumbsDown.includes(user.uid);

    // Optimistic update
    updatePostInFeeds(post.id, (p) => {
      if (hasThumbsDown) {
        return {
          ...p,
          thumbsDown: p.thumbsDown.filter((id) => id !== user.uid),
          thumbsDownCount: p.thumbsDownCount - 1,
        };
      } else {
        return {
          ...p,
          thumbsDown: [...p.thumbsDown, user.uid],
          thumbsDownCount: p.thumbsDownCount + 1,
          thumbsUp: hasThumbsUp ? p.thumbsUp.filter((id) => id !== user.uid) : p.thumbsUp,
          thumbsUpCount: hasThumbsUp ? p.thumbsUpCount - 1 : p.thumbsUpCount,
        };
      }
    });

    try {
      if (hasThumbsDown) {
        await removeThumbsDown(post.id, user.uid);
      } else {
        await thumbsDownPost(post.id, user.uid, hasThumbsUp);
      }
    } catch (error) {
      console.error("Error toggling thumbs down:", error);
      handleRefresh();
    }
  };

  const handleDeletePost = async (post) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await deletePost(post.id);
      setFriendsFeedPosts((prev) => prev.filter((p) => p.id !== post.id));
      setDiscoverPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  const handleUserClick = (userId) => {
    navigate(`/profile/${userId}`);
  };

  const handleShare = (post) => {
    setSharePost(post);
    setShareModalOpen(true);
  };

  const currentPosts = feedTab === "friends" ? friendsFeedPosts : discoverPosts;

  return (
    <div className="floor-container">
      {/* Header */}
      <div className="floor-header">
        <button className="floor-back-btn" onClick={onClose}>
          <span>←</span>
        </button>
        <h1 className="floor-title">THE FLOOR</h1>
        <button className="floor-refresh-btn" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? "..." : "↻"}
        </button>
      </div>

      {/* Tabs */}
      <div className="floor-tabs">
        <button
          className={`floor-tab ${feedTab === "friends" ? "active" : ""}`}
          onClick={() => setFeedTab("friends")}
        >
          Friends
        </button>
        <button
          className={`floor-tab ${feedTab === "discover" ? "active" : ""}`}
          onClick={() => setFeedTab("discover")}
        >
          Discover
        </button>
      </div>

      {/* Feed */}
      <div className="floor-feed">
        {loading ? (
          <div className="floor-loading">
            <div className="floor-spinner" />
            <p>Loading posts...</p>
          </div>
        ) : currentPosts.length === 0 ? (
          <div className="floor-empty">
            {feedTab === "friends" ? (
              <>
                <span className="floor-empty-icon">👥</span>
                <p>No posts from friends yet</p>
                <p className="sub">Add friends to see their posts here!</p>
              </>
            ) : (
              <>
                <span className="floor-empty-icon">🔍</span>
                <p>No posts to discover</p>
                <p className="sub">Check back later for new content!</p>
              </>
            )}
          </div>
        ) : (
          currentPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user?.uid || ""}
              onThumbsUp={() => handleThumbsUp(post)}
              onThumbsDown={() => handleThumbsDown(post)}
              onComment={() => setCommentsPost(post)}
              onDelete={() => handleDeletePost(post)}
              onShare={() => handleShare(post)}
              onUserClick={handleUserClick}
            />
          ))
        )}
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
        onClose={() => {
          setShareModalOpen(false);
          setSharePost(null);
        }}
        type="post"
        post={sharePost}
        currentUser={user}
        userProfile={userProfile}
      />
    </div>
  );
}
