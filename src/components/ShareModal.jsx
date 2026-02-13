// src/components/ShareModal.jsx
// Share modal with 3 options: Send to Friend, iMessage/SMS, Copy Link

import { useState, useEffect } from "react";
import { getFriends } from "../services/friendsService";
import {
  copyRoomLink,
  copyPostLink,
  shareRoomViaSMS,
  sharePostViaSMS,
  sendSharedRoomDM,
  sendSharedPostDM,
  getRoomShareLink,
  getPostShareLink,
} from "../services/shareService";
import "./ShareModal.css";

export default function ShareModal({
  isOpen,
  onClose,
  type, // "room" | "post"
  room, // { id, name, gameName, sport, userCount }
  post, // { id, text, username, images }
  currentUser,
  userProfile,
}) {
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [toast, setToast] = useState(null);

  // Load friends when friend picker opens
  useEffect(() => {
    if (showFriendPicker && currentUser?.uid) {
      loadFriends();
    }
  }, [showFriendPicker, currentUser?.uid]);

  const loadFriends = async () => {
    if (!currentUser?.uid) return;
    setLoading(true);
    try {
      const friendsList = await getFriends(currentUser.uid);
      setFriends(friendsList);
    } catch (error) {
      console.error("Error loading friends:", error);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSendToFriend = () => {
    setShowFriendPicker(true);
  };

  const handleFriendSelect = async (friend) => {
    if (!currentUser?.uid || !userProfile || sending) return;

    setSelectedFriend(friend);
    setSending(true);

    try {
      let success = false;

      if (type === "room" && room) {
        const messageId = await sendSharedRoomDM(
          currentUser.uid,
          {
            username: userProfile.username,
            avatarEmoji: userProfile.avatarEmoji,
            profilePicture: userProfile.profilePicture,
          },
          friend.id,
          {
            username: friend.username,
            avatarEmoji: friend.avatarEmoji,
            profilePicture: friend.profilePicture,
          },
          room
        );
        success = !!messageId;
      } else if (type === "post" && post) {
        const messageId = await sendSharedPostDM(
          currentUser.uid,
          {
            username: userProfile.username,
            avatarEmoji: userProfile.avatarEmoji,
            profilePicture: userProfile.profilePicture,
          },
          friend.id,
          {
            username: friend.username,
            avatarEmoji: friend.avatarEmoji,
            profilePicture: friend.profilePicture,
          },
          post
        );
        success = !!messageId;
      }

      if (success) {
        showToast(`Sent to ${friend.username}!`);
        setShowFriendPicker(false);
        setTimeout(onClose, 1000);
      } else {
        showToast("Failed to send. Please try again.", true);
      }
    } catch (error) {
      console.error("Error sending to friend:", error);
      showToast("Failed to send. Please try again.", true);
    } finally {
      setSending(false);
      setSelectedFriend(null);
    }
  };

  const handleSMS = async () => {
    try {
      if (type === "room" && room) {
        await shareRoomViaSMS(room);
      } else if (type === "post" && post) {
        await sharePostViaSMS(post);
      }
      onClose();
    } catch (error) {
      console.error("Error sharing via SMS:", error);
    }
  };

  const handleCopyLink = async () => {
    try {
      let success = false;
      if (type === "room" && room) {
        success = await copyRoomLink(room.id);
      } else if (type === "post" && post) {
        success = await copyPostLink(post.id);
      }

      if (success) {
        showToast("Link copied!");
        setTimeout(onClose, 1000);
      } else {
        showToast("Failed to copy link", true);
      }
    } catch (error) {
      console.error("Error copying link:", error);
      showToast("Failed to copy link", true);
    }
  };

  const handleBack = () => {
    setShowFriendPicker(false);
    setSearchQuery("");
  };

  const filteredFriends = friends.filter((friend) => {
    if (!searchQuery.trim()) return true;
    return friend.username?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (!isOpen) return null;

  const title = type === "room" ? "Share Room" : "Share Post";
  const link = type === "room" && room ? getRoomShareLink(room.id) : type === "post" && post ? getPostShareLink(post.id) : "";

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        {/* Toast */}
        {toast && (
          <div className={`share-toast ${toast.isError ? "share-toast-error" : ""}`}>
            {toast.message}
          </div>
        )}

        {showFriendPicker ? (
          <>
            {/* Friend Picker */}
            <div className="share-modal-header">
              <button className="share-back-btn" onClick={handleBack}>
                <span className="share-icon">&#8592;</span>
              </button>
              <h2>Send to Friend</h2>
              <div className="share-header-spacer"></div>
            </div>

            <div className="friend-search">
              <input
                type="text"
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="friends-list">
              {loading ? (
                <div className="friends-loading">Loading friends...</div>
              ) : filteredFriends.length === 0 ? (
                <div className="friends-empty">
                  {searchQuery ? "No friends found" : "No friends yet"}
                </div>
              ) : (
                filteredFriends.map((friend) => (
                  <button
                    key={friend.id}
                    className={`friend-item ${selectedFriend?.id === friend.id ? "friend-item-selected" : ""}`}
                    onClick={() => handleFriendSelect(friend)}
                    disabled={sending}
                  >
                    <div className="friend-avatar">
                      {friend.profilePicture ? (
                        <img src={friend.profilePicture} alt="" />
                      ) : (
                        <span className="friend-emoji">{friend.avatarEmoji || "🔥"}</span>
                      )}
                    </div>
                    <div className="friend-info">
                      <span className="friend-name">{friend.username}</span>
                      <span className="friend-level">Lv. {friend.level || 1}</span>
                    </div>
                    {selectedFriend?.id === friend.id && sending ? (
                      <div className="friend-loading-spinner"></div>
                    ) : (
                      <span className="friend-chevron">&#8250;</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            {/* Main Share Options */}
            <div className="share-modal-header">
              <h2>{title}</h2>
              <button className="share-close-btn" onClick={onClose}>
                &times;
              </button>
            </div>

            {/* Preview */}
            <div className="share-preview">
              <div className="share-preview-icon">
                {type === "room" ? "💬" : "📝"}
              </div>
              <div className="share-preview-content">
                <div className="share-preview-title">
                  {type === "room" && room ? room.name : type === "post" && post ? (post.username ? `@${post.username}` : "Post") : ""}
                </div>
                <div className="share-preview-subtitle">
                  {type === "room" && room ? room.gameName : type === "post" && post ? post.text?.slice(0, 50) + (post.text?.length > 50 ? "..." : "") : ""}
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="share-options">
              <button className="share-option" onClick={handleSendToFriend}>
                <div className="share-option-icon share-option-icon-friend">
                  <span>👤</span>
                </div>
                <div className="share-option-content">
                  <span className="share-option-title">Send to Friend</span>
                  <span className="share-option-subtitle">Share via DM</span>
                </div>
                <span className="share-option-chevron">&#8250;</span>
              </button>

              <button className="share-option" onClick={handleSMS}>
                <div className="share-option-icon share-option-icon-sms">
                  <span>💬</span>
                </div>
                <div className="share-option-content">
                  <span className="share-option-title">iMessage / SMS</span>
                  <span className="share-option-subtitle">Open text message</span>
                </div>
                <span className="share-option-chevron">&#8250;</span>
              </button>

              <button className="share-option" onClick={handleCopyLink}>
                <div className="share-option-icon share-option-icon-link">
                  <span>🔗</span>
                </div>
                <div className="share-option-content">
                  <span className="share-option-title">Copy Link</span>
                  <span className="share-option-subtitle">{link.replace("https://", "")}</span>
                </div>
                <span className="share-option-chevron">&#8250;</span>
              </button>
            </div>

            <button className="share-cancel-btn" onClick={onClose}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
