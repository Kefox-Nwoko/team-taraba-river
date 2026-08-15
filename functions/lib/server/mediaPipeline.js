import { db, isFirestoreAvailable } from './firebaseAdmin';
import { serverLogger } from './logger';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
ffmpeg.setFfmpegPath(ffmpegPath);
const MEDIA_COLLECTION = 'mediaItems';
export async function uploadIntermediateMedia(req, res) {
    try {
        const { eventId, type, base64Data, mimeType, fileName, storageTarget } = req.body;
        if (!eventId || !type || !base64Data || !mimeType) {
            res.status(400).json({ error: 'eventId, type, base64Data, and mimeType are required' });
            return;
        }
        const id = `media_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const now = new Date().toISOString();
        const item = {
            id,
            eventId,
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
        }
        res.json({ success: true, mediaId: id, status: 'pending' });
    }
    catch (error) {
        serverLogger.error('Upload intermediate media error', error);
        res.status(500).json({ error: 'Failed to upload media.' });
    }
}
export async function finalizeMedia(req, res) {
    try {
        const { mediaId } = req.body;
        if (!mediaId) {
            res.status(400).json({ error: 'mediaId is required' });
            return;
        }
        let item = null;
        if (isFirestoreAvailable()) {
            const doc = await db.collection(MEDIA_COLLECTION).doc(mediaId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Media item not found' });
                return;
            }
            item = doc.data();
        }
        else {
            res.status(503).json({ error: 'Firestore not available for media processing' });
            return;
        }
        if (!item) {
            res.status(404).json({ error: 'Media item not found' });
            return;
        }
        if (item.status === 'synced') {
            res.json({ success: true, mediaId: item.id, finalUrl: item.finalUrl, status: item.status });
            return;
        }
        await db.collection(MEDIA_COLLECTION).doc(mediaId).update({
            status: 'processing',
            updatedAt: new Date().toISOString(),
        });
        let finalUrl = '';
        try {
            if (item.type === 'photo') {
                finalUrl = await syncImageToDrive(item);
            }
            else {
                if (item.storageTarget === 'youtube') {
                    try {
                        finalUrl = await uploadVideoToYouTube(item);
                    }
                    catch (ytError) {
                        serverLogger.warn(`YouTube upload failed for ${mediaId}, falling back to Drive`, { error: ytError?.message || ytError });
                        finalUrl = await uploadVideoToDrive(item);
                    }
                }
                else {
                    finalUrl = await uploadVideoToDrive(item);
                }
            }
            await db.collection(MEDIA_COLLECTION).doc(mediaId).update({
                status: 'synced',
                finalUrl,
                updatedAt: new Date().toISOString(),
            });
            res.json({ success: true, mediaId: item.id, finalUrl, status: 'synced' });
        }
        catch (processError) {
            const errorMessage = processError instanceof Error ? processError.message : String(processError);
            await db.collection(MEDIA_COLLECTION).doc(mediaId).update({
                status: 'failed',
                error: errorMessage,
                updatedAt: new Date().toISOString(),
            });
            serverLogger.error('Media finalize error', processError);
            res.status(500).json({ error: `Media processing failed: ${errorMessage}` });
        }
    }
    catch (error) {
        serverLogger.error('Finalize media error', error);
        res.status(500).json({ error: 'Failed to finalize media.' });
    }
}
export async function getMediaStatus(req, res) {
    try {
        const { mediaId } = req.params;
        if (!mediaId) {
            res.status(400).json({ error: 'mediaId is required' });
            return;
        }
        if (!isFirestoreAvailable()) {
            res.status(503).json({ error: 'Firestore not available' });
            return;
        }
        const doc = await db.collection(MEDIA_COLLECTION).doc(mediaId).get();
        if (!doc.exists) {
            res.status(404).json({ error: 'Media item not found' });
            return;
        }
        const data = doc.data();
        res.json({ mediaId: doc.id, ...data });
    }
    catch (error) {
        serverLogger.error('Get media status error', error);
        res.status(500).json({ error: 'Failed to get media status.' });
    }
}
export async function base64ToBuffer(base64) {
    const matches = base64.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        throw new Error('Invalid base64 data URL format');
    }
    return Buffer.from(matches[2], 'base64');
}
async function getServiceAccountPath() {
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
async function syncImageToDrive(item) {
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
    const fileMetadata = {
        name: item.fileName || `photo_${item.id}.webp`,
        mimeType: item.mimeType || 'image/webp',
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
    const webViewLink = response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
    const directLink = `https://drive.google.com/uc?export=view&id=${fileId}`;
    return directLink || webViewLink;
}
export async function uploadVideoToDrive(item) {
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
    }
    catch (compressionError) {
        serverLogger.warn(`[Drive Sync] Video compression failed, uploading original: ${compressionError?.message || compressionError}`);
    }
    const fileMetadata = {
        name: fileName,
        mimeType: mimeType,
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
    const webViewLink = response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
    return webViewLink;
}
export async function compressVideoForDrive(originalBuffer, originalName) {
    const inputPath = path.join(process.cwd(), `tmp_input_${Date.now()}.mp4`);
    const outputPath = path.join(process.cwd(), `tmp_compressed_${Date.now()}.mp4`);
    try {
        fs.writeFileSync(inputPath, originalBuffer);
        await new Promise((resolve, reject) => {
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
    }
    catch (error) {
        serverLogger.warn(`[Drive Sync] ffmpeg compression error: ${error?.message || error}`);
        return null;
    }
    finally {
        try {
            if (fs.existsSync(inputPath))
                fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath))
                fs.unlinkSync(outputPath);
        }
        catch (cleanupError) {
            serverLogger.warn(`[Drive Sync] Temporary file cleanup warning: ${cleanupError?.message || cleanupError}`);
        }
    }
}
export async function uploadVideoToYouTube(item) {
    const { google } = await import('googleapis');
    const serviceAccountPath = await getServiceAccountPath();
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
    const auth = new google.auth.JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: ['https://www.googleapis.com/auth/youtube.upload'],
    });
    const youtube = google.youtube({ version: 'v3', auth });
    const buffer = await base64ToBuffer(item.base64Data);
    const bufferStream = require('stream').Readable.from(buffer);
    const requestBody = {
        snippet: {
            title: item.fileName || `Team Taraba River Video ${new Date().toLocaleDateString()}`,
            description: 'Video uploaded via Team Taraba River Community Portal',
            tags: ['Team Taraba River', 'Community', 'Event'],
            categoryId: '17', // Sports
        },
        status: {
            privacyStatus: 'unlisted',
            selfDeclaredMadeForKids: false,
        },
    };
    const response = await youtube.videos.insert({
        part: 'snippet,status',
        requestBody,
        media: {
            mimeType: item.mimeType || 'video/mp4',
            body: bufferStream,
        },
    });
    const videoId = response.data.id;
    if (!videoId) {
        throw new Error('YouTube upload succeeded but returned no video ID');
    }
    return `https://www.youtube.com/watch?v=${videoId}`;
}
