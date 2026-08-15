import "dotenv/config";

const apiKey = process.env.YOUTUBE_API_KEY;

async function checkKeyDetails() {
  console.log("Checking API Key details...");
  // Test if we can list channels or query playlists
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log("Mine Status:", res.status);
    if (res.status === 200 && data.items?.length > 0) {
      console.log("🎉 FOUND OWNED CHANNEL:");
      for (const item of data.items) {
        console.log(`- Title: "${item.snippet.title}" | ID: ${item.id} | Uploads Playlist: ${item.contentDetails?.relatedPlaylists?.uploads}`);
      }
    } else {
      console.log("Mine Result:", JSON.stringify(data, null, 2));
    }
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}

checkKeyDetails();
