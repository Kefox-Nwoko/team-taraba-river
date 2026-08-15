import "dotenv/config";

const apiKey = process.env.YOUTUBE_API_KEY;

function extractVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

console.log("Test YouTube Shorts URL Extraction:");
console.log("https://www.youtube.com/shorts/OaHQHXccRog ->", extractVideoId("https://www.youtube.com/shorts/OaHQHXccRog"));
console.log("https://youtube.com/shorts/zyOMHfOh390?feature=share ->", extractVideoId("https://youtube.com/shorts/zyOMHfOh390?feature=share"));

async function testFetchShortMetadata(videoId: string) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${videoId}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (res.status === 200 && data.items?.length > 0) {
    const item = data.items[0];
    console.log(`\n🎉 Metadata Fetched for Short [${videoId}]:`);
    console.log(`- Title: "${item.snippet.title}"`);
    console.log(`- Channel: "${item.snippet.channelTitle}" (${item.snippet.channelId})`);
    console.log(`- Thumbnail: ${item.snippet.thumbnails?.high?.url}`);
    console.log(`- Privacy: ${item.status?.privacyStatus}`);
  } else {
    console.log("Error fetching short metadata:", JSON.stringify(data, null, 2));
  }
}

testFetchShortMetadata("OaHQHXccRog");
