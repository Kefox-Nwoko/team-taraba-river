const fetch = require('node-fetch');

async function testApiCall() {
  try {
    console.log("Calling health API...");
    const res = await fetch("http://localhost:3000/api/health");
    console.log("Response Status:", res.status);
    const text = await res.text();
    console.log("RAW RESPONSE:", text.slice(0, 1000));
  } catch (err) {
    console.error("HTTP ERROR:", err);
  }
}

testApiCall();
