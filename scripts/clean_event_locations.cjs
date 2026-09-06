const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const sa = require('../service-account.json');

initializeApp({ credential: cert(sa) });
const db = getFirestore('team-taraba-database');

async function cleanEventLocations() {
  console.log('--- Starting Event Location & Narrative Clean Migration ---');
  const snap = await db.collection('events').get();
  console.log(`Found ${snap.size} events to audit.`);

  let updatedCount = 0;
  let purgedCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const docId = doc.id;
    const currentLoc = (data.location || '').trim();
    const currentCat = (data.category || '').trim();
    const photoCount = Array.isArray(data.driveImageUrls) ? data.driveImageUrls.length : 0;
    const vidCount = (Array.isArray(data.youtubeVideoUrls) ? data.youtubeVideoUrls.length : 0) + (data.youtubeVideoUrl ? 1 : 0);
    const hasMedia = photoCount > 0 || vidCount > 0;

    // Purge fake event folders created by announcements that have zero media assets
    if (!hasMedia && (docId.startsWith('evt_') || !docId.startsWith('gdrive_'))) {
      console.log(`Purging fake event folder [${docId}] "${data.title}" (0 photos, 0 videos)`);
      await doc.ref.delete();
      purgedCount++;
      continue;
    }

    let newLoc = currentLoc;
    let newCat = currentCat;
    let needsUpdate = false;

    // Check if location contains "taraba river" (wrong geographic linkage) or pipeline default
    if (
      /taraba\s*river/i.test(newLoc) ||
      /google\s*drive/i.test(newLoc) ||
      /youtube\s*hub/i.test(newLoc) ||
      /official\s*cloud\s*pipeline/i.test(newLoc)
    ) {
      newLoc = '';
      needsUpdate = true;
    }

    // Check if category is "cleanup" (false ecological cleanup campaign narrative)
    if (newCat.toLowerCase() === 'cleanup') {
      newCat = 'General';
      needsUpdate = true;
    }

    if (needsUpdate) {
      console.log(`Updating [${docId}] "${data.title}":`);
      console.log(`  Location: "${currentLoc}" -> "${newLoc}"`);
      console.log(`  Category: "${currentCat}" -> "${newCat}"`);
      await doc.ref.update({
        location: newLoc,
        category: newCat,
      });
      updatedCount++;
    } else {
      console.log(`OK [${docId}] "${data.title}": loc="${currentLoc}", cat="${currentCat}"`);
    }
  }

  console.log(`\n--- Migration Complete: ${updatedCount} updated, ${purgedCount} fake announcement folders purged out of ${snap.size} total docs. ---`);
}

cleanEventLocations().catch(console.error);
