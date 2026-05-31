#!/usr/bin/env node
/**
 * CLI tool for managing filter lists (bannedWords & blockedHashtags)
 *
 * Usage:
 *   Run from slip-rooms directory: node scripts/manageFilters.cjs <command> [options]
 *
 * Commands:
 *   list <listType>                    - List all entries in a filter list
 *   add <listType> <word> [category]   - Add a single entry
 *   add-bulk <listType> <file>         - Add entries from JSON file
 *   remove <listType> <word>           - Remove an entry
 *   export <listType> <outputFile>     - Export list to JSON file
 *   stats                              - Show counts for both lists
 *
 * List Types:
 *   banned    - bannedWords collection (HARD list - starred everywhere except DMs)
 *   blocked   - blockedHashtags collection (SOFT list - can't trend, zero results)
 *
 * Examples:
 *   node scripts/manageFilters.cjs list banned
 *   node scripts/manageFilters.cjs add banned "badword" "slurs"
 *   node scripts/manageFilters.cjs add blocked "badhashtag"
 *   node scripts/manageFilters.cjs add-bulk banned ./words-to-add.json
 *   node scripts/manageFilters.cjs remove banned "oldword"
 *   node scripts/manageFilters.cjs export banned ./banned-backup.json
 *   node scripts/manageFilters.cjs stats
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

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

// Map short names to collection names
const COLLECTIONS = {
  banned: 'bannedWords',
  blocked: 'blockedHashtags',
};

function printUsage() {
  console.log(`
Filter Management CLI Tool

Usage: node scripts/manageFilters.cjs <command> [options]

Commands:
  list <listType>                    List all entries in a filter list
  add <listType> <word> [category]   Add a single entry (category only for banned)
  add-bulk <listType> <file>         Add entries from JSON file
  remove <listType> <word>           Remove an entry
  export <listType> <outputFile>     Export list to JSON file
  stats                              Show counts for both lists

List Types:
  banned    bannedWords (HARD list - starred everywhere except DMs)
  blocked   blockedHashtags (SOFT list - hidden from trending)

Examples:
  node scripts/manageFilters.cjs list banned
  node scripts/manageFilters.cjs add banned "badword" "slurs"
  node scripts/manageFilters.cjs add blocked "badhashtag"
  node scripts/manageFilters.cjs remove banned "oldword"
  node scripts/manageFilters.cjs stats
`);
}

function getCollectionName(listType) {
  const collection = COLLECTIONS[listType];
  if (!collection) {
    console.error(`Error: Invalid list type "${listType}". Use "banned" or "blocked".`);
    process.exit(1);
  }
  return collection;
}

// List all entries
async function listEntries(listType) {
  const collectionName = getCollectionName(listType);
  console.log(`\nListing all entries in ${collectionName}...`);
  console.log('='.repeat(60));

  const snapshot = await db.collection(collectionName).orderBy(listType === 'banned' ? 'word' : admin.firestore.FieldPath.documentId()).get();

  if (snapshot.empty) {
    console.log('No entries found.');
    return;
  }

  console.log(`Found ${snapshot.size} entries:\n`);

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (listType === 'banned') {
      const extras = [];
      if (data.match) extras.push(`match: ${data.match}`);
      if (data.exceptions?.length) extras.push(`exceptions: ${data.exceptions.join(', ')}`);
      console.log(`  ${data.word} [${data.category}]${extras.length ? ' - ' + extras.join('; ') : ''}`);
    } else {
      const extras = [];
      if (data.match) extras.push(`match: ${data.match}`);
      if (data.exceptions?.length) extras.push(`exceptions: ${data.exceptions.join(', ')}`);
      console.log(`  #${doc.id}${extras.length ? ' - ' + extras.join('; ') : ''}`);
    }
  });

  console.log(`\nTotal: ${snapshot.size} entries`);
}

// Add a single entry
async function addEntry(listType, word, category = 'general') {
  const collectionName = getCollectionName(listType);
  const entry = word.toLowerCase().replace(/^#/, '');

  console.log(`\nAdding "${entry}" to ${collectionName}...`);

  if (listType === 'banned') {
    // Check if already exists
    const existing = await db.collection(collectionName).where('word', '==', entry).limit(1).get();
    if (!existing.empty) {
      console.log(`Entry "${entry}" already exists in bannedWords.`);
      return;
    }

    await db.collection(collectionName).add({
      word: entry,
      category: category,
      severity: 1,
      enabled: true,
      allowPartial: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      addedBy: 'cli',
    });
  } else {
    // Check if already exists
    const existing = await db.collection(collectionName).doc(entry).get();
    if (existing.exists) {
      console.log(`Entry "#${entry}" already exists in blockedHashtags.`);
      return;
    }

    await db.collection(collectionName).doc(entry).set({
      tag: entry,
      severity: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      addedBy: 'cli',
    });
  }

  console.log(`Successfully added "${entry}" to ${collectionName}.`);
}

// Add entries from JSON file
async function addBulk(listType, filePath) {
  const collectionName = getCollectionName(listType);
  const absolutePath = path.resolve(filePath);

  console.log(`\nReading entries from ${absolutePath}...`);

  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: File not found: ${absolutePath}`);
    process.exit(1);
  }

  let entries;
  try {
    const content = fs.readFileSync(absolutePath, 'utf8');
    entries = JSON.parse(content);
  } catch (err) {
    console.error(`Error reading JSON file: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(entries)) {
    console.error('Error: JSON file must contain an array of entries');
    process.exit(1);
  }

  console.log(`Found ${entries.length} entries to add...`);
  console.log('='.repeat(50));

  let added = 0;
  let skipped = 0;

  for (const entry of entries) {
    const word = typeof entry === 'string' ? entry : entry.word || entry.tag;
    const category = typeof entry === 'object' ? entry.category || 'general' : 'general';
    const cleanWord = word.toLowerCase().replace(/^#/, '');

    try {
      if (listType === 'banned') {
        const existing = await db.collection(collectionName).where('word', '==', cleanWord).limit(1).get();
        if (!existing.empty) {
          skipped++;
          continue;
        }

        await db.collection(collectionName).add({
          word: cleanWord,
          category: category,
          severity: typeof entry === 'object' ? entry.severity || 1 : 1,
          enabled: true,
          allowPartial: typeof entry === 'object' ? entry.allowPartial !== false : true,
          match: typeof entry === 'object' ? entry.match : undefined,
          exceptions: typeof entry === 'object' ? entry.exceptions : undefined,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          addedBy: 'cli-bulk',
        });
      } else {
        const existing = await db.collection(collectionName).doc(cleanWord).get();
        if (existing.exists) {
          skipped++;
          continue;
        }

        await db.collection(collectionName).doc(cleanWord).set({
          tag: cleanWord,
          severity: typeof entry === 'object' ? entry.severity || 1 : 1,
          match: typeof entry === 'object' ? entry.match : undefined,
          exceptions: typeof entry === 'object' ? entry.exceptions : undefined,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          addedBy: 'cli-bulk',
        });
      }
      added++;
    } catch (err) {
      console.error(`  Error adding "${cleanWord}": ${err.message}`);
    }
  }

  console.log(`\nDone. Added: ${added}, Skipped (already exist): ${skipped}`);
}

// Remove an entry
async function removeEntry(listType, word) {
  const collectionName = getCollectionName(listType);
  const entry = word.toLowerCase().replace(/^#/, '');

  console.log(`\nRemoving "${entry}" from ${collectionName}...`);

  if (listType === 'banned') {
    const snapshot = await db.collection(collectionName).where('word', '==', entry).limit(1).get();
    if (snapshot.empty) {
      console.log(`Entry "${entry}" not found in bannedWords.`);
      return;
    }
    await snapshot.docs[0].ref.delete();
  } else {
    const docRef = db.collection(collectionName).doc(entry);
    const doc = await docRef.get();
    if (!doc.exists) {
      console.log(`Entry "#${entry}" not found in blockedHashtags.`);
      return;
    }
    await docRef.delete();
  }

  console.log(`Successfully removed "${entry}" from ${collectionName}.`);
}

// Export list to JSON file
async function exportList(listType, outputFile) {
  const collectionName = getCollectionName(listType);
  const absolutePath = path.resolve(outputFile);

  console.log(`\nExporting ${collectionName} to ${absolutePath}...`);

  const snapshot = await db.collection(collectionName).get();

  if (snapshot.empty) {
    console.log('No entries to export.');
    return;
  }

  const entries = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    // Remove Firestore timestamps for clean export
    delete data.createdAt;
    if (listType === 'blocked') {
      data.tag = doc.id;
    }
    entries.push(data);
  });

  // Sort alphabetically
  entries.sort((a, b) => {
    const keyA = listType === 'banned' ? a.word : a.tag;
    const keyB = listType === 'banned' ? b.word : b.tag;
    return keyA.localeCompare(keyB);
  });

  fs.writeFileSync(absolutePath, JSON.stringify(entries, null, 2));
  console.log(`Exported ${entries.length} entries to ${absolutePath}`);
}

// Show stats for both lists
async function showStats() {
  console.log('\nFilter List Statistics');
  console.log('='.repeat(50));

  const bannedSnapshot = await db.collection('bannedWords').get();
  const blockedSnapshot = await db.collection('blockedHashtags').get();

  console.log(`\nBanned Words (HARD LIST): ${bannedSnapshot.size} entries`);
  console.log(`  - Starred everywhere except DMs`);
  console.log(`  - Usernames rejected outright`);

  // Category breakdown for banned words
  const categories = {};
  bannedSnapshot.forEach((doc) => {
    const cat = doc.data().category || 'uncategorized';
    categories[cat] = (categories[cat] || 0) + 1;
  });
  console.log(`  - Categories:`);
  Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`      ${cat}: ${count}`);
    });

  console.log(`\nBlocked Hashtags (SOFT LIST): ${blockedSnapshot.size} entries`);
  console.log(`  - Hidden from trending`);
  console.log(`  - Show zero results on hashtag page`);
  console.log(`  - Usage not recorded`);

  console.log('\n' + '='.repeat(50));
  console.log(`Total filter entries: ${bannedSnapshot.size + blockedSnapshot.size}`);
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const command = args[0];

  try {
    switch (command) {
      case 'list':
        if (!args[1]) {
          console.error('Error: list type required (banned or blocked)');
          process.exit(1);
        }
        await listEntries(args[1]);
        break;

      case 'add':
        if (!args[1] || !args[2]) {
          console.error('Error: list type and word required');
          console.log('Usage: node scripts/manageFilters.cjs add <banned|blocked> <word> [category]');
          process.exit(1);
        }
        await addEntry(args[1], args[2], args[3]);
        break;

      case 'add-bulk':
        if (!args[1] || !args[2]) {
          console.error('Error: list type and file path required');
          console.log('Usage: node scripts/manageFilters.cjs add-bulk <banned|blocked> <file.json>');
          process.exit(1);
        }
        await addBulk(args[1], args[2]);
        break;

      case 'remove':
        if (!args[1] || !args[2]) {
          console.error('Error: list type and word required');
          console.log('Usage: node scripts/manageFilters.cjs remove <banned|blocked> <word>');
          process.exit(1);
        }
        await removeEntry(args[1], args[2]);
        break;

      case 'export':
        if (!args[1] || !args[2]) {
          console.error('Error: list type and output file required');
          console.log('Usage: node scripts/manageFilters.cjs export <banned|blocked> <output.json>');
          process.exit(1);
        }
        await exportList(args[1], args[2]);
        break;

      case 'stats':
        await showStats();
        break;

      case 'help':
      case '--help':
      case '-h':
        printUsage();
        break;

      default:
        console.error(`Error: Unknown command "${command}"`);
        printUsage();
        process.exit(1);
    }
  } catch (err) {
    console.error('\nError:', err.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
