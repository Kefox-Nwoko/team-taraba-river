/**
 * Exchange Authorization Code for Permanent YouTube Refresh Token
 * 
 * Usage: npx tsx scripts/exchange_code.ts "YOUR_AUTHORIZATION_CODE_OR_FULL_URL"
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || '459096517410-6biibehstofnaai4g7r7on5m55mtmitd.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || '';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

async function exchange() {
  const input = process.argv[2];
  if (!input) {
    console.log('❌ Please provide the code or full URL from your browser address bar.');
    console.log('Example: npx tsx scripts/exchange_code.ts "4/0A..."');
    return;
  }

  let code = input.trim();
  if (code.includes('code=')) {
    const match = code.match(/code=([^&]+)/);
    if (match) {
      code = decodeURIComponent(match[1]);
    }
  }

  console.log('\nExchanging authorization code for permanent YouTube Refresh Token...');
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\n======================================================');
    console.log('🎉 SUCCESS! Permanent YouTube Refresh Token Generated:');
    console.log('======================================================\n');
    console.log('\x1b[32m' + (tokens.refresh_token || tokens.access_token) + '\x1b[0m\n');
    console.log('Add this line to your .env file:');
    console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
  } catch (err: any) {
    console.error('❌ Token exchange error:', err?.message || err);
  }
}

exchange();
