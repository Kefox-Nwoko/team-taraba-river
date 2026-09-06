const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { google } = require('googleapis');
const fs = require('fs');

function parseDateFromTitle(title) {
  if (!title) return null;
  const months = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };
  const titleLower = title.toLowerCase();

  // Pattern 1: ISO Date (YYYY-MM-DD)
  const isoMatch = title.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = String(parseInt(isoMatch[2], 10)).padStart(2, '0');
    const d = String(parseInt(isoMatch[3], 10)).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Pattern 2: "June 27 2026" or "27 June 2026"
  const mNameMatch = titleLower.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)[^\d]*(\d{1,2})?[^\d]*(\d{4})?/);
  if (mNameMatch) {
    const monthIndex = months[mNameMatch[1]];
    const day = mNameMatch[2] ? parseInt(mNameMatch[2], 10) : 1;
    const year = mNameMatch[3] ? parseInt(mNameMatch[3], 10) : 2026;
    if (monthIndex !== undefined) {
      const mm = String(monthIndex + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      return `${year}-${mm}-${dd}`;
    }
  }

  return null;
}

async function restoreMedia() {
  console.log("=== STARTING MEDIA RESTORATION FROM GOOGLE DRIVE ===");
  const serviceAccount = JSON.parse(fs.readFileSync('service-account.json', 'utf8'));
  const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));

  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId: config.projectId,
  });

  const db = getFirestore(app, 'team-taraba-database');

  const auth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth });
  const rootFolderId = '19UcHi6ItJBeOAENfsOCM69K05NHc_13D';

  // 1. Fetch subfolders
  const foldersRes = await drive.files.list({
    q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name, createdTime, modifiedTime)',
    orderBy: 'createdTime desc',
    pageSize: 100,
  });
  const subFolders = foldersRes.data.files || [];
  console.log(`Found ${subFolders.length} subfolders in Google Drive.`);

  let restoredCount = 0;
  for (const folder of subFolders) {
    // List images
    const imagesRes = await drive.files.list({
      q: `'${folder.id}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: 'files(id, name, mimeType, createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 200,
    });
    const images = imagesRes.data.files || [];
    const imageUrls = images.map((img) => `https://lh3.googleusercontent.com/d/${img.id}`);

    // List videos
    const videosRes = await drive.files.list({
      q: `'${folder.id}' in parents and mimeType contains 'video/' and trashed = false`,
      fields: 'files(id, name, mimeType, createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 50,
    });
    const videos = videosRes.data.files || [];
    const videoUrls = videos.map((vid) => `/api/media/image/${vid.id}#${vid.name || 'video.mp4'}`);
    const allMediaUrls = [...imageUrls, ...videoUrls];

    const folderParsedDate = folder.name ? parseDateFromTitle(folder.name) : null;
    const folderDate = folderParsedDate || (folder.createdTime
      ? new Date(folder.createdTime).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]);

    const eventId = `gdrive_${folder.id}`;
    const eventDoc = {
      id: eventId,
      title: folder.name || 'Untitled Folder',
      description: `Synced event media folder. Contains ${images.length} photos${videos.length > 0 ? ` and ${videos.length} videos` : ''}.`,
      date: folderDate,
      time: '09:00',
      location: 'Taraba River',
      category: 'cleanup',
      driveImageUrls: allMediaUrls,
      driveFolderId: folder.id || '',
      youtubeVideoUrl: '',
      youtubeVideoUrls: [],
      createdBy: 'Official Cloud Pipeline',
      createdById: 'tarabateam_admin',
      attendeeIds: [],
      maybeIds: [],
      declinedIds: [],
      maxCapacity: 1000,
      createdAt: folder.createdTime || new Date().toISOString(),
    };

    await db.collection('events').doc(eventId).set(eventDoc, { merge: true });
    restoredCount++;
    console.log(`[RESTORED] ${folder.name} (${eventId}) -> ${images.length} photos, ${videos.length} videos, date: ${folderDate}`);
  }

  // Explicitly remove the incorrect catch-all root parent folder from Firestore
  try {
    const rootEventId = `gdrive_root_${rootFolderId}`;
    await db.collection('events').doc(rootEventId).delete();
    console.log(`[REMOVED] Successfully removed incorrect catch-all parent folder: ${rootEventId}`);
  } catch (err) {
    console.log("Root cleanup note:", err.message);
  }

  console.log(`\nSUCCESS: Successfully configured ${restoredCount} distinct top-level event media albums in Firestore team-taraba-database!`);
}

restoreMedia().catch(console.error);
