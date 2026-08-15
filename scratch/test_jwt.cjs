const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

async function getAccessToken() {
  try {
    const serviceAccountPath = path.resolve(__dirname, '..', 'service-account.json');
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

    const auth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    console.log("Authorizing...");
    auth.authorize((err, tokens) => {
      if (err) {
        console.error("AUTH ERROR:", err);
      } else {
        console.log("TOKEN SUCCESS:", tokens.access_token ? "GOT TOKEN" : "NO TOKEN");
      }
    });
  } catch (err) {
    console.error("EXCEPTION:", err);
  }
}
getAccessToken();
