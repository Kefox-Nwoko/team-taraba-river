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

console.log('Step 1: Open this authorization link in your web browser:\n');
console.log('\x1b[36m' + authUrl + '\x1b[0m\n');
console.log('Step 2: Sign in with the Google Account that manages the YouTube channel.');
console.log('Step 3: Click Allow. Once complete, copy the generated REFRESH TOKEN and add it to your .env:\n');
console.log('YOUTUBE_REFRESH_TOKEN=your_refresh_token_here\n');
