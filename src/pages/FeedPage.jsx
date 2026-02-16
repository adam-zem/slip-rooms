// src/pages/FeedPage.jsx
// Twitter/X style Feed page for website - 2 column layout

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
  repost,
  unrepost,
  hasUserRepostedPost,
  deletePost,
  subscribeToComments,
  addComment,
  createPost,
  subscribeToReplies,
  getPost,
  searchUsersByUsername,
} from "../services/postsService";
import {
  createReplyNotification,
  createMentionNotifications,
} from "../services/notificationService";
import ShareModal from "../components/ShareModal";
import "./FeedPage.css";

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

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

// Render text with @mentions highlighted in green and clickable
function RenderTextWithMentions({ text, onUserClick }) {
  if (!text) return null;

  const mentionRegex = /@([A-Za-z0-9_]+)/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(
        <span key={`text-${lastIndex}`}>
          {text.substring(lastIndex, match.index)}
        </span>
      );
    }

    // Add the mention as a clickable green link
    const username = match[1];
    parts.push(
      <button
        key={`mention-${match.index}`}
        className="mention-link"
        onClick={(e) => {
          e.stopPropagation();
          // For now, navigate using username - ideally look up user ID
          if (onUserClick) onUserClick(username);
        }}
      >
        @{username}
      </button>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${lastIndex}`}>
        {text.substring(lastIndex)}
      </span>
    );
  }

  return <>{parts}</>;
}

// Format count with 99+ for large numbers
function formatCount(count) {
  if (count > 99) return "99+";
  return count.toString();
}

// Post Card Component (Twitter style)
function PostCard({
  post,
  currentUserId,
  onThumbsUp,
  onThumbsDown,
  onComment,
  onDelete,
  onShare,
  onRepost,
  onUserClick,
  onPostPress,
  showReplyContext = true,
  hasReposted = false,
  showRepostedBy = false,
}) {
  const hasThumbsUp = (post.thumbsUp || []).includes(currentUserId);
  const hasThumbsDown = (post.thumbsDown || []).includes(currentUserId);
  const isOwner = post.userId === currentUserId;
  const avatarColor = COLOR_MAP[post.userAvatarColor || "green"] || COLOR_MAP.green;
  const replyCount = post.commentsCount || post.metrics?.repliesCount || 0;
  const repostCount = post.repostsCount || post.metrics?.repostsCount || 0;

  const handlePostClick = (e) => {
    // Don't trigger if clicking on buttons or links
    if (e.target.closest('button') || e.target.closest('a')) return;
    if (onPostPress) {
      onPostPress();
    } else if (onComment) {
      onComment();
    }
  };

  return (
    <article className="x-post" onClick={handlePostClick} style={{ cursor: "pointer" }}>
      {/* Reposted by label */}
      {showRepostedBy && post.isRepost && post.repostedBy && (
        <div className="x-repost-label">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/>
          </svg>
          <span>@{post.repostedBy} reposted</span>
        </div>
      )}
      {/* Reply context */}
      {showReplyContext && post.replyToPostId && post.replyToUsername && (
        <div className="x-reply-context">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="currentColor" d="M12 3.786L3.786 12 12 20.214l1.414-1.414L7.414 13H21v-2H7.414l5.914-5.914L12 3.786z"/>
          </svg>
          <span>
            Replying to <button className="reply-to-link" onClick={(e) => { e.stopPropagation(); onUserClick && onUserClick(post.replyToAuthorId); }}>@{post.replyToUsername}</button>
          </span>
        </div>
      )}
      <div className="x-post-avatar-col">
        <button className="x-post-avatar-btn" onClick={(e) => { e.stopPropagation(); onUserClick(post.userId); }}>
          {post.userProfilePicture ? (
            <img src={post.userProfilePicture} alt="" className="x-post-avatar" />
          ) : (
            <div
              className="x-post-avatar-placeholder"
              style={{ backgroundColor: avatarColor + "30", borderColor: avatarColor }}
            >
              {post.userAvatar}
            </div>
          )}
        </button>
      </div>
      <div className="x-post-content">
        <div className="x-post-header">
          <button className="x-post-user-link" onClick={(e) => { e.stopPropagation(); onUserClick(post.userId); }}>
            <span className="x-post-name">{post.username}</span>
            <span className="x-post-handle">@{post.username?.toLowerCase()}</span>
            <span className="x-post-dot">·</span>
            <span className="x-post-time">{formatTimeAgo(post.createdAt)}</span>
          </button>
          {isOwner && (
            <button className="x-post-menu" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <circle cx="5" cy="12" r="2" fill="currentColor"/>
                <circle cx="12" cy="12" r="2" fill="currentColor"/>
                <circle cx="19" cy="12" r="2" fill="currentColor"/>
              </svg>
            </button>
          )}
        </div>

        {post.text && (
          <p className="x-post-text">
            <RenderTextWithMentions text={post.text} onUserClick={onUserClick} />
          </p>
        )}

        {post.images && post.images.length > 0 && (
          <div className={`x-post-images ${post.images.length === 1 ? "single" : "grid"}`}>
            {post.images.map((img, idx) => (
              <img key={idx} src={img} alt="" className="x-post-image" />
            ))}
          </div>
        )}

        <div className="x-post-actions">
          <button className="x-action x-action-comment" onClick={(e) => { e.stopPropagation(); onComment(); }}>
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"/>
            </svg>
            {replyCount > 0 && <span>{formatCount(replyCount)}</span>}
          </button>
          <button className={`x-action x-action-repost ${hasReposted ? "active" : ""}`} onClick={(e) => { e.stopPropagation(); onRepost && onRepost(); }}>
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/>
            </svg>
            {repostCount > 0 && <span>{formatCount(repostCount)}</span>}
          </button>
          <button className={`x-action x-action-like ${hasThumbsUp ? "active" : ""}`} onClick={(e) => { e.stopPropagation(); onThumbsUp(); }}>
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"/>
            </svg>
            {post.thumbsUpCount > 0 && <span>{formatCount(post.thumbsUpCount)}</span>}
          </button>
          <button className={`x-action x-action-dislike ${hasThumbsDown ? "active" : ""}`} onClick={(e) => { e.stopPropagation(); onThumbsDown(); }}>
            <svg viewBox="0 0 24 24" width="18" height="18" style={{ transform: "rotate(180deg)" }}>
              <path fill="currentColor" d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"/>
            </svg>
            {post.thumbsDownCount > 0 && <span>{formatCount(post.thumbsDownCount)}</span>}
          </button>
          <button className="x-action x-action-share" onClick={(e) => { e.stopPropagation(); onShare(); }}>
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="currentColor" d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z"/>
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}

// Thread Modal - Shows original post + replies with reply composer
function ThreadModal({ post, currentUser, userProfile, onClose, onUserClick, onThumbsUp, onThumbsDown }) {
  const navigate = useNavigate();
  const [replies, setReplies] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const repliesEndRef = useRef(null);

  useEffect(() => {
    if (!post) return;
    const unsubscribe = subscribeToReplies(post.id, setReplies);
    return () => unsubscribe();
  }, [post?.id]);

  useEffect(() => {
    repliesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies]);

  // Handle @ mention autocomplete
  const handleTextChange = async (e) => {
    const text = e.target.value;
    setReplyText(text);

    // Check if we're typing a mention
    const lastAtIndex = text.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const afterAt = text.substring(lastAtIndex + 1);
      if (!afterAt.includes(" ") && afterAt.length > 0) {
        setShowMentions(true);
        try {
          const users = await searchUsersByUsername(afterAt, 5);
          setMentionSuggestions(users);
        } catch (error) {
          setMentionSuggestions([]);
        }
      } else if (afterAt.length === 0) {
        setShowMentions(true);
        setMentionSuggestions([]);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (username) => {
    const lastAtIndex = replyText.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const newText = replyText.substring(0, lastAtIndex) + "@" + username + " ";
      setReplyText(newText);
    }
    setShowMentions(false);
    setMentionSuggestions([]);
  };

  const handleSend = async () => {
    if (!replyText.trim() || !post || sending) return;
    setSending(true);
    try {
      const userData = {
        username: userProfile?.username || "User",
        avatarEmoji: userProfile?.avatarEmoji || "🔥",
        avatarColor: userProfile?.avatarColor || "green",
        profilePicture: userProfile?.profilePicture || null,
      };

      // Create the reply as a post with replyToPostId
      const newReply = await createPost(
        currentUser.uid,
        userData,
        replyText.trim(),
        [], // no images for now
        post.id // replyToPostId
      );

      // Create notification for the post author
      if (post.authorId && post.authorId !== currentUser.uid) {
        try {
          await createReplyNotification(
            post.authorId,
            currentUser.uid,
            userData,
            newReply.id,
            replyText.trim()
          );
        } catch (notifError) {
          console.log("Could not create reply notification:", notifError);
        }
      }

      // Create mention notifications
      if (newReply.mentionedUserIds && newReply.mentionedUserIds.length > 0) {
        try {
          await createMentionNotifications(
            newReply.mentionedUserIds,
            currentUser.uid,
            userData,
            newReply.id,
            replyText.trim()
          );
        } catch (notifError) {
          console.log("Could not create mention notifications:", notifError);
        }
      }

      setReplyText("");
    } catch (error) {
      console.error("Error posting reply:", error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !showMentions) {
      e.preventDefault();
      handleSend();
    }
  };

  const postAvatarColor = COLOR_MAP[post?.userAvatarColor || "green"] || COLOR_MAP.green;

  return (
    <div className="x-modal-overlay" onClick={onClose}>
      <div className="x-thread-modal" onClick={(e) => e.stopPropagation()}>
        <div className="x-thread-header">
          <button className="x-modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="currentColor" d="M10.59 12L4.54 5.96l1.42-1.42L12 10.59l6.04-6.05 1.42 1.42L13.41 12l6.05 6.04-1.42 1.42L12 13.41l-6.04 6.05-1.42-1.42L10.59 12z"/>
            </svg>
          </button>
          <h2>Thread</h2>
        </div>

        <div className="x-thread-content">
          {/* Original Post */}
          {post && (
            <div className="x-original-post">
              <div className="x-post-header">
                <button className="x-post-avatar-btn" onClick={() => onUserClick && onUserClick(post.userId)}>
                  {post.userProfilePicture ? (
                    <img src={post.userProfilePicture} alt="" className="x-post-avatar" />
                  ) : (
                    <div className="x-post-avatar-placeholder" style={{ backgroundColor: postAvatarColor + "30", borderColor: postAvatarColor }}>
                      {post.userAvatar}
                    </div>
                  )}
                </button>
                <div className="x-post-user-info">
                  <span className="x-post-name">{post.username}</span>
                  <span className="x-post-handle">@{post.username?.toLowerCase()}</span>
                </div>
              </div>
              <div className="x-original-post-text">
                <RenderTextWithMentions text={post.text} onUserClick={onUserClick} />
              </div>
              {post.images && post.images.length > 0 && (
                <div className="x-post-images single">
                  {post.images.map((img, idx) => (
                    <img key={idx} src={img} alt="" className="x-post-image" />
                  ))}
                </div>
              )}
              <div className="x-original-post-time">
                {post.createdAt?.toLocaleString?.() || formatTimeAgo(post.createdAt)}
              </div>
              <div className="x-original-post-stats">
                <span>{post.commentsCount || 0} Replies</span>
                <span>{post.thumbsUpCount || 0} Likes</span>
              </div>
            </div>
          )}

          {/* Reply Composer */}
          <div className="x-reply-composer">
            <div className="x-replying-to">
              Replying to <span className="mention-link">@{post?.username}</span>
            </div>
            <div className="x-reply-input-row">
              {userProfile?.profilePicture ? (
                <img src={userProfile.profilePicture} alt="" className="x-composer-avatar" />
              ) : (
                <div className="x-composer-avatar-placeholder" style={{ backgroundColor: (COLOR_MAP[userProfile?.avatarColor] || COLOR_MAP.green) + "30" }}>
                  {userProfile?.avatarEmoji || "🔥"}
                </div>
              )}
              <div className="x-reply-input-wrapper">
                <textarea
                  value={replyText}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Post your reply..."
                  maxLength={500}
                />
                {/* Mention Suggestions */}
                {showMentions && mentionSuggestions.length > 0 && (
                  <div className="x-mention-suggestions">
                    {mentionSuggestions.map((user) => (
                      <button
                        key={user.id}
                        className="x-mention-item"
                        onClick={() => insertMention(user.username)}
                      >
                        {user.profilePicture ? (
                          <img src={user.profilePicture} alt="" className="x-mention-avatar" />
                        ) : (
                          <div className="x-mention-avatar-placeholder" style={{ backgroundColor: (COLOR_MAP[user.avatarColor] || COLOR_MAP.green) + "30" }}>
                            {user.avatarEmoji}
                          </div>
                        )}
                        <span className="x-mention-username">@{user.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                className="x-reply-btn"
                onClick={handleSend}
                disabled={!replyText.trim() || sending}
              >
                Reply
              </button>
            </div>
          </div>

          {/* Replies */}
          <div className="x-replies-section">
            {replies.length === 0 ? (
              <div className="x-comments-empty">
                <p>No replies yet</p>
                <p className="sub">Be the first to reply!</p>
              </div>
            ) : (
              replies.map((reply) => {
                const color = COLOR_MAP[reply.userAvatarColor || "green"] || COLOR_MAP.green;
                const hasThumbsUp = (reply.thumbsUp || []).includes(currentUser?.uid);
                const hasThumbsDown = (reply.thumbsDown || []).includes(currentUser?.uid);
                return (
                  <div key={reply.id} className="x-reply-item">
                    <div className="x-reply-connector"></div>
                    <button className="x-reply-avatar-btn" onClick={() => onUserClick && onUserClick(reply.userId)}>
                      {reply.userProfilePicture ? (
                        <img src={reply.userProfilePicture} alt="" className="x-reply-avatar" />
                      ) : (
                        <div className="x-reply-avatar-placeholder" style={{ backgroundColor: color + "30" }}>
                          {reply.userAvatar}
                        </div>
                      )}
                    </button>
                    <div className="x-reply-content">
                      <div className="x-reply-header">
                        <span className="x-reply-name">{reply.username}</span>
                        <span className="x-reply-handle">@{reply.username?.toLowerCase()}</span>
                        <span className="x-reply-time">· {formatTimeAgo(reply.createdAt)}</span>
                      </div>
                      <p className="x-reply-text">
                        <RenderTextWithMentions text={reply.text} onUserClick={onUserClick} />
                      </p>
                      <div className="x-reply-actions">
                        <button
                          className={`x-reply-action ${hasThumbsUp ? "active-like" : ""}`}
                          onClick={() => onThumbsUp && onThumbsUp(reply)}
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91z"/>
                          </svg>
                          {reply.thumbsUpCount > 0 && <span>{reply.thumbsUpCount}</span>}
                        </button>
                        <button
                          className={`x-reply-action ${hasThumbsDown ? "active-dislike" : ""}`}
                          onClick={() => onThumbsDown && onThumbsDown(reply)}
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" style={{ transform: "rotate(180deg)" }}>
                            <path fill="currentColor" d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={repliesEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Legacy alias
const CommentsModal = ThreadModal;

// Post Composer Component
function PostComposer({ user, userProfile, onPost }) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const textareaRef = useRef(null);
  const avatarColor = COLOR_MAP[userProfile?.avatarColor || "green"] || COLOR_MAP.green;

  const handlePost = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      await onPost(text);
      setText("");
    } finally {
      setPosting(false);
    }
  };

  // Expose focus method
  useEffect(() => {
    window.focusComposer = () => textareaRef.current?.focus();
    return () => { delete window.focusComposer; };
  }, []);

  return (
    <div className="x-composer">
      <div className="x-composer-avatar">
        {userProfile?.profilePicture ? (
          <img src={userProfile.profilePicture} alt="" />
        ) : (
          <div className="x-composer-avatar-placeholder" style={{ backgroundColor: avatarColor + "30" }}>
            {userProfile?.avatarEmoji || "🔥"}
          </div>
        )}
      </div>
      <div className="x-composer-input">
        <textarea
          ref={textareaRef}
          placeholder="What's happening?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
        />
        <div className="x-composer-actions">
          <div className="x-composer-tools">
            <button className="x-composer-tool" title="Image">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M3 5.5C3 4.119 4.119 3 5.5 3h13C19.881 3 21 4.119 21 5.5v13c0 1.381-1.119 2.5-2.5 2.5h-13C4.119 21 3 19.881 3 18.5v-13zM5.5 5c-.276 0-.5.224-.5.5v9.086l3-3 3 3 5-5 3 3V5.5c0-.276-.224-.5-.5-.5h-13zM19 15.414l-3-3-5 5-3-3-3 3V18.5c0 .276.224.5.5.5h13c.276 0 .5-.224.5-.5v-3.086zM9.75 7C8.784 7 8 7.784 8 8.75s.784 1.75 1.75 1.75 1.75-.784 1.75-1.75S10.716 7 9.75 7z"/>
              </svg>
            </button>
            <button className="x-composer-tool" title="Emoji">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M8 9.5C8 8.119 8.672 7 9.5 7S11 8.119 11 9.5 10.328 12 9.5 12 8 10.881 8 9.5zm6.5 2.5c.828 0 1.5-1.119 1.5-2.5S15.328 7 14.5 7 13 8.119 13 9.5s.672 2.5 1.5 2.5zM12 16c-2.224 0-3.021-2.227-3.051-2.316l-1.897.633c.05.15 1.271 3.684 4.949 3.684s4.898-3.533 4.949-3.684l-1.896-.638c-.033.095-.83 2.322-3.054 2.322zm10.25-4.001c0 5.652-4.598 10.25-10.25 10.25S1.75 17.652 1.75 12 6.348 1.75 12 1.75 22.25 6.348 22.25 12zm-2 0c0-4.549-3.701-8.25-8.25-8.25S3.75 7.451 3.75 12s3.701 8.25 8.25 8.25 8.25-3.701 8.25-8.25z"/>
              </svg>
            </button>
          </div>
          <button
            className="x-post-btn"
            onClick={handlePost}
            disabled={!text.trim() || posting}
          >
            {posting ? "..." : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FeedPage() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();

  const [feedTab, setFeedTab] = useState("friends");
  const [friendsFeedPosts, setFriendsFeedPosts] = useState([]);
  const [discoverPosts, setDiscoverPosts] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [commentsPost, setCommentsPost] = useState(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [sharePost, setSharePost] = useState(null);

  // Track which posts the user has reposted
  const [userReposts, setUserReposts] = useState(new Set());

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
    }
  };

  const updatePostInFeeds = (postId, updater) => {
    setFriendsFeedPosts((prev) => prev.map((p) => (p.id === postId ? updater(p) : p)));
    setDiscoverPosts((prev) => prev.map((p) => (p.id === postId ? updater(p) : p)));
  };

  const handleRepost = async (post) => {
    if (!user?.uid) return;

    // Don't allow reposting your own posts
    if ((post.authorId || post.userId) === user.uid) {
      alert("You can't repost your own post.");
      return;
    }

    const hasReposted = userReposts.has(post.id);

    // Optimistic update
    setUserReposts((prev) => {
      const newSet = new Set(prev);
      if (hasReposted) {
        newSet.delete(post.id);
      } else {
        newSet.add(post.id);
      }
      return newSet;
    });

    updatePostInFeeds(post.id, (p) => ({
      ...p,
      repostsCount: hasReposted
        ? Math.max(0, (p.repostsCount || 0) - 1)
        : (p.repostsCount || 0) + 1,
      metrics: {
        ...p.metrics,
        repostsCount: hasReposted
          ? Math.max(0, (p.metrics?.repostsCount || 0) - 1)
          : (p.metrics?.repostsCount || 0) + 1,
      },
    }));

    try {
      if (hasReposted) {
        await unrepost(post.id, user.uid);
      } else {
        await repost(post.id, user.uid);
      }
    } catch (error) {
      console.error("Error toggling repost:", error);
      // Revert optimistic updates
      setUserReposts((prev) => {
        const newSet = new Set(prev);
        if (hasReposted) {
          newSet.add(post.id);
        } else {
          newSet.delete(post.id);
        }
        return newSet;
      });
      handleRefresh();
    }
  };

  const handleThumbsUp = async (post) => {
    if (!user?.uid) return;
    const hasThumbsUp = (post.thumbsUp || []).includes(user.uid);
    const hasThumbsDown = (post.thumbsDown || []).includes(user.uid);

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
    const hasThumbsUp = (post.thumbsUp || []).includes(user.uid);
    const hasThumbsDown = (post.thumbsDown || []).includes(user.uid);

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

  // Open thread modal - if it's a reply, show the parent post instead
  const openComments = async (post) => {
    if (post.replyToPostId) {
      try {
        const parentPost = await getPost(post.replyToPostId);
        if (parentPost) {
          setCommentsPost(parentPost);
          return;
        }
      } catch (error) {
        console.log("Could not fetch parent post:", error);
      }
    }
    setCommentsPost(post);
  };

  const handleCreatePost = async (text) => {
    if (!user?.uid || !text.trim()) return;
    try {
      const userData = {
        username: userProfile?.username || "User",
        avatarEmoji: userProfile?.avatarEmoji || "🔥",
        avatarColor: userProfile?.avatarColor || "green",
        profilePicture: userProfile?.profilePicture || null,
      };

      const newPost = await createPost(user.uid, userData, text, []);

      // Create mention notifications
      if (newPost.mentionedUserIds && newPost.mentionedUserIds.length > 0) {
        try {
          await createMentionNotifications(
            newPost.mentionedUserIds,
            user.uid,
            userData,
            newPost.id,
            text.trim()
          );
        } catch (notifError) {
          console.log("Could not create mention notifications:", notifError);
        }
      }

      handleRefresh();
    } catch (error) {
      console.error("Error creating post:", error);
    }
  };

  const currentPosts = feedTab === "friends" ? friendsFeedPosts : discoverPosts;

  return (
    <div className="x-layout">
      {/* Left Sidebar */}
      <aside className="x-sidebar-left">
        <div className="x-sidebar-content">
          <button className="x-logo" onClick={() => navigate("/")}>
            <span className="x-logo-text">S</span>
          </button>

          <nav className="x-nav">
            <button className="x-nav-item" onClick={() => navigate("/")}>
              <svg viewBox="0 0 24 24" width="26" height="26">
                <path fill="currentColor" d="M21.591 7.146L12.52 1.157c-.316-.21-.724-.21-1.04 0l-9.071 5.99c-.26.173-.409.456-.409.757v13.183c0 .502.418.913.929.913h6.638c.511 0 .929-.41.929-.913v-7.075h3.008v7.075c0 .502.418.913.929.913h6.639c.51 0 .928-.41.928-.913V7.904c0-.301-.158-.584-.418-.758zM20 20l-4.5.01.011-7.097c0-.502-.418-.913-.928-.913H9.44c-.511 0-.929.41-.929.913L8.5 20H4V8.773l8.011-5.342L20 8.764V20z"/>
              </svg>
              <span>Home</span>
            </button>
            <button
              className={`x-nav-item ${feedTab === "discover" ? "active" : ""}`}
              onClick={() => setFeedTab("discover")}
            >
              <svg viewBox="0 0 24 24" width="26" height="26">
                <path fill="currentColor" d="M10.25 3.75c-3.59 0-6.5 2.91-6.5 6.5s2.91 6.5 6.5 6.5c1.795 0 3.419-.726 4.596-1.904 1.178-1.177 1.904-2.801 1.904-4.596 0-3.59-2.91-6.5-6.5-6.5zm-8.5 6.5c0-4.694 3.806-8.5 8.5-8.5s8.5 3.806 8.5 8.5c0 1.986-.682 3.815-1.824 5.262l4.781 4.781-1.414 1.414-4.781-4.781c-1.447 1.142-3.276 1.824-5.262 1.824-4.694 0-8.5-3.806-8.5-8.5z"/>
              </svg>
              <span>Explore</span>
            </button>
            <button className="x-nav-item" onClick={() => navigate("/")}>
              <svg viewBox="0 0 24 24" width="26" height="26">
                <path fill="currentColor" d="M19.993 9.042C19.48 5.017 16.054 2 11.996 2s-7.49 3.021-7.999 7.051L2.866 18H7.1c.463 2.282 2.481 4 4.9 4s4.437-1.718 4.9-4h4.236l-1.143-8.958zM12 20c-1.306 0-2.417-.835-2.829-2h5.658c-.412 1.165-1.523 2-2.829 2zm-6.866-4l.847-6.698C6.364 6.272 8.941 4 11.996 4s5.627 2.268 6.013 5.295L18.864 16H5.134z"/>
              </svg>
              <span>Notifications</span>
            </button>
            <button className="x-nav-item" onClick={() => navigate("/")}>
              <svg viewBox="0 0 24 24" width="26" height="26">
                <path fill="currentColor" d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v2.764l8 3.638 8-3.636V5.5c0-.276-.224-.5-.5-.5h-15zm15.5 5.463l-8 3.636-8-3.638V18.5c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-8.037z"/>
              </svg>
              <span>Messages</span>
            </button>
            <button className="x-nav-item" onClick={() => navigate("/profile")}>
              <svg viewBox="0 0 24 24" width="26" height="26">
                <path fill="currentColor" d="M5.651 19h12.698c-.337-1.8-1.023-3.21-1.945-4.19C15.318 13.65 13.838 13 12 13s-3.317.65-4.404 1.81c-.922.98-1.608 2.39-1.945 4.19zm.486-5.56C7.627 11.85 9.648 11 12 11s4.373.85 5.863 2.44c1.477 1.58 2.366 3.8 2.632 6.46l.11 1.1H3.395l.11-1.1c.266-2.66 1.155-4.88 2.632-6.46zM12 4c-1.105 0-2 .9-2 2s.895 2 2 2 2-.9 2-2-.895-2-2-2zM8 6c0-2.21 1.791-4 4-4s4 1.79 4 4-1.791 4-4 4-4-1.79-4-4z"/>
              </svg>
              <span>Profile</span>
            </button>
          </nav>

          <button className="x-post-big-btn" onClick={() => window.focusComposer?.()}>
            Post
          </button>

          {/* User pill at bottom */}
          <button className="x-user-pill" onClick={() => navigate("/profile")}>
            <div className="x-user-pill-avatar">
              {userProfile?.profilePicture ? (
                <img src={userProfile.profilePicture} alt="" />
              ) : (
                <div className="x-user-pill-placeholder">
                  {userProfile?.avatarEmoji || "🔥"}
                </div>
              )}
            </div>
            <div className="x-user-pill-info">
              <span className="x-user-pill-name">{userProfile?.username || "User"}</span>
              <span className="x-user-pill-handle">@{userProfile?.username?.toLowerCase() || "user"}</span>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Feed */}
      <main className="x-main">
        <header className="x-main-header">
          <button
            className={`x-tab ${feedTab === "friends" ? "active" : ""}`}
            onClick={() => setFeedTab("friends")}
          >
            Friends
          </button>
          <button
            className={`x-tab ${feedTab === "discover" ? "active" : ""}`}
            onClick={() => setFeedTab("discover")}
          >
            Discover
          </button>
        </header>

        <PostComposer user={user} userProfile={userProfile} onPost={handleCreatePost} />

        <div className="x-feed">
          {loading ? (
            <div className="x-loading">
              <div className="x-spinner" />
            </div>
          ) : currentPosts.length === 0 ? (
            <div className="x-empty">
              {feedTab === "friends" ? (
                <>
                  <h3>No posts from friends yet</h3>
                  <p>When your friends post, you'll see them here.</p>
                </>
              ) : (
                <>
                  <h3>Nothing to discover</h3>
                  <p>Check back later for trending content.</p>
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
                onComment={() => openComments(post)}
                onDelete={() => handleDeletePost(post)}
                onShare={() => handleShare(post)}
                onRepost={() => handleRepost(post)}
                onUserClick={handleUserClick}
                hasReposted={userReposts.has(post.id)}
                showRepostedBy={feedTab === "friends"}
              />
            ))
          )}
        </div>
      </main>

      {/* Thread/Reply Modal */}
      {commentsPost && (
        <ThreadModal
          post={commentsPost}
          currentUser={user}
          userProfile={userProfile}
          onClose={() => setCommentsPost(null)}
          onUserClick={(userId) => {
            setCommentsPost(null);
            navigate(`/profile/${userId}`);
          }}
          onThumbsUp={handleThumbsUp}
          onThumbsDown={handleThumbsDown}
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
