import fetch from 'node-fetch';

async function testFetch() {
  try {
    console.log("Fetching Google...");
    const res = await fetch("https://www.googleapis.com/discovery/v1/apis");
    console.log("STATUS:", res.status);
  } catch (err) {
    console.error("FETCH ERROR:", err);
  }
}

testFetch();
