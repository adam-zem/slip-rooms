// src/services/filterService.js
// Profanity filter service for SlipRooms
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";

// Character substitution map for bypass detection
const CHAR_SUBSTITUTIONS = {
  a: ["a", "@", "4", "^", "∂", "α"],
  b: ["b", "8", "ß", "β"],
  c: ["c", "(", "{", "<", "¢", "©"],
  d: ["d", "∂"],
  e: ["e", "3", "€", "£", "ε"],
  f: ["f", "ƒ", "ph"],
  g: ["g", "9", "6"],
  h: ["h", "#"],
  i: ["i", "1", "!", "|", "l", "¡", "ι"],
  j: ["j"],
  k: ["k", "x"],
  l: ["l", "1", "|", "i", "£"],
  m: ["m"],
  n: ["n", "ñ", "η"],
  o: ["o", "0", "()", "[]", "ø", "σ", "θ"],
  p: ["p", "ρ"],
  q: ["q", "9"],
  r: ["r", "®", "я"],
  s: ["s", "$", "5", "§", "ś"],
  t: ["t", "+", "7", "†"],
  u: ["u", "v", "µ", "υ"],
  v: ["v", "u", "√"],
  w: ["w", "vv", "ω"],
  x: ["x", "×", "*"],
  y: ["y", "¥", "γ"],
  z: ["z", "2", "ż"],
};

// Cache for banned words to avoid repeated fetches
let bannedWordsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 60000; // 1 minute cache

/**
 * Get all banned words from Firebase
 */
export async function getBannedWords() {
  const bannedWordsRef = collection(db, "bannedWords");
  const q = query(bannedWordsRef, orderBy("word", "asc"));
  const snapshot = await getDocs(q);

  const words = [];
  snapshot.forEach((doc) => {
    words.push({ id: doc.id, ...doc.data() });
  });

  return words;
}

/**
 * Subscribe to banned words in real-time
 */
export function subscribeToBannedWords(callback) {
  const bannedWordsRef = collection(db, "bannedWords");
  const q = query(bannedWordsRef, orderBy("word", "asc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const words = [];
      snapshot.forEach((doc) => {
        words.push({ id: doc.id, ...doc.data() });
      });
      // Update cache
      bannedWordsCache = words;
      cacheTimestamp = Date.now();
      callback(words);
    },
    (error) => {
      console.error("Error subscribing to banned words:", error);
      callback([]);
    }
  );
}

/**
 * Add a new banned word
 */
export async function addBannedWord(word, category = "general") {
  const bannedWordsRef = collection(db, "bannedWords");

  // Normalize the word
  const normalizedWord = word.toLowerCase().trim();

  // Check if already exists
  const existing = await getBannedWords();
  if (existing.some(w => w.word === normalizedWord)) {
    throw new Error("Word already exists in filter");
  }

  const docRef = await addDoc(bannedWordsRef, {
    word: normalizedWord,
    category,
    enabled: true,
    createdAt: serverTimestamp(),
  });

  // Invalidate cache
  bannedWordsCache = null;

  return docRef.id;
}

/**
 * Update a banned word
 */
export async function updateBannedWord(wordId, updates) {
  const wordRef = doc(db, "bannedWords", wordId);
  await updateDoc(wordRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  // Invalidate cache
  bannedWordsCache = null;
}

/**
 * Toggle a banned word on/off
 */
export async function toggleBannedWord(wordId, enabled) {
  await updateBannedWord(wordId, { enabled });
}

/**
 * Delete a banned word
 */
export async function deleteBannedWord(wordId) {
  const wordRef = doc(db, "bannedWords", wordId);
  await deleteDoc(wordRef);

  // Invalidate cache
  bannedWordsCache = null;
}

/**
 * Log a filter violation
 */
export async function logFilterViolation(userId, username, text, matchedWord, context = "chat") {
  const logsRef = collection(db, "filterLogs");

  await addDoc(logsRef, {
    userId,
    username,
    originalText: text,
    matchedWord,
    context, // "chat", "username", "room_name"
    timestamp: serverTimestamp(),
  });
}

/**
 * Get filter logs (admin only)
 */
export async function getFilterLogs(limitCount = 100) {
  const logsRef = collection(db, "filterLogs");
  const q = query(logsRef, orderBy("timestamp", "desc"), limit(limitCount));
  const snapshot = await getDocs(q);

  const logs = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    logs.push({
      id: doc.id,
      ...data,
      timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
    });
  });

  return logs;
}

/**
 * Subscribe to filter logs in real-time
 */
export function subscribeToFilterLogs(callback, limitCount = 100) {
  const logsRef = collection(db, "filterLogs");
  const q = query(logsRef, orderBy("timestamp", "desc"), limit(limitCount));

  return onSnapshot(
    q,
    (snapshot) => {
      const logs = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
        });
      });
      callback(logs);
    },
    (error) => {
      console.error("Error subscribing to filter logs:", error);
      callback([]);
    }
  );
}

/**
 * Normalize text for comparison - removes spaces, converts substitutions
 */
function normalizeText(text) {
  if (!text) return "";

  let normalized = text.toLowerCase();

  // Remove spaces between single characters (catches "f u c k")
  normalized = normalized.replace(/(\w)\s+(?=\w(\s|$))/g, "$1");

  // Remove common separators
  normalized = normalized.replace(/[\s\-_.!@#$%^&*()+=\[\]{}|\\:;"'<>,?/~`]+/g, "");

  // Replace common substitutions with their letter equivalents
  for (const [letter, subs] of Object.entries(CHAR_SUBSTITUTIONS)) {
    for (const sub of subs) {
      if (sub.length > 1) {
        // Multi-char substitutions (like "ph" for "f")
        normalized = normalized.split(sub).join(letter);
      } else {
        normalized = normalized.split(sub).join(letter);
      }
    }
  }

  // Remove repeated letters (catches "fuuuuck" -> "fuck")
  normalized = normalized.replace(/(.)\1{2,}/g, "$1$1");

  return normalized;
}

/**
 * Check if text contains any banned words
 * Returns { isClean: boolean, matchedWord: string | null }
 */
export async function checkText(text) {
  if (!text || typeof text !== "string") {
    return { isClean: true, matchedWord: null };
  }

  // Get banned words (use cache if available and fresh)
  let words;
  if (bannedWordsCache && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    words = bannedWordsCache;
  } else {
    words = await getBannedWords();
    bannedWordsCache = words;
    cacheTimestamp = Date.now();
  }

  // Only check enabled words
  const enabledWords = words.filter(w => w.enabled);

  // Normalize the input text
  const normalizedInput = normalizeText(text);
  const originalLower = text.toLowerCase();

  for (const wordObj of enabledWords) {
    const bannedWord = wordObj.word;
    const normalizedBanned = normalizeText(bannedWord);

    // Check normalized version (catches substitutions and spacing tricks)
    if (normalizedInput.includes(normalizedBanned)) {
      return { isClean: false, matchedWord: bannedWord };
    }

    // Also check original lowercase (for exact matches)
    if (originalLower.includes(bannedWord)) {
      return { isClean: false, matchedWord: bannedWord };
    }

    // Check with word boundaries (to avoid false positives on substrings)
    const wordRegex = new RegExp(`\\b${escapeRegex(bannedWord)}\\b`, "i");
    if (wordRegex.test(text)) {
      return { isClean: false, matchedWord: bannedWord };
    }
  }

  return { isClean: true, matchedWord: null };
}

/**
 * Check text synchronously using cached words (for faster UI feedback)
 * Falls back to allowing if cache is empty
 */
export function checkTextSync(text) {
  if (!text || typeof text !== "string") {
    return { isClean: true, matchedWord: null };
  }

  // Use cache - if no cache, allow (will be checked async on send)
  if (!bannedWordsCache || bannedWordsCache.length === 0) {
    return { isClean: true, matchedWord: null };
  }

  const enabledWords = bannedWordsCache.filter(w => w.enabled);
  const normalizedInput = normalizeText(text);
  const originalLower = text.toLowerCase();

  for (const wordObj of enabledWords) {
    const bannedWord = wordObj.word;
    const normalizedBanned = normalizeText(bannedWord);

    if (normalizedInput.includes(normalizedBanned)) {
      return { isClean: false, matchedWord: bannedWord };
    }

    if (originalLower.includes(bannedWord)) {
      return { isClean: false, matchedWord: bannedWord };
    }
  }

  return { isClean: true, matchedWord: null };
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Pre-load the banned words cache
 */
export async function preloadBannedWords() {
  const words = await getBannedWords();
  bannedWordsCache = words;
  cacheTimestamp = Date.now();
  return words.length;
}

/**
 * Clear the cache (useful for testing or force refresh)
 */
export function clearCache() {
  bannedWordsCache = null;
  cacheTimestamp = null;
}

/**
 * Get default banned words list
 * This is a comprehensive list - admins can modify later
 */
export function getDefaultBannedWords() {
  return [
    // Profanity
    { word: "fuck", category: "profanity" },
    { word: "fucking", category: "profanity" },
    { word: "fucker", category: "profanity" },
    { word: "fucked", category: "profanity" },
    { word: "shit", category: "profanity" },
    { word: "shitting", category: "profanity" },
    { word: "bullshit", category: "profanity" },
    { word: "bitch", category: "profanity" },
    { word: "bitches", category: "profanity" },
    { word: "ass", category: "profanity" },
    { word: "asshole", category: "profanity" },
    { word: "bastard", category: "profanity" },
    { word: "damn", category: "profanity" },
    { word: "cunt", category: "profanity" },
    { word: "cock", category: "profanity" },
    { word: "dick", category: "profanity" },
    { word: "pussy", category: "profanity" },
    { word: "piss", category: "profanity" },
    { word: "whore", category: "profanity" },
    { word: "slut", category: "profanity" },
    { word: "crap", category: "profanity" },

    // Racial slurs
    { word: "nigger", category: "racial" },
    { word: "nigga", category: "racial" },
    { word: "negro", category: "racial" },
    { word: "chink", category: "racial" },
    { word: "gook", category: "racial" },
    { word: "spic", category: "racial" },
    { word: "wetback", category: "racial" },
    { word: "beaner", category: "racial" },
    { word: "kike", category: "racial" },
    { word: "jap", category: "racial" },
    { word: "paki", category: "racial" },
    { word: "raghead", category: "racial" },
    { word: "towelhead", category: "racial" },
    { word: "cracker", category: "racial" },
    { word: "honky", category: "racial" },
    { word: "redskin", category: "racial" },
    { word: "coon", category: "racial" },
    { word: "darkie", category: "racial" },
    { word: "sambo", category: "racial" },
    { word: "zipperhead", category: "racial" },

    // Homophobic slurs
    { word: "fag", category: "homophobic" },
    { word: "faggot", category: "homophobic" },
    { word: "dyke", category: "homophobic" },
    { word: "homo", category: "homophobic" },
    { word: "queer", category: "homophobic" },
    { word: "tranny", category: "homophobic" },
    { word: "shemale", category: "homophobic" },

    // Other offensive terms
    { word: "retard", category: "ableist" },
    { word: "retarded", category: "ableist" },
    { word: "tard", category: "ableist" },
    { word: "spaz", category: "ableist" },
    { word: "cripple", category: "ableist" },

    // Threats/Violence
    { word: "kill yourself", category: "violence" },
    { word: "kys", category: "violence" },
    { word: "rape", category: "violence" },
    { word: "molest", category: "violence" },
  ];
}

/**
 * Populate Firebase with default banned words
 * Only adds words that don't already exist
 */
export async function populateDefaultBannedWords() {
  const defaultWords = getDefaultBannedWords();
  const existingWords = await getBannedWords();
  const existingSet = new Set(existingWords.map(w => w.word));

  let addedCount = 0;
  const bannedWordsRef = collection(db, "bannedWords");

  for (const wordObj of defaultWords) {
    if (!existingSet.has(wordObj.word)) {
      await addDoc(bannedWordsRef, {
        word: wordObj.word,
        category: wordObj.category,
        enabled: true,
        createdAt: serverTimestamp(),
      });
      addedCount++;
    }
  }

  // Invalidate cache
  bannedWordsCache = null;

  return addedCount;
}

export default {
  getBannedWords,
  subscribeToBannedWords,
  addBannedWord,
  updateBannedWord,
  toggleBannedWord,
  deleteBannedWord,
  logFilterViolation,
  getFilterLogs,
  subscribeToFilterLogs,
  checkText,
  checkTextSync,
  preloadBannedWords,
  clearCache,
  getDefaultBannedWords,
  populateDefaultBannedWords,
};
