// src/services/postsService.js
// Unified Post System for SlipRooms website - Twitter/X style model
// ALL content (posts, replies, quotes) exists in a single `posts` collection

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function mapDocToPost(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    authorId: data.authorId || data.userId || "",
    authorUsername: data.authorUsername || data.username || "",
    authorAvatar: data.authorAvatar || data.userAvatar || "🔥",
    authorAvatarColor: data.authorAvatarColor || data.userAvatarColor || "green",
    authorProfilePicture: data.authorProfilePicture || data.userProfilePicture || null,
    text: data.text || "",
    media: data.media || data.images || [],
    replyToPostId: data.replyToPostId || null,
    quotedPostId: data.quotedPostId || null,
    hasMedia: data.hasMedia ?? (data.media?.length > 0 || data.images?.length > 0),
    metrics: {
      likesCount: data.metrics?.likesCount ?? data.thumbsUpCount ?? 0,
      dislikesCount: data.metrics?.dislikesCount ?? data.thumbsDownCount ?? 0,
      repliesCount: data.metrics?.repliesCount ?? data.commentsCount ?? 0,
      repostsCount: data.metrics?.repostsCount ?? 0,
      viewsCount: data.metrics?.viewsCount ?? 0,
    },
    createdAt: data.createdAt?.toDate?.() || new Date(),
    replyToUsername: data.replyToUsername,
    replyToAuthorId: data.replyToAuthorId,
    mentions: data.mentions || [],
    mentionedUserIds: data.mentionedUserIds || [],
    // Legacy compatibility fields
    thumbsUp: data.thumbsUp || [],
    thumbsDown: data.thumbsDown || [],
    thumbsUpCount: data.metrics?.likesCount ?? data.thumbsUpCount ?? 0,
    thumbsDownCount: data.metrics?.dislikesCount ?? data.thumbsDownCount ?? 0,
    commentsCount: data.metrics?.repliesCount ?? data.commentsCount ?? 0,
    images: data.media || data.images || [],
    userId: data.authorId || data.userId || "",
    username: data.authorUsername || data.username || "",
    userAvatar: data.authorAvatar || data.userAvatar || "🔥",
    userAvatarColor: data.authorAvatarColor || data.userAvatarColor || "green",
    userProfilePicture: data.authorProfilePicture || data.userProfilePicture || null,
  };
}

// =============================================================================
// MENTION HELPERS
// =============================================================================

/**
 * Extract @mentions from text
 * Returns array of usernames (without the @ symbol)
 */
export function extractMentions(text) {
  const mentionRegex = /@([A-Za-z0-9_]+)/g;
  const matches = text.match(mentionRegex);
  if (!matches) return [];
  // Remove @ symbol and dedupe
  return [...new Set(matches.map(m => m.substring(1).toUpperCase()))];
}

/**
 * Look up user IDs from usernames
 */
export async function getUserIdsByUsernames(usernames) {
  const usernameToId = new Map();
  if (usernames.length === 0) return usernameToId;

  const usersRef = collection(db, "users");

  for (const username of usernames) {
    try {
      const q = query(usersRef, where("username", "==", username), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        usernameToId.set(username, snapshot.docs[0].id);
      }
    } catch (error) {
      console.log(`[PostsService] Could not find user: ${username}`);
    }
  }

  return usernameToId;
}

/**
 * Search users by username prefix (for autocomplete)
 */
export async function searchUsersByUsername(prefix, maxResults = 10) {
  if (!prefix || prefix.length < 1) return [];

  const usersRef = collection(db, "users");
  const upperPrefix = prefix.toUpperCase();

  // Firestore range query for prefix matching
  const q = query(
    usersRef,
    where("username", ">=", upperPrefix),
    where("username", "<=", upperPrefix + "\uf8ff"),
    limit(maxResults)
  );

  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        username: data.username || "",
        avatarEmoji: data.avatarEmoji || "🔥",
        avatarColor: data.avatarColor || "green",
        profilePicture: data.profilePicture || null,
      };
    });
  } catch (error) {
    console.error("[PostsService] Error searching users:", error);
    return [];
  }
}

// =============================================================================
// IMAGE UPLOAD
// =============================================================================

export async function uploadPostImage(userId, file, postId, imageIndex) {
  const storageRef = ref(storage, `posts/${userId}/${postId}_${imageIndex}_${Date.now()}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// =============================================================================
// CREATE POST / REPLY
// =============================================================================

export async function createPost(userId, userData, text, imageFiles = [], replyToPostId = null, quotedPostId = null) {
  // Get the username and authorId of the post being replied to (for context display)
  let replyToUsername;
  let replyToAuthorId;
  if (replyToPostId) {
    try {
      const parentDoc = await getDoc(doc(db, "posts", replyToPostId));
      if (parentDoc.exists()) {
        const parentData = parentDoc.data();
        replyToUsername = parentData.authorUsername || parentData.username;
        replyToAuthorId = parentData.authorId || parentData.userId;
      }
    } catch (error) {
      console.error("[PostsService] Error fetching parent post:", error);
    }
  }

  // Extract @mentions from text
  const mentions = extractMentions(text);
  let mentionedUserIds = [];

  if (mentions.length > 0) {
    try {
      const usernameToId = await getUserIdsByUsernames(mentions);
      mentionedUserIds = Array.from(usernameToId.values());
    } catch (error) {
      console.log("[PostsService] Could not resolve mentioned users:", error);
    }
  }

  // Create the post document
  const postsRef = collection(db, "posts");
  const postDoc = await addDoc(postsRef, {
    // New fields
    authorId: userId,
    authorUsername: userData.username,
    authorAvatar: userData.avatarEmoji || "🔥",
    authorAvatarColor: userData.avatarColor || "green",
    authorProfilePicture: userData.profilePicture || null,
    // Legacy fields (for backward compatibility with old Firestore rules)
    userId: userId,
    username: userData.username,
    userAvatar: userData.avatarEmoji || "🔥",
    userAvatarColor: userData.avatarColor || "green",
    userProfilePicture: userData.profilePicture || null,
    // Content
    text: text.trim(),
    media: [],
    replyToPostId: replyToPostId || null,
    quotedPostId: quotedPostId || null,
    replyToUsername: replyToUsername || null,
    replyToAuthorId: replyToAuthorId || null,
    hasMedia: false,
    mentions,
    mentionedUserIds,
    metrics: {
      likesCount: 0,
      dislikesCount: 0,
      repliesCount: 0,
      repostsCount: 0,
      viewsCount: 0,
    },
    createdAt: serverTimestamp(),
  });

  // Upload images if any (max 2)
  const uploadedMedia = [];
  const imagesToUpload = imageFiles.slice(0, 2);

  for (let i = 0; i < imagesToUpload.length; i++) {
    const url = await uploadPostImage(userId, imagesToUpload[i], postDoc.id, i);
    uploadedMedia.push(url);
  }

  // Update post with image URLs if any were uploaded
  if (uploadedMedia.length > 0) {
    await updateDoc(doc(db, "posts", postDoc.id), {
      media: uploadedMedia,
      hasMedia: true,
    });
  }

  // If this is a reply, increment the parent's repliesCount
  if (replyToPostId) {
    try {
      await updateDoc(doc(db, "posts", replyToPostId), {
        "metrics.repliesCount": increment(1),
        commentsCount: increment(1), // Legacy field
      });
    } catch (error) {
      console.error("[PostsService] Error incrementing parent repliesCount:", error);
    }
  }

  return {
    id: postDoc.id,
    authorId: userId,
    authorUsername: userData.username,
    authorAvatar: userData.avatarEmoji || "🔥",
    authorAvatarColor: userData.avatarColor || "green",
    authorProfilePicture: userData.profilePicture || null,
    text: text.trim(),
    media: uploadedMedia,
    replyToPostId,
    quotedPostId,
    replyToUsername,
    replyToAuthorId,
    hasMedia: uploadedMedia.length > 0,
    mentions,
    mentionedUserIds,
    metrics: {
      likesCount: 0,
      dislikesCount: 0,
      repliesCount: 0,
      repostsCount: 0,
      viewsCount: 0,
    },
    createdAt: new Date(),
    // Legacy compatibility
    thumbsUp: [],
    thumbsDown: [],
    thumbsUpCount: 0,
    thumbsDownCount: 0,
    commentsCount: 0,
    images: uploadedMedia,
    userId,
    username: userData.username,
    userAvatar: userData.avatarEmoji || "🔥",
    userAvatarColor: userData.avatarColor || "green",
    userProfilePicture: userData.profilePicture || null,
  };
}

// =============================================================================
// PROFILE TAB QUERIES
// =============================================================================

/**
 * Get user's original posts (POSTS tab) - posts where replyToPostId is null
 */
export async function getUserOriginalPosts(userId, postLimit = 20) {
  const postsRef = collection(db, "posts");

  // Try with composite index first
  try {
    const q = query(
      postsRef,
      where("authorId", "==", userId),
      where("replyToPostId", "==", null),
      orderBy("createdAt", "desc"),
      limit(postLimit)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(mapDocToPost);
  } catch (error) {
    console.log("[PostsService] Composite index not ready, using fallback query with client-side filtering");
  }

  // Fallback: Query without replyToPostId filter, then filter client-side
  try {
    const q = query(
      postsRef,
      where("authorId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(postLimit * 2)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(mapDocToPost)
      .filter((post) => post.replyToPostId === null)
      .slice(0, postLimit);
  } catch (error) {
    console.log("[PostsService] Trying legacy userId field...");
  }

  // Final fallback: legacy userId field
  const legacyQ = query(
    postsRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(postLimit * 2)
  );
  const snapshot = await getDocs(legacyQ);
  return snapshot.docs
    .map(mapDocToPost)
    .filter((post) => post.replyToPostId === null)
    .slice(0, postLimit);
}

/**
 * Subscribe to user's original posts (real-time)
 */
export function subscribeToUserOriginalPosts(userId, callback, postLimit = 20) {
  const postsRef = collection(db, "posts");

  // Try composite index first
  const compositeQ = query(
    postsRef,
    where("authorId", "==", userId),
    where("replyToPostId", "==", null),
    orderBy("createdAt", "desc"),
    limit(postLimit)
  );

  let unsubscribe = onSnapshot(
    compositeQ,
    (snapshot) => {
      const posts = snapshot.docs.map(mapDocToPost);
      callback(posts);
    },
    (error) => {
      console.log("[PostsService] Composite index not ready, using fallback subscription with client-side filtering");

      // Fallback: Subscribe without replyToPostId filter, then filter client-side
      const fallbackQ = query(
        postsRef,
        where("authorId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(postLimit * 2)
      );

      unsubscribe = onSnapshot(
        fallbackQ,
        (snapshot) => {
          const posts = snapshot.docs
            .map(mapDocToPost)
            .filter((post) => post.replyToPostId === null)
            .slice(0, postLimit);
          callback(posts);
        },
        (fallbackError) => {
          console.log("[PostsService] Trying legacy userId field for subscription...");

          // Final fallback: legacy userId field
          const legacyQ = query(
            postsRef,
            where("userId", "==", userId),
            orderBy("createdAt", "desc"),
            limit(postLimit * 2)
          );

          unsubscribe = onSnapshot(
            legacyQ,
            (snapshot) => {
              const posts = snapshot.docs
                .map(mapDocToPost)
                .filter((post) => post.replyToPostId === null)
                .slice(0, postLimit);
              callback(posts);
            },
            (legacyError) => {
              console.error("Error subscribing to original posts:", legacyError);
              callback([]);
            }
          );
        }
      );
    }
  );

  return () => unsubscribe();
}

/**
 * Get user's replies (REPLIES tab) - posts where replyToPostId is not null
 */
export async function getUserReplies(userId, postLimit = 20) {
  const postsRef = collection(db, "posts");
  const q = query(
    postsRef,
    where("authorId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(postLimit * 2)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(mapDocToPost)
    .filter((post) => post.replyToPostId !== null)
    .slice(0, postLimit);
}

/**
 * Subscribe to user's replies (real-time)
 */
export function subscribeToUserReplies(userId, callback, postLimit = 20) {
  const postsRef = collection(db, "posts");
  const q = query(
    postsRef,
    where("authorId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(postLimit * 2)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const posts = snapshot.docs
        .map(mapDocToPost)
        .filter((post) => post.replyToPostId !== null)
        .slice(0, postLimit);
      callback(posts);
    },
    (error) => {
      console.error("Error subscribing to replies:", error);
      callback([]);
    }
  );
}

/**
 * Get user's media posts (MEDIA tab) - posts where hasMedia is true
 */
export async function getUserMediaPosts(userId, postLimit = 20) {
  const postsRef = collection(db, "posts");

  // Try with composite index first
  try {
    const q = query(
      postsRef,
      where("authorId", "==", userId),
      where("hasMedia", "==", true),
      orderBy("createdAt", "desc"),
      limit(postLimit)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(mapDocToPost);
  } catch (error) {
    console.log("[PostsService] Composite index for hasMedia not ready, using fallback with client-side filtering");
  }

  // Fallback: Query without hasMedia filter, then filter client-side
  try {
    const q = query(
      postsRef,
      where("authorId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(postLimit * 3)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(mapDocToPost)
      .filter((post) => post.hasMedia || (post.media && post.media.length > 0))
      .slice(0, postLimit);
  } catch (error) {
    console.log("[PostsService] Trying legacy userId field for media posts...");
  }

  // Final fallback: legacy userId field
  const legacyQ = query(
    postsRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(postLimit * 3)
  );
  const snapshot = await getDocs(legacyQ);
  return snapshot.docs
    .map(mapDocToPost)
    .filter((post) => post.hasMedia || (post.media && post.media.length > 0))
    .slice(0, postLimit);
}

/**
 * Subscribe to user's media posts (real-time)
 */
export function subscribeToUserMediaPosts(userId, callback, postLimit = 20) {
  const postsRef = collection(db, "posts");

  // Try composite index first
  const compositeQ = query(
    postsRef,
    where("authorId", "==", userId),
    where("hasMedia", "==", true),
    orderBy("createdAt", "desc"),
    limit(postLimit)
  );

  let unsubscribe = onSnapshot(
    compositeQ,
    (snapshot) => {
      const posts = snapshot.docs.map(mapDocToPost);
      callback(posts);
    },
    (error) => {
      console.log("[PostsService] Composite index for hasMedia not ready, using fallback subscription");

      // Fallback: Subscribe without hasMedia filter, then filter client-side
      const fallbackQ = query(
        postsRef,
        where("authorId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(postLimit * 3)
      );

      unsubscribe = onSnapshot(
        fallbackQ,
        (snapshot) => {
          const posts = snapshot.docs
            .map(mapDocToPost)
            .filter((post) => post.hasMedia || (post.media && post.media.length > 0))
            .slice(0, postLimit);
          callback(posts);
        },
        (fallbackError) => {
          console.log("[PostsService] Trying legacy userId field for media subscription...");

          // Final fallback: legacy userId field
          const legacyQ = query(
            postsRef,
            where("userId", "==", userId),
            orderBy("createdAt", "desc"),
            limit(postLimit * 3)
          );

          unsubscribe = onSnapshot(
            legacyQ,
            (snapshot) => {
              const posts = snapshot.docs
                .map(mapDocToPost)
                .filter((post) => post.hasMedia || (post.media && post.media.length > 0))
                .slice(0, postLimit);
              callback(posts);
            },
            (legacyError) => {
              console.error("Error subscribing to media posts:", legacyError);
              callback([]);
            }
          );
        }
      );
    }
  );

  return () => unsubscribe();
}

/**
 * Get posts liked by user (LIKES tab)
 */
export async function getUserLikedPosts(userId, postLimit = 20) {
  const likesRef = collection(db, "likes");
  const likesQuery = query(
    likesRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(postLimit)
  );

  const likesSnapshot = await getDocs(likesQuery);
  const postIds = likesSnapshot.docs.map((doc) => doc.data().postId);

  if (postIds.length === 0) return [];

  const posts = [];
  for (const postId of postIds) {
    try {
      const postDoc = await getDoc(doc(db, "posts", postId));
      if (postDoc.exists()) {
        posts.push(mapDocToPost(postDoc));
      }
    } catch (error) {
      console.error(`Error fetching liked post ${postId}:`, error);
    }
  }

  return posts;
}

/**
 * Subscribe to user's liked posts (real-time)
 */
export function subscribeToUserLikedPosts(userId, callback, postLimit = 20) {
  const likesRef = collection(db, "likes");
  const likesQuery = query(
    likesRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(postLimit)
  );

  return onSnapshot(
    likesQuery,
    async (snapshot) => {
      const postIds = snapshot.docs.map((doc) => doc.data().postId);

      if (postIds.length === 0) {
        callback([]);
        return;
      }

      const posts = [];
      for (const postId of postIds) {
        try {
          const postDoc = await getDoc(doc(db, "posts", postId));
          if (postDoc.exists()) {
            posts.push(mapDocToPost(postDoc));
          }
        } catch (error) {
          console.error(`Error fetching liked post ${postId}:`, error);
        }
      }

      callback(posts);
    },
    (error) => {
      console.error("Error subscribing to liked posts:", error);
      callback([]);
    }
  );
}

// =============================================================================
// LEGACY COMPATIBILITY - Get all user posts
// =============================================================================

export async function getUserPosts(userId, postLimit = 20) {
  const postsRef = collection(db, "posts");

  // Try new authorId field first
  let q = query(
    postsRef,
    where("authorId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(postLimit)
  );

  try {
    const snapshot = await getDocs(q);
    if (snapshot.docs.length > 0) {
      return snapshot.docs.map(mapDocToPost);
    }
  } catch (error) {
    console.log("[PostsService] Trying legacy userId field...");
  }

  // Fallback to old userId field
  q = query(
    postsRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(postLimit)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapDocToPost);
}

export function subscribeToUserPosts(userId, callback, postLimit = 20) {
  const postsRef = collection(db, "posts");
  const q = query(
    postsRef,
    where("authorId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(postLimit)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.docs.length > 0) {
        const posts = snapshot.docs.map(mapDocToPost);
        callback(posts);
      } else {
        // Try legacy userId field
        const legacyQ = query(
          postsRef,
          where("userId", "==", userId),
          orderBy("createdAt", "desc"),
          limit(postLimit)
        );
        onSnapshot(legacyQ, (legacySnapshot) => {
          const posts = legacySnapshot.docs.map(mapDocToPost);
          callback(posts);
        });
      }
    },
    (error) => {
      console.error("Error subscribing to posts:", error);
      callback([]);
    }
  );
}

// =============================================================================
// REPLIES TO A POST
// =============================================================================

export async function getReplies(postId, replyLimit = 50) {
  const postsRef = collection(db, "posts");

  // Try with composite index first
  try {
    const q = query(
      postsRef,
      where("replyToPostId", "==", postId),
      orderBy("createdAt", "asc"),
      limit(replyLimit)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(mapDocToPost);
  } catch (error) {
    console.log("[PostsService] Composite index for replies not ready, using fallback query");
  }

  // Fallback: Query without orderBy (Firestore auto-orders by doc ID)
  const fallbackQ = query(
    postsRef,
    where("replyToPostId", "==", postId),
    limit(replyLimit)
  );
  const snapshot = await getDocs(fallbackQ);
  const replies = snapshot.docs.map(mapDocToPost);
  // Sort client-side by createdAt
  return replies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export function subscribeToReplies(postId, callback, replyLimit = 50) {
  const postsRef = collection(db, "posts");

  // Try composite index first
  const compositeQ = query(
    postsRef,
    where("replyToPostId", "==", postId),
    orderBy("createdAt", "asc"),
    limit(replyLimit)
  );

  let unsubscribe = onSnapshot(
    compositeQ,
    (snapshot) => {
      const replies = snapshot.docs.map(mapDocToPost);
      callback(replies);
    },
    (error) => {
      console.log("[PostsService] Composite index for replies not ready, using fallback subscription");

      // Fallback: Subscribe without orderBy, sort client-side
      const fallbackQ = query(
        postsRef,
        where("replyToPostId", "==", postId),
        limit(replyLimit)
      );

      unsubscribe = onSnapshot(
        fallbackQ,
        (snapshot) => {
          const replies = snapshot.docs.map(mapDocToPost);
          // Sort client-side by createdAt
          replies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          callback(replies);
        },
        (fallbackError) => {
          console.error("Error subscribing to replies:", fallbackError);
          callback([]);
        }
      );
    }
  );

  return () => unsubscribe();
}

// =============================================================================
// LIKES - Updates both likes collection AND thumbsUp array for mobile compatibility
// =============================================================================

export async function likePost(postId, userId) {
  console.log("[PostsService] likePost called:", { postId, userId });
  const postRef = doc(db, "posts", postId);

  try {
    const postDoc = await getDoc(postRef);
    if (!postDoc.exists()) {
      throw new Error("Post not found");
    }

    const data = postDoc.data();
    const thumbsUp = data.thumbsUp || [];
    const thumbsDown = data.thumbsDown || [];
    const wasDisliked = thumbsDown.includes(userId);

    // Already liked? Do nothing
    if (thumbsUp.includes(userId)) {
      console.log("[PostsService] User already liked this post");
      return;
    }

    // Use atomic arrayUnion to prevent duplicates
    const updates = {
      thumbsUp: arrayUnion(userId),
      thumbsUpCount: increment(1),
      "metrics.likesCount": increment(1),
    };

    // Remove from thumbsDown if present
    if (wasDisliked) {
      updates.thumbsDown = arrayRemove(userId);
      updates.thumbsDownCount = increment(-1);
      updates["metrics.dislikesCount"] = increment(-1);
    }

    await updateDoc(postRef, updates);
    console.log("[PostsService] Like successful");
  } catch (error) {
    console.error("[PostsService] Error in likePost:", error);
    throw error;
  }
}

export async function unlikePost(postId, userId) {
  console.log("[PostsService] unlikePost called:", { postId, userId });
  const postRef = doc(db, "posts", postId);

  try {
    await updateDoc(postRef, {
      thumbsUp: arrayRemove(userId),
      thumbsUpCount: increment(-1),
      "metrics.likesCount": increment(-1),
    });
    console.log("[PostsService] Unlike successful");
  } catch (error) {
    console.error("[PostsService] Error in unlikePost:", error);
    throw error;
  }
}

// =============================================================================
// DISLIKES - Updates both dislikes collection AND thumbsDown array for mobile compatibility
// =============================================================================

export async function dislikePost(postId, userId) {
  console.log("[PostsService] dislikePost called:", { postId, userId });
  const postRef = doc(db, "posts", postId);

  try {
    const postDoc = await getDoc(postRef);
    if (!postDoc.exists()) {
      throw new Error("Post not found");
    }

    const data = postDoc.data();
    const thumbsUp = data.thumbsUp || [];
    const thumbsDown = data.thumbsDown || [];
    const wasLiked = thumbsUp.includes(userId);

    // Already disliked? Do nothing
    if (thumbsDown.includes(userId)) {
      console.log("[PostsService] User already disliked this post");
      return;
    }

    // Use atomic arrayUnion to prevent duplicates
    const updates = {
      thumbsDown: arrayUnion(userId),
      thumbsDownCount: increment(1),
      "metrics.dislikesCount": increment(1),
    };

    // Remove from thumbsUp if present
    if (wasLiked) {
      updates.thumbsUp = arrayRemove(userId);
      updates.thumbsUpCount = increment(-1);
      updates["metrics.likesCount"] = increment(-1);
    }

    await updateDoc(postRef, updates);
    console.log("[PostsService] Dislike successful");
  } catch (error) {
    console.error("[PostsService] Error in dislikePost:", error);
    throw error;
  }
}

export async function undislikePost(postId, userId) {
  console.log("[PostsService] undislikePost called:", { postId, userId });
  const postRef = doc(db, "posts", postId);

  try {
    await updateDoc(postRef, {
      thumbsDown: arrayRemove(userId),
      thumbsDownCount: increment(-1),
      "metrics.dislikesCount": increment(-1),
    });
    console.log("[PostsService] Undislike successful");
  } catch (error) {
    console.error("[PostsService] Error in undislikePost:", error);
    throw error;
  }
}

// =============================================================================
// REPOSTS
// =============================================================================

export async function repost(postId, userId) {
  const repostId = `${userId}_${postId}`;
  const repostRef = doc(db, "reposts", repostId);
  const postRef = doc(db, "posts", postId);

  const batch = writeBatch(db);

  batch.set(repostRef, {
    userId,
    postId,
    createdAt: serverTimestamp(),
  });

  batch.update(postRef, {
    "metrics.repostsCount": increment(1),
  });

  await batch.commit();
}

export async function unrepost(postId, userId) {
  const repostId = `${userId}_${postId}`;
  const repostRef = doc(db, "reposts", repostId);
  const postRef = doc(db, "posts", postId);

  const batch = writeBatch(db);
  batch.delete(repostRef);
  batch.update(postRef, {
    "metrics.repostsCount": increment(-1),
  });

  await batch.commit();
}

// =============================================================================
// USER ENGAGEMENT STATUS
// =============================================================================

export async function getUserEngagementForPosts(userId, postIds) {
  const engagementMap = new Map();

  if (postIds.length === 0) return engagementMap;

  for (const postId of postIds) {
    engagementMap.set(postId, { isLiked: false, isDisliked: false, isReposted: false });
  }

  // Check likes
  const likesRef = collection(db, "likes");
  const likesQuery = query(likesRef, where("userId", "==", userId));
  const likesSnapshot = await getDocs(likesQuery);
  for (const likeDoc of likesSnapshot.docs) {
    const postId = likeDoc.data().postId;
    if (engagementMap.has(postId)) {
      engagementMap.get(postId).isLiked = true;
    }
  }

  // Check dislikes
  const dislikesRef = collection(db, "dislikes");
  const dislikesQuery = query(dislikesRef, where("userId", "==", userId));
  const dislikesSnapshot = await getDocs(dislikesQuery);
  for (const dislikeDoc of dislikesSnapshot.docs) {
    const postId = dislikeDoc.data().postId;
    if (engagementMap.has(postId)) {
      engagementMap.get(postId).isDisliked = true;
    }
  }

  // Check reposts
  const repostsRef = collection(db, "reposts");
  const repostsQuery = query(repostsRef, where("userId", "==", userId));
  const repostsSnapshot = await getDocs(repostsQuery);
  for (const repostDoc of repostsSnapshot.docs) {
    const postId = repostDoc.data().postId;
    if (engagementMap.has(postId)) {
      engagementMap.get(postId).isReposted = true;
    }
  }

  return engagementMap;
}

export async function hasUserLikedPost(userId, postId) {
  const likeId = `${userId}_${postId}`;
  const likeRef = doc(db, "likes", likeId);
  const likeDoc = await getDoc(likeRef);
  return likeDoc.exists();
}

export async function hasUserDislikedPost(userId, postId) {
  const dislikeId = `${userId}_${postId}`;
  const dislikeRef = doc(db, "dislikes", dislikeId);
  const dislikeDoc = await getDoc(dislikeRef);
  return dislikeDoc.exists();
}

export async function hasUserRepostedPost(userId, postId) {
  const repostId = `${userId}_${postId}`;
  const repostRef = doc(db, "reposts", repostId);
  const repostDoc = await getDoc(repostRef);
  return repostDoc.exists();
}

// =============================================================================
// DELETE POST
// =============================================================================

export async function deletePost(postId, parentPostId) {
  const postRef = doc(db, "posts", postId);

  if (parentPostId) {
    try {
      await updateDoc(doc(db, "posts", parentPostId), {
        "metrics.repliesCount": increment(-1),
      });
    } catch (error) {
      console.error("[PostsService] Error decrementing parent repliesCount:", error);
    }
  }

  await deleteDoc(postRef);
}

// =============================================================================
// FEED QUERIES
// =============================================================================

export async function getFriendsFeedPosts(userId, friendIds, postLimit = 20) {
  if (!userId) {
    console.warn("getFriendsFeedPosts called with invalid userId");
    return [];
  }

  const allUserIds = [userId, ...friendIds].filter(
    (id) => id !== undefined && id !== null && id !== ""
  );

  if (allUserIds.length === 0) return [];

  const chunks = [];
  for (let i = 0; i < allUserIds.length; i += 30) {
    chunks.push(allUserIds.slice(i, i + 30));
  }

  const allPosts = [];

  for (const chunk of chunks) {
    const postsRef = collection(db, "posts");

    let q = query(
      postsRef,
      where("authorId", "in", chunk),
      where("replyToPostId", "==", null),
      orderBy("createdAt", "desc"),
      limit(postLimit)
    );

    try {
      const snapshot = await getDocs(q);
      snapshot.docs.forEach((docSnap) => {
        allPosts.push(mapDocToPost(docSnap));
      });
    } catch (error) {
      // Fallback to legacy userId field
      console.log("[PostsService] Trying legacy query for friends feed...");
      q = query(
        postsRef,
        where("userId", "in", chunk),
        orderBy("createdAt", "desc"),
        limit(postLimit)
      );
      const snapshot = await getDocs(q);
      snapshot.docs.forEach((docSnap) => {
        const post = mapDocToPost(docSnap);
        if (post.replyToPostId === null) {
          allPosts.push(post);
        }
      });
    }
  }

  return allPosts
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, postLimit);
}

function calculateHotScore(post) {
  const engagementScore =
    post.metrics.likesCount + post.metrics.dislikesCount + post.metrics.repliesCount * 2;

  const now = new Date();
  const hoursSincePosted = Math.max(
    0.1,
    (now.getTime() - post.createdAt.getTime()) / (1000 * 60 * 60)
  );

  const timeDecay = Math.sqrt(hoursSincePosted);
  const recencyBoost = hoursSincePosted < 6 ? 5 * (6 - hoursSincePosted) : 0;
  const hotScore = (engagementScore + recencyBoost) / timeDecay;

  return hotScore;
}

export async function getDiscoverPosts(postLimit = 20) {
  const postsRef = collection(db, "posts");

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const q = query(
    postsRef,
    where("createdAt", ">=", sevenDaysAgo),
    orderBy("createdAt", "desc"),
    limit(300)
  );

  const snapshot = await getDocs(q);
  const posts = [];

  snapshot.docs.forEach((docSnap) => {
    const post = mapDocToPost(docSnap);

    // Filter out replies
    if (post.replyToPostId !== null) return;

    const engagementScore =
      post.metrics.likesCount + post.metrics.dislikesCount + post.metrics.repliesCount;

    if (engagementScore < 1) return;

    posts.push({
      ...post,
      hotScore: calculateHotScore(post),
    });
  });

  posts.sort((a, b) => b.hotScore - a.hotScore);

  return posts.slice(0, postLimit).map(({ hotScore, ...post }) => post);
}

export async function getTrendingPosts(postLimit = 20) {
  const postsRef = collection(db, "posts");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const q = query(
    postsRef,
    where("createdAt", ">=", thirtyDaysAgo),
    orderBy("createdAt", "desc"),
    limit(300)
  );

  const snapshot = await getDocs(q);
  const posts = [];

  snapshot.docs.forEach((docSnap) => {
    const post = mapDocToPost(docSnap);

    if (post.replyToPostId !== null) return;

    const engagementScore =
      post.metrics.likesCount + post.metrics.dislikesCount + post.metrics.repliesCount * 2;

    if (engagementScore < 1) return;

    posts.push({ ...post, engagementScore });
  });

  return posts
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, postLimit)
    .map(({ engagementScore, ...post }) => post);
}

// =============================================================================
// SINGLE POST
// =============================================================================

export async function getPost(postId) {
  const postRef = doc(db, "posts", postId);
  const postDoc = await getDoc(postRef);

  if (!postDoc.exists()) return null;

  return mapDocToPost(postDoc);
}

/**
 * Get user's replies with parent post context (for Replies tab)
 * Returns replies along with their parent posts for display context
 */
export async function getUserRepliesWithContext(userId, postLimit = 20) {
  // First get the user's replies
  const replies = await getUserReplies(userId, postLimit);

  // Fetch parent posts for context
  const repliesWithContext = [];

  for (const reply of replies) {
    let parentPost = null;
    if (reply.replyToPostId) {
      try {
        parentPost = await getPost(reply.replyToPostId);
      } catch (error) {
        console.log(`[PostsService] Could not fetch parent post ${reply.replyToPostId}`);
      }
    }
    repliesWithContext.push({ reply, parentPost });
  }

  return repliesWithContext;
}

// =============================================================================
// LEGACY SUPPORT - Backward compatible exports
// =============================================================================

export async function thumbsUpPost(postId, userId, hasThumbsDown) {
  if (hasThumbsDown) {
    await undislikePost(postId, userId);
  }
  await likePost(postId, userId);
}

export async function removeThumbsUp(postId, userId) {
  await unlikePost(postId, userId);
}

export async function thumbsDownPost(postId, userId, hasThumbsUp) {
  if (hasThumbsUp) {
    await unlikePost(postId, userId);
  }
  await dislikePost(postId, userId);
}

export async function removeThumbsDown(postId, userId) {
  await undislikePost(postId, userId);
}

// Backward compatibility: subscribeToComments now subscribes to replies
export function subscribeToComments(postId, callback) {
  return subscribeToReplies(postId, (replies) => {
    const comments = replies.map((reply) => ({
      id: reply.id,
      postId: postId,
      userId: reply.authorId,
      username: reply.authorUsername,
      userAvatar: reply.authorAvatar,
      userAvatarColor: reply.authorAvatarColor,
      userProfilePicture: reply.authorProfilePicture,
      text: reply.text,
      createdAt: reply.createdAt,
    }));
    callback(comments);
  });
}

// Backward compatibility: addComment now creates a reply post
export async function addComment(postId, userId, userData, text) {
  const reply = await createPost(userId, userData, text, [], postId);

  return {
    id: reply.id,
    postId: postId,
    userId: reply.authorId,
    username: reply.authorUsername,
    userAvatar: reply.authorAvatar,
    userAvatarColor: reply.authorAvatarColor,
    userProfilePicture: reply.authorProfilePicture,
    text: reply.text,
    createdAt: reply.createdAt,
  };
}

export async function getComments(postId) {
  const replies = await getReplies(postId);
  return replies.map((reply) => ({
    id: reply.id,
    postId: postId,
    userId: reply.authorId,
    username: reply.authorUsername,
    userAvatar: reply.authorAvatar,
    userAvatarColor: reply.authorAvatarColor,
    userProfilePicture: reply.authorProfilePicture,
    text: reply.text,
    createdAt: reply.createdAt,
  }));
}

export async function deleteComment(postId, commentId) {
  await deletePost(commentId, postId);
}

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  // New unified functions
  createPost,
  getUserOriginalPosts,
  subscribeToUserOriginalPosts,
  getUserReplies,
  subscribeToUserReplies,
  getUserMediaPosts,
  subscribeToUserMediaPosts,
  getUserLikedPosts,
  subscribeToUserLikedPosts,
  getReplies,
  subscribeToReplies,
  likePost,
  unlikePost,
  dislikePost,
  undislikePost,
  repost,
  unrepost,
  getUserEngagementForPosts,
  hasUserLikedPost,
  hasUserDislikedPost,
  hasUserRepostedPost,
  deletePost,
  getFriendsFeedPosts,
  getDiscoverPosts,
  getTrendingPosts,
  getPost,

  // Legacy compatibility
  getUserPosts,
  subscribeToUserPosts,
  thumbsUpPost,
  removeThumbsUp,
  thumbsDownPost,
  removeThumbsDown,
  addComment,
  getComments,
  subscribeToComments,
  deleteComment,
};
