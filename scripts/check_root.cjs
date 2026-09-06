const fs = require('fs');
const sa = JSON.parse(fs.readFileSync('service-account.json'));
const { google } = require('googleapis');
const auth = new google.auth.JWT({
  email: sa.client_email,
  key: sa.private_key,
  scopes: ['https://www.googleapis.com/auth/drive']
});
const drive = google.drive({ version: 'v3', auth });

async function check() {
  const r = await drive.files.list({
    q: "'19UcHi6ItJBeOAENfsOCM69K05NHc_13D' in parents and trashed = false",
    fields: 'files(id, name, mimeType, createdTime)'
  });
  console.log(JSON.stringify(r.data.files, null, 2));
}

check().catch(console.error);
