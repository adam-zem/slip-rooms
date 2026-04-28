#!/usr/bin/env node
/**
 * Revoke mod status from a user by username
 *
 * Usage:
 *   Run from slip-rooms directory: node scripts/revokeModStatus.cjs <username>
 *
 * Example:
 *   node scripts/revokeModStatus.cjs vincomp
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error) {
  console.error('ERROR: Could not load service account key');
  console.error(`Expected path: ${serviceAccountPath}`);
  console.error('Make sure serviceAccountKey.json exists in slip-rooms/');
  process.exit(1);
}

const db = admin.firestore();

async function revokeModStatus(username) {
  if (!username) {
    console.error('Error: Username is required');
    console.log('Usage: node scripts/revokeModStatus.cjs <username>');
    process.exit(1);
  }

  console.log(`Revoking mod status from user: @${username}`);
  console.log('='.repeat(50));

  try {
    // Find user by username
    const usersSnapshot = await db.collection('users')
      .where('username', '==', username.toLowerCase())
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.error(`Error: No user found with username @${username}`);
      process.exit(1);
    }

    const userDoc = usersSnapshot.docs[0];
    const userData = userDoc.data();

    console.log(`Found user: ${userData.username} (${userDoc.id})`);
    console.log(`  Current isMod: ${userData.isMod || false}`);
    console.log(`  Current isAdmin: ${userData.isAdmin || false}`);

    if (!userData.isMod) {
      console.log('\nUser does not have mod status. No changes made.');
      return;
    }

    // Update user document to remove mod status
    await userDoc.ref.update({
      isMod: false,
      modRevokedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('\nMod status revoked successfully!');
    console.log(`  User @${username} is no longer a mod.`);

  } catch (err) {
    console.error('Error revoking mod status:', err.message);
    process.exit(1);
  }
}

// Get username from command line args
const username = process.argv[2];

revokeModStatus(username)
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nFatal error:', err);
    process.exit(1);
  });
