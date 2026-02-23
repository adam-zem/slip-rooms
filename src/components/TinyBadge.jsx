// TinyBadge.jsx - Small badge icon displayed next to usernames
import "./TinyBadge.css";

export default function TinyBadge({ badgeId, size = 16 }) {
  if (!badgeId) return null;

  // Founding Father badge - gold shield with FF
  if (badgeId === "founding_father") {
    return (
      <span
        className="tiny-badge ff"
        style={{
          width: size,
          height: size * 1.15,
          fontSize: size * 0.5,
        }}
        title="Founding Father"
      >
        FF
      </span>
    );
  }

  // Rookie badge - emerald shield with SR
  if (badgeId === "rookie") {
    return (
      <span
        className="tiny-badge rookie"
        style={{
          width: size,
          height: size * 1.15,
          fontSize: size * 0.5,
        }}
        title="Rookie"
      >
        SR
      </span>
    );
  }

  // Unknown badge
  return null;
}
