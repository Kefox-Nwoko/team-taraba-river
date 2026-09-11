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
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
  youtubeClientId: process.env.YOUTUBE_CLIENT_ID || '',
  youtubeClientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
  youtubeRefreshToken: process.env.YOUTUBE_REFRESH_TOKEN || '',
  youtubeRedirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/oauth2callback',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  firestoreProjectId: process.env.FIRESTORE_PROJECT_ID || 'Team Taraba River',
  googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  appUrl: process.env.APP_URL || 'https://team-taraba-river.web.app',
};

export const isAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return config.adminEmails.includes(normalized);
};
