import "dotenv/config";

const ytKey = process.env.YOUTUBE_API_KEY;
console.log("Testing YouTube Data API key:", ytKey ? ytKey.slice(0, 12) + "..." : "NONE");

async function testYouTubeApi() {
  try {
    const q = encodeURIComponent("USOSA Unity Schools Nigeria");
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=${q}&type=video&key=${ytKey}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log("Response status:", res.status);
    if (res.status === 200) {
      console.log("🎉 SUCCESS! Live YouTube Data API v3 Connected!");
      console.log(`Found ${data.items?.length || 0} YouTube Videos:`);
      for (const item of data.items || []) {
        console.log(`- [ID: ${item.id.videoId}] Title: ${item.snippet.title} (Published: ${item.snippet.publishedAt})`);
      }
    } else {
      console.log("YouTube API Error:", JSON.stringify(data, null, 2));
    }
  } catch (err: any) {
    console.error("Fetch exception:", err.message);
  }
}

testYouTubeApi();
