// src/App.jsx
import { useState, useEffect, useRef } from "react";
import "./App.css";

//
// ---------------- META CONFIG ----------------
//

const emojiOptions = ["🔥", "😭", "😅", "🤞", "💰", "🍀", "🧱", "🤯", "😡"];

const crowdReactions = [
  "This drive is everything 😳",
  "If this misses, I'm done betting.",
  "This is the sweatiest slip I’ve ever had 💦",
  "One bucket and we’re ALIVE 🔥",
  "I can’t watch… someone tell me when it hits 😭",
  "Why did I think this was free money 😅",
  "If this cashes, I’m retiring… until tomorrow.",
  "The live line is getting spooky 👻",
];

const fakeSweatUsers = [
  "SlipKing89",
  "EVNerd",
  "BadBeatBilly",
  "TeaserTom",
  "ParlayPrincess",
  "SweatGoblin",
  "AltLineLarry",
  "BankrollBeth",
];

const sweatMessages = [
  "He needs ONE more catch, I’m shaking 😭",
  "If this hits I’m buying everyone wings 🔥",
  "Why did I put the rent on this 😅",
  "Clock is MOVING, love this pace ⏱️",
  "This ref has money on the other side fr 💀",
  "I’m sweating this like Game 7",
  "One more bucket and I’m free 🙏",
  "No more fouls PLEASE 😭",
];

// CHAOS MODE: fake chat users for the main room chat
const fakeChatUsers = [
  { name: "SlipKing", emoji: "🔥" },
  { name: "EVNerd", emoji: "🧠" },
  { name: "BadBeatBilly", emoji: "💀" },
  { name: "TeaserTom", emoji: "🧵" },
  { name: "ParlayPrincess", emoji: "👑" },
  { name: "AltLineLarry", emoji: "📈" },
  { name: "HookHater", emoji: "😡" },
  { name: "BankrollBeth", emoji: "💰" },
  { name: "SweatGoblin", emoji: "👹" },
  { name: "LiveLineLuca", emoji: "📊" },
  { name: "OvertimeOllie", emoji: "⏱️" },
  { name: "BadBeatBob", emoji: "🩹" },
  { name: "UndersClub", emoji: "🧊" },
  { name: "AltOversOnly", emoji: "🚀" },
  { name: "UnitMerchant", emoji: "📦" },
  { name: "DeGenDan", emoji: "🎲" },
  { name: "SweatSensei", emoji: "🥋" },
  { name: "RedZoneRicky", emoji: "🟥" },
  { name: "TiltedTina", emoji: "🥴" },
  { name: "SoonRich", emoji: "🌈" },
];

// Templates for chaos chat – generic so they fit all rooms
const fakeChatMessages = [
  "ONE MORE bucket I’m begging 😭",
  "If this misses I’m retired until tomorrow.",
  "This is the sweatiest leg on the slip fr 💦",
  "Why is the offense playing like this now 💀",
  "I need this dude to remember how to play ball.",
  "Clock moving way too fast I’m sick 😭",
  "If this hits drinks on me 🔥",
  "I called this in the first quarter btw.",
  "We are SO ALIVE right now 🤞",
  "Bookies are sweating this one for sure.",
  "If he sells my super boost I’m done.",
  "Red zone again ohhh here we go 👀",
  "Just need overtime, is that too much to ask?",
  "Everyone stay calm, we’re actually vibing.",
  "We are one flag away from glory.",
  "I’m emotionally hedged but financially not 😅",
  "Live line is getting disrespectful ngl.",
  "I’m riding this till the wheels fall off.",
  "He’s on triple double watch LETS GO.",
  "Please just feed him the ball man.",
];

function randomUserCount() {
  return Math.floor(Math.random() * 500) + 10;
}

//
// ---------------- INITIAL MARKETS ----------------
//

const initialMarkets = [
  {
    id: "nfl",
    label: "NFL",
    rooms: [
      {
        id: "nfl-1",
        name: "Mahomes 2+ Passing TDs",
        game: "Chiefs @ Bills",
        odds: "+120",
        legsHit: 0,
        totalLegs: 1,
        userCount: randomUserCount(),
        messages: [
          {
            id: 1,
            user: "Adam",
            text: "Mahomes primetime… this feels like free money 😅",
            timestamp: new Date().toISOString(),
          },
        ],
      },
      {
        id: "nfl-2",
        name: "Josh Allen Anytime TD",
        game: "Chiefs @ Bills",
        odds: "+150",
        legsHit: 0,
        totalLegs: 1,
        userCount: randomUserCount(),
        messages: [],
      },
      {
        id: "nfl-3",
        name: "Travis Kelce 60+ Yards",
        game: "Chiefs @ Bills",
        odds: "-110",
        legsHit: 0,
        totalLegs: 1,
        userCount: randomUserCount(),
        messages: [],
      },
      {
        id: "nfl-4",
        name: "James Cook 50+ Rushing Yards",
        game: "Chiefs @ Bills",
        odds: "-105",
        legsHit: 0,
        totalLegs: 1,
        userCount: randomUserCount(),
        messages: [],
      },
    ],
  },

  {
    id: "nba",
    label: "NBA",
    rooms: [
      {
        id: "nba-1",
        name: "Tatum 25+ Points",
        game: "Lakers @ Celtics",
        odds: "-105",
        legsHit: 0,
        totalLegs: 1,
        userCount: randomUserCount(),
        messages: [],
      },
      {
        id: "nba-2",
        name: "LeBron 8+ Assists",
        game: "Lakers @ Celtics",
        odds: "+135",
        legsHit: 0,
        totalLegs: 1,
        userCount: randomUserCount(),
        messages: [],
      },
      {
        id: "nba-3",
        name: "Anthony Davis 10+ Rebounds",
        game: "Lakers @ Celtics",
        odds: "-120",
        legsHit: 0,
        totalLegs: 1,
        userCount: randomUserCount(),
        messages: [],
      },
    ],
  },

  {
    id: "mlb",
    label: "MLB",
    rooms: [
      {
        id: "mlb-1",
        name: "Judge 1+ Home Run",
        game: "Yankees @ Red Sox",
        odds: "+210",
        legsHit: 0,
        totalLegs: 1,
        userCount: randomUserCount(),
        messages: [],
      },
      {
        id: "mlb-2",
        name: "Devers 1+ RBI",
        game: "Yankees @ Red Sox",
        odds: "+145",
        legsHit: 0,
        totalLegs: 1,
        userCount: randomUserCount(),
        messages: [],
      },
    ],
  },
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
// ---------------- LIVE GAME HELPERS ----------------
//

function createInitialLiveGame(marketId, room) {
  if (!room) {
    return {
      awayTeam: "Away",
      homeTeam: "Home",
      awayScore: 0,
      homeScore: 0,
      period: "—",
      clock: "--:--",
      possession: "home",
      winProb: 50,
      winProbTeam: "home",
      status: "Waiting for kickoff",
    };
  }

  let awayTeam = "Away";
  let homeTeam = "Home";
  if (room.game && room.game.includes("@")) {
    const [away, home] = room.game.split("@").map((s) => s.trim());
    awayTeam = away || awayTeam;
    homeTeam = home || homeTeam;
  }

  const isBaseball = marketId === "mlb";

  return {
    awayTeam,
    homeTeam,
    awayScore: Math.floor(Math.random() * 10),
    homeScore: Math.floor(Math.random() * 10),
    period: isBaseball ? "Top 5th" : "Q3",
    clock: isBaseball ? "—" : "07:32",
    possession: Math.random() < 0.5 ? "home" : "away",
    winProb: 55,
    winProbTeam: Math.random() < 0.5 ? "home" : "away",
    status: "Live",
  };
}

function tickLiveGame(prev) {
  if (!prev || prev.status !== "Live") return prev;

  let { homeScore, awayScore } = prev;

  if (Math.random() < 0.45) {
    const scorer = Math.random() < 0.5 ? "home" : "away";
    const delta = Math.random() < 0.5 ? 3 : 7;
    if (scorer === "home") homeScore += delta;
    else awayScore += delta;
  }

  const diff = homeScore - awayScore;
  const winProbTeam =
    diff > 0 ? "home" : diff < 0 ? "away" : prev.winProbTeam || "home";

  let base = 50 + Math.max(-20, Math.min(20, diff * 4));
  base += (Math.random() - 0.5) * 4;
  const winProb = Math.max(5, Math.min(95, base));

  const periodsNflNba = ["Q2 · 10:14", "Q3 · 6:48", "Q4 · 3:21", "Late 4th"];
  const periodsMlb = ["Top 5th", "Bot 6th", "Top 7th", "Late 8th"];
  const isBaseball =
    prev.period?.includes("th") || prev.period?.includes("Top");
  const period = isBaseball
    ? periodsMlb[Math.floor(Math.random() * periodsMlb.length)]
    : periodsNflNba[Math.floor(Math.random() * periodsNflNba.length)];
  const clock = isBaseball ? "—" : period.split("·")[1]?.trim() || prev.clock;

  return {
    ...prev,
    homeScore,
    awayScore,
    period,
    clock,
    possession: winProbTeam,
    winProb,
    winProbTeam,
  };
}

//
// ---------------- COMPONENT ----------------
//

function App() {
  const [markets, setMarkets] = useState(initialMarkets);
  const [activeMarketId, setActiveMarketId] = useState(initialMarkets[0].id);
  const [activeRoomId, setActiveRoomId] = useState(
    initialMarkets[0].rooms[0].id
  );

  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // profile state
  const [profile, setProfile] = useState(defaultProfile);
  const [draftProfile, setDraftProfile] = useState(defaultProfile);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showAvatarChoices, setShowAvatarChoices] = useState(true);
  const [isLiveExpanded, setIsLiveExpanded] = useState(false);


  // live game + sweat feed (right panel)
  const [liveGame, setLiveGame] = useState(() =>
    createInitialLiveGame(initialMarkets[0].id, initialMarkets[0].rooms[0])
  );
  const [sweatFeed, setSweatFeed] = useState([]);

  // for soft fade transitions on room change
  const [fadeKey, setFadeKey] = useState(0);

  // refs for smart auto-scroll
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const activeMarket =
    markets.find((m) => m.id === activeMarketId) || markets[0];
  const activeRoom =
    activeMarket.rooms.find((r) => r.id === activeRoomId) ||
    activeMarket.rooms[0];

  const activeMessages = activeRoom?.messages || [];

  const progressPercent =
    (activeRoom.legsHit / activeRoom.totalLegs) * 100 || 0;

  //
  // ------------------- SEND MESSAGE -------------------
  //

  const handleSendMessage = () => {
    const text = newMessage.trim();
    if (!text) return;

    const username = (profile.displayName || "Guest").trim() || "Guest";

    const newMsg = {
      id: Date.now(),
      user: username,
      text,
      timestamp: new Date().toISOString(),
    };

    setMarkets((prev) =>
      prev.map((market) =>
        market.id !== activeMarketId
          ? market
          : {
              ...market,
              rooms: market.rooms.map((room) =>
                room.id !== activeRoomId
                  ? room
                  : {
                      ...room,
                      messages: [...room.messages, newMsg],
                    }
              ),
            }
      )
    );

    setNewMessage("");
    setShowEmojiPicker(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  //
  // ------------------- EMOJI ADD -------------------
  //

  const handleAddEmoji = (emoji) => {
    setNewMessage((prev) => prev + emoji);
  };

  //
  // ------------------- MARKET / ROOM SWITCH -------------------
  //

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

  //
  // ------------------- FAKE CHATTER (MODE B: ACTIVE + READABLE) -------------------
  //   - faster cadence
  //   - always at least 1 msg
  //   - occasional 2–3 msg burst
  //   - light personality variation (caps/emoji)
  //

  useEffect(() => {
    const interval = setInterval(() => {
      setMarkets((prev) => {
        const marketForRoom = prev.find((m) => m.id === activeMarketId);
        if (!marketForRoom) return prev;

        const roomForChat = marketForRoom.rooms.find((r) => r.id === activeRoomId);
        if (!roomForChat) return prev;

        // scale activity gently with room size
        const activityFactor = Math.min(1, roomForChat.userCount / 220);

        // readable bursts: 1 always, sometimes 2, rarely 3
        const burstCount =
          1 +
          (Math.random() < 0.38 ? 1 : 0) +
          (Math.random() < activityFactor * 0.22 ? 1 : 0);

        const newMessages = Array.from({ length: burstCount }).map(() => {
          const persona = fakeChatUsers[Math.floor(Math.random() * fakeChatUsers.length)];
          const template = fakeChatMessages[Math.floor(Math.random() * fakeChatMessages.length)];

          // small style spice (readable, not spammy)
          let text = template;
          if (Math.random() < 0.18) text = text.toUpperCase();
          if (Math.random() < 0.22) text += " 🔥";
          if (Math.random() < 0.12) {
            const prefix = emojiOptions[Math.floor(Math.random() * emojiOptions.length)];
            text = `${prefix} ${text}`;
          }

          return {
            id: Date.now() + Math.random(),
            user: persona.name,
            text,
            timestamp: new Date().toISOString(),
          };
        });

        return prev.map((market) =>
          market.id !== activeMarketId
            ? market
            : {
                ...market,
                rooms: market.rooms.map((room) =>
                  room.id !== activeRoomId
                    ? room
                    : {
                        ...room,
                        messages: [...room.messages, ...newMessages],
                      }
                ),
              }
        );
      });
    }, 2200); // Mode B cadence

    return () => clearInterval(interval);
  }, [activeMarketId, activeRoomId]);

  //
  // ------------------- USER COUNT FLUCTUATION + ROOM SORTING -------------------
  //

  useEffect(() => {
    const interval = setInterval(() => {
      setMarkets((prev) =>
        prev.map((market) => {
          const updatedRooms = market.rooms
            .map((room) => ({
              ...room,
              userCount: Math.max(
                1,
                room.userCount + (Math.floor(Math.random() * 50) - 25)
              ),
            }))
            .sort((a, b) => b.userCount - a.userCount);

          if (market.id === activeMarketId) {
            const stillExists = updatedRooms.find((r) => r.id === activeRoomId);
            if (!stillExists && updatedRooms[0]) {
              setActiveRoomId(updatedRooms[0].id);
            }
          }

          return { ...market, rooms: updatedRooms };
        })
      );
    }, 6000);

    return () => clearInterval(interval);
  }, [activeMarketId, activeRoomId]);

  //
  // ------------------- LIVE GAME INIT + SWEAT FEED SEED -------------------
  //

  useEffect(() => {
    // reset live game when market/room changes
    setLiveGame(createInitialLiveGame(activeMarketId, activeRoom));

    // seed sweat feed with a few fake messages
    const seed = Array.from({ length: 3 }).map(() => {
      const user =
        fakeSweatUsers[Math.floor(Math.random() * fakeSweatUsers.length)];
      const text =
        sweatMessages[Math.floor(Math.random() * sweatMessages.length)];
      return {
        id: Date.now() + Math.random(),
        user,
        text,
        timestamp: new Date().toISOString(),
      };
    });
    setSweatFeed(seed);
  }, [activeMarketId, activeRoomId, activeRoom]);

  //
  // ------------------- LIVE GAME TICKER -------------------
  //

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveGame((prev) => tickLiveGame(prev));
    }, 13000);

    return () => clearInterval(interval);
  }, []);

  //
  // ------------------- SWEAT FEED TICK -------------------
  //

  useEffect(() => {
    const interval = setInterval(() => {
      const user =
        fakeSweatUsers[Math.floor(Math.random() * fakeSweatUsers.length)];
      const text =
        sweatMessages[Math.floor(Math.random() * sweatMessages.length)];

      const msg = {
        id: Date.now() + Math.random(),
        user,
        text,
        timestamp: new Date().toISOString(),
      };

      setSweatFeed((prev) => {
        const next = [msg, ...prev];
        return next.slice(0, 20);
      });
    }, 15000 + Math.random() * 8000);

    return () => clearInterval(interval);
  }, [activeRoomId]);

  //
  // ------------------- PROFILE HANDLERS -------------------
  //

  const openProfile = () => {
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
  // ------------------- LEADERBOARD / TOP ROOM -------------------
  //

  const topSweaters = [
    {
      name: "SlipKing89",
      emoji: "🔥",
      msgs: 2,
      hitRate: "62% HR",
      streak: "4x streak",
    },
    {
      name: "EVNerd",
      emoji: "🧠",
      msgs: 2,
      hitRate: "64% HR",
      streak: "5x streak",
    },
    {
      name: "BadBeatBilly",
      emoji: "💀",
      msgs: 2,
      hitRate: "48% HR",
      streak: "1x streak",
    },
    {
      name: "TeaserTom",
      emoji: "🧵",
      msgs: 2,
      hitRate: "59% HR",
      streak: "3x streak",
    },
  ];

  const youSweater = {
    name: profile.displayName || "You",
    emoji: profile.avatarEmoji || "🔥",
    msgs: 1,
    hitRate: "58% HR",
    streak: "2x streak",
    isYou: true,
  };

  const allSweaters = [...topSweaters, youSweater];

  const allRoomsFlat = markets.flatMap((m) =>
    m.rooms.map((room) => ({ ...room, marketLabel: m.label }))
  );
  const topRoom = allRoomsFlat.reduce((best, room) => {
    if (!best) return room;
    return room.userCount > best.userCount ? room : best;
  }, null);

  const topRoomProgress = topRoom ? 10 + (topRoom.userCount % 70) : 0;

  //
  // ------------------- CHAT UTILS (TYPING, GROUPING, SCROLL) -------------------
  //

  const isTyping = newMessage.trim().length > 0;

  const winProbTeamName =
    liveGame.winProbTeam === "home" ? liveGame.homeTeam : liveGame.awayTeam;

  const isNearBottom = () => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    return el.scrollTop + el.clientHeight >= el.scrollHeight - 80;
  };

  // smart auto scroll: only if user is already near bottom
  useEffect(() => {
    if (isNearBottom()) {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [activeRoomId, activeMessages.length]);

  // group consecutive messages from same user
  const groupMessages = (msgs) => {
    const groups = [];
    let current = null;

    msgs.forEach((msg) => {
      const time = formatTime(msg.timestamp);
      if (!current || current.user !== msg.user) {
        current = {
          user: msg.user,
          time,
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

return (
  <div className="app">
    <header className="app-header">
      <div className="brand-row">
        <h1>
          Slip Rooms <span className="brand-emoji">🎟️</span>
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
      </div>

      {topRoom && (
        <div className="top-room-banner top-room-banner-active">
          <div className="top-room-banner-left">
            <span className="top-room-banner-label">Top sweat right now</span>
            <span className="top-room-banner-title">{topRoom.name}</span>
            <span className="top-room-banner-sub">
              {topRoom.game} · {topRoom.odds}
            </span>
          </div>
          <div className="top-room-banner-right">
            <span className="top-room-banner-progress">{topRoomProgress}%</span>
            <span className="top-room-banner-users">
              {topRoom.userCount} in room
            </span>
          </div>
        </div>
      )}

      <p>
        Discord-style chat where every room sweats the exact same straight bet.
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

        <h2>Rooms</h2>
        <ul className="rooms-list">
          {activeMarket.rooms.map((room) => {
            const isActive = room.id === activeRoomId;
            return (
              <li
                key={room.id}
                className={isActive ? "room active" : "room"}
                onClick={() => handleRoomSelect(room.id)}
              >
                <div className="room-name">{room.name}</div>
                <div className="room-game">{room.game}</div>
                <div className="room-odds">{room.odds}</div>
                <div className="room-users">{room.userCount} users</div>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Chat */}
      <main className="chat">
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

          <div className="live-game-wp-label">
            Win probability{" "}
            <span className="live-game-wp-value">
              {Math.round(liveGame.winProb)}%
            </span>{" "}
            <span className="live-game-wp-team">
              {winProbTeamName}
            </span>
          </div>

          <div className="live-game-wp-bar">
            <div
              className={
                "live-game-wp-fill " +
                (liveGame.winProbTeam === "home"
                  ? "live-game-wp-fill-home"
                  : "live-game-wp-fill-away")
              }
              style={{ width: `${liveGame.winProb}%` }}
            />
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
                  <span className="message-user">{cluster.user}</span>
                  <span className="message-timestamp">{cluster.time}</span>
                </div>

                {cluster.messages.map((msg) => {
                  const extraClasses =
                    (msg.isSystem ? " message-system" : "") +
                    (msg.user === "Crowd" ? " message-crowd" : "");
                  return (
                    <div
                      key={msg.id}
                      className={"message message-bubble" + extraClasses}
                    >
                      <div className="message-text">{msg.text}</div>
                    </div>
                  );
                })}
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
        </main>
        {/* SLIP STATUS COLUMN */}
<aside className="slip-status-column">
  <div className="slip-status-inner">
    {/* SLIP STATUS — COLLAPSIBLE LIVE GAME */}
<div
  className={
    "live-game-collapsible" +
    (isLiveExpanded ? " live-game-expanded" : " live-game-collapsed")
  }
>
  {/* Header / Toggle */}
  <button
    type="button"
    className="live-game-toggle"
    onClick={() => setIsLiveExpanded((v) => !v)}
  >
    <span className="live-game-toggle-label">
      LIVE · {liveGame.awayTeam} {liveGame.awayScore}–{liveGame.homeScore}{" "}
      {liveGame.homeTeam}
    </span>
    <span className="live-game-toggle-chevron">
      {isLiveExpanded ? "▾" : "▸"}
    </span>
  </button>

  {/* Expanded content */}
  {isLiveExpanded && (
    <section className="live-game-card live-game-card-inline">
      <div className="live-game-header">
        <span className="live-game-label">Slip status</span>
        <span className="live-game-status">{liveGame.status}</span>
      </div>

      <div className="live-game-teams">
        <div
          className={
            "live-game-team" +
            (liveGame.possession === "away"
              ? " live-game-team-active"
              : "")
          }
        >
          <div className="live-game-team-name">{liveGame.awayTeam}</div>
          <div className="live-game-score">{liveGame.awayScore}</div>
        </div>

        <div
          className={
            "live-game-team" +
            (liveGame.possession === "home"
              ? " live-game-team-active"
              : "")
          }
        >
          <div className="live-game-team-name">{liveGame.homeTeam}</div>
          <div className="live-game-score">{liveGame.homeScore}</div>
        </div>
      </div>

      <div className="live-game-meta">
        <span>{liveGame.period}</span>
        {!liveGame.period.includes("th") && liveGame.clock && (
          <>
            <span>·</span>
            <span>{liveGame.clock}</span>
          </>
        )}
      </div>
    </section>
  )}
</div>
  </div>
</aside>

        
      </div>

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
}

export default App;
