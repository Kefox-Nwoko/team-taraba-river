import { google } from 'googleapis';
import type { Firestore } from 'firebase-admin/firestore';
import { serverLogger } from './logger';
import { getDriveAuthClient, getDriveRootFolderId, getYouTubeOAuthClient } from './mediaPipeline';

/**
 * Daily Drive -> YouTube drain.
 *
 * Member videos are uploaded to Google Drive first (the browser never talks
 * to YouTube) and are listed on their event like any other video. This job
 * moves them to the YouTube channel up to whatever daily upload limit
 * YouTube allows: it uploads one video at a time, and the first time YouTube
 * says "blocked" (upload limit / quota / auth) it stops for the run — no
 * retries of the blocked call, no further attempts until the next scheduled
 * run. After each successful upload the event's video URL is swapped to the
 * YouTube link and the Drive copy is deleted, so Drive only ever holds the
 * not-yet-transferred backlog.
 */

const EVENTS_COLLECTION = 'events';
const STATUS_DOC = 'systemConfig/youtubeDrain';
// Cloud Run's request timeout is 1800s; stop starting new videos well before it.
const TIME_BUDGET_MS = 25 * 60 * 1000;
// Non-limit failures (e.g. a corrupt file) skip that video; stop the run only
// if several fail back-to-back, which points at something systemic.
const MAX_CONSECUTIVE_FAILURES = 3;

export interface DrainResult {
  moved: number;
  failed: number;
  skipped: number;
  remaining: number;
  blocked: boolean;
  blockedReason?: string;
  timeBudgetHit: boolean;
  alreadyRunning?: boolean;
}

/** Drive file id from a Drive-hosted video URL, or null for anything else (YouTube, Firebase Storage, ...). */
export function extractDriveFileId(url: string | undefined | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const low = url.toLowerCase();
  const isDriveHost = low.includes('googleusercontent.com/') || low.includes('drive.google.com/') || low.startsWith('/api/media/image/');
  if (!isDriveHost) return null;
  const match = url.match(/(?:\/d\/|\/api\/media\/image\/|[?&]id=)([a-zA-Z0-9_-]{20,})/);
  return match ? match[1] : null;
}

/**
 * True when YouTube's answer means "stop trying for now" rather than "this
 * one video is bad": the channel's daily upload limit, API quota, or a
 * credential problem. Retrying any of these just burns quota and fails again.
 */
export function isYouTubeBlockedError(err: any): boolean {
  const reasons: string[] = [];
  for (const e of err?.errors || []) if (e?.reason) reasons.push(String(e.reason));
  for (const e of err?.response?.data?.error?.errors || []) if (e?.reason) reasons.push(String(e.reason));
  const blockedReasons = ['uploadLimitExceeded', 'quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded', 'forbidden', 'authError', 'unauthorized'];
  if (reasons.some((r) => blockedReasons.includes(r))) return true;

  const msg = String(err?.message || err?.response?.data?.error?.message || '').toLowerCase();
  if (msg.includes('exceeded the number of videos') || msg.includes('quota') || msg.includes('invalid_grant') || msg.includes('unauthorized')) {
    return true;
  }
  return err?.code === 401 || err?.code === 403;
}

let drainRunning = false;

interface Candidate {
  eventId: string;
  eventTitle: string;
  url: string;
  fileId: string;
  createdAt: string;
}

/** Drive links in the gallery's image list that are really videos (reverse-synced ones carry a #type=video / #name=*.mp4 marker). */
function isDriveVideoLink(url: string): boolean {
  const low = url.toLowerCase();
  return low.includes('#type=video') || /#name=.*.(mp4|webm|mov|m4v|avi|mkv)$/.test(low);
}

/**
 * Every Drive-hosted video on one event: any Drive link in the video list
 * (what the upload page writes), plus Drive links in the image list that are
 * marked as videos (older reverse-synced entries).
 */
export function findDriveVideoUrls(data: any): Array<{ url: string; fileId: string; source: 'youtubeVideoUrls' | 'driveImageUrls' }> {
  const out: Array<{ url: string; fileId: string; source: 'youtubeVideoUrls' | 'driveImageUrls' }> = [];
  const seen = new Set<string>();
  const videoUrls: string[] = [
    ...(Array.isArray(data?.youtubeVideoUrls) ? data.youtubeVideoUrls : []),
    ...(data?.youtubeVideoUrl ? [data.youtubeVideoUrl] : []),
  ];
  for (const url of videoUrls) {
    const fileId = typeof url === 'string' ? extractDriveFileId(url) : null;
    if (fileId && !seen.has(url)) {
      seen.add(url);
      out.push({ url, fileId, source: 'youtubeVideoUrls' });
    }
  }
  for (const url of Array.isArray(data?.driveImageUrls) ? data.driveImageUrls : []) {
    if (typeof url !== 'string' || seen.has(url) || !isDriveVideoLink(url)) continue;
    const fileId = extractDriveFileId(url);
    if (fileId) {
      seen.add(url);
      out.push({ url, fileId, source: 'driveImageUrls' });
    }
  }
  return out;
}

/**
 * The Firestore update that replaces oldUrl with newUrl on an event, or null
 * if oldUrl is no longer on it. A YouTube link always lives in the video list,
 * so a video found in the image list is moved across.
 */
export function buildVideoUrlSwap(data: any, oldUrl: string, newUrl: string): Record<string, unknown> | null {
  const videos: string[] = Array.isArray(data?.youtubeVideoUrls) ? data.youtubeVideoUrls : [];
  const images: string[] = Array.isArray(data?.driveImageUrls) ? data.driveImageUrls : [];
  const inVideos = videos.includes(oldUrl);
  const isSingle = data?.youtubeVideoUrl === oldUrl;
  const inImages = images.includes(oldUrl);
  if (!inVideos && !isSingle && !inImages) return null;

  const nextVideos = Array.from(new Set([...videos.map((u) => (u === oldUrl ? newUrl : u)), ...(inVideos ? [] : [newUrl])]));
  const update: Record<string, unknown> = {
    youtubeVideoUrls: nextVideos,
    youtubeVideoUrl: isSingle ? newUrl : data?.youtubeVideoUrl || nextVideos[0] || '',
  };
  if (inImages) update.driveImageUrls = images.filter((u) => u !== oldUrl);
  return update;
}

async function collectCandidates(db: Firestore): Promise<Candidate[]> {
  const snap = await db.collection(EVENTS_COLLECTION).get();
  const out: Candidate[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as any;
    for (const { url, fileId } of findDriveVideoUrls(data)) {
      out.push({ eventId: doc.id, eventTitle: String(data.title || 'Event'), url, fileId, createdAt: String(data.createdAt || '') });
    }
  }
  // Oldest events first so the backlog drains in upload order.
  out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return out;
}

export interface DrivePreview {
  eventsScanned: number;
  waiting: number;
  bySource: Record<string, number>;
  drive?: {
    videoFiles: number;
    totalMB: number;
    linkedToEvents: number;
    notLinkedToEvents: number;
    notLinkedByFolder: Array<{ folder: string; count: number; files: string[] }>;
  };
  driveScanError?: string;
}

/** Video files sitting in the portal's Drive folders (the root and its event subfolders). */
async function listPortalDriveVideos(drive: any): Promise<Array<{ id: string; name: string; size: number; folder: string }>> {
  const rootId = await getDriveRootFolderId();
  if (!rootId) return [];

  const folders: Array<{ id: string; name: string }> = [{ id: rootId, name: '(root)' }];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'nextPageToken, files(id, name)',
      pageSize: 1000,
      pageToken,
    });
    for (const f of res.data.files || []) folders.push({ id: f.id, name: f.name || f.id });
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  const out: Array<{ id: string; name: string; size: number; folder: string }> = [];
  for (const folder of folders) {
    pageToken = undefined;
    do {
      const res = await drive.files.list({
        q: `'${folder.id}' in parents and mimeType contains 'video/' and trashed = false`,
        fields: 'nextPageToken, files(id, name, size)',
        pageSize: 1000,
        pageToken,
      });
      for (const f of res.data.files || []) out.push({ id: f.id, name: f.name || f.id, size: Number(f.size || 0), folder: folder.name });
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
  }
  return out;
}

/** Counts what the drain would move, without uploading or changing anything. */
export async function previewDriveVideoBacklog(db: Firestore): Promise<DrivePreview> {
  const snap = await db.collection(EVENTS_COLLECTION).get();
  const bySource: Record<string, number> = { youtubeVideoUrls: 0, driveImageUrls: 0 };
  const linkedIds = new Set<string>();
  let waiting = 0;
  for (const doc of snap.docs) {
    const data = doc.data() as any;
    for (const { source } of findDriveVideoUrls(data)) {
      bySource[source]++;
      waiting++;
    }
    for (const u of [...(data.youtubeVideoUrls || []), ...(data.youtubeVideoUrl ? [data.youtubeVideoUrl] : []), ...(data.driveImageUrls || [])]) {
      const id = extractDriveFileId(u);
      if (id) linkedIds.add(id);
    }
  }

  const preview: DrivePreview = { eventsScanned: snap.size, waiting, bySource };
  try {
    const drive = google.drive({ version: 'v3', auth: await getDriveAuthClient() });
    const files = await listPortalDriveVideos(drive);
    const unlinked = files.filter((f) => !linkedIds.has(f.id));
    const byFolder = new Map<string, string[]>();
    for (const f of unlinked) byFolder.set(f.folder, [...(byFolder.get(f.folder) || []), f.name]);
    preview.drive = {
      videoFiles: files.length,
      totalMB: Math.round(files.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024)),
      linkedToEvents: files.length - unlinked.length,
      notLinkedToEvents: unlinked.length,
      notLinkedByFolder: [...byFolder.entries()].map(([folder, names]) => ({ folder, count: names.length, files: names.slice(0, 5) })),
    };
  } catch (err: any) {
    preview.driveScanError = err?.message || String(err);
  }
  return preview;
}

/** Swaps oldUrl for newUrl in the event's video fields. Returns false if oldUrl is no longer on the event. */
async function replaceEventVideoUrl(db: Firestore, eventId: string, oldUrl: string, newUrl: string): Promise<boolean> {
  const ref = db.collection(EVENTS_COLLECTION).doc(eventId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const update = buildVideoUrlSwap(snap.data(), oldUrl, newUrl);
    if (!update) return false;
    tx.update(ref, update);
    return true;
  });
}

async function writeStatus(db: Firestore, result: DrainResult): Promise<void> {
  try {
    await db.doc(STATUS_DOC).set(
      {
        lastRunAt: new Date().toISOString(),
        lastResult: result,
        ...(result.blocked ? { lastBlockedAt: new Date().toISOString(), lastBlockedReason: result.blockedReason || '' } : {}),
      },
      { merge: true }
    );
  } catch (err: any) {
    serverLogger.warn(`[YT Drain] Could not write status doc: ${err?.message || err}`);
  }
}

export async function drainDriveVideosToYouTube(db: Firestore): Promise<DrainResult> {
  if (drainRunning) {
    return { moved: 0, failed: 0, skipped: 0, remaining: 0, blocked: false, timeBudgetHit: false, alreadyRunning: true };
  }
  drainRunning = true;

  const startedAt = Date.now();
  const result: DrainResult = { moved: 0, failed: 0, skipped: 0, remaining: 0, blocked: false, timeBudgetHit: false };

  try {
    const candidates = await collectCandidates(db);
    const driveAuth = await getDriveAuthClient();
    const drive = google.drive({ version: 'v3', auth: driveAuth });
    const youtube = google.youtube({ version: 'v3', auth: getYouTubeOAuthClient() });

    serverLogger.info(`[YT Drain] ${candidates.length} Drive video(s) waiting to move to YouTube.`);

    let consecutiveFailures = 0;

    for (const cand of candidates) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        result.timeBudgetHit = true;
        break;
      }

      let stream: NodeJS.ReadableStream | undefined;
      let inYouTubeCall = false;
      try {
        let meta: { name?: string | null; mimeType?: string | null; size?: string | null };
        try {
          meta = (await drive.files.get({ fileId: cand.fileId, fields: 'id,name,mimeType,size' })).data;
        } catch (metaErr: any) {
          if (metaErr?.code === 404) {
            serverLogger.warn(`[YT Drain] Drive file ${cand.fileId} (event ${cand.eventId}) no longer exists; skipping.`);
            result.skipped++;
            continue;
          }
          throw metaErr;
        }
        if (!meta.mimeType || !meta.mimeType.startsWith('video/')) {
          serverLogger.warn(`[YT Drain] Drive file ${cand.fileId} is not a video (${meta.mimeType}); skipping.`);
          result.skipped++;
          continue;
        }

        const sizeMB = meta.size ? (Number(meta.size) / (1024 * 1024)).toFixed(1) : 'unknown';
        const baseName = String(meta.name || '').replace(/\.[^/.]+$/, '');
        const title = `${cand.eventTitle}${baseName ? ` - ${baseName}` : ''}`.substring(0, 95);
        serverLogger.info(`[YT Drain] Uploading "${meta.name}" (${sizeMB} MB) from event "${cand.eventTitle}" to YouTube...`);

        const media = await drive.files.get({ fileId: cand.fileId, alt: 'media' }, { responseType: 'stream' });
        stream = media.data as unknown as NodeJS.ReadableStream;

        inYouTubeCall = true;
        const response = await (youtube.videos.insert as any)({
          part: 'snippet,status',
          requestBody: {
            snippet: {
              title,
              description: `Team Taraba River Community Event Media Archive (${cand.eventTitle})\nUploaded via Team Taraba River Portal.`,
              tags: ['Team Taraba River', 'Community', 'URIP', 'USOSA', 'Event'],
              categoryId: '22',
            },
            status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false },
          },
          media: { mimeType: meta.mimeType, body: stream },
        });

        inYouTubeCall = false;
        const videoId = response?.data?.id;
        if (!videoId) throw new Error('YouTube upload completed but returned no video ID.');
        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

        const replaced = await replaceEventVideoUrl(db, cand.eventId, cand.url, youtubeUrl);
        if (!replaced) {
          // The video was removed from the event while it uploaded (e.g. moved
          // to the recycle bin, which still points at the Drive file). Keep
          // the Drive file so that restore still works.
          serverLogger.warn(`[YT Drain] ${youtubeUrl} uploaded but event ${cand.eventId} no longer lists the Drive video; keeping the Drive copy.`);
          result.skipped++;
          consecutiveFailures = 0;
          continue;
        }

        try {
          await drive.files.delete({ fileId: cand.fileId });
        } catch (delErr: any) {
          serverLogger.warn(`[YT Drain] Moved to ${youtubeUrl} but could not delete Drive file ${cand.fileId}: ${delErr?.message || delErr}`);
        }

        serverLogger.info(`[YT Drain] ✅ Moved to ${youtubeUrl}`);
        result.moved++;
        consecutiveFailures = 0;
      } catch (err: any) {
        try { (stream as any)?.destroy?.(); } catch {}
        const detail = err?.errors?.[0]?.message || err?.response?.data?.error?.message || err?.message || String(err);

        if (inYouTubeCall && isYouTubeBlockedError(err)) {
          result.blocked = true;
          result.blockedReason = detail;
          serverLogger.warn(`[YT Drain] YouTube is blocking uploads (${detail}). Stopping until the next run.`);
          break;
        }

        result.failed++;
        consecutiveFailures++;
        serverLogger.error(`[YT Drain] Failed to move Drive file ${cand.fileId} (event ${cand.eventId}): ${detail}`);
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          serverLogger.warn(`[YT Drain] ${consecutiveFailures} failures in a row; stopping this run.`);
          break;
        }
      }
    }

    result.remaining = candidates.length - result.moved;
    await writeStatus(db, result);
    return result;
  } finally {
    drainRunning = false;
  }
}
