/**
 * Centralized environment configuration.
 * Reads from process.env with sensible defaults for local development.
 */
export const config = {
  adminEmails: (process.env.ADMIN_EMAILS || 'tarabateam@gmail.com,kefox.nwoko@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  ownerEmail: process.env.OWNER_EMAIL || 'tarabateam@gmail.com',
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  firestoreProjectId: process.env.FIRESTORE_PROJECT_ID || 'Team Taraba River',
  googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  appUrl: process.env.APP_URL || 'https://team-taraba-river.web.app',
};

export const isAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return config.adminEmails.includes(email.toLowerCase());
};
