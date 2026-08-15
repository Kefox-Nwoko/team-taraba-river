import "dotenv/config";

const apiKey = process.env.YOUTUBE_API_KEY;
const channelId = "UCF0QmTZ7Qj2DPxINaY2v2NA";

async function testAllShortsQueries() {
  console.log(`Testing YouTube API Queries for Channel ID: ${channelId}...`);

  // Query 1: Uploads Playlist (UUF0QmTZ7Qj2DPxINaY2v2NA)
  const uploadsPlaylistId = "UUF0QmTZ7Qj2DPxINaY2v2NA";
  console.log(`\n--- 1. PlaylistItems for Uploads Playlist (${uploadsPlaylistId}) ---`);
  try {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails,status&maxResults=50&playlistId=${uploadsPlaylistId}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log("Uploads Playlist status:", res.status);
    if (res.status === 200) {
      console.log(`Items count: ${data.items?.length || 0}`);
      for (const item of data.items || []) {
        console.log(`- [ID: ${item.snippet?.resourceId?.videoId}] ${item.snippet?.title} (Privacy: ${item.status?.privacyStatus})`);
      }
    } else {
      console.log("Error:", JSON.stringify(data, null, 2));
    }
  } catch (e: any) {
    console.error("Query 1 Error:", e.message);
  }

  // Query 2: Search with videoDuration=short
  console.log(`\n--- 2. Search API with videoDuration=short ---`);
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=50&type=video&videoDuration=short&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log("Shorts search status:", res.status);
    if (res.status === 200) {
      console.log(`Items count: ${data.items?.length || 0}`);
      for (const item of data.items || []) {
        console.log(`- [ID: ${item.id?.videoId}] ${item.snippet?.title}`);
      }
    } else {
      console.log("Error:", JSON.stringify(data, null, 2));
    }
  } catch (e: any) {
    console.error("Query 2 Error:", e.message);
  }

  // Query 3: Search with forMine / forDeveloper / all events
  console.log(`\n--- 3. Search API without duration filter ---`);
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=50&type=video&order=date&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log("Order=date search status:", res.status);
    if (res.status === 200) {
      console.log(`Items count: ${data.items?.length || 0}`);
      for (const item of data.items || []) {
        console.log(`- [ID: ${item.id?.videoId}] ${item.snippet?.title}`);
      }
    } else {
      console.log("Error:", JSON.stringify(data, null, 2));
    }
  } catch (e: any) {
    console.error("Query 3 Error:", e.message);
  }

  // Query 4: RSS Feed for channel
  console.log(`\n--- 4. Channel RSS Feed ---`);
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const rssRes = await fetch(rssUrl);
    console.log("RSS status:", rssRes.status);
    if (rssRes.ok) {
      const xmlText = await rssRes.text();
      const matches = [...xmlText.matchAll(/<title>(.*?)<\/title>/g)];
      console.log("RSS Titles found:", matches.map(m => m[1]));
    }
  } catch (e: any) {
    console.error("Query 4 Error:", e.message);
  }
}

testAllShortsQueries();
