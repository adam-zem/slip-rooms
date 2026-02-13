// src/services/postsService.js
// Social wall posts service for SlipRooms website

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
  arrayUnion,
  arrayRemove,
  increment,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";

/**
 * Upload an image to Firebase Storage for a post
 */
export async function uploadPostImage(userId, file, postId, imageIndex) {
  const storageRef = ref(storage, `posts/${userId}/${postId}_${imageIndex}_${Date.now()}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

/**
 * Create a new post
 */
export async function createPost(userId, userData, text, imageFiles = []) {
  // First create the post document to get its ID
  const postsRef = collection(db, "posts");
  const postDoc = await addDoc(postsRef, {
    userId,
    username: userData.username,
    userAvatar: userData.avatarEmoji || "🔥",
    userAvatarColor: userData.avatarColor || "green",
    userProfilePicture: userData.profilePicture || null,
    text: text.trim(),
    images: [],
    thumbsUp: [],
    thumbsDown: [],
    thumbsUpCount: 0,
    thumbsDownCount: 0,
    commentsCount: 0,
    createdAt: serverTimestamp(),
  });

  // Upload images if any (max 2)
  const uploadedImages = [];
  const imagesToUpload = imageFiles.slice(0, 2);

  for (let i = 0; i < imagesToUpload.length; i++) {
    const url = await uploadPostImage(userId, imagesToUpload[i], postDoc.id, i);
    uploadedImages.push(url);
  }

  // Update post with image URLs if any were uploaded
  if (uploadedImages.length > 0) {
    await updateDoc(doc(db, "posts", postDoc.id), {
      images: uploadedImages,
    });
  }

  return {
    id: postDoc.id,
    userId,
    username: userData.username,
    userAvatar: userData.avatarEmoji || "🔥",
    userAvatarColor: userData.avatarColor || "green",
    userProfilePicture: userData.profilePicture || null,
    text: text.trim(),
    images: uploadedImages,
    thumbsUp: [],
    thumbsDown: [],
    thumbsUpCount: 0,
    thumbsDownCount: 0,
    commentsCount: 0,
    createdAt: new Date(),
  };
}

/**
 * Get posts for a specific user
 */
export async function getUserPosts(userId, postLimit = 20) {
  const postsRef = collection(db, "posts");
  const q = query(
    postsRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(postLimit)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      userId: data.userId,
      username: data.username,
      userAvatar: data.userAvatar,
      userAvatarColor: data.userAvatarColor,
      userProfilePicture: data.userProfilePicture,
      text: data.text,
      images: data.images || [],
      thumbsUp: data.thumbsUp || [],
      thumbsDown: data.thumbsDown || [],
      thumbsUpCount: data.thumbsUpCount || 0,
      thumbsDownCount: data.thumbsDownCount || 0,
      commentsCount: data.commentsCount || 0,
      createdAt: data.createdAt?.toDate?.() || new Date(),
    };
  });
}

/**
 * Subscribe to posts for a specific user (real-time)
 */
export function subscribeToUserPosts(userId, callback, postLimit = 20) {
  const postsRef = collection(db, "posts");
  const q = query(
    postsRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(postLimit)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const posts = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId: data.userId,
          username: data.username,
          userAvatar: data.userAvatar,
          userAvatarColor: data.userAvatarColor,
          userProfilePicture: data.userProfilePicture,
          text: data.text,
          images: data.images || [],
          thumbsUp: data.thumbsUp || [],
          thumbsDown: data.thumbsDown || [],
          thumbsUpCount: data.thumbsUpCount || 0,
          thumbsDownCount: data.thumbsDownCount || 0,
          commentsCount: data.commentsCount || 0,
          createdAt: data.createdAt?.toDate?.() || new Date(),
        };
      });
      callback(posts);
    },
    (error) => {
      console.error("Error subscribing to posts:", error);
      callback([]);
    }
  );
}

/**
 * Thumbs up a post (removes thumbs down if present)
 */
export async function thumbsUpPost(postId, userId, hasThumbsDown) {
  const postRef = doc(db, "posts", postId);

  if (hasThumbsDown) {
    await updateDoc(postRef, {
      thumbsDown: arrayRemove(userId),
      thumbsDownCount: increment(-1),
      thumbsUp: arrayUnion(userId),
      thumbsUpCount: increment(1),
    });
  } else {
    await updateDoc(postRef, {
      thumbsUp: arrayUnion(userId),
      thumbsUpCount: increment(1),
    });
  }
}

/**
 * Remove thumbs up from a post
 */
export async function removeThumbsUp(postId, userId) {
  const postRef = doc(db, "posts", postId);
  await updateDoc(postRef, {
    thumbsUp: arrayRemove(userId),
    thumbsUpCount: increment(-1),
  });
}

/**
 * Thumbs down a post (removes thumbs up if present)
 */
export async function thumbsDownPost(postId, userId, hasThumbsUp) {
  const postRef = doc(db, "posts", postId);

  if (hasThumbsUp) {
    await updateDoc(postRef, {
      thumbsUp: arrayRemove(userId),
      thumbsUpCount: increment(-1),
      thumbsDown: arrayUnion(userId),
      thumbsDownCount: increment(1),
    });
  } else {
    await updateDoc(postRef, {
      thumbsDown: arrayUnion(userId),
      thumbsDownCount: increment(1),
    });
  }
}

/**
 * Remove thumbs down from a post
 */
export async function removeThumbsDown(postId, userId) {
  const postRef = doc(db, "posts", postId);
  await updateDoc(postRef, {
    thumbsDown: arrayRemove(userId),
    thumbsDownCount: increment(-1),
  });
}

/**
 * Delete a post
 */
export async function deletePost(postId) {
  await deleteDoc(doc(db, "posts", postId));
}

/**
 * Add a comment to a post
 */
export async function addComment(postId, userId, userData, text) {
  const commentsRef = collection(db, "posts", postId, "comments");
  const postRef = doc(db, "posts", postId);

  const commentDoc = await addDoc(commentsRef, {
    postId,
    userId,
    username: userData.username,
    userAvatar: userData.avatarEmoji || "🔥",
    userAvatarColor: userData.avatarColor || "green",
    userProfilePicture: userData.profilePicture || null,
    text: text.trim(),
    createdAt: serverTimestamp(),
  });

  // Increment comments count on post
  await updateDoc(postRef, {
    commentsCount: increment(1),
  });

  return {
    id: commentDoc.id,
    postId,
    userId,
    username: userData.username,
    userAvatar: userData.avatarEmoji || "🔥",
    userAvatarColor: userData.avatarColor || "green",
    userProfilePicture: userData.profilePicture || null,
    text: text.trim(),
    createdAt: new Date(),
  };
}

/**
 * Get comments for a post
 */
export async function getComments(postId) {
  const commentsRef = collection(db, "posts", postId, "comments");
  const q = query(commentsRef, orderBy("createdAt", "asc"));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      postId: data.postId,
      userId: data.userId,
      username: data.username,
      userAvatar: data.userAvatar,
      userAvatarColor: data.userAvatarColor,
      userProfilePicture: data.userProfilePicture,
      text: data.text,
      createdAt: data.createdAt?.toDate?.() || new Date(),
    };
  });
}

/**
 * Subscribe to comments for a post (real-time)
 */
export function subscribeToComments(postId, callback) {
  const commentsRef = collection(db, "posts", postId, "comments");
  const q = query(commentsRef, orderBy("createdAt", "asc"));

  return onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        postId: data.postId,
        userId: data.userId,
        username: data.username,
        userAvatar: data.userAvatar,
        userAvatarColor: data.userAvatarColor,
        userProfilePicture: data.userProfilePicture,
        text: data.text,
        createdAt: data.createdAt?.toDate?.() || new Date(),
      };
    });
    callback(comments);
  });
}

/**
 * Delete a comment
 */
export async function deleteComment(postId, commentId) {
  const postRef = doc(db, "posts", postId);
  await deleteDoc(doc(db, "posts", postId, "comments", commentId));

  // Decrement comments count on post
  await updateDoc(postRef, {
    commentsCount: increment(-1),
  });
}

/**
 * Get posts from user and their friends (Friends Feed)
 */
export async function getFriendsFeedPosts(userId, friendIds, postLimit = 20) {
  if (!userId) {
    console.warn("getFriendsFeedPosts called with invalid userId");
    return [];
  }

  // Include user's own posts + friends' posts
  const allUserIds = [userId, ...friendIds].filter(
    (id) => id !== undefined && id !== null && id !== ""
  );

  if (allUserIds.length === 0) {
    return [];
  }

  // Firestore 'in' queries are limited to 30 items
  const chunks = [];
  for (let i = 0; i < allUserIds.length; i += 30) {
    chunks.push(allUserIds.slice(i, i + 30));
  }

  const allPosts = [];

  for (const chunk of chunks) {
    const postsRef = collection(db, "posts");
    const q = query(
      postsRef,
      where("userId", "in", chunk),
      orderBy("createdAt", "desc"),
      limit(postLimit)
    );

    const snapshot = await getDocs(q);
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      allPosts.push({
        id: docSnap.id,
        userId: data.userId,
        username: data.username,
        userAvatar: data.userAvatar,
        userAvatarColor: data.userAvatarColor,
        userProfilePicture: data.userProfilePicture,
        text: data.text,
        images: data.images || [],
        thumbsUp: data.thumbsUp || [],
        thumbsDown: data.thumbsDown || [],
        thumbsUpCount: data.thumbsUpCount || 0,
        thumbsDownCount: data.thumbsDownCount || 0,
        commentsCount: data.commentsCount || 0,
        createdAt: data.createdAt?.toDate?.() || new Date(),
      });
    });
  }

  // Sort by createdAt descending and limit
  return allPosts
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, postLimit);
}

/**
 * Calculate "Hot" score for a post
 */
function calculateHotScore(post) {
  const engagementScore =
    post.thumbsUpCount + post.thumbsDownCount + post.commentsCount * 2;

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

/**
 * Get discover/trending posts using "Hot" algorithm
 */
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
    const data = docSnap.data();
    const thumbsUpCount = data.thumbsUpCount || 0;
    const thumbsDownCount = data.thumbsDownCount || 0;
    const commentsCount = data.commentsCount || 0;

    const engagementScore = thumbsUpCount + thumbsDownCount + commentsCount;

    // Skip posts with 0 engagement for Discover
    if (engagementScore < 1) {
      return;
    }

    const post = {
      id: docSnap.id,
      userId: data.userId,
      username: data.username,
      userAvatar: data.userAvatar,
      userAvatarColor: data.userAvatarColor,
      userProfilePicture: data.userProfilePicture,
      text: data.text,
      images: data.images || [],
      thumbsUp: data.thumbsUp || [],
      thumbsDown: data.thumbsDown || [],
      thumbsUpCount,
      thumbsDownCount,
      commentsCount,
      createdAt: data.createdAt?.toDate?.() || new Date(),
    };

    posts.push({
      ...post,
      hotScore: calculateHotScore(post),
    });
  });

  posts.sort((a, b) => b.hotScore - a.hotScore);

  return posts.slice(0, postLimit).map(({ hotScore, ...post }) => post);
}

export default {
  createPost,
  getUserPosts,
  subscribeToUserPosts,
  getFriendsFeedPosts,
  getDiscoverPosts,
  thumbsUpPost,
  removeThumbsUp,
  thumbsDownPost,
  removeThumbsDown,
  deletePost,
  addComment,
  getComments,
  subscribeToComments,
  deleteComment,
};
