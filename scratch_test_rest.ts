import "dotenv/config";

const apiKey = process.env.GEMINI_API_KEY;

async function testWebGrounding() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "What are the latest top news about USOSA and Unity Schools?" }] }],
      tools: [{ googleSearch: {} }]
    })
  });
  const data = await res.json();
  console.log("Status:", res.status);
  if (res.status === 200) {
    console.log(">>> LIVE GEMINI WEB SEARCH RESPONSE:");
    console.log(data.candidates?.[0]?.content?.parts?.[0]?.text);
    console.log(">>> GROUNDING SOURCES:");
    console.log(JSON.stringify(data.candidates?.[0]?.groundingMetadata?.groundingChunks || [], null, 2));
  } else {
    console.log("Error:", JSON.stringify(data, null, 2));
  }
}

testWebGrounding();
