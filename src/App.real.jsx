// src/App.jsx
import { useState, useEffect, useRef, useMemo } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import "./App.css";
import { useAuth } from "./contexts/AuthContext";
import { signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import "./pages/GamePage.css"; // Keep styles for the modal
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
  cleanupOnUnload,
} from "./services/chatService";
import {
  cleanupStalePresence,
} from "./services/presenceService";
import { submitRoom } from "./services/roomSubmissionsService";
import {
  subscribeToConversations,
  subscribeToMessages as subscribeToDMMessages,
  subscribeToUnreadCount,
  sendMessage as sendDM,
  getOrCreateConversation,
  markConversationAsRead,
} from "./services/dmService";
import { getFriends } from "./services/friendsService";
import { uploadChatImage } from "./services/imageService";
import { searchGifs, getTrendingGifs, getGifCategories } from "./services/gifService";
import {
  subscribeToActiveRooms,
  subscribeToTrendingRooms,
  getBettingCategories,
  COMMON_LINES,
  joinOrCreateRoom,
  subscribeToGameRooms,
  deleteRoom,
  archiveRoomsForGame,
  cleanupArchivedRooms,
  getAllRooms,
  bulkDeleteRooms,
} from "./services/roomService";
import {
  getPlayersForCategory,
  getTeamsForGame,
} from "./services/playerService";
import {
  checkText,
  logFilterViolation,
  preloadBannedWords,
} from "./services/filterService";
import {
  deleteMessage as adminDeleteMessage,
  muteUser,
  banUser,
} from "./services/adminService";
import {
  checkUsernameAvailable,
  reserveUsername,
} from "./services/accountService";



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
  { id: "ufc", label: "UFC", rooms: [] },
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

      // Check if username is available (case-insensitive)
      const { available } = await checkUsernameAvailable(username);
      if (!available) {
        setError("This username is already taken. Please choose another.");
        setLoading(false);
        return;
      }

      // Reserve the username first
      await reserveUsername(username, user.uid);

      // Then create the user document
      await setDoc(doc(db, "users", user.uid), {
        username: username.trim(),
        usernameLower: username.trim().toLowerCase(),
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

// Room search component
function RoomSearch({ allRooms, onSelectRoom, activeMarketId }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter and sort rooms based on query
  const filteredRooms = useMemo(() => {
    if (!query.trim()) return [];

    const searchTerms = query.toLowerCase().trim().split(/\s+/);

    return allRooms
      .filter((room) => {
        // Build searchable text from room properties
        const searchableText = [
          room.name || "",
          room.game || "",
          // Extract team names/abbreviations from game string (e.g., "NYK @ BOS")
          ...(room.game || "").split(/[@vs\s]+/),
        ]
          .join(" ")
          .toLowerCase();

        // All search terms must match somewhere in the searchable text
        return searchTerms.every((term) => searchableText.includes(term));
      })
      .sort((a, b) => (b.userCount || 0) - (a.userCount || 0))
      .slice(0, 10); // Limit to 10 results
  }, [query, allRooms]);

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setIsOpen(e.target.value.trim().length > 0);
  };

  const handleSelectRoom = (room) => {
    onSelectRoom(room);
    setQuery("");
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setQuery("");
    }
  };

  return (
    <div className="room-search">
      <input
        ref={inputRef}
        type="text"
        className="room-search-input"
        placeholder="Search rooms..."
        value={query}
        onChange={handleInputChange}
        onFocus={() => query.trim() && setIsOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {isOpen && (
        <div ref={dropdownRef} className="room-search-dropdown">
          {filteredRooms.length === 0 ? (
            <div className="room-search-empty">
              No rooms found for "{query}"
            </div>
          ) : (
            filteredRooms.map((room) => (
              <button
                key={room.id}
                type="button"
                className={`room-search-item ${room.sportId === activeMarketId ? "same-sport" : ""}`}
                onClick={() => handleSelectRoom(room)}
              >
                <div className="room-search-item-info">
                  <div className="room-search-item-name">{room.name}</div>
                  <div className="room-search-item-game">{room.game}</div>
                </div>
                <div className="room-search-item-users">
                  {room.userCount || 0} sweating
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function App() {
  const { user, userProfile, authReady, needsUsername, refreshProfile, isAdmin } = useAuth();
  const navigate = useNavigate();

  // ESPN games hook
  const { gamesBySport, loading: gamesLoading, getGameById, refresh: refreshGames, getActiveGames, getRecentGames, getLiveGamesForSport, getUpcomingGames } = useGames();

  // All hooks must be called unconditionally at the top
  const [markets, setMarkets] = useState(initialMarkets);
  const [activeMarketId, setActiveMarketId] = useState(initialMarkets[0].id);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [filterError, setFilterError] = useState(null); // For profanity filter messages

  // Media (image/GIF) state
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearchQuery, setGifSearchQuery] = useState("");
  const [gifResults, setGifResults] = useState([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const fileInputRef = useRef(null);

  // Create room modal state (for admins)
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [roomBetName, setRoomBetName] = useState("");
  const [roomOdds, setRoomOdds] = useState("");

  // Submit room modal state (for non-admin users)
  const [showSubmitRoom, setShowSubmitRoom] = useState(false);
  const [submitSport, setSubmitSport] = useState("nfl");
  const [submitGameId, setSubmitGameId] = useState(null);
  const [submitProp, setSubmitProp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // DM (Direct Message) state
  const [showDMInbox, setShowDMInbox] = useState(false);
  const [dmConversations, setDmConversations] = useState([]);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const [activeDMConversation, setActiveDMConversation] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);
  const [dmInput, setDmInput] = useState("");
  const [dmFriends, setDmFriends] = useState([]);
  const [showNewDM, setShowNewDM] = useState(false);
  const dmMessagesEndRef = useRef(null);

  // Mobile navigation state
  const [mobileView, setMobileView] = useState("rooms"); // "rooms" | "chat" | "games"
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // profile state - will be updated when userProfile loads
  const [profile, setProfile] = useState(defaultProfile);
  const [draftProfile, setDraftProfile] = useState(defaultProfile);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showAvatarChoices, setShowAvatarChoices] = useState(true);

  // for soft fade transitions on room change
  const [fadeKey, setFadeKey] = useState(0);

  // Real-time messages from Firestore
  const [liveMessages, setLiveMessages] = useState([]);

  // TOP SWEAT banner state (for transition effects)
  const [displayedTopSweat, setDisplayedTopSweat] = useState(null);
  const [topSweatPhase, setTopSweatPhase] = useState("idle"); // "idle" | "fading-out" | "pause" | "fading-in"
  const [allRooms, setAllRooms] = useState([]); // All rooms across all sports for TOP SWEAT

  // Trending rooms from the new room system (heat map)
  const [trendingRooms, setTrendingRooms] = useState([]);

  // Game Modal State (betting menu popup)
  const [gameModalData, setGameModalData] = useState(null); // The game data for the modal
  const [showPropBuilder, setShowPropBuilder] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [builderStep, setBuilderStep] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedStat, setSelectedStat] = useState(null);
  const [selectedLine, setSelectedLine] = useState("");
  const [customLine, setCustomLine] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [modalPlayers, setModalPlayers] = useState([]);
  const [modalPlayersLoading, setModalPlayersLoading] = useState(false);
  const [modalPlayersError, setModalPlayersError] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState(""); // For filtering player list
  const [gameRoomsForModal, setGameRoomsForModal] = useState([]);

  // Admin contextual controls state
  const [adminUserDropdown, setAdminUserDropdown] = useState(null); // { userId, username, position: { x, y } }
  const [adminMuteModal, setAdminMuteModal] = useState(null); // { userId, username }
  const [adminBanModal, setAdminBanModal] = useState(null); // { userId, username }
  const [adminMuteDuration, setAdminMuteDuration] = useState(60); // minutes
  const [adminBanDuration, setAdminBanDuration] = useState(1440); // minutes (24h)

  // refs for smart auto-scroll
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Compute these early so useEffects can use them
  const activeMarket = markets.find((m) => m.id === activeMarketId) || markets[0];
  const activeRoom = activeRoomId
    ? (activeMarket.rooms.find((r) => r.id === activeRoomId) || trendingRooms.find((r) => r.id === activeRoomId))
    : null;
  // Use live messages from Firestore instead of local state
  const activeMessages = liveMessages;

  // Preload banned words cache on mount
  useEffect(() => {
    preloadBannedWords().catch(console.error);
  }, []);

  // Auto scroll effect
  useEffect(() => {
    if (!user || !activeRoom) return;
    const el = messagesContainerRef.current;
    const isNearBottom = !el || el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
    if (isNearBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeRoomId, activeMessages.length, user, activeRoom]);

  // Close admin dropdown when clicking outside
  useEffect(() => {
    if (!adminUserDropdown) return;
    const handleClickOutside = () => setAdminUserDropdown(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [adminUserDropdown]);

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

    // Subscribe to messages - this returns an unsubscribe function
    const unsubscribe = subscribeToMessages(activeRoomId, (messages) => {
      setLiveMessages(messages);
    });

    // Cleanup: unsubscribe when room changes or component unmounts
    return () => {
      unsubscribe();
    };
  }, [activeRoomId, user]);

  // Subscribe to trending rooms from new room system (heat map)
  // Filter by the currently selected sport tab
  // Shows top 100 rooms sorted by user count
  useEffect(() => {
    const unsubscribe = subscribeToTrendingRooms((rooms) => {
      setTrendingRooms(rooms);
    }, 100, activeMarketId);
    return () => unsubscribe();
  }, [activeMarketId]);

  // Subscribe to game rooms when modal is open
  useEffect(() => {
    if (!gameModalData?.id) return;
    const unsubscribe = subscribeToGameRooms(gameModalData.id, setGameRoomsForModal);
    return () => unsubscribe();
  }, [gameModalData?.id]);

  // Load players when category is selected in modal
  useEffect(() => {
    if (!selectedCategory || !selectedCategory.requiresPlayer || !gameModalData) {
      setModalPlayers([]);
      return;
    }

    async function loadPlayers() {
      setModalPlayersLoading(true);
      setModalPlayersError(false);
      setModalPlayers([]);

      try {
        const sport = gameModalData?.sport || "nfl";
        const fetchedPlayers = await getPlayersForCategory(sport, gameModalData, selectedCategory);
        if (fetchedPlayers.length > 0) {
          setModalPlayers(fetchedPlayers);
        } else {
          setModalPlayersError(true);
        }
      } catch (error) {
        console.error("Error loading players:", error);
        setModalPlayersError(true);
      } finally {
        setModalPlayersLoading(false);
      }
    }

    loadPlayers();
  }, [selectedCategory, gameModalData]);

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
    console.log("[App] Presence useEffect triggered - activeRoomId:", activeRoomId, "user:", user?.uid);

    if (!user?.uid) {
      console.log("[App] No user, skipping presence");
      return;
    }

    // Join the new room
    if (activeRoomId) {
      console.log("[App] Calling joinRoom for:", activeRoomId);
      joinRoom(activeRoomId, user.uid);
    }

    // Cleanup: leave the room when switching or unmounting
    return () => {
      if (activeRoomId) {
        console.log("[App] Cleanup - leaving room:", activeRoomId);
        leaveRoom(activeRoomId, user.uid);
      }
    };
  }, [activeRoomId, user?.uid]);

  // Presence cleanup: periodically clean stale users (no initial sync - just periodic cleanup)
  useEffect(() => {
    if (!user) return;

    // Periodic cleanup every 60 seconds to remove stale users
    const cleanupInterval = setInterval(() => {
      console.log("[Presence] Running periodic cleanup");
      cleanupStalePresence();
    }, 60000);

    // Cleanup on page unload
    const handleUnload = () => {
      cleanupOnUnload();
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(cleanupInterval);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [user]);

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

    // No room with users - clear the display to show "Waiting for the first king..."
    if (!topSweatRoom) {
      // Only clear if we had something displayed
      if (displayedTopSweat) {
        setTopSweatPhase("fading-out");
        const timeout = setTimeout(() => {
          setDisplayedTopSweat(null);
          lastTopSweatIdRef.current = null;
          setTopSweatPhase("idle");
        }, 1000);
        return () => clearTimeout(timeout);
      }
      return;
    }

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

  // ------------------- DM SUBSCRIPTIONS -------------------

  // Subscribe to DM conversations and unread count
  useEffect(() => {
    if (!user?.uid) return;

    const unsubConversations = subscribeToConversations(user.uid, (conversations) => {
      setDmConversations(conversations);
    });

    const unsubUnread = subscribeToUnreadCount(user.uid, (count) => {
      setDmUnreadCount(count);
    });

    return () => {
      unsubConversations();
      unsubUnread();
    };
  }, [user?.uid]);

  // Subscribe to messages when a conversation is active
  useEffect(() => {
    if (!activeDMConversation) {
      setDmMessages([]);
      return;
    }

    const unsubMessages = subscribeToDMMessages(activeDMConversation.id, (messages) => {
      setDmMessages(messages);
    });

    // Mark as read when opening conversation
    if (user?.uid) {
      markConversationAsRead(activeDMConversation.id, user.uid);
    }

    return () => unsubMessages();
  }, [activeDMConversation?.id, user?.uid]);

  // Load friends list for new DM modal
  useEffect(() => {
    async function loadFriends() {
      if (!user?.uid || !showNewDM) return;
      try {
        const friends = await getFriends(user.uid);
        setDmFriends(friends);
      } catch (err) {
        console.error("Failed to load friends:", err);
      }
    }
    loadFriends();
  }, [user?.uid, showNewDM]);

  // Auto-scroll DM messages to bottom
  useEffect(() => {
    if (dmMessagesEndRef.current) {
      dmMessagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [dmMessages]);

  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Switch to chat view when a room is selected on mobile
  useEffect(() => {
    if (isMobile && activeRoomId) {
      setMobileView("chat");
    }
  }, [activeRoomId, isMobile]);

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

  // Filtered games for Live Games panel (no finals, properly sorted)
  const activeGames = getActiveGames(activeMarketId);

  // Recently ended games (within last 2 hours)
  const recentGames = getRecentGames(activeMarketId);

  // Live games (in progress right now)
  const liveNowGames = getLiveGamesForSport(activeMarketId);

  // Upcoming games (scheduled, sorted by date/time)
  const upcomingGames = getUpcomingGames(activeMarketId);

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

  // Submit room for approval (non-admin users)
  const handleSubmitRoom = async () => {
    if (!submitGameId || !submitProp.trim()) return;

    const game = getGameById(submitGameId);
    if (!game) return;

    setSubmitting(true);
    try {
      await submitRoom({
        oddie: profile.avatarEmoji,
        oddiename: profile.displayName || "Guest",
        oddieid: user?.uid || null,
        sport: submitSport,
        game: game.shortName,
        gameId: submitGameId,
        prop: submitProp.trim().toUpperCase(),
      });

      // Show success message
      setSubmitSuccess(true);

      // Reset form after delay
      setTimeout(() => {
        setShowSubmitRoom(false);
        setSubmitSuccess(false);
        setSubmitSport("nfl");
        setSubmitGameId(null);
        setSubmitProp("");
      }, 2000);
    } catch (err) {
      console.error("Failed to submit room:", err);
      console.error("Error code:", err.code);
      console.error("Error message:", err.message);
      alert(`Failed to submit room: ${err.message || "Unknown error"}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Get games for submission modal sport
  const submitGames = gamesBySport[submitSport] || [];

  // ------------------- DM HANDLERS -------------------

  // Open a conversation with a friend
  const openDMWithFriend = async (friend) => {
    try {
      const conversation = await getOrCreateConversation(
        user.uid,
        friend.id,
        { username: profile.displayName, avatarEmoji: profile.avatarEmoji, profilePicture: profile.profilePicture },
        { username: friend.username, avatarEmoji: friend.avatarEmoji, profilePicture: friend.profilePicture }
      );
      setActiveDMConversation({
        ...conversation,
        otherUser: friend,
      });
      setShowNewDM(false);
    } catch (err) {
      console.error("Failed to open DM:", err);
    }
  };

  // Open existing conversation
  const openDMConversation = (conversation) => {
    const otherUserId = conversation.participants.find((id) => id !== user.uid);
    const otherUserData = conversation.participantData?.[otherUserId] || {};
    setActiveDMConversation({
      ...conversation,
      otherUser: {
        id: otherUserId,
        ...otherUserData,
      },
    });
  };

  // Send a DM message
  const handleSendDM = async () => {
    const text = dmInput.trim();
    if (!text || !activeDMConversation) return;

    setDmInput("");
    try {
      await sendDM(activeDMConversation.id, user.uid, text);
    } catch (err) {
      console.error("Failed to send DM:", err);
      setDmInput(text);
    }
  };

  // Handle DM input key press
  const handleDMKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendDM();
    }
  };

  // Close DM chat and go back to inbox
  const closeDMChat = () => {
    setActiveDMConversation(null);
    setDmMessages([]);
    setDmInput("");
  };

  // Format DM timestamp
  const formatDMTime = (date) => {
    if (!date) return "";
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const handleSendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !activeRoomId) return;

    const username = (profile.displayName || "Guest").trim() || "Guest";

    // Check profanity filter
    try {
      const filterResult = await checkText(text);
      if (!filterResult.isClean) {
        setFilterError("Your message contains inappropriate language and was not sent.");
        // Log the violation
        if (user?.uid) {
          logFilterViolation(user.uid, username, text, filterResult.matchedWord, "chat").catch(console.error);
        }
        // Auto-clear error after 5 seconds
        setTimeout(() => setFilterError(null), 5000);
        return;
      }
    } catch (filterErr) {
      console.error("Filter check failed:", filterErr);
      // If filter check fails, allow message (fail open for better UX)
    }

    // Clear input immediately for responsiveness
    setNewMessage("");
    setShowEmojiPicker(false);
    setFilterError(null);

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

  // ------------------- MEDIA HANDLERS -------------------

  // Handle image file selection
  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeRoomId) return;

    const username = (profile.displayName || "Guest").trim() || "Guest";

    try {
      setUploadProgress(0);
      setShowMediaMenu(false);

      // Upload image
      const imageUrl = await uploadChatImage(
        file,
        activeRoomId,
        profile.avatarEmoji,
        (progress) => setUploadProgress(progress)
      );

      // Send image message
      await sendMessageToFirestore(activeRoomId, {
        type: "image",
        imageUrl,
        username,
        oddie: profile.avatarEmoji,
        userId: user?.uid || null,
      });

      // Award XP
      if (user?.uid) {
        awardMessageXP(user.uid).catch((err) =>
          console.error("XP award failed:", err)
        );
      }
    } catch (err) {
      console.error("Failed to upload image:", err);
      alert(err.message || "Failed to upload image");
    } finally {
      setUploadProgress(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Open GIF picker and load trending GIFs
  const handleOpenGifPicker = async () => {
    setShowMediaMenu(false);
    setShowGifPicker(true);
    setGifSearchQuery("");
    setGifLoading(true);

    try {
      const trending = await getTrendingGifs(20);
      setGifResults(trending);
    } catch (err) {
      console.error("Failed to load GIFs:", err);
    } finally {
      setGifLoading(false);
    }
  };

  // Search for GIFs
  const handleGifSearch = async (query) => {
    setGifSearchQuery(query);
    setGifLoading(true);

    try {
      const results = await searchGifs(query, 20);
      setGifResults(results);
    } catch (err) {
      console.error("GIF search failed:", err);
    } finally {
      setGifLoading(false);
    }
  };

  // Send a GIF message
  const handleSendGif = async (gif) => {
    if (!activeRoomId) return;

    const username = (profile.displayName || "Guest").trim() || "Guest";

    try {
      setShowGifPicker(false);

      await sendMessageToFirestore(activeRoomId, {
        type: "gif",
        gifUrl: gif.url,
        username,
        oddie: profile.avatarEmoji,
        userId: user?.uid || null,
      });

      // Award XP
      if (user?.uid) {
        awardMessageXP(user.uid).catch((err) =>
          console.error("XP award failed:", err)
        );
      }
    } catch (err) {
      console.error("Failed to send GIF:", err);
    }
  };

  // Quick category search
  const handleGifCategory = (query) => {
    handleGifSearch(query);
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
    // On mobile, always switch to chat view when selecting a room (even if already selected)
    if (isMobile) {
      setMobileView("chat");
    }
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

  // ============ GAME MODAL HANDLERS ============

  // Open game modal
  const openGameModal = (gameData) => {
    setGameModalData(gameData);
  };

  // Close game modal and reset state
  const closeGameModal = () => {
    setGameModalData(null);
    setShowPropBuilder(false);
    setSelectedCategory(null);
    setBuilderStep(1);
    setSelectedPlayer(null);
    setSelectedStat(null);
    setSelectedLine("");
    setCustomLine("");
    setModalPlayers([]);
    setModalPlayersError(false);
    setGameRoomsForModal([]);
  };

  // Handle category click in modal
  const handleModalCategoryClick = (category) => {
    if (category.isTrending) {
      // Scroll to active rooms section
      const activeRoomsSection = document.querySelector(".game-active-rooms");
      if (activeRoomsSection) {
        activeRoomsSection.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }

    setSelectedCategory(category);
    setShowPropBuilder(true);
    setModalPlayers([]);
    setModalPlayersError(false);

    // For team-based props (game lines), skip player selection
    if (category.teamBased || !category.requiresPlayer) {
      setBuilderStep(2);
      setSelectedPlayer(null);
    } else {
      setBuilderStep(1);
    }

    setSelectedStat(null);
    setSelectedLine("");
    setCustomLine("");
  };

  // Handle player selection
  const handleModalPlayerSelect = async (player) => {
    setSelectedPlayer(player);

    // For directPick categories (UFC Fight Winner), create room immediately
    if (selectedCategory?.directPick) {
      // If category has only 1 stat, use it directly and create room
      if (selectedCategory.stats?.length === 1) {
        const stat = selectedCategory.stats[0];
        await createDirectPickRoom(player, stat);
        return;
      }
      // If multiple stats (Method of Victory), go to stat selection but skip line
      setBuilderStep(2);
      return;
    }

    setBuilderStep(2);
  };

  // Create room directly for directPick categories (UFC)
  const createDirectPickRoom = async (player, stat) => {
    setIsCreatingRoom(true);
    try {
      const sport = gameModalData?.sport || "ufc";
      const gameName = gameModalData?.name || gameModalData?.shortName || "UFC Fight";

      const result = await joinOrCreateRoom({
        gameId: gameModalData?.id,
        gameName,
        playerId: player.id || player.name,
        playerName: player.name,
        stat,
        line: "", // No line for direct picks
        direction: "WIN", // Default direction for winners
        sport,
      });

      // Navigate to the room
      closeGameModal();
      setActiveRoomId(result.roomId);
      if (isMobile) setMobileView("chat");
    } catch (error) {
      console.error("Error creating direct pick room:", error);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Handle team selection (for game lines)
  const handleModalTeamSelect = (team) => {
    setSelectedPlayer({ name: team.name, team: team.name, abbrev: team.abbrev, isTeam: true });
    setBuilderStep(2);
  };

  // Handle direct game line selection (one-click room creation)
  const handleGameLineSelect = async (betType, teamOrDirection, line = null) => {
    setIsCreatingRoom(true);
    try {
      // Validate game data
      if (!gameModalData?.id) {
        throw new Error("No game data available");
      }

      const sport = gameModalData?.sport || "nfl";
      const awayTeam = gameModalData?.away?.name || gameModalData?.away?.abbrev || "AWAY";
      const homeTeam = gameModalData?.home?.name || gameModalData?.home?.abbrev || "HOME";
      const gameName = `${awayTeam} vs ${homeTeam}`;

      let playerName, playerId, stat, direction, lineValue;

      if (betType === "spread") {
        // teamOrDirection is the team object
        const team = teamOrDirection;
        if (!team || !team.name) {
          throw new Error("Invalid team data for spread");
        }
        const spreadLine = line !== null ? line : (team.isHome ? -3.5 : 3.5);
        const spreadDisplay = spreadLine > 0 ? `+${spreadLine}` : String(spreadLine);
        playerName = team.name;
        playerId = team.abbrev || team.name;
        stat = "Spread";
        lineValue = spreadDisplay;
        direction = "COVERS";
      } else if (betType === "moneyline") {
        // teamOrDirection is the team object
        const team = teamOrDirection;
        if (!team || !team.name) {
          throw new Error("Invalid team data for moneyline");
        }
        playerName = team.name;
        playerId = team.abbrev || team.name;
        stat = "Moneyline";
        lineValue = "WIN";
        direction = "YES";
      } else if (betType === "total") {
        // teamOrDirection is "OVER" or "UNDER"
        playerName = gameName;
        playerId = "TOTAL";
        stat = "Total";
        lineValue = String(line || 215.5);
        direction = teamOrDirection;
      } else {
        throw new Error(`Unknown bet type: ${betType}`);
      }

      console.log("Creating game line room:", { gameId: gameModalData?.id, playerId, playerName, stat, lineValue, direction });

      const result = await joinOrCreateRoom({
        gameId: gameModalData?.id,
        gameName,
        playerId,
        playerName,
        stat,
        line: lineValue,
        direction,
        sport,
      });

      closeGameModal();
      setActiveRoomId(result.roomId);
      if (isMobile) {
        setMobileView("chat");
      }
    } catch (error) {
      console.error("Error creating game line room:", error);
      console.error("Debug data:", { betType, teamOrDirection, line, gameModalData: gameModalData?.id });
      alert(`Failed to create room: ${error.message}`);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Handle stat selection
  const handleModalStatSelect = async (stat) => {
    setSelectedStat(stat);

    // For directPick categories (UFC Method of Victory), create room directly
    if (selectedCategory?.directPick && selectedPlayer) {
      await createDirectPickRoom(selectedPlayer, stat);
      return;
    }

    if (stat === "Moneyline" || stat === "Draw") {
      setSelectedLine("YES");
      setBuilderStep(4);
    } else {
      setBuilderStep(3);
    }
  };

  // Handle line selection (legacy - for custom line input)
  const handleModalLineSelect = (line) => {
    setSelectedLine(line);
    setBuilderStep(4);
  };

  // Handle combined line + direction selection (one-click prop creation)
  const handlePropLineSelect = async (line, direction) => {
    setIsCreatingRoom(true);
    setSelectedLine(line);

    try {
      // Validate required data
      if (!selectedPlayer) {
        throw new Error("No player selected");
      }
      if (!selectedStat) {
        throw new Error("No stat selected");
      }
      if (!gameModalData?.id) {
        throw new Error("No game data");
      }

      const isTeam = selectedPlayer?.isTeam;
      const playerId = isTeam
        ? selectedPlayer.abbrev || selectedPlayer.name
        : selectedPlayer?.id || selectedPlayer?.name;
      const playerName = isTeam
        ? selectedPlayer.name
        : selectedPlayer
        ? `${selectedPlayer.name}${selectedPlayer.team ? ` (${selectedPlayer.team})` : ""}`
        : gameModalData?.home?.name || "TEAM";

      console.log("Creating prop room:", { gameId: gameModalData?.id, playerId, playerName, stat: selectedStat, line, direction });

      // Generate game name based on sport type
      const gameName = gameModalData?.isIndividualSport
        ? gameModalData?.shortName || gameModalData?.name || "Event"
        : `${gameModalData?.away?.name || gameModalData?.away?.abbrev || "AWAY"} vs ${gameModalData?.home?.name || gameModalData?.home?.abbrev || "HOME"}`;

      const result = await joinOrCreateRoom({
        gameId: gameModalData?.id,
        gameName,
        playerId,
        playerName,
        stat: selectedStat,
        line: line,
        direction,
        sport: gameModalData?.sport || "nfl",
      });

      closeGameModal();
      setActiveRoomId(result.roomId);
      if (isMobile) {
        setMobileView("chat");
      }
    } catch (error) {
      console.error("Error creating prop room:", error);
      console.error("Debug data:", { selectedPlayer, selectedStat, gameModalData: gameModalData?.id, line, direction });
      alert(`Failed to create room: ${error.message}`);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Handle direction selection and create/join room
  const handleModalDirectionSelect = async (direction) => {
    setIsCreatingRoom(true);

    try {
      // For teams, use team abbreviation for ID but full name for display
      // For players, use ESPN player ID for uniqueness, display name for UI
      const isTeam = selectedPlayer?.isTeam;
      const playerId = isTeam
        ? selectedPlayer.abbrev || selectedPlayer.name // Team abbrev as ID
        : selectedPlayer?.id || selectedPlayer?.name; // ESPN player ID
      const playerName = isTeam
        ? selectedPlayer.name // Full team name
        : selectedPlayer
        ? `${selectedPlayer.name}${selectedPlayer.team ? ` (${selectedPlayer.team})` : ""}`
        : gameModalData?.home?.name || "TEAM";

      // Generate game name based on sport type
      const gameName = gameModalData?.isIndividualSport
        ? gameModalData?.shortName || gameModalData?.name || "Event"
        : `${gameModalData?.away?.name || gameModalData?.away?.abbrev || "AWAY"} vs ${gameModalData?.home?.name || gameModalData?.home?.abbrev || "HOME"}`;

      const result = await joinOrCreateRoom({
        gameId: gameModalData?.id,
        gameName,
        playerId, // Use player ID for room ID uniqueness
        playerName, // Use display name for room title
        stat: selectedStat,
        line: selectedLine,
        direction,
        sport: gameModalData?.sport || "nfl",
      });

      // Close modal and select the room
      closeGameModal();
      setActiveRoomId(result.roomId);
      if (isMobile) {
        setMobileView("chat");
      }
    } catch (error) {
      console.error("Error creating/joining room:", error);
      alert("Failed to create room. Please try again.");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Close prop builder within modal
  const closeModalPropBuilder = () => {
    setShowPropBuilder(false);
    setSelectedCategory(null);
    setBuilderStep(1);
    setSelectedPlayer(null);
    setSelectedStat(null);
    setSelectedLine("");
    setCustomLine("");
    setModalPlayers([]);
    setModalPlayersError(false);
    setPlayerSearchQuery("");
  };

  // Go back a step in prop builder
  const goBackModalStep = () => {
    if (builderStep === 1 || (builderStep === 2 && !selectedCategory?.requiresPlayer)) {
      closeModalPropBuilder();
    } else if (builderStep === 2) {
      setBuilderStep(1);
      setSelectedPlayer(null);
    } else if (builderStep === 3) {
      setBuilderStep(2);
      setSelectedStat(null);
    } else if (builderStep === 4) {
      if (selectedStat === "Moneyline" || selectedStat === "Draw") {
        setBuilderStep(2);
        setSelectedStat(null);
      } else {
        setBuilderStep(3);
      }
      setSelectedLine("");
    }
  };

  // ============ END GAME MODAL HANDLERS ============

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

  // Handle room selection from search
  const handleSearchSelectRoom = (room) => {
    // Switch to the correct sport tab if needed
    if (room.sportId !== activeMarketId) {
      setActiveMarketId(room.sportId);
    }

    // Select the room
    setFadeKey(Date.now());
    setActiveRoomId(room.id);
  };

  //
  // ------------------- PROFILE HANDLERS -------------------
  //

  const openProfile = () => {
    // Navigate to the new profile page instead of opening the old sheet
    navigate("/profile");
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

  // Admin: Show user action dropdown on right-click
  const handleUsernameContextMenu = (e, userId, username) => {
    if (!isAdmin || !userId) return;
    e.preventDefault();
    const rect = e.currentTarget?.getBoundingClientRect();
    setAdminUserDropdown({
      userId,
      username,
      position: {
        x: rect?.left || e.clientX || 100,
        y: (rect?.bottom || e.clientY || 100) + 5
      },
    });
  };

  // Admin: Delete a message
  const handleAdminDeleteMessage = async (messageId) => {
    if (!isAdmin || !activeRoomId) return;
    try {
      await adminDeleteMessage(activeRoomId, messageId, user.uid);
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  };

  // Admin: Open mute modal
  const openAdminMuteModal = (userId, username) => {
    setAdminUserDropdown(null);
    setAdminMuteModal({ userId, username });
  };

  // Admin: Open ban modal
  const openAdminBanModal = (userId, username) => {
    setAdminUserDropdown(null);
    setAdminBanModal({ userId, username });
  };

  // Admin: Mute user
  const handleAdminMuteUser = async () => {
    if (!adminMuteModal) return;
    try {
      await muteUser(adminMuteModal.userId, adminMuteDuration, user.uid, "");
      setAdminMuteModal(null);
      setAdminMuteDuration(60);
    } catch (error) {
      console.error("Failed to mute user:", error);
    }
  };

  // Admin: Ban user
  const handleAdminBanUser = async () => {
    if (!adminBanModal) return;
    try {
      await banUser(adminBanModal.userId, adminBanDuration, user.uid, "");
      setAdminBanModal(null);
      setAdminBanDuration(1440);
    } catch (error) {
      console.error("Failed to ban user:", error);
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
        {/* Left side: Logo + Admin + DM */}
        <div className="header-left">
          <h1>SLIPROOMS</h1>

          {/* Admin and DM buttons next to logo */}
          <div className="header-left-btns">
            {isAdmin && (
              <button type="button" className="admin-btn" onClick={() => navigate("/admin")}>
                🛡️ Admin
              </button>
            )}
            <button type="button" className="dm-btn" onClick={() => setShowDMInbox(true)}>
              📬
              {dmUnreadCount > 0 && (
                <span className="dm-badge">{dmUnreadCount > 9 ? "9+" : dmUnreadCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* Right side: User + Logout (far right) - Desktop only */}
        <div className="header-right">
          <button type="button" className="profile-pill" onClick={openProfile}>
            {userProfile?.profilePicture ? (
              <img src={userProfile.profilePicture} alt="" className="profile-pill-img" />
            ) : (
              <span className={`profile-avatar profile-avatar-${profile.avatarColor}`}>
                {profile.avatarEmoji}
              </span>
            )}
            <span className="profile-pill-name">{profile.displayName}</span>
          </button>
          <button type="button" className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>

        {/* Mobile: Just avatar button that opens dropdown */}
        <div className="header-mobile-controls">
          {/* DM badge indicator (subtle) */}
          {dmUnreadCount > 0 && (
            <button
              type="button"
              className="mobile-dm-indicator"
              onClick={() => setShowDMInbox(true)}
            >
              📬 <span className="mobile-dm-count">{dmUnreadCount > 9 ? "9+" : dmUnreadCount}</span>
            </button>
          )}

          {/* Avatar button - opens dropdown menu */}
          <button
            type="button"
            className="mobile-avatar-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Open menu"
          >
            {userProfile?.profilePicture ? (
              <img src={userProfile.profilePicture} alt="" className="mobile-avatar-img" />
            ) : (
              <span className={`profile-avatar profile-avatar-${profile.avatarColor}`}>
                {profile.avatarEmoji}
              </span>
            )}
          </button>

          {/* Dropdown menu */}
          {mobileMenuOpen && (
            <div className="mobile-dropdown" onClick={(e) => e.stopPropagation()}>
              <div className="mobile-dropdown-header">
                <span className="mobile-dropdown-name">{profile.displayName}</span>
              </div>

              <button
                type="button"
                className="mobile-dropdown-item"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowDMInbox(true);
                }}
              >
                📬 Messages
                {dmUnreadCount > 0 && <span className="dropdown-badge">{dmUnreadCount}</span>}
              </button>

              {isAdmin && (
                <button
                  type="button"
                  className="mobile-dropdown-item"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate("/admin");
                  }}
                >
                  🛡️ Admin
                </button>
              )}

              <button
                type="button"
                className="mobile-dropdown-item"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openProfile();
                }}
              >
                ⚙️ Settings
              </button>

              <div className="mobile-dropdown-divider" />

              <button
                type="button"
                className="mobile-dropdown-item mobile-dropdown-logout"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="header-tagline">
        Live chat rooms for sweating bets together.
      </p>
    </header>

    {/* Backdrop to close mobile dropdown */}
    {isMobile && mobileMenuOpen && (
      <div
        className="mobile-dropdown-backdrop"
        onClick={() => setMobileMenuOpen(false)}
      />
    )}

    <div className={`layout ${isMobile ? "mobile" : ""} ${isMobile ? `mobile-view-${mobileView}` : ""}`}>
      {/* Sidebar */}
      <aside className={`rooms ${isMobile && mobileView !== "rooms" ? "mobile-hidden" : ""}`}>
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

        <RoomSearch
          allRooms={allRooms}
          onSelectRoom={handleSearchSelectRoom}
          activeMarketId={activeMarketId}
        />

        {/* Trending Rooms Section (Heat Map) */}
        <div className="rooms-header">
          <h2>🔥 Trending</h2>
        </div>
        {trendingRooms.length === 0 ? (
          <div className="empty-rooms">
            <p>No trending {activeMarketId.toUpperCase()} rooms</p>
            <p className="empty-rooms-sub">
              Click a game below to build your first prop!
            </p>
          </div>
        ) : (
          <ul className="rooms-list trending-rooms">
            {trendingRooms.map((room) => {
              const isActive = room.id === activeRoomId;
              return (
                <li
                  key={room.id}
                  className={isActive ? "room active" : "room"}
                  onClick={() => handleRoomSelect(room.id)}
                >
                  <div className="room-info">
                    <div className="room-name">{room.name}</div>
                    <div className="room-game">{room.gameName}</div>
                    <div className="room-users trending-count">
                      🔥 {room.userCount || 0} sweating
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      className="room-delete-btn"
                      onClick={(e) => handleDeleteRoom(e, room.id)}
                      title="Delete room"
                    >
                      ×
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Legacy Rooms (existing system) */}
        {activeMarket.rooms.length > 0 && (
          <>
            <div className="rooms-header rooms-header-legacy">
              <h2>More Rooms</h2>
            </div>
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
                    {isAdmin && (
                      <button
                        type="button"
                        className="room-delete-btn"
                        onClick={(e) => handleDeleteRoom(e, room.id)}
                        title="Delete room"
                      >
                        ×
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </aside>

      {/* Chat */}
      <main className={`chat ${isMobile && mobileView !== "chat" ? "mobile-hidden" : ""}`}>
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
                      className={`message-user ${cluster.userId ? "clickable" : ""} ${isAdmin && cluster.userId ? "admin-clickable" : ""}`}
                      onClick={() => cluster.userId && handleUsernameClick(cluster.userId)}
                      onContextMenu={(e) => handleUsernameContextMenu(e, cluster.userId, cluster.user)}
                      role={cluster.userId ? "button" : undefined}
                      tabIndex={cluster.userId ? 0 : undefined}
                      title={isAdmin && cluster.userId ? "Right-click for admin options" : undefined}
                    >
                      {cluster.user}
                    </span>
                    <span className="message-timestamp">{cluster.time}</span>
                  </div>

                  {cluster.messages.map((msg) => (
                    <div key={msg.id} className={`message message-bubble ${msg.type === "image" || msg.type === "gif" ? "message-media" : ""}`}>
                      {/* Admin delete button */}
                      {isAdmin && (
                        <button
                          type="button"
                          className="admin-msg-delete"
                          onClick={() => handleAdminDeleteMessage(msg.id)}
                          title="Delete message"
                        >
                          ×
                        </button>
                      )}
                      {/* Text message */}
                      {(!msg.type || msg.type === "text") && (
                        <div className="message-text">{msg.text}</div>
                      )}
                      {/* Image message */}
                      {msg.type === "image" && msg.imageUrl && (
                        <div className="message-image-container">
                          <img
                            src={msg.imageUrl}
                            alt="Shared image"
                            className="message-image"
                            loading="lazy"
                            onClick={() => setLightboxImage(msg.imageUrl)}
                          />
                        </div>
                      )}
                      {/* GIF message */}
                      {msg.type === "gif" && msg.gifUrl && (
                        <div className="message-gif-container">
                          <img
                            src={msg.gifUrl}
                            alt="GIF"
                            className="message-gif"
                            loading="lazy"
                            onClick={() => setLightboxImage(msg.gifUrl)}
                          />
                        </div>
                      )}
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

          {/* Upload progress indicator */}
          {uploadProgress !== null && (
            <div className="upload-progress">
              <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
              <span className="upload-progress-text">Uploading... {uploadProgress}%</span>
            </div>
          )}

          {/* Input */}
          <div className="input-row">
            <button
              type="button"
              className="emoji-toggle"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
            >
              😀
            </button>

            {/* Media button */}
            <div className="media-btn-container">
              <button
                type="button"
                className="media-toggle"
                onClick={() => setShowMediaMenu((prev) => !prev)}
              >
                📷
              </button>
              {showMediaMenu && (
                <div className="media-menu">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    🖼️ Upload Image
                  </button>
                  <button type="button" onClick={handleOpenGifPicker}>
                    🎬 Send GIF
                  </button>
                </div>
              )}
            </div>

            {/* Hidden file input for image uploads */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleImageSelect}
              style={{ display: "none" }}
            />

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

          {/* Filter error message */}
          {filterError && (
            <div className="filter-error-toast">
              <span>⚠️</span> {filterError}
            </div>
          )}

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
      <aside className={`live-games-panel ${isMobile && mobileView !== "games" ? "mobile-hidden" : ""}`}>
        <div className="live-games-header">
          <h2>Games</h2>
          <button type="button" className="refresh-btn" onClick={refreshGames} title="Refresh games">
            {isMobile ? "↻" : "Refresh"}
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

        {/* LIVE NOW Section */}
        {liveNowGames.length > 0 && (
          <>
            <div className="section-label live-section-label">
              LIVE NOW
            </div>
            <div className="games-list">
              {liveNowGames.map((game) => {
                  const gameData = {
                    id: game.id,
                    away: game.isIndividualSport ? null : { id: game.awayTeam?.id, abbrev: game.awayTeam?.abbreviation, name: game.awayTeam?.name, logo: game.awayTeam?.logo },
                    home: game.isIndividualSport ? null : { id: game.homeTeam?.id, abbrev: game.homeTeam?.abbreviation, name: game.homeTeam?.name, logo: game.homeTeam?.logo },
                    awayScore: game.awayTeam?.score,
                    homeScore: game.homeTeam?.score,
                    status: "live",
                    time: `${getPeriodLabel(activeMarketId, game.status.period)} ${game.status.clock || ""}`,
                    sport: activeMarketId,
                    isIndividualSport: game.isIndividualSport,
                    name: game.name,
                    shortName: game.shortName,
                    competitors: game.competitors,
                    fights: game.fights,
                    // UFC-specific
                    isFight: game.isFight,
                    eventName: game.eventName,
                    weightClass: game.weightClass,
                    fighter1: game.fighter1,
                    fighter2: game.fighter2,
                  };

                  // Render game card
                  return (
                    <div
                      key={game.id}
                      className="game-card game-card-clickable live-game-card"
                      onClick={() => openGameModal(gameData)}
                    >
                      <div className="game-card-row">
                        <div className="game-card-team">
                          {game.awayTeam?.logo && (
                            <img
                              src={game.awayTeam.logo}
                              alt={game.awayTeam.name}
                              className="game-card-logo"
                            />
                          )}
                          <span className="game-card-abbr">{game.awayTeam?.name}</span>
                        </div>
                        <span className="game-card-score">{game.awayTeam?.score}</span>
                        <span className="game-card-status is-live">
                          {getPeriodLabel(activeMarketId, game.status.period)} {game.status.clock || ""}
                        </span>
                      </div>
                      <div className="game-card-row">
                        <div className="game-card-team">
                          {game.homeTeam?.logo && (
                            <img
                              src={game.homeTeam.logo}
                              alt={game.homeTeam.name}
                              className="game-card-logo"
                            />
                          )}
                          <span className="game-card-abbr">{game.homeTeam?.name}</span>
                        </div>
                        <span className="game-card-score">{game.homeTeam?.score}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </>
        )}

        {/* UPCOMING Section */}
        <div className="section-label upcoming-section-label">
          {activeMarketId === "ufc" ? "FIGHTS" : "UPCOMING"}
        </div>
        <div className="games-list upcoming-games-list">
          {upcomingGames.length === 0 ? (
            <div className="no-games">No upcoming {activeMarketId === "ufc" ? "fights" : "games"} scheduled</div>
          ) : (
            upcomingGames.map((game) => {
                const gameDate = new Date(game.date);
                const isToday = gameDate.toDateString() === new Date().toDateString();
                const isTomorrow = gameDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
                const dateLabel = isToday
                  ? "TODAY"
                  : isTomorrow
                  ? "TOMORROW"
                  : gameDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
                const timeLabel = gameDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

                const gameData = {
                  id: game.id,
                  away: game.isIndividualSport ? null : { id: game.awayTeam?.id, abbrev: game.awayTeam?.abbreviation, name: game.awayTeam?.name, logo: game.awayTeam?.logo },
                  home: game.isIndividualSport ? null : { id: game.homeTeam?.id, abbrev: game.homeTeam?.abbreviation, name: game.homeTeam?.name, logo: game.homeTeam?.logo },
                  awayScore: 0,
                  homeScore: 0,
                  status: "scheduled",
                  time: timeLabel,
                  sport: activeMarketId,
                  isIndividualSport: game.isIndividualSport,
                  name: game.name,
                  shortName: game.shortName,
                  competitors: game.competitors,
                  fights: game.fights,
                  venue: game.venue,
                  location: game.location,
                  // UFC-specific
                  isFight: game.isFight,
                  eventName: game.eventName,
                  weightClass: game.weightClass,
                  fighter1: game.fighter1,
                  fighter2: game.fighter2,
                };

                // Render game card
                return (
                  <div
                    key={game.id}
                    className="game-card game-card-clickable upcoming-game-card"
                    onClick={() => openGameModal(gameData)}
                  >
                    <div className="upcoming-game-header">
                      <span className="upcoming-date">{dateLabel}</span>
                      <span className="upcoming-time">{timeLabel}</span>
                    </div>
                    <div className="upcoming-matchup">
                      <div className="upcoming-team">
                        {game.awayTeam?.logo && (
                          <img
                            src={game.awayTeam.logo}
                            alt={game.awayTeam.name}
                            className="game-card-logo"
                          />
                        )}
                        <span>{game.awayTeam?.name}</span>
                      </div>
                      <span className="upcoming-at">@</span>
                      <div className="upcoming-team">
                        {game.homeTeam?.logo && (
                          <img
                            src={game.homeTeam.logo}
                            alt={game.homeTeam.name}
                            className="game-card-logo"
                          />
                        )}
                        <span>{game.homeTeam?.name}</span>
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>

        {/* Recently Ended Games */}
        {recentGames.length > 0 && (
          <>
            <div className="section-label recent-games-label">
              RECENTLY ENDED
            </div>
            <div className="games-list recent-games-list">
              {recentGames.map((game) => {
                  const gameData = {
                    id: game.id,
                    away: game.isIndividualSport ? null : { id: game.awayTeam?.id, abbrev: game.awayTeam?.abbreviation, name: game.awayTeam?.name, logo: game.awayTeam?.logo },
                    home: game.isIndividualSport ? null : { id: game.homeTeam?.id, abbrev: game.homeTeam?.abbreviation, name: game.homeTeam?.name, logo: game.homeTeam?.logo },
                    awayScore: game.awayTeam?.score,
                    homeScore: game.homeTeam?.score,
                    status: "final",
                    time: "Final",
                    sport: activeMarketId,
                    isIndividualSport: game.isIndividualSport,
                    name: game.name,
                    shortName: game.shortName,
                    competitors: game.competitors,
                    fights: game.fights,
                    // UFC-specific
                    isFight: game.isFight,
                    eventName: game.eventName,
                    weightClass: game.weightClass,
                    fighter1: game.fighter1,
                    fighter2: game.fighter2,
                  };

                  // Render game card
                  return (
                    <div
                      key={game.id}
                      className="game-card game-card-clickable recent-game-card"
                      onClick={() => openGameModal(gameData)}
                    >
                      <div className="game-card-row">
                        <div className="game-card-team">
                          {game.awayTeam?.logo && (
                            <img
                              src={game.awayTeam.logo}
                              alt={game.awayTeam.name}
                              className="game-card-logo"
                            />
                          )}
                          <span className="game-card-abbr">{game.awayTeam?.name}</span>
                        </div>
                        <span className="game-card-score">{game.awayTeam?.score}</span>
                        <span className="game-card-status">Final</span>
                      </div>
                      <div className="game-card-row">
                        <div className="game-card-team">
                          {game.homeTeam?.logo && (
                            <img
                              src={game.homeTeam.logo}
                              alt={game.homeTeam.name}
                              className="game-card-logo"
                            />
                          )}
                          <span className="game-card-abbr">{game.homeTeam?.name}</span>
                        </div>
                        <span className="game-card-score">{game.homeTeam?.score}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </aside>

      {/* MOBILE BOTTOM NAVIGATION */}
      {isMobile && (
        <nav className="mobile-nav">
          <button
            type="button"
            className={`mobile-nav-btn ${mobileView === "rooms" ? "active" : ""}`}
            onClick={() => setMobileView("rooms")}
          >
            <span className="mobile-nav-icon">🏠</span>
            <span className="mobile-nav-label">Rooms</span>
          </button>
          <button
            type="button"
            className={`mobile-nav-btn ${mobileView === "chat" ? "active" : ""}`}
            onClick={() => setMobileView("chat")}
            disabled={!activeRoomId}
          >
            <span className="mobile-nav-icon">💬</span>
            <span className="mobile-nav-label">Chat</span>
          </button>
          <button
            type="button"
            className={`mobile-nav-btn ${mobileView === "games" ? "active" : ""}`}
            onClick={() => setMobileView("games")}
          >
            <span className="mobile-nav-icon">📅</span>
            <span className="mobile-nav-label">Games</span>
          </button>
        </nav>
      )}
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

    {/* SUBMIT ROOM MODAL (for non-admin users) */}
    {showSubmitRoom && (
      <div
        className="modal-overlay"
        onClick={(e) => e.target === e.currentTarget && !submitting && setShowSubmitRoom(false)}
      >
        <div className="modal-content submit-room-modal">
          {submitSuccess ? (
            <div className="submit-success">
              <span className="success-icon">✓</span>
              <h2>Room Submitted!</h2>
              <p>Waiting for approval.</p>
            </div>
          ) : (
            <>
              <h2>Submit a Room</h2>
              <p className="modal-subtitle">Suggest a bet for the community</p>

              {/* Sport Selection */}
              <div className="submit-field">
                <label>Sport</label>
                <select
                  value={submitSport}
                  onChange={(e) => {
                    setSubmitSport(e.target.value);
                    setSubmitGameId(null);
                  }}
                  disabled={submitting}
                >
                  <option value="nfl">NFL</option>
                  <option value="nba">NBA</option>
                  <option value="mlb">MLB</option>
                  <option value="nhl">NHL</option>
                  <option value="soccer">Soccer</option>
                  <option value="ufc">UFC</option>
                </select>
              </div>

              {/* Game Selection */}
              <div className="submit-field">
                <label>Game</label>
                {submitGames.length === 0 ? (
                  <p className="no-games-msg">No games available for this sport</p>
                ) : (
                  <div className="game-select-list compact">
                    {submitGames.map((game) => (
                      <button
                        key={game.id}
                        type="button"
                        className={
                          "game-select-item" +
                          (submitGameId === game.id ? " game-select-item-active" : "")
                        }
                        onClick={() => setSubmitGameId(game.id)}
                        disabled={submitting}
                      >
                        <div className="game-select-teams">
                          {game.isIndividualSport ? (
                            <span className="event-name">{game.shortName || game.name}</span>
                          ) : (
                            <>
                              <span>{game.awayTeam?.abbreviation}</span>
                              <span className="game-select-at">@</span>
                              <span>{game.homeTeam?.abbreviation}</span>
                            </>
                          )}
                        </div>
                        <div className="game-select-status">
                          {game.isLive ? (
                            <span className="game-live-badge">LIVE</span>
                          ) : game.isFinal ? (
                            <span className="game-final-badge">FINAL</span>
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
                    ))}
                  </div>
                )}
              </div>

              {/* Prop/Bet Input - AUTO CAPS */}
              {submitGameId && (
                <div className="submit-field">
                  <label>Your Bet / Prop</label>
                  <input
                    type="text"
                    placeholder="e.g., MAHOMES 3 TOUCHDOWNS"
                    value={submitProp}
                    onChange={(e) => setSubmitProp(e.target.value.toUpperCase())}
                    disabled={submitting}
                    className="prop-input"
                  />
                  <p className="field-hint">Describe the bet you want to sweat</p>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-btn modal-btn-secondary"
                  onClick={() => {
                    setShowSubmitRoom(false);
                    setSubmitSport("nfl");
                    setSubmitGameId(null);
                    setSubmitProp("");
                  }}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="modal-btn modal-btn-primary"
                  onClick={handleSubmitRoom}
                  disabled={!submitGameId || !submitProp.trim() || submitting}
                >
                  {submitting ? "Submitting..." : "Submit Room"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}

    {/* DM INBOX MODAL */}
    {showDMInbox && !activeDMConversation && (
      <div
        className="modal-overlay dm-overlay"
        onClick={(e) => e.target === e.currentTarget && setShowDMInbox(false)}
      >
        <div className="dm-inbox">
          <div className="dm-inbox-header">
            <h2>Messages</h2>
            <button className="dm-close" onClick={() => setShowDMInbox(false)}>×</button>
          </div>

          <button className="dm-new-btn" onClick={() => setShowNewDM(true)}>
            + New Message
          </button>

          {dmConversations.length === 0 ? (
            <div className="dm-empty">
              <span>📭</span>
              <p>No messages yet</p>
              <p className="dm-empty-sub">Start a conversation with a friend</p>
            </div>
          ) : (
            <div className="dm-conversation-list">
              {dmConversations.map((conv) => {
                const otherUserId = conv.participants.find((id) => id !== user.uid);
                const otherUser = conv.participantData?.[otherUserId] || {};
                const unread = conv.unreadCount?.[user.uid] || 0;

                return (
                  <div
                    key={conv.id}
                    className={`dm-conversation-item ${unread > 0 ? "unread" : ""}`}
                    onClick={() => openDMConversation(conv)}
                  >
                    <div className="dm-conv-avatar">
                      {otherUser.profilePicture ? (
                        <img src={otherUser.profilePicture} alt={otherUser.username} />
                      ) : (
                        <span>{otherUser.avatarEmoji || "🔥"}</span>
                      )}
                    </div>
                    <div className="dm-conv-content">
                      <div className="dm-conv-header">
                        <span className="dm-conv-name">{otherUser.username || "User"}</span>
                        <span className="dm-conv-time">{formatDMTime(conv.lastMessageTime)}</span>
                      </div>
                      <p className="dm-conv-preview">
                        {conv.lastMessageSender === user.uid && <span className="dm-you">You: </span>}
                        {conv.lastMessage || "No messages yet"}
                      </p>
                    </div>
                    {unread > 0 && <span className="dm-unread-dot">{unread}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    )}

    {/* NEW DM MODAL - Select friend to message */}
    {showNewDM && (
      <div
        className="modal-overlay dm-overlay"
        onClick={(e) => e.target === e.currentTarget && setShowNewDM(false)}
      >
        <div className="dm-inbox dm-new-modal">
          <div className="dm-inbox-header">
            <button className="dm-back" onClick={() => setShowNewDM(false)}>←</button>
            <h2>New Message</h2>
            <div style={{ width: 32 }} />
          </div>

          {dmFriends.length === 0 ? (
            <div className="dm-empty">
              <span>👥</span>
              <p>No friends yet</p>
              <p className="dm-empty-sub">Add friends to start messaging</p>
            </div>
          ) : (
            <div className="dm-friends-list">
              {dmFriends.map((friend) => (
                <div
                  key={friend.id}
                  className="dm-friend-item"
                  onClick={() => openDMWithFriend(friend)}
                >
                  <div className="dm-conv-avatar">
                    {friend.profilePicture ? (
                      <img src={friend.profilePicture} alt={friend.username} />
                    ) : (
                      <span>{friend.avatarEmoji || "🔥"}</span>
                    )}
                  </div>
                  <span className="dm-friend-name">{friend.username}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )}

    {/* DM CHAT VIEW */}
    {activeDMConversation && (
      <div className="modal-overlay dm-overlay">
        <div className="dm-chat">
          <div className="dm-chat-header">
            <button className="dm-back" onClick={closeDMChat}>←</button>
            <div className="dm-chat-user" onClick={() => navigate(`/profile/${activeDMConversation.otherUser?.id}`)}>
              <div className="dm-chat-avatar">
                {activeDMConversation.otherUser?.profilePicture ? (
                  <img src={activeDMConversation.otherUser.profilePicture} alt="" />
                ) : (
                  <span>{activeDMConversation.otherUser?.avatarEmoji || "🔥"}</span>
                )}
              </div>
              <span className="dm-chat-name">
                {activeDMConversation.otherUser?.username || "User"}
              </span>
            </div>
            <button className="dm-close" onClick={() => { closeDMChat(); setShowDMInbox(false); }}>×</button>
          </div>

          <div className="dm-messages">
            {dmMessages.length === 0 ? (
              <div className="dm-messages-empty">
                <p>No messages yet</p>
                <p className="dm-empty-sub">Send a message to start the conversation</p>
              </div>
            ) : (
              <>
                {dmMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`dm-message ${msg.senderId === user.uid ? "sent" : "received"}`}
                  >
                    <div className="dm-message-bubble">
                      <p>{msg.text}</p>
                      <span className="dm-message-time">
                        {msg.timestamp?.toLocaleTimeString?.([], { hour: "numeric", minute: "2-digit" }) || ""}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={dmMessagesEndRef} />
              </>
            )}
          </div>

          <div className="dm-input-area">
            <input
              type="text"
              className="dm-input"
              placeholder="Type a message..."
              value={dmInput}
              onChange={(e) => setDmInput(e.target.value)}
              onKeyDown={handleDMKeyDown}
            />
            <button
              className="dm-send-btn"
              onClick={handleSendDM}
              disabled={!dmInput.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    )}

    {/* GIF PICKER MODAL */}
    {showGifPicker && (
      <div
        className="modal-overlay gif-overlay"
        onClick={(e) => e.target === e.currentTarget && setShowGifPicker(false)}
      >
        <div className="gif-picker-modal">
          <div className="gif-picker-header">
            <h2>Send a GIF</h2>
            <button className="gif-close" onClick={() => setShowGifPicker(false)}>×</button>
          </div>

          <input
            type="text"
            className="gif-search-input"
            placeholder="Search GIFs..."
            value={gifSearchQuery}
            onChange={(e) => handleGifSearch(e.target.value)}
            autoFocus
          />

          <div className="gif-categories">
            {getGifCategories().map((cat) => (
              <button
                key={cat.query}
                type="button"
                className="gif-category-btn"
                onClick={() => handleGifCategory(cat.query)}
              >
                {cat.emoji}
              </button>
            ))}
          </div>

          <div className="gif-results">
            {gifLoading ? (
              <div className="gif-loading">Loading...</div>
            ) : gifResults.length === 0 ? (
              <div className="gif-empty">No GIFs found</div>
            ) : (
              gifResults.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  className="gif-result-item"
                  onClick={() => handleSendGif(gif)}
                >
                  <img src={gif.previewUrl} alt={gif.title} loading="lazy" />
                </button>
              ))
            )}
          </div>

          <div className="gif-attribution">
            Powered by GIPHY
          </div>
        </div>
      </div>
    )}

    {/* LIGHTBOX MODAL */}
    {lightboxImage && (
      <div
        className="lightbox-overlay"
        onClick={() => setLightboxImage(null)}
      >
        <button className="lightbox-close" onClick={() => setLightboxImage(null)}>×</button>
        <img src={lightboxImage} alt="Full size" className="lightbox-image" />
      </div>
    )}

    {/* ADMIN USER DROPDOWN */}
    {adminUserDropdown && (
      <div
        className="admin-user-dropdown"
        style={{
          position: "fixed",
          left: adminUserDropdown.position.x,
          top: adminUserDropdown.position.y,
          zIndex: 9999,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-dropdown-header">
          Admin Actions for {adminUserDropdown.username}
        </div>
        <button
          type="button"
          onClick={() => navigate(`/profile/${adminUserDropdown.userId}`)}
        >
          View Profile
        </button>
        <button
          type="button"
          onClick={() => openAdminMuteModal(adminUserDropdown.userId, adminUserDropdown.username)}
        >
          Mute User
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => openAdminBanModal(adminUserDropdown.userId, adminUserDropdown.username)}
        >
          Ban User
        </button>
      </div>
    )}

    {/* ADMIN MUTE MODAL */}
    {adminMuteModal && (
      <div className="admin-modal-overlay" onClick={() => setAdminMuteModal(null)}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <h3>Mute {adminMuteModal.username}</h3>
          <div className="admin-modal-field">
            <label>Duration</label>
            <select
              value={adminMuteDuration}
              onChange={(e) => setAdminMuteDuration(Number(e.target.value))}
            >
              <option value={10}>10 minutes</option>
              <option value={60}>1 hour</option>
              <option value={1440}>24 hours</option>
              <option value={10080}>1 week</option>
              <option value={0}>Permanent</option>
            </select>
          </div>
          <div className="admin-modal-actions">
            <button type="button" onClick={() => setAdminMuteModal(null)}>Cancel</button>
            <button type="button" className="warning" onClick={handleAdminMuteUser}>Mute User</button>
          </div>
        </div>
      </div>
    )}

    {/* ADMIN BAN MODAL */}
    {adminBanModal && (
      <div className="admin-modal-overlay" onClick={() => setAdminBanModal(null)}>
        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
          <h3>Ban {adminBanModal.username}</h3>
          <div className="admin-modal-field">
            <label>Duration</label>
            <select
              value={adminBanDuration}
              onChange={(e) => setAdminBanDuration(Number(e.target.value))}
            >
              <option value={1440}>24 hours</option>
              <option value={10080}>1 week</option>
              <option value={43200}>30 days</option>
              <option value={0}>Permanent</option>
            </select>
          </div>
          <div className="admin-modal-actions">
            <button type="button" onClick={() => setAdminBanModal(null)}>Cancel</button>
            <button type="button" className="danger" onClick={handleAdminBanUser}>Ban User</button>
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

      {/* Game Modal (Betting Menu Popup) */}
      {gameModalData && (
        <div className="game-modal-overlay" onClick={closeGameModal}>
          <div className="game-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="game-modal-header">
              <button className="game-modal-close" onClick={closeGameModal}>
                ×
              </button>

              {gameModalData?.isFight ? (
                /* UFC Fight Header */
                <div className="game-modal-fight">
                  {gameModalData?.eventName && (
                    <div className="fight-event-name">{gameModalData.eventName}</div>
                  )}
                  <div className="game-modal-matchup fight-matchup">
                    <div className="game-modal-team away fighter">
                      {gameModalData?.away?.logo && (
                        <img src={gameModalData.away.logo} alt="" className="game-modal-logo fighter-photo" />
                      )}
                      <span className="game-modal-abbrev fighter-name">{gameModalData?.away?.abbrev || gameModalData?.fighter1?.name || "TBD"}</span>
                    </div>

                    <div className="game-modal-vs">
                      <span className="vs-text">VS</span>
                    </div>

                    <div className="game-modal-team home fighter">
                      {gameModalData?.home?.logo && (
                        <img src={gameModalData.home.logo} alt="" className="game-modal-logo fighter-photo" />
                      )}
                      <span className="game-modal-abbrev fighter-name">{gameModalData?.home?.abbrev || gameModalData?.fighter2?.name || "TBD"}</span>
                    </div>
                  </div>
                  {gameModalData?.weightClass && (
                    <div className="fight-weight-class">{gameModalData.weightClass}</div>
                  )}
                </div>
              ) : (
                /* Team Sport Header */
                <div className="game-modal-matchup">
                  <div className="game-modal-team away">
                    {gameModalData?.away?.logo && (
                      <img src={gameModalData.away.logo} alt="" className="game-modal-logo" />
                    )}
                    <span className="game-modal-abbrev">{gameModalData?.away?.abbrev || "AWAY"}</span>
                  </div>

                  <div className="game-modal-vs">
                    {gameModalData?.status === "live" ? (
                      <div className="game-modal-score">
                        <span>{gameModalData?.awayScore || 0}</span>
                        <span className="score-divider">-</span>
                        <span>{gameModalData?.homeScore || 0}</span>
                      </div>
                    ) : (
                      <span className="vs-text">VS</span>
                    )}
                  </div>

                  <div className="game-modal-team home">
                    {gameModalData?.home?.logo && (
                      <img src={gameModalData.home.logo} alt="" className="game-modal-logo" />
                    )}
                    <span className="game-modal-abbrev">{gameModalData?.home?.abbrev || "HOME"}</span>
                  </div>
                </div>
              )}

              <div className="game-modal-time">
                {gameModalData?.status === "live" ? (
                  <span className="live-indicator">LIVE - {gameModalData?.time}</span>
                ) : (
                  <span>{gameModalData?.time || "TBD"}</span>
                )}
              </div>
            </div>

            {/* Betting Menu */}
            <div className="game-modal-menu">
              <h2 className="betting-menu-title">THE BETTING MENU</h2>
              <p className="betting-menu-subtitle">Pick your prop, join the sweat</p>

              <div className="betting-categories">
                {getBettingCategories(gameModalData?.sport || "nfl").map((category) => (
                  <button
                    key={category.id}
                    className={`betting-category ${category.isTrending ? "trending" : ""}`}
                    onClick={() => handleModalCategoryClick(category)}
                  >
                    <span className="category-emoji">{category.emoji}</span>
                    <div className="category-info">
                      <span className="category-name">{category.name}</span>
                      <span className="category-desc">{category.description}</span>
                    </div>
                    <span className="category-arrow">→</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Active Rooms for this Game */}
            {gameRoomsForModal.length > 0 && (
              <div className="game-active-rooms">
                <h3 className="active-rooms-title">🔥 Active Rooms</h3>
                <div className="active-rooms-list">
                  {gameRoomsForModal.slice(0, 10).map((room) => (
                    <div key={room.id} className="active-room-card-wrapper">
                      <button
                        className="active-room-card"
                        onClick={() => {
                          closeGameModal();
                          setActiveRoomId(room.id);
                          if (isMobile) setMobileView("chat");
                        }}
                      >
                        <span className="room-name">{room.name}</span>
                        <span className="room-users">{room.userCount || 0} sweating</span>
                      </button>
                      {isAdmin && (
                        <button
                          className="active-room-delete-btn"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm(`Delete room "${room.name}"?`)) {
                              try {
                                await deleteRoom(room.id);
                              } catch (err) {
                                console.error("Failed to delete room:", err);
                              }
                            }
                          }}
                          title="Delete room"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prop Builder (nested modal within game modal) */}
            {showPropBuilder && (
              <div className="prop-builder-overlay" onClick={closeModalPropBuilder}>
                <div className="prop-builder-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="prop-builder-header">
                    <button className="prop-builder-back" onClick={goBackModalStep}>
                      ← Back
                    </button>
                    <h2>
                      {selectedCategory?.emoji} {selectedCategory?.name}
                    </h2>
                    <button className="prop-builder-close" onClick={closeModalPropBuilder}>
                      ×
                    </button>
                  </div>

                  <div className="prop-builder-progress">
                    {selectedCategory?.requiresPlayer && (
                      <div className={`progress-step ${builderStep >= 1 ? "active" : ""}`}>
                        Player
                      </div>
                    )}
                    <div className={`progress-step ${builderStep >= 2 ? "active" : ""}`}>
                      Stat
                    </div>
                    <div className={`progress-step ${builderStep >= 3 ? "active" : ""}`}>
                      Line
                    </div>
                    <div className={`progress-step ${builderStep >= 4 ? "active" : ""}`}>
                      Pick
                    </div>
                  </div>

                  <div className="prop-builder-content">
                    {/* Step 1: Pick Player - STRUCTURED SELECTION ONLY */}
                    {builderStep === 1 && selectedCategory?.requiresPlayer && (
                      <div className="builder-step">
                        <h3>Pick a Player</h3>

                        {modalPlayersLoading && (
                          <div className="players-loading">
                            <div className="loading-spinner"></div>
                            <p>Loading players...</p>
                          </div>
                        )}

                        {!modalPlayersLoading && modalPlayersError && (
                          <div className="players-error">
                            <p>Could not load player roster</p>
                            <p className="players-error-hint">Please try again or select a different game</p>
                            <button
                              className="retry-btn"
                              onClick={() => {
                                setModalPlayersError(false);
                                setModalPlayersLoading(true);
                                // Re-trigger the useEffect by toggling category
                                const cat = selectedCategory;
                                setSelectedCategory(null);
                                setTimeout(() => setSelectedCategory(cat), 100);
                              }}
                            >
                              Retry
                            </button>
                          </div>
                        )}

                        {!modalPlayersLoading && !modalPlayersError && modalPlayers.length > 0 && (
                          <>
                            {/* Search filter for players */}
                            <div className="player-search">
                              <input
                                type="text"
                                placeholder="Search players..."
                                value={playerSearchQuery}
                                onChange={(e) => setPlayerSearchQuery(e.target.value)}
                                autoFocus
                              />
                              {playerSearchQuery && (
                                <button
                                  className="player-search-clear"
                                  onClick={() => setPlayerSearchQuery("")}
                                >
                                  ×
                                </button>
                              )}
                            </div>

                            {/* Filtered player grid */}
                            <div className="player-grid">
                              {modalPlayers
                                .filter((player) =>
                                  !playerSearchQuery ||
                                  player.name.toLowerCase().includes(playerSearchQuery.toLowerCase()) ||
                                  (player.team && player.team.toLowerCase().includes(playerSearchQuery.toLowerCase()))
                                )
                                .slice(0, 20)
                                .map((player, idx) => (
                                  <button
                                    key={player.id || `${player.name}-${idx}`}
                                    className="player-btn"
                                    onClick={() => {
                                      handleModalPlayerSelect(player);
                                      setPlayerSearchQuery("");
                                    }}
                                  >
                                    <span className="player-name">{player.name}</span>
                                    <span className="player-team">
                                      {player.position && `${player.position} · `}{player.team}
                                    </span>
                                  </button>
                                ))}
                            </div>

                            {/* No results message */}
                            {playerSearchQuery && modalPlayers.filter((p) =>
                              p.name.toLowerCase().includes(playerSearchQuery.toLowerCase()) ||
                              (p.team && p.team.toLowerCase().includes(playerSearchQuery.toLowerCase()))
                            ).length === 0 && (
                              <div className="players-no-results">
                                <p>No players match "{playerSearchQuery}"</p>
                                <button onClick={() => setPlayerSearchQuery("")}>
                                  Clear search
                                </button>
                              </div>
                            )}
                          </>
                        )}

                        {!modalPlayersLoading && !modalPlayersError && modalPlayers.length === 0 && (
                          <div className="players-error">
                            <p>No players found for this category</p>
                            <p className="players-error-hint">Try a different prop category</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Game Lines View - All options at once */}
                    {selectedCategory?.id === "gameLines" && (
                      <div className="builder-step game-lines-step">
                        {(() => {
                          const teams = getTeamsForGame(gameModalData);
                          const awayTeam = teams.find(t => t.isAway) || teams[0];
                          const homeTeam = teams.find(t => t.isHome) || teams[1];
                          const sport = gameModalData?.sport || "nfl";

                          if (!awayTeam || !homeTeam) {
                            return (
                              <div className="game-lines-error">
                                <p>Unable to load teams for this game.</p>
                              </div>
                            );
                          }

                          // Generate spread values from -30.5 to +30.5
                          const spreadValues = [];
                          for (let i = -30.5; i <= 30.5; i += 0.5) {
                            spreadValues.push(i);
                          }

                          // Generate total values based on sport
                          const totalRange = sport === "nba"
                            ? { min: 180.5, max: 280.5 }
                            : sport === "nfl"
                              ? { min: 25.5, max: 70.5 }
                              : sport === "nhl"
                                ? { min: 3.5, max: 10.5 }
                                : { min: 0.5, max: 10.5 };

                          const totalValues = [];
                          for (let i = totalRange.min; i <= totalRange.max; i += 0.5) {
                            totalValues.push(i);
                          }

                          // Default starting values
                          const defaultSpread = sport === "nba" ? 5.5 : sport === "nfl" ? 3.5 : 1.5;
                          const defaultTotal = sport === "nba" ? 220.5 : sport === "nfl" ? 45.5 : sport === "nhl" ? 5.5 : 2.5;

                          return (
                            <>
                              {/* SPREAD */}
                              <div className="game-line-section">
                                <h4>SPREAD</h4>
                                <div className="spread-columns">
                                  <div className="spread-column">
                                    <div className="spread-team-header">{awayTeam?.name}</div>
                                    <div className="spread-scroll">
                                      {spreadValues.map(val => (
                                        <button
                                          key={`away-${val}`}
                                          className={`spread-btn ${val === defaultSpread ? 'default' : ''}`}
                                          onClick={() => handleGameLineSelect("spread", awayTeam, val)}
                                          disabled={isCreatingRoom}
                                        >
                                          {val > 0 ? `+${val}` : val}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="spread-column">
                                    <div className="spread-team-header">{homeTeam?.name}</div>
                                    <div className="spread-scroll">
                                      {spreadValues.map(val => (
                                        <button
                                          key={`home-${val}`}
                                          className={`spread-btn ${val === -defaultSpread ? 'default' : ''}`}
                                          onClick={() => handleGameLineSelect("spread", homeTeam, val)}
                                          disabled={isCreatingRoom}
                                        >
                                          {val > 0 ? `+${val}` : val}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* MONEYLINE */}
                              <div className="game-line-section">
                                <h4>MONEYLINE</h4>
                                <div className="game-line-options">
                                  <button
                                    className="game-line-btn"
                                    onClick={() => handleGameLineSelect("moneyline", awayTeam)}
                                    disabled={isCreatingRoom}
                                  >
                                    <span className="gl-team">{awayTeam?.name}</span>
                                    <span className="gl-line">ML</span>
                                  </button>
                                  <button
                                    className="game-line-btn"
                                    onClick={() => handleGameLineSelect("moneyline", homeTeam)}
                                    disabled={isCreatingRoom}
                                  >
                                    <span className="gl-team">{homeTeam?.name}</span>
                                    <span className="gl-line">ML</span>
                                  </button>
                                </div>
                              </div>

                              {/* TOTAL */}
                              <div className="game-line-section">
                                <h4>TOTAL POINTS</h4>
                                <div className="total-columns">
                                  <div className="total-column">
                                    <div className="total-header over">⬆️ OVER</div>
                                    <div className="total-scroll">
                                      {totalValues.map(val => (
                                        <button
                                          key={`over-${val}`}
                                          className={`total-btn over ${val === defaultTotal ? 'default' : ''}`}
                                          onClick={() => handleGameLineSelect("total", "OVER", val)}
                                          disabled={isCreatingRoom}
                                        >
                                          {val}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="total-column">
                                    <div className="total-header under">⬇️ UNDER</div>
                                    <div className="total-scroll">
                                      {totalValues.map(val => (
                                        <button
                                          key={`under-${val}`}
                                          className={`total-btn under ${val === defaultTotal ? 'default' : ''}`}
                                          onClick={() => handleGameLineSelect("total", "UNDER", val)}
                                          disabled={isCreatingRoom}
                                        >
                                          {val}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {isCreatingRoom && (
                                <div className="creating-room-status">Creating room...</div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* Step 1 for other Team-based props (non-game-lines) */}
                    {builderStep === 2 && selectedCategory?.teamBased && selectedCategory?.id !== "gameLines" && !selectedPlayer && (
                      <div className="builder-step">
                        <h3>Pick a Team</h3>
                        <div className="team-grid">
                          {getTeamsForGame(gameModalData).map((team) => (
                            <button
                              key={team.abbrev}
                              className="team-btn"
                              onClick={() => handleModalTeamSelect(team)}
                            >
                              <span className="team-name">{team.name}</span>
                              <span className="team-tag">{team.isHome ? "HOME" : "AWAY"}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Step 2: Pick Stat (not for gameLines - they have dedicated view) */}
                    {builderStep === 2 && selectedCategory?.id !== "gameLines" && (selectedPlayer || !selectedCategory?.requiresPlayer) && (
                      <div className="builder-step">
                        <h3>Pick a Stat</h3>
                        {selectedPlayer && (
                          <div className="selected-info">
                            {selectedPlayer.name}
                            {selectedPlayer.team && !selectedPlayer.isTeam && ` (${selectedPlayer.team})`}
                          </div>
                        )}
                        <div className="stat-grid">
                          {selectedCategory?.stats.map((stat) => (
                            <button
                              key={stat}
                              className="stat-btn"
                              onClick={() => handleModalStatSelect(stat)}
                            >
                              {stat}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Step 3: Pick Line with Over/Under */}
                    {builderStep === 3 && (
                      <div className="builder-step prop-lines-step">
                        <div className="selected-info prop-header">
                          {selectedPlayer?.name} - {selectedStat}
                        </div>
                        {(() => {
                          // Generate line ranges based on stat type
                          const getLineRange = (stat) => {
                            const ranges = {
                              // NFL
                              "Passing Yards": { min: 149.5, max: 349.5, step: 5 },
                              "Passing TDs": { min: 0.5, max: 5.5, step: 0.5 },
                              "Interceptions": { min: 0.5, max: 3.5, step: 0.5 },
                              "Rushing Yards": { min: 9.5, max: 149.5, step: 5 },
                              "Rushing TDs": { min: 0.5, max: 3.5, step: 0.5 },
                              "Receiving Yards": { min: 9.5, max: 149.5, step: 5 },
                              "Receptions": { min: 0.5, max: 12.5, step: 0.5 },
                              "Receiving TDs": { min: 0.5, max: 3.5, step: 0.5 },
                              // NBA
                              "Points": { min: 4.5, max: 54.5, step: 1 },
                              "Rebounds": { min: 0.5, max: 20.5, step: 0.5 },
                              "Assists": { min: 0.5, max: 16.5, step: 0.5 },
                              "Pts+Reb+Ast": { min: 9.5, max: 69.5, step: 1 },
                              "Pts+Reb": { min: 9.5, max: 54.5, step: 1 },
                              "Pts+Ast": { min: 9.5, max: 54.5, step: 1 },
                              "Steals": { min: 0.5, max: 5.5, step: 0.5 },
                              "Blocks": { min: 0.5, max: 5.5, step: 0.5 },
                              "3-Pointers": { min: 0.5, max: 8.5, step: 0.5 },
                              // MLB
                              "Strikeouts": { min: 2.5, max: 12.5, step: 0.5 },
                              "Earned Runs": { min: 0.5, max: 6.5, step: 0.5 },
                              "Hits Allowed": { min: 2.5, max: 10.5, step: 0.5 },
                              "Hits": { min: 0.5, max: 4.5, step: 0.5 },
                              "Home Runs": { min: 0.5, max: 3.5, step: 0.5 },
                              "RBIs": { min: 0.5, max: 4.5, step: 0.5 },
                              "Total Bases": { min: 0.5, max: 5.5, step: 0.5 },
                              // NHL
                              "Goals": { min: 0.5, max: 4.5, step: 0.5 },
                              "Shots on Target": { min: 0.5, max: 8.5, step: 0.5 },
                            };
                            return ranges[stat] || { min: 0.5, max: 20.5, step: 0.5 };
                          };

                          const range = getLineRange(selectedStat);
                          const lines = [];
                          for (let i = range.min; i <= range.max; i += range.step) {
                            lines.push(parseFloat(i.toFixed(1)));
                          }

                          // Find default/common line for highlighting
                          const commonLines = COMMON_LINES[selectedStat] || [];
                          const defaultLine = commonLines[Math.floor(commonLines.length / 2)] || lines[Math.floor(lines.length / 2)];

                          return (
                            <div className="prop-over-under-columns">
                              <div className="prop-column over-column">
                                <div className="prop-column-header over">⬆️ OVER</div>
                                <div className="prop-lines-scroll">
                                  {lines.map(line => (
                                    <button
                                      key={`over-${line}`}
                                      className={`prop-line-btn over ${line === defaultLine ? 'default' : ''}`}
                                      onClick={() => handlePropLineSelect(line, "OVER")}
                                      disabled={isCreatingRoom}
                                    >
                                      {line}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="prop-column under-column">
                                <div className="prop-column-header under">⬇️ UNDER</div>
                                <div className="prop-lines-scroll">
                                  {lines.map(line => (
                                    <button
                                      key={`under-${line}`}
                                      className={`prop-line-btn under ${line === defaultLine ? 'default' : ''}`}
                                      onClick={() => handlePropLineSelect(line, "UNDER")}
                                      disabled={isCreatingRoom}
                                    >
                                      {line}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        {isCreatingRoom && (
                          <div className="creating-room-status">Creating room...</div>
                        )}
                      </div>
                    )}

                    {/* Step 4: Pick Over/Under */}
                    {builderStep === 4 && (
                      <div className="builder-step">
                        <h3>Make Your Pick</h3>
                        <div className="selected-info final">
                          <span className="pick-player">{selectedPlayer?.name}</span>
                          <span className="pick-stat">{selectedStat}</span>
                          {selectedLine !== "YES" && (
                            <span className="pick-line">{selectedLine}</span>
                          )}
                        </div>
                        <div className="direction-buttons">
                          {selectedStat === "Moneyline" || selectedStat === "Draw" ? (
                            <button
                              className="direction-btn yes"
                              onClick={() => handleModalDirectionSelect("YES")}
                              disabled={isCreatingRoom}
                            >
                              {isCreatingRoom ? "Creating..." : "🔥 SWEAT THIS"}
                            </button>
                          ) : (
                            <>
                              <button
                                className="direction-btn over"
                                onClick={() => handleModalDirectionSelect("OVER")}
                                disabled={isCreatingRoom}
                              >
                                {isCreatingRoom ? "..." : "⬆️ OVER"}
                              </button>
                              <button
                                className="direction-btn under"
                                onClick={() => handleModalDirectionSelect("UNDER")}
                                disabled={isCreatingRoom}
                              >
                                {isCreatingRoom ? "..." : "⬇️ UNDER"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
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
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/" element={mainAppContent} />
    </Routes>
  );
}

export default App;
