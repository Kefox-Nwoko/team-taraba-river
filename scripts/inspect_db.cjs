const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const sa = require('../service-account.json');

initializeApp({ credential: cert(sa) });
const db = getFirestore('team-taraba-database');

async function main() {
  const snap = await db.collection('events').get();
  console.log('Total events in Firestore:', snap.size);
  snap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`- [${doc.id}] ${data.title} | date: ${data.date} | imgs: ${data.driveImageUrls?.length || 0} | vids: ${data.youtubeVideoUrls?.length || 0}`);
  });
}

main().catch(console.error);
