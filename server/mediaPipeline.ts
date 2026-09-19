import { Request, Response } from 'express';
import { serverLogger } from './logger';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

ffmpeg.setFfmpegPath(ffmpegPath as string);

async function getServiceAccountPath(): Promise<string> {
  const credentialsPath = config.googleApplicationCredentials;
  if (!credentialsPath) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not configured. Media upload to Drive/YouTube requires a service account JSON file.");
  }
  const resolvedPath = path.resolve(process.cwd(), credentialsPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Service account credentials file not found at: ${resolvedPath}`);
  }
  return resolvedPath;
}

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'];
let cachedDriveAuthClient: any = null;

/**
 * Returns an authenticated Drive client credential. Prefers OAuth2 as the
 * real tarabateam@gmail.com account (same refresh token used for YouTube
 * uploads — the consent grant covers both youtube.upload and drive scopes)
 * so uploads count against that account's actual storage quota. A bare
 * service account cannot do this: Google gives service accounts zero
 * personal Drive storage, so file creation fails with
 * "storageQuotaExceeded" even when the target folder is shared with it,
 * regardless of folder permissions. Falls back to a local service-account
 * key file (dev convenience) or Application Default Credentials if the
 * OAuth vars aren't configured, matching the old behavior for local dev.
 */
export async function getDriveAuthClient(): Promise<any> {
  if (cachedDriveAuthClient) return cachedDriveAuthClient;

  if (config.youtubeClientId && config.youtubeClientSecret && config.youtubeRefreshToken) {
    const oauth2Client = new google.auth.OAuth2(config.youtubeClientId, config.youtubeClientSecret, config.youtubeRedirectUri);
    oauth2Client.setCredentials({ refresh_token: config.youtubeRefreshToken });
    cachedDriveAuthClient = oauth2Client;
    return cachedDriveAuthClient;
  }

  if (config.googleApplicationCredentials) {
    const serviceAccountPath = await getServiceAccountPath();
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
    cachedDriveAuthClient = new google.auth.JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: DRIVE_SCOPES,
    });
    return cachedDriveAuthClient;
  }

  const auth = new google.auth.GoogleAuth({ scopes: DRIVE_SCOPES });
  cachedDriveAuthClient = await auth.getClient();
  return cachedDriveAuthClient;
}

async function getDriveRootFolderId(): Promise<string | null> {
  const folderIdFromEnv = config.googleDriveFolderId;
  if (folderIdFromEnv && folderIdFromEnv.length > 10 && !folderIdFromEnv.includes('1a2b3c')) {
    return folderIdFromEnv;
  }
  // Try to extract from the default Drive URL
  const defaultUrl = 'https://drive.google.com/drive/folders/19UcHi6ItJBeOAENfsOCM69K05NHc_13D';
  const match = defaultUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function findOrCreateDriveFolder(drive: any, folderName: string, parentRootFolderId: string): Promise<string> {
  const safeName = folderName.replace(/'/g, "\\'");
  try {
    const listRes = await drive.files.list({
      q: `name = '${safeName}' and '${parentRootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (listRes.data.files && listRes.data.files.length > 0) {
      return listRes.data.files[0].id;
    }

    const createRes = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentRootFolderId],
      },
      fields: 'id',
    });

    const folderId = createRes.data.id;
    await setFilePublicReadable(drive, folderId);
    serverLogger.info(`[Drive Sync] Created new Google Drive subfolder "${folderName}" (${folderId}) in Team Taraba River`);
    return folderId;
  } catch (err: any) {
    serverLogger.warn(`[Drive Sync] Subfolder lookup/creation for "${folderName}" failed, defaulting to root: ${err?.message || err}`);
    return parentRootFolderId;
  }
}

async function setFilePublicReadable(drive: any, fileId: string): Promise<void> {
  try {
    await drive.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
  } catch (permErr: any) {
    serverLogger.warn(`[Drive] Could not set public permission on file ${fileId}: ${permErr?.message || permErr}`);
  }
}

// ===================================================================
//  Direct-to-Google Resumable Upload Bridge
//
//  The client streams large photo/video bytes straight to Google (fast,
//  low memory on our server, keeps XHR progress/resume working) but it
//  must never hold the Drive/YouTube client secret or refresh token to do
//  it. So the server opens the resumable upload session here — using
//  credentials that never leave this process — and only returns the
//  resulting session URL, which is single-use and expires on its own.
// ===================================================================

export async function initDriveUploadSession(req: Request, res: Response): Promise<void> {
  try {
    const { fileName, mimeType, size, folderName } = req.body || {};

    const auth = await getDriveAuthClient();
    const accessToken = (await auth.getAccessToken()).token;
    if (!accessToken) throw new Error('Failed to obtain a Google Drive access token.');

    const drive = google.drive({ version: 'v3', auth });
    const rootFolderId = await getDriveRootFolderId();
    let targetFolderId = rootFolderId;
    if (rootFolderId && folderName) {
      targetFolderId = await findOrCreateDriveFolder(drive, folderName, rootFolderId);
    }

    const cleanName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const metadata: any = {
      name: cleanName,
      mimeType,
      ...(targetFolderId ? { parents: [targetFolderId] } : {}),
    };

    const initRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink,webContentLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          ...(size ? { 'X-Upload-Content-Length': String(size) } : {}),
          'X-Upload-Content-Type': mimeType,
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      const errText = await initRes.text().catch(() => '');
      throw new Error(`Drive upload session init failed (${initRes.status}): ${errText}`);
    }

    const uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) {
      throw new Error('Google Drive did not return an upload session URL.');
    }

    res.json({ success: true, uploadUrl, folderId: targetFolderId || null });
  } catch (error: any) {
    serverLogger.error('Drive init-upload error', error);
    res.status(500).json({ error: error?.message || 'Failed to initiate Google Drive upload session.' });
  }
}

export async function makeDriveFilePublic(req: Request, res: Response): Promise<void> {
  try {
    const { fileId } = req.body || {};

    const auth = await getDriveAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    await setFilePublicReadable(drive, fileId);
    res.json({ success: true });
  } catch (error: any) {
    serverLogger.error('Drive make-public error', error);
    res.status(500).json({ error: error?.message || 'Failed to set Google Drive file permissions.' });
  }
}

function getYouTubeOAuthClient() {
  if (!config.youtubeClientId || !config.youtubeClientSecret || !config.youtubeRefreshToken) {
    throw new Error(
      'YouTube upload credentials are not configured on the server. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN.'
    );
  }
  const oauth2Client = new google.auth.OAuth2(config.youtubeClientId, config.youtubeClientSecret, config.youtubeRedirectUri);
  oauth2Client.setCredentials({ refresh_token: config.youtubeRefreshToken });
  return oauth2Client;
}

export async function initYouTubeUploadSession(req: Request, res: Response): Promise<void> {
  try {
    const { fileName, mimeType, size, folderName } = req.body || {};

    const oauth2Client = getYouTubeOAuthClient();
    const { token: accessToken } = await oauth2Client.getAccessToken();
    if (!accessToken) throw new Error('Failed to obtain a YouTube access token.');

    const cleanTitle = String(fileName || `Team Taraba River Video ${new Date().toLocaleDateString()}`)
      .replace(/\.[^/.]+$/, '')
      .substring(0, 95);

    const metadata = {
      snippet: {
        title: cleanTitle,
        description: `Team Taraba River Community Event Media Archive (${folderName || 'General Event'})\nUploaded via Team Taraba River Portal.`,
        tags: ['Team Taraba River', 'Community', 'URIP', 'USOSA', 'Event'],
        categoryId: '22',
      },
      status: {
        privacyStatus: 'unlisted',
        selfDeclaredMadeForKids: false,
      },
    };

    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          ...(size ? { 'X-Upload-Content-Length': String(size) } : {}),
          'X-Upload-Content-Type': mimeType || 'video/mp4',
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      const errText = await initRes.text().catch(() => '');
      throw new Error(`YouTube upload session init failed (${initRes.status}): ${errText}`);
    }

    const uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) {
      throw new Error('YouTube did not return an upload session URL.');
    }

    res.json({ success: true, uploadUrl });
  } catch (error: any) {
    serverLogger.error('YouTube init-upload error', error);
    res.status(500).json({ error: error?.message || 'Failed to initiate YouTube upload session.' });
  }
}

export async function deleteYouTubeVideoServer(req: Request, res: Response): Promise<void> {
  try {
    const { videoId } = req.params;
    if (!videoId) {
      res.status(400).json({ error: 'videoId is required' });
      return;
    }

    const oauth2Client = getYouTubeOAuthClient();
    const { token: accessToken } = await oauth2Client.getAccessToken();

    const delRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(videoId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (delRes.ok || delRes.status === 404) {
      res.json({ success: true });
      return;
    }

    const errText = await delRes.text().catch(() => '');
    res.status(delRes.status).json({ success: false, error: errText });
  } catch (error: any) {
    serverLogger.error('YouTube delete error', error);
    res.status(500).json({ error: error?.message || 'Failed to delete YouTube video.' });
  }
}

// ===================================================================
//  Video Thumbnail Generation — extracts a single frame from a
//  Google Drive-hosted video and caches it server-side.
//  Silicon Valley standard: every video asset gets a real preview
//  frame instead of a generic placeholder image.
// ===================================================================

interface ThumbnailCacheEntry {
  buffer: Buffer;
  mimeType: string;
  createdAt: number;
}

const THUMBNAIL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const thumbnailCache = new Map<string, ThumbnailCacheEntry>();

export async function generateVideoThumbnail(fileId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const cacheKey = `thumb_${fileId}`;
  const cached = thumbnailCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.createdAt < THUMBNAIL_CACHE_TTL_MS) {
    return { buffer: cached.buffer, mimeType: cached.mimeType };
  }

  const auth = await getDriveAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const inputPath = path.join(process.cwd(), `tmp_thumb_${fileId}_${Date.now()}.mp4`);
  const outputPath = path.join(process.cwd(), `tmp_thumb_frame_${fileId}_${Date.now()}.webp`);

  try {
    const driveRes = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream', headers: { Range: 'bytes=0-2097152' } }
    );

    const writeStream = fs.createWriteStream(inputPath);
    await new Promise<void>((resolve, reject) => {
      driveRes.data.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput('0.5')
        .duration(0.1)
        .outputOptions(['-frames:v', '1', '-q:v', '2'])
        .format('webp')
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject);
    });

    const buffer = fs.readFileSync(outputPath);
    const result = { buffer, mimeType: 'image/webp' };
    thumbnailCache.set(cacheKey, { ...result, createdAt: now });
    return result;
  } catch (err: any) {
    serverLogger.warn(`[Thumbnail] Failed to generate thumbnail for ${fileId}: ${err?.message || err}`);
    return null;
  } finally {
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch {}
  }
}

export async function generateVideoThumbnailFromUrl(videoUrl: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const cacheKey = `thumb_url_${videoUrl}`;
  const cached = thumbnailCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.createdAt < THUMBNAIL_CACHE_TTL_MS) {
    return { buffer: cached.buffer, mimeType: cached.mimeType };
  }

  const inputPath = path.join(process.cwd(), `tmp_thumb_url_${Date.now()}.mp4`);
  const outputPath = path.join(process.cwd(), `tmp_thumb_frame_url_${Date.now()}.webp`);

  try {
    const response = await fetch(videoUrl, {
      headers: { Range: 'bytes=0-2097152' },
    });
    if (!response.ok) {
      serverLogger.warn(`[Thumbnail URL] HTTP ${response.status} for ${videoUrl}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(inputPath, Buffer.from(arrayBuffer));

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput('0.5')
        .duration(0.1)
        .outputOptions(['-frames:v', '1', '-q:v', '2'])
        .format('webp')
        .save(outputPath)
        .on('end', resolve)
        .on('error', reject);
    });

    const buffer = fs.readFileSync(outputPath);
    const result = { buffer, mimeType: 'image/webp' };
    thumbnailCache.set(cacheKey, { ...result, createdAt: now });
    return result;
  } catch (err: any) {
    serverLogger.warn(`[Thumbnail URL] Failed to generate thumbnail for ${videoUrl}: ${err?.message || err}`);
    return null;
  } finally {
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch {}
  }
}

