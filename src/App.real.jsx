// src/App.jsx
import { useState, useEffect, useRef } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import "./App.css";
import { useAuth } from "./contexts/AuthContext";
import { signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";
import { useGames } from "./hooks/useGames";
import { getPeriodLabel } from "./services/espnService";
import { awardMessageXP, awardXP, XP_REWARDS } from "./services/xpService";
import {
  createRoom as createRoomInFirestore,
  sendMessage as sendMessageToFirestore,
  subscribeToMessages,
  deleteRoom as deleteRoomFromFirestore,
  getRoomsBySport,
  joinRoom,
  leaveRoom,
  subscribeToAllRooms,
} from "./services/chatService";



//
// ---------------- CONFIG ----------------
//

const emojiOptions = ["🔥", "😭", "😅", "🤞", "💰", "🍀", "🧱", "🤯", "😡"];

//
// ---------------- INITIAL MARKETS (empty) ----------------
//

const initialMarkets = [
  { id: "nfl", label: "NFL", rooms: [] },
  { id: "nba", label: "NBA", rooms: [] },
  { id: "mlb", label: "MLB", rooms: [] },
  { id: "nhl", label: "NHL", rooms: [] },
  { id: "soccer", label: "Soccer", rooms: [] },
];

//
// ---------------- PROFILE DEFAULT ----------------
//

const defaultProfile = {
  displayName: "Adam",
  favoriteMarket: "NFL",
  bio: "Just here for the sweat.",
  avatarEmoji: "🔥",
  avatarColor: "blue", // used with CSS classes like .profile-avatar-blue
  publicProfile: true,
  notifications: true,
  soundEffects: false,
};

function formatTime(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

//
// ---------------- COMPONENT ----------------
//

// Username setup component for social login users
function UsernameSetup({ user, onComplete }) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validateUsername = (u) => {
    const trimmed = (u || "").trim();
    if (!trimmed) return "Username is required.";
    if (trimmed.length < 3) return "Username must be at least 3 characters.";
    if (trimmed.length > 20) return "Username must be 20 characters or less.";
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return "Username can only use letters, numbers, and underscores.";
    }
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const msg = validateUsername(username);
    if (msg) {
      setError(msg);
      return;
    }

    try {
      setLoading(true);
      await setDoc(doc(db, "users", user.uid), {
        username: username.trim(),
        email: user.email || "",
        createdAt: new Date().toISOString(),
        provider: user.providerData?.[0]?.providerId || "social",
      });
      onComplete();
    } catch (err) {
      setError(err?.message || "Failed to save username.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="username-setup">
      <div className="username-setup-container">
        <h1 className="username-setup-logo">SLIPROOMS</h1>
        <p className="username-setup-tagline">one last thing...</p>

        <form onSubmit={handleSubmit} className="username-setup-form">
          <p className="username-setup-prompt">Choose a username for the chat rooms</p>

          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            disabled={loading}
            className="username-setup-input"
            autoFocus
          />

          {error && <div className="username-setup-error">{error}</div>}

          <button type="submit" disabled={loading} className="username-setup-btn">
            {loading ? "Saving..." : "Enter the Room"}
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const { user, userProfile, authReady, needsUsername, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // ESPN games hook
  const { gamesBySport, loading: gamesLoading, getGameById, refresh: refreshGames } = useGames();

  // All hooks must be called unconditionally at the top
  const [markets, setMarkets] = useState(initialMarkets);
  const [activeMarketId, setActiveMarketId] = useState(initialMarkets[0].id);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Create room modal state
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [roomBetName, setRoomBetName] = useState("");
  const [roomOdds, setRoomOdds] = useState("");

  // Slip status (live game tracking for current room)
  const [isLiveExpanded, setIsLiveExpanded] = useState(true);

  // profile state - will be updated when userProfile loads
  const [profile, setProfile] = useState(defaultProfile);
  const [draftProfile, setDraftProfile] = useState(defaultProfile);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showAvatarChoices, setShowAvatarChoices] = useState(true);

  // for soft fade transitions on room change
  const [fadeKey, setFadeKey] = useState(0);

  // Real-time messages from Firestore
  const [liveMessages, setLiveMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // TOP SWEAT banner state (for transition effects)
  const [displayedTopSweat, setDisplayedTopSweat] = useState(null);
  const [topSweatPhase, setTopSweatPhase] = useState("idle"); // "idle" | "fading-out" | "pause" | "fading-in"
  const [allRooms, setAllRooms] = useState([]); // All rooms across all sports for TOP SWEAT

  // refs for smart auto-scroll
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Compute these early so useEffects can use them
  const activeMarket = markets.find((m) => m.id === activeMarketId) || markets[0];
  const activeRoom = activeRoomId ? activeMarket.rooms.find((r) => r.id === activeRoomId) : null;
  // Use live messages from Firestore instead of local state
  const activeMessages = liveMessages;

  // Auto scroll effect
  useEffect(() => {
    if (!user || !activeRoom) return;
    const el = messagesContainerRef.current;
    const isNearBottom = !el || el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
    if (isNearBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeRoomId, activeMessages.length, user, activeRoom]);

  // Load username from Firestore profile
  useEffect(() => {
    if (userProfile?.username) {
      setProfile((prev) => ({ ...prev, displayName: userProfile.username }));
      setDraftProfile((prev) => ({ ...prev, displayName: userProfile.username }));
    }
  }, [userProfile]);

  // Subscribe to real-time messages when room changes
  useEffect(() => {
    if (!activeRoomId || !user) {
      setLiveMessages([]);
      return;
    }

    setMessagesLoading(true);

    // Subscribe to messages - this returns an unsubscribe function
    const unsubscribe = subscribeToMessages(activeRoomId, (messages) => {
      setLiveMessages(messages);
      setMessagesLoading(false);
    });

    // Cleanup: unsubscribe when room changes or component unmounts
    return () => {
      unsubscribe();
    };
  }, [activeRoomId, user]);

  // Subscribe to ALL rooms for TOP SWEAT tracking + sync user counts to sidebar
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToAllRooms((rooms) => {
      setAllRooms(rooms);

      // Also sync userCount to markets for sidebar display
      setMarkets((prev) =>
        prev.map((market) => ({
          ...market,
          rooms: market.rooms.map((room) => {
            const liveRoom = rooms.find((r) => r.id === room.id);
            return liveRoom
              ? { ...room, userCount: liveRoom.userCount || 0 }
              : room;
          }),
        }))
      );
    });

    return () => unsubscribe();
  }, [user]);

  // Track user presence when joining/leaving rooms
  useEffect(() => {
    if (!user?.uid) return;

    // Join the new room
    if (activeRoomId) {
      joinRoom(activeRoomId, user.uid);
    }

    // Cleanup: leave the room when switching or unmounting
    return () => {
      if (activeRoomId) {
        leaveRoom(activeRoomId, user.uid);
      }
    };
  }, [activeRoomId, user?.uid]);

  // Load rooms from Firestore when sport tab changes
  useEffect(() => {
    if (!user) return;

    const loadRooms = async () => {
      try {
        const firestoreRooms = await getRoomsBySport(activeMarketId);
        setMarkets((prev) =>
          prev.map((market) =>
            market.id !== activeMarketId
              ? market
              : { ...market, rooms: firestoreRooms }
          )
        );
      } catch (err) {
        console.error("Failed to load rooms:", err);
      }
    };

    loadRooms();
  }, [activeMarketId, user]);

  // Calculate TOP SWEAT - room with most users across ALL sports
  // Uses allRooms from real-time subscription for accurate userCount
  const topSweatRoom = (() => {
    let topRoom = null;
    let topCount = 0;

    // Use allRooms from real-time subscription (has live userCount data)
    allRooms.forEach((room) => {
      const count = room.userCount || 0;
      // Room with most users wins - even 1 user beats 0
      if (count > topCount) {
        topCount = count;
        topRoom = room;
      }
    });

    // Return the top room if it has at least 1 user
    return topRoom && topCount >= 1 ? { ...topRoom, marketId: topRoom.sportId } : null;
  })();

  // Refs for managing TOP SWEAT transitions without getting cancelled
  const transitionTimeoutRef = useRef(null);
  const lastTopSweatIdRef = useRef(null);

  // Handle TOP SWEAT - show the room with most users, animate only on room CHANGE
  useEffect(() => {
    if (!user) return;

    // No room with users - keep showing whatever we have (don't clear)
    if (!topSweatRoom) return;

    const currentTopId = topSweatRoom.id;

    // First time ever OR same room - just show/update immediately
    if (!lastTopSweatIdRef.current || currentTopId === lastTopSweatIdRef.current) {
      lastTopSweatIdRef.current = currentTopId;
      setDisplayedTopSweat(topSweatRoom);
      setTopSweatPhase("idle");
      return;
    }

    // DIFFERENT room is taking the crown - do the dramatic transition
    // Clear any existing transition
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    // Capture the new room for the transition (avoid stale closure)
    const newTopRoom = { ...topSweatRoom };
    lastTopSweatIdRef.current = currentTopId;

    // Phase 1: Fade out current king
    setTopSweatPhase("fading-out");

    transitionTimeoutRef.current = setTimeout(() => {
      // Phase 2: Pause (tension builds)
      setTopSweatPhase("pause");

      transitionTimeoutRef.current = setTimeout(() => {
        // Phase 3: Fade in new king
        setDisplayedTopSweat(newTopRoom);
        setTopSweatPhase("fading-in");

        transitionTimeoutRef.current = setTimeout(() => {
          setTopSweatPhase("idle");
          transitionTimeoutRef.current = null;
        }, 1200);
      }, 800);
    }, 1000);

  }, [topSweatRoom?.id, user]);

  // Update displayed data when same room's user count changes (no animation)
  useEffect(() => {
    if (!topSweatRoom) return;
    if (topSweatRoom.id === displayedTopSweat?.id && topSweatPhase === "idle") {
      setDisplayedTopSweat(topSweatRoom);
    }
  }, [topSweatRoom?.userCount]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  // ------------------- EARLY RETURNS (after all hooks) -------------------

  if (!authReady) {
    return <div style={{ color: "white", padding: 20 }}>Loading...</div>;
  }

  if (!user) {
    return <AuthPage />;
  }

  // User is logged in but needs to create a username (social login)
  if (needsUsername) {
    return <UsernameSetup user={user} onComplete={refreshProfile} />;
  }

  // ------------------- COMPUTED VALUES -------------------

  // Get games for current sport tab
  const currentGames = gamesBySport[activeMarketId] || [];

  // Get live game data for active room (for SLIP STATUS)
  const activeGameId = activeRoom?.gameId;
  const liveGame = activeGameId ? getGameById(activeGameId) : null;

  // ------------------- HANDLER FUNCTIONS -------------------

  // Create room from a selected game
  const handleCreateRoom = async () => {
    if (!selectedGameId || !roomBetName.trim()) return;

    const game = getGameById(selectedGameId);
    if (!game) return;

    const newRoom = {
      id: `room-${Date.now()}`,
      gameId: selectedGameId,
      name: roomBetName.trim(),
      game: game.shortName,
      odds: roomOdds.trim() || "N/A",
      sportId: activeMarketId,
      createdBy: user?.uid || "anonymous",
    };

    try {
      // Save to Firestore
      await createRoomInFirestore(newRoom);

      // Add to local state
      setMarkets((prev) =>
        prev.map((market) =>
          market.id !== activeMarketId
            ? market
            : { ...market, rooms: [...market.rooms, newRoom] }
        )
      );

      // Select the new room
      setActiveRoomId(newRoom.id);

      // Award XP for creating a room
      if (user?.uid) {
        awardXP(user.uid, XP_REWARDS.CREATE_ROOM, "create_room").catch((err) =>
          console.error("XP award failed:", err)
        );
      }

      // Reset modal
      setShowCreateRoom(false);
      setSelectedGameId(null);
      setRoomBetName("");
      setRoomOdds("");
    } catch (err) {
      console.error("Failed to create room:", err);
    }
  };

  const handleSendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !activeRoomId) return;

    const username = (profile.displayName || "Guest").trim() || "Guest";

    // Clear input immediately for responsiveness
    setNewMessage("");
    setShowEmojiPicker(false);

    try {
      // Send to Firestore - real-time listener will update the UI
      await sendMessageToFirestore(activeRoomId, {
        username,
        text,
        oddie: profile.avatarEmoji, // User's emoji/avatar
        userId: user?.uid || null,
      });

      // Award XP for sending message (includes daily bonus check)
      if (user?.uid) {
        awardMessageXP(user.uid).catch((err) =>
          console.error("XP award failed:", err)
        );
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      // Restore message on error
      setNewMessage(text);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleAddEmoji = (emoji) => {
    setNewMessage((prev) => prev + emoji);
  };

  const handleMarketChange = (marketId) => {
    setFadeKey(Date.now());
    setActiveMarketId(marketId);
    const mk = markets.find((m) => m.id === marketId);
    if (mk && mk.rooms.length > 0) {
      const sorted = [...mk.rooms].sort((a, b) => b.userCount - a.userCount);
      setActiveRoomId(sorted[0].id);
    }
  };

  const handleRoomSelect = (roomId) => {
    setFadeKey(Date.now());
    setActiveRoomId(roomId);
  };

  const handleDeleteRoom = async (e, roomId) => {
    e.stopPropagation(); // Prevent room selection when clicking delete

    // Remove from local state immediately for responsiveness
    setMarkets((prev) =>
      prev.map((market) =>
        market.id !== activeMarketId
          ? market
          : { ...market, rooms: market.rooms.filter((r) => r.id !== roomId) }
      )
    );

    // If we deleted the active room, clear selection
    if (activeRoomId === roomId) {
      setActiveRoomId(null);
    }

    // Delete from Firestore
    try {
      await deleteRoomFromFirestore(roomId);
    } catch (err) {
      console.error("Failed to delete room from Firestore:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Navigate to TOP SWEAT room
  const handleTopSweatClick = () => {
    if (!displayedTopSweat) return;

    // Switch to the correct sport tab
    if (displayedTopSweat.marketId !== activeMarketId) {
      setActiveMarketId(displayedTopSweat.marketId);
    }

    // Select the room
    setFadeKey(Date.now());
    setActiveRoomId(displayedTopSweat.id);
  };

  //
  // ------------------- PROFILE HANDLERS -------------------
  //

  const openProfile = () => {
    // Navigate to the new profile page instead of opening the old sheet
    navigate("/profile");
  };

  // Legacy profile sheet opener (keep for backward compatibility)
  const openProfileSheet = () => {
    setDraftProfile(profile);
    setShowAvatarChoices(true);
    setIsProfileOpen(true);
  };

  const closeProfile = () => {
    setDraftProfile(profile);
    setIsProfileOpen(false);
  };

  const handleProfileFieldChange = (field, value) => {
    setDraftProfile((prev) => ({ ...prev, [field]: value }));
  };

  const saveProfile = () => {
    setProfile(draftProfile);
    setIsProfileOpen(false);
  };

  const handleProfileBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      closeProfile();
    }
  };

  //
  // ------------------- CHAT UTILS -------------------
  //

  // Navigate to user's profile when clicking their name in chat
  const handleUsernameClick = (userId) => {
    if (userId) {
      navigate(`/profile/${userId}`);
    }
  };

  const isTyping = newMessage.trim().length > 0;

  // group consecutive messages from same user
  const groupMessages = (msgs) => {
    const groups = [];
    let current = null;

    msgs.forEach((msg) => {
      const time = formatTime(msg.timestamp);
      const msgUser = msg.username || msg.user || "Anonymous"; // Handle both Firestore and legacy
      const msgUserId = msg.userId || null;
      if (!current || current.user !== msgUser) {
        current = {
          user: msgUser,
          userId: msgUserId, // Include userId for clickable usernames
          time,
          oddie: msg.oddie, // User's emoji
          messages: [],
        };
        groups.push(current);
      }
      current.messages.push(msg);
    });

    return groups;
  };

  //
  // ------------------- UI -------------------
  //

  // Main chat room content
  const mainAppContent = (
    <div className="app">
    {/* TOP SWEAT BANNER - King of the Hill */}
    <div
      className={`top-sweat-banner ${topSweatPhase}`}
      onClick={handleTopSweatClick}
      role="button"
      tabIndex={displayedTopSweat ? 0 : -1}
    >
      {/* Matrix rain background effect */}
      <div className="matrix-rain" aria-hidden="true">
        {Array.from({ length: 50 }).map((_, i) => (
          <span
            key={i}
            className="matrix-char"
            style={{
              left: `${(i * 2) % 100}%`,
              animationDelay: `${(i * 0.3) % 5}s`,
              animationDuration: `${3 + (i % 4)}s`,
            }}
          >
            {String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96))}
          </span>
        ))}
      </div>

      {/* Banner content */}
      <div className="top-sweat-content">
        {displayedTopSweat ? (
          <>
            <span className="top-sweat-crown">👑</span>
            <span className="top-sweat-label">TOP SWEAT</span>
            <span className="top-sweat-divider">·</span>
            <span className="top-sweat-room">{displayedTopSweat.name}</span>
            <span className="top-sweat-divider">·</span>
            <span className="top-sweat-game">{displayedTopSweat.game}</span>
            <span className="top-sweat-divider">·</span>
            <span className="top-sweat-odds">{displayedTopSweat.odds}</span>
            <span className="top-sweat-divider">·</span>
            <span className="top-sweat-users">
              {displayedTopSweat.userCount || 0} sweating
            </span>
          </>
        ) : topSweatPhase === "pause" ? (
          <span className="top-sweat-empty">...</span>
        ) : (
          <span className="top-sweat-waiting">Waiting for the first king...</span>
        )}
      </div>
    </div>

    <header className="app-header">
      <div className="brand-row">
        <h1>
          SLIPROOMS <span className="brand-emoji">V1</span>
        </h1>

        {/* Profile pill in header */}
        <button type="button" className="profile-pill" onClick={openProfile}>
          <span
            className={`profile-avatar profile-avatar-${profile.avatarColor}`}
          >
            {profile.avatarEmoji}
          </span>
          <span className="profile-pill-name">{profile.displayName}</span>
        </button>
        <button type="button" className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>

      <p>
        Live chat rooms for sweating bets together.
      </p>
    </header>

    <div className="layout">
      {/* Sidebar */}
      <aside className="rooms">
        <div className="market-tabs">
          {markets.map((market) => (
            <button
              key={market.id}
              className={
                market.id === activeMarketId
                  ? "market-tab active"
                  : "market-tab"
              }
              onClick={() => handleMarketChange(market.id)}
            >
              {market.label}
            </button>
          ))}
        </div>

        <div className="rooms-header">
          <h2>Rooms</h2>
          <button
            type="button"
            className="create-room-btn"
            onClick={() => setShowCreateRoom(true)}
            disabled={currentGames.length === 0}
          >
            + Create
          </button>
        </div>
        {activeMarket.rooms.length === 0 ? (
          <div className="empty-rooms">
            <p>No active rooms</p>
            <p className="empty-rooms-sub">
              {gamesLoading
                ? "Loading games..."
                : currentGames.length > 0
                ? `${currentGames.length} games available - create a room!`
                : "No games scheduled today"}
            </p>
          </div>
        ) : (
          <ul className="rooms-list">
            {activeMarket.rooms.map((room) => {
              const isActive = room.id === activeRoomId;
              return (
                <li
                  key={room.id}
                  className={isActive ? "room active" : "room"}
                  onClick={() => handleRoomSelect(room.id)}
                >
                  <div className="room-info">
                    <div className="room-name">{room.name}</div>
                    <div className="room-game">{room.game}</div>
                    <div className="room-odds">{room.odds}</div>
                    <div className="room-users">
                      {room.userCount || 0} {(room.userCount || 0) === 1 ? "user" : "users"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="room-delete-btn"
                    onClick={(e) => handleDeleteRoom(e, room.id)}
                    title="Delete room"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* Chat */}
      <main className="chat">
        {!activeRoom ? (
          <div className="empty-chat">
            <h2>No room selected</h2>
            <p>Select a room from the sidebar to start chatting</p>
          </div>
        ) : (
          <>
            <div className="chat-top">
              <div className="chat-header">
                <div className="chat-header-top">
                  <h2>{activeRoom.name}</h2>
                  <span className="chat-tag">Straight · 1-leg</span>
                </div>
                <p>
                  Game: <span className="highlight">{activeRoom.game}</span> · Odds:{" "}
                  <span className="highlight">{activeRoom.odds}</span>
                </p>
              </div>
            </div>

            <div
              key={fadeKey}
              className="messages fade-chat"
              ref={messagesContainerRef}
            >
              {groupMessages(activeMessages).map((cluster, index) => (
                <div key={index} className="message-cluster">
                  <div className="message-header">
                    {cluster.oddie && (
                      <span className="message-oddie">{cluster.oddie}</span>
                    )}
                    <span
                      className={`message-user ${cluster.userId ? "clickable" : ""}`}
                      onClick={() => cluster.userId && handleUsernameClick(cluster.userId)}
                      role={cluster.userId ? "button" : undefined}
                      tabIndex={cluster.userId ? 0 : undefined}
                    >
                      {cluster.user}
                    </span>
                    <span className="message-timestamp">{cluster.time}</span>
                  </div>

                  {cluster.messages.map((msg) => (
                    <div key={msg.id} className="message message-bubble">
                      <div className="message-text">{msg.text}</div>
                    </div>
                  ))}
              </div>
            ))}

            {isTyping && (
              <div className="typing-indicator">
                You’re typing… press Enter to send.
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="input-row">
            <button
              type="button"
              className="emoji-toggle"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
            >
              😀
            </button>

            <input
              type="text"
              placeholder="React to the sweat..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            <button type="button" onClick={handleSendMessage}>
              Send
            </button>
          </div>

          {showEmojiPicker && (
            <div className="emoji-picker">
              {emojiOptions.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleAddEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          </>
        )}
      </main>

      {/* LIVE GAMES PANEL */}
      <aside className="live-games-panel">
        <div className="live-games-header">
          <h2>Live Games</h2>
          <button type="button" className="refresh-btn" onClick={refreshGames}>
            Refresh
          </button>
        </div>

        {/* Featured Game - Current Room's Game */}
        {liveGame && (
          <div className="featured-game">
            <div className="featured-game-label">Current Room</div>
            <div className="featured-game-teams">
              <div className="featured-game-team">
                {liveGame.awayTeam?.logo && (
                  <img
                    src={liveGame.awayTeam.logo}
                    alt={liveGame.awayTeam.name}
                    className="featured-game-logo"
                  />
                )}
                <div className="featured-game-name">{liveGame.awayTeam?.name}</div>
                <div className="featured-game-score">{liveGame.awayTeam?.score}</div>
              </div>
              <div className="featured-game-team">
                {liveGame.homeTeam?.logo && (
                  <img
                    src={liveGame.homeTeam.logo}
                    alt={liveGame.homeTeam.name}
                    className="featured-game-logo"
                  />
                )}
                <div className="featured-game-name">{liveGame.homeTeam?.name}</div>
                <div className="featured-game-score">{liveGame.homeTeam?.score}</div>
              </div>
            </div>
            <div className={"featured-game-status" + (liveGame.isLive ? " is-live" : "")}>
              {liveGame.isLive && (
                <>
                  <span>{getPeriodLabel(activeMarketId, liveGame.status.period)}</span>
                  {liveGame.status.clock && <span>·</span>}
                  {liveGame.status.clock && <span>{liveGame.status.clock}</span>}
                </>
              )}
              {!liveGame.isLive && (
                <span>{liveGame.status.detail || liveGame.status.description}</span>
              )}
            </div>
          </div>
        )}

        {/* Other Games */}
        <div className="other-games-label">
          {activeMarket.label} Games Today
        </div>
        <div className="games-list">
          {currentGames.length === 0 ? (
            <div className="no-games">No games scheduled</div>
          ) : (
            currentGames
              .filter((g) => g.id !== activeGameId)
              .map((game) => (
                <div key={game.id} className="game-card">
                  <div className="game-card-row">
                    <div className="game-card-team">
                      {game.awayTeam?.logo && (
                        <img
                          src={game.awayTeam.logo}
                          alt={game.awayTeam.abbreviation}
                          className="game-card-logo"
                        />
                      )}
                      <span className="game-card-abbr">{game.awayTeam?.abbreviation}</span>
                    </div>
                    <span className="game-card-score">{game.awayTeam?.score}</span>
                    <span className={"game-card-status" + (game.isLive ? " is-live" : "")}>
                      {game.isLive
                        ? `${getPeriodLabel(activeMarketId, game.status.period)} ${game.status.clock || ""}`
                        : game.isFinal
                        ? "Final"
                        : new Date(game.date).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                    </span>
                  </div>
                  <div className="game-card-row">
                    <div className="game-card-team">
                      {game.homeTeam?.logo && (
                        <img
                          src={game.homeTeam.logo}
                          alt={game.homeTeam.abbreviation}
                          className="game-card-logo"
                        />
                      )}
                      <span className="game-card-abbr">{game.homeTeam?.abbreviation}</span>
                    </div>
                    <span className="game-card-score">{game.homeTeam?.score}</span>
                  </div>
                </div>
              ))
          )}
        </div>
      </aside>
    </div>

    {/* CREATE ROOM MODAL */}
    {showCreateRoom && (
      <div
        className="modal-overlay"
        onClick={(e) => e.target === e.currentTarget && setShowCreateRoom(false)}
      >
        <div className="modal-content create-room-modal">
          <h2>Create a Room</h2>
          <p className="modal-subtitle">Select a game and name your bet</p>

          <div className="game-select-list">
            {currentGames.length === 0 ? (
              <p className="no-games-msg">No games available for {activeMarket.label}</p>
            ) : (
              currentGames.map((game) => (
                <button
                  key={game.id}
                  type="button"
                  className={
                    "game-select-item" +
                    (selectedGameId === game.id ? " game-select-item-active" : "")
                  }
                  onClick={() => setSelectedGameId(game.id)}
                >
                  <div className="game-select-teams">
                    <span>{game.awayTeam?.abbreviation}</span>
                    <span className="game-select-at">@</span>
                    <span>{game.homeTeam?.abbreviation}</span>
                  </div>
                  <div className="game-select-status">
                    {game.isLive ? (
                      <span className="game-live-badge">
                        LIVE {game.awayTeam?.score}-{game.homeTeam?.score}
                      </span>
                    ) : game.isFinal ? (
                      <span className="game-final-badge">
                        FINAL {game.awayTeam?.score}-{game.homeTeam?.score}
                      </span>
                    ) : (
                      <span className="game-time">
                        {new Date(game.date).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {selectedGameId && (
            <div className="create-room-form">
              <label>
                Bet Name
                <input
                  type="text"
                  placeholder="e.g., Chiefs ML, Over 45.5"
                  value={roomBetName}
                  onChange={(e) => setRoomBetName(e.target.value)}
                />
              </label>
              <label>
                Odds (optional)
                <input
                  type="text"
                  placeholder="e.g., -110, +150"
                  value={roomOdds}
                  onChange={(e) => setRoomOdds(e.target.value)}
                />
              </label>
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="modal-btn modal-btn-secondary"
              onClick={() => {
                setShowCreateRoom(false);
                setSelectedGameId(null);
                setRoomBetName("");
                setRoomOdds("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="modal-btn modal-btn-primary"
              onClick={handleCreateRoom}
              disabled={!selectedGameId || !roomBetName.trim()}
            >
              Create Room
            </button>
          </div>
        </div>
      </div>
    )}

      {/* PROFILE SHEET */}
      {isProfileOpen && (
        <div
          className="profile-overlay profile-sheet-backdrop"
          onClick={handleProfileBackdropClick}
        >
          <div
            className="profile-panel profile-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="profile-back-button"
              onClick={closeProfile}
            >
              ← Back to room
            </button>

            <div className="profile-card">
              {/* Avatar + emoji choices */}
              <div className="profile-avatar-row">
                <button
                  type="button"
                  className={`profile-avatar-lg profile-avatar-${draftProfile.avatarColor}`}
                  onClick={() =>
                    setShowAvatarChoices((prevVisible) => !prevVisible)
                  }
                >
                  {draftProfile.avatarEmoji}
                </button>

                {showAvatarChoices && (
                  <div className="profile-emoji-choices">
                    {["🔥", "😭", "😅", "🤞", "🍀"].map((emo) => (
                      <button
                        key={emo}
                        type="button"
                        className={
                          "profile-emoji-choice" +
                          (draftProfile.avatarEmoji === emo
                            ? " profile-emoji-choice-active"
                            : "")
                        }
                        onClick={() => {
                          handleProfileFieldChange("avatarEmoji", emo);
                          setShowAvatarChoices(false);
                        }}
                      >
                        {emo}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fake stats */}
              <div className="profile-stats-row">
                <div className="profile-stat">
                  <div className="profile-stat-number">58%</div>
                  <div className="profile-stat-label">Hit rate</div>
                </div>
                <div className="profile-stat">
                  <div className="profile-stat-number">3x</div>
                  <div className="profile-stat-label">Best streak</div>
                </div>
                <div className="profile-stat">
                  <div className="profile-stat-number">42</div>
                  <div className="profile-stat-label">Slips sweated</div>
                </div>
              </div>

              {/* Display name */}
              <div className="profile-field-group">
                <label>
                  Display name
                  <input
                    type="text"
                    value={draftProfile.displayName}
                    onChange={(e) =>
                      handleProfileFieldChange("displayName", e.target.value)
                    }
                  />
                </label>
                <p className="profile-help">
                  This name will appear next to your messages.
                </p>
              </div>

              {/* Favorite market */}
              <div className="profile-field-group">
                <label>
                  Favorite market
                  <select
                    value={draftProfile.favoriteMarket}
                    onChange={(e) =>
                      handleProfileFieldChange("favoriteMarket", e.target.value)
                    }
                  >
                    <option value="NFL">NFL</option>
                    <option value="NBA">NBA</option>
                    <option value="MLB">MLB</option>
                  </select>
                </label>
              </div>

              {/* Bio */}
              <div className="profile-field-group">
                <label>
                  Bio
                  <textarea
                    rows="3"
                    value={draftProfile.bio}
                    onChange={(e) =>
                      handleProfileFieldChange("bio", e.target.value)
                    }
                  />
                </label>
              </div>

              {/* Avatar color */}
              <div className="profile-field-group">
                <span className="profile-section-label">Avatar color</span>
                <div className="profile-color-row">
                  {["blue", "green", "orange", "red", "purple"].map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={
                        "profile-color-swatch profile-avatar-" +
                        color +
                        (draftProfile.avatarColor === color
                          ? " profile-color-swatch-active"
                          : "")
                      }
                      onClick={() =>
                        handleProfileFieldChange("avatarColor", color)
                      }
                    />
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="profile-field-group">
                <span className="profile-section-label">Preferences</span>

                <div className="profile-toggle-row">
                  <div className="profile-toggle-text">
                    <div className="profile-toggle-title">Public profile</div>
                    <div className="profile-toggle-description">
                      When on, other users can find you later.
                    </div>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={draftProfile.publicProfile}
                      onChange={(e) =>
                        handleProfileFieldChange(
                          "publicProfile",
                          e.target.checked
                        )
                      }
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                <div className="profile-toggle-row">
                  <div className="profile-toggle-text">
                    <div className="profile-toggle-title">Notifications</div>
                    <div className="profile-toggle-description">
                      Fake for now – will matter in the meat phase.
                    </div>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={draftProfile.notifications}
                      onChange={(e) =>
                        handleProfileFieldChange(
                          "notifications",
                          e.target.checked
                        )
                      }
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                <div className="profile-toggle-row">
                  <div className="profile-toggle-text">
                    <div className="profile-toggle-title">Sound effects</div>
                    <div className="profile-toggle-description">
                      Little crowd noises when slips hit (later).
                    </div>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={draftProfile.soundEffects}
                      onChange={(e) =>
                        handleProfileFieldChange(
                          "soundEffects",
                          e.target.checked
                        )
                      }
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="profile-actions">
                <button
                  type="button"
                  className="profile-button profile-button-secondary"
                  onClick={closeProfile}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="profile-button profile-button-primary"
                  onClick={saveProfile}
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Return with Routes for navigation
  return (
    <Routes>
      <Route path="/profile/:userId" element={<ProfilePage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/" element={mainAppContent} />
    </Routes>
  );
}

export default App;
