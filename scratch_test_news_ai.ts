import "dotenv/config";

async function testNewsApi() {
  try {
    const res = await fetch("http://localhost:3000/api/usosa-news?force=true");
    const data = await res.json();
    console.log("Success:", data.success);
    console.log("Headlines Count:", data.headlines?.length);
    if (data.headlines?.length > 0) {
      const first = data.headlines[0];
      console.log("\n--- SAMPLE HEADLINE 1 ---");
      console.log("Title:", first.title);
      console.log("Source:", first.source);
      console.log("Date:", first.publishedAt);
      console.log("\n--- SUMMARY (5-6 LINES) ---");
      console.log(first.summary);
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

testNewsApi();
