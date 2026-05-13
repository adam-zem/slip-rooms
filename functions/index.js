// functions/index.js - Cloud Functions for SlipRooms
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

// Maximum batch size for Firestore operations
const BATCH_SIZE = 500;

/**
 * Helper: Delete documents in batches
 * @param {admin.firestore.Query} query - The query to delete documents from
 * @returns {Promise<number>} - Number of documents deleted
 */
async function deleteQueryBatches(query) {
  let totalDeleted = 0;
  let snapshot = await query.limit(BATCH_SIZE).get();

  while (snapshot.size > 0) {
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    totalDeleted += snapshot.size;

    if (snapshot.size < BATCH_SIZE) {
      break;
    }
    snapshot = await query.limit(BATCH_SIZE).get();
  }

  return totalDeleted;
}

/**
 * Helper: Remove userId from array field in documents matching a query
 * @param {admin.firestore.Query} query - The query to find documents
 * @param {string} fieldName - The array field name to update
 * @param {string} userId - The user ID to remove from the array
 * @returns {Promise<number>} - Number of documents updated
 */
async function removeFromArrayField(query, fieldName, userId) {
  let totalUpdated = 0;
  let snapshot = await query.limit(BATCH_SIZE).get();

  while (snapshot.size > 0) {
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        [fieldName]: admin.firestore.FieldValue.arrayRemove(userId),
      });
    });
    await batch.commit();
    totalUpdated += snapshot.size;

    if (snapshot.size < BATCH_SIZE) {
      break;
    }
    snapshot = await query.limit(BATCH_SIZE).get();
  }

  return totalUpdated;
}

/**
 * Helper: Verify Firebase ID token from Authorization header
 * @param {string} authHeader - The Authorization header value
 * @returns {Promise<{uid: string}>} - Decoded token with uid
 */
async function verifyAuthToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}

/**
 * Admin Delete User (HTTP version) - For mobile app compatibility
 * Manually verifies auth token since onCall doesn't work with React Native direct HTTP
 */
exports.adminDeleteUserHttp = functions.https.onRequest(async (req, res) => {
  // Handle CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }

  try {
    // 1. Verify authentication manually
    const decodedToken = await verifyAuthToken(req.headers.authorization);
    if (!decodedToken) {
      res.status(401).json({ error: { message: "Unauthenticated" } });
      return;
    }

    const callerUid = decodedToken.uid;
    const targetUserId = req.body.targetUserId;

    if (!targetUserId) {
      res.status(400).json({ error: { message: "targetUserId is required" } });
      return;
    }

    // 2. Verify caller is an admin
    const callerDoc = await db.collection("users").doc(callerUid).get();
    if (!callerDoc.exists || !callerDoc.data().isAdmin) {
      res.status(403).json({ error: { message: "Only admins can delete user accounts" } });
      return;
    }

    // 3. Prevent self-deletion
    if (callerUid === targetUserId) {
      res.status(400).json({ error: { message: "Cannot delete your own account" } });
      return;
    }

    // 4. Get target user data
    const targetUserDoc = await db.collection("users").doc(targetUserId).get();
    if (!targetUserDoc.exists) {
      res.status(404).json({ error: { message: "Target user not found" } });
      return;
    }

    const targetUserData = targetUserDoc.data();
    const username = targetUserData.username || "";
    const usernameLower = targetUserData.usernameLower || username.toLowerCase();

    // Run the deletion (same logic as onCall version)
    const deletionSummary = {
      posts: 0, likes: 0, dislikes: 0, reposts: 0, greatestHits: 0,
      notifications: 0, friendships: 0, friendRequests: 0, friends: 0,
      conversations: 0, roomMessages: 0, roomSubmissions: 0,
      reports: 0, filterLogs: 0, blockedReferences: 0,
    };

    // Phase 2-7: Delete all user data (simplified - calls same queries)
    deletionSummary.posts = await deleteQueryBatches(
      db.collection("posts").where("authorId", "==", targetUserId)
    );
    deletionSummary.likes = await deleteQueryBatches(
      db.collection("likes").where("userId", "==", targetUserId)
    );
    deletionSummary.dislikes = await deleteQueryBatches(
      db.collection("dislikes").where("userId", "==", targetUserId)
    );
    deletionSummary.reposts = await deleteQueryBatches(
      db.collection("reposts").where("userId", "==", targetUserId)
    );
    deletionSummary.greatestHits = await deleteQueryBatches(
      db.collection("greatestHits").where("oddieid", "==", targetUserId)
    );

    // Notifications
    const notifReceived = await deleteQueryBatches(
      db.collection("notifications").where("userId", "==", targetUserId)
    );
    const notifSent = await deleteQueryBatches(
      db.collection("notifications").where("fromUserId", "==", targetUserId)
    );
    deletionSummary.notifications = notifReceived + notifSent;

    // Friendships
    const fs1 = await deleteQueryBatches(
      db.collection("friendships").where("user1", "==", targetUserId)
    );
    const fs2 = await deleteQueryBatches(
      db.collection("friendships").where("user2", "==", targetUserId)
    );
    deletionSummary.friendships = fs1 + fs2;

    // Friend requests
    const fr1 = await deleteQueryBatches(
      db.collection("friendRequests").where("from", "==", targetUserId)
    );
    const fr2 = await deleteQueryBatches(
      db.collection("friendRequests").where("to", "==", targetUserId)
    );
    deletionSummary.friendRequests = fr1 + fr2;

    // Friends collection
    const friends1 = await deleteQueryBatches(
      db.collection("friends").where("oddieid", "==", targetUserId)
    );
    const friends2 = await deleteQueryBatches(
      db.collection("friends").where("oddiefriendid", "==", targetUserId)
    );
    deletionSummary.friends = friends1 + friends2;

    // Conversations
    const convosSnapshot = await db.collection("conversations")
      .where("participants", "array-contains", targetUserId)
      .get();
    for (const convoDoc of convosSnapshot.docs) {
      const messagesQuery = db.collection("conversations").doc(convoDoc.id).collection("messages");
      await deleteQueryBatches(messagesQuery);
      await convoDoc.ref.delete();
      deletionSummary.conversations++;
    }

    // Room messages
    const roomsSnapshot = await db.collection("rooms").get();
    for (const roomDoc of roomsSnapshot.docs) {
      const deleted = await deleteQueryBatches(
        db.collection("rooms").doc(roomDoc.id).collection("messages")
          .where("userId", "==", targetUserId)
      );
      deletionSummary.roomMessages += deleted;
    }

    // Other data
    deletionSummary.roomSubmissions = await deleteQueryBatches(
      db.collection("roomSubmissions").where("oddieid", "==", targetUserId)
    );
    deletionSummary.reports = await deleteQueryBatches(
      db.collection("reports").where("reporterId", "==", targetUserId)
    );
    deletionSummary.filterLogs = await deleteQueryBatches(
      db.collection("filterLogs").where("userId", "==", targetUserId)
    );

    // Delete presence
    try {
      await db.collection("presence").doc(targetUserId).delete();
    } catch (e) {}

    // Delete username reservation
    if (usernameLower) {
      try {
        await db.collection("usernames").doc(usernameLower).delete();
      } catch (e) {}
    }

    // Delete user document
    await db.collection("users").doc(targetUserId).delete();

    // Delete profile picture
    try {
      const bucket = storage.bucket();
      await bucket.deleteFiles({ prefix: `profilePictures/${targetUserId}` });
    } catch (e) {}

    // Delete Firebase Auth account
    try {
      await auth.deleteUser(targetUserId);
    } catch (e) {}

    // Log admin action
    await db.collection("adminLogs").add({
      adminId: callerUid,
      action: "delete_user_account",
      targetUserId,
      targetUsername: username,
      deletionSummary,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      result: {
        success: true,
        deletedUserId: targetUserId,
        deletedUsername: username,
        deletionSummary,
      },
    });
  } catch (error) {
    console.error("Error in adminDeleteUserHttp:", error);
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * Admin Delete User - Completely removes a user and all their data
 * Callable function that only admins can invoke
 */
exports.adminDeleteUser = functions.https.onCall(async (data, context) => {
  // 1. Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be authenticated to delete users."
    );
  }

  const callerUid = context.auth.uid;
  const targetUserId = data.targetUserId;

  if (!targetUserId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "targetUserId is required."
    );
  }

  // 2. Verify caller is an admin
  const callerDoc = await db.collection("users").doc(callerUid).get();
  if (!callerDoc.exists || !callerDoc.data().isAdmin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admins can delete user accounts."
    );
  }

  // 3. Prevent self-deletion
  if (callerUid === targetUserId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Admins cannot delete their own account via this function."
    );
  }

  // 4. Get target user data for logging
  const targetUserDoc = await db.collection("users").doc(targetUserId).get();
  if (!targetUserDoc.exists) {
    throw new functions.https.HttpsError(
      "not-found",
      "Target user not found."
    );
  }

  const targetUserData = targetUserDoc.data();
  const username = targetUserData.username || "";
  const email = targetUserData.email || "";
  const usernameLower = username.toLowerCase();

  // Track deletion summary
  const summary = {
    posts: 0,
    likes: 0,
    dislikes: 0,
    reposts: 0,
    greatestHits: 0,
    notifications: 0,
    friendships: 0,
    friendRequests: 0,
    friends: 0,
    conversations: 0,
    conversationMessages: 0,
    roomMessages: 0,
    roomSubmissions: 0,
    reports: 0,
    filterLogs: 0,
    presence: 0,
    blockedCleanup: 0,
    usernameReservation: 0,
    userDocument: 0,
    profilePicture: false,
    authAccount: false,
  };

  try {
    // Phase 1: Already done - got user data

    // Phase 2: Delete user-created content
    // Posts (where authorId or userId matches)
    const postsQuery1 = db.collection("posts").where("authorId", "==", targetUserId);
    const postsQuery2 = db.collection("posts").where("userId", "==", targetUserId);
    summary.posts += await deleteQueryBatches(postsQuery1);
    summary.posts += await deleteQueryBatches(postsQuery2);

    // Likes
    const likesQuery = db.collection("likes").where("userId", "==", targetUserId);
    summary.likes = await deleteQueryBatches(likesQuery);

    // Dislikes
    const dislikesQuery = db.collection("dislikes").where("userId", "==", targetUserId);
    summary.dislikes = await deleteQueryBatches(dislikesQuery);

    // Reposts
    const repostsQuery = db.collection("reposts").where("userId", "==", targetUserId);
    summary.reposts = await deleteQueryBatches(repostsQuery);

    // Greatest Hits
    const hitsQuery = db.collection("greatestHits").where("userId", "==", targetUserId);
    summary.greatestHits = await deleteQueryBatches(hitsQuery);

    // Phase 3: Delete notifications (received and sent)
    const notificationsQuery1 = db.collection("notifications").where("userId", "==", targetUserId);
    const notificationsQuery2 = db.collection("notifications").where("fromUserId", "==", targetUserId);
    summary.notifications += await deleteQueryBatches(notificationsQuery1);
    summary.notifications += await deleteQueryBatches(notificationsQuery2);

    // Phase 4: Delete social connections
    // Friendships (user1 or user2 matches)
    const friendshipsQuery1 = db.collection("friendships").where("user1", "==", targetUserId);
    const friendshipsQuery2 = db.collection("friendships").where("user2", "==", targetUserId);
    summary.friendships += await deleteQueryBatches(friendshipsQuery1);
    summary.friendships += await deleteQueryBatches(friendshipsQuery2);

    // Friend requests (from or to matches)
    const friendRequestsQuery1 = db.collection("friendRequests").where("from", "==", targetUserId);
    const friendRequestsQuery2 = db.collection("friendRequests").where("to", "==", targetUserId);
    summary.friendRequests += await deleteQueryBatches(friendRequestsQuery1);
    summary.friendRequests += await deleteQueryBatches(friendRequestsQuery2);

    // Friends collection (userId or friendId matches)
    const friendsQuery1 = db.collection("friends").where("userId", "==", targetUserId);
    const friendsQuery2 = db.collection("friends").where("friendId", "==", targetUserId);
    summary.friends += await deleteQueryBatches(friendsQuery1);
    summary.friends += await deleteQueryBatches(friendsQuery2);

    // Phase 5: Delete conversations and messages
    // Find conversations where user is a participant
    const conversationsSnapshot = await db.collection("conversations")
      .where("participants", "array-contains", targetUserId)
      .get();

    for (const convDoc of conversationsSnapshot.docs) {
      // Delete all messages in the conversation
      const messagesQuery = convDoc.ref.collection("messages");
      summary.conversationMessages += await deleteQueryBatches(messagesQuery);
      // Delete the conversation itself
      await convDoc.ref.delete();
      summary.conversations++;
    }

    // Phase 6: Delete room messages from all rooms
    const roomsSnapshot = await db.collection("rooms").get();
    for (const roomDoc of roomsSnapshot.docs) {
      const roomMessagesQuery = roomDoc.ref.collection("messages")
        .where("userId", "==", targetUserId);
      summary.roomMessages += await deleteQueryBatches(roomMessagesQuery);
    }

    // Phase 7: Delete misc data
    // Room submissions (oddieid matches)
    const submissionsQuery = db.collection("roomSubmissions").where("oddieid", "==", targetUserId);
    summary.roomSubmissions = await deleteQueryBatches(submissionsQuery);

    // Reports (reporterId matches)
    const reportsQuery = db.collection("reports").where("reporterId", "==", targetUserId);
    summary.reports = await deleteQueryBatches(reportsQuery);

    // Filter logs (userId matches)
    const filterLogsQuery = db.collection("filterLogs").where("userId", "==", targetUserId);
    summary.filterLogs = await deleteQueryBatches(filterLogsQuery);

    // Presence document
    const presenceRef = db.collection("presence").doc(targetUserId);
    const presenceDoc = await presenceRef.get();
    if (presenceDoc.exists) {
      await presenceRef.delete();
      summary.presence = 1;
    }

    // Phase 8: Clean up blocked arrays on other users
    // Find users who have this user in their blockedUsers array
    const blockedByQuery = db.collection("users").where("blockedUsers", "array-contains", targetUserId);
    summary.blockedCleanup += await removeFromArrayField(blockedByQuery, "blockedUsers", targetUserId);

    // Find users who have this user in their blockedBy array
    const blockedUsersQuery = db.collection("users").where("blockedBy", "array-contains", targetUserId);
    summary.blockedCleanup += await removeFromArrayField(blockedUsersQuery, "blockedBy", targetUserId);

    // Phase 9: Delete username reservation
    if (usernameLower) {
      const usernameRef = db.collection("usernames").doc(usernameLower);
      const usernameDoc = await usernameRef.get();
      if (usernameDoc.exists) {
        await usernameRef.delete();
        summary.usernameReservation = 1;
      }
    }

    // Phase 10: Delete user document
    await db.collection("users").doc(targetUserId).delete();
    summary.userDocument = 1;

    // Phase 11: Delete profile picture from Storage
    if (targetUserData.profilePicture) {
      try {
        const bucket = storage.bucket();
        const filePath = `profilePics/${targetUserId}`;
        await bucket.file(filePath).delete();
        summary.profilePicture = true;
      } catch (storageErr) {
        // File might not exist, continue
        console.log("Profile picture deletion skipped:", storageErr.message);
      }
    }

    // Phase 12: Delete Firebase Auth account
    try {
      await auth.deleteUser(targetUserId);
      summary.authAccount = true;
    } catch (authErr) {
      // Auth account might not exist if user signed up differently
      console.log("Auth account deletion skipped:", authErr.message);
    }

    // Phase 13: Log admin action
    const adminUsername = callerDoc.data().username || callerUid;
    const logId = `${Date.now()}-${callerUid}`;
    await db.collection("adminLogs").doc(logId).set({
      id: logId,
      adminId: callerUid,
      adminUsername: adminUsername,
      action: "delete_user_account_complete",
      details: {
        userId: targetUserId,
        username: username,
        email: email,
        summary: summary,
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      message: `User ${username} (${targetUserId}) has been completely deleted.`,
      summary: summary,
    };

  } catch (error) {
    console.error("Error in adminDeleteUser:", error);
    throw new functions.https.HttpsError(
      "internal",
      `Failed to delete user: ${error.message}`
    );
  }
});

// ==================== DYNAMIC LINK PREVIEWS ====================
// Serves HTML with Open Graph meta tags for rich link previews in iMessage/social media
// Also handles smart app banner and redirect to App Store

const APP_STORE_URL = "https://apps.apple.com/app/sliprooms/id6759553452";
const LOGO_URL = "https://sliprooms.com/images/app-icon.png";

/**
 * Generate HTML with Open Graph meta tags for link previews
 */
function generatePreviewHTML(options) {
  const {
    title,
    description,
    imageUrl = LOGO_URL,
    url,
    type = "website",
    appArgument = "",
  } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="${type}">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:site_name" content="SlipRooms">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">

  <!-- iOS Smart App Banner -->
  <meta name="apple-itunes-app" content="app-id=6759553452, app-argument=${appArgument}">

  <title>${title} - SlipRooms</title>

  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      text-align: center;
    }
    .logo { width: 80px; height: 80px; margin-bottom: 20px; border-radius: 16px; }
    h1 { color: #047857; margin: 0 0 10px; font-size: 24px; }
    p { color: #888; margin: 0 0 30px; font-size: 16px; }
    .btn {
      background: #047857;
      color: #fff;
      padding: 14px 28px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
    }
    .btn:hover { background: #059669; }
    .secondary { color: #666; margin-top: 20px; font-size: 14px; }
    .secondary a { color: #047857; }
  </style>
</head>
<body>
  <img src="${LOGO_URL}" alt="SlipRooms" class="logo">
  <h1>${title}</h1>
  <p>${description}</p>
  <a href="${APP_STORE_URL}" class="btn">Open in App</a>
  <p class="secondary">Don't have the app? <a href="${APP_STORE_URL}">Download SlipRooms</a></p>

  <script>
    // Try to open the app, fallback to App Store
    (function() {
      var appUrl = "sliprooms://${appArgument}";
      var start = Date.now();

      // Try opening the app
      window.location.href = appUrl;

      // If still here after 1.5s, app probably not installed
      setTimeout(function() {
        if (Date.now() - start < 2000) {
          // User came back quickly, app opened
        }
      }, 1500);
    })();
  </script>
</body>
</html>`;
}

/**
 * Dynamic link handler for rooms
 */
exports.roomPreview = functions.https.onRequest(async (req, res) => {
  const roomId = req.path.split("/").pop() || req.query.id;

  if (!roomId) {
    res.status(400).send("Room ID required");
    return;
  }

  try {
    const roomDoc = await db.collection("rooms").doc(roomId).get();

    let title = "Join this Room";
    let description = "Come sweat with us on SlipRooms!";

    if (roomDoc.exists) {
      const room = roomDoc.data();
      title = room.name || "Live Room";
      description = room.gameName
        ? `${room.gameName} • ${room.userCount || 0} sweating`
        : `${room.userCount || 0} people sweating in this room`;
    }

    const html = generatePreviewHTML({
      title,
      description,
      url: `https://sliprooms.com/room/${roomId}`,
      appArgument: `room/${roomId}`,
    });

    res.set("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    console.error("Error generating room preview:", error);
    res.status(500).send("Error loading room");
  }
});

/**
 * Dynamic link handler for posts
 */
exports.postPreview = functions.https.onRequest(async (req, res) => {
  const postId = req.path.split("/").pop() || req.query.id;

  if (!postId) {
    res.status(400).send("Post ID required");
    return;
  }

  try {
    const postDoc = await db.collection("posts").doc(postId).get();

    let title = "Post on SlipRooms";
    let description = "Check out this post on SlipRooms";
    let imageUrl = LOGO_URL;

    if (postDoc.exists) {
      const post = postDoc.data();
      title = post.username ? `@${post.username} on SlipRooms` : "Post on SlipRooms";
      description = post.text
        ? (post.text.length > 150 ? post.text.slice(0, 150) + "..." : post.text)
        : "Check out this post on SlipRooms";

      // Use post image if available
      if (post.images && post.images.length > 0) {
        imageUrl = post.images[0];
      }
    }

    const html = generatePreviewHTML({
      title,
      description,
      imageUrl,
      url: `https://sliprooms.com/post/${postId}`,
      appArgument: `post/${postId}`,
    });

    res.set("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    console.error("Error generating post preview:", error);
    res.status(500).send("Error loading post");
  }
});

/**
 * Dynamic link handler for user profiles
 */
exports.userPreview = functions.https.onRequest(async (req, res) => {
  const userId = req.path.split("/").pop() || req.query.id;

  if (!userId) {
    res.status(400).send("User ID required");
    return;
  }

  try {
    const userDoc = await db.collection("users").doc(userId).get();

    let title = "Profile on SlipRooms";
    let description = "Check out this profile on SlipRooms";
    let imageUrl = LOGO_URL;

    if (userDoc.exists) {
      const user = userDoc.data();
      title = user.username ? `@${user.username}` : "SlipRooms User";
      description = user.bio || "Check out this profile on SlipRooms";

      if (user.profilePicture) {
        imageUrl = user.profilePicture;
      }
    }

    const html = generatePreviewHTML({
      title,
      description,
      imageUrl,
      url: `https://sliprooms.com/user/${userId}`,
      appArgument: `user/${userId}`,
      type: "profile",
    });

    res.set("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    console.error("Error generating user preview:", error);
    res.status(500).send("Error loading profile");
  }
});

// ==================== SWEAT POINTS SYSTEM ====================

/**
 * Award Sweat Points to a user
 * Called when someone likes/unlikes a post
 * Bypasses security rules since it runs server-side
 */
exports.awardSweatPoints = functions.https.onCall(async (data, context) => {
  // Verify the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to award sweat points"
    );
  }

  const { recipientUserId, amount, action } = data;

  // Validate input
  if (!recipientUserId || typeof recipientUserId !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "recipientUserId is required and must be a string"
    );
  }

  if (typeof amount !== "number" || amount === 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "amount is required and must be a non-zero number"
    );
  }

  // Don't allow self-awarding
  if (recipientUserId === context.auth.uid) {
    console.log(`[awardSweatPoints] Skipping self-award for user ${recipientUserId}`);
    return { success: true, message: "Self-award skipped" };
  }

  try {
    const userRef = db.collection("users").doc(recipientUserId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log(`[awardSweatPoints] User ${recipientUserId} not found`);
      throw new functions.https.HttpsError(
        "not-found",
        `User ${recipientUserId} not found`
      );
    }

    const userData = userDoc.data() || {};
    const currentSweatPoints = userData.sweatPoints || 0;
    const currentWeeklyPoints = userData.weeklySweatPoints || 0;

    const newSweatPoints = currentSweatPoints + amount;
    const newWeeklyPoints = currentWeeklyPoints + amount;

    await userRef.update({
      sweatPoints: newSweatPoints,
      weeklySweatPoints: newWeeklyPoints,
    });

    console.log(
      `[awardSweatPoints] SUCCESS: ${action || "update"} ${amount} SP for user ${recipientUserId}. ` +
      `Old: ${currentSweatPoints}, New: ${newSweatPoints}`
    );

    return {
      success: true,
      recipientUserId,
      amount,
      oldSweatPoints: currentSweatPoints,
      newSweatPoints,
      action: action || "update",
    };
  } catch (error) {
    console.error(`[awardSweatPoints] Error:`, error);
    throw new functions.https.HttpsError(
      "internal",
      `Failed to award sweat points: ${error.message}`
    );
  }
});

// ==================== HASHTAG TRACKING ====================

/**
 * Record hashtag usage when a post is created
 * Ensures hashtags are properly tracked in the hashtags collection
 */
exports.recordHashtags = functions.https.onCall(async (data, context) => {
  // Verify the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to record hashtags"
    );
  }

  const { hashtags } = data;

  if (!hashtags || !Array.isArray(hashtags) || hashtags.length === 0) {
    return { success: true, message: "No hashtags to record" };
  }

  try {
    const batch = db.batch();
    const hashtagsRef = db.collection("hashtags");

    for (const tag of hashtags) {
      const normalizedTag = String(tag).toLowerCase().trim();
      if (!normalizedTag) continue;

      const tagDocRef = hashtagsRef.doc(normalizedTag);
      const tagDoc = await tagDocRef.get();

      if (tagDoc.exists) {
        const currentCount = tagDoc.data().count || 0;
        batch.update(tagDocRef, {
          count: currentCount + 1,
          lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        batch.set(tagDocRef, {
          tag: normalizedTag,
          count: 1,
          lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    await batch.commit();
    console.log(`[recordHashtags] Recorded ${hashtags.length} hashtags`);

    return {
      success: true,
      hashtagsRecorded: hashtags.length,
    };
  } catch (error) {
    console.error(`[recordHashtags] Error:`, error);
    throw new functions.https.HttpsError(
      "internal",
      `Failed to record hashtags: ${error.message}`
    );
  }
});

// Send password reset email via Resend
exports.sendPasswordResetEmail = functions
  .runWith({ secrets: ["RESEND_API_KEY"] })
  .https.onCall(async (data, context) => {
  const { email } = data;
  if (!email) throw new functions.https.HttpsError("invalid-argument", "Email is required");

  try {
    const resetLink = await auth.generatePasswordResetLink(email);
    const { Resend } = require("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "SlipRooms <support@sliprooms.com>",
      to: email,
      subject: "Reset your SlipRooms password",
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0a0a0a;color:#fff;padding:32px;border-radius:12px">
        <h2 style="color:#10b981">SlipRooms</h2>
        <p>You requested a password reset. Click the button below to set a new password.</p>
        <a href="${resetLink}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">Reset Password</a>
        <p style="color:#888;font-size:12px">If you didn't request this, ignore this email. This link expires in 1 hour.</p>
      </div>`
    });

    return { success: true };
  } catch (error) {
    console.error("Password reset error:", error);
    throw new functions.https.HttpsError("internal", "Failed to send reset email");
  }
});

// ==================== PUSH NOTIFICATIONS ====================

/**
 * Send an Expo push notification
 * @param {string} expoPushToken - The user's Expo push token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data payload
 */
async function sendExpoPushNotification(expoPushToken, title, body, data = {}) {
  if (!expoPushToken || !expoPushToken.startsWith("ExponentPushToken[")) {
    console.log("[PushNotification] Invalid or missing push token:", expoPushToken);
    return;
  }

  const message = {
    to: expoPushToken,
    sound: "default",
    title,
    body,
    data,
  };

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    console.log("[PushNotification] Sent:", result);
    return result;
  } catch (error) {
    console.error("[PushNotification] Error sending:", error);
  }
}

/**
 * Check if we should send a notification to a user
 * Returns the recipient's expoPushToken if all checks pass, else null
 *
 * Checks:
 * 1. recipientUid !== actorUid (not self-action)
 * 2. Neither user has blocked the other
 * 3. recipient's notificationPreferences[notifType] !== false
 * 4. recipient has a valid expoPushToken
 *
 * @param {string} recipientUid - The user who would receive the notification
 * @param {string} actorUid - The user who performed the action
 * @param {string} notifType - The notification type (follows, upvotes, reposts, replies, mentions, dms, dislikes)
 * @returns {Promise<{allowed: boolean, token: string|null, recipientData: object|null, actorData: object|null}>}
 */
async function shouldNotifyUser(recipientUid, actorUid, notifType) {
  // Check 1: Not self-action
  if (!recipientUid || !actorUid || recipientUid === actorUid) {
    return { allowed: false, token: null, recipientData: null, actorData: null };
  }

  try {
    // Fetch both users in parallel
    const [recipientDoc, actorDoc] = await Promise.all([
      db.collection("users").doc(recipientUid).get(),
      db.collection("users").doc(actorUid).get(),
    ]);

    if (!recipientDoc.exists) {
      return { allowed: false, token: null, recipientData: null, actorData: null };
    }

    const recipientData = { id: recipientUid, ...recipientDoc.data() };
    const actorData = actorDoc.exists ? { id: actorUid, ...actorDoc.data() } : null;

    // Check 2: Neither user has blocked the other
    // blockedUsers is an array of objects with {id, username, ...}
    const recipientBlockedUsers = recipientData.blockedUsers || [];
    const actorBlockedUsers = actorData?.blockedUsers || [];

    // Check if recipient blocked actor
    const recipientBlockedActor = recipientBlockedUsers.some((b) => b.id === actorUid);
    if (recipientBlockedActor) {
      console.log(`[shouldNotifyUser] Blocked: recipient ${recipientUid} blocked actor ${actorUid}`);
      return { allowed: false, token: null, recipientData, actorData };
    }

    // Check if actor blocked recipient
    const actorBlockedRecipient = actorBlockedUsers.some((b) => b.id === recipientUid);
    if (actorBlockedRecipient) {
      console.log(`[shouldNotifyUser] Blocked: actor ${actorUid} blocked recipient ${recipientUid}`);
      return { allowed: false, token: null, recipientData, actorData };
    }

    // Check 3: Notification preferences
    // Default to true if preferences don't exist or key is missing
    const prefs = recipientData.notificationPreferences || {};
    const prefValue = prefs[notifType];
    if (prefValue === false) {
      console.log(`[shouldNotifyUser] Disabled: recipient ${recipientUid} has ${notifType} notifications off`);
      return { allowed: false, token: null, recipientData, actorData };
    }

    // Check 4: Valid push token
    const token = recipientData.expoPushToken;
    if (!token || !token.startsWith("ExponentPushToken[")) {
      console.log(`[shouldNotifyUser] No valid push token for ${recipientUid}`);
      return { allowed: false, token: null, recipientData, actorData };
    }

    return { allowed: true, token, recipientData, actorData };
  } catch (error) {
    console.error("[shouldNotifyUser] Error:", error);
    return { allowed: false, token: null, recipientData: null, actorData: null };
  }
}

/**
 * Trigger: New follower created
 * Sends push notification to the user being followed
 */
exports.onNewFollower = functions.firestore
  .document("followers/{followerId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const followerId = data.user1; // The user doing the following
    const followedId = data.user2; // The user being followed

    if (!followerId || !followedId) return;

    try {
      // Check if we should notify (handles self-action, blocks, prefs, token)
      const { allowed, token, actorData } = await shouldNotifyUser(followedId, followerId, "follows");
      if (!allowed) return;

      const followerName = actorData?.username || "Someone";

      await sendExpoPushNotification(
        token,
        "New Follower",
        `${followerName} started following you`,
        {
          type: "follower",
          fromUserId: followerId,
          fromUsername: followerName,
        }
      );

      console.log(`[onNewFollower] Notification sent to ${followedId}`);
    } catch (error) {
      console.error("[onNewFollower] Error:", error);
    }
  });

/**
 * Trigger: New like created
 * Sends push notification to the post author
 */
exports.onNewLike = functions.firestore
  .document("likes/{likeId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const likerId = data.userId;
    const postId = data.postId;

    if (!likerId || !postId) return;

    try {
      // Get the post to find the author
      const postDoc = await db.collection("posts").doc(postId).get();
      if (!postDoc.exists) return;

      const post = postDoc.data();
      const authorId = post.authorId || post.userId;

      // Check if we should notify (handles self-action, blocks, prefs, token)
      const { allowed, token, actorData } = await shouldNotifyUser(authorId, likerId, "upvotes");
      if (!allowed) return;

      const likerName = actorData?.username || "Someone";
      const postPreview = post.text ? post.text.substring(0, 50) : "your post";

      await sendExpoPushNotification(
        token,
        "New Upvote",
        `${likerName} upvoted ${postPreview}${post.text && post.text.length > 50 ? "..." : ""}`,
        {
          type: "upvote",
          postId,
          fromUserId: likerId,
          fromUsername: likerName,
        }
      );

      console.log(`[onNewLike] Notification sent to ${authorId}`);
    } catch (error) {
      console.error("[onNewLike] Error:", error);
    }
  });

/**
 * Trigger: New repost created
 * Sends push notification to the original post author
 */
exports.onNewRepost = functions.firestore
  .document("reposts/{repostId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const reposterId = data.userId;
    const postId = data.postId;

    if (!reposterId || !postId) return;

    try {
      // Get the original post to find the author
      const postDoc = await db.collection("posts").doc(postId).get();
      if (!postDoc.exists) return;

      const post = postDoc.data();
      const authorId = post.authorId || post.userId;

      // Check if we should notify (handles self-action, blocks, prefs, token)
      const { allowed, token, actorData } = await shouldNotifyUser(authorId, reposterId, "reposts");
      if (!allowed) return;

      const reposterName = actorData?.username || "Someone";
      const postPreview = post.text ? post.text.substring(0, 50) : "your post";

      await sendExpoPushNotification(
        token,
        "New Repost",
        `${reposterName} reposted ${postPreview}${post.text && post.text.length > 50 ? "..." : ""}`,
        {
          type: "repost",
          postId,
          fromUserId: reposterId,
          fromUsername: reposterName,
        }
      );

      console.log(`[onNewRepost] Notification sent to ${authorId}`);
    } catch (error) {
      console.error("[onNewRepost] Error:", error);
    }
  });

/**
 * Trigger: New post created
 * Handles two types of notifications:
 * 1. Reply notifications - when someone replies to a post
 * 2. Mention notifications - when someone is @mentioned in a post
 */
exports.onNewPost = functions.firestore
  .document("posts/{postId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const postId = context.params.postId;
    const authorId = data.authorId || data.userId;
    const postText = data.text || "";

    if (!authorId) return;

    try {
      // Get the author's data once for use in notifications
      const authorDoc = await db.collection("users").doc(authorId).get();
      const authorData = authorDoc.exists ? authorDoc.data() : null;
      const authorUsername = authorData?.username || "Someone";

      // Track who we've already notified to avoid duplicates
      const notifiedUsers = new Set();

      // ========== REPLY NOTIFICATION ==========
      const replyToPostId = data.replyToPostId;
      if (replyToPostId) {
        const parentDoc = await db.collection("posts").doc(replyToPostId).get();
        if (parentDoc.exists) {
          const parentPost = parentDoc.data();
          const parentAuthorId = parentPost.authorId || parentPost.userId;

          // Check if we should notify parent author
          const { allowed, token } = await shouldNotifyUser(parentAuthorId, authorId, "replies");
          if (allowed) {
            const replyPreview = postText ? postText.substring(0, 50) : "your post";

            await sendExpoPushNotification(
              token,
              "New Reply",
              `${authorUsername} replied: ${replyPreview}${postText.length > 50 ? "..." : ""}`,
              {
                type: "reply",
                postId,
                fromUserId: authorId,
                fromUsername: authorUsername,
              }
            );

            console.log(`[onNewPost] Reply notification sent to ${parentAuthorId}`);
            notifiedUsers.add(parentAuthorId);
          }
        }
      }

      // ========== MENTION NOTIFICATIONS ==========
      // Parse @mentions from post text using regex
      const mentionRegex = /@([a-zA-Z0-9_]+)/g;
      const mentions = [];
      let match;
      while ((match = mentionRegex.exec(postText)) !== null) {
        mentions.push(match[1].toLowerCase());
      }

      if (mentions.length === 0) return;

      // Remove duplicates and limit to prevent abuse
      const uniqueMentions = [...new Set(mentions)].slice(0, 10);

      // Look up users by username
      for (const username of uniqueMentions) {
        try {
          // Query for user by username
          const usersQuery = await db.collection("users")
            .where("username", "==", username)
            .limit(1)
            .get();

          if (usersQuery.empty) continue;

          const mentionedUser = usersQuery.docs[0];
          const mentionedUserId = mentionedUser.id;

          // Skip if already notified (e.g., they're also the parent author who got reply notif)
          if (notifiedUsers.has(mentionedUserId)) {
            console.log(`[onNewPost] Skipping mention for ${mentionedUserId} - already notified`);
            continue;
          }

          // Check if we should notify this mentioned user
          const { allowed, token } = await shouldNotifyUser(mentionedUserId, authorId, "mentions");
          if (!allowed) continue;

          await sendExpoPushNotification(
            token,
            "New Mention",
            `${authorUsername} mentioned you`,
            {
              type: "mention",
              postId,
              fromUserId: authorId,
              fromUsername: authorUsername,
            }
          );

          console.log(`[onNewPost] Mention notification sent to ${mentionedUserId} (@${username})`);
          notifiedUsers.add(mentionedUserId);
        } catch (mentionError) {
          console.error(`[onNewPost] Error processing mention @${username}:`, mentionError);
        }
      }
    } catch (error) {
      console.error("[onNewPost] Error:", error);
    }
  });

// ==================== ADMIN/MOD BROADCAST SYSTEM ====================

/**
 * Send broadcast push notification to all eligible users
 * Callable function for admins and mods only
 *
 * @param {string} title - Notification title (1-80 chars)
 * @param {string} body - Notification body (1-200 chars)
 * @param {object|null} deepLink - Optional deep link target
 *   - null: no deep link
 *   - { type: "room", roomId: string }
 *   - { type: "post", postId: string }
 *   - { type: "createRoom" }
 *   - { type: "floor" }
 */
exports.sendBroadcast = functions.https.onCall(async (data, context) => {
  // 1. Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be authenticated to send broadcasts."
    );
  }

  const callerUid = context.auth.uid;

  // 2. Server-side admin/mod verification
  const callerDoc = await db.collection("users").doc(callerUid).get();
  if (!callerDoc.exists) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "User profile not found."
    );
  }

  const callerData = callerDoc.data();
  const isAdminOrMod = callerData.isAdmin === true || callerData.isMod === true;
  if (!isAdminOrMod) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only admins and mods can send broadcasts."
    );
  }

  // 3. Validate inputs
  const { title, body, deepLink } = data;

  if (!title || typeof title !== "string" || title.length < 1 || title.length > 80) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Title is required and must be 1-80 characters."
    );
  }

  if (!body || typeof body !== "string" || body.length < 1 || body.length > 200) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Body is required and must be 1-200 characters."
    );
  }

  // Validate deepLink if provided
  if (deepLink !== null && deepLink !== undefined) {
    const validTypes = ["room", "post", "createRoom", "floor"];
    if (!deepLink.type || !validTypes.includes(deepLink.type)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid deep link type. Must be one of: room, post, createRoom, floor."
      );
    }
    if (deepLink.type === "room" && !deepLink.roomId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "roomId is required for room deep links."
      );
    }
    if (deepLink.type === "post" && !deepLink.postId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "postId is required for post deep links."
      );
    }
  }

  try {
    // 4. Query eligible users
    // Get all users with valid push tokens
    const usersSnapshot = await db.collection("users").get();
    const callerBlockedUsers = callerData.blockedUsers || [];
    const callerBlockedIds = new Set(callerBlockedUsers.map((b) => b.id));

    const eligibleTokens = [];

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();

      // Skip self
      if (userId === callerUid) continue;

      // Check valid push token
      const token = userData.expoPushToken;
      if (!token || !token.startsWith("ExponentPushToken[")) continue;

      // Check notification preferences (default to true)
      const prefs = userData.notificationPreferences || {};
      if (prefs.broadcasts === false) continue;

      // Check if user blocked caller
      const userBlockedUsers = userData.blockedUsers || [];
      const userBlockedCaller = userBlockedUsers.some((b) => b.id === callerUid);
      if (userBlockedCaller) continue;

      // Check if caller blocked user
      if (callerBlockedIds.has(userId)) continue;

      eligibleTokens.push(token);
    }

    if (eligibleTokens.length === 0) {
      console.log("[sendBroadcast] No eligible recipients");
      // Still write audit log
      await db.collection("broadcasts").add({
        senderUid: callerUid,
        senderUsername: callerData.username || callerUid,
        title,
        body,
        deepLink: deepLink || null,
        recipientCount: 0,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { success: true, recipientCount: 0 };
    }

    // 5. Build push payload
    const pushData = { type: "broadcast" };
    if (deepLink) {
      pushData.deepLinkType = deepLink.type;
      if (deepLink.type === "room" && deepLink.roomId) {
        pushData.roomId = deepLink.roomId;
      }
      if (deepLink.type === "post" && deepLink.postId) {
        pushData.postId = deepLink.postId;
      }
    }

    // 6. Send pushes in chunks of 100
    const CHUNK_SIZE = 100;
    const messages = eligibleTokens.map((token) => ({
      to: token,
      sound: "default",
      title,
      body,
      data: pushData,
    }));

    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      const chunk = messages.slice(i, i + CHUNK_SIZE);
      try {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(chunk),
        });
        const result = await response.json();
        console.log(`[sendBroadcast] Chunk ${i / CHUNK_SIZE + 1} sent:`, result);
      } catch (chunkError) {
        console.error(`[sendBroadcast] Error sending chunk ${i / CHUNK_SIZE + 1}:`, chunkError);
      }
    }

    // 7. Write audit log
    await db.collection("broadcasts").add({
      senderUid: callerUid,
      senderUsername: callerData.username || callerUid,
      title,
      body,
      deepLink: deepLink || null,
      recipientCount: eligibleTokens.length,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[sendBroadcast] Broadcast sent by ${callerData.username} to ${eligibleTokens.length} users`);

    // 8. Return success
    return {
      success: true,
      recipientCount: eligibleTokens.length,
    };
  } catch (error) {
    console.error("[sendBroadcast] Error:", error);
    throw new functions.https.HttpsError(
      "internal",
      `Failed to send broadcast: ${error.message}`
    );
  }
});

/**
 * Trigger: New DM message created
 * Sends push notification to the recipient
 */
exports.onNewDM = functions.firestore
  .document("conversations/{conversationId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const conversationId = context.params.conversationId;
    const senderId = message.senderId;

    if (!senderId || !conversationId) return;

    try {
      // Get the conversation to find the recipient
      const conversationDoc = await db.collection("conversations").doc(conversationId).get();
      if (!conversationDoc.exists) {
        console.log("[onNewDM] Conversation not found");
        return;
      }

      const conversation = conversationDoc.data();
      const participants = conversation.participants || [];

      // Find the recipient (the participant who is NOT the sender)
      const recipientId = participants.find((p) => p !== senderId);
      if (!recipientId) {
        console.log("[onNewDM] No recipient found in conversation");
        return;
      }

      // Check if we should notify (handles self-action, blocks, prefs, token)
      const { allowed, token, actorData } = await shouldNotifyUser(recipientId, senderId, "dms");
      if (!allowed) return;

      const senderName = actorData?.username || "Someone";

      // Build the message preview
      let messagePreview;
      if (message.type === "image" || message.imageUrl) {
        messagePreview = "Sent an image";
      } else if (message.type === "gif" || message.gifUrl) {
        messagePreview = "Sent a GIF";
      } else if (message.sharedContent) {
        messagePreview = `Shared a ${message.sharedContent.type || "link"}`;
      } else {
        const text = message.text || "";
        messagePreview = text.length > 100 ? text.substring(0, 100) + "..." : text;
      }

      await sendExpoPushNotification(
        token,
        senderName, // Title is just the sender's username
        messagePreview,
        {
          type: "dm",
          conversationId,
          fromUserId: senderId,
          fromUsername: senderName,
        }
      );

      console.log(`[onNewDM] Notification sent to ${recipientId}`);
    } catch (error) {
      console.error("[onNewDM] Error:", error);
    }
  });

// ==================== ROOM CLEANUP ====================

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

// Map sport IDs to ESPN endpoints
const SPORT_ENDPOINTS = {
  nfl: `${ESPN_BASE}/football/nfl/scoreboard`,
  nba: `${ESPN_BASE}/basketball/nba/scoreboard`,
  ncaab: `${ESPN_BASE}/basketball/mens-college-basketball/scoreboard?groups=100&limit=100`,
  mlb: `${ESPN_BASE}/baseball/mlb/scoreboard`,
  nhl: `${ESPN_BASE}/hockey/nhl/scoreboard`,
  wnba: `${ESPN_BASE}/basketball/wnba/scoreboard`,
  soccer: `${ESPN_BASE}/soccer/usa.1/scoreboard`,
  ufc: `${ESPN_BASE}/mma/ufc/scoreboard`,
};

/**
 * Fetch games from ESPN for a specific sport
 * @param {string} sportId - Sport identifier (nba, nfl, mlb, etc.)
 * @returns {Promise<Array>} - Array of games with id and status
 */
async function fetchESPNGames(sportId) {
  const endpoint = SPORT_ENDPOINTS[sportId];
  if (!endpoint) {
    console.log(`[cleanupFinishedRooms] No ESPN endpoint for sport: ${sportId}`);
    return [];
  }

  try {
    const response = await fetch(endpoint);
    if (!response.ok) {
      console.error(`[cleanupFinishedRooms] ESPN ${sportId} returned ${response.status}`);
      return [];
    }
    const data = await response.json();
    return (data.events || []).map((event) => ({
      id: event.id,
      name: event.name,
      status: event.status,
    }));
  } catch (error) {
    console.error(`[cleanupFinishedRooms] Failed to fetch ${sportId}:`, error.message);
    return [];
  }
}

/**
 * Check if a game has ended (status.type.id === "3" or state === "post")
 * @param {object} game - ESPN game object
 * @returns {boolean}
 */
function isGameFinal(game) {
  const statusId = game.status?.type?.id;
  const state = game.status?.type?.state;
  return statusId === "3" || state === "post";
}

/**
 * Scheduled function: Clean up rooms for finished games
 * Runs every 5 minutes, America/New_York timezone
 *
 * Logic:
 * 1. Query all rooms in Firestore
 * 2. Group by sport and fetch ESPN scoreboards for those sports
 * 3. Delete rooms where game has ended (unless isDemoRoom)
 */
exports.cleanupFinishedRooms = functions.pubsub
  .schedule("every 5 minutes")
  .timeZone("America/New_York")
  .onRun(async (context) => {
    console.log("[cleanupFinishedRooms] Starting scheduled cleanup...");

    try {
      // Step 1: Get all rooms
      const roomsSnapshot = await db.collection("rooms").get();

      if (roomsSnapshot.empty) {
        console.log("[cleanupFinishedRooms] No rooms to check");
        return null;
      }

      console.log(`[cleanupFinishedRooms] Found ${roomsSnapshot.size} rooms`);

      // Step 2: Group rooms by sport and gameId
      const roomsByGame = {}; // { gameId: [rooms] }
      const sportsNeeded = new Set();

      roomsSnapshot.docs.forEach((docSnap) => {
        const room = { id: docSnap.id, ...docSnap.data() };
        const gameId = room.gameId;
        const sport = room.sport;

        if (!gameId) return; // Skip rooms without gameId

        if (!roomsByGame[gameId]) {
          roomsByGame[gameId] = [];
        }
        roomsByGame[gameId].push(room);

        if (sport && SPORT_ENDPOINTS[sport]) {
          sportsNeeded.add(sport);
        }
      });

      const gameIds = Object.keys(roomsByGame);
      console.log(`[cleanupFinishedRooms] ${gameIds.length} unique games, sports: ${[...sportsNeeded].join(", ")}`);

      // Step 3: Fetch ESPN data for needed sports (in parallel)
      const gameMap = {}; // { gameId: game }
      const sportResults = {};

      await Promise.all(
        [...sportsNeeded].map(async (sport) => {
          const games = await fetchESPNGames(sport);
          sportResults[sport] = games.length;
          games.forEach((game) => {
            gameMap[game.id] = game;
          });
        })
      );

      console.log("[cleanupFinishedRooms] ESPN fetch results:", sportResults);
      console.log(`[cleanupFinishedRooms] Total games in map: ${Object.keys(gameMap).length}`);

      // Step 4: Identify rooms to delete
      const roomsToDelete = [];
      const deletedGameIds = [];

      for (const gameId of gameIds) {
        const game = gameMap[gameId];
        const rooms = roomsByGame[gameId];

        if (!game) {
          // Game not found in ESPN - might be old, but don't delete without confirmation
          // (The mobile app handles orphaned rooms with 4-hour check)
          continue;
        }

        if (isGameFinal(game)) {
          for (const room of rooms) {
            // Skip demo rooms
            if (room.isDemoRoom === true) {
              console.log(`[cleanupFinishedRooms] Skipping demo room: ${room.name}`);
              continue;
            }
            roomsToDelete.push(room);
            if (!deletedGameIds.includes(gameId)) {
              deletedGameIds.push(gameId);
            }
          }
        }
      }

      console.log(`[cleanupFinishedRooms] Rooms to delete: ${roomsToDelete.length}`);

      if (roomsToDelete.length === 0) {
        console.log("[cleanupFinishedRooms] No rooms to delete");
        return null;
      }

      // Step 5: Delete in batches (max 500 per batch)
      let totalDeleted = 0;

      for (let i = 0; i < roomsToDelete.length; i += BATCH_SIZE) {
        const batchRooms = roomsToDelete.slice(i, i + BATCH_SIZE);
        const batch = db.batch();

        batchRooms.forEach((room) => {
          console.log(`[cleanupFinishedRooms] Deleting: "${room.name}" (gameId: ${room.gameId})`);
          batch.delete(db.collection("rooms").doc(room.id));
        });

        await batch.commit();
        totalDeleted += batchRooms.length;
      }

      console.log(`[cleanupFinishedRooms] Cleanup complete: ${totalDeleted} rooms deleted`);
      console.log(`[cleanupFinishedRooms] Game IDs: ${deletedGameIds.join(", ")}`);

      return null;
    } catch (error) {
      console.error("[cleanupFinishedRooms] Error:", error);
      return null;
    }
  });
