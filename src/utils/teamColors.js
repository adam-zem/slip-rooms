// src/utils/teamColors.js
// Team primary colors for visual indicators

// NBA Teams
const NBA_COLORS = {
  "lakers": "#552583",
  "celtics": "#007A33",
  "warriors": "#1D428A",
  "bulls": "#CE1141",
  "heat": "#98002E",
  "knicks": "#006BB6",
  "nets": "#000000",
  "76ers": "#006BB6",
  "sixers": "#006BB6",
  "bucks": "#00471B",
  "suns": "#1D1160",
  "kings": "#5A2D81",
  "thunder": "#007AC1",
  "mavericks": "#00538C",
  "mavs": "#00538C",
  "nuggets": "#0E2240",
  "timberwolves": "#0C2340",
  "wolves": "#0C2340",
  "grizzlies": "#5D76A9",
  "pelicans": "#0C2340",
  "spurs": "#C4CED4",
  "hawks": "#E03A3E",
  "cavaliers": "#860038",
  "cavs": "#860038",
  "raptors": "#CE1141",
  "magic": "#0077C0",
  "pacers": "#002D62",
  "hornets": "#1D1160",
  "pistons": "#C8102E",
  "wizards": "#002B5C",
  "trail blazers": "#E03A3E",
  "blazers": "#E03A3E",
  "jazz": "#002B5C",
  "clippers": "#C8102E",
  "rockets": "#CE1141",
};

// NFL Teams
const NFL_COLORS = {
  "chiefs": "#E31837",
  "eagles": "#004C54",
  "cowboys": "#003594",
  "bills": "#00338D",
  "49ers": "#AA0000",
  "niners": "#AA0000",
  "ravens": "#241773",
  "bengals": "#FB4F14",
  "lions": "#0076B6",
  "dolphins": "#008E97",
  "packers": "#203731",
  "jets": "#125740",
  "steelers": "#FFB612",
  "vikings": "#4F2683",
  "chargers": "#0080C6",
  "commanders": "#5A1414",
  "bears": "#0B162A",
  "saints": "#D3BC8D",
  "falcons": "#A71930",
  "broncos": "#FB4F14",
  "cardinals": "#97233F",
  "raiders": "#000000",
  "browns": "#311D00",
  "seahawks": "#002244",
  "rams": "#003594",
  "texans": "#03202F",
  "panthers": "#0085CA",
  "titans": "#0C2340",
  "colts": "#002C5F",
  "jaguars": "#006778",
  "jags": "#006778",
  "giants": "#0B2265",
  "buccaneers": "#D50A0A",
  "bucs": "#D50A0A",
  "patriots": "#002244",
  "pats": "#002244",
};

// NHL Teams
const NHL_COLORS = {
  "devils": "#CE1126",
  "rangers": "#0038A8",
  "islanders": "#003087",
  "penguins": "#FCB514",
  "pens": "#FCB514",
  "bruins": "#FCB514",
  "maple leafs": "#003E7E",
  "leafs": "#003E7E",
  "canadiens": "#AF1E2D",
  "habs": "#AF1E2D",
  "flyers": "#F74902",
  "capitals": "#C8102E",
  "caps": "#C8102E",
  "lightning": "#002868",
  "bolts": "#002868",
  "panthers": "#041E42",
  "red wings": "#CE1126",
  "blackhawks": "#CF0A2C",
  "hawks": "#CF0A2C",
  "blues": "#002F87",
  "stars": "#006847",
  "avalanche": "#6F263D",
  "avs": "#6F263D",
  "wild": "#154734",
  "jets": "#041E42",
  "predators": "#FFB81C",
  "preds": "#FFB81C",
  "flames": "#D2001C",
  "oilers": "#041E42",
  "canucks": "#00205B",
  "kraken": "#99D9D9",
  "golden knights": "#B4975A",
  "knights": "#B4975A",
  "hurricanes": "#CC0000",
  "canes": "#CC0000",
  "blue jackets": "#002654",
  "jackets": "#002654",
  "senators": "#C52032",
  "sens": "#C52032",
  "sabres": "#002654",
  "ducks": "#F47A38",
  "sharks": "#006D75",
  "kings": "#111111",
};

// MLB Teams
const MLB_COLORS = {
  "yankees": "#003087",
  "red sox": "#BD3039",
  "dodgers": "#005A9C",
  "giants": "#FD5A1E",
  "cubs": "#0E3386",
  "white sox": "#27251F",
  "mets": "#002D72",
  "phillies": "#E81828",
  "braves": "#CE1141",
  "cardinals": "#C41E3A",
  "astros": "#EB6E1F",
  "rangers": "#003278",
  "mariners": "#0C2C56",
  "padres": "#2F241D",
  "diamondbacks": "#A71930",
  "dbacks": "#A71930",
  "rockies": "#333366",
  "twins": "#002B5C",
  "guardians": "#00385D",
  "tigers": "#0C2340",
  "royals": "#004687",
  "athletics": "#003831",
  "a's": "#003831",
  "rays": "#092C5C",
  "blue jays": "#134A8E",
  "jays": "#134A8E",
  "orioles": "#DF4601",
  "nationals": "#AB0003",
  "nats": "#AB0003",
  "marlins": "#00A3E0",
  "brewers": "#12284B",
  "reds": "#C6011F",
  "pirates": "#27251F",
  "angels": "#BA0021",
};

// Soccer Teams (MLS + common international)
const SOCCER_COLORS = {
  "la galaxy": "#00245D",
  "galaxy": "#00245D",
  "lafc": "#C39E6D",
  "inter miami": "#F7B5CD",
  "miami": "#F7B5CD",
  "atlanta united": "#80000A",
  "atlanta": "#80000A",
  "seattle sounders": "#658D1B",
  "sounders": "#658D1B",
  "portland timbers": "#004812",
  "timbers": "#004812",
  "nycfc": "#6CACE4",
  "red bulls": "#D50032",
  "sporting kc": "#93B1D7",
  "sporting": "#93B1D7",
  "fc dallas": "#BF0D3E",
  "dallas": "#BF0D3E",
  "houston dynamo": "#F68712",
  "dynamo": "#F68712",
  "columbus crew": "#FEDD00",
  "crew": "#FEDD00",
  "chicago fire": "#AF2626",
  "fire": "#AF2626",
  "minnesota united": "#E4E5E6",
  "loons": "#E4E5E6",
  "nashville sc": "#ECE83A",
  "nashville": "#ECE83A",
  "austin fc": "#00B140",
  "austin": "#00B140",
  "charlotte fc": "#1A85C8",
  "charlotte": "#1A85C8",
  "st louis city": "#D22630",
  "st louis": "#D22630",
};

// Default color for unknown teams
const DEFAULT_COLOR = "#666666";

// All colors combined for lookup
const ALL_TEAM_COLORS = {
  ...NBA_COLORS,
  ...NFL_COLORS,
  ...NHL_COLORS,
  ...MLB_COLORS,
  ...SOCCER_COLORS,
};

/**
 * Get the primary color for a team
 * @param {string} teamName - Full team name or nickname (e.g., "Los Angeles Lakers", "Lakers", "LAL")
 * @param {string} sport - Optional sport hint for disambiguation (e.g., "nba", "nfl")
 * @returns {string} Hex color string
 */
export function getTeamColor(teamName, sport) {
  if (!teamName) return DEFAULT_COLOR;

  // Normalize the team name
  const normalized = teamName.toLowerCase().trim();

  // Direct lookup
  if (ALL_TEAM_COLORS[normalized]) {
    return ALL_TEAM_COLORS[normalized];
  }

  // Try extracting just the team name (last word or last two words)
  const parts = normalized.split(" ");

  // Try last word (e.g., "Lakers" from "Los Angeles Lakers")
  if (parts.length > 1) {
    const lastWord = parts[parts.length - 1];
    if (ALL_TEAM_COLORS[lastWord]) {
      return ALL_TEAM_COLORS[lastWord];
    }

    // Try last two words (e.g., "Red Sox", "Blue Jackets", "Trail Blazers")
    if (parts.length >= 2) {
      const lastTwoWords = parts.slice(-2).join(" ");
      if (ALL_TEAM_COLORS[lastTwoWords]) {
        return ALL_TEAM_COLORS[lastTwoWords];
      }
    }
  }

  // Sport-specific lookup for disambiguation
  if (sport) {
    const sportLower = sport.toLowerCase();
    let sportColors = {};

    switch (sportLower) {
      case "nba":
      case "basketball":
        sportColors = NBA_COLORS;
        break;
      case "nfl":
      case "football":
        sportColors = NFL_COLORS;
        break;
      case "nhl":
      case "hockey":
        sportColors = NHL_COLORS;
        break;
      case "mlb":
      case "baseball":
        sportColors = MLB_COLORS;
        break;
      case "soccer":
      case "mls":
        sportColors = SOCCER_COLORS;
        break;
    }

    // Try finding in sport-specific colors
    for (const key of Object.keys(sportColors)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return sportColors[key];
      }
    }
  }

  // Fuzzy match - check if any key is contained in the team name
  for (const [key, color] of Object.entries(ALL_TEAM_COLORS)) {
    if (normalized.includes(key)) {
      return color;
    }
  }

  return DEFAULT_COLOR;
}

/**
 * Extract team name from a room name or bet description
 * e.g., "LAKERS -5.5" -> "Lakers"
 * e.g., "JOSH ALLEN OVER 275.5 PASS YDS" -> null (player prop)
 */
export function extractTeamFromRoomName(roomName) {
  if (!roomName) return null;

  const normalized = roomName.toLowerCase();

  // Check for common team-based bet patterns
  // Try to match against known team names
  for (const teamKey of Object.keys(ALL_TEAM_COLORS)) {
    if (normalized.includes(teamKey)) {
      // Return the original casing from room name
      const regex = new RegExp(teamKey, "i");
      const match = roomName.match(regex);
      return match ? match[0] : teamKey;
    }
  }

  return null;
}

export { DEFAULT_COLOR, NBA_COLORS, NFL_COLORS, NHL_COLORS, MLB_COLORS, SOCCER_COLORS };
