// src/pages/GamePage.jsx
// Game page with the Betting Menu system - sport-specific categories and real player data

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getBettingCategories,
  COMMON_LINES,
  joinOrCreateRoom,
  subscribeToGameRooms,
} from "../services/roomService";
import { getTeamColor, extractTeamFromRoomName } from "../utils/teamColors";
import {
  getPlayersForCategory,
  getTeamsForGame,
} from "../services/playerService";
import "./GamePage.css";

export default function GamePage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Game data from URL params or fetch
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gameRooms, setGameRooms] = useState([]);

  // Prop Builder state
  const [showPropBuilder, setShowPropBuilder] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [builderStep, setBuilderStep] = useState(1);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedStat, setSelectedStat] = useState(null);
  const [selectedLine, setSelectedLine] = useState("");
  const [customLine, setCustomLine] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Player loading state
  const [players, setPlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState(false);
  const [manualPlayerName, setManualPlayerName] = useState("");

  // Get sport-specific categories
  const sport = game?.sport || "nfl";
  const categories = getBettingCategories(sport);

  // Parse game data from URL or fetch
  useEffect(() => {
    const storedGame = sessionStorage.getItem(`game_${gameId}`);
    if (storedGame) {
      setGame(JSON.parse(storedGame));
      setLoading(false);
    } else {
      // Create a placeholder game from the ID
      const parts = gameId.split("-");
      const away = parts[0]?.toUpperCase() || "AWAY";
      const home = parts[1]?.toUpperCase() || "HOME";
      setGame({
        id: gameId,
        away: { abbrev: away, name: away },
        home: { abbrev: home, name: home },
        status: "scheduled",
        time: "TBD",
        sport: "nfl",
      });
      setLoading(false);
    }
  }, [gameId]);

  // Subscribe to rooms for this game
  useEffect(() => {
    if (!gameId) return;
    const unsubscribe = subscribeToGameRooms(gameId, setGameRooms);
    return () => unsubscribe();
  }, [gameId]);

  // Load players when category is selected
  useEffect(() => {
    if (!selectedCategory || !selectedCategory.requiresPlayer || !game) {
      setPlayers([]);
      return;
    }

    async function loadPlayers() {
      setPlayersLoading(true);
      setPlayersError(false);
      setPlayers([]);

      try {
        const fetchedPlayers = await getPlayersForCategory(sport, game, selectedCategory);
        if (fetchedPlayers.length > 0) {
          setPlayers(fetchedPlayers);
        } else {
          setPlayersError(true);
        }
      } catch (error) {
        console.error("Error loading players:", error);
        setPlayersError(true);
      } finally {
        setPlayersLoading(false);
      }
    }

    loadPlayers();
  }, [selectedCategory, game, sport]);

  // Handle category click
  const handleCategoryClick = (category) => {
    if (category.isTrending) {
      // Show trending rooms - just scroll to active rooms section
      const activeRoomsSection = document.querySelector(".game-active-rooms");
      if (activeRoomsSection) {
        activeRoomsSection.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }

    setSelectedCategory(category);
    setShowPropBuilder(true);
    setPlayers([]);
    setPlayersError(false);
    setManualPlayerName("");

    // For team-based props (game lines), skip player selection
    if (category.teamBased || !category.requiresPlayer) {
      setBuilderStep(2); // Go straight to stat selection
      setSelectedPlayer(null);
    } else {
      setBuilderStep(1); // Start with player selection
    }

    setSelectedStat(null);
    setSelectedLine("");
    setCustomLine("");
  };

  // Handle player selection
  const handlePlayerSelect = (player) => {
    setSelectedPlayer(player);
    setBuilderStep(2);
  };

  // Handle manual player name submission
  const handleManualPlayerSubmit = () => {
    if (!manualPlayerName.trim()) return;
    const manualPlayer = {
      name: manualPlayerName.trim(),
      team: "",
      position: "",
      isManual: true,
    };
    handlePlayerSelect(manualPlayer);
  };

  // Handle team selection (for game lines)
  const handleTeamSelect = (team) => {
    setSelectedPlayer({ name: team.abbrev, team: team.abbrev, isTeam: true });
    setBuilderStep(2);
  };

  // Handle stat selection
  const handleStatSelect = (stat) => {
    setSelectedStat(stat);
    // Skip line step for stats that don't need it
    if (stat === "Moneyline" || stat === "Draw") {
      setSelectedLine("YES");
      setBuilderStep(4);
    } else {
      setBuilderStep(3);
    }
  };

  // Handle line selection
  const handleLineSelect = (line) => {
    setSelectedLine(line);
    setBuilderStep(4);
  };

  // Handle direction selection and create/join room
  const handleDirectionSelect = async (direction) => {
    setIsCreating(true);

    try {
      const playerName = selectedPlayer?.isTeam
        ? selectedPlayer.name
        : selectedPlayer
        ? `${selectedPlayer.name}${selectedPlayer.team ? ` (${selectedPlayer.team})` : ""}`
        : game?.home?.abbrev || "TEAM";

      const result = await joinOrCreateRoom({
        gameId,
        gameName: `${game?.away?.abbrev || "AWAY"} vs ${game?.home?.abbrev || "HOME"}`,
        player: playerName,
        stat: selectedStat,
        line: selectedLine,
        direction,
        sport: sport,
      });

      // Navigate to the room
      navigate(`/?room=${result.roomId}`);
    } catch (error) {
      console.error("Error creating/joining room:", error);
      alert("Failed to create room. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  // Close prop builder
  const closePropBuilder = () => {
    setShowPropBuilder(false);
    setSelectedCategory(null);
    setBuilderStep(1);
    setSelectedPlayer(null);
    setSelectedStat(null);
    setSelectedLine("");
    setCustomLine("");
    setPlayers([]);
    setPlayersError(false);
    setManualPlayerName("");
  };

  // Go back a step
  const goBack = () => {
    if (builderStep === 1 || (builderStep === 2 && !selectedCategory?.requiresPlayer)) {
      closePropBuilder();
    } else if (builderStep === 2) {
      setBuilderStep(1);
      setSelectedPlayer(null);
    } else if (builderStep === 3) {
      setBuilderStep(2);
      setSelectedStat(null);
    } else if (builderStep === 4) {
      // Go back to line selection or stat selection
      if (selectedStat === "Moneyline" || selectedStat === "Draw") {
        setBuilderStep(2);
        setSelectedStat(null);
      } else {
        setBuilderStep(3);
      }
      setSelectedLine("");
    }
  };

  // Get teams for game lines
  const teams = getTeamsForGame(game);

  if (loading) {
    return (
      <div className="game-page">
        <div className="game-page-loading">Loading game...</div>
      </div>
    );
  }

  return (
    <div className="game-page">
      {/* Header */}
      <div className="game-page-header">
        <button className="game-back-btn" onClick={() => navigate("/")}>
          ← Back to Games
        </button>

        <div className="game-header-content">
          <div className="game-matchup">
            <div className="game-team away">
              {game?.away?.logo && (
                <img src={game.away.logo} alt="" className="team-logo" />
              )}
              <span className="team-abbrev">{game?.away?.abbrev || "AWAY"}</span>
              <span className="team-name">{game?.away?.name || "Away Team"}</span>
            </div>

            <div className="game-vs">
              {game?.status === "live" ? (
                <div className="game-score">
                  <span className="score">{game?.awayScore || 0}</span>
                  <span className="score-divider">-</span>
                  <span className="score">{game?.homeScore || 0}</span>
                </div>
              ) : (
                <span className="vs-text">VS</span>
              )}
            </div>

            <div className="game-team home">
              {game?.home?.logo && (
                <img src={game.home.logo} alt="" className="team-logo" />
              )}
              <span className="team-abbrev">{game?.home?.abbrev || "HOME"}</span>
              <span className="team-name">{game?.home?.name || "Home Team"}</span>
            </div>
          </div>

          <div className="game-time">
            {game?.status === "live" ? (
              <span className="live-indicator">LIVE - {game?.time}</span>
            ) : (
              <span>{game?.time || "TBD"}</span>
            )}
          </div>
        </div>
      </div>

      {/* Betting Menu */}
      <div className="betting-menu">
        <h2 className="betting-menu-title">THE BETTING MENU</h2>
        <p className="betting-menu-subtitle">Pick your prop, join the sweat</p>

        <div className="betting-categories">
          {categories.map((category) => (
            <button
              key={category.id}
              className={`betting-category ${category.isTrending ? "trending" : ""}`}
              onClick={() => handleCategoryClick(category)}
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
      {gameRooms.length > 0 && (
        <div className="game-active-rooms">
          <h3 className="active-rooms-title">🔥 Active Rooms</h3>
          <div className="active-rooms-list">
            {gameRooms.slice(0, 5).map((room) => {
              const teamName = extractTeamFromRoomName(room.name);
              const teamColor = teamName ? getTeamColor(teamName, room.sport) : "#666";
              return (
                <button
                  key={room.id}
                  className="active-room-card"
                  onClick={() => navigate(`/?room=${room.id}`)}
                >
                  <span className="team-color-dot" style={{ backgroundColor: teamColor }}></span>
                  <span className="room-name">{room.name}</span>
                  <span className="room-users">
                    {room.userCount || 0} sweating
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Prop Builder Modal */}
      {showPropBuilder && (
        <div className="prop-builder-overlay" onClick={closePropBuilder}>
          <div
            className="prop-builder-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="prop-builder-header">
              <button className="prop-builder-back" onClick={goBack}>
                ← Back
              </button>
              <h2>
                {selectedCategory?.emoji} {selectedCategory?.name}
              </h2>
              <button className="prop-builder-close" onClick={closePropBuilder}>
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
              {/* Step 1: Pick Player (or Team for game lines) */}
              {builderStep === 1 && selectedCategory?.requiresPlayer && (
                <div className="builder-step">
                  <h3>Pick a Player</h3>

                  {playersLoading && (
                    <div className="players-loading">
                      <div className="loading-spinner"></div>
                      <p>Loading players...</p>
                    </div>
                  )}

                  {!playersLoading && playersError && (
                    <div className="players-error">
                      <p>Couldn't load players - type player name manually</p>
                      <div className="manual-player-input">
                        <input
                          type="text"
                          placeholder="Enter player name..."
                          value={manualPlayerName}
                          onChange={(e) => setManualPlayerName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleManualPlayerSubmit()}
                        />
                        <button
                          onClick={handleManualPlayerSubmit}
                          disabled={!manualPlayerName.trim()}
                        >
                          Use
                        </button>
                      </div>
                    </div>
                  )}

                  {!playersLoading && !playersError && players.length > 0 && (
                    <div className="player-grid">
                      {players.slice(0, 16).map((player, idx) => (
                        <button
                          key={player.id || `${player.name}-${idx}`}
                          className="player-btn"
                          onClick={() => handlePlayerSelect(player)}
                        >
                          <span className="player-name">{player.name}</span>
                          <span className="player-team">
                            {player.position && `${player.position} · `}{player.team}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {!playersLoading && !playersError && players.length === 0 && (
                    <div className="players-error">
                      <p>No players found - type player name manually</p>
                      <div className="manual-player-input">
                        <input
                          type="text"
                          placeholder="Enter player name..."
                          value={manualPlayerName}
                          onChange={(e) => setManualPlayerName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleManualPlayerSubmit()}
                        />
                        <button
                          onClick={handleManualPlayerSubmit}
                          disabled={!manualPlayerName.trim()}
                        >
                          Use
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Always show manual input option */}
                  {!playersLoading && players.length > 0 && (
                    <div className="manual-player-option">
                      <p>Don't see your player?</p>
                      <div className="manual-player-input">
                        <input
                          type="text"
                          placeholder="Type name..."
                          value={manualPlayerName}
                          onChange={(e) => setManualPlayerName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleManualPlayerSubmit()}
                        />
                        <button
                          onClick={handleManualPlayerSubmit}
                          disabled={!manualPlayerName.trim()}
                        >
                          Use
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 1 for Team-based props (Game Lines) */}
              {builderStep === 2 && selectedCategory?.teamBased && !selectedPlayer && (
                <div className="builder-step">
                  <h3>Pick a Team</h3>
                  <div className="team-grid">
                    {teams.map((team) => (
                      <button
                        key={team.abbrev}
                        className="team-btn"
                        onClick={() => handleTeamSelect(team)}
                      >
                        <span className="team-name">{team.name}</span>
                        <span className="team-tag">{team.isHome ? "HOME" : "AWAY"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Pick Stat */}
              {builderStep === 2 && (selectedPlayer || !selectedCategory?.requiresPlayer) && (
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
                        onClick={() => handleStatSelect(stat)}
                      >
                        {stat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Pick Line */}
              {builderStep === 3 && (
                <div className="builder-step">
                  <h3>Pick a Line</h3>
                  <div className="selected-info">
                    {selectedPlayer?.name} - {selectedStat}
                  </div>
                  <div className="line-grid">
                    {(COMMON_LINES[selectedStat] || []).map((line) => (
                      <button
                        key={line}
                        className={`line-btn ${selectedLine === line ? "selected" : ""}`}
                        onClick={() => handleLineSelect(line)}
                      >
                        {line}
                      </button>
                    ))}
                  </div>
                  <div className="custom-line">
                    <input
                      type="number"
                      step="0.5"
                      placeholder="Custom line..."
                      value={customLine}
                      onChange={(e) => setCustomLine(e.target.value)}
                    />
                    <button
                      className="custom-line-btn"
                      disabled={!customLine}
                      onClick={() => handleLineSelect(customLine)}
                    >
                      Use
                    </button>
                  </div>
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
                        onClick={() => handleDirectionSelect("YES")}
                        disabled={isCreating}
                      >
                        {isCreating ? "Creating..." : "🔥 SWEAT THIS"}
                      </button>
                    ) : (
                      <>
                        <button
                          className="direction-btn over"
                          onClick={() => handleDirectionSelect("OVER")}
                          disabled={isCreating}
                        >
                          {isCreating ? "..." : "⬆️ OVER"}
                        </button>
                        <button
                          className="direction-btn under"
                          onClick={() => handleDirectionSelect("UNDER")}
                          disabled={isCreating}
                        >
                          {isCreating ? "..." : "⬇️ UNDER"}
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
  );
}
