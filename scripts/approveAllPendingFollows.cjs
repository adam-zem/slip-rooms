#!/usr/bin/env node
/**
 * One-time migration script to approve all pending follow requests
 *
 * This script:
 * 1. Queries all documents in both followRequests and friendRequests collections
 * 2. For each pending request, creates mutual follow/friendship documents
 * 3. Deletes the pending request documents
 *
 * Usage:
 *   1. Download your Firebase service account key from:
 *      Firebase Console > Project Settings > Service Accounts > Generate New Private Key
 *   2. Set the environment variable:
 *      export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
 *   3. Run: node scripts/approveAllPendingFollows.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const projectId = 'sliprooms-279e3';

admin.initializeApp({
  projectId: projectId,
  // Uses GOOGLE_APPLICATION_CREDENTIALS env var for authentication
});

const db = admin.firestore();

async function approveAllPendingFollows() {
  console.log('Starting migration: Approve all pending follow requests');
  console.log('='.repeat(60));

  let totalProcessed = 0;
  let totalApproved = 0;
  let totalErrors = 0;

  // Process followRequests collection (sliprooms-app style)
  console.log('\n[1/2] Processing followRequests collection...');
  try {
    const followRequestsSnapshot = await db.collection('followRequests').get();
    console.log(`Found ${followRequestsSnapshot.size} documents in followRequests`);

    for (const docSnap of followRequestsSnapshot.docs) {
      totalProcessed++;
      const data = docSnap.data();
      const { from, to } = data;

      if (!from || !to) {
        console.log(`  [SKIP] ${docSnap.id} - missing from/to fields`);
        continue;
      }

      console.log(`  Processing ${docSnap.id}: ${from} -> ${to}`);

      try {
        // Create mutual follow relationship (bidirectional)
        const follow1Id = `${from}_${to}`;
        const follow2Id = `${to}_${from}`;

        const batch = db.batch();

        // Check if already exists to avoid overwriting
        const existing1 = await db.collection('followers').doc(follow1Id).get();
        const existing2 = await db.collection('followers').doc(follow2Id).get();

        if (!existing1.exists) {
          batch.set(db.collection('followers').doc(follow1Id), {
            users: [from, to],
            user1: from,
            user2: to,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            migratedFrom: 'followRequests',
            migratedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        if (!existing2.exists) {
          batch.set(db.collection('followers').doc(follow2Id), {
            users: [to, from],
            user1: to,
            user2: from,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            migratedFrom: 'followRequests',
            migratedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // Delete the pending request
        batch.delete(docSnap.ref);

        await batch.commit();
        totalApproved++;
        console.log(`    [OK] Approved and deleted request`);
      } catch (err) {
        totalErrors++;
        console.error(`    [ERROR] Failed to process ${docSnap.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error querying followRequests:', err.message);
  }

  // Process friendRequests collection (slip-rooms website style)
  console.log('\n[2/2] Processing friendRequests collection...');
  try {
    const friendRequestsSnapshot = await db.collection('friendRequests').get();
    console.log(`Found ${friendRequestsSnapshot.size} documents in friendRequests`);

    for (const docSnap of friendRequestsSnapshot.docs) {
      totalProcessed++;
      const data = docSnap.data();
      const { from, to } = data;

      if (!from || !to) {
        console.log(`  [SKIP] ${docSnap.id} - missing from/to fields`);
        continue;
      }

      console.log(`  Processing ${docSnap.id}: ${from} -> ${to}`);

      try {
        // Create mutual friendship documents (bidirectional)
        const friendship1Id = `${from}_${to}`;
        const friendship2Id = `${to}_${from}`;

        const batch = db.batch();

        // Check if already exists to avoid overwriting
        const existing1 = await db.collection('friendships').doc(friendship1Id).get();
        const existing2 = await db.collection('friendships').doc(friendship2Id).get();

        if (!existing1.exists) {
          batch.set(db.collection('friendships').doc(friendship1Id), {
            users: [from, to],
            user1: from,
            user2: to,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            migratedFrom: 'friendRequests',
            migratedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        if (!existing2.exists) {
          batch.set(db.collection('friendships').doc(friendship2Id), {
            users: [to, from],
            user1: to,
            user2: from,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            migratedFrom: 'friendRequests',
            migratedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // Delete the pending request
        batch.delete(docSnap.ref);

        await batch.commit();
        totalApproved++;
        console.log(`    [OK] Approved and deleted request`);
      } catch (err) {
        totalErrors++;
        console.error(`    [ERROR] Failed to process ${docSnap.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error querying friendRequests:', err.message);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Migration complete!');
  console.log(`  Total requests processed: ${totalProcessed}`);
  console.log(`  Successfully approved:    ${totalApproved}`);
  console.log(`  Errors:                   ${totalErrors}`);
  console.log('='.repeat(60));
}

// Run the migration
approveAllPendingFollows()
  .then(() => {
    console.log('\nExiting...');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nFatal error:', err);
    process.exit(1);
  });
