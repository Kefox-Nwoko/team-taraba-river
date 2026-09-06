require('dotenv').config();
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const sa = require('../service-account.json');

initializeApp({ credential: cert(sa) });
const db = getFirestore('team-taraba-database');

const clientId = process.env.VITE_YOUTUBE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID;
const clientSecret = process.env.VITE_YOUTUBE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET;
const refreshToken = process.env.VITE_YOUTUBE_REFRESH_TOKEN || process.env.YOUTUBE_REFRESH_TOKEN;

async function linkYouTubeVideos() {
  console.log('=== Linking YouTube Videos to Firestore Event Albums ===\n');

  // 1. Get YouTube access token
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const tRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const tokenData = await tRes.json();
  const token = tokenData.access_token;

  if (!token) {
    throw new Error('Failed to acquire YouTube access token: ' + JSON.stringify(tokenData));
  }

  // 2. Fetch uploads from YouTube channel
  const channelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true', {
    headers: { Authorization: 'Bearer ' + token },
  });
  const chData = await channelRes.json();
  const uploadsPlaylistId = chData.items[0].contentDetails.relatedPlaylists.uploads;

  const playlistRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50`, {
    headers: { Authorization: 'Bearer ' + token },
  });
  const plData = await playlistRes.json();
  const ytItems = plData.items || [];
  console.log(`Found ${ytItems.length} videos on YouTube channel.`);

  // 3. Load all events from Firestore
  const eventsSnap = await db.collection('events').get();
  const events = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  let linkedCount = 0;
  for (const ytItem of ytItems) {
    const videoId = ytItem.snippet.resourceId.videoId;
    const title = ytItem.snippet.title;
    const desc = ytItem.snippet.description || '';
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // Extract folder name from description if present
    // Format: "Team Taraba River Community Event Media Archive (Folder Name)"
    const match = desc.match(/Team Taraba River Community Event Media Archive \(([^)]+)\)/i);
    let targetFolderName = match ? match[1].trim() : '';

    if (!targetFolderName && /URIP Health Walk May/i.test(title)) {
      targetFolderName = 'URIP Health Walk May 30 2026';
    }

    if (!targetFolderName && title) {
      targetFolderName = title.trim();
    }

    if (!targetFolderName) {
      console.log(`⚠️ Could not determine folder for video [${videoId}] "${title}" (Desc: "${desc.substring(0, 40)}")`);
      continue;
    }

    // Match with an event in Firestore (case-insensitive substring or exact match)
    const targetEvent = events.find(e => {
      const eTitle = (e.title || '').toLowerCase();
      const tName = targetFolderName.toLowerCase();
      return eTitle === tName || eTitle.includes(tName) || tName.includes(eTitle);
    });

    if (!targetEvent) {
      console.log(`⚠️ No matching Firestore folder found for video [${videoId}] (target: "${targetFolderName}")`);
      continue;
    }

    // Attach to event
    const existingList = Array.isArray(targetEvent.youtubeVideoUrls) ? targetEvent.youtubeVideoUrls : [];
    if (!existingList.includes(videoUrl)) {
      existingList.push(videoUrl);
      targetEvent.youtubeVideoUrls = existingList;
      targetEvent.youtubeVideoUrl = targetEvent.youtubeVideoUrl || videoUrl;

      await db.collection('events').doc(targetEvent.id).update({
        youtubeVideoUrls: existingList,
        youtubeVideoUrl: targetEvent.youtubeVideoUrl,
      });

      console.log(`✅ Linked video [${videoId}] "${title}" -> Folder: "${targetEvent.title}" (${targetEvent.id})`);
      linkedCount++;
    } else {
      console.log(`ℹ️ Video [${videoId}] already linked to Folder: "${targetEvent.title}"`);
    }
  }

  console.log(`\n=== Done! Linked ${linkedCount} YouTube videos to Firestore Event Albums ===`);
}

linkYouTubeVideos().catch(console.error);
