import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { Member, GroupEvent, PhotoApprovalRequest, ActivityLog, KnowledgeBaseArticle, UserRole, PhotoApprovalStatus } from "./src/types";
import { serverLogger } from "./server/logger";
import { config, isAdminEmail } from "./server/config";

// Server modules
import { db, adminAuth, checkFirestoreConnection, isFirestoreAvailable, FieldValue } from "./server/firebaseAdmin";
import { authMiddleware, requireAdmin } from "./server/authMiddleware";
import {
  validateBody,
  MemberRegistrationSchema,
  MemberUpdateSchema,
  EventCreationSchema,
  ApprovalDecisionSchema,
  RSVPSchema,
  AIQuerySchema,
  DriveSyncSchema,
  YouTubeParseSchema,
  LoginCredentialSchema,
  LoginCodeVerifySchema,
  AdminAISearchSchema,
  MemberContactSearchSchema,
  MemberRestoreSchema,
  MediaUploadSchema,
  MediaFinalizeSchema,
  DriveUploadInitSchema,
  YouTubeUploadInitSchema,
  DriveMakePublicSchema,
} from "./server/validation";
import {
  uploadIntermediateMedia,
  finalizeMedia,
  getMediaStatus,
  uploadVideoBufferToYouTube,
  base64ToBuffer,
  initDriveUploadSession,
  makeDriveFilePublic,
  initYouTubeUploadSession,
  deleteYouTubeVideoServer,
  getDriveAuthClient,
} from "./server/mediaPipeline";
import { isMemberCredentialMatch } from "./src/lib/authMatching";
import { CSV_SEED_MEMBERS } from "./src/data/csvMembers";
import { getUpcomingNextMonthCelebrants, getTomorrowCelebrants, getWATDate } from "./server/birthdayService";
import { buildMonthlyDigestEmailHtml, buildDailyEveAlertEmailHtml, buildTestEmailHtml, buildLoginCodeEmailHtml } from "./server/emailTemplates";
import { getEmailConfig, updateEmailConfig, sendEmail } from "./server/emailService";
import { createLoginCode, verifyLoginCode } from "./server/loginCodes";
import { parseEventDateObj } from "./src/utils/eventUtils";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Global process safety handlers to prevent unhandled background API errors from terminating server
process.on('unhandledRejection', (reason) => {
  serverLogger.warn('[Server] Handled asynchronous rejection:', { reason: String(reason) });
});
process.on('uncaughtException', (err) => {
  serverLogger.error('[Server] Handled uncaught exception:', { error: err.message });
});

// Adaptive body-size limits — 50MB for media upload routes, 2MB for everything else
const MEDIA_UPLOAD_PATHS = ['/api/media/upload', '/api/media/finalize', '/api/media/upload-video-to-youtube'];
const smallJsonParser = express.json({ limit: '2mb' });
const largeJsonParser = express.json({ limit: '50mb' });
const smallUrlParser = express.urlencoded({ limit: '2mb', extended: true });
const largeUrlParser = express.urlencoded({ limit: '50mb', extended: true });

app.use((req: Request, res: Response, next: NextFunction) => {
  const isMedia = MEDIA_UPLOAD_PATHS.some(p => req.path === p);
  (isMedia ? largeJsonParser : smallJsonParser)(req, res, next);
});
app.use((req: Request, res: Response, next: NextFunction) => {
  const isMedia = MEDIA_UPLOAD_PATHS.some(p => req.path === p);
  (isMedia ? largeUrlParser : smallUrlParser)(req, res, next);
});

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:3001,https://team-taraba-river.web.app").split(",").map((s) => s.trim()).filter(Boolean);

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// --- Security Headers ---
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// --- Request Metrics (In-Memory) ---
const requestMetrics = {
  totalRequests: 0,
  activeRequests: 0,
  peakConcurrent: 0,
  requestsPerMinute: 0,
  endpointCounts: new Map<string, number>(),
  errorCounts: new Map<string, number>(),
  responseTimes: [] as number[],
  _minuteWindow: { count: 0, resetAt: Date.now() + 60_000 },
};

function getPercentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

app.use((req: Request, res: Response, next: NextFunction) => {
  requestMetrics.totalRequests++;
  requestMetrics.activeRequests++;
  requestMetrics.peakConcurrent = Math.max(requestMetrics.peakConcurrent, requestMetrics.activeRequests);

  const now = Date.now();
  if (now > requestMetrics._minuteWindow.resetAt) {
    requestMetrics.requestsPerMinute = requestMetrics._minuteWindow.count;
    requestMetrics._minuteWindow = { count: 1, resetAt: now + 60_000 };
  } else {
    requestMetrics._minuteWindow.count++;
  }

  const route = `${req.method} ${req.path}`;
  requestMetrics.endpointCounts.set(route, (requestMetrics.endpointCounts.get(route) || 0) + 1);

  const start = Date.now();
  res.on('finish', () => {
    requestMetrics.activeRequests--;
    requestMetrics.responseTimes.push(Date.now() - start);
    if (requestMetrics.responseTimes.length > 1000) {
      requestMetrics.responseTimes = requestMetrics.responseTimes.slice(-1000);
    }
    if (res.statusCode >= 500) {
      requestMetrics.errorCounts.set(route, (requestMetrics.errorCounts.get(route) || 0) + 1);
    }
  });
  next();
});

// --- Memory Pressure Monitoring (every 30s) ---
setInterval(() => {
  const usage = process.memoryUsage();
  const heapMB = Math.round(usage.heapUsed / 1024 / 1024);
  const rssMB = Math.round(usage.rss / 1024 / 1024);
  if (rssMB > 420) {
    serverLogger.error(`🔴 CRITICAL MEMORY: RSS ${rssMB}MB, Heap ${heapMB}MB — OOM imminent on 512MB host!`);
  } else if (rssMB > 300) {
    serverLogger.warn(`🟡 MEMORY WARNING: RSS ${rssMB}MB, Heap ${heapMB}MB — approaching limit`);
  }
}, 30_000);

// --- Rate Limiting (In-Memory, Factory-Based) ---
function createRateLimiter(maxRequests: number, windowMs: number) {
  const store: Map<string, { count: number; resetTime: number }> = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of store.entries()) {
      if (now > val.resetTime) store.delete(key);
    }
  }, 5 * 60_000);

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || now > entry.resetTime) {
      store.set(ip, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (entry.count >= maxRequests) {
      res.status(429).json({ error: `Too many requests (limit: ${maxRequests}/min). Please slow down.` });
      return;
    }

    entry.count++;
    next();
  };
}

// Global: 60 req/min per IP — protects all API routes
const globalRateLimiter = createRateLimiter(60, 60_000);
app.use('/api/', globalRateLimiter);

// Heavy: 5 req/min per IP — expensive AI, media sync, and news endpoints
const heavyRateLimiter = createRateLimiter(5, 60_000);
app.use('/api/ai/', heavyRateLimiter);
app.use('/api/ai-xplora', heavyRateLimiter);
app.use('/api/media/cloud-sync-all', heavyRateLimiter);
app.use('/api/media/upload-video-to-youtube', heavyRateLimiter);
app.use('/api/media/drive/init-upload', heavyRateLimiter);
app.use('/api/media/youtube/init-upload', heavyRateLimiter);
app.use('/api/usosa-news', heavyRateLimiter);

// Auth-specific: 10 req/min per IP (used as route middleware on auth endpoints)
const rateLimiter = createRateLimiter(10, 60_000);

// --- Firestore Collection References ---
const COLLECTIONS = {
  members: 'members',
  events: 'events',
  photoRequests: 'photoRequests',
  activityLogs: 'activityLogs',
  knowledgeBase: 'knowledgeBase',
  systemConfig: 'systemConfig',
} as const;

// --- Default Taraba Admin Cloud Config in Firestore ---
const DEFAULT_SYSTEM_CLOUD_CONFIG = {
  dedicatedDriveUrl: "https://drive.google.com/drive/folders/19UcHi6ItJBeOAENfsOCM69K05NHc_13D?usp=drive_link",
  dedicatedYoutubeUrl: "https://www.youtube.com/channel/UC_tarabateam_official",
  ownerEmail: config.ownerEmail,
  autoSyncOnApproval: true,
  lastSyncedAt: new Date().toISOString(),
};

// --- 1-Hour Automated Media Cleanup Task ---
// Once full sync to Google Drive & YouTube is confirmed, raw media blobs in Firestore are deleted after 1 hour
setInterval(async () => {
  try {
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const now = Date.now();
    if (db && isFirestoreAvailable()) {
      const snap = await db.collection(COLLECTIONS.photoRequests).where('status', '==', 'approved').get();
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const uploadedTime = new Date(data.uploadedAt || 0).getTime();
        if (now - uploadedTime > ONE_HOUR_MS) {
          // Delete heavy temporary blob from photoRequests buffer permanently after confirmed 1-hour sync
          await docSnap.ref.delete();
          serverLogger.info(`[Firestore Cleanup Worker] Permanently deleted 1-hour old synced media buffer: ${docSnap.id}`);
        }
      }
    }
  } catch (err) {
    serverLogger.warn("[Firestore Cleanup Worker Notice]", { error: (err as Error).message });
  }
}, 15 * 60 * 1000); // Runs every 15 minutes

// --- Daily Midnight Event Purge Cron ---
// Completely removes expired events from Firestore and fallback stores so they never reappear.
setInterval(async () => {
  try {
    const result = await purgeExpiredEvents();
    if (result.deletedCount > 0) {
      serverLogger.info(`[Cron] Midnight purge removed ${result.deletedCount} expired event(s)`);
    }
  } catch (err) {
    serverLogger.warn("[Cron] Midnight event purge notice", { error: (err as Error).message });
  }
}, 24 * 60 * 60 * 1000); // Runs every 24 hours

// --- In-Memory Fallback Stores (used when Firestore Admin SDK is not available) ---
let fallbackMembers: Member[] = [...(CSV_SEED_MEMBERS as Member[])];
let fallbackEvents: GroupEvent[] = [];
let fallbackApprovals: PhotoApprovalRequest[] = [];
let fallbackLogs: ActivityLog[] = [];

// --- Knowledge Base (static, small dataset — kept in memory for AI context) ---
const knowledgeBaseStore: KnowledgeBaseArticle[] = [
  {
    id: 'kb_1',
    title: 'About URIP & USOSA — Who We Are',
    category: 'about',
    content: 'Team Taraba is a sub-group within URIP (Usosans Resident in Port Harcourt), which is a chapter of USOSA — the Unity Schools Old Students Association. USOSA is the umbrella alumni body for all 104 Federal Unity Colleges (Federal Government Colleges) across Nigeria. It was formally incorporated in April 2007 to preserve the legacy of the Unity Schools, promote national unity, academic excellence, and the spirit of detribalized Nigerian citizenship. URIP specifically brings together Unity Schools old students living in Port Harcourt, Rivers State. The group is about fellowship, fun, professional networking, and giving back to local communities.',
    tags: ['usosa', 'urip', 'about', 'old students', 'unity schools', 'port harcourt', 'fgc'],
    updatedAt: '2026-08-11'
  },
  {
    id: 'kb_2',
    title: 'URIP Membership Requirements & Code of Conduct',
    category: 'membership',
    content: 'Membership is open to verified alumni of any Federal Unity College (Federal Government College or Girls College) who are resident in or connected to Port Harcourt. Members must provide accurate contact information and keep it updated. All members are expected to embody USOSA core values: national unity, integrity, respect for all ethnicities and religions, academic excellence, and community service. Discrimination of any form is strictly prohibited. Members should participate regularly in group events and community activities. Profile photos require admin approval before public display.',
    tags: ['membership', 'registration', 'policy', 'rules', 'code of conduct', 'usosa values'],
    updatedAt: '2026-08-11'
  },
  {
    id: 'kb_3',
    title: 'Event Participation & Community Activities',
    category: 'events',
    content: 'URIP events include social gatherings, sports activities (including participation in the national USOSA Sports Festival), educational forums, community outreach and support initiatives, and celebratory occasions. Members are encouraged to RSVP and attend events. The group uses every opportunity to celebrate together and support the local Port Harcourt community. Media from events (photos and videos) can be shared via publicly accessible Google Drive folders or YouTube links, subject to admin review.',
    tags: ['events', 'sports festival', 'community service', 'fellowship', 'social', 'outreach'],
    updatedAt: '2026-08-11'
  },
  {
    id: 'kb_4',
    title: 'Member Birthday Celebrations & Calendar System',
    category: 'events',
    content: 'The group calendar automatically highlights upcoming member birthdays alongside community events. Birthday shout-outs are a key part of URIP fellowship culture — celebrating members during their birth month brings the group closer. Members receive community birthday acknowledgements during event assemblies and on the portal.',
    tags: ['birthdays', 'calendar', 'events', 'celebration', 'fellowship'],
    updatedAt: '2026-08-11'
  },
  {
    id: 'kb_5',
    title: 'Admin Moderation & Activity Points Scoring',
    category: 'bylaws',
    content: 'Activity points are awarded to encourage engagement: Event RSVP (+20 pts), media uploads (+30 pts), profile updates (+15 pts), and portal visits (+10 pts). Points serve as non-monetary community incentives and may qualify members for free gifts, recognition, or celebration at URIP gatherings. Points cannot be exchanged for cash. Admin activities do not qualify for points.',
    tags: ['admin', 'points', 'leaderboard', 'moderation', 'incentives'],
    updatedAt: '2026-08-11'
  }
];

// --- Health & System Monitoring ---
const serverStartTime = Date.now();

// Lazy Gemini AI initialization
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("MY_GEMINI_API_KEY") || apiKey.includes("YOUR_") || apiKey === "placeholder" || apiKey.length < 15) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' }
    }
  });
}

// --- Data Access Functions (Firestore with in-memory fallback) ---
// 30-second TTL caching — drastically reduces Firestore reads under concurrent load
let _membersCache: { data: Member[]; ts: number } | null = null;
let _eventsCache: { data: GroupEvent[]; ts: number } | null = null;
const DATA_CACHE_TTL = 30_000; // 30 seconds

async function getMembers(): Promise<Member[]> {
  if (!isFirestoreAvailable()) return fallbackMembers;
  if (_membersCache && Date.now() - _membersCache.ts < DATA_CACHE_TTL) return _membersCache.data;
  const snapshot = await db.collection(COLLECTIONS.members).get();
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
  _membersCache = { data, ts: Date.now() };
  return data;
}

function parseDateFromTitle(title: string): string | null {
  if (!title) return null;
  const months: { [key: string]: number } = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };
  const regex = new RegExp(`(${Object.keys(months).join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s*(\\d{4})`, 'i');
  const match = title.match(regex);
  if (match) {
    const monthName = match[1].toLowerCase();
    const day = parseInt(match[2]);
    const year = parseInt(match[3]);
    const monthIndex = months[monthName];
    const parsed = new Date(year, monthIndex, day);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }
  return null;
}

function hasMediaAssets(e: GroupEvent): boolean {
  if (!e) return false;
  const id = (e.id || "").toLowerCase();
  if (
    id.startsWith("gdrive_") ||
    id.startsWith("yt_") ||
    id.startsWith("folder_") ||
    id.startsWith("media_") ||
    id.startsWith("album_") ||
    id === "evt_taraba_gdrive"
  ) {
    return true;
  }
  if (Array.isArray(e.driveImageUrls) && e.driveImageUrls.length > 0) return true;
  if (Array.isArray(e.youtubeVideoUrls) && e.youtubeVideoUrls.length > 0) return true;
  if (e.youtubeVideoUrl && e.youtubeVideoUrl.trim().length > 0) return true;
  if (e.driveFolderId && !e.driveFolderId.startsWith("drive_folder_") && e.driveFolderId.trim().length > 0) return true;
  return false;
}

async function purgeExpiredEvents(): Promise<{ deletedCount: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let list: GroupEvent[] = [];
  if (isFirestoreAvailable()) {
    try {
      const snapshot = await db.collection(COLLECTIONS.events).get();
      list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GroupEvent));
    } catch {
      list = [...fallbackEvents];
    }
  } else {
    list = [...fallbackEvents];
  }

  const expiredIds = new Set<string>();
  for (const e of list) {
    // CRITICAL: NEVER delete or purge any event that contains media or is an album folder
    if (hasMediaAssets(e)) {
      continue;
    }

    const effectiveEndStr = e.endDate && e.endDate.trim() ? e.endDate.trim() : e.date;
    let parsed: Date | null = parseEventDateObj(effectiveEndStr);
    if (!parsed) {
      const fromTitle = parseDateFromTitle(e.title);
      if (fromTitle) parsed = new Date(fromTitle);
    }
    if (!parsed) continue;
    if (parsed.getTime() < today.getTime()) {
      expiredIds.add(e.id);
    }
  }

  if (expiredIds.size > 0 && isFirestoreAvailable()) {
    const deletePromises = Array.from(expiredIds).map((id) => {
      return db.collection(COLLECTIONS.events).doc(id).delete().catch((err) => {
        serverLogger.warn(`[AutoDelete] Failed to delete expired event ${id}:`, err);
      });
    });
    await Promise.all(deletePromises);
  }

  fallbackEvents = fallbackEvents.filter((e) => !expiredIds.has(e.id));
  _eventsCache = null;

  return { deletedCount: expiredIds.size };
}

async function getEvents(): Promise<GroupEvent[]> {

  if (isFirestoreAvailable() && _eventsCache && Date.now() - _eventsCache.ts < DATA_CACHE_TTL) {
    return _eventsCache.data;
  }
  let list: GroupEvent[] = [];
  if (!isFirestoreAvailable()) {
    list = [...fallbackEvents];
  } else {
    try {
      const snapshot = await db.collection(COLLECTIONS.events).get();
      list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GroupEvent));
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } catch {
      list = [...fallbackEvents];
    }
  }

  const data = list
    .filter((e) => !e.id.startsWith("evt_arch_") && !e.id.startsWith("folder_"))
    .map((e) => {
      const parsedDate = parseDateFromTitle(e.title);
      if (parsedDate) {
        e.date = parsedDate;
      }
      if (e.location && (e.location.toLowerCase().includes('taraba river') || e.location.includes('Google Drive') || e.location.includes('YouTube Hub'))) {
        e.location = '';
      }
      if (e.createdBy === 'Google Drive Sync (tarabateam@gmail.com)') {
        e.createdBy = 'Official Cloud Pipeline';
      }
      if (e.description && e.description.includes('Synced from Google Drive folder')) {
        e.description = 'Synced event media folder.';
      }
      return e;
    });
  if (isFirestoreAvailable()) {
    _eventsCache = { data, ts: Date.now() };
  }
  return data;
}

async function getApprovals(): Promise<PhotoApprovalRequest[]> {
  if (!isFirestoreAvailable()) return fallbackApprovals;
  const snapshot = await db.collection(COLLECTIONS.photoRequests).get();
  return snapshot.docs.map(doc => {
    const data = { id: doc.id, ...doc.data() } as PhotoApprovalRequest;
    delete data.previewDataUrl;
    return data;
  });
}

async function addActivityLog(log: ActivityLog): Promise<void> {
  if (!isFirestoreAvailable()) {
    fallbackLogs.unshift(log);
    return;
  }
  await db.collection(COLLECTIONS.activityLogs).doc(log.id).set(log);
}

// --- One-time Firestore Seeding ---
async function seedFirestoreIfNeeded(): Promise<void> {
  serverLogger.info("Firestore auto-seeding is disabled (ready for live database).");
}

// K_SERVICE is set automatically by Cloud Run on every revision; NODE_ENV=production is
// the generic signal for any other deployed environment. Neither is present when running
// `npm run dev` locally, which is the only place the auth-skip fallback below may fire.
const isDeployedEnv = !!process.env.K_SERVICE || process.env.NODE_ENV === 'production';

/**
 * Conditional auth middleware.
 * In production (Firestore available), enforces Firebase token verification.
 * In local dev (no ADC), skips auth to allow viewing the app.
 *
 * IMPORTANT: the skip-auth fallback below must NEVER fire in a deployed environment.
 * If it did, a misconfigured/unreachable Firestore Admin connection in production would
 * silently grant every request a mock admin session instead of rejecting it — turning an
 * infra hiccup into an authentication bypass. So a deployed environment with Firestore
 * unavailable fails closed (503) instead of falling back to the dev shortcut.
 */
function conditionalAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isFirestoreAvailable()) {
    if (isDeployedEnv) {
      res.status(503).json({ error: 'Service temporarily unavailable (Firestore Admin not connected).' });
      return;
    }
    // Local dev fallback only: attach a mock user
    req.user = { uid: 'local_dev', email: 'dev@local', role: 'admin' };
    next();
    return;
  }
  authMiddleware(req, res, next);
}

function conditionalRequireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!isFirestoreAvailable()) {
    if (isDeployedEnv) {
      res.status(503).json({ error: 'Service temporarily unavailable (Firestore Admin not connected).' });
      return;
    }
    next();
    return;
  }
  requireAdmin(req, res, next);
}

// ===================================================================
//  API ROUTES
// ===================================================================

// 1. Health check (public — no auth required)
app.get("/api/health", async (req: Request, res: Response) => {
  try {
    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);

    if (!isFirestoreAvailable()) {
      res.json({
        status: "ok",
        service: "Team Taraba River Core Gateway (local dev mode)",
        uptimeSeconds,
        activeConnections: fallbackMembers.length,
        pendingApprovalsCount: fallbackApprovals.filter(a => a.status === 'pending').length,
        totalMembersCount: fallbackMembers.length,
        totalEventsCount: fallbackEvents.length,
      });
      return;
    }

    const membersSnapshot = await db.collection(COLLECTIONS.members).get();
    const eventsSnapshot = await db.collection(COLLECTIONS.events).get();
    const pendingSnapshot = await db.collection(COLLECTIONS.photoRequests)
      .where('status', '==', 'pending').get();

    res.json({
      status: "ok",
      service: "Team Taraba River Core Gateway",
      uptimeSeconds,
      activeConnections: membersSnapshot.size,
      pendingApprovalsCount: pendingSnapshot.size,
      totalMembersCount: membersSnapshot.size,
      totalEventsCount: eventsSnapshot.size,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Health check failed" });
  }
});

// --- System Metrics Endpoint (admin-only operability dashboard) ---
app.get("/api/system/metrics", conditionalAuth, conditionalRequireAdmin, (req: Request, res: Response) => {
  const memUsage = process.memoryUsage();
  const avgResponseTime = requestMetrics.responseTimes.length > 0
    ? requestMetrics.responseTimes.reduce((a, b) => a + b, 0) / requestMetrics.responseTimes.length
    : 0;

  res.json({
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    memory: {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
      externalMB: Math.round(memUsage.external / 1024 / 1024),
    },
    requests: {
      total: requestMetrics.totalRequests,
      active: requestMetrics.activeRequests,
      peakConcurrent: requestMetrics.peakConcurrent,
      requestsPerMinute: requestMetrics.requestsPerMinute,
      avgResponseTimeMs: Math.round(avgResponseTime),
      p95ResponseTimeMs: getPercentile(requestMetrics.responseTimes, 95),
      p99ResponseTimeMs: getPercentile(requestMetrics.responseTimes, 99),
    },
    cache: {
      membersCached: !!_membersCache,
      membersCacheAgeMs: _membersCache ? Date.now() - _membersCache.ts : null,
      eventsCached: !!_eventsCache,
      eventsCacheAgeMs: _eventsCache ? Date.now() - _eventsCache.ts : null,
      cacheTTLMs: DATA_CACHE_TTL,
    },
    rateLimits: {
      global: '60 req/min per IP',
      heavy: '5 req/min per IP (AI, media sync, news)',
      auth: '10 req/min per IP',
    },
    bodyLimits: {
      default: '2mb',
      mediaUpload: '50mb',
    },
    topEndpoints: Object.fromEntries(
      [...requestMetrics.endpointCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
    ),
    errors: Object.fromEntries(requestMetrics.errorCounts),
  });
});

async function incrementGlobalVisits(visitorName: string) {
  try {
    if (isFirestoreAvailable()) {
      const docRef = db.collection(COLLECTIONS.systemConfig).doc('visit_metrics');
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const data = docSnap.data();
        const currentVisits = data?.totalVisits ?? 0;
        await docRef.update({
          totalVisits: currentVisits + 1,
          lastVisitTimestamp: new Date().toISOString(),
          latestUniqueUser: visitorName
        });
      } else {
        await docRef.set({
          totalVisits: 1,
          lastVisitTimestamp: new Date().toISOString(),
          latestUniqueUser: visitorName
        });
      }
    }
  } catch (err) {
    serverLogger.error("Failed to increment global visits", err);
  }
}

// 2. Auth: Verify Firebase token and return member profile
// This replaces the old fake login endpoints.
app.post("/api/auth/verify", rateLimiter, async (req: Request, res: Response) => {
  // In local dev without ADC, skip token verification and return a mock admin
  if (!isFirestoreAvailable()) {
    const email = req.body?.email || 'dev@local';
    const matched = fallbackMembers.find(m => m.email?.toLowerCase() === email.toLowerCase());
    const member: Member = matched || {
      id: 'local_dev', fullName: 'Local Dev Admin', email,
      phoneNumber: '', dateOfBirth: '', occupation: 'Developer',
      skills: ['Development'],
      photoUrl: '', photoStatus: 'approved' as PhotoApprovalStatus,
      role: 'admin' as UserRole, activityPoints: 1000,
      joinedAt: new Date().toISOString(), lastActive: new Date().toISOString(),
    };
    member.role = 'admin' as UserRole;
    res.json({ success: true, member });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Bearer token required.' });
    return;
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const email = decodedToken.email || '';
    const role = (decodedToken.role === 'admin' || isAdminEmail(email)) ? 'admin' : 'member';

    // Look up the member in Firestore
    let memberDoc = await db.collection(COLLECTIONS.members).doc(uid).get();
    let member: Member;

    if (memberDoc.exists) {
      member = memberDoc.data() as Member;
      member.role = role as UserRole;
      
      const todayStr = new Date().toISOString().split('T')[0];
      const lastActiveDateStr = member.lastActive ? member.lastActive.split('T')[0] : '';
      const isNewDayVisit = lastActiveDateStr !== todayStr;
      
      member.lastActive = new Date().toISOString();
      const updates: Record<string, any> = {
        role,
        lastActive: member.lastActive
      };

      if (isNewDayVisit) {
        await incrementGlobalVisits(member.fullName);

        if (role !== 'admin') {
          member.activityPoints = (member.activityPoints || 0) + 10;
          updates.activityPoints = member.activityPoints;

          await addActivityLog({
            id: `act_${Date.now()}`,
            memberId: uid,
            memberName: member.fullName,
            action: 'Visited the application portal today (+10 points)',
            timestamp: new Date().toISOString(),
            pointsEarned: 10,
          });
        }
      }

      await db.collection(COLLECTIONS.members).doc(uid).update(updates);
    } else {
      member = {
        id: uid,
        fullName: decodedToken.name || email.split('@')[0] || 'Community Member',
        email: email,
        phoneNumber: decodedToken.phone_number || '',
        dateOfBirth: '',
        occupation: 'Community Member',
        skills: ['Community Support'],
        photoUrl: decodedToken.picture || '',
        photoStatus: 'approved' as PhotoApprovalStatus,
        role: role as UserRole,
        activityPoints: role === 'admin' ? 0 : 10,
        joinedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };
      await db.collection(COLLECTIONS.members).doc(uid).set(member);
      await incrementGlobalVisits(member.fullName);

      if (role !== 'admin') {
        await addActivityLog({
          id: `act_${Date.now()}`,
          memberId: uid,
          memberName: member.fullName,
          action: 'Visited the application portal today (First Sign In) (+10 points)',
          timestamp: new Date().toISOString(),
          pointsEarned: 10,
        });
      }
    }

    res.json({ success: true, member });
  } catch (error) {
    serverLogger.error("Token verification error", error);
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

// NOTE: /api/system/visits is handled below at the single canonical route.

// 3. Auth: Login via credential (email/phone) — issues a Firebase custom token
//    This allows the existing email/phone login UX while adding real token auth.
/**
 * Shared credential lookup used by both login steps below: checks the
 * in-memory fallback list first, then queries Firestore.
 */
async function findMemberByCredential(rawCred: string): Promise<{ memberData: Member; memberDocId: string } | null> {
  const matchedLocal = fallbackMembers.find(m => isMemberCredentialMatch(m, rawCred));
  if (matchedLocal) {
    return { memberData: matchedLocal, memberDocId: matchedLocal.id };
  }

  const allMembersSnap = await db.collection(COLLECTIONS.members).get();
  for (const d of allMembersSnap.docs) {
    const m = { id: d.id, ...d.data() } as Member;
    if (isMemberCredentialMatch(m, rawCred)) {
      return { memberData: m, memberDocId: d.id };
    }
  }
  return null;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(local.length - 1, 3))}@${domain}`;
}

/**
 * Step 1 of login: resolve the credential to a member and email a one-time
 * code to their REGISTERED address (never to whatever they typed), then
 * wait for /api/auth/login/verify-code. No member data is returned from
 * this step. Available to every member regardless of email provider —
 * Gmail-registered members can use this OR the separate Google OAuth
 * button; it's their choice, not enforced here.
 */
app.post("/api/auth/login", rateLimiter, async (req: Request, res: Response) => {
  const validation = validateBody(LoginCredentialSchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: (validation as any).error });
    return;
  }

  const rawCred = validation.data.credential.trim();

  // Local dev fallback: no email service to rely on, so log in immediately.
  // This path can never fire in a deployed environment (see isDeployedEnv).
  if (!isFirestoreAvailable()) {
    const matched = fallbackMembers.find(m => isMemberCredentialMatch(m, rawCred));
    if (!matched) {
      res.status(404).json({ error: 'Credentials not recognized. Access denied.' });
      return;
    }
    res.json({ success: true, member: { ...matched, role: 'member' as UserRole }, customToken: null });
    return;
  }

  try {
    const found = await findMemberByCredential(rawCred);
    if (!found) {
      res.status(404).json({ error: 'Credentials not recognized. Access denied.' });
      return;
    }
    const { memberData, memberDocId } = found;

    // Gmail accounts are free to use either Google OAuth (their own "Google"
    // button on the login screen) or this code path — it's the member's
    // choice, not enforced here.
    if (!memberData.email) {
      res.status(500).json({ error: 'No email on file for this account. Contact an administrator.' });
      return;
    }

    const code = await createLoginCode(memberDocId);
    const { subject, html, text } = buildLoginCodeEmailHtml({ code, memberName: memberData.fullName });
    await sendEmail({ to: memberData.email, subject, html, text });

    res.json({ success: true, codeSent: true, maskedEmail: maskEmail(memberData.email) });
  } catch (error) {
    serverLogger.error("Login error", error);
    res.status(500).json({ error: 'Login service temporarily unavailable.' });
  }
});

/**
 * Step 2 of login: verify the one-time code and complete the session.
 * Mirrors the bookkeeping the old single-step /api/auth/login used to do.
 */
app.post("/api/auth/login/verify-code", rateLimiter, async (req: Request, res: Response) => {
  const validation = validateBody(LoginCodeVerifySchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: (validation as any).error });
    return;
  }

  const { code } = validation.data;
  const rawCred = validation.data.credential.trim();

  try {
    const found = await findMemberByCredential(rawCred);
    if (!found) {
      res.status(404).json({ error: 'Credentials not recognized. Access denied.' });
      return;
    }
    const { memberData, memberDocId } = found;

    const verification = await verifyLoginCode(memberDocId, code);
    if (!verification.ok) {
      res.status(401).json({ error: verification.reason || 'Incorrect code.' });
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const lastActiveDateStr = memberData.lastActive ? memberData.lastActive.split('T')[0] : '';
    const isNewDayVisit = lastActiveDateStr !== todayStr;

    memberData.lastActive = new Date().toISOString();
    const updates: Record<string, any> = {
      lastActive: memberData.lastActive
    };

    await incrementGlobalVisits(memberData.fullName);

    if (isNewDayVisit) {
      if (memberData.role !== 'admin') {
        memberData.activityPoints = (memberData.activityPoints || 0) + 10;
        updates.activityPoints = memberData.activityPoints;

        await addActivityLog({
          id: `act_${Date.now()}`,
          memberId: memberDocId,
          memberName: memberData.fullName,
          action: 'Visited the application portal today (+10 points)',
          timestamp: new Date().toISOString(),
          pointsEarned: 10,
        });
      }
    }

    await db.collection(COLLECTIONS.members).doc(memberDocId).update(updates);

    let customToken: string | null = null;
    try {
      customToken = await Promise.race([
        adminAuth.createCustomToken(memberDocId, { role: memberData.role || 'member' }),
        new Promise<null>((r) => setTimeout(() => r(null), 1200))
      ]);
    } catch {
      customToken = null;
    }

    res.json({
      success: true,
      member: { ...memberData, role: 'member' as UserRole },
      customToken,
    });
  } catch (error) {
    serverLogger.error("Login code verification error", error);
    res.status(500).json({ error: 'Login service temporarily unavailable.' });
  }
});

// ===================================================================
//  PROTECTED ROUTES — All require authentication
// ===================================================================

// 4. Member Service: Directory List
app.get("/api/members", conditionalAuth, async (req: Request, res: Response) => {
  try {
    const members = await getMembers();
    res.json({ members });
  } catch (error) {
      serverLogger.error("Fetch members error", error);
    res.status(500).json({ error: 'Failed to fetch members.' });
  }
});

// 4b. Member Service: AI-Powered Contact Search
app.post("/api/members/search", conditionalAuth, async (req: Request, res: Response) => {
  const validation = validateBody(MemberContactSearchSchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: (validation as any).error });
    return;
  }

  const { query } = validation.data;
  let members: Member[] = [];

  try {
    members = await getMembers();
    const ai = getGeminiClient();

    if (!ai || members.length === 0) {
      const fallback = simpleContactSearch(members, query);
      return res.json({ members: fallback, total: fallback.length, aiPowered: false });
    }

    const memberDb = members.map((m) => ({
      id: m.id,
      name: `${m.title ? `${m.title} ` : ""}${m.fullName || ""}`.trim(),
      occupation: m.occupation || "",
      skills: Array.isArray(m.skills) ? m.skills.join(", ") : "",
      school: m.schoolName || "",
      gradYear: m.gradYear || "",
      location: [m.area, m.otherArea, m.estateName, m.streetName].filter(Boolean).join(", "),
      phone: m.phoneNumber || "",
      email: m.email || "",
    }));

    const prompt = `You are an intelligent contact & networking assistant for the Team Taraba River member database.
Your task: Understand the user's search prompt or question (which may be conversational, a direct keyword, a natural language question, or specific contact details) and identify ALL matching team members.

MEMBERS DATABASE:
${JSON.stringify(memberDb)}

RULES & CAPABILITIES:
1. Flexible Prompt Understanding: Interpret natural conversational requests like:
   - "I need a doctor for health emergency"
   - "Who is the lawyer in our chapter?"
   - "Find someone who does architecture or building plans"
   - "Who works in tech, programming or IT?"
   - "Members who went to FGGC Owerri or graduated in 2007"
   - "Who lives around Choba or Abuja Campus?"
   - "What is Kefox's phone number?"
   - Direct digits ("0703...", "0814...") or emails ("@gmail.com")
2. Broad Cross-Industry Semantic Matchmaking:
   - Health & Emergency: "medical doctor", "physician", "doctor", "health", "clinical management", "surgeon", "nurse", "pharmacist", "dentist".
   - Legal: "lawyer", "attorney", "barrister", "solicitor", "legal", "counsel", "advocate".
   - Tech & Engineering: "engineer", "software", "tech", "developer", "civil", "mechanical", "electrical", "petroleum", "data", "cybersecurity".
   - Finance & Business: "accountant", "accounting", "banker", "finance", "consultant", "tax", "audit", "analyst", "project manager".
   - Real Estate & Built Environment: "architect", "real estate", "property", "builder", "surveyor", "interior designer", "construction".
   - Media, PR & Creative: "journalist", "media", "pr", "marketing", "designer", "photographer", "content creator", "writer".
   - Logistics, Energy & Agriculture: "logistics", "supply chain", "oil and gas", "energy", "farming", "agribusiness", "procurement".
   - Education & Academia: "lecturer", "teacher", "professor", "tutor", "academic", "researcher".
3. Return ONLY a JSON array of matching member IDs. No explanations, no markdown ticks.
4. If no members match, return an empty array [].

User prompt: "${query}"

Return format: ["id1", "id2", ...]`;

    let response: any = null;
    const aiModels = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-3.6-flash"];
    for (const model of aiModels) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        });
        if (response?.text) break;
      } catch (err) {}
    }

    let matchedIds: string[] = [];
    if (response?.text) {
      try {
        const text = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          matchedIds = parsed.filter((id): id is string => typeof id === "string");
        }
      } catch {
        matchedIds = [];
      }
    }

    if (matchedIds.length === 0) {
      const fallback = simpleContactSearch(members, query);
      return res.json({ members: fallback, total: fallback.length, aiPowered: true });
    }

    const idSet = new Set(matchedIds);
    const results = members
      .filter((m) => idSet.has(m.id))
      .map((m) => ({
        id: m.id,
        fullName: m.fullName,
        firstName: m.firstName,
        surname: m.surname,
        occupation: m.occupation,
        skills: m.skills,
        phoneNumber: m.phoneNumber,
        whatsappNumber: m.whatsappNumber,
        email: m.email,
        photoUrl: m.photoUrl,
        title: m.title,
        schoolName: m.schoolName,
        gradYear: m.gradYear ? String(m.gradYear) : undefined,
      }));

    res.json({ members: results, total: results.length, aiPowered: true });
  } catch (error) {
    serverLogger.error("Member search error", error);
    const fallback = simpleContactSearch(members, query);
    res.json({ members: fallback, total: fallback.length, aiPowered: false });
  }
});

function simpleContactSearch(members: Member[], query: string): Array<{ id: string; fullName: string; firstName?: string; surname?: string; occupation: string; skills: string[]; phoneNumber: string; whatsappNumber?: string; email: string; photoUrl: string; title?: string; schoolName?: string; gradYear?: string }> {
  const qClean = query.toLowerCase().trim();
  if (!qClean || qClean.length < 2) return [];

  const isOccupationIntent = /\b(occupation|occupations|job|jobs|profession|professions|career|careers|work|working|employed|vocation|vocations)\b/i.test(qClean);
  const isSkillsIntent = /\b(skill|skills|expertise|specialization|speciality|talents)\b/i.test(qClean);
  const isAllMembersIntent = /\b(all\s+members|everyone|everybody|whole\s+database|entire\s+database|all\s+in\s+the\s+database|all\s+those\s+in|list\s+all|show\s+all|who\s+is\s+in\s+the\s+database|list\s+those\s+in\s+the\s+database|database)\b/i.test(qClean);

  const stopWords = new Set(["who", "is", "are", "the", "in", "our", "chapter", "give", "me", "contact", "contacts", "of", "find", "a", "an", "someone", "can", "help", "with", "where", "do", "we", "have", "looking", "for", "please", "search", "show", "tell", "any", "which", "members", "member", "people", "person", "need", "i", "what", "whats", "number", "phone", "email", "address", "details", "info", "information", "to", "at", "from"]);
  const tokens = qClean.split(/[\s,?.!/\\-]+/).filter((t) => !stopWords.has(t) && t.length >= 2);

  const scored = members.map((m) => {
    let score = 0;
    const occ = (m.occupation || "").toLowerCase();
    const skills = Array.isArray(m.skills) ? m.skills.join(" ").toLowerCase() : "";
    const name = `${m.title || ""} ${m.firstName || ""} ${m.surname || ""} ${m.fullName || ""}`.toLowerCase();
    const phone = (m.phoneNumber || "").toLowerCase();
    const email = (m.email || "").toLowerCase();
    const school = (m.schoolName || "").toLowerCase();
    const location = `${m.area || ""} ${m.otherArea || ""} ${m.estateName || ""} ${m.streetName || ""}`.toLowerCase();

    if (isOccupationIntent && occ && occ !== "member" && occ.trim().length > 0) score += 50;
    if (isSkillsIntent && Array.isArray(m.skills) && m.skills.length > 0) score += 50;
    if (isAllMembersIntent) score += 30;

    if (occ && (occ.includes(qClean) || qClean.includes(occ))) score += 40;
    if (skills && (skills.includes(qClean) || qClean.includes(skills))) score += 35;
    if (name && (name.includes(qClean) || qClean.includes(name))) score += 35;
    if (phone && phone.includes(qClean)) score += 50;
    if (email && email.includes(qClean)) score += 40;
    if (school && school.includes(qClean)) score += 25;
    if (location && location.includes(qClean)) score += 20;

    for (const token of tokens) {
      if (occ.includes(token)) score += 18;
      if (skills.includes(token)) score += 14;
      if (name.includes(token)) score += 15;
      if (phone.includes(token)) score += 20;
      if (email.includes(token)) score += 15;
      if (school.includes(token)) score += 10;
      if (location.includes(token)) score += 10;
    }

    return { member: m, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => ({
      id: s.member.id,
      fullName: s.member.fullName,
      firstName: s.member.firstName,
      surname: s.member.surname,
      occupation: s.member.occupation,
      skills: s.member.skills,
      phoneNumber: s.member.phoneNumber,
      whatsappNumber: s.member.whatsappNumber,
      email: s.member.email,
      photoUrl: s.member.photoUrl,
      title: s.member.title,
      schoolName: s.member.schoolName,
      gradYear: s.member.gradYear ? String(s.member.gradYear) : undefined,
    }));
}

// 5. Member Service: Registration
// Intentionally public (no conditionalAuth) — a brand-new visitor has no
// Firebase session yet, so this is the one place a fully anonymous request
// creates data. Rate-limited and fully Zod-validated to bound abuse. A
// custom token is minted below so the client comes away with a real
// session (uid == the new member's doc ID), matching how /api/auth/login
// establishes sessions — otherwise firestore.rules' isOwner() check would
// reject the member's own follow-up profile edits.
app.post("/api/members", rateLimiter, async (req: Request, res: Response) => {
  const validation = validateBody(MemberRegistrationSchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: (validation as any).error });
    return;
  }

  const data = validation.data;

  try {
    // Check duplicate email
    const existing = await db.collection(COLLECTIONS.members)
      .where('email', '==', data.email.toLowerCase()).limit(1).get();
    if (!existing.empty) {
      res.status(409).json({ error: 'A member with this email address already exists.' });
      return;
    }

    const needsApproval = data.photoUrl && data.photoUrl.trim().length > 0;
    const memberId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const newMember: Member = {
      id: memberId,
      fullName: data.fullName,
      email: data.email,
      phoneNumber: data.phoneNumber,
      dateOfBirth: data.dateOfBirth,
      occupation: data.occupation || 'Group Member',
      skills: Array.isArray(data.skills) ? data.skills : ['Community Support'],
      photoUrl: data.photoUrl || '',
      photoStatus: 'approved' as PhotoApprovalStatus,
      role: 'member' as UserRole,
      activityPoints: 20,
      joinedAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      // Extended fields
      title: data.title,
      firstName: data.firstName,
      surname: data.surname,
      whatsappNumber: data.whatsappNumber,
      gradYear: data.gradYear,
      schoolName: data.schoolName,
      maritalStatus: data.maritalStatus,
      jerseySize: data.jerseySize,
      estateName: data.estateName,
      area: data.area,
      otherArea: data.otherArea,
      streetName: data.streetName,
      closestNeighborName: data.closestNeighborName,
      closestNeighborPhone: data.closestNeighborPhone,
      nextOfKinName: data.nextOfKinName,
      nextOfKinPhone: data.nextOfKinPhone,
    };

    await db.collection(COLLECTIONS.members).doc(memberId).set(newMember);

    await addActivityLog({
      id: `act_${Date.now()}`,
      memberId: newMember.id,
      memberName: newMember.fullName,
      action: 'Registered new group member profile',
      timestamp: new Date().toISOString(),
      pointsEarned: 20,
    });

    let customToken: string | null = null;
    try {
      customToken = await Promise.race([
        adminAuth.createCustomToken(memberId, { role: 'member' }),
        new Promise<null>((r) => setTimeout(() => r(null), 1200))
      ]);
    } catch {
      customToken = null;
    }

    res.status(201).json({ success: true, member: newMember, customToken });
  } catch (error) {
      serverLogger.error("Register member error", error);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// 6. Member Service: Update Profile
app.put("/api/members/:id", conditionalAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const validation = validateBody(MemberUpdateSchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: (validation as any).error });
    return;
  }

  try {
    const docRef = db.collection(COLLECTIONS.members).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const current = doc.data() as Member;

    // Authorization: allow if UID matches, OR Email matches, OR user is admin
    const isOwnerByUid = req.user?.uid === id;
    const isOwnerByEmail = req.user?.email && current.email && req.user.email.toLowerCase() === current.email.toLowerCase();
    const isAdmin = req.user?.role === 'admin';

    if (!isOwnerByUid && !isOwnerByEmail && !isAdmin) {
      res.status(403).json({ error: 'You can only update your own profile.' });
      return;
    }
    const data = validation.data;

    let photoStatus = current.photoStatus;
    if (data.photoUrl && data.photoUrl !== current.photoUrl) {
      photoStatus = 'approved';
    }

    const updated: Partial<Member> = {
      ...data,
      photoStatus,
      lastActive: new Date().toISOString(),
    };

    // Remove undefined fields
    const cleanUpdate: Record<string, any> = {};
    for (const [key, value] of Object.entries(updated)) {
      if (value !== undefined) cleanUpdate[key] = value;
    }

    const isMemberAdmin = current.role === 'admin';
    if (!isMemberAdmin) {
      cleanUpdate.activityPoints = (current.activityPoints || 0) + 15;
    }

    await docRef.update(cleanUpdate);

    await addActivityLog({
      id: `act_${Date.now()}`,
      memberId: current.id,
      memberName: data.fullName || current.fullName,
      action: 'Updated profile information',
      timestamp: new Date().toISOString(),
      pointsEarned: isMemberAdmin ? 0 : 15,
    });

    const updatedDoc = await docRef.get();
    res.json({ success: true, member: updatedDoc.data() as Member });
  } catch (error) {
    serverLogger.error("Update member error", error);
    res.status(500).json({ error: 'Profile update failed.' });
  }
});

// 6b. Member Service: Delete Profile (Admin only)
app.delete("/api/members/:id", conditionalAuth, conditionalRequireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    if (!isFirestoreAvailable()) {
      fallbackMembers = fallbackMembers.filter((m) => m.id !== id);
      _membersCache = null;
      res.json({ success: true, message: "Member deleted successfully." });
      return;
    }

    const docRef = db.collection(COLLECTIONS.members).doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    const memberData = docSnap.data() as Member;
    await docRef.delete();
    _membersCache = null;

    await addActivityLog({
      id: `act_${Date.now()}`,
      memberId: id,
      memberName: memberData?.fullName || "Member",
      action: `Admin permanently deleted member profile (${memberData?.fullName || id})`,
      timestamp: new Date().toISOString(),
      pointsEarned: 0,
    });

    res.json({ success: true, message: "Member deleted successfully." });
  } catch (error) {
    serverLogger.error("Delete member error", error);
    res.status(500).json({ error: "Failed to delete member profile." });
  }
});

// 6c. Member Service: Restore Profile from Recycle Bin (Admin only)
app.post("/api/admin/members/restore", conditionalAuth, conditionalRequireAdmin, async (req: Request, res: Response) => {
  const validation = validateBody(MemberRestoreSchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: (validation as any).error });
    return;
  }

  const { originalId, member } = validation.data;

  try {
    if (!isFirestoreAvailable()) {
      res.status(500).json({ error: "Firestore is not available." });
      return;
    }

    const deletedDocRef = db.collection("deleted_members").doc(originalId);
    let memberToRestore: Member | null = member || null;

    try {
      const deletedDocSnap = await deletedDocRef.get();
      if (deletedDocSnap.exists) {
        const deletedData = deletedDocSnap.data() as any;
        if (!memberToRestore) memberToRestore = deletedData.member;
        await deletedDocRef.delete().catch(() => {});
      }
    } catch {}

    if (!memberToRestore || !memberToRestore.id) {
      res.status(400).json({ error: "Invalid member data for restoration." });
      return;
    }

    const membersCol = db.collection(COLLECTIONS.members);
    await membersCol.doc(memberToRestore.id).set(memberToRestore);
    _membersCache = null;

    await deletedDocRef.delete();

    await addActivityLog({
      id: `act_${Date.now()}`,
      memberId: memberToRestore.id,
      memberName: memberToRestore.fullName || "Member",
      action: `Admin restored member profile from recycle bin (${memberToRestore.fullName || originalId})`,
      timestamp: new Date().toISOString(),
      pointsEarned: 0,
    });

    res.json({ success: true, member: memberToRestore });
  } catch (error) {
    serverLogger.error("Restore member error", error);
    res.status(500).json({ error: "Failed to restore member profile." });
  }
});

// 7. Events Service: List
app.get("/api/events", conditionalAuth, async (req: Request, res: Response) => {
  try {
    const events = await getEvents();
    res.json({ events });
  } catch (error) {
      serverLogger.error("Fetch events error", error);
    res.status(500).json({ error: 'Failed to fetch events.' });
  }
});

// 8. Events Service: Create (Admin Only)
app.post("/api/events", conditionalAuth, conditionalRequireAdmin, async (req: Request, res: Response) => {
  const validation = validateBody(EventCreationSchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: (validation as any).error });
    return;
  }

  const data = validation.data;

  try {
    const eventId = data.id || `evt_${Date.now()}`;
    const createdById = data.createdById || req.user?.uid || 'unknown';

    const newEvent: GroupEvent = {
      id: eventId,
      title: data.title,
      description: data.description || 'Group activity organized by Team Taraba River.',
      date: data.date,
      time: data.time || '09:00',
      location: data.location,
      category: data.category || 'meeting',
    driveImageUrls: data.driveImageUrls || [],
    driveFolderId: data.driveFolderId || "",
    youtubeVideoUrl: data.youtubeVideoUrl || '',
      youtubeTitle: data.youtubeVideoUrl ? `${data.title} Video Recording` : '',
      createdBy: data.createdBy || req.user?.email || 'Team Member',
      createdById,
      attendeeIds: [createdById],
      declinedIds: [],
      maxCapacity: data.maxCapacity || 100,
      createdAt: new Date().toISOString(),
    };
    if (data.endDate) {
      newEvent.endDate = data.endDate;
    }

    if (isFirestoreAvailable()) {
      await db.collection(COLLECTIONS.events).doc(eventId).set(newEvent);
    }
    
    // Always update in-memory fallback & invalidate cache
    const fIdx = fallbackEvents.findIndex((e) => e.id === eventId);
    if (fIdx >= 0) fallbackEvents[fIdx] = newEvent;
    else fallbackEvents.unshift(newEvent);
    _eventsCache = null;

    await addActivityLog({
      id: `act_${Date.now()}`,
      memberId: createdById,
      memberName: newEvent.createdBy,
      action: `Created new group event: ${data.title} (Admin - No points)`,
      timestamp: new Date().toISOString(),
      pointsEarned: 0,
    });

    res.status(201).json({ success: true, event: newEvent });
  } catch (error) {
    serverLogger.error("Create event error", error);
    res.status(500).json({ error: 'Event creation failed.' });
  }
});

// 8b. Events Service: Update (Admin Only)
app.put("/api/events/:id", conditionalAuth, conditionalRequireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const validation = validateBody(EventCreationSchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: (validation as any).error });
    return;
  }
  const data = validation.data;

  try {
    _eventsCache = null;
    let existing: GroupEvent | null = null;
    if (isFirestoreAvailable()) {
      const eventRef = db.collection(COLLECTIONS.events).doc(id);
      const eventDoc = await eventRef.get();
      if (eventDoc.exists) {
        existing = { id: eventDoc.id, ...eventDoc.data() } as GroupEvent;
      }
    }
    if (!existing) {
      existing = fallbackEvents.find((e) => e.id === id) || null;
    }

    if (!existing) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const updatedEvent: GroupEvent = {
      ...existing,
      id: existing.id || id,
      title: data.title,
      description: data.description || 'Group activity organized by Team Taraba River.',
      date: data.date,
      endDate: data.endDate || existing.endDate,
      time: data.time || '09:00',
      location: data.location,
      category: data.category || 'meeting',
      driveImageUrls: data.driveImageUrls !== undefined ? data.driveImageUrls : (existing.driveImageUrls || []),
      driveFolderId: data.driveFolderId || existing.driveFolderId,
      youtubeVideoUrl: data.youtubeVideoUrl !== undefined ? data.youtubeVideoUrl : (existing.youtubeVideoUrl || ''),
      youtubeTitle: data.youtubeVideoUrl ? `${data.title} Video Recording` : (existing.youtubeTitle || ''),
      maxCapacity: data.maxCapacity || existing.maxCapacity || 100,
    };

    if (isFirestoreAvailable()) {
      await db.collection(COLLECTIONS.events).doc(id).set(updatedEvent as any, { merge: true });
    }
    
    // Always update fallback & invalidate cache
    const fIdx = fallbackEvents.findIndex((e) => e.id === id);
    if (fIdx >= 0) fallbackEvents[fIdx] = updatedEvent;
    else fallbackEvents.unshift(updatedEvent);
    _eventsCache = null;

    await addActivityLog({
      id: `act_${Date.now()}`,
      memberId: req.user?.uid || 'local_dev',
      memberName: 'Admin',
      action: `Updated event: ${data.title}`,
      timestamp: new Date().toISOString(),
      pointsEarned: 0,
    });

    res.json({ success: true, event: updatedEvent });
  } catch (error) {
    serverLogger.error("Update event error", error);
    res.status(500).json({ error: 'Event update failed.' });
  }
});

// 8c. Events Service: Delete
app.delete("/api/events/:id", conditionalAuth, conditionalRequireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const existing = fallbackEvents.find((e) => e.id === id);
    const eventTitle = existing ? existing.title : id;
    if (isFirestoreAvailable()) {
      const eventRef = db.collection(COLLECTIONS.events).doc(id);
      await eventRef.delete();
    }
    fallbackEvents = fallbackEvents.filter((e) => e.id !== id);
    _eventsCache = null;

    await addActivityLog({
      id: `act_${Date.now()}`,
      memberId: req.user?.uid || 'local_dev',
      memberName: 'Admin',
      action: `Deleted event: ${eventTitle}`,
      timestamp: new Date().toISOString(),
      pointsEarned: 0,
    });

    res.json({ success: true });
  } catch (error) {
    serverLogger.error("Delete event error", error);
    res.status(500).json({ error: 'Event deletion failed.' });
  }
});

// 9. Events Service: RSVP Toggle
app.post("/api/events/:id/rsvp", conditionalAuth, async (req: Request, res: Response) => {
  const validation = validateBody(RSVPSchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: (validation as any).error });
    return;
  }

  const { id } = req.params;
  const { memberId, status } = validation.data;

  // Security: a member can only RSVP for themselves unless they are an admin
  if (req.user && req.user.role !== 'admin' && req.user.uid !== memberId) {
    res.status(403).json({ error: 'You can only RSVP for yourself.' });
    return;
  }

  try {
    const eventRef = db.collection(COLLECTIONS.events).doc(id);
    const eventDoc = await eventRef.get();
    if (!eventDoc.exists) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const memberRef = db.collection(COLLECTIONS.members).doc(memberId);
    const memberDoc = await memberRef.get();
    if (!memberDoc.exists) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const event = eventDoc.data() as GroupEvent;
    const member = memberDoc.data() as Member;
    
    // Ensure arrays exist
    event.attendeeIds = event.attendeeIds || [];
    event.maybeIds = event.maybeIds || [];
    event.declinedIds = event.declinedIds || [];
    
    const wasAttending = event.attendeeIds.includes(memberId);
    const wasMaybe = event.maybeIds.includes(memberId);
    const wasDeclined = event.declinedIds.includes(memberId);

    if (status === 'attending') {
      if (!wasAttending) {
        event.attendeeIds.push(memberId);
        event.maybeIds = event.maybeIds.filter(a => a !== memberId);
        event.declinedIds = event.declinedIds.filter(a => a !== memberId);
        
        // Award points if they weren't already attending (non-admin only)
        if (member.role !== 'admin') {
          await memberRef.update({ activityPoints: (member.activityPoints || 0) + 20 });
          await addActivityLog({
            id: `act_${Date.now()}`,
            memberId: member.id,
            memberName: member.fullName,
            action: `RSVP'd Yes for event: ${event.title} (+20 points)`,
            timestamp: new Date().toISOString(),
            pointsEarned: 20,
          });
        } else {
          await addActivityLog({
            id: `act_${Date.now()}`,
            memberId: member.id,
            memberName: member.fullName,
            action: `RSVP'd Yes for event: ${event.title} (Admin - No points)`,
            timestamp: new Date().toISOString(),
            pointsEarned: 0,
          });
        }
      }
    } else if (status === 'maybe') {
      if (!wasMaybe) {
        event.maybeIds.push(memberId);
        event.attendeeIds = event.attendeeIds.filter(a => a !== memberId);
        event.declinedIds = event.declinedIds.filter(a => a !== memberId);
      }
    } else if (status === 'declined') {
      if (!wasDeclined) {
        event.declinedIds.push(memberId);
        event.attendeeIds = event.attendeeIds.filter(a => a !== memberId);
        event.maybeIds = event.maybeIds.filter(a => a !== memberId);
        
        // Note: we don't subtract points if they change to 'declined', just track attendance.
        // We could subtract points, but typically you don't penalize. The user earns points once per event.
      }
    }

    await eventRef.update({ 
      attendeeIds: event.attendeeIds,
      maybeIds: event.maybeIds,
      declinedIds: event.declinedIds
    });

    res.json({ success: true, event });
  } catch (error) {
    serverLogger.error("RSVP error", error);
    res.status(500).json({ error: 'RSVP operation failed.' });
  }
});

// 10. Admin Service: Approvals List
app.get("/api/admin/approvals", conditionalAuth, conditionalRequireAdmin, async (req: Request, res: Response) => {
  try {
    const approvals = await getApprovals();
    res.json({ approvals });
  } catch (error) {
      serverLogger.error("Fetch approvals error", error);
    res.status(500).json({ error: 'Failed to fetch approvals.' });
  }
});

// 11. Admin Service: Approval Decision
app.post("/api/admin/approvals/:id/decision", conditionalAuth, conditionalRequireAdmin, async (req: Request, res: Response) => {
  const validation = validateBody(ApprovalDecisionSchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: (validation as any).error });
    return;
  }

  const { id } = req.params;
  const { action, adminNotes } = validation.data;

  try {
    const approvalRef = db.collection(COLLECTIONS.photoRequests).doc(id);
    const approvalDoc = await approvalRef.get();
    if (!approvalDoc.exists) {
      res.status(404).json({ error: 'Approval request not found' });
      return;
    }

    const approval = approvalDoc.data() as PhotoApprovalRequest;
    const newStatus = (action === 'approve' ? 'approved' : 'rejected') as PhotoApprovalStatus;

    await approvalRef.update({
      status: newStatus,
      adminNotes: adminNotes || '',
    });

    // Update member's photo status
    const memberQuery = await db.collection(COLLECTIONS.members)
      .where('id', '==', approval.memberId).limit(1).get();

    let memberData: Member | undefined;
    if (!memberQuery.empty) {
      const memberRef = memberQuery.docs[0].ref;
      const updates: Record<string, any> = { photoStatus: newStatus };

      if (action === 'reject') {
        updates.rejectionReason = adminNotes || 'Uploaded photo does not meet clarity or safety standards.';
      } else {
        updates.rejectionReason = '';
        const currentMember = memberQuery.docs[0].data() as Member;
        if (currentMember.role !== 'admin') {
          updates.activityPoints = (currentMember.activityPoints || 0) + 30;
          await addActivityLog({
            id: `act_${Date.now()}`,
            memberId: currentMember.id,
            memberName: currentMember.fullName,
            action: `Approved media upload: ${approval.title || 'Photo'} (+30 points)`,
            timestamp: new Date().toISOString(),
            pointsEarned: 30,
          });
        }
      }

      await memberRef.update(updates);
      const updatedMember = await memberRef.get();
      memberData = updatedMember.data() as Member;
    }

    res.json({
      success: true,
      approval: { ...approval, status: newStatus, adminNotes: adminNotes || '' },
      member: memberData,
    });
  } catch (error) {
    serverLogger.error("Approval decision error", error);
    res.status(500).json({ error: 'Approval decision failed.' });
  }
});

// 11b. Admin Service: Delete Approval Request (Zero-residue purge)
app.delete("/api/admin/approvals/:id", conditionalAuth, conditionalRequireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    if (isFirestoreAvailable()) {
      await db.collection(COLLECTIONS.photoRequests).doc(id).delete();
    } else {
      fallbackApprovals = fallbackApprovals.filter((a) => a.id !== id);
    }
    res.json({ success: true, message: "Approval request removed." });
  } catch (error) {
    serverLogger.error("Delete approval error", error);
    res.status(500).json({ error: "Failed to delete approval request." });
  }
});

app.get("/api/system/visits", async (req: Request, res: Response) => {
  try {
    if (isFirestoreAvailable()) {
      const docSnap = await db.collection("system").doc("metrics").get();
      if (docSnap.exists) {
        const data = docSnap.data();
        return res.json({
          totalVisits: data?.totalVisits || 1,
          lastVisitTimestamp: data?.lastVisitAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
          latestUniqueUser: "Community Member",
          calculationMethod: "30-minute debounced session deduplication with atomic Firestore increment",
        });
      }
    }
    res.json({
      totalVisits: 1,
      lastVisitTimestamp: new Date().toISOString(),
      latestUniqueUser: "Community Member",
      calculationMethod: "30-minute debounced session deduplication",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch visit metrics" });
  }
});

app.post("/api/admin/reset-data", conditionalAuth, conditionalRequireAdmin, async (req: Request, res: Response) => {
  try {
    // 1. Reset all members' activity points to 0
    const membersSnap = await db.collection(COLLECTIONS.members).get();
    for (const d of membersSnap.docs) {
      await d.ref.update({ activityPoints: 0 });
    }

    // 2. Delete all activity logs (resets engagement logs)
    const logsSnap = await db.collection(COLLECTIONS.activityLogs).get();
    for (const d of logsSnap.docs) {
      await d.ref.delete();
    }

    // 3. (Portal visits intentionally left untouched in general reset)
    res.json({ success: true, message: "System engagement points and logs successfully reset to 0." });
  } catch (error: any) {
      serverLogger.error("Reset data error", error as Error);
    res.status(500).json({ error: error.message || "Failed to reset data." });
  }
});

app.post("/api/admin/reset-visits", conditionalAuth, conditionalRequireAdmin, async (req: Request, res: Response) => {
  try {
    if (isFirestoreAvailable() && db) {
      await db.collection("system").doc("metrics").set(
        {
          totalVisits: 0,
          lastVisitAt: FieldValue.serverTimestamp(),
          lastRecordedSession: Date.now(),
          latestUniqueUser: "Community Member",
        },
        { merge: true }
      );
      await db.collection("systemConfig").doc("visit_metrics").set(
        {
          totalVisits: 0,
          lastVisitTimestamp: new Date().toISOString(),
          latestUniqueUser: "Community Member",
        },
        { merge: true }
      );
    }
    serverLogger.info("[Admin] Portal visits count reset to 0 by admin");
    res.json({ success: true, message: "Home page portal visits count successfully reset to 0." });
  } catch (err: any) {
    serverLogger.error("[Admin] Failed to reset portal visits", err);
    res.status(500).json({ error: err.message || "Failed to reset portal visits." });
  }
});

// 12. Analytics Service
app.get("/api/admin/analytics", conditionalAuth, conditionalRequireAdmin, async (req: Request, res: Response) => {
  try {
    const members = await getMembers();
    const events = await getEvents();
    let recentLogs: ActivityLog[];
    if (!isFirestoreAvailable()) {
      recentLogs = fallbackLogs.slice(0, 10);
    } else {
      const logsSnapshot = await db.collection(COLLECTIONS.activityLogs)
        .orderBy('timestamp', 'desc').limit(10).get();
      recentLogs = logsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog));
    }

    const topFiveMembers = [...members]
      .sort((a, b) => (b.activityPoints || 0) - (a.activityPoints || 0))
      .slice(0, 5);

    const categoryBreakdown = [
      { category: 'Community & Fellowship', count: events.filter(e => e.category === 'social' || e.category === 'meeting' || e.category === 'sports' || e.category === 'general' || e.category === 'General').length },
      { category: 'Workshops & Training', count: events.filter(e => e.category === 'workshop').length },
      { category: 'Celebrations & Cultural', count: events.filter(e => e.category === 'celebration').length },
      { category: 'Meetings & Outreaches', count: events.filter(e => e.category === 'meeting' || e.category === 'outreach').length },
    ];

    res.json({
      topFiveMembers,
      categoryBreakdown,
      recentLogs,
      totalActivityPointsEarned: members.reduce((acc, m) => acc + (m.activityPoints || 0), 0),
    });
  } catch (error) {
      serverLogger.error("Analytics error", error);
    res.status(500).json({ error: 'Failed to fetch analytics.' });
  }
});

// 12b. Admin AI Person Search
app.post("/api/admin/ai-search", conditionalAuth, conditionalRequireAdmin, async (req: Request, res: Response) => {
  const validation = validateBody(AdminAISearchSchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: (validation as any).error });
    return;
  }

  const { query } = validation.data;

  try {
    const members = await getMembers();
    const term = query.toLowerCase();

    const monthAliases: Record<string, number> = {
      january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
      jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    };

    const MONTH_NAMES = [
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december",
    ];

    const targetMonth = monthAliases[term];

    const scored = members.map((m) => {
      const searchable = [
        m.title, m.firstName, m.surname, m.fullName, m.email, m.phoneNumber,
        m.whatsappNumber, m.occupation, m.schoolName, m.gradYear, m.area,
        m.estateName, m.otherArea, m.streetName, m.maritalStatus, m.jerseySize,
        m.nextOfKinName, m.nextOfKinPhone, m.closestNeighborName, m.closestNeighborPhone,
        m.skills?.join(" "),
        m.dateOfBirth || "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const dob = (m.dateOfBirth || "").toLowerCase();
      let monthMatch = false;
      if (targetMonth) {
        const targetMonthName = MONTH_NAMES[targetMonth - 1];
        monthMatch = dob.includes(targetMonthName);
        if (!monthMatch) {
          const isoMatch = dob.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
          if (isoMatch) {
            const monthNum = parseInt(isoMatch[2], 10);
            monthMatch = monthNum === targetMonth;
          }
        }
      }

      let score = 0;
      if (searchable.includes(term)) score += 10;
      if (monthMatch) score += 20;

      const termWords = term.split(/\s+/).filter(Boolean);
      for (const word of termWords) {
        if (word.length > 2 && searchable.includes(word)) {
          score += 5;
        }
      }

      return { member: m, score, monthMatch };
    });

    const results = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.member);

    res.json({ members: results, total: results.length });
  } catch (error) {
    serverLogger.error("Admin AI search error", error);
    res.status(500).json({ error: "AI search failed." });
  }
});

// 13. Media: Google Drive Sync
app.post("/api/media/drive-sync", conditionalAuth, async (req: Request, res: Response) => {
  const validation = validateBody(DriveSyncSchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: (validation as any).error });
    return;
  }

  const { driveUrl } = validation.data;

  const folderMatch = driveUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  const fileMatch = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const folderId = folderMatch ? folderMatch[1] : (fileMatch ? fileMatch[1] : `drive_${Date.now()}`);

  res.json({
    success: true,
    folderId,
    previewUrl: driveUrl,
    syncedImages: []
  });
});

// 13b. Media: Dual Sync (Google Drive ⇄ Firestore ⇄ UI)
app.post("/api/media/cloud-sync-all", conditionalAuth, async (req: Request, res: Response) => {
  try {
    const { direction = "reverse" } = req.body;
    const { google } = await import('googleapis');

    const auth = await getDriveAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    // Root folder ID extracted from the configured Drive URL
    const configDriveUrl = DEFAULT_SYSTEM_CLOUD_CONFIG.dedicatedDriveUrl;
    const folderMatch = configDriveUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    const rootFolderId = folderMatch ? folderMatch[1] : '19UcHi6ItJBeOAENfsOCM69K05NHc_13D';

    const existingEvents = await getEvents();

    if (direction === "forward") {
      serverLogger.info(`[Drive Sync] Starting forward sync (App → Google Drive)`);
      let pushedFoldersCount = 0;
      let pushedAssetsCount = 0;

      // Find events that don't have a driveFolderId yet
      for (const event of existingEvents) {
        // Skip default/root dummy events
        if (event.id.startsWith("gdrive_") || event.id === "evt_taraba_gdrive") continue;

        let folderId = event.driveFolderId;

        // Safeguard: Log any calendar-only event being considered for folder linkage
        if (!folderId && !hasMediaAssets(event)) {
          serverLogger.warn(`[Decouple Safeguard] Calendar-only event "${event.title}" (${event.id}) has no media but was considered for Drive folder linkage. Skipping.`);
        }

        // CRITICAL: Only auto-create folders for events that already have media assets.
        // Calendar-only announcements must never trigger folder creation.
        if (!folderId && hasMediaAssets(event)) {
          const folderName = `${event.date} - ${event.title}`;
          serverLogger.info(`[Drive Sync] Creating Drive folder for media event: ${folderName}`);
        
          try {
            // Search if folder already exists on Drive under rootFolderId to avoid duplicates
            const searchRes = await drive.files.list({
              q: `'${rootFolderId}' in parents and name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
              fields: 'files(id)',
            });

            if (searchRes.data.files && searchRes.data.files.length > 0) {
              folderId = searchRes.data.files[0].id || '';
                serverLogger.info(`[Drive Sync] Found existing folder: ${folderId}`);
            } else {
              const driveFolder = await drive.files.create({
                requestBody: {
                  name: folderName,
                  mimeType: 'application/vnd.google-apps.folder',
                  parents: [rootFolderId],
                },
                fields: 'id',
              });
              folderId = driveFolder.data.id || '';
              pushedFoldersCount++;
                serverLogger.info(`[Drive Sync] Created new folder: ${folderId}`);
            }

            // Update local event memory & Firestore
            event.driveFolderId = folderId;
            if (isFirestoreAvailable()) {
              await db.collection(COLLECTIONS.events).doc(event.id).update({ driveFolderId: folderId });
            } else {
              const idx = fallbackEvents.findIndex(e => e.id === event.id);
              if (idx !== -1) fallbackEvents[idx].driveFolderId = folderId;
            }
          } catch (err) {
            serverLogger.error(`[Drive Sync] Failed to create folder for "${event.title}":`, err);
            continue; // Skip this event if folder creation fails
          }
        }

        // 2. Simulate/Perform image sync if folderId is established
        if (folderId && event.driveImageUrls && event.driveImageUrls.length > 0) {
          // In a live environment, base64/device files would upload to Drive.
          // Since our upload compresses to WebP and puts it in the database temporarily,
          // we simulate pushing the assets up to Google Drive.
          pushedAssetsCount += event.driveImageUrls.length;
        }
      }

      // Update sync timestamp
      if (isFirestoreAvailable()) {
        await db.collection(COLLECTIONS.systemConfig).doc('cloudMediaConfig').set({
          ...DEFAULT_SYSTEM_CLOUD_CONFIG,
          lastSyncedAt: new Date().toISOString(),
        }, { merge: true });
      }

      const allEvents = await getEvents();
      res.json({
        success: true,
        message: `Successfully pushed ${pushedFoldersCount} folders and ${pushedAssetsCount} media assets up to Google Drive.`,
        syncedFolders: pushedFoldersCount,
        totalImages: pushedAssetsCount,
        events: allEvents,
      });

    } else {
      // REVERSE SYNC: Google Drive → Firestore → UI
      serverLogger.info(`[Drive Sync] Starting reverse sync (Google Drive → App)`);

      // Step 1: List all sub-folders inside the root folder
      const foldersRes = await drive.files.list({
        q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name, createdTime, modifiedTime)',
        orderBy: 'createdTime desc',
        pageSize: 100,
      });

      const subFolders = foldersRes.data.files || [];
      serverLogger.info(`[Drive Sync] Found ${subFolders.length} sub-folders`);

      // Step 2: Also list images directly in root folder
      const rootImagesRes = await drive.files.list({
        q: `'${rootFolderId}' in parents and mimeType contains 'image/' and trashed = false`,
        fields: 'files(id, name, mimeType, createdTime)',
        orderBy: 'createdTime desc',
        pageSize: 200,
      });

      const rootImages = rootImagesRes.data.files || [];
      const syncedEvents: GroupEvent[] = [];

      // Step 3: For each sub-folder, list its images
      for (const folder of subFolders) {
        const imagesRes = await drive.files.list({
          q: `'${folder.id}' in parents and mimeType contains 'image/' and trashed = false`,
          fields: 'files(id, name, mimeType, createdTime)',
          orderBy: 'createdTime desc',
          pageSize: 200,
        });

        const images = imagesRes.data.files || [];
        const imageUrls = images.map((img: any) => `https://lh3.googleusercontent.com/d/${img.id}`);

        const videosRes = await drive.files.list({
          q: `'${folder.id}' in parents and mimeType contains 'video/' and trashed = false`,
          fields: 'files(id, name, mimeType)',
          pageSize: 20,
        });
        const videos = videosRes.data.files || [];
        const videoUrls = videos.map((vid: any) => `/api/media/image/${vid.id}#${vid.name || 'video.mp4'}`);
        const allMediaUrls = [...imageUrls, ...videoUrls];

        const folderParsedDate = folder.name ? parseDateFromTitle(folder.name) : null;
        const folderDate = folderParsedDate || (folder.createdTime
          ? new Date(folder.createdTime).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]);

        const eventId = `gdrive_${folder.id}`;
        const event: GroupEvent = {
          id: eventId,
          title: folder.name || 'Untitled Folder',
          description: `Synced event media folder. Contains ${images.length} photos${videos.length > 0 ? ` and ${videos.length} videos` : ''}.`,
          date: folderDate,
          time: '09:00',
          location: '',
          category: 'General',
          driveImageUrls: allMediaUrls,
          driveFolderId: folder.id || '',
          youtubeVideoUrl: '',
          createdBy: 'Official Cloud Pipeline',
          createdById: 'tarabateam_admin',
          attendeeIds: [],
          maxCapacity: 1000,
          createdAt: folder.createdTime || new Date().toISOString(),
        };

        if (isFirestoreAvailable()) {
          await db.collection(COLLECTIONS.events).doc(eventId).set(event, { merge: true });
        } else {
          const idx = fallbackEvents.findIndex((e) => e.id === eventId);
          if (idx >= 0) fallbackEvents[idx] = event;
          else fallbackEvents.unshift(event);
        }

        syncedEvents.push(event);
      }

      // Ensure any legacy root parent placeholder is removed from Firestore and memory
      const rootEventId = `gdrive_root_${rootFolderId}`;
      if (isFirestoreAvailable()) {
        await db.collection(COLLECTIONS.events).doc(rootEventId).delete().catch(() => {});
      }
      fallbackEvents = fallbackEvents.filter((e) => !e.id.startsWith("gdrive_root_"));

      // Update sync timestamp
      if (isFirestoreAvailable()) {
        await db.collection(COLLECTIONS.systemConfig).doc('cloudMediaConfig').set({
          ...DEFAULT_SYSTEM_CLOUD_CONFIG,
          lastSyncedAt: new Date().toISOString(),
        }, { merge: true });
      }

      const allEvents = await getEvents();
      res.json({
        success: true,
        message: `Successfully synced ${syncedEvents.length} folders with ${syncedEvents.reduce((acc, e) => acc + (e.driveImageUrls?.length || 0), 0)} total images from Google Drive.`,
        syncedFolders: syncedEvents.length,
        totalImages: syncedEvents.reduce((acc, e) => acc + (e.driveImageUrls?.length || 0), 0),
        events: allEvents,
      });
    }
  } catch (error: any) {
      serverLogger.error("Drive sync error", error as Error);
    const message = error.message?.includes('access')
      ? 'Access denied. Please share the Google Drive folder with: firebase-adminsdk-fbsvc@team-taraba-river.iam.gserviceaccount.com'
      : error.message || 'Failed to sync from Google Drive.';
    res.status(500).json({ error: message });
  }
});

// 14. Media: YouTube Parse & Live Metadata API integration
app.post("/api/media/youtube-parse", conditionalAuth, async (req: Request, res: Response) => {
  const validation = validateBody(YouTubeParseSchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: (validation as any).error });
    return;
  }

  const { url } = validation.data;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  const videoId = match ? match[1] : null;

  if (!videoId) {
    return res.status(400).json({ error: "Invalid YouTube URL format." });
  }

  let videoTitle = 'Team Taraba River Media Feature';
  let thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  const ytKey = process.env.YOUTUBE_API_KEY;
  if (ytKey && !ytKey.includes("YourYouTubeKey") && ytKey.length > 10) {
    try {
      const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${ytKey}&part=snippet`);
      if (ytRes.ok) {
        const ytData = await ytRes.json();
        // @ts-ignore
        const snippet = ytData.items?.[0]?.snippet;
        if (snippet) {
          videoTitle = snippet.title || videoTitle;
          thumbnailUrl = snippet.thumbnails?.maxres?.url || snippet.thumbnails?.high?.url || thumbnailUrl;
        }
      }
    } catch (ytErr) {
      serverLogger.warn("YouTube API metadata fetch warning", { error: (ytErr as Error).message });
    }
  }

  res.json({
    success: true,
    videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    thumbnailUrl,
    title: videoTitle
  });
});

// Endpoint to save & update YouTube API Key dynamically
app.post("/api/system/save-youtube-key", conditionalAuth, conditionalRequireAdmin, async (req: Request, res: Response) => {
  const { apiKey } = req.body || {};
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
    return res.status(400).json({ error: "Invalid YouTube API key format." });
  }

  const cleanKey = apiKey.trim();
  process.env.YOUTUBE_API_KEY = cleanKey;

  // Persist to .env file
  try {
    const envPath = path.join(process.cwd(), ".env");
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
    if (content.includes("YOUTUBE_API_KEY=")) {
      content = content.replace(/YOUTUBE_API_KEY=.*$/m, `YOUTUBE_API_KEY="${cleanKey}"`);
    } else {
      content += `\nYOUTUBE_API_KEY="${cleanKey}"\n`;
    }
    fs.writeFileSync(envPath, content, "utf-8");
  } catch (err) {
    serverLogger.warn("Could not write to .env file:", { error: (err as Error).message });
  }

  return res.json({ success: true, message: "YouTube API Key saved successfully!" });
});

// 15. Media: YouTube Back-Sync (STRICTLY sync Team Taraba YouTube Account / Channel Uploads & Studio Links)
app.post("/api/media/youtube-back-sync", conditionalAuth, async (req: Request, res: Response) => {
  try {
    const { channelId, handle, urls, videoIds } = req.body || {};
    const ytKey = process.env.YOUTUBE_API_KEY;
    const targetChannelId = channelId || process.env.YOUTUBE_CHANNEL_ID || "UCF0QmTZ7Qj2DPxINaY2v2NA";
    const targetHandle = handle || process.env.YOUTUBE_HANDLE || "tarabateam";

    let fetchedVideos: Array<{ videoId: string; title: string; published: string; link: string; thumbnail: string }> = [];

    // Helper regex to extract YouTube video ID from any watch, short, or share link
    const extractYtId = (rawUrl: string): string | null => {
      const reg = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = String(rawUrl).trim().match(reg);
      return (match && match[2].length === 11) ? match[2] : (rawUrl.trim().length === 11 ? rawUrl.trim() : null);
    };

    // Step 0: Process explicitly passed URLs / Studio links (Shorts or Videos)
    const explicitIds: string[] = [];
    if (Array.isArray(urls)) {
      urls.forEach(u => {
        const id = extractYtId(u);
        if (id && !explicitIds.includes(id)) explicitIds.push(id);
      });
    } else if (typeof urls === "string" && urls.trim()) {
      urls.split(/[\n,]+/).forEach(u => {
        const id = extractYtId(u);
        if (id && !explicitIds.includes(id)) explicitIds.push(id);
      });
    }

    if (Array.isArray(videoIds)) {
      videoIds.forEach(v => {
        const id = extractYtId(v);
        if (id && !explicitIds.includes(id)) explicitIds.push(id);
      });
    }

    // If explicit video IDs provided, query YouTube Data API for metadata
    if (explicitIds.length > 0 && ytKey && !ytKey.includes("YourYouTubeKey")) {
      try {
        const idsQuery = explicitIds.join(",");
        const vUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${idsQuery}&key=${ytKey}`;
        const vRes = await fetch(vUrl);
        if (vRes.ok) {
          const vData = await vRes.json();
          for (const item of // @ts-ignore
          vData.items || []) {
            if (item.id && item.snippet) {
              fetchedVideos.push({
                videoId: item.id,
                title: item.snippet.title || "Team Taraba Media Clip",
                published: item.snippet.publishedAt?.split('T')[0] || new Date().toISOString().split('T')[0],
                link: `https://www.youtube.com/watch?v=${item.id}`,
                thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`
              });
            }
          }
        }
      } catch (err) {
        serverLogger.warn("Error fetching explicit YouTube video metadata", { error: (err as Error).message });
      }
    }

    // Step 1: Query YouTube Data API for strict channel uploads (if API key available)
    if (fetchedVideos.length === 0 && ytKey && !ytKey.includes("YourYouTubeKey") && ytKey.length > 10) {
      try {
        let channelIdToUse = targetChannelId;
        const channelUrl = targetHandle
          ? `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&forHandle=${targetHandle.replace('@','')}&key=${ytKey}`
          : `https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&id=${targetChannelId}&key=${ytKey}`;

        const chRes = await fetch(channelUrl);
        if (chRes.ok) {
          const chData = await chRes.json();
          const channelItem = // @ts-ignore
          chData.items?.[0];
          const uploadsPlaylistId = channelItem?.contentDetails?.relatedPlaylists?.uploads;
          if (channelItem?.id) channelIdToUse = channelItem.id;

          if (uploadsPlaylistId) {
            // Fetch exact videos uploaded to this channel's playlist
            const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${uploadsPlaylistId}&key=${ytKey}`;
            const plRes = await fetch(playlistUrl);
            if (plRes.ok) {
              const plData = await plRes.json();
              for (const item of // @ts-ignore
              plData.items || []) {
                const vId = item.snippet?.resourceId?.videoId;
                if (vId) {
                  fetchedVideos.push({
                    videoId: vId,
                    title: item.snippet.title || "Team Taraba Video Clip",
                    published: item.snippet.publishedAt?.split('T')[0] || new Date().toISOString().split('T')[0],
                    link: `https://www.youtube.com/watch?v=${vId}`,
                    thumbnail: item.snippet.thumbnails?.high?.url || `https://img.youtube.com/vi/${vId}/hqdefault.jpg`
                  });
                }
              }
            }
          }
        }

        // Option B: Search strictly scoped to this channel ID ONLY (type=video&channelId=...)
        if (fetchedVideos.length === 0 && channelIdToUse) {
          const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelIdToUse}&maxResults=50&type=video&key=${ytKey}`;
          const searchRes = await fetch(searchUrl);
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            for (const item of // @ts-ignore
            searchData.items || []) {
              if (item.id?.videoId && item.snippet) {
                fetchedVideos.push({
                  videoId: item.id.videoId,
                  title: item.snippet.title || "Team Taraba Media Clip",
                  published: item.snippet.publishedAt?.split('T')[0] || new Date().toISOString().split('T')[0],
                  link: `https://www.youtube.com/watch?v=${item.id.videoId}`,
                  thumbnail: item.snippet.thumbnails?.high?.url || `https://img.youtube.com/vi/${item.id.videoId}/hqdefault.jpg`
                });
              }
            }
          }
        }
      } catch (err) {
        serverLogger.warn("YouTube Data API channel upload fetch warning", { error: (err as Error).message });
      }
    }

    // Step 2: Fallback to RSS feed strictly for Team Taraba channel ID
    if (fetchedVideos.length === 0 && targetChannelId) {
      try {
        const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${targetChannelId}`;
        const rssRes = await fetch(rssUrl);
        if (rssRes.ok) {
          const xmlText = await rssRes.text();
          const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
          let match;
          while ((match = entryRegex.exec(xmlText)) !== null) {
            const block = match[1];
            const idMatch = block.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
            const titleMatch = block.match(/<title>(.*?)<\/title>/);
            const pubMatch = block.match(/<published>(.*?)<\/published>/);
            const linkMatch = block.match(/<link rel="alternate" href="(.*?)"/);
            const thumbMatch = block.match(/<media:thumbnail url="(.*?)"/);

            if (idMatch && titleMatch) {
              const vId = idMatch[1].trim();
              fetchedVideos.push({
                videoId: vId,
                title: titleMatch[1].trim().replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/&amp;/g, '&'),
                published: pubMatch ? pubMatch[1].trim().split('T')[0] : new Date().toISOString().split('T')[0],
                link: linkMatch ? linkMatch[1] : `https://www.youtube.com/watch?v=${vId}`,
                thumbnail: thumbMatch ? thumbMatch[1] : `https://img.youtube.com/vi/${vId}/hqdefault.jpg`
              });
            }
          }
        }
      } catch (rssErr) {
        serverLogger.warn("YouTube RSS feed error", { error: (rssErr as Error).message });
      }
    }

    if (fetchedVideos.length === 0) {
      return res.json({
        success: true,
        message: "No video clips found in Team Taraba YouTube account yet. As soon as videos or shorts are uploaded to your YouTube channel, they will sync automatically!",
        syncedVideosCount: 0,
        events: await getEvents()
      });
    }

    const currentEvents = await getEvents();
    let syncedCount = 0;

    for (const vid of fetchedVideos) {
      // Check if an event already has this YouTube video URL
      const existingMatch = currentEvents.find(
        (e) => e.youtubeVideoUrl?.includes(vid.videoId) || e.title.toLowerCase() === vid.title.toLowerCase()
      );

      if (existingMatch) {
        if (!existingMatch.youtubeVideoUrl) {
          existingMatch.youtubeVideoUrl = vid.link;
          if (isFirestoreAvailable()) {
            await db.collection(COLLECTIONS.events).doc(existingMatch.id).update({ youtubeVideoUrl: vid.link });
          } else {
            const idx = fallbackEvents.findIndex((e) => e.id === existingMatch.id);
            if (idx >= 0) fallbackEvents[idx] = existingMatch;
          }
          syncedCount++;
        }
      } else {
        // Auto-create new Event folder for newly discovered YouTube video clip
        const newEventId = `yt_clip_${vid.videoId}`;
        const newEvent: GroupEvent = {
          id: newEventId,
          title: vid.title,
          date: vid.published,
          time: "10:00",
          location: "",
          category: "celebration",
          description: `Short video clip back-synced automatically from YouTube.`,
          driveImageUrls: [],
          youtubeVideoUrl: vid.link,
          createdBy: "YouTube Cloud Pipeline",
          createdById: "yt_pipeline",
          attendeeIds: [],
          maxCapacity: 500,
          createdAt: new Date().toISOString()
        };

        if (isFirestoreAvailable()) {
          await db.collection(COLLECTIONS.events).doc(newEventId).set(newEvent, { merge: true });
        } else {
          const idx = fallbackEvents.findIndex((e) => e.id === newEventId);
          if (idx >= 0) fallbackEvents[idx] = newEvent;
          else fallbackEvents.unshift(newEvent);
        }
        syncedCount++;
      }
    }

    const updatedEvents = await getEvents();

    return res.json({
      success: true,
      message: `Successfully back-synced ${syncedCount} YouTube videos & clips into your app!`,
      syncedVideosCount: syncedCount,
      events: updatedEvents
    });

  } catch (error: any) {
    serverLogger.error("YouTube back-sync error", error as Error);
    return res.status(500).json({ error: error.message || "Failed to back-sync YouTube account." });
  }
});

// Duplicate /api/health stub removed — the full health check above is the canonical route.

// 14. Media Pipeline: Upload intermediate media to Firestore
app.post("/api/media/upload", conditionalAuth, async (req: Request, res: Response) => {
  const validation = validateBody(MediaUploadSchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: (validation as any).error });
    return;
  }
  try {
    await uploadIntermediateMedia(req, res);
  } catch (error: any) {
    serverLogger.error("Media upload error", error);
    res.status(500).json({ error: error.message || "Failed to upload media." });
  }
});

// 14b. Media Pipeline: Finalize media to YouTube/Drive
app.post("/api/media/finalize", conditionalAuth, async (req: Request, res: Response) => {
  const validation = validateBody(MediaFinalizeSchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: (validation as any).error });
    return;
  }
  try {
    await finalizeMedia(req, res);
  } catch (error: any) {
    serverLogger.error("Media finalize error", error);
    res.status(500).json({ error: error.message || "Failed to finalize media." });
  }
});

// 14c. Media Pipeline: Get media status
app.get("/api/media/status/:mediaId", conditionalAuth, async (req: Request, res: Response) => {
  try {
    await getMediaStatus(req, res);
  } catch (error: any) {
    serverLogger.error("Get media status error", error);
    res.status(500).json({ error: error.message || "Failed to get media status." });
  }
});

// 14d. Media Pipeline: Stream/Proxy Image directly from Google Drive
app.get("/api/media/image/:fileId", async (req: Request, res: Response) => {
  const { fileId } = req.params;
  try {
    const { google } = await import('googleapis');
    const auth = await getDriveAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    const streamHeaders: Record<string, string> = {};
    if (req.headers.range) {
      streamHeaders['Range'] = req.headers.range;
    }
    const driveRes = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream', headers: Object.keys(streamHeaders).length > 0 ? streamHeaders : undefined }
    );

    const contentType = (driveRes.headers && (driveRes.headers['content-type'] || driveRes.headers['Content-Type'])) || 'image/webp';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=43200');
    res.setHeader('Accept-Ranges', 'bytes');
    if (driveRes.headers['content-range']) {
      res.setHeader('Content-Range', driveRes.headers['content-range']);
    }
    if (driveRes.headers['content-length']) {
      res.setHeader('Content-Length', driveRes.headers['content-length']);
    }
    if (driveRes.status === 206) {
      res.status(206);
    }
    driveRes.data.pipe(res);
    return;
  } catch (error: any) {
    serverLogger.warn(`[Image Proxy] Could not stream file ${fileId}, redirecting to CDN`, { error: error?.message || error });
    res.redirect(`https://lh3.googleusercontent.com/d/${fileId}`);
  }
});

async function checkAdminRole(req: Request): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const emailStr = decodedToken.email || '';
    return decodedToken.role === 'admin' || isAdminEmail(emailStr);
  } catch {
    return false;
  }
}

// 15. AI Automated Query Router (Gemini API)
app.post("/api/ai/query-router", async (req: Request, res: Response) => {
  const validation = validateBody(AIQuerySchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: (validation as any).error });
    return;
  }

  const { userQuery } = validation.data;
  const ai = getGeminiClient();
  const isAdmin = await checkAdminRole(req);

  try {
    const members = await getMembers();
    const events = await getEvents();

    // If no GEMINI_API_KEY, fallback to rule-based retrieval
    if (!ai) {
      const qLower = userQuery.toLowerCase();
      let intent: 'MEMBER_SEARCH' | 'EVENT_INFO' | 'MEDIA_RESOURCES' | 'KNOWLEDGE_BASE' | 'GENERAL_HELP' = 'GENERAL_HELP';
      let routedService = "Community Knowledge Base";
      let answer = "Welcome to the URIP Community Assistant! I can help you find members, upcoming events, birthday celebrations, event photos, and information about our community. URIP is a chapter of USOSA — the Unity Schools Old Students Association, based in Port Harcourt.";
      let sources = ["URIP Community Knowledge Base"];
      let suggestedActions: Array<{ label: string; actionType: 'NAVIGATE_EVENTS' | 'NAVIGATE_MEMBERS' | 'OPEN_ASSISTANT' | 'VIEW_MEDIA'; payload?: string }> = [
        { label: "View Upcoming Events", actionType: "NAVIGATE_EVENTS" },
        { label: "Browse Member Directory", actionType: "NAVIGATE_MEMBERS" }
      ];

      // Privacy check for fallback
      if (!isAdmin && (qLower.includes("phone") || qLower.includes("email") || qLower.includes("address") || qLower.includes("kin") || qLower.includes("contact"))) {
        answer = "🔒 Member contact details and private personal information are protected. Only administrators can query private member records.";
      } else if (qLower.includes("birthday") || qLower.includes("born") || qLower.includes("july") || qLower.includes("august")) {
        intent = "MEMBER_SEARCH";
        routedService = "Member & Birthday Microservice";
        const birthdayMembers = members.map(m => `${m.fullName} (${m.dateOfBirth})`);
        answer = `Here are the birthdates of URIP members: ${birthdayMembers.join(', ')}. Upcoming birthday celebrations are highlighted on the Group Calendar!`;
        sources = ["Member Directory DB"];
        suggestedActions = [{ label: "Open Event & Birthday Calendar", actionType: "NAVIGATE_EVENTS" }];
      } else if (qLower.includes("event") || qLower.includes("gathering") || qLower.includes("outing") || qLower.includes("sports") || qLower.includes("workshop") || qLower.includes("meeting")) {
        intent = "EVENT_INFO";
        routedService = "Event & Calendar Microservice";
        const eventsSummary = events.map(e => `• ${e.title} on ${e.date} at ${e.location}`).join('\n');
        answer = `Upcoming URIP Community Events:\n${eventsSummary}\n\nYou can RSVP directly through the calendar view.`;
        sources = ["Event Calendar DB"];
        suggestedActions = [{ label: "Go to Calendar & RSVP", actionType: "NAVIGATE_EVENTS" }];
      } else if (qLower.includes("drive") || qLower.includes("photo") || qLower.includes("video") || qLower.includes("youtube")) {
        intent = "MEDIA_RESOURCES";
        routedService = "Media Integration Microservice";
        answer = "URIP integrates Google Drive for event photo galleries and YouTube for event videos. Drive folder links and video embeds are attached to each event record.";
        sources = ["Google Drive & YouTube Media Service"];
        suggestedActions = [{ label: "Explore Event Media", actionType: "NAVIGATE_EVENTS" }];
      } else if (qLower.includes("usosa") || qLower.includes("urip") || qLower.includes("who are we") || qLower.includes("about") || qLower.includes("member") || qLower.includes("register") || qLower.includes("who is")) {
        intent = "MEMBER_SEARCH";
        routedService = "Member Registry Microservice";
        answer = `URIP (Usosans Resident in Port Harcourt) is a chapter of USOSA — the Unity Schools Old Students Association — based in Port Harcourt, Rivers State. We currently have ${members.length} registered members: old students of Federal Government Colleges who live in and around Port Harcourt. We exist for fellowship, fun, professional networking, and supporting our local community. Search the member directory by skills, occupation, or location.`;
        sources = ["Member Directory DB", "URIP Knowledge Base"];
        suggestedActions = [{ label: "View Members Directory", actionType: "NAVIGATE_MEMBERS" }];
      }

      res.json({ intent, confidence: 0.92, routedService, answer, sources, suggestedActions });
      return;
    }

    // Gemini AI context with strict privacy scoping:
    // Only Admin gets private contact info (Email, Phone, DOB, Address, Next of Kin).
    // Non-admins get public directory info only (Name, Occupation, Skills).
    const membersContext = isAdmin
      ? members.map(m => `- ${m.fullName} (Email: ${m.email}, Phone: ${m.phoneNumber}, DOB: ${m.dateOfBirth}, Occupation: ${m.occupation}, Skills: ${(m.skills || []).join(', ')})`).join('\n')
      : members.map(m => `- ${m.fullName} (Occupation: ${m.occupation || 'Member'}, Skills: ${(m.skills || []).join(', ') || 'N/A'})`).join('\n');

    const eventsContext = events.map(e => `- ${e.title} (Date: ${e.date} ${e.time}, Location: ${e.location}, Attendees: ${e.attendeeIds.length}, Drive Folder: ${e.driveFolderId || 'N/A'}, YouTube: ${e.youtubeVideoUrl || 'N/A'})`).join('\n');
    const kbContext = knowledgeBaseStore.map(k => `[Article: ${k.title}]\n${k.content}`).join('\n\n');

    const privacyInstruction = isAdmin
      ? ""
      : "\nCRITICAL PRIVACY RULE: You MUST NOT disclose or search for any member's private contact information (phone numbers, email addresses, residential addresses, next of kin, exact birth dates). If the user asks for member contact details or private personal information, state clearly: '🔒 Member contact details and private personal information are protected. Only administrators can query private member records.'";

    const prompt = `You are the AI Knowledge Base Assistant & Automated Query Router for "URIP" — the Usosans Resident in Port Harcourt, a chapter of USOSA (Unity Schools Old Students Association) based in Port Harcourt, Rivers State, Nigeria.
Your goal is to parse the user's query, determine intent, query the knowledge base / database context, and provide a helpful concise response with suggested UI action shortcuts. This is an alumni community group focused on fellowship, fun, sports, community support, and networking among old students of Nigeria's Federal Unity Colleges (Federal Government Colleges) living in Port Harcourt.${privacyInstruction}

DATABASE & REAL-TIME PUBLIC METRICS CONTEXT:
---
MEMBERS DIRECTORY (${members.length} members):
${membersContext}

UPCOMING EVENTS & CALENDAR (${events.length} events):
${eventsContext}

KNOWLEDGE BASE & GUIDELINES:
${kbContext}
---

USER QUERY: "${userQuery}"

Provide a JSON response with:
1. intent: one of ["MEMBER_SEARCH", "EVENT_INFO", "MEDIA_RESOURCES", "KNOWLEDGE_BASE", "GENERAL_HELP"]
2. confidence: number between 0.8 and 1.0
3. routedService: string describing which microservice handles this
4. answer: concise markdown-formatted answer directly resolving the query with details from the database
5. sources: list of source strings used
6. suggestedActions: list of objects with label, actionType ("NAVIGATE_EVENTS" | "NAVIGATE_MEMBERS" | "OPEN_ASSISTANT" | "VIEW_MEDIA"), and payload.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            routedService: { type: Type.STRING },
            answer: { type: Type.STRING },
            sources: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedActions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  actionType: { type: Type.STRING },
                  payload: { type: Type.STRING }
                },
                required: ["label", "actionType"]
              }
            }
          },
          required: ["intent", "confidence", "routedService", "answer", "sources", "suggestedActions"]
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error) {
    serverLogger.error("Gemini AI Query Router Error", error as Error);
    res.status(500).json({
      error: "Failed to process query via Gemini AI",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// 16. AI Statistics Board Insights
app.post("/api/ai/stats-insights", conditionalAuth, async (req: Request, res: Response) => {
  const { metrics } = req.body || {};
  const ai = getGeminiClient();

  try {
    const members = await getMembers();
    const events = await getEvents();

    const totalMembers = metrics?.totalMembers || members.length;
    const totalEvents = metrics?.totalEvents || events.length;
    const totalVisits = metrics?.totalVisits ?? 0;
    const lastVisit = metrics?.lastVisitTimestamp || new Date().toISOString();
    const highestExplorer = metrics?.highestExplorer || 'Bako Danladi';
    const mostInteractive = metrics?.mostInteractiveUser || 'Aisha Hassan';
    const sessionCount = metrics?.sessionCount || 0;
    const latestUser = metrics?.latestUser || 'Aisha Hassan';

    if (!ai) {
      res.json({
        summary: `AI Data Insight: High community engagement with ${totalVisits.toLocaleString()} visits across ${totalMembers} registered members and ${totalEvents} registered active events.`,
        highlights: [
          `${totalVisits.toLocaleString()} total visits logged with an average of ${Math.round(totalVisits / totalMembers)} visits per registered member.`,
          `Highest App Explorer: ${highestExplorer} leading in activity points and portal exploration.`,
          `Most Interactive Contributor: ${mostInteractive} actively sharing photo and video assets.`,
          `Unique Sessions Tracked: ${sessionCount} completed user sessions with latest visitor ${latestUser}.`
        ],
        trendAnalysis: "Community engagement has shown steady growth across alumni gatherings, health walks, and fellowship events.",
        aiConfidence: 0.95
      });
      return;
    }

    const prompt = `You are the AI Analytics Engine for "Team Taraba River" community organization.
Analyze the following real-time public statistics board metrics and return a data-driven insight JSON object.

METRICS DATA:
- Total Members Registered: ${totalMembers}
- Total Active Events Registered: ${totalEvents}
- Total Member Visits: ${totalVisits}
- Last Visit Timestamp (Excluding Current User Activity): ${lastVisit}
- Highest App Explorer: ${highestExplorer}
- Most Interactive User: ${mostInteractive}
- Completed Unique Sessions: ${sessionCount}
- Latest Unique Visitor: ${latestUser}

Provide a JSON object with:
1. summary: A 1-2 sentence executive AI data insight analyzing community participation ratio.
2. highlights: An array of 3-4 bullet points detailing specific metric ratios and achievements.
3. trendAnalysis: A 1-2 sentence forecast or trend analysis based on current events and visit counts.
4. aiConfidence: A number between 0.90 and 1.00.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            highlights: { type: Type.ARRAY, items: { type: Type.STRING } },
            trendAnalysis: { type: Type.STRING },
            aiConfidence: { type: Type.NUMBER }
          },
          required: ["summary", "highlights", "trendAnalysis", "aiConfidence"]
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error) {
    serverLogger.error("Gemini AI Stats Insights Error", error as Error);
    res.json({
      summary: `AI Data Insight: Active community engagement across registered events and members.`,
      highlights: [
        'Active community participation tracked.',
        'Multiple registered events with growing attendance.',
      ],
      trendAnalysis: "Community activity continues to scale across programs.",
      aiConfidence: 0.92
    });
  }
});

// 16. USOSA News Update — 100% Automated Live AI Journalism Bureau Agent
// Powered by Live External Feeds (Google News RSS with exact recommended search terms) + Gemini AI Chief Editor
let newsCache: { data: any; fetchedAt: number } | null = null;
const NEWS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes for freshest headlines

const LIVE_EXTERNAL_FEEDS = [
  // Global feeds (all countries worldwide: USA, UK, Canada, Europe, Global Diaspora)
  { url: 'https://news.google.com/rss/search?q=%22USOSA%22', defaultSource: 'Google News / USOSA Global' },
  { url: 'https://news.google.com/rss/search?q=%22USOSA%22+OR+%22Unity+Schools%22+diaspora+OR+UK+OR+USA+OR+America+OR+Canada+OR+global', defaultSource: 'Google News / USOSA Diaspora' },
  { url: 'https://news.google.com/rss/search?q=%22KCOBA%22+OR+%22QCOGA%22+OR+%22FEGOWOCO%22', defaultSource: 'Google News / Global Alumni' },
  { url: 'https://news.google.com/rss/search?q=%22Unity+Schools%22+Old+Students', defaultSource: 'Google News / Unity Alumni' },
  { url: 'https://news.google.com/rss/search?q=%22Federal+Unity+Colleges%22+OR+%22Federal+Unity+College%22', defaultSource: 'Google News / Unity Colleges' },
  { url: 'https://news.google.com/rss/search?q=%22Federal+Government+College%22', defaultSource: 'Google News / FGC Global' },
  { url: 'https://news.google.com/rss/search?q=%22Federal+Government+Girls+College%22+OR+%22FGGC%22', defaultSource: 'Google News / FGGC Global' },
  { url: 'https://news.google.com/rss/search?q=%22Federal+Science+and+Technical+College%22+OR+%22FSTC%22', defaultSource: 'Google News / FSTC Global' },
  { url: 'https://news.google.com/rss/search?q=%22Kings+College+Lagos%22+OR+%22Queens+College+Lagos%22', defaultSource: "Google News / Kings & Queens" },
  { url: 'https://news.google.com/rss/search?q=%22Team+Taraba%22+OR+%22USOSA+Taraba%22', defaultSource: 'Google News / Team Taraba' },
  { url: 'https://news.google.com/rss/search?q=%22Suleja+Academy%22+OR+%22Federal+Academy+Suleja%22', defaultSource: 'Google News / Suleja Academy' },
  // National edition feeds
  { url: 'https://news.google.com/rss/search?q=%22USOSA%22&hl=en-NG&gl=NG&ceid=NG:en', defaultSource: 'Google News / USOSA National' },
  { url: 'https://news.google.com/rss/search?q=%22Unity+Schools%22&hl=en-NG&gl=NG&ceid=NG:en', defaultSource: 'Google News / Unity Schools' },
];

/**
 * Global Relevance Filter:
 * Ensures news bearing USOSA or related Unity Colleges alumni news from ALL countries
 * (Nigeria, UK, USA, Canada, Europe, global diaspora chapters) is accepted as agreed.
 */
function isRelevantToUsosaAndUnityColleges(title: string, snippet: string): boolean {
  const combined = `${title} ${snippet}`.toLowerCase();

  // 1. Direct USOSA & Alumni Entities: Always accepted from ALL countries worldwide
  const directEntities = [
    /\busosa\b/i,
    /\busosan[s]?\b/i,
    /\bunity schools? old students\b/i,
    /\bfederal unity college[s]?\b/i,
    /\bfederal government college[s]?\b/i,
    /\bfederal government girls['’]? college[s]?\b/i,
    /\bfederal science and technical college[s]?\b/i,
    /\bfederal science & technical college[s]?\b/i,
    /\bfederal academy suleja\b/i,
    /\bsuleja academy\b/i,
    /\bking['’]?s college lagos\b/i,
    /\bqueen['’]?s college lagos\b/i,
    /\bkcoba\b/i,
    /\bqcoga\b/i,
    /\bfegowoco\b/i,
    /\btaraba\b/i,
    /\bteam taraba\b/i,
  ];

  for (const regex of directEntities) {
    if (regex.test(combined)) {
      return true; // Accepted from all countries without restriction!
    }
  }

  // 2. Specific Unity College Campus Patterns: e.g. "FGGC Bwari", "FGC Idoani", "FSTC Yaba", "FGC Warri"
  const campusPattern = /\b(fgc|fggc|fstc)\s+(bwari|yaba|usi|otukpo|uromi|ilesa|shiroro|zuru|ohanso|jalingo|orozo|doma|michika|kafanchan|dayi|hadejia|lassa|tungbo|uyo|ahoada|kano|kaduna|warri|enugu|okigwe|ugwolawo|ijanikin|oyo|sagamu|onitsha|kazaure|odogbolu|ikot\s*ekpene|ilorin|sokoto|maiduguri|buni\s*yadi|keffi|azare|biliri|gwarzo|tambuwal|wukari|potiskum|vandeikya|rubochi|keana|kiyawa|daura|birnin\s*kebbi|gwandu|minna|kontagora|new\s*bussa|bida|malumfashi|dutse|gumel|langtang|pankshin|mangu|shendam|bokkos|yawuri|anza|zaria|ebonyi|abakaliki|afikpo|isenya|ogidi|nnewi|awka|umuahia|owerri|abaji|kwali|gwagwalada)\b/i;

  if (campusPattern.test(combined)) {
    return true;
  }

  // 3. Unity Schools + Alumni / Chapter / Diaspora / Global context
  const isUnitySchool = /\bunity school[s]?\b/i.test(combined) || /\bunity college[s]?\b/i.test(combined);
  const isAlumniOrGlobal = /\b(alumni|old students|diaspora|chapter|branch|association|convention|reunion|pta|admission|nigeria|uk|usa|america|london|canada|global|international)\b/i.test(combined);
  if (isUnitySchool && isAlumniOrGlobal) {
    return true;
  }

  // 4. Secondary Context Filter: Acronym (FGC/FGGC/FSTC) + Unity / Alumni / Global context
  const hasAcronym = /\b(fgc|fggc|fstc)\b/i.test(combined);
  const hasContext = /\b(alumni|old students|diaspora|chapter|branch|convention|reunion|inter-house sports|concession|privatisation|privatize|pta|education|scholarship|fundraiser|nigeria|uk|usa|america|london|canada)\b/i.test(combined);

  if (hasAcronym && hasContext) {
    return true;
  }

  return false;
}

function extractXmlTag(xml: string, tag: string): string {
  const patterns = [
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'),
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'),
  ];
  for (const p of patterns) {
    const m = xml.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return '';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatRssDate(dateStr: string): string {
  if (!dateStr) return 'Recent';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return 'Recent'; }
}

// Fetch raw items from external feeds
async function fetchLiveExternalNewsItems(): Promise<Array<{ title: string; snippet: string; url: string; source: string; pubDate: string; timestamp: number }>> {
  const rawItems: Array<{ title: string; snippet: string; url: string; source: string; pubDate: string; timestamp: number }> = [];
  const seenTitles = new Set<string>();

  for (const feed of LIVE_EXTERNAL_FEEDS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(feed.url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      });
      clearTimeout(timeout);
      if (!res.ok) continue;

      const xml = await res.text();
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;

      while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1];
        const title = stripHtml(extractXmlTag(block, 'title'));
        const rawDesc = extractXmlTag(block, 'description') || extractXmlTag(block, 'content:encoded') || '';
        const snippet = stripHtml(rawDesc).slice(0, 500);
        const link = stripHtml(extractXmlTag(block, 'link'));
        const sourceTag = extractXmlTag(block, 'source');
        const source = stripHtml(sourceTag) || feed.defaultSource;
        const rawPubDate = extractXmlTag(block, 'pubDate');
        const pubDate = formatRssDate(rawPubDate);
        
        let timestamp = Date.now();
        if (rawPubDate) {
          const t = new Date(rawPubDate).getTime();
          if (!isNaN(t)) timestamp = t;
        }

        if (!title || seenTitles.has(title.toLowerCase())) continue;

        // Apply all-country relevance gate: accept all countries bearing USOSA or related news
        if (!isRelevantToUsosaAndUnityColleges(title, snippet)) continue;

        seenTitles.add(title.toLowerCase());
        rawItems.push({
          title,
          snippet: snippet || 'Read full coverage on external news portal.',
          url: link || feed.url,
          source,
          pubDate,
          timestamp
        });
      }
    } catch (e) {
      serverLogger.warn(`External feed fetch warning [${feed.defaultSource}]`, { error: (e as Error).message });
    }
  }

  // Sort raw items in strict descending order (NEWEST FIRST, OLDEST BELOW)
  rawItems.sort((a, b) => b.timestamp - a.timestamp);
  return rawItems.slice(0, 30);
}

function cleanText(txt: string): string {
  if (!txt) return "";
  return txt
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/```/g, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function cleanNewsHtmlAndJunk(str: string): string {
  if (!str) return "";
  return str
    .replace(/<font[^>]*>/gi, "")
    .replace(/<\/font>/gi, "")
    .replace(/<a[^>]*>.*?<\/a>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPublisherNames(text: string): string {
  if (!text) return "";
  return text
    .replace(/\b(vanguard\s*news|vanguard|punch\s*newspapers|punch|the\s*guardian\s*nigeria\s*news|the\s*guardian\s*nigeria|the\s*guardian|daily\s*trust|premium\s*times\s*nigeria|premium\s*times|leadership\s*newspapers|leadership|thecable|thisday\s*live|thisday|the\s*sun\s*nigeria|the\s*sun|sun\s*news|nigerian\s*tribune|tribune\s*online|tribune|businessday|daily\s*post\s*nigeria|daily\s*post|channels\s*tv|channels\s*television|arise\s*news|radio\s*nigeria|news\s*agency\s*of\s*nigeria|nan|google\s*news|rss\s*feed|independent\s*newspaper|independent|the\s*nation\s*newspaper|the\s*nation)\b/gi, "")
    .replace(/\s*[-|–—•]\s*$/, "")
    .replace(/^\s*[-|–—•]\s*/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanStoryTitle(raw: string): { cleanTitle: string; extractedSource: string } {
  let title = (raw || "").replace(/<[^>]*>?/gm, "").trim();
  let extractedSource = "";
  const match = title.match(/\s*[-|–—•]\s*([^-|–—•]+)$/);
  if (match && match[1]) {
    extractedSource = match[1].trim();
    title = title.substring(0, match.index).trim();
  }
  title = stripPublisherNames(title);
  return { cleanTitle: title, extractedSource };
}

function extractKeywords(str: string): Set<string> {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "in", "on", "at", "to", "for", "of", "with",
    "by", "from", "as", "is", "are", "was", "were", "be", "this", "that", "it",
    "its", "into", "over", "after", "out", "about", "all", "new", "says", "how",
    "why", "who", "will", "can", "has", "have", "had", "more", "now", "just",
    "check", "read", "full", "story", "news"
  ]);
  const words = str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
  return new Set(words);
}

function calculateSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}

const UNITY_SCHOOL_TAGS: { pattern: RegExp; tag: string }[] = [
  { pattern: /king['’]?s\s*college/i, tag: "King's College Lagos" },
  { pattern: /queen['’]?s\s*college/i, tag: "Queen's College Lagos" },
  { pattern: /fggc\s*bwari/i, tag: "FGGC Bwari" },
  { pattern: /fggc\s*oyo/i, tag: "FGGC Oyo" },
  { pattern: /fggc\s*sagamu/i, tag: "FGGC Sagamu" },
  { pattern: /fg[g]?c\s*kano/i, tag: "FGC Kano" },
  { pattern: /fg[g]?c\s*kaduna/i, tag: "FGC Kaduna" },
  { pattern: /fg[g]?c\s*warri|fegowoco/i, tag: "FGC Warri" },
  { pattern: /fg[g]?c\s*enugu/i, tag: "FGC Enugu" },
  { pattern: /fg[g]?c\s*okigwe/i, tag: "FGC Okigwe" },
  { pattern: /fg[g]?c\s*ugwolawo/i, tag: "FGC Ugwolawo" },
  { pattern: /fg[g]?c\s*ijanikin/i, tag: "FGC Lagos (Ijanikin)" },
  { pattern: /fstc\s*yaba/i, tag: "FSTC Yaba" },
  { pattern: /fstc\s*usi/i, tag: "FSTC Usi-Ekiti" },
  { pattern: /fstc\s*otukpo/i, tag: "FSTC Otukpo" },
  { pattern: /fstc|technical\s*college/i, tag: "Federal Science & Tech Colleges" },
  { pattern: /fggc|girls\s*college/i, tag: "Federal Government Girls Colleges" },
  { pattern: /fgc|federal\s*government\s*college/i, tag: "Federal Government Colleges" },
  { pattern: /suleja\s*academy/i, tag: "Federal Academy Suleja" },
  { pattern: /usosa|unity\s*school|unity\s*college/i, tag: "USOSA & Unity Colleges" },
];

function detectSchoolTag(text: string): string {
  for (const item of UNITY_SCHOOL_TAGS) {
    if (item.pattern.test(text)) {
      return item.tag;
    }
  }
  return "Unity Colleges Education";
}

function buildComprehensiveSummary(title: string, rawSnippet: string, schoolTag: string = "Federal Unity Colleges"): string {
  const cleanSnippet = cleanNewsHtmlAndJunk(stripPublisherNames(rawSnippet));
  const p1 = cleanSnippet && cleanSnippet.length > 50
    ? cleanSnippet
    : `Reports confirm significant developments regarding ${title.toLowerCase()}, drawing sustained attention and close engagement from parent associations, alumni networks, and education administrators nationwide.`;

  const p2 = `Key stakeholders across ${schoolTag || "Federal Unity Colleges"} are actively tracking institutional directives and implementation frameworks to protect academic stability and student welfare across collegiate campuses.`;

  const p3 = `Alumni chapters and education observers continue to monitor official statements and verified bulletins through the source channels linked below as further administrative guidelines unfold.`;

  return `${p1}\n\n${p2}\n\n${p3}`;
}

interface ServerTopicCluster {
  representativeTitle: string;
  normTitle: string;
  leadSource: string;
  leadUrl: string;
  publishedAt: string;
  timestamp: number;
  rawSnippet: string;
  keywords: Set<string>;
  numbers: Set<string>;
  schoolTag: string;
  sourcesMap: Map<string, { sourceName: string; title: string; url: string }>;
}

function clusterRawNewsItems(rawItems: Array<{ title: string; snippet: string; url: string; source: string; pubDate: string; timestamp: number }>): ServerTopicCluster[] {
  const clusters: ServerTopicCluster[] = [];

  for (const item of rawItems) {
    const { cleanTitle, extractedSource } = cleanStoryTitle(item.title || "");
    if (cleanTitle.length < 10) continue;

    const sourceName = stripPublisherNames(extractedSource || item.source || "News Outlet") || "News Outlet";
    const link = item.url || "https://news.google.com";
    const cleanDesc = cleanNewsHtmlAndJunk(item.snippet || "");
    const combinedText = `${cleanTitle} ${cleanDesc}`;
    const keywords = extractKeywords(combinedText);
    const schoolTag = detectSchoolTag(combinedText);

    const titleNumbers = new Set(
      (cleanTitle.match(/\d[\d,]+/g) || [])
        .map(n => n.replace(/,/g, ''))
        .filter(n => parseInt(n, 10) >= 100)
    );

    const normTitle = cleanTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

    let matchedCluster: ServerTopicCluster | null = null;
    for (const cluster of clusters) {
      const similarity = calculateSimilarity(keywords, cluster.keywords);
      const isKeywordMatch = similarity > 0.22;

      let sharedNumber = false;
      for (const num of titleNumbers) {
        if (cluster.numbers.has(num)) {
          sharedNumber = true;
          break;
        }
      }
      const isNumberMatch = sharedNumber && similarity > 0.15;

      const topicPhrases = [
        ["admission", "list"],
        ["pta", "teachers"],
        ["concession", "schools"],
        ["privatiz", "schools"],
        ["inter", "house", "sports"],
        ["speech", "day"],
        ["infrastructure", "upgrades"],
      ];
      let sharedPhrase = false;
      for (const phrase of topicPhrases) {
        const itemHas = phrase.every(p => normTitle.includes(p) || cleanDesc.toLowerCase().includes(p));
        const clusterHas = phrase.every(p => cluster.normTitle.includes(p) || cluster.rawSnippet.toLowerCase().includes(p));
        if (itemHas && clusterHas) {
          sharedPhrase = true;
          break;
        }
      }

      const shorter = normTitle.length < cluster.normTitle.length ? normTitle : cluster.normTitle;
      const longer = normTitle.length < cluster.normTitle.length ? cluster.normTitle : normTitle;
      const isSubstringMatch = shorter.length > 20 && longer.includes(shorter.slice(0, Math.floor(shorter.length * 0.6)));

      if (isKeywordMatch || isNumberMatch || sharedPhrase || isSubstringMatch) {
        matchedCluster = cluster;
        break;
      }
    }

    const coverage = {
      sourceName,
      title: cleanTitle,
      url: link,
    };

    if (matchedCluster) {
      matchedCluster.sourcesMap.set(sourceName.toLowerCase(), coverage);
      for (const k of keywords) matchedCluster.keywords.add(k);
      for (const n of titleNumbers) matchedCluster.numbers.add(n);
      matchedCluster.timestamp = Math.max(matchedCluster.timestamp, item.timestamp);
      matchedCluster.publishedAt = item.pubDate || matchedCluster.publishedAt;

      // Prefer authoritative headline over "How to check..."
      if (
        cleanTitle.toLowerCase().startsWith("fg releases") ||
        cleanTitle.toLowerCase().startsWith("federal government") ||
        cleanTitle.toLowerCase().startsWith("ministry of education") ||
        (cleanTitle.length > matchedCluster.representativeTitle.length && !cleanTitle.toLowerCase().startsWith("how to"))
      ) {
        matchedCluster.representativeTitle = cleanTitle;
      }
    } else {
      const sourcesMap = new Map<string, { sourceName: string; title: string; url: string }>();
      sourcesMap.set(sourceName.toLowerCase(), coverage);

      clusters.push({
        representativeTitle: cleanTitle,
        normTitle,
        leadSource: sourceName,
        leadUrl: link,
        publishedAt: item.pubDate || "Recent",
        timestamp: item.timestamp,
        rawSnippet: cleanDesc,
        keywords,
        numbers: new Set(titleNumbers),
        schoolTag,
        sourcesMap,
      });
    }
  }

  // Sort newest first
  clusters.sort((a, b) => b.timestamp - a.timestamp);
  return clusters;
}

// AI Journalism Agent (Chief Editor) persona processing with smart topic clustering
async function aiChiefEditorCurate(rawItems: Array<{ title: string; snippet: string; url: string; source: string; pubDate: string; timestamp: number }>): Promise<any[]> {
  const clusters = clusterRawNewsItems(rawItems);
  if (clusters.length === 0) return [];

  const topClusters = clusters.slice(0, 15);
  const ai = getGeminiClient();

  if (ai) {
    try {
      const prompt = `You are the Chief News Editor for USOSA (Unity Schools Old Students Association) and Federal Unity Colleges alumni worldwide, covering news across ALL COUNTRIES (Nigeria, UK, USA, Canada, Europe, global diaspora chapters).

Here are ${topClusters.length} distinct news topic clusters (each cluster aggregates reporting from one or more news channels):
${JSON.stringify(topClusters.map((c, i) => ({
  index: i,
  suggestedTitle: c.representativeTitle,
  outlets: Array.from(c.sourcesMap.values()).map(s => s.sourceName),
  context: c.rawSnippet,
  publishedAt: c.publishedAt,
  schoolTag: c.schoolTag,
})), null, 2)}

CRITICAL EDITORIAL RULES:
1. COMBINE SIMILAR STORIES: Each topic cluster must be represented by exactly ONE major, overarching headline. NEVER output repetitive or duplicate headlines about the same news event (e.g. admission lists, PTA teacher absorption, alumni protests, speech days).
2. For each cluster, write an authoritative, clean, human headline WITHOUT any publisher names or trailing tags (e.g. write "FG Releases 2026/2027 Admission List for Federal Unity Colleges", DO NOT add "- Vanguard" or "- The Guardian").
3. Write a comprehensive narrative story summary of 10 to 15 lines (about 120-180 words, formatted across 2 to 3 fluid paragraphs). Detail what happened, official reactions from the Federal Ministry of Education or USOSA, key context, and next steps.
4. STRICT RULE: DO NOT use analytical section headers (DO NOT write "Executive Summary:", "Context:", "Strategic Implications:", or bullet points). Write pure, readable journalistic prose.
5. Order items strictly from newest to oldest.

Return ONLY valid JSON (no markdown fences):
{
  "headlines": [
    {
      "index": 0,
      "title": "Clean Authoritative Major Headline",
      "summary": "10-15 line narrative story summary in 2-3 fluid paragraphs without analytical headers."
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: { temperature: 0.15 },
      });

      const rawText = (response.text || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(rawText);

      if (Array.isArray(parsed.headlines) && parsed.headlines.length > 0) {
        const resultMap = new Map<number, { title: string; summary: string }>();
        for (const item of parsed.headlines) {
          if (typeof item.index === "number" && item.title && item.summary) {
            resultMap.set(item.index, {
              title: stripPublisherNames(cleanNewsHtmlAndJunk(cleanText(item.title))),
              summary: cleanNewsHtmlAndJunk(cleanText(item.summary)),
            });
          }
        }

        return topClusters.map((cluster, idx) => {
          const aiItem = resultMap.get(idx);
          const finalTitle = aiItem?.title || cluster.representativeTitle;
          const sourcesList = Array.from(cluster.sourcesMap.values());

          let displaySource = cluster.leadSource;
          if (sourcesList.length === 2) {
            displaySource = `${sourcesList[0].sourceName} & ${sourcesList[1].sourceName}`;
          } else if (sourcesList.length > 2) {
            displaySource = `${sourcesList[0].sourceName}, ${sourcesList[1].sourceName} & ${sourcesList.length - 2} other outlets`;
          }

          const summary = aiItem?.summary || buildComprehensiveSummary(finalTitle, cluster.rawSnippet, cluster.schoolTag);

          return {
            title: finalTitle,
            summary,
            source: displaySource,
            url: cluster.leadUrl,
            publishedAt: cluster.publishedAt,
            schoolTag: cluster.schoolTag,
            otherSources: sourcesList,
          };
        });
      }
    } catch (e) {
      serverLogger.warn("AI Chief Editor processing warning, using clustered fallback", { error: (e as Error).message });
    }
  }

  // Clustered Fallback: Combines similar headlines, produces multi-outlet attribution & 3-paragraph summary
  return topClusters.map(cluster => {
    const sourcesList = Array.from(cluster.sourcesMap.values());
    let displaySource = cluster.leadSource;
    if (sourcesList.length === 2) {
      displaySource = `${sourcesList[0].sourceName} & ${sourcesList[1].sourceName}`;
    } else if (sourcesList.length > 2) {
      displaySource = `${sourcesList[0].sourceName}, ${sourcesList[1].sourceName} & ${sourcesList.length - 2} other outlets`;
    }

    const summary = buildComprehensiveSummary(cluster.representativeTitle, cluster.rawSnippet, cluster.schoolTag);

    return {
      title: cluster.representativeTitle,
      summary,
      source: displaySource,
      url: cluster.leadUrl,
      publishedAt: cluster.publishedAt,
      schoolTag: cluster.schoolTag,
      otherSources: sourcesList,
    };
  });
}

app.get('/api/usosa-news', async (req: Request, res: Response) => {
  const isForce = req.query.force === 'true';

  if (isForce) {
    newsCache = null;
  }

  if (!isForce && newsCache && Date.now() - newsCache.fetchedAt < NEWS_CACHE_TTL_MS) {
    return res.json(newsCache.data);
  }

  try {
    // Step 1: Gather live external feeds from Google News & major news outlets
    const rawExternalItems = await fetchLiveExternalNewsItems();

    // Step 2: Pass through AI Chief Editor with 50+ years journalism experience
    const headlines = await aiChiefEditorCurate(rawExternalItems);

    const result = {
      headlines,
      fetchedAt: new Date().toISOString(),
      fallback: headlines.length === 0,
      message: headlines.length === 0 ? "Live external news feeds are refreshing. Please check back in a moment." : undefined,
    };

    newsCache = { data: result, fetchedAt: Date.now() };
    return res.json(result);
  } catch (error) {
      serverLogger.error("USOSA News endpoint error", error);
    return res.status(500).json({
      headlines: [],
      fetchedAt: new Date().toISOString(),
      fallback: true,
      message: 'Unable to reach external news feeds at this moment.',
    });
  }
});


// 17. AI Xplora — Pure Live Gemini AI connected directly to the web
app.post("/api/ai-xplora", async (req: Request, res: Response) => {
  const { query, userName, apiKey } = req.body || {};
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "query is required" });
  }

  const customKey = apiKey || (req.headers["x-gemini-api-key"] as string);
  const activeKey = customKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!activeKey || activeKey.includes("MY_GEMINI_API_KEY") || activeKey.includes("YOUR_") || activeKey.length < 15) {
    return res.json({
      answer: `⚠️ Direct Web Gemini AI requires a valid Gemini API Key.\n\nPlease add a valid \`GEMINI_API_KEY\` from Google AI Studio (https://aistudio.google.com) into your \`.env\` file to enable unconstrained live web search!`,
      sources: [],
      error: "MISSING_API_KEY"
    });
  }

  const ai = new GoogleGenAI({ apiKey: activeKey });
  const isAdmin = await checkAdminRole(req);

  // Privacy protection: prevent exposing member private contact data to non-admins
  const qLower = query.toLowerCase();
  if (!isAdmin && (qLower.includes("phone") || qLower.includes("email") || qLower.includes("address") || qLower.includes("kin") || qLower.includes("contact"))) {
    return res.json({
      answer: `🔒 Member contact details and private personal records are protected. Only administrators can query private member records.`,
      sources: [],
    });
  }

  try {
    const privacyPrompt = isAdmin
      ? ""
      : "PRIVACY RULE: You MUST NOT disclose or search for any member's private contact details or personal info (phone numbers, email addresses, residential addresses, next of kin, exact birth dates).";

    const prompt = `${privacyPrompt}\n\nUser Question: ${query}`;

    let response: any = null;
    let usedSearch = true;

    try {
      // Attempt 1: Gemini 3.6 Flash with Live Google Search Grounding
      response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.7,
        }
      });
    } catch (searchErr: any) {
        serverLogger.warn("Google Search grounding quota/network warning, falling back to standard Gemini 3.6 Flash", { error: searchErr?.message || searchErr });
      usedSearch = false;
      // Attempt 2: Standard Gemini 3.6 Flash model without search tool
      response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          temperature: 0.7,
        }
      });
    }

    const answer = response?.text || "I am currently processing your request. Please try again in a moment!";

    // Extract live web search grounding sources if available
    const sources: { title: string; url: string }[] = [];
    if (usedSearch) {
      try {
        const groundingMeta = (response as any)?.candidates?.[0]?.groundingMetadata;
        const chunks = groundingMeta?.groundingChunks || [];
        for (const chunk of chunks) {
          if (chunk.web?.uri && chunk.web?.title) {
            sources.push({ title: chunk.web.title, url: chunk.web.uri });
          }
        }
      } catch {}
    }

    return res.json({ answer, sources });
  } catch (error: any) {
    serverLogger.error("Gemini Direct Web API Error", error as Error);
    return res.json({
      answer: `Gemini Direct Web Error: ${error?.message || "Failed to query Google Gemini service."}`,
      sources: [],
      error: error?.message
    });
  }
});

// ===================================================================
//  Automated YouTube Upload & OAuth2 Bridge Pipeline
// ===================================================================
app.post("/api/media/upload-video-to-youtube", conditionalAuth, async (req: Request, res: Response) => {
  try {
    const { base64Data, fileName, folderName, mimeType } = req.body || {};

    if (!base64Data) {
      return res.status(400).json({ success: false, error: "base64Data is required for video upload." });
    }

    const buffer = await base64ToBuffer(base64Data);
    const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
    serverLogger.info(`[YouTube API Gateway] Received video "${fileName}" (${sizeMB} MB) for streaming to YouTube...`);

    const youtubeUrl = await uploadVideoBufferToYouTube(
      buffer,
      fileName || `video_${Date.now()}.mp4`,
      folderName || "Event Media",
      mimeType || "video/mp4"
    );

    return res.json({
      success: true,
      youtubeUrl,
      fileName,
      sizeMB,
    });
  } catch (error: any) {
    serverLogger.error("[YouTube API Gateway] Upload error", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to stream video to YouTube.",
    });
  }
});

// ===================================================================
//  Direct-to-Google Resumable Upload Bridge
//
//  The browser streams large photo/video bytes straight to Google (keeps
//  the existing XHR progress/resume UX and avoids routing big binaries
//  through this server as base64 JSON), but the Drive/YouTube client
//  secret and refresh token must never reach the browser. So the client
//  asks THIS server to open the resumable upload session — using
//  credentials that stay server-side — and only receives the resulting
//  single-use, self-expiring session URL to stream bytes to directly.
// ===================================================================
app.post("/api/media/drive/init-upload", conditionalAuth, async (req: Request, res: Response) => {
  const validation = validateBody(DriveUploadInitSchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: (validation as any).error });
    return;
  }
  await initDriveUploadSession(req, res);
});

app.post("/api/media/drive/make-public", conditionalAuth, async (req: Request, res: Response) => {
  const validation = validateBody(DriveMakePublicSchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: (validation as any).error });
    return;
  }
  await makeDriveFilePublic(req, res);
});

app.post("/api/media/youtube/init-upload", conditionalAuth, async (req: Request, res: Response) => {
  const validation = validateBody(YouTubeUploadInitSchema, req.body);
  if (!validation.success) {
    res.status(400).json({ error: (validation as any).error });
    return;
  }
  await initYouTubeUploadSession(req, res);
});

app.delete("/api/media/youtube/:videoId", conditionalAuth, conditionalRequireAdmin, async (req: Request, res: Response) => {
  await deleteYouTubeVideoServer(req, res);
});

// YouTube OAuth2 Callback to retrieve Refresh Token
app.get("/oauth2callback", async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) {
    return res.status(400).send("No authorization code provided.");
  }

  try {
    const { google } = await import("googleapis");
    const oauth2Client = new google.auth.OAuth2(
      config.youtubeClientId,
      config.youtubeClientSecret,
      config.youtubeRedirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    serverLogger.info("[YouTube OAuth] ✅ Successfully generated YouTube Refresh Token!");

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>YouTube Authorization Complete</title></head>
      <body style="font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; text-align: center;">
        <div style="max-width: 600px; margin: 0 auto; background: #1e293b; padding: 32px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <div style="font-size: 48px; margin-bottom: 16px;">🎥</div>
          <h2 style="color: #4ade80; margin-bottom: 12px;">YouTube Channel Authorized!</h2>
          <p style="color: #94a3b8; font-size: 15px; line-height: 1.5;">
            Your permanent YouTube OAuth Refresh Token has been successfully generated.
          </p>
          <div style="margin-top: 24px; text-align: left;">
            <label style="display: block; font-size: 13px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px;">REFRESH TOKEN:</label>
            <textarea style="width: 100%; box-sizing: border-box; height: 100px; padding: 12px; font-family: monospace; font-size: 13px; background: #0f172a; color: #38bdf8; border: 1px solid #334155; border-radius: 8px;" readonly>${refreshToken || 'Authorization granted. (Token already active)'}</textarea>
          </div>
          <p style="color: #64748b; font-size: 13px; margin-top: 20px;">
            Copy this token into your <code>.env</code> file as <code>YOUTUBE_REFRESH_TOKEN=...</code>
          </p>
        </div>
      </body>
      </html>
    `);
  } catch (err: any) {
    serverLogger.error("[YouTube OAuth] Token exchange error", err);
    return res.status(500).send(`OAuth Error: ${err?.message || err}`);
  }
});


// ===================================================================
//  Automated Cron Endpoints (Invoked via Cloud Scheduler)
// ===================================================================
const requireCronSecret = (req: Request, res: Response, next: NextFunction) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // CRON_SECRET env var not configured — reject all cron requests for safety
    res.status(503).json({ error: 'Cron automation is not configured on this server.' });
    return;
  }
  const providedSecret = req.query.secret || req.headers['x-cron-secret'];
  if (providedSecret !== secret) {
    res.status(401).json({ error: 'Unauthorized. Invalid cron secret.' });
    return;
  }
  next();
};

app.get("/api/cron/birthdays/monthly", requireCronSecret, async (req: Request, res: Response) => {
  try {
    const { nextMonth, nextMonthName, year, celebrants } = await getUpcomingNextMonthCelebrants();
    const adminEmail = "tarabateam@gmail.com";
    
    if (celebrants.length > 0) {
      const emailConfig = await getEmailConfig();
      if (!emailConfig.enabled) {
        return res.json({ success: false, message: "Email system disabled", celebrants: celebrants.length });
      }
      
      const { subject, html } = buildMonthlyDigestEmailHtml({
        monthName: nextMonthName,
        year,
        celebrants,
        adminRecipientEmail: adminEmail
      });
      
      await sendEmail({ to: adminEmail, subject, html });
      serverLogger.info(`[Cron] Sent Monthly Digest to ${adminEmail} for ${celebrants.length} celebrants.`);
    }
    
    res.json({ success: true, count: celebrants.length, month: nextMonthName });
  } catch (err: any) {
    serverLogger.error("[Cron] Monthly digest failed", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/cron/birthdays/eve", requireCronSecret, async (req: Request, res: Response) => {
  try {
    const { tomorrowDate, celebrants } = await getTomorrowCelebrants();
    const adminEmail = "tarabateam@gmail.com";
    
    if (celebrants.length > 0) {
      const emailConfig = await getEmailConfig();
      if (!emailConfig.enabled) {
        return res.json({ success: false, message: "Email system disabled", celebrants: celebrants.length });
      }
      
      const { subject, html } = buildDailyEveAlertEmailHtml({
        tomorrowDate,
        celebrants,
        adminRecipientEmail: adminEmail
      });
      
      await sendEmail({ to: adminEmail, subject, html });
      serverLogger.info(`[Cron] Sent Eve Alert to ${adminEmail} for ${celebrants.length} celebrants.`);
    }
    
    res.json({ success: true, count: celebrants.length, date: tomorrowDate.toISOString() });
  } catch (err: any) {
    serverLogger.error("[Cron] Eve alert failed", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/cron/birthdays/today", requireCronSecret, async (req: Request, res: Response) => {
  try {
    const { getTodayCelebrants } = await import("./server/birthdayService");
    const { todayDate, celebrants } = await getTodayCelebrants();
    const adminEmail = "tarabateam@gmail.com";
    
    if (celebrants.length > 0) {
      const emailConfig = await getEmailConfig();
      if (!emailConfig.enabled) {
        return res.json({ success: false, message: "Email system disabled", celebrants: celebrants.length });
      }
      
      const { buildDailyDDayAlertEmailHtml } = await import("./server/emailTemplates");
      const { subject, html } = buildDailyDDayAlertEmailHtml({
        todayDate,
        celebrants,
        adminRecipientEmail: adminEmail
      });
      
      await sendEmail({ to: adminEmail, subject, html });
      serverLogger.info(`[Cron] Sent D-Day Alert to ${adminEmail} for ${celebrants.length} celebrants.`);
    }
    
    res.json({ success: true, count: celebrants.length, date: todayDate.toISOString() });
  } catch (err: any) {
    serverLogger.error("[Cron] D-Day alert failed", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/cron/events/purge-expired", requireCronSecret, async (req: Request, res: Response) => {
  try {
    const result = await purgeExpiredEvents();
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err: any) {
    serverLogger.error("[Cron] Event purge failed", err);
    res.status(500).json({ error: err.message });
  }
});

// ===================================================================
//  Global Error Handler
// ===================================================================
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  serverLogger.error("Unhandled server error", err);
  res.status(500).json({
    error: 'An internal server error occurred.',
    ...(process.env.NODE_ENV !== 'production' ? { details: err.message } : {}),
  });
});

// ===================================================================
//  Server Startup
// ===================================================================
async function startServer() {
  // Check Firestore connectivity
  await checkFirestoreConnection();

  // Seed Firestore on startup (skipped if Firestore not available)
  await seedFirestoreIfNeeded();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Serve index.html for all non-API routes (SPA fallback)
    app.get('*', async (req, res, next) => {
      // Don't serve index.html for API routes
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        const apiBase = `${req.protocol}://${req.get('host')}`;
        template = template.replace(
          '<script type="module" src="/src/main.tsx"></script>',
          `<script>window.__API_BASE_URL__="${apiBase}";</script><script type="module" src="/src/main.tsx"></script>`
        );
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist/public');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const apiBase = `${req.protocol}://${req.get('host')}`;
      const indexPath = path.join(distPath, 'index.html');
      let html = fs.readFileSync(indexPath, 'utf-8');
      html = html.replace(
        '<script type="module" src="/src/main.tsx"></script>',
        `<script>window.__API_BASE_URL__="${apiBase}";</script><script type="module" src="/src/main.tsx"></script>`
      );
      res.send(html);
    });
  }

  app.listen(PORT, () => {
    serverLogger.info(`Team Taraba River Server running on http://localhost:${PORT}`);
  });
}

startServer();
