#!/usr/bin/env node
/**
 * Grant mod status to a user by username
 *
 * Usage:
 *   Run from slip-rooms directory: node scripts/grantModStatus.cjs <username>
 *
 * Example:
 *   node scripts/grantModStatus.cjs vincomp
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

async function grantModStatus(username) {
  if (!username) {
    console.error('Error: Username is required');
    console.log('Usage: node scripts/grantModStatus.cjs <username>');
    process.exit(1);
  }

  console.log(`Granting mod status to user: @${username}`);
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

    if (userData.isMod === true) {
      console.log('\nUser already has mod status. No changes made.');
      return;
    }

    // Update user document with isMod: true
    await userDoc.ref.update({
      isMod: true,
      modGrantedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('\nMod status granted successfully!');
    console.log(`  User @${username} is now a mod.`);

  } catch (err) {
    console.error('Error granting mod status:', err.message);
    process.exit(1);
  }
}

// Get username from command line args
const username = process.argv[2];

grantModStatus(username)
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nFatal error:', err);
    process.exit(1);
  });
