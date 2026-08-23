import { Request, Response, NextFunction } from 'express';
import { db, isFirestoreAvailable } from './firebaseAdmin';
import { serverLogger } from './logger';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { config } from './config';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

ffmpeg.setFfmpegPath(ffmpegPath as string);

// In-memory fallback store for media items when Firestore is unavailable
const inMemoryMediaStore = new Map<string, MediaItem>();

const MEDIA_COLLECTION = 'mediaItems';

export interface MediaItem {
  id: string;
  eventId: string;
  folderName?: string;
  type: 'photo' | 'video';
  base64Data: string;
  mimeType: string;
  fileName: string;
  status: 'pending' | 'processing' | 'synced' | 'failed';
  finalUrl?: string;
  storageTarget: 'drive' | 'youtube';
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export async function uploadIntermediateMedia(req: Request, res: Response): Promise<void> {
  try {
    const { eventId, folderName, type, base64Data, mimeType, fileName, storageTarget } = req.body;

    if (!eventId || !type || !base64Data || !mimeType) {
      res.status(400).json({ error: 'eventId, type, base64Data, and mimeType are required' });
      return;
    }

    const id = `media_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const item: MediaItem = {
      id,
      eventId,
      folderName: folderName || undefined,
      type: type === 'video' ? 'video' : 'photo',
      base64Data,
      mimeType,
      fileName: fileName || `${type}_${id}`,
      status: 'pending',
      storageTarget: storageTarget === 'youtube' ? 'youtube' : 'drive',
      createdAt: now,
      updatedAt: now,
    };

    if (isFirestoreAvailable()) {
      await db.collection(MEDIA_COLLECTION).doc(id).set(item);
    } else {
      // Fallback: store in memory so finalize can still retrieve it
      inMemoryMediaStore.set(id, item);
      serverLogger.warn(`[MediaPipeline] Firestore unavailable — stored media ${id} in memory for processing.`);
    }

    res.json({ success: true, mediaId: id, status: 'pending' });
  } catch (error) {
    serverLogger.error('Upload intermediate media error', error);
    res.status(500).json({ error: 'Failed to upload media.' });
  }
}

export async function finalizeMedia(req: Request, res: Response): Promise<void> {
  try {
    const { mediaId } = req.body;

    if (!mediaId) {
      res.status(400).json({ error: 'mediaId is required' });
      return;
    }

    let item: MediaItem | null = null;

    if (isFirestoreAvailable()) {
      const doc = await db.collection(MEDIA_COLLECTION).doc(mediaId).get();
      if (doc.exists) {
        item = doc.data() as MediaItem;
      }
    }

    // Fallback: retrieve from in-memory store if Firestore not available or doc missing
    if (!item) {
      item = inMemoryMediaStore.get(mediaId) || null;
    }

    if (!item) {
      res.status(404).json({ error: 'Media item not found. It may have expired or not been uploaded yet.' });
      return;
    }

    if (item.status === 'synced' && item.finalUrl) {
      res.json({ success: true, mediaId: item.id, finalUrl: item.finalUrl, status: item.status });
      return;
    }

    // Update status to processing
    item.status = 'processing';
    item.updatedAt = new Date().toISOString();
    if (isFirestoreAvailable()) {
      await db.collection(MEDIA_COLLECTION).doc(mediaId).update({
        status: 'processing',
        updatedAt: item.updatedAt,
      });
    } else {
      inMemoryMediaStore.set(mediaId, item);
    }

    let finalUrl = '';

    try {
      if (item.type === 'photo') {
        finalUrl = await syncImageToDrive(item);
      } else {
        if (item.storageTarget === 'youtube') {
          try {
            finalUrl = await uploadVideoToYouTube(item);
          } catch (ytError: any) {
            serverLogger.warn(`YouTube upload failed for ${mediaId}, falling back to Drive`, { error: ytError?.message || ytError });
            finalUrl = await uploadVideoToDrive(item);
          }
        } else {
          finalUrl = await uploadVideoToDrive(item);
        }
      }

      // Update item to synced
      item.status = 'synced';
      item.finalUrl = finalUrl;
      item.updatedAt = new Date().toISOString();

      if (isFirestoreAvailable()) {
        await db.collection(MEDIA_COLLECTION).doc(mediaId).update({
          status: 'synced',
          finalUrl,
          updatedAt: item.updatedAt,
        });
      } else {
        inMemoryMediaStore.set(mediaId, item);
      }

      res.json({ success: true, mediaId: item.id, finalUrl, status: 'synced' });
    } catch (processError: any) {
      const errorMessage = processError instanceof Error ? processError.message : String(processError);
      item.status = 'failed';
      item.error = errorMessage;
      item.updatedAt = new Date().toISOString();
      if (isFirestoreAvailable()) {
        await db.collection(MEDIA_COLLECTION).doc(mediaId).update({
          status: 'failed',
          error: errorMessage,
          updatedAt: item.updatedAt,
        });
      } else {
        inMemoryMediaStore.set(mediaId, item);
      }
      serverLogger.error('Media finalize error', processError);
      res.status(500).json({ success: false, error: `Media processing failed: ${errorMessage}` });
    }
  } catch (error) {
    serverLogger.error('Finalize media outer error', error);
    res.status(500).json({ error: 'Failed to finalize media.' });
  }
}

export async function getMediaStatus(req: Request, res: Response): Promise<void> {
  try {
    const { mediaId } = req.params;

    if (!mediaId) {
      res.status(400).json({ error: 'mediaId is required' });
      return;
    }

    // Try Firestore first, then fall back to in-memory store
    if (isFirestoreAvailable()) {
      const doc = await db.collection(MEDIA_COLLECTION).doc(mediaId).get();
      if (doc.exists) {
        const data = doc.data();
        res.json({ mediaId: doc.id, ...data });
        return;
      }
    }

    // Fallback to in-memory store
    const memItem = inMemoryMediaStore.get(mediaId);
    if (memItem) {
      res.json({ mediaId: memItem.id, ...memItem });
      return;
    }

    res.status(404).json({ error: 'Media item not found' });
  } catch (error) {
    serverLogger.error('Get media status error', error);
    res.status(500).json({ error: 'Failed to get media status.' });
  }
}

export async function base64ToBuffer(base64: string): Promise<Buffer> {
  const matches = base64.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid base64 data URL format');
  }
  return Buffer.from(matches[2], 'base64');
}

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

async function syncImageToDrive(item: MediaItem): Promise<string> {
  const { google } = await import('googleapis');
  
  const serviceAccountPath = await getServiceAccountPath();
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

  const auth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });

  const buffer = await base64ToBuffer(item.base64Data);

  // Target the configured root folder and resolve/create the event's subfolder
  const rootFolderId = await getDriveRootFolderId();
  let targetFolderId = rootFolderId;
  if (rootFolderId && item.folderName) {
    targetFolderId = await findOrCreateDriveFolder(drive, item.folderName, rootFolderId);
  }

  const fileMetadata: any = {
    name: item.fileName || `photo_${item.id}.webp`,
    mimeType: item.mimeType || 'image/webp',
    ...(targetFolderId ? { parents: [targetFolderId] } : {}),
  };

  const mediaBody = {
    mimeType: item.mimeType || 'image/webp',
    data: buffer,
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: mediaBody,
    fields: 'id, webViewLink, webContentLink',
  });

  const fileId = response.data.id;
  if (!fileId) {
    throw new Error('Drive upload succeeded but returned no file ID');
  }

  // Make file publicly readable so the link works without authentication
  await setFilePublicReadable(drive, fileId);

  // Return Google UserContent CDN direct image link (works natively in <img> tags)
  return `https://lh3.googleusercontent.com/d/${fileId}`;
}

export async function uploadVideoToDrive(item: MediaItem): Promise<string> {
  const { google } = await import('googleapis');
  
  const serviceAccountPath = await getServiceAccountPath();
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

  const auth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });

  let buffer = await base64ToBuffer(item.base64Data);
  let mimeType = item.mimeType || 'video/mp4';
  let fileName = item.fileName || `video_${item.id}.mp4`;

  try {
    const compressed = await compressVideoForDrive(buffer, item.fileName || `video_${item.id}`);
    if (compressed) {
      buffer = compressed.buffer;
      mimeType = compressed.mimeType;
      fileName = compressed.fileName;
      serverLogger.info(`[Drive Sync] Compressed video for Drive fallback: ${fileName}`);
    }
  } catch (compressionError: any) {
    serverLogger.warn(`[Drive Sync] Video compression failed, uploading original: ${compressionError?.message || compressionError}`);
  }

  // Target the configured root folder and resolve/create the event's subfolder
  const rootFolderId = await getDriveRootFolderId();
  let targetFolderId = rootFolderId;
  if (rootFolderId && item.folderName) {
    targetFolderId = await findOrCreateDriveFolder(drive, item.folderName, rootFolderId);
  }

  const fileMetadata: any = {
    name: fileName,
    mimeType: mimeType,
    ...(targetFolderId ? { parents: [targetFolderId] } : {}),
  };

  const mediaBody = {
    mimeType: mimeType,
    data: buffer,
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: mediaBody,
    fields: 'id, webViewLink, webContentLink',
  });

  const fileId = response.data.id;
  if (!fileId) {
    throw new Error('Drive upload succeeded but returned no file ID');
  }

  // Make video publicly accessible
  await setFilePublicReadable(drive, fileId);

  const webViewLink = response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
  return webViewLink;
}

interface CompressedVideoResult {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

export async function compressVideoForDrive(originalBuffer: Buffer, originalName: string): Promise<CompressedVideoResult | null> {
  const inputPath = path.join(process.cwd(), `tmp_input_${Date.now()}.mp4`);
  const outputPath = path.join(process.cwd(), `tmp_compressed_${Date.now()}.mp4`);

  try {
    fs.writeFileSync(inputPath, originalBuffer);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .output(outputPath)
        .videoCodec('libx264')
        .size('1280x?')
        .fps(30)
        .videoBitrate('1500k')
        .audioCodec('aac')
        .audioBitrate('128k')
        .format('mp4')
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });

    const compressedBuffer = fs.readFileSync(outputPath);
    const compressedFileName = originalName.replace(/\.[^/.]+$/, '') + '_compressed.mp4';

    return {
      buffer: compressedBuffer,
      mimeType: 'video/mp4',
      fileName: compressedFileName,
    };
  } catch (error: any) {
    serverLogger.warn(`[Drive Sync] ffmpeg compression error: ${error?.message || error}`);
    return null;
  } finally {
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (cleanupError: any) {
      serverLogger.warn(`[Drive Sync] Temporary file cleanup warning: ${cleanupError?.message || cleanupError}`);
    }
  }
}

export async function uploadVideoBufferToYouTube(
  buffer: Buffer,
  fileName: string,
  folderName?: string,
  mimeType: string = 'video/mp4'
): Promise<string> {
  const { google } = await import('googleapis');

  let authClient: any = null;

  // Method 1: OAuth2 Client with permanent Refresh Token (Primary & Recommended by Google)
  if (config.youtubeClientId && config.youtubeClientSecret && config.youtubeRefreshToken) {
    const oauth2Client = new google.auth.OAuth2(
      config.youtubeClientId,
      config.youtubeClientSecret,
      config.youtubeRedirectUri
    );
    oauth2Client.setCredentials({
      refresh_token: config.youtubeRefreshToken,
    });
    authClient = oauth2Client;
    serverLogger.info(`[YouTube Upload] Using OAuth2 credentials with channel refresh token for "${fileName}"`);
  } else {
    // Method 2: Service Account JWT Fallback (if configured)
    try {
      const serviceAccountPath = await getServiceAccountPath();
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
      authClient = new google.auth.JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: ['https://www.googleapis.com/auth/youtube.upload'],
      });
      serverLogger.info(`[YouTube Upload] Attempting Service Account JWT fallback for "${fileName}"`);
    } catch {
      throw new Error(
        'YouTube upload credentials not configured. Please set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN in your environment.'
      );
    }
  }

  const youtube = google.youtube({ version: 'v3', auth: authClient });
  const bufferStream = Readable.from(buffer);

  const cleanTitle = (fileName || `Team Taraba River Video ${new Date().toLocaleDateString()}`)
    .replace(/\.[^/.]+$/, '')
    .substring(0, 100);

  const requestBody: any = {
    snippet: {
      title: cleanTitle,
      description: `Team Taraba River Community Event Media Archive (${folderName || 'General Event'})\nUploaded via Team Taraba River Portal.`,
      tags: ['Team Taraba River', 'Community', 'URIP', 'USOSA', 'Event'],
      categoryId: '22', // People & Blogs
    },
    status: {
      privacyStatus: 'unlisted', // Unlisted: community can watch on app without ads or unwanted public indexing
      selfDeclaredMadeForKids: false,
    },
  };

  const response = await (youtube.videos.insert as any)({
    part: 'snippet,status',
    requestBody,
    media: {
      mimeType: mimeType || 'video/mp4',
      body: bufferStream,
    },
  });

  const videoId = response.data.id;
  if (!videoId) {
    throw new Error('YouTube upload completed but returned no video ID');
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  serverLogger.info(`[YouTube Upload] ✅ Successfully published video to YouTube: ${youtubeUrl}`);
  return youtubeUrl;
}

export async function uploadVideoToYouTube(item: MediaItem): Promise<string> {
  const buffer = await base64ToBuffer(item.base64Data);
  return uploadVideoBufferToYouTube(buffer, item.fileName, item.folderName, item.mimeType);
}

