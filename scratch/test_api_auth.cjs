const fetch = require('node-fetch');

async function testApiCall() {
  try {
    console.log("Calling cloud-sync-all API with fake Bearer token...");
    const res = await fetch("http://localhost:3000/api/media/cloud-sync-all", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer fake_token"
      },
      body: JSON.stringify({ direction: "reverse" })
    });
    
    console.log("Response Status:", res.status);
    const text = await res.text();
    console.log("RAW RESPONSE:", text.slice(0, 1000));
  } catch (err) {
    console.error("HTTP ERROR:", err);
  }
}

testApiCall();
