import "dotenv/config";

const apiKey = process.env.YOUTUBE_API_KEY;

async function testDirectSync() {
  console.log("Testing Direct Back-and-Forth Sync for YouTube Channel UCF0QmTZ7Qj2DPxINaY2v2NA...");

  // 1. Check RSS feeds for channel_id & user
  const channelRss = `https://www.youtube.com/feeds/videos.xml?channel_id=UCF0QmTZ7Qj2DPxINaY2v2NA`;
  const userRss = `https://www.youtube.com/feeds/videos.xml?user=tarabateam`;

  try {
    const res1 = await fetch(channelRss);
    console.log("Channel RSS Status:", res1.status);
    if (res1.ok) {
      const text = await res1.text();
      const titles = [...text.matchAll(/<title>(.*?)<\/title>/g)].map(m => m[1]);
      console.log("Channel RSS Titles:", titles);
    }
  } catch (e: any) {
    console.error("Channel RSS error:", e.message);
  }

  try {
    const res2 = await fetch(userRss);
    console.log("User RSS Status:", res2.status);
    if (res2.ok) {
      const text = await res2.text();
      const titles = [...text.matchAll(/<title>(.*?)<\/title>/g)].map(m => m[1]);
      console.log("User RSS Titles:", titles);
    }
  } catch (e: any) {
    console.error("User RSS error:", e.message);
  }

  // 2. Query search with q="tarabateam" & channelId="UCF0QmTZ7Qj2DPxINaY2v2NA"
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=UCF0QmTZ7Qj2DPxINaY2v2NA&maxResults=50&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log("Search by ChannelId status:", res.status);
    if (res.status === 200) {
      console.log(`Found ${data.items?.length || 0} items`);
      for (const item of data.items || []) {
        console.log(`- ${item.id?.kind} | ID: ${item.id?.videoId || item.id?.playlistId} | Title: ${item.snippet?.title}`);
      }
    }
  } catch (e: any) {
    console.error("Search error:", e.message);
  }
}

testDirectSync();
