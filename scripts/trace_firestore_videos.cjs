const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const sa = require('../service-account.json');

initializeApp({ credential: cert(sa) });
const db = getFirestore('team-taraba-database');

async function traceVideos() {
  console.log('=== Tracing All Video Records in Firestore ===\n');

  // 1. Events collection
  console.log('--- Checking `events` Collection ---');
  const eventsSnap = await db.collection('events').get();
  let eventsWithVideos = 0;
  let totalVideoUrlsInEvents = 0;

  eventsSnap.docs.forEach(doc => {
    const data = doc.data();
    const mainYt = data.youtubeVideoUrl || '';
    const ytList = Array.isArray(data.youtubeVideoUrls) ? data.youtubeVideoUrls : [];
    const allUrls = Array.from(new Set([mainYt, ...ytList])).filter(Boolean);

    if (allUrls.length > 0) {
      eventsWithVideos++;
      totalVideoUrlsInEvents += allUrls.length;
      console.log(`📁 Event: [${doc.id}] "${data.title}"`);
      console.log(`   Date: ${data.date} | Location: "${data.location}"`);
      allUrls.forEach((url, i) => {
        const isYouTube = /youtube\.com|youtu\.be/i.test(url);
        console.log(`   Video ${i + 1}: ${url} (Valid YouTube: ${isYouTube ? '✅ YES' : '❌ NO'})`);
      });
    }
  });
  console.log(`Total events with videos: ${eventsWithVideos} of ${eventsSnap.size}`);
  console.log(`Total video URLs stored in events: ${totalVideoUrlsInEvents}\n`);

  // 2. MediaItems collection
  console.log('--- Checking `mediaItems` Collection ---');
  try {
    const mediaItemsSnap = await db.collection('mediaItems').get();
    console.log(`Total mediaItems in collection: ${mediaItemsSnap.size}`);
    let videoCount = 0;
    mediaItemsSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.type === 'video' || data.storageTarget === 'youtube') {
        videoCount++;
        console.log(`🎥 MediaItem [${doc.id}]:`);
        console.log(`   File: ${data.fileName} | Status: ${data.status}`);
        console.log(`   Storage Target: ${data.storageTarget} | Final URL: ${data.finalUrl || 'None'}`);
      }
    });
    console.log(`Total video mediaItems: ${videoCount}`);
  } catch (err) {
    console.log('mediaItems collection error:', err.message);
  }

  // 3. Pending approvals collection (if any)
  console.log('\n--- Checking `system/photoApprovals` or `approvals` ---');
  try {
    const approvalsSnap = await db.collection('system').doc('photoApprovals').get();
    if (approvalsSnap.exists) {
      const data = approvalsSnap.data();
      const list = data.requests || [];
      const vids = list.filter(r => r.type === 'video');
      console.log(`Total pending/reviewed video approvals: ${vids.length} of ${list.length} total requests`);
      vids.forEach((r, i) => {
        console.log(`   ${i + 1}. [${r.id}] "${r.fileName || r.adminNotes}" | URL: ${r.photoUrl} | Status: ${r.status}`);
      });
    } else {
      console.log('No system/photoApprovals document found.');
    }
  } catch (err) {
    console.log('Approvals check note:', err.message);
  }
}

traceVideos().catch(console.error);
