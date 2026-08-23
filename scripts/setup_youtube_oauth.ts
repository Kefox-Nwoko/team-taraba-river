/**
 * YouTube OAuth 2.0 Authorization Setup Helper
 * 
 * Run with: npx tsx scripts/setup_youtube_oauth.ts
 * 
 * This script generates the YouTube channel authorization URL, listens for the authorization code,
 * exchanges it for a permanent Refresh Token, and displays instructions to save it to .env.
 */

import { google } from 'googleapis';
import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || '459096517410-6biibehstofnaai4g7r7on5m55mtmitd.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || '';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

console.log('\n======================================================');
console.log('🎥 Team Taraba River - YouTube Channel OAuth Setup');
console.log('======================================================\n');

if (!CLIENT_SECRET) {
  console.log('⚠️  Notice: YOUTUBE_CLIENT_SECRET is not yet set in your environment.');
  console.log('👉 Please ensure your Google Cloud OAuth Client ID and Secret are configured.\n');
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const scopes = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube',
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // Demands permanent Refresh Token
  prompt: 'consent',     // Forces refresh token emission
  scope: scopes,
});

console.log('------------------------------------------------------');
console.log('Method 1: Direct Local Authorization');
console.log('------------------------------------------------------');
console.log('If you see "Error 400: redirect_uri_mismatch":');
console.log('1. Go to Google Cloud Console: https://console.cloud.google.com/apis/credentials');
console.log('2. Click your OAuth 2.0 Client ID.');
console.log('3. Under "Authorized redirect URIs", add:');
console.log('   http://localhost:3000/oauth2callback');
console.log('   https://developers.google.com/oauthplayground');
console.log('4. Click Save, then open this authorization link in your browser:\n');
console.log('\x1b[36m' + authUrl + '\x1b[0m\n');

console.log('------------------------------------------------------');
console.log('Method 2: Google OAuth Playground (Instant - 30 Seconds)');
console.log('------------------------------------------------------');
console.log('1. Open: https://developers.google.com/oauthplayground/');
console.log('2. Click the Gear icon ⚙️ (top right), check "Use your own OAuth credentials", and enter your Client ID & Secret.');
console.log('3. In the left list, find "YouTube Data API v3" -> select "https://www.googleapis.com/auth/youtube.upload".');
console.log('4. Click "Authorize APIs", sign in with your YouTube account, and click Allow.');
console.log('5. Click "Exchange authorization code for tokens", then copy the "Refresh token".\n');
console.log('Finally, add to your .env:');
console.log('YOUTUBE_REFRESH_TOKEN=your_refresh_token_here\n');

