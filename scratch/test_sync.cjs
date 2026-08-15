const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

async function testSync() {
  try {
    const serviceAccountPath = path.resolve(__dirname, '..', 'service-account.json');
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

    const auth = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const drive = google.drive({ version: 'v3', auth });
    const rootFolderId = '19UcHi6ItJBeOAENfsOCM69K05NHc_13D';

    console.log("Listing parents...");
    const foldersRes = await drive.files.list({
      q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name, createdTime, modifiedTime)',
      orderBy: 'createdTime desc',
      pageSize: 100,
    });

    console.log("SUCCESS:", foldersRes.data.files);
  } catch (err) {
    console.error("ERROR DETECTED:", err);
  }
}

testSync();
