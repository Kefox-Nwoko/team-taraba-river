import { google } from 'googleapis';
import type { Firestore } from 'firebase-admin/firestore';
import { serverLogger } from './logger';
import { isChapterEvent } from '../src/utils/eventUtils';
import { getDriveAuthClient, getDriveRootFolderId, getYouTubeOAuthClient } from './mediaPipeline';

/**
 * Drive -> YouTube transfer.
 *
 * Member videos are uploaded to Google Drive first (the browser never talks
 * to YouTube). This job moves them to the YouTube channel up to whatever
 * daily upload limit YouTube allows: one video at a time, and the first time
 * YouTube says "blocked" (upload limit / quota / auth) it stops for the run —
 * no retries of the blocked call, no further attempts until the next run.
 *
 * Videos on Drive are grouped by their file checksum, so byte-identical
 * copies (retried uploads, repeated sessions) become ONE video: it is
 * uploaded once, attached to its event, and only then are all identical
 * copies deleted from Drive.
 *
 * Safety rules, in order:
 *  - a video referenced by a photo approval (pending or rejected) or by the
 *    recycle bin is never touched — it is waiting on a human decision;
 *  - a video an event already links to is swapped for its YouTube link;
 *  - an unlinked video is only attached to an event when its Drive folder
 *    name (`<date> - <title>`) matches exactly one event; otherwise it is
 *    left alone and listed in the report;
 *  - files newer than NEW_FILE_GRACE_MS are left alone, so a batch that is
 *    still registering its event is never raced;
 *  - nothing is deleted until YouTube returned a video id AND the event
 *    update succeeded.
 */

const EVENTS_COLLECTION = 'events';
const PHOTO_REQUESTS_COLLECTION = 'photoRequests';
const RECYCLE_BIN_COLLECTION = 'recycleBin';
const STATUS_DOC = 'systemConfig/youtubeDrain';
const ROOT_LABEL = '(root)';
const ELSEWHERE_LABEL = '(linked from an event, outside the portal folders)';
const MB = 1024 * 1024;
// Cloud Run's request timeout is 1800s; stop starting new videos well before it.
const TIME_BUDGET_MS = 25 * 60 * 1000;
// Non-limit failures (e.g. a corrupt file) skip that video; stop the run only
// if several fail back-to-back, which points at something systemic.
const MAX_CONSECUTIVE_FAILURES = 3;
// An unlinked file this young may belong to a batch that is still uploading.
const NEW_FILE_GRACE_MS = 12 * 60 * 60 * 1000;
const REPORT_LIST_LIMIT = 30;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DriveFileRow {
  id: string;
  name: string;
  size: number;
  md5?: string;
  createdTime: string;
  folder: string;
}

export interface EventLite {
  id: string;
  title: string;
  date?: string;
  /**
   * True for media folders/galleries, false for calendar announcements (chapter
   * events). Media only ever attaches to a media folder: announcements are
   * purged the day after the event, so a video attached to one would be lost.
   */
  isMediaFolder: boolean;
}

export type EventLink = { eventId: string; url: string };

export type PlanAction = 'move-linked' | 'move-orphan' | 'held' | 'too-new' | 'unmatched' | 'ambiguous';

export interface PlanGroup {
  key: string;
  name: string;
  sizeMB: number;
  files: DriveFileRow[];
  action: PlanAction;
  reason: string;
  links: EventLink[];
  eventId?: string;
  eventTitle?: string;
}

export interface DrainResult {
  moved: number;
  failed: number;
  duplicatesRemoved: number;
  driveFreedMB: number;
  /** Distinct videos still on Drive that the job can transfer (not held / unmatched). */
  waiting: number;
  held: number;
  unmatched: number;
  ambiguous: number;
  tooNew: number;
  blocked: boolean;
  blockedReason?: string;
  timeBudgetHit: boolean;
  stoppedReason?: string;
  alreadyRunning?: boolean;
  movedVideos: Array<{ name: string; event: string; youtubeUrl: string; copiesRemoved: number }>;
  failures: Array<{ name: string; reason: string }>;
  attention: Array<{ name: string; copies: number; folders: string[]; issue: string }>;
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

/** Drive file id from a Drive-hosted URL, or null for anything else (YouTube, Firebase Storage, ...). */
export function extractDriveFileId(url: string | undefined | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const low = url.toLowerCase();
  const isDriveHost = low.includes('googleusercontent.com/') || low.includes('drive.google.com/') || low.startsWith('/api/media/image/');
  if (!isDriveHost) return null;
  const match = url.match(/(?:\/d\/|\/api\/media\/image\/|[?&]id=)([a-zA-Z0-9_-]{20,})/);
  return match ? match[1] : null;
}

/** Every Drive file id mentioned anywhere in a block of text (e.g. a JSON-stringified document). */
export function extractAllDriveFileIds(text: string): string[] {
  const ids = new Set<string>();
  const re = /(?:googleusercontent\.com\/d\/|drive\.google\.com\/(?:file\/d\/|uc\?[^"\s]*id=|open\?id=)|\/api\/media\/image\/)([a-zA-Z0-9_-]{20,})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) ids.add(m[1]);
  return [...ids];
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

/** Every Drive-hosted link on one event, from the video list, the single-video field and the image list. */
export function findEventDriveLinks(data: any): Array<{ url: string; fileId: string }> {
  const out: Array<{ url: string; fileId: string }> = [];
  const seen = new Set<string>();
  const urls: unknown[] = [
    ...(Array.isArray(data?.youtubeVideoUrls) ? data.youtubeVideoUrls : []),
    ...(data?.youtubeVideoUrl ? [data.youtubeVideoUrl] : []),
    ...(Array.isArray(data?.driveImageUrls) ? data.driveImageUrls : []),
  ];
  for (const url of urls) {
    if (typeof url !== 'string' || seen.has(url)) continue;
    const fileId = extractDriveFileId(url);
    if (fileId) {
      seen.add(url);
      out.push({ url, fileId });
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

/** The update that adds a YouTube link to an event that did not list the video before. */
export function buildVideoUrlAttach(data: any, newUrl: string): Record<string, unknown> {
  const videos: string[] = Array.isArray(data?.youtubeVideoUrls) ? data.youtubeVideoUrls : [];
  const nextVideos = Array.from(new Set([...videos, newUrl]));
  return { youtubeVideoUrls: nextVideos, youtubeVideoUrl: data?.youtubeVideoUrl || nextVideos[0] };
}

/** "2026-09-26 - The Confluence Jersey Party" -> "the confluence jersey party". */
export function normalizeFolderTitle(name: string): string {
  return String(name || '')
    .replace(/^\s*\d{4}-\d{2}-\d{2}\s*[-–—:]?\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function folderDate(name: string): string | null {
  const m = String(name || '').match(/^\s*(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** The one event a Drive folder belongs to, `ambiguous` if several fit equally, or nothing. */
export function matchEventForFolder(folder: string, events: EventLite[]): { event?: EventLite; ambiguous?: boolean } {
  if (folder === ROOT_LABEL || folder === ELSEWHERE_LABEL) return {};
  const title = normalizeFolderTitle(folder);
  if (!title) return {};
  const same = events.filter((e) => normalizeFolderTitle(e.title) === title);
  if (same.length === 1) return { event: same[0] };
  if (same.length > 1) {
    const date = folderDate(folder);
    const byDate = date ? same.filter((e) => String(e.date || '').slice(0, 10) === date) : [];
    if (byDate.length === 1) return { event: byDate[0] };
    return { ambiguous: true };
  }
  return {};
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Decides what to do with every video on Drive. Files are grouped by
 * checksum so identical copies form one group; see the module comment for
 * the rules. Actionable groups come first (event-linked, then unlinked,
 * oldest first), followed by the ones that need a human or more time.
 */
export function planDriveVideos(input: {
  files: DriveFileRow[];
  links: Map<string, EventLink[]>;
  protectedIds: Set<string>;
  events: EventLite[];
  now: number;
  graceMs: number;
}): PlanGroup[] {
  const byKey = new Map<string, DriveFileRow[]>();
  for (const f of input.files) {
    const key = f.md5 ? `md5:${f.md5}` : `id:${f.id}`;
    byKey.set(key, [...(byKey.get(key) || []), f]);
  }

  const eventTitle = (id: string) => input.events.find((e) => e.id === id)?.title;
  const mediaFolders = input.events.filter((e) => e.isMediaFolder);
  const groups: PlanGroup[] = [];

  for (const [key, files] of byKey) {
    files.sort((a, b) => a.createdTime.localeCompare(b.createdTime));
    const seenLinks = new Set<string>();
    const links: EventLink[] = [];
    for (const f of files) {
      for (const l of input.links.get(f.id) || []) {
        const k = `${l.eventId}|${l.url}`;
        if (!seenLinks.has(k)) {
          seenLinks.add(k);
          links.push(l);
        }
      }
    }
    const base = { key, name: files[0].name, sizeMB: round1(files[0].size / MB), files, links };

    if (files.some((f) => input.protectedIds.has(f.id))) {
      groups.push({ ...base, action: 'held', reason: 'Referenced by a photo approval or the recycle bin; waiting for an admin decision.' });
      continue;
    }

    if (links.length > 0) {
      groups.push({ ...base, action: 'move-linked', reason: 'Linked to an event.', eventId: links[0].eventId, eventTitle: eventTitle(links[0].eventId) });
      continue;
    }

    if (files.some((f) => input.now - Date.parse(f.createdTime) < input.graceMs)) {
      groups.push({ ...base, action: 'too-new', reason: 'Uploaded in the last 12 hours; leaving it in case its batch is still registering.' });
      continue;
    }

    const matched = new Map<string, EventLite>();
    let ambiguous = false;
    for (const f of files) {
      const m = matchEventForFolder(f.folder, mediaFolders);
      if (m.event) matched.set(m.event.id, m.event);
      if (m.ambiguous) ambiguous = true;
    }
    if (matched.size === 1 && !ambiguous) {
      const ev = [...matched.values()][0];
      groups.push({ ...base, action: 'move-orphan', reason: `Not linked to an event; its folder matches "${ev.title}".`, eventId: ev.id, eventTitle: ev.title });
    } else if (matched.size > 1 || ambiguous) {
      groups.push({ ...base, action: 'ambiguous', reason: 'Its folder could belong to more than one event.' });
    } else {
      groups.push({ ...base, action: 'unmatched', reason: 'Not linked to an event and its folder matches no event title.' });
    }
  }

  const rank: Record<PlanAction, number> = { 'move-linked': 0, 'move-orphan': 1, held: 2, 'too-new': 2, ambiguous: 2, unmatched: 2 };
  groups.sort((a, b) => rank[a.action] - rank[b.action] || a.files[0].createdTime.localeCompare(b.files[0].createdTime));
  return groups;
}

const escapeHtml = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The email sent after a transfer session. */
export function buildDrainReportEmail(result: DrainResult): { subject: string; html: string } {
  const bits: string[] = [];
  if (result.moved) bits.push(`${result.moved} moved to YouTube`);
  if (result.duplicatesRemoved) bits.push(`${result.duplicatesRemoved} duplicate${result.duplicatesRemoved === 1 ? '' : 's'} removed`);
  if (result.failed) bits.push(`${result.failed} failed`);
  const subject = `YouTube transfer report: ${bits.join(', ') || 'no changes'}`;

  const li = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : '');
  const movedList = li(
    result.movedVideos.map(
      (v) => `${escapeHtml(v.name)} &rarr; <a href="${escapeHtml(v.youtubeUrl)}">${escapeHtml(v.youtubeUrl)}</a> (event: ${escapeHtml(v.event)}; ${v.copiesRemoved} Drive cop${v.copiesRemoved === 1 ? 'y' : 'ies'} removed)`
    )
  );
  const failureList = li(result.failures.map((f) => `${escapeHtml(f.name)}: ${escapeHtml(f.reason)}`));
  const attentionList = li(result.attention.map((a) => `${escapeHtml(a.name)} (${a.copies} cop${a.copies === 1 ? 'y' : 'ies'}; folder: ${escapeHtml(a.folders.join(', '))}) &mdash; ${escapeHtml(a.issue)}`));

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1e293b;max-width:640px">
  <h2 style="margin:0 0 12px">YouTube transfer report</h2>
  <p><b>${result.moved}</b> video${result.moved === 1 ? '' : 's'} moved to YouTube &middot; <b>${result.duplicatesRemoved}</b> duplicate Drive cop${result.duplicatesRemoved === 1 ? 'y' : 'ies'} removed &middot; <b>${result.driveFreedMB} MB</b> freed on Drive &middot; <b>${result.failed}</b> failed</p>
  <p><b>${result.waiting}</b> video${result.waiting === 1 ? '' : 's'} still waiting on Drive to be transferred.</p>
  ${result.blocked ? `<p style="background:#fef3c7;padding:8px 12px;border-radius:6px">YouTube stopped accepting uploads for now (${escapeHtml(result.blockedReason || 'daily limit')}). The next scheduled run will continue from here.</p>` : ''}
  ${result.timeBudgetHit ? '<p>This session ran out of time; the next scheduled run will continue.</p>' : ''}
  ${result.stoppedReason ? `<p style="background:#fee2e2;padding:8px 12px;border-radius:6px">Stopped early: ${escapeHtml(result.stoppedReason)}</p>` : ''}
  ${movedList ? `<h3>Moved</h3>${movedList}` : ''}
  ${failureList ? `<h3>Failed</h3>${failureList}` : ''}
  ${attentionList ? `<h3>Needs your attention (left untouched on Drive)</h3>${attentionList}` : ''}
</div>`;
  return { subject, html };
}

// ---------------------------------------------------------------------------
// Drive / Firestore access
// ---------------------------------------------------------------------------

let drainRunning = false;

/** The portal's Drive root folder plus its immediate subfolders (one per event). */
async function listPortalFolders(drive: any): Promise<Array<{ id: string; name: string }>> {
  const rootId = await getDriveRootFolderId();
  if (!rootId) return [];
  const folders: Array<{ id: string; name: string }> = [{ id: rootId, name: ROOT_LABEL }];
  let pageToken: string | undefined;
  do {
    const res: any = await drive.files.list({
      q: `'${rootId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'nextPageToken, files(id, name)',
      pageSize: 1000,
      pageToken,
    });
    for (const f of res.data.files || []) folders.push({ id: f.id, name: f.name || f.id });
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);
  return folders;
}

async function listFilesInFolders(drive: any, folders: Array<{ id: string; name: string }>, kind: 'video' | 'image'): Promise<DriveFileRow[]> {
  const out: DriveFileRow[] = [];
  for (const folder of folders) {
    let pageToken: string | undefined;
    do {
      const res: any = await drive.files.list({
        q: `'${folder.id}' in parents and mimeType contains '${kind}/' and trashed = false`,
        fields: 'nextPageToken, files(id, name, size, md5Checksum, createdTime)',
        pageSize: 1000,
        pageToken,
      });
      for (const f of res.data.files || []) {
        out.push({ id: f.id, name: f.name || f.id, size: Number(f.size || 0), md5: f.md5Checksum || undefined, createdTime: f.createdTime || '', folder: folder.name });
      }
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
  }
  return out;
}

interface TransferContext {
  events: EventLite[];
  links: Map<string, EventLink[]>;
  protectedIds: Set<string>;
  files: DriveFileRow[];
  folders: Array<{ id: string; name: string }>;
}

async function loadTransferContext(db: Firestore, drive: any): Promise<TransferContext> {
  const events: EventLite[] = [];
  const links = new Map<string, EventLink[]>();
  const eventsSnap = await db.collection(EVENTS_COLLECTION).get();
  for (const doc of eventsSnap.docs) {
    const data = doc.data() as any;
    events.push({ id: doc.id, title: String(data.title || 'Event'), date: data.date ? String(data.date) : undefined, isMediaFolder: !isChapterEvent({ id: doc.id } as any) });
    for (const { url, fileId } of findEventDriveLinks(data)) links.set(fileId, [...(links.get(fileId) || []), { eventId: doc.id, url }]);
  }

  // Anything a human still has to decide about: approvals (any status) and the recycle bin.
  const protectedIds = new Set<string>();
  for (const collection of [PHOTO_REQUESTS_COLLECTION, RECYCLE_BIN_COLLECTION]) {
    const snap = await db.collection(collection).get();
    for (const doc of snap.docs) for (const id of extractAllDriveFileIds(JSON.stringify(doc.data()))) protectedIds.add(id);
  }

  const folders = await listPortalFolders(drive);
  const files = await listFilesInFolders(drive, folders, 'video');

  // Videos an event links to that live outside the portal folders still count.
  const listed = new Set(files.map((f) => f.id));
  for (const id of links.keys()) {
    if (listed.has(id)) continue;
    try {
      const meta = (await drive.files.get({ fileId: id, fields: 'id,name,size,md5Checksum,createdTime,mimeType,trashed' })).data;
      if (meta.mimeType?.startsWith('video/') && !meta.trashed) {
        files.push({ id, name: meta.name || id, size: Number(meta.size || 0), md5: meta.md5Checksum || undefined, createdTime: meta.createdTime || '', folder: ELSEWHERE_LABEL });
      }
    } catch (err: any) {
      if (err?.code !== 404) serverLogger.warn(`[YT Drain] Could not look up linked Drive file ${id}: ${err?.message || err}`);
    }
  }

  return { events, links, protectedIds, files, folders };
}

async function applyToEvent(db: Firestore, eventId: string, build: (data: any) => Record<string, unknown> | null): Promise<boolean> {
  const ref = db.collection(EVENTS_COLLECTION).doc(eventId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const update = build(snap.data());
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

async function sendReport(result: DrainResult): Promise<void> {
  if (!result.moved && !result.failed && !result.duplicatesRemoved && !result.stoppedReason) return;
  try {
    const { sendEmail } = await import('./emailService');
    const { subject, html } = buildDrainReportEmail(result);
    await sendEmail({ subject, html });
  } catch (err: any) {
    serverLogger.warn(`[YT Drain] Could not send the transfer report email: ${err?.message || err}`);
  }
}

// ---------------------------------------------------------------------------
// Dry run
// ---------------------------------------------------------------------------

/** What the next run would do, plus a read-only housekeeping report. Changes nothing. */
export async function previewTransferPlan(db: Firestore) {
  const drive = google.drive({ version: 'v3', auth: await getDriveAuthClient() });
  const ctx = await loadTransferContext(db, drive);
  const plan = planDriveVideos({ files: ctx.files, links: ctx.links, protectedIds: ctx.protectedIds, events: ctx.events, now: Date.now(), graceMs: NEW_FILE_GRACE_MS });

  const byAction: Record<string, number> = {};
  for (const g of plan) byAction[g.action] = (byAction[g.action] || 0) + 1;

  // Housekeeping (report only): same-event folders under different names, and identical photos.
  const folderGroups = new Map<string, string[]>();
  for (const f of ctx.folders) {
    if (f.name === ROOT_LABEL) continue;
    const key = normalizeFolderTitle(f.name);
    folderGroups.set(key, [...(folderGroups.get(key) || []), f.name]);
  }
  const images = await listFilesInFolders(drive, ctx.folders, 'image');
  const imageGroups = new Map<string, DriveFileRow[]>();
  for (const f of images) {
    if (!f.md5) continue;
    imageGroups.set(f.md5, [...(imageGroups.get(f.md5) || []), f]);
  }
  const dupImageGroups = [...imageGroups.values()].filter((g) => g.length > 1);

  return {
    eventsScanned: ctx.events.length,
    videoFilesOnDrive: ctx.files.length,
    distinctVideos: plan.length,
    duplicateVideoCopies: ctx.files.length - plan.length,
    totalVideoMB: Math.round(ctx.files.reduce((s, f) => s + f.size, 0) / MB),
    byAction,
    groups: plan.slice(0, 60).map((g) => ({
      name: g.name,
      copies: g.files.length,
      sizeMB: g.sizeMB,
      folders: [...new Set(g.files.map((f) => f.folder))],
      action: g.action,
      event: g.eventTitle,
      eventId: g.eventId,
      reason: g.reason,
    })),
    housekeeping: {
      duplicateFolders: [...folderGroups.entries()].filter(([, names]) => names.length > 1).map(([title, names]) => ({ title, folders: names })),
      photos: {
        photoFiles: images.length,
        identicalGroups: dupImageGroups.length,
        extraCopies: dupImageGroups.reduce((s, g) => s + g.length - 1, 0),
        wastedMB: Math.round(dupImageGroups.reduce((s, g) => s + g[0].size * (g.length - 1), 0) / MB),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// The transfer run
// ---------------------------------------------------------------------------

export async function drainDriveVideosToYouTube(db: Firestore): Promise<DrainResult> {
  const result: DrainResult = {
    moved: 0, failed: 0, duplicatesRemoved: 0, driveFreedMB: 0, waiting: 0, held: 0, unmatched: 0, ambiguous: 0, tooNew: 0,
    blocked: false, timeBudgetHit: false, movedVideos: [], failures: [], attention: [],
  };
  if (drainRunning) return { ...result, alreadyRunning: true };
  drainRunning = true;

  const startedAt = Date.now();
  let freedBytes = 0;

  try {
    const drive = google.drive({ version: 'v3', auth: await getDriveAuthClient() });
    const youtube = google.youtube({ version: 'v3', auth: getYouTubeOAuthClient() });
    const ctx = await loadTransferContext(db, drive);
    const plan = planDriveVideos({ files: ctx.files, links: ctx.links, protectedIds: ctx.protectedIds, events: ctx.events, now: Date.now(), graceMs: NEW_FILE_GRACE_MS });

    for (const g of plan) {
      if (g.action === 'held') result.held++;
      else if (g.action === 'unmatched') result.unmatched++;
      else if (g.action === 'ambiguous') result.ambiguous++;
      else if (g.action === 'too-new') result.tooNew++;
      if (!g.action.startsWith('move') && result.attention.length < REPORT_LIST_LIMIT) {
        result.attention.push({ name: g.name, copies: g.files.length, folders: [...new Set(g.files.map((f) => f.folder))], issue: g.reason });
      }
    }

    const actionable = plan.filter((g) => g.action === 'move-linked' || g.action === 'move-orphan');
    serverLogger.info(`[YT Drain] ${ctx.files.length} video file(s) on Drive = ${plan.length} distinct video(s); ${actionable.length} ready to transfer.`);

    let consecutiveFailures = 0;
    let done = 0;

    for (const group of actionable) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        result.timeBudgetHit = true;
        break;
      }

      let stream: NodeJS.ReadableStream | undefined;
      let inYouTubeCall = false;
      let youtubeUrl = '';
      try {
        // Source: the first copy that still exists.
        let source: { id: string; mimeType: string } | undefined;
        for (const f of group.files) {
          try {
            const meta = (await drive.files.get({ fileId: f.id, fields: 'id,mimeType,trashed' })).data;
            if (!meta.trashed && meta.mimeType?.startsWith('video/')) {
              source = { id: f.id, mimeType: meta.mimeType };
              break;
            }
          } catch (metaErr: any) {
            if (metaErr?.code !== 404) throw metaErr;
          }
        }
        if (!source) throw new Error('No readable copy of this video was found on Drive.');

        const eventTitle = group.eventTitle || 'Event';
        const baseName = group.name.replace(/\.[^/.]+$/, '');
        const title = `${eventTitle}${baseName ? ` - ${baseName}` : ''}`.substring(0, 95);
        serverLogger.info(`[YT Drain] Uploading "${group.name}" (${group.sizeMB} MB, ${group.files.length} cop${group.files.length === 1 ? 'y' : 'ies'}) for event "${eventTitle}"...`);

        const media = await drive.files.get({ fileId: source.id, alt: 'media' }, { responseType: 'stream' });
        stream = media.data as unknown as NodeJS.ReadableStream;

        inYouTubeCall = true;
        const response = await (youtube.videos.insert as any)({
          part: 'snippet,status',
          requestBody: {
            snippet: {
              title,
              description: `Team Taraba River Community Event Media Archive (${eventTitle})\nUploaded via Team Taraba River Portal.`,
              tags: ['Team Taraba River', 'Community', 'URIP', 'USOSA', 'Event'],
              categoryId: '22',
            },
            status: { privacyStatus: 'unlisted', selfDeclaredMadeForKids: false },
          },
          media: { mimeType: source.mimeType, body: stream },
        });
        inYouTubeCall = false;

        const videoId = response?.data?.id;
        if (!videoId) throw new Error('YouTube upload completed but returned no video ID.');
        youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

        // Point the event(s) at YouTube BEFORE anything is deleted.
        let applied = 0;
        if (group.action === 'move-linked') {
          for (const link of group.links) {
            if (await applyToEvent(db, link.eventId, (data) => buildVideoUrlSwap(data, link.url, youtubeUrl))) applied++;
          }
        } else if (group.eventId) {
          if (await applyToEvent(db, group.eventId, (data) => buildVideoUrlAttach(data, youtubeUrl))) applied++;
        }

        if (applied === 0) {
          // The event vanished or dropped the video mid-run; keep every Drive copy.
          // The next plan will see these files as unlinked and re-evaluate them.
          result.failed++;
          result.failures.push({ name: group.name, reason: `Uploaded to ${youtubeUrl} but no event could be updated; the Drive copies were kept.` });
          result.stoppedReason = 'A video reached YouTube but its event could not be updated. Stopped to avoid uploading it again.';
          break;
        }

        let removed = 0;
        for (const f of group.files) {
          try {
            await drive.files.delete({ fileId: f.id });
            removed++;
            freedBytes += f.size;
          } catch (delErr: any) {
            if (delErr?.code === 404) removed++;
            else serverLogger.warn(`[YT Drain] Moved to ${youtubeUrl} but could not delete Drive file ${f.id}: ${delErr?.message || delErr}`);
          }
        }

        serverLogger.info(`[YT Drain] ✅ "${group.name}" -> ${youtubeUrl} (${removed} Drive cop${removed === 1 ? 'y' : 'ies'} removed)`);
        result.moved++;
        result.duplicatesRemoved += Math.max(0, removed - 1);
        if (result.movedVideos.length < REPORT_LIST_LIMIT) {
          result.movedVideos.push({ name: group.name, event: eventTitle, youtubeUrl, copiesRemoved: removed });
        }
        consecutiveFailures = 0;
        done++;
      } catch (err: any) {
        try { (stream as any)?.destroy?.(); } catch {}
        const detail = err?.errors?.[0]?.message || err?.response?.data?.error?.message || err?.message || String(err);

        if (youtubeUrl) {
          // Uploaded, but a later step threw: never re-upload automatically.
          result.failed++;
          result.failures.push({ name: group.name, reason: `Uploaded to ${youtubeUrl} but a later step failed (${detail}); the Drive copies were kept.` });
          result.stoppedReason = 'A video reached YouTube but the follow-up step failed. Stopped to avoid uploading it again.';
          break;
        }

        if (inYouTubeCall && isYouTubeBlockedError(err)) {
          result.blocked = true;
          result.blockedReason = detail;
          serverLogger.warn(`[YT Drain] YouTube is blocking uploads (${detail}). Stopping until the next run.`);
          break;
        }

        result.failed++;
        consecutiveFailures++;
        if (result.failures.length < REPORT_LIST_LIMIT) result.failures.push({ name: group.name, reason: detail });
        serverLogger.error(`[YT Drain] Failed to move "${group.name}": ${detail}`);
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          result.stoppedReason = `${consecutiveFailures} failures in a row; stopped this run.`;
          serverLogger.warn(`[YT Drain] ${result.stoppedReason}`);
          break;
        }
      }
    }

    result.driveFreedMB = Math.round(freedBytes / MB);
    result.waiting = actionable.length - done;
    await writeStatus(db, result);
    await sendReport(result);
    return result;
  } finally {
    drainRunning = false;
  }
}
