// src/services/gifService.js
// GIF search service using GIPHY API (free tier)

// GIPHY API key - free SDK/demo key
// For production, get your own key at https://developers.giphy.com/
const GIPHY_API_KEY = "GlVGYHkr3WSBnllca54iNt0yFbjz7L65"; // GIPHY SDK key

/**
 * Search for GIFs using GIPHY API
 * @param {string} query - Search query
 * @param {number} limit - Number of results (default 20)
 * @returns {Promise<Array>} - Array of GIF objects
 */
export async function searchGifs(query, limit = 20) {
  if (!query || !query.trim()) {
    return getTrendingGifs(limit);
  }

  const url = new URL("https://api.giphy.com/v1/gifs/search");
  url.searchParams.set("api_key", GIPHY_API_KEY);
  url.searchParams.set("q", query.trim());
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("rating", "pg-13");

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error("Failed to search GIFs");
    }

    const data = await response.json();
    return parseGifResults(data.data || []);
  } catch (error) {
    console.error("GIF search error:", error);
    return [];
  }
}

/**
 * Get trending GIFs from GIPHY
 * @param {number} limit - Number of results
 * @returns {Promise<Array>} - Array of GIF objects
 */
export async function getTrendingGifs(limit = 20) {
  const url = new URL("https://api.giphy.com/v1/gifs/trending");
  url.searchParams.set("api_key", GIPHY_API_KEY);
  url.searchParams.set("limit", limit.toString());
  url.searchParams.set("rating", "pg-13");

  try {
    console.log("Fetching trending GIFs from:", url.toString());
    const response = await fetch(url.toString());
    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GIPHY API error:", errorText);
      throw new Error("Failed to get trending GIFs");
    }

    const data = await response.json();
    console.log("GIPHY data received:", data.data?.length, "results");
    return parseGifResults(data.data || []);
  } catch (error) {
    console.error("Trending GIFs error:", error);
    return [];
  }
}

/**
 * Parse GIPHY API results into simplified GIF objects
 */
function parseGifResults(results) {
  return results.map((item) => {
    const images = item.images || {};
    // Use fixed_height for both display and preview (better quality)
    const gif = images.fixed_height || images.original;
    // Use fixed_width_small for grid preview (200px wide, good quality)
    const preview = images.fixed_width || images.fixed_height || gif;

    return {
      id: item.id,
      title: item.title || "",
      url: gif?.url || "",
      previewUrl: preview?.url || gif?.url || "",
      width: parseInt(gif?.width) || 200,
      height: parseInt(gif?.height) || 200,
    };
  }).filter((gif) => gif.url); // Filter out any without URLs
}

/**
 * Get GIF categories/suggestions for quick access
 */
export function getGifCategories() {
  return [
    { emoji: "🔥", query: "fire lit" },
    { emoji: "😂", query: "laughing" },
    { emoji: "😭", query: "crying" },
    { emoji: "🎉", query: "celebration" },
    { emoji: "💰", query: "money" },
    { emoji: "🙏", query: "praying" },
    { emoji: "😤", query: "angry" },
    { emoji: "🤯", query: "mind blown" },
  ];
}

export default {
  searchGifs,
  getTrendingGifs,
  getGifCategories,
};
