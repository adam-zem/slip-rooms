// BadgeModal.jsx - Badge collection modal with shield design
import { useState, useEffect } from "react";
import { getUserBadges, getAllBadges, setDisplayBadge, removeDisplayBadge, TOTAL_BADGE_SLOTS, getBadgeInfo } from "../services/badgeService";
import "./BadgeModal.css";

// Shield Badge Component - Rookie (emerald) and Founding Father (gold)
function ShieldBadge({ badgeId, unlocked, isEquipped, size = 64 }) {
  if (!unlocked) {
    // Locked badge - gray shield outline with ?
    return (
      <div className="shield-badge locked" style={{ width: size, height: size * 1.15 }}>
        <span className="shield-question" style={{ fontSize: size * 0.4 }}>?</span>
      </div>
    );
  }

  // Founding Father badge - gold with FF, stars, laurels
  if (badgeId === "founding_father") {
    return (
      <div className="shield-badge-container founding-father" style={{ width: size, height: size * 1.3 }}>
        <div className="shield-badge ff-badge" style={{ width: size, height: size * 1.15 }}>
          {/* Three stars at top */}
          <div className="ff-stars" style={{ fontSize: size * 0.18 }}>★★★</div>
          {/* Laurel wreath left */}
          <div className="ff-laurel left" style={{ fontSize: size * 0.25 }}>❮</div>
          {/* FF text */}
          <span className="ff-text" style={{ fontSize: size * 0.32 }}>FF</span>
          {/* Laurel wreath right */}
          <div className="ff-laurel right" style={{ fontSize: size * 0.25 }}>❯</div>
          {/* EST 2025 */}
          <div className="ff-est" style={{ fontSize: size * 0.12 }}>EST. 2025</div>
          {/* FOUNDER banner */}
          <div className="ff-banner" style={{ fontSize: size * 0.11, width: size * 0.8 }}>FOUNDER</div>
        </div>
        {/* Ribbon tails */}
        <div className="shield-ribbon gold" style={{ top: size * 0.95 }}>
          <div className="ribbon-tail left" style={{ width: size * 0.22, height: size * 0.2 }} />
          <div className="ribbon-tail right" style={{ width: size * 0.22, height: size * 0.2 }} />
        </div>
        {/* Equipped indicator */}
        {isEquipped && (
          <div className="equipped-indicator gold">
            <span>✓</span>
          </div>
        )}
      </div>
    );
  }

  // Rookie badge - emerald with SR and star
  return (
    <div className="shield-badge-container" style={{ width: size, height: size * 1.2 }}>
      <div className="shield-badge unlocked" style={{ width: size, height: size * 1.15 }}>
        <span className="shield-star" style={{ fontSize: size * 0.35 }}>★</span>
        <span className="shield-text" style={{ fontSize: size * 0.28 }}>SR</span>
      </div>
      {/* Ribbon tails */}
      <div className="shield-ribbon" style={{ top: size * 0.95 }}>
        <div className="ribbon-tail left" style={{ width: size * 0.22, height: size * 0.2 }} />
        <div className="ribbon-tail right" style={{ width: size * 0.22, height: size * 0.2 }} />
      </div>
      {/* Equipped indicator */}
      {isEquipped && (
        <div className="equipped-indicator">
          <span>✓</span>
        </div>
      )}
    </div>
  );
}

// Rarity label component
function RarityLabel({ rarity }) {
  if (rarity === "legendary") {
    return <span className="rarity-label legendary">LEGENDARY</span>;
  }
  if (rarity === "common") {
    return <span className="rarity-label common">COMMON</span>;
  }
  return null;
}

export default function BadgeModal({ isOpen, onClose, userId, isOwnProfile, displayBadgeId, onBadgeChanged }) {
  const [userBadges, setUserBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [settingDisplay, setSettingDisplay] = useState(false);

  const allBadges = getAllBadges();

  useEffect(() => {
    if (isOpen && userId) {
      loadBadges();
      setSelectedBadge(null);
    }
  }, [isOpen, userId]);

  const loadBadges = async () => {
    setLoading(true);
    try {
      const badges = await getUserBadges(userId);
      setUserBadges(badges);
    } catch (error) {
      console.error("Error loading badges:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasBadge = (badgeId) => {
    return userBadges.some(b => b.badgeId === badgeId);
  };

  const getBadgeUnlockDate = (badgeId) => {
    const badge = userBadges.find(b => b.badgeId === badgeId);
    if (!badge) return null;
    return new Date(badge.unlockedAt).toLocaleDateString();
  };

  const handleBadgeClick = (badge) => {
    if (hasBadge(badge.id)) {
      setSelectedBadge(badge);
    }
  };

  const handleEquipBadge = async () => {
    if (!selectedBadge || !isOwnProfile || settingDisplay) return;

    setSettingDisplay(true);
    try {
      const isCurrentlyEquipped = displayBadgeId === selectedBadge.id;
      if (isCurrentlyEquipped) {
        await removeDisplayBadge(userId);
      } else {
        await setDisplayBadge(userId, selectedBadge.id);
      }
      onBadgeChanged?.();
      setSelectedBadge(null);
    } catch (error) {
      console.error("Error updating badge:", error);
    } finally {
      setSettingDisplay(false);
    }
  };

  if (!isOpen) return null;

  // Calculate locked slots
  const earnedCount = userBadges.length;
  const lockedSlots = Math.max(0, TOTAL_BADGE_SLOTS - earnedCount);

  return (
    <div className="badge-modal-overlay" onClick={onClose}>
      <div className="badge-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="badge-modal-header">
          {selectedBadge ? (
            <button className="badge-back" onClick={() => setSelectedBadge(null)}>
              ← Back
            </button>
          ) : (
            <div className="badge-header-title">
              <span className="badge-header-icon">🛡️</span>
              <h2>BADGES</h2>
            </div>
          )}
          <button className="badge-modal-close" onClick={onClose}>&times;</button>
        </div>

        {loading ? (
          <div className="badge-loading">
            <div className="spinner" />
          </div>
        ) : selectedBadge ? (
          // Badge Detail View
          <div className={`badge-detail ${selectedBadge.id === "founding_father" ? "ff-detail" : ""}`}>
            <div className="badge-detail-content">
              <ShieldBadge
                badgeId={selectedBadge.id}
                unlocked={true}
                isEquipped={displayBadgeId === selectedBadge.id}
                size={100}
              />
              <h3 className={`badge-detail-name ${selectedBadge.id === "founding_father" ? "gold" : ""}`}>
                {selectedBadge.name}
              </h3>
              <p className="badge-detail-description">{selectedBadge.description}</p>
              <p className="badge-detail-date">Unlocked: {getBadgeUnlockDate(selectedBadge.id)}</p>

              {/* Rarity label */}
              <div className="badge-detail-rarity">
                <RarityLabel rarity={selectedBadge.rarity} />
              </div>

              {isOwnProfile && (
                <button
                  className={`badge-equip-btn ${displayBadgeId === selectedBadge.id ? 'equipped' : ''} ${selectedBadge.id === "founding_father" ? 'gold' : ''}`}
                  onClick={handleEquipBadge}
                  disabled={settingDisplay}
                >
                  {settingDisplay ? '...' : (
                    <>
                      <span className="equip-icon">{displayBadgeId === selectedBadge.id ? '✓' : '🛡️'}</span>
                      {displayBadgeId === selectedBadge.id ? 'Equipped' : 'Equip Badge'}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ) : !isOwnProfile ? (
          // Other user's profile - only show their displayed badge
          <div className="badge-other-user">
            {displayBadgeId ? (
              <div className="badge-displayed-container">
                <span className="badge-displayed-label">DISPLAYED BADGE</span>
                {(() => {
                  const displayedBadge = allBadges.find(b => b.id === displayBadgeId);
                  if (!displayedBadge) return null;
                  return (
                    <>
                      <ShieldBadge
                        badgeId={displayedBadge.id}
                        unlocked={true}
                        isEquipped={true}
                        size={80}
                      />
                      <h3 className={`badge-detail-name ${displayedBadge.id === "founding_father" ? "gold" : ""}`}>
                        {displayedBadge.name}
                      </h3>
                      <p className="badge-detail-description">{displayedBadge.description}</p>
                      <RarityLabel rarity={displayedBadge.rarity} />
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="badge-no-display">
                <span className="badge-no-display-icon">🛡️</span>
                <p className="badge-no-display-text">No badge displayed</p>
                <p className="badge-no-display-subtext">This user hasn't equipped a badge</p>
              </div>
            )}
          </div>
        ) : (
          // Own profile - Badge Grid with all badges
          <div className="badge-grid-scroll">
            <div className="badge-grid">
              {/* Earned badges first */}
              {allBadges.map((badge) => {
                const unlocked = hasBadge(badge.id);
                if (!unlocked) return null;
                return (
                  <div
                    key={badge.id}
                    className={`badge-item unlocked ${badge.id === "founding_father" ? "ff-item" : ""}`}
                    onClick={() => handleBadgeClick(badge)}
                  >
                    <ShieldBadge
                      badgeId={badge.id}
                      unlocked={true}
                      isEquipped={displayBadgeId === badge.id}
                      size={56}
                    />
                    <span className={`badge-name ${badge.id === "founding_father" ? "gold" : ""}`}>{badge.name}</span>
                    <RarityLabel rarity={badge.rarity} />
                  </div>
                );
              })}

              {/* Locked slots */}
              {[...Array(lockedSlots)].map((_, i) => (
                <div key={`locked-${i}`} className="badge-item locked">
                  <ShieldBadge unlocked={false} size={56} />
                  <span className="badge-name">???</span>
                  <span className="badge-subtext">???</span>
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <p className="badge-footer-hint">Complete challenges to unlock badges</p>
          </div>
        )}
      </div>
    </div>
  );
}
