/**
 * Centralized environment configuration.
 * Reads from process.env with sensible defaults for local development.
 */
const DEFAULT_ADMIN_EMAILS = ['tarabateam@gmail.com', 'xtraworxng@gmail.com'];

export const config = {
  // Admin emails can be configured or extended via ADMIN_EMAILS env var.
  // Defaults always include official chapter admins.
  adminEmails: Array.from(
    new Set([
      ...DEFAULT_ADMIN_EMAILS,
      ...(process.env.ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ])
  ),
  ownerEmail: process.env.OWNER_EMAIL || 'tarabateam@gmail.com',
  // The single account authorized to restore or permanently purge anything
  // in the recycle bin. Deliberately separate from `adminEmails` — every
  // admin can move something into the bin, only this one account can ever
  // take it back out or make the deletion permanent.
  developerAdminEmail: (process.env.DEVELOPER_ADMIN_EMAIL || 'xtraworxng@gmail.com').trim().toLowerCase(),
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
  youtubeClientId: process.env.YOUTUBE_CLIENT_ID || '',
  youtubeClientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
  youtubeRefreshToken: process.env.YOUTUBE_REFRESH_TOKEN || '',
  youtubeRedirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/oauth2callback',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  // Cloudflare Turnstile secret — the human check on member registration.
  // Server-only (never a VITE_ var); the matching public site key is
  // VITE_TURNSTILE_SITE_KEY on the client.
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY || '',
  firestoreProjectId: process.env.FIRESTORE_PROJECT_ID || 'Team Taraba River',
  googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  appUrl: process.env.APP_URL || 'https://team-taraba-river.web.app',
};

export const isAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return config.adminEmails.includes(normalized);
};

export const isDeveloperAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return email.trim().toLowerCase() === config.developerAdminEmail;
};
