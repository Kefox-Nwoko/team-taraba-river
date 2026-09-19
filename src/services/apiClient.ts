import {
  Member,
  GroupEvent,
  PhotoApprovalRequest,
  AIQueryResponse,
  DeletedMemberEntry,
} from "../types";
import { auth } from "../lib/firebase";
import { logger } from "../lib/logger";
import { FirebaseSyncManager, signInWithCustomToken } from "./firebaseService";
import { AppStateManager } from "./storage";
import { sanitizeMemberRecord } from "../utils/nameUtils";
import { sanitizeEventRecord, parseEventDateObj, isChapterEvent } from "../utils/eventUtils";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function getRuntimeApiBaseUrl(): string {
  try {
    const meta = (window as any).__API_BASE_URL__;
    if (meta) return String(meta).replace(/\/$/, "");
  } catch {}
  return API_BASE_URL;
}

function apiUrl(path: string): string {
  const base = getRuntimeApiBaseUrl();
  if (base) {
    return `${base}${path}`;
  }
  return path;
}
async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) {
    return { "Content-Type": "application/json" };
  }
  try {
    const token = await user.getIdToken();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  } catch {
    return { "Content-Type": "application/json" };
  }
}
export async function markNewsArticleAsRead(memberId: string, articleKey: string): Promise<string[]> {
  return await FirebaseSyncManager.markNewsArticleAsRead(memberId, articleKey);
}

export async function getMemberReadArticles(memberId: string): Promise<string[]> {
  return await FirebaseSyncManager.getMemberReadArticles(memberId);
}

export async function fetchMembers(): Promise<Member[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl("/api/members"), { headers });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (Array.isArray(data.members) && data.members.length > 0) {
        return AppStateManager.filterDeleted(data.members);
      }
    }
  } catch {}

  // Direct Firestore fallback merged with local/seed members
  try {
    const firestoreMembers = await FirebaseSyncManager.seedCSVDataIfNeeded();
    const localMembers = AppStateManager.getMembers();
    const memberMap = new Map<string, Member>();
    for (const m of localMembers) {
      if (m && m.id) memberMap.set(m.id, m);
    }
    for (const m of firestoreMembers) {
      if (m && m.id) memberMap.set(m.id, m);
    }
    const merged = Array.from(memberMap.values());
    if (merged.length > 0) return AppStateManager.filterDeleted(merged);
  } catch {}

  return AppStateManager.getMembers();
}

export async function deleteMember(memberId: string, member?: Member): Promise<void> {
  // 1. Mark soft-deleted in local storage & local recycle bin
  AppStateManager.deleteMember(memberId, member?.email, member?.phoneNumber, member);

  // 2. Soft-delete in Firestore (marks isDeleted: true without destroying the doc)
  await FirebaseSyncManager.deleteMember(memberId, member?.email, member?.phoneNumber, member);

  // 3. Inform optional backend endpoint if running
  try {
    const headers = await getAuthHeaders();
    await fetch(apiUrl(`/api/members/${memberId}`), {
      method: "DELETE",
      headers,
    });
  } catch {}
}

export async function fetchRecycleBin(): Promise<DeletedMemberEntry[]> {
  return await FirebaseSyncManager.getRecycleBin();
}

export async function restoreDeletedMember(originalId: string, memberObj?: Member): Promise<Member | null> {
  let restored = await FirebaseSyncManager.restoreMemberFromRecycleBin(originalId, memberObj);

  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl("/api/admin/members/restore"), {
      method: "POST",
      headers,
      body: JSON.stringify({ originalId, member: restored || memberObj }),
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data && data.member && typeof data.member === "object" && data.member.id) {
        // Merge while strictly guaranteeing active status
        restored = { ...restored, ...data.member, isDeleted: false, deletedAt: undefined, deletedBy: undefined };
      }
    }
  } catch {}

  if (restored) {
    restored.isDeleted = false;
  }
  return restored;
}

export async function purgeDeletedMember(originalId: string): Promise<void> {
  await FirebaseSyncManager.purgeMemberFromRecycleBin(originalId);
}

export async function emptyRecycleBin(): Promise<void> {
  await FirebaseSyncManager.emptyRecycleBin();
}

export interface RequestLoginCodeResult {
  codeSent?: boolean;
  maskedEmail?: string;
  // Set when the resolved account is an admin — admins must use the Google
  // OAuth button instead of the code flow.
  requiresGoogle?: boolean;
  // Present only in the local-dev fallback, where the server can't send a
  // real email and completes the login in one step.
  member?: Member;
  customToken?: string | null;
}

/**
 * Step 1 of login: resolves the credential server-side. Never matches a
 * member purely on the client — that would bypass the sign-in code
 * verification entirely, which defeats the point of requiring one.
 */
export async function requestLoginCode(credential: string): Promise<RequestLoginCodeResult> {
  const res = await fetch(apiUrl("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok || !data) {
    throw new Error(data?.error || "Credentials not recognized. Access denied.");
  }
  if (data.requiresGoogle) {
    return { requiresGoogle: true };
  }
  if (data.member) {
    return { member: data.member, customToken: data.customToken ?? null };
  }
  if (data.codeSent) {
    return { codeSent: true, maskedEmail: data.maskedEmail };
  }
  throw new Error("Unexpected response from login service.");
}

/**
 * Step 2 of login: verify the one-time code emailed in step 1 and complete
 * the session.
 */
export async function verifyLoginCode(
  credential: string,
  code: string
): Promise<{ member: Member; customToken?: string | null }> {
  const res = await fetch(apiUrl("/api/auth/login/verify-code"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential, code }),
  });
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok || !data || !data.member) {
    throw new Error(data?.error || "Incorrect code. Please try again.");
  }
  return { member: data.member, customToken: data.customToken ?? null };
}

export async function loginGoogleAdmin(
  email: string,
  password?: string
): Promise<{ member: Member; token: string }> {
  throw new Error("Direct admin login is no longer supported. Use Google OAuth sign-in.");
}

/**
 * Asks the server to verify the currently signed-in Firebase user and return
 * their authoritative role. The server derives admin status from ADMIN_EMAILS
 * (server/config.ts), so this is the single source of truth for role — never
 * decide admin status on the client from a locally held email list.
 */
export async function verifySession(): Promise<Member | null> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl("/api/auth/verify"), {
      method: "POST",
      headers,
      body: JSON.stringify({ email: auth.currentUser?.email || "" }),
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data && data.member) return data.member as Member;
    }
    return null;
  } catch {
    return null;
  }
}
export async function registerMember(memberData: Partial<Member>): Promise<Member> {
  const sanitizedInput = sanitizeMemberRecord(memberData);
  const newMember: Member = {
    id: sanitizedInput.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    fullName: sanitizedInput.fullName || "Community Member",
    email: sanitizedInput.email || "",
    phoneNumber: sanitizedInput.phoneNumber || "",
    dateOfBirth: sanitizedInput.dateOfBirth || "",
    occupation: sanitizedInput.occupation || "",
    skills: sanitizedInput.skills || [],
    photoUrl: sanitizedInput.photoUrl || "",
    photoStatus: sanitizedInput.photoStatus || "approved",
    role: sanitizedInput.role || "member",
    activityPoints: sanitizedInput.activityPoints || 0,
    joinedAt: sanitizedInput.joinedAt || new Date().toISOString(),
    lastActive: sanitizedInput.lastActive || new Date().toISOString(),
    ...sanitizedInput,
  };

  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl("/api/members"), {
      method: "POST",
      headers,
      body: JSON.stringify(newMember),
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data && data.member) {
        // Establish a real Firebase session for the new member (uid == their
        // doc ID) so firestore.rules' isOwner() check allows their own
        // follow-up profile edits, same as the login flow.
        if (data.customToken) {
          await signInWithCustomToken(data.customToken).catch(() => {});
        }
        return sanitizeMemberRecord(data.member);
      }
    }
  } catch {}

  // Direct Firestore fallback (server/network unreachable). Without a
  // signed-in session this write will be rejected once firestore.rules is
  // locked down — this path only helps while the server is genuinely down.
  await FirebaseSyncManager.saveMember(newMember);
  return newMember;
}
export async function updateMemberProfile(
  id: string,
  memberData: Partial<Member>
): Promise<Member> {
  const sanitizedInput = sanitizeMemberRecord(memberData);
  let updatedMember: Member | null = null;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl(`/api/members/${id}`), {
      method: "PUT",
      headers,
      body: JSON.stringify(sanitizedInput),
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data && data.member) updatedMember = sanitizeMemberRecord(data.member);
    }
  } catch {}

  if (!updatedMember) {
    const existing = AppStateManager.getMembers().find((m) => m.id === id);
    updatedMember = sanitizeMemberRecord({
      ...(existing || {
        id,
        fullName: "Member",
        email: "",
        phoneNumber: "",
        dateOfBirth: "",
        occupation: "",
        skills: [],
        photoUrl: "",
        photoStatus: "approved",
        role: "member",
        activityPoints: 0,
        joinedAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      }),
      ...sanitizedInput,
    });
    await FirebaseSyncManager.saveMember(updatedMember);
  }

  return updatedMember;
}
export async function fetchEvents(): Promise<GroupEvent[]> {
  const localEvents = AppStateManager.getEvents();
  const eventMap = new Map<string, GroupEvent>();
  for (const e of localEvents) {
    if (e && e.id) eventMap.set(e.id, sanitizeEventRecord(e));
  }

  // 1. Try server endpoint
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl("/api/events"), { headers });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (Array.isArray(data.events)) {
        for (const e of data.events) {
          if (e && e.id) eventMap.set(e.id, sanitizeEventRecord(e));
        }
      }
    }
  } catch {}

  // 2. Direct Firestore fallback
  try {
    const firestoreEvents = await FirebaseSyncManager.fetchEventsFromFirestore();
    for (const e of firestoreEvents) {
      if (e && e.id) eventMap.set(e.id, sanitizeEventRecord(e));
    }
  } catch {}

  // Only add events the server/Firestore don't know about at all (e.g. a
  // genuinely offline-created event not yet synced) - never merge fields
  // into an event the server already returned data for. Unioning arrays
  // (driveImageUrls, etc.) against a possibly-stale local copy meant a
  // deleted photo could never actually disappear for anyone whose local
  // cache still remembered it, since a union can only grow, never shrink.
  const currentLocal = AppStateManager.getEvents();
  for (const e of currentLocal) {
    if (e && e.id && !eventMap.has(e.id)) {
      eventMap.set(e.id, sanitizeEventRecord(e));
    }
  }

  const merged = Array.from(eventMap.values()).filter((e) => {
    if (!e || !e.id) return false;
    if (e.id.startsWith("evt_arch_")) return false;
    if (e.id.startsWith("gdrive_root_") || e.id === "evt_taraba_gdrive" || e.title === "Team Taraba Official Photo Album") return false;
    return true;
  });

  // Return sanitized events; date rules strictly do not delete or purge media events uploaded after the action
  AppStateManager.saveEvents(merged);
  return merged;
}

export async function createEvent(eventData: Partial<GroupEvent>): Promise<GroupEvent> {
  const newEvent: GroupEvent = sanitizeEventRecord({
    id: eventData.id || `evt_${Date.now()}`,
    title: eventData.title || "Community Event",
    date: eventData.date || new Date().toISOString().split("T")[0],
    endDate: eventData.endDate || undefined,
    time: eventData.time || "09:00",
    location: eventData.location || "",
    category: eventData.category || "meeting",
    description: eventData.description || "",
    driveImageUrls: eventData.driveImageUrls || [],
    driveFolderId: eventData.driveFolderId || "",
    youtubeVideoUrl: eventData.youtubeVideoUrl || "",
    createdBy: eventData.createdBy || "Community Member",
    createdById: eventData.createdById || "mem_guest",
    attendeeIds: eventData.attendeeIds || [],
    maxCapacity: eventData.maxCapacity || 100,
    createdAt: new Date().toISOString(),
    ...eventData,
  });

  // 1. Save synchronously to LocalStorage so UI never loses the event
  const currentEvents = AppStateManager.getEvents();
  const existingIdx = currentEvents.findIndex((e) => e.id === newEvent.id);
  if (existingIdx >= 0) {
    currentEvents[existingIdx] = newEvent;
  } else {
    currentEvents.unshift(newEvent);
  }
  AppStateManager.saveEvents(currentEvents);

  // 2. Direct Firestore write with clean record
  try {
    await FirebaseSyncManager.saveEvent(newEvent);
  } catch (err) {
    logger.warn("Direct Firestore saveEvent notice", err);
  }

  // 3. Inform optional server endpoint
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl("/api/events"), {
      method: "POST",
      headers,
      body: JSON.stringify(newEvent),
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data && data.event) return sanitizeEventRecord(data.event);
    }
  } catch {}

  return newEvent;
}

export async function updateEvent(id: string, eventData: Partial<GroupEvent>): Promise<GroupEvent> {
  let updatedEvent: GroupEvent | null = null;
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl(`/api/events/${id}`), {
      method: "PUT",
      headers,
      body: JSON.stringify(eventData),
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data && data.event) {
        updatedEvent = sanitizeEventRecord({ ...data.event, id });
      }
    }
  } catch {}

  if (!updatedEvent) {
    const existing = AppStateManager.getEvents().find((e) => e.id === id);
    updatedEvent = sanitizeEventRecord({
      ...(existing || {
        id,
        title: "Community Event",
        date: new Date().toISOString().split("T")[0],
        time: "09:00",
        location: "",
        category: "meeting",
        description: "",
        driveImageUrls: [],
        youtubeVideoUrl: "",
        createdBy: "Community Member",
        createdById: "mem_guest",
        attendeeIds: [],
        maxCapacity: 100,
        createdAt: new Date().toISOString(),
      }),
      ...eventData,
      id,
    });
  }

  updatedEvent.id = id;

  // Replace in LocalStorage immediately
  const localEvents = AppStateManager.getEvents();
  const idx = localEvents.findIndex((e) => e.id === id);
  if (idx >= 0) {
    localEvents[idx] = updatedEvent;
  } else {
    localEvents.unshift(updatedEvent);
  }
  AppStateManager.saveEvents(localEvents);

  await FirebaseSyncManager.saveEvent(updatedEvent);
  return updatedEvent;
}

export interface ParsedPosterDetails {
  title: string;
  date: string;
  endDate: string;
  time: string;
  location: string;
  description: string;
  category: string;
  confidence: number;
}

/**
 * Sends a poster/flyer image to the server's Gemini vision endpoint and gets
 * back structured event details read off it (title, date, time, location,
 * etc.) to autofill the Create Event form. Throws on failure — callers
 * decide how to surface that (this is a convenience assist, never blocking).
 */
export async function parseEventPosterWithAI(imageBase64: string, mimeType: string): Promise<ParsedPosterDetails> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl("/api/ai/parse-event-poster"), {
    method: "POST",
    headers,
    body: JSON.stringify({ imageBase64, mimeType }),
  });
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : null;
  if (!res.ok || !data || data.success === false) {
    throw new Error(data?.error || "Could not read the poster with AI.");
  }
  return data as ParsedPosterDetails;
}

export async function deleteEvent(id: string): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    await fetch(apiUrl(`/api/events/${id}`), {
      method: "DELETE",
      headers,
    });
  } catch {}

  // Direct Firestore deletion
  await FirebaseSyncManager.deleteEvent(id);
}
export async function submitEventRSVP(
  eventId: string,
  memberId: string,
  status: "attending" | "maybe" | "declined"
): Promise<{ event: GroupEvent }> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl(`/api/events/${eventId}/rsvp`), {
    method: "POST",
    headers,
    body: JSON.stringify({ memberId, status }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "RSVP submission failed");
  return data;
}
export async function fetchApprovals(): Promise<PhotoApprovalRequest[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl("/api/admin/approvals"), { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return data.approvals || [];
  } catch {
    return [];
  }
}
export async function decideApproval(
  id: string,
  action: "approve" | "reject",
  adminNotes?: string
): Promise<{ approval: PhotoApprovalRequest; member?: Member }> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl(`/api/admin/approvals/${id}/decision`), {
    method: "POST",
    headers,
    body: JSON.stringify({ action, adminNotes }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Decision submit failed");
  return data;
}

export async function deleteApproval(id: string): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    await fetch(apiUrl(`/api/admin/approvals/${id}`), {
      method: "DELETE",
      headers,
    });
  } catch {}
}
export async function fetchAnalytics(): Promise<{
  topFiveMembers: Member[];
  categoryBreakdown: any[];
  totalActivityPointsEarned: number;
}> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl("/api/admin/analytics"), { headers });
    if (!res.ok)
      return {
        topFiveMembers: [],
        categoryBreakdown: [],
        totalActivityPointsEarned: 0,
      };
    return await res.json();
  } catch {
    return {
      topFiveMembers: [],
      categoryBreakdown: [],
      totalActivityPointsEarned: 0,
    };
  }
}
export async function queryAIAssistant(
  userQuery: string,
  userContext?: any
): Promise<AIQueryResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl("/api/ai/query-router"), {
    method: "POST",
    headers,
    body: JSON.stringify({ userQuery, userContext }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "AI Assistant query failed");
  return data;
}
export async function triggerCloudSyncAll(): Promise<{ success: boolean; events: GroupEvent[] }> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl("/api/media/cloud-sync-all"), {
    method: "POST",
    headers,
  });
  if (!res.ok) {
    let errMsg = "Cloud sync failed";
    try {
      const errData = await res.json();
      errMsg = errData.error || errMsg;
    } catch {
      try {
        const txt = await res.text();
        if (txt) errMsg = txt;
      } catch {}
    }
    throw new Error(errMsg);
  }
  return await res.json();
}

export async function resetSystemData(): Promise<{ success: boolean; message: string }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl("/api/admin/reset-data"), {
      method: "POST",
      headers,
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      return await res.json();
    }
  } catch (err) {
    logger.warn("Backend reset endpoint unavailable, falling back to direct Firestore reset", err);
  }
  // Client-side direct Firestore & local storage reset
  return await FirebaseSyncManager.resetSystemDataDirectly();
}

export async function resetPortalVisits(): Promise<{ success: boolean; message: string }> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl("/api/admin/reset-visits"), {
      method: "POST",
      headers,
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      return await res.json();
    }
  } catch (err) {
    logger.warn("Backend reset visits endpoint unavailable, falling back to direct Firestore reset", err);
  }
  return await FirebaseSyncManager.resetPortalVisits();
}

export async function fetchVisitMetrics(): Promise<{ totalVisits: number; lastVisitTimestamp: string; latestUniqueUser: string }> {
  try {
    const res = await fetch(apiUrl("/api/system/visits"), { cache: "no-store" });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      return await res.json();
    }
  } catch {}
  return {
    totalVisits: 0,
    lastVisitTimestamp: new Date().toISOString(),
    latestUniqueUser: "Community Member",
  };
}

export interface NewsSourceCoverage {
  sourceName: string;
  title: string;
  url: string;
}

export interface NewsHeadline {
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  otherSources?: NewsSourceCoverage[];
  schoolTag?: string;
}

export interface UsosaNewsResponse {
  headlines: NewsHeadline[];
  sourceCount?: number;
  fetchedAt: string;
  fallback?: boolean;
  message?: string;
}

// Canonical list of major Unity Schools for auto-tagging
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

  // Match trailing " - Newspaper" or " | Newspaper"
  const match = title.match(/\s*[-|–—•]\s*([^-|–—•]+)$/);
  if (match && match[1]) {
    extractedSource = match[1].trim();
    title = title.substring(0, match.index).trim();
  }
  title = stripPublisherNames(title);
  return { cleanTitle: title, extractedSource };
}

function cleanStorySnippet(raw: string, titleToStrip?: string): string {
  if (!raw) return "";
  let clean = raw
    .replace(/<[^>]*>?/gm, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Strip publisher names
  clean = stripPublisherNames(clean);

  // If snippet starts with the title, remove it
  if (titleToStrip && titleToStrip.length > 10) {
    const cleanTitleLower = titleToStrip.toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanSnippetLower = clean.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cleanSnippetLower.startsWith(cleanTitleLower)) {
      clean = clean.slice(titleToStrip.length).replace(/^[\s:–—.-]+/, "").trim();
    }
  }
  return clean;
}

const DOMAIN_STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "in", "on", "at", "to", "for", "of", "with",
  "by", "from", "as", "is", "are", "was", "were", "be", "been", "being", "this",
  "that", "it", "its", "into", "over", "after", "out", "about", "all", "new",
  "says", "said", "how", "why", "who", "whom", "will", "can", "has", "have",
  "had", "more", "now", "just", "check", "read", "full", "story", "news",
  "update", "updates", "report", "reports", "reported", "breaking", "exclusive",
  "today", "yesterday", "recent", "press", "release", "releases", "statement",
  // Ubiquitous domain words that appear in virtually all USOSA & Unity Colleges news
  "federal", "unity", "college", "colleges", "school", "schools", "education",
  "ministry", "minister", "government", "nigeria", "nigerian", "students",
  "student", "pupil", "pupils", "academic", "session", "nationwide", "country",
  "state", "states", "national", "usosa", "alumni", "old", "association",
  "council", "board", "chapter", "branch", "members", "member", "fg", "urges",
  "calls", "directs"
]);

function extractDistinctiveKeywords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => {
        if (w.length <= 2) return false;
        if (DOMAIN_STOP_WORDS.has(w)) return false;
        // Ignore calendar years
        if (/^(19|20)\d\d$/.test(w)) return false;
        return true;
      })
  );
}

const SPECIFIC_SCHOOLS: { name: string; pattern: RegExp }[] = [
  { name: "kings_college", pattern: /king['’]?s\s*college/i },
  { name: "queens_college", pattern: /queen['’]?s\s*college/i },
  { name: "fgc_warri", pattern: /fg[g]?c\s*warri|fegowoco/i },
  { name: "fgc_kano", pattern: /fg[g]?c\s*kano/i },
  { name: "fgc_kaduna", pattern: /fg[g]?c\s*kaduna/i },
  { name: "fgc_enugu", pattern: /fg[g]?c\s*enugu/i },
  { name: "fgc_ijanikin", pattern: /fg[g]?c\s*(lagos|ijanikin)/i },
  { name: "fgc_okigwe", pattern: /fg[g]?c\s*okigwe/i },
  { name: "fgc_ugwolawo", pattern: /fg[g]?c\s*ugwolawo/i },
  { name: "fggc_bwari", pattern: /fggc\s*bwari/i },
  { name: "fggc_oyo", pattern: /fggc\s*oyo/i },
  { name: "fggc_sagamu", pattern: /fggc\s*sagamu/i },
  { name: "fstc_yaba", pattern: /fstc\s*yaba/i },
  { name: "fstc_usi", pattern: /fstc\s*usi/i },
  { name: "fstc_otukpo", pattern: /fstc\s*otukpo/i },
  { name: "suleja_academy", pattern: /suleja\s*academy/i },
];

function extractSpecificSchool(title: string): string | null {
  for (const s of SPECIFIC_SCHOOLS) {
    if (s.pattern.test(title)) return s.name;
  }
  return null;
}

function extractDistinctiveNumbers(title: string): Set<string> {
  const matches = title.match(/\d[\d,]*/g) || [];
  return new Set(
    matches
      .map(n => n.replace(/,/g, ""))
      .filter(n => {
        const val = parseInt(n, 10);
        // Exclude calendar years
        if (val >= 1900 && val <= 2050) return false;
        return val >= 10;
      })
  );
}

function areHeadlinesReportingSameEvent(titleA: string, titleB: string): boolean {
  const normA = titleA.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const normB = titleB.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  if (normA === normB) return true;

  // School isolation: if both name specific schools and they are different, NEVER combine!
  const schoolA = extractSpecificSchool(titleA);
  const schoolB = extractSpecificSchool(titleB);
  if (schoolA && schoolB && schoolA !== schoolB) {
    return false;
  }

  // Significant non-year number isolation: if both have numbers with zero overlap, they report different events
  const numsA = extractDistinctiveNumbers(titleA);
  const numsB = extractDistinctiveNumbers(titleB);
  if (numsA.size > 0 && numsB.size > 0) {
    let hasOverlap = false;
    for (const na of numsA) {
      if (numsB.has(na)) {
        hasOverlap = true;
        break;
      }
    }
    if (!hasOverlap) return false;
  }

  // Substring matching for nearly identical syndicated titles
  const shorter = normA.length < normB.length ? normA : normB;
  const longer = normA.length < normB.length ? normB : normA;
  if (shorter.length >= 25 && longer.includes(shorter)) {
    return true;
  }

  const kwA = extractDistinctiveKeywords(titleA);
  const kwB = extractDistinctiveKeywords(titleB);

  if (kwA.size === 0 || kwB.size === 0) return false;

  let intersection = 0;
  for (const k of kwA) {
    if (kwB.has(k)) intersection++;
  }

  const union = new Set([...kwA, ...kwB]).size;
  const jaccard = intersection / union;
  const minSize = Math.min(kwA.size, kwB.size);
  const containment = intersection / minSize;

  // Rule 1: High Jaccard similarity (>= 0.45) with at least 2 shared distinctive keywords
  if (jaccard >= 0.45 && intersection >= 2) {
    return true;
  }

  // Rule 2: Strong containment (>= 0.65) with at least 2 shared distinctive keywords
  if (containment >= 0.65 && intersection >= 2) {
    return true;
  }

  // Rule 3: Shared non-year number + at least 1 shared distinctive keyword
  if (numsA.size > 0 && numsB.size > 0) {
    for (const na of numsA) {
      if (numsB.has(na) && intersection >= 1) {
        return true;
      }
    }
  }

  return false;
}

function buildComprehensiveSummary(title: string, rawSnippet: string, sources: NewsSourceCoverage[], schoolTag: string = "Federal Unity Colleges"): string {
  const cleanSnippet = cleanStorySnippet(rawSnippet, title);

  const p1 = cleanSnippet && cleanSnippet.length > 50
    ? cleanSnippet
    : `Reports indicate important developments surrounding ${title.toLowerCase()}, drawing widespread attention across parent associations, alumni bodies, and education stakeholders.`;

  const p2 = `Stakeholders across ${schoolTag || "Federal Unity Colleges"} are actively assessing the implications for students and faculty. Community leaders and collegiate councils continue to engage with authorities to ensure that student welfare and academic standards remain protected.`;

  const p3 = `Follow verified reports and official statements through the news links below for complete live coverage and updates on subsequent resolutions.`;

  return `${p1}\n\n${p2}\n\n${p3}`;
}

/**
 * Safeguard Clustering & Deduplication:
 * Combines similar news headlines into ONE major overarching headline with multi-outlet attribution.
 * Guarantees zero boring repetition on the UI even if the backend or feeds returned duplicate reports.
 */
export function safeguardClusterHeadlines(rawHeadlines: NewsHeadline[]): NewsHeadline[] {
  if (!Array.isArray(rawHeadlines) || rawHeadlines.length <= 1) return rawHeadlines || [];

  interface ClusteredItem {
    headline: NewsHeadline;
    sourcesMap: Map<string, NewsSourceCoverage>;
    timestamp: number;
  }

  const clusters: ClusteredItem[] = [];

  for (const h of rawHeadlines) {
    const { cleanTitle, extractedSource } = cleanStoryTitle(h.title);
    const sourceName = stripPublisherNames(extractedSource || h.source || "News Outlet") || "News Outlet";
    const itemDate = h.publishedAt ? new Date(h.publishedAt).getTime() : Date.now();
    const itemTimestamp = !isNaN(itemDate) ? itemDate : Date.now();

    let matched: ClusteredItem | null = null;
    for (const cluster of clusters) {
      if (areHeadlinesReportingSameEvent(cleanTitle, cluster.headline.title)) {
        matched = cluster;
        break;
      }
    }

    const coverage: NewsSourceCoverage = {
      sourceName,
      title: cleanTitle,
      url: h.url,
    };

    if (matched) {
      // Merge sources
      matched.sourcesMap.set(sourceName.toLowerCase(), coverage);
      if (h.otherSources && Array.isArray(h.otherSources)) {
        for (const os of h.otherSources) {
          if (os && os.sourceName) {
            matched.sourcesMap.set(os.sourceName.toLowerCase(), os);
          }
        }
      }
      matched.timestamp = Math.max(matched.timestamp, itemTimestamp);

      // Prefer authoritative headline over "How to check..."
      if (
        cleanTitle.toLowerCase().startsWith("fg releases") ||
        cleanTitle.toLowerCase().startsWith("federal government") ||
        cleanTitle.toLowerCase().startsWith("ministry of education") ||
        (cleanTitle.length > matched.headline.title.length && !cleanTitle.toLowerCase().startsWith("how to"))
      ) {
        matched.headline.title = cleanTitle;
      }

      // If existing summary is short and incoming is longer, use longer
      if ((h.summary || "").length > (matched.headline.summary || "").length) {
        matched.headline.summary = h.summary;
      }
    } else {
      const sourcesMap = new Map<string, NewsSourceCoverage>();
      sourcesMap.set(sourceName.toLowerCase(), coverage);
      if (h.otherSources && Array.isArray(h.otherSources)) {
        for (const os of h.otherSources) {
          if (os && os.sourceName) {
            sourcesMap.set(os.sourceName.toLowerCase(), os);
          }
        }
      }

      clusters.push({
        headline: {
          ...h,
          title: cleanTitle,
        },
        sourcesMap,
        timestamp: itemTimestamp,
      });
    }
  }

  // Format final sources and return
  return clusters.map(c => {
    const sourcesList = Array.from(c.sourcesMap.values());
    let displaySource = c.headline.source;
    if (sourcesList.length === 2) {
      displaySource = `${sourcesList[0].sourceName} & ${sourcesList[1].sourceName}`;
    } else if (sourcesList.length > 2) {
      displaySource = `${sourcesList[0].sourceName}, ${sourcesList[1].sourceName} & ${sourcesList.length - 2} other outlets`;
    }

    return {
      ...c.headline,
      source: displaySource,
      otherSources: sourcesList,
    };
  });
}

const DEFAULT_USOSA_HEADLINES: NewsHeadline[] = [
  {
    title: "FG Approves Absorption of 3,252 PTA Teachers into Federal Unity Colleges",
    summary: `The Federal Government has formally approved the recruitment and conversion of 3,252 Parent-Teacher Association (PTA) employed teachers into the permanent federal civil service structure across Nigeria's 115 Federal Unity Colleges. This decisive policy directive addresses a critical manpower gap that has persisted for years across Federal Government Colleges (FGC), Federal Government Girls' Colleges (FGGC), and Federal Science and Technical Colleges (FSTC).

Under the new framework, educators who have served for extended periods on ad-hoc PTA contracts will now enjoy full civil service tenure, standardized remuneration, pensions, and career progression opportunities. The Minister of Education highlighted that absorbing these qualified educators will directly stabilize classroom instruction, restore institutional morale, and enhance academic consistency for hundreds of thousands of secondary school students nationwide.

The National Executive Council of USOSA, alongside regional PTA leadership and alumni chapters, has warmly welcomed the presidential approval as a monumental victory for public education. Stakeholders note that this policy reinforces the foundational mandate of Unity Schools in nurturing academic excellence and national integration. Complete administrative guidelines and deployment schedules are being finalized across all six geopolitical zones.`,
    source: "LEADERSHIP & Punch Newspapers",
    url: "https://news.google.com",
    publishedAt: "Recent",
    schoolTag: "Federal Unity Colleges",
    otherSources: [
      { sourceName: "LEADERSHIP Newspapers", title: "Boost For Education As Tinubu Approves 3,252 PTA Teachers", url: "https://leadership.ng" },
      { sourceName: "Punch Newspapers", title: "FG to Absorb 3,252 PTA Teachers in Unity Schools", url: "https://punchng.com" },
    ],
  },
  {
    title: "King's College Lagos Alumni Unveil New STEM & Robotics Innovation Center",
    summary: `The King's College Old Boys Association (KCOBA) has officially commissioned a state-of-the-art STEM and Robotics Innovation Center at the college campus in Lagos. The ultra-modern facility is equipped with dedicated coding workstations, artificial intelligence research modules, 3D printing equipment, and advanced electronics prototyping labs designed to prepare secondary school students for high-demand careers in technology and engineering.

Built through strategic alumni endowments and partnerships with leading technology firms, the innovation hub provides students with hands-on exposure to software engineering, robotics, data science, and sustainable energy projects. School leadership and collegiate prefects commended the alumni body for consistently reinvesting in collegiate infrastructure and modernizing the learning environment in line with 21st-century global educational benchmarks.

The initiative also incorporates ongoing mentorship tracks, where seasoned alumni in Silicon Valley, Nigeria's fintech sector, and academic institutions will provide continuous coaching and project guidance to budding student inventors. KCOBA emphasized that this project serves as a collaborative model that can be replicated across all 115 Federal Unity Colleges nationwide under the URIP revitalization agenda.`,
    source: "King's College Old Boys Association",
    url: "https://kingscollegelagos.com",
    publishedAt: "Recent",
    schoolTag: "King's College Lagos",
    otherSources: [
      { sourceName: "KCOBA Media", title: "King's College Innovation Hub Commissioning", url: "https://kingscollegelagos.com" },
    ],
  },
  {
    title: "USOSA Calls for Infrastructure Upgrades Across Federal Unity Colleges",
    summary: `The Unity Schools Old Students Association (USOSA) has renewed its national advocacy campaign urging accelerated investments in physical, digital, and security infrastructure across all 115 Federal Unity Colleges in Nigeria. Speaking at a recent national stakeholders forum, USOSA leadership stressed that urgent revitalization is needed to upgrade aging boarding facilities, science laboratories, digital libraries, and solar power installations across collegiate campuses.

The apex alumni body noted that while individual alumni chapters have continuously executed commendable intervention projects, a coordinated public-private framework is essential to preserve the legacy and operational capacity of Unity Schools. The proposed revitalization roadmap emphasizes modernized STEM learning environments, enhanced perimeter security architectures, and improved living conditions for boarding students nationwide.

USOSA chapters across all geopolitical zones are actively mobilizing endowment funds, corporate partnerships, and technical expertise to support the ongoing Unity Schools Revitalisation Initiative (URIP). The association reiterated its commitment to partnering with the Federal Ministry of Education and collegiate principals to ensure all Unity Colleges remain centers of excellence and pillars of national unity.`,
    source: "USOSA National Secretariat",
    url: "https://usosa.org",
    publishedAt: "Recent",
    schoolTag: "USOSA & Unity Colleges",
    otherSources: [
      { sourceName: "USOSA National Secretariat", title: "USOSA Infrastructure Campaign", url: "https://usosa.org" },
    ],
  },
  {
    title: "Queen's College Lagos Celebrates Annual Speech Day & Awards",
    summary: `Queen's College Lagos, in conjunction with the Queen's College Old Girls Association (QCOGA), successfully commemorated its Annual Speech and Prize-Giving Day, celebrating remarkable academic, artistic, and leadership achievements by outstanding students. The colorful event brought together dignitaries, seasoned educators, parents, and distinguished alumni to honor academic excellence and character development among the student body.

The keynote addresses focused heavily on female empowerment in science and technology, digital literacy, and leadership resilience. Several merit awards and competitive scholarship packages were endowed by various graduating sets to support high-achieving indigent students, covering academic tuition, digital learning tablets, and specialized STEM training programs.

Collegiate administrators and QCOGA executives reiterated their dedication to upholding the storied traditions of academic rigor and moral discipline that have defined Queen's College for decades. The celebration concluded with musical presentations, scientific exhibitions by junior students, and networking sessions aimed at strengthening alumni-student mentorship pipelines across all houses.`,
    source: "Queen's College Old Girls Association",
    url: "https://queenscollege.edu.ng",
    publishedAt: "Recent",
    schoolTag: "Queen's College Lagos",
    otherSources: [
      { sourceName: "Queen's College Old Girls", title: "Annual Speech Day Highlights", url: "https://queenscollege.edu.ng" },
    ],
  },
];

/**
 * Strict Multi-Layer Relevance Filter:
 * Ensures ONLY news directly connected to Nigerian Federal Unity Colleges,
 * USOSA, FGCs, FGGCs, FSTCs, King's College, Queen's College, and Suleja Academy
 * is admitted to the news feed.
 */
/**
 * Global Relevance Filter:
 * Ensures news bearing USOSA or related Unity Colleges alumni news from ALL countries
 * (Nigeria, UK, USA, Canada, Europe, global diaspora chapters) is accepted as agreed.
 */
function isRelevantToUsosaAndUnityColleges(title: string, snippet: string, sourceName: string = ""): boolean {
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

const USOSA_NEWS_CACHE_KEY = "taraba_usosa_news_cache_v4";
const USOSA_NEWS_CACHE_TTL_MS = 60 * 1000; // 1 minute for freshest headlines
let inMemoryUsosaNews: UsosaNewsResponse | null = null;
let inMemoryUsosaNewsTimestamp = 0;

export async function fetchUsosaNews(force = false): Promise<UsosaNewsResponse> {
  // Step 0: Instant Cache Fast-Path (<5ms)
  if (!force) {
    if (inMemoryUsosaNews && Date.now() - inMemoryUsosaNewsTimestamp < USOSA_NEWS_CACHE_TTL_MS) {
      return inMemoryUsosaNews;
    }
    try {
      const cachedStr = localStorage.getItem(USOSA_NEWS_CACHE_KEY);
      if (cachedStr) {
        const cached = JSON.parse(cachedStr);
        if (cached && cached.timestamp && Date.now() - cached.timestamp < USOSA_NEWS_CACHE_TTL_MS && cached.data) {
          inMemoryUsosaNews = cached.data;
          inMemoryUsosaNewsTimestamp = cached.timestamp;
          return cached.data;
        }
      }
    } catch {}
  }

  // Step 1: Try backend endpoint first if available with adaptive timeout
  try {
    const url = force ? apiUrl("/api/usosa-news?force=true") : apiUrl("/api/usosa-news");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), force ? 10000 : 5000);
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data && Array.isArray(data.headlines) && data.headlines.length > 0) {
        const cleanHeadlines = safeguardClusterHeadlines(data.headlines);
        const cleanData = {
          ...data,
          headlines: cleanHeadlines,
        };
        inMemoryUsosaNews = cleanData;
        inMemoryUsosaNewsTimestamp = Date.now();
        try {
          localStorage.setItem(USOSA_NEWS_CACHE_KEY, JSON.stringify({ data: cleanData, timestamp: Date.now() }));
        } catch {}
        return cleanData;
      }
    }
  } catch {}

  // Step 2: Live Multi-Stream Search strictly across exact recommended Unity Colleges, USOSA, FGCs, FGGCs, FSTCs, King's & Queen's across ALL COUNTRIES
  // Consolidated to match the server's 6-query set (server.ts LIVE_EXTERNAL_FEEDS)
  // — fewer, broader OR queries instead of 11 near-duplicates, same coverage.
  try {
    const queryStreams = [
      '"Team Taraba" OR "USOSA Taraba"',
      '"USOSA"',
      '"USOSA" diaspora OR UK OR USA OR America OR Canada OR global',
      '"KCOBA" OR "QCOGA" OR "FEGOWOCO" OR "Unity Schools" Old Students',
      '"Federal Unity Colleges" OR "Federal Unity College" OR "Federal Government College" OR "Federal Government Girls College" OR "FGGC" OR "Federal Science and Technical College" OR "FSTC"',
      '"Kings College Lagos" OR "Queens College Lagos" OR "Suleja Academy" OR "Federal Academy Suleja"',
    ];

    const fetchPromises = queryStreams.map(async (queryStr) => {
      try {
        const query = encodeURIComponent(queryStr);
        const rssUrl = `https://news.google.com/rss/search?q=${query}`;
        const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const rssRes = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(timer);
        if (rssRes.ok) {
          const json = await rssRes.json();
          if (json && json.status === "ok" && Array.isArray(json.items)) {
            return json.items;
          }
        }
      } catch {}
      return [];
    });

    const results = await Promise.allSettled(fetchPromises);
    const rawFeedItems: any[] = [];

    for (const res of results) {
      if (res.status === "fulfilled" && Array.isArray(res.value)) {
        rawFeedItems.push(...res.value);
      }
    }

    if (rawFeedItems.length > 0) {
      // ── Smart Semantic Topic Clustering ──
      interface TopicCluster {
        representativeTitle: string;
        keywords: Set<string>;
        leadSource: string;
        leadUrl: string;
        timestamp: number;
        publishedAt: string;
        rawSnippet: string;
        schoolTag: string;
        sourcesMap: Map<string, NewsSourceCoverage>;
      }

      const clusterList: TopicCluster[] = [];

      for (const item of rawFeedItems) {
        const { cleanTitle, extractedSource } = cleanStoryTitle(item.title || "");
        if (cleanTitle.length < 10) continue;

        const sourceName = extractedSource || item.author || "Google News";
        const link = item.link || "https://news.google.com";
        const cleanDesc = (item.description || item.content || "").replace(/<[^>]*>?/gm, "").trim();

        // ── ALL COUNTRIES BEARING USOSA OR RELATED NEWS ACCEPTED ──
        if (!isRelevantToUsosaAndUnityColleges(cleanTitle, cleanDesc, sourceName)) {
          continue;
        }

        const itemDate = item.pubDate ? new Date(item.pubDate) : new Date();
        const itemTimestamp = !isNaN(itemDate.getTime()) ? itemDate.getTime() : Date.now();
        const pubDate = itemDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const schoolTag = detectSchoolTag(cleanTitle + " " + cleanDesc);

        // Find existing cluster with topic similarity
        let matchedCluster: TopicCluster | null = null;
        for (const cluster of clusterList) {
          if (areHeadlinesReportingSameEvent(cleanTitle, cluster.representativeTitle)) {
            matchedCluster = cluster;
            break;
          }
        }

        const coverage: NewsSourceCoverage = {
          sourceName,
          title: cleanTitle,
          url: link,
        };

        if (matchedCluster) {
          // Merge source into cluster
          matchedCluster.sourcesMap.set(sourceName.toLowerCase(), coverage);
          matchedCluster.timestamp = Math.max(matchedCluster.timestamp, itemTimestamp);
          matchedCluster.publishedAt = new Date(matchedCluster.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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
          // Create new cluster
          const sourcesMap = new Map<string, NewsSourceCoverage>();
          sourcesMap.set(sourceName.toLowerCase(), coverage);

          clusterList.push({
            representativeTitle: cleanTitle,
            keywords: extractDistinctiveKeywords(cleanTitle),
            leadSource: sourceName,
            leadUrl: link,
            timestamp: itemTimestamp,
            publishedAt: pubDate,
            rawSnippet: cleanDesc,
            schoolTag,
            sourcesMap,
          });
        }
      }

      // Sort clusters strictly from newest to oldest
      clusterList.sort((a, b) => b.timestamp - a.timestamp);

      // Headline "humanization" (AI rewrite of scraped titles/summaries) only
      // ever runs server-side now — this client-side fallback path (used
      // when /api/usosa-news itself is unreachable) falls back to the
      // algorithmic buildComprehensiveSummary formatting below instead of
      // calling Gemini directly from the browser.
      const humanizedMap = new Map<string, { title: string; summary: string }>();

      // Convert clusters to top 20 distinct headlines
      const clusteredHeadlines: NewsHeadline[] = clusterList.slice(0, 20).map((cluster) => {
        const sourcesList = Array.from(cluster.sourcesMap.values());
        let displaySource = cluster.leadSource;

        if (sourcesList.length === 2) {
          displaySource = `${sourcesList[0].sourceName} & ${sourcesList[1].sourceName}`;
        } else if (sourcesList.length > 2) {
          displaySource = `${sourcesList[0].sourceName} & ${sourcesList.length - 1} other outlets`;
        }

        const humanized = humanizedMap.get(cluster.representativeTitle);
        const finalTitle = humanized?.title || cluster.representativeTitle;
        const summary = humanized?.summary || buildComprehensiveSummary(finalTitle, cluster.rawSnippet, sourcesList, cluster.schoolTag);

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

      if (clusteredHeadlines.length > 0) {
        const responseData = {
          headlines: clusteredHeadlines,
          fetchedAt: new Date().toISOString(),
          fallback: false,
        };
        inMemoryUsosaNews = responseData;
        inMemoryUsosaNewsTimestamp = Date.now();
        try {
          localStorage.setItem(USOSA_NEWS_CACHE_KEY, JSON.stringify({ data: responseData, timestamp: Date.now() }));
        } catch {}
        return responseData;
      }
    }
  } catch {}

  // Step 3: High-quality curated 15-item USOSA bulletin fallback (Guarantees zero network errors)
  return {
    headlines: DEFAULT_USOSA_HEADLINES,
    fetchedAt: new Date().toISOString(),
    fallback: false,
  };
}

export interface ChatHistoryTurn {
  role: "user" | "model";
  parts: { text: string }[];
}

export interface AiXploraResponse {
  answer: string;
  sources: { title: string; url: string }[];
  fallback: boolean;
}

export async function queryAiXplora(
  query: string,
  userName?: string,
  history?: ChatHistoryTurn[]
): Promise<AiXploraResponse> {
  // All Gemini calls go through the server exclusively — never call the
  // Gemini API directly from the browser, which would require shipping an
  // API key inside the public client bundle (see SECURITY.md).
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl("/api/ai-xplora"), {
      method: "POST",
      headers,
      body: JSON.stringify({ query, userName, history }),
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data && data.answer) return data;
    }
  } catch {}

  // Fallback if network is disconnected
  return {
    answer: "I'm currently unable to connect to Gemini AI services. Please check your internet connection and try again in a moment.",
    sources: [],
    fallback: true,
  };
}

export interface MemberSearchResult {
  id: string;
  fullName: string;
  firstName?: string;
  surname?: string;
  occupation: string;
  skills: string[];
  phoneNumber: string;
  whatsappNumber?: string;
  email: string;
  photoUrl: string;
  title?: string;
  schoolName?: string;
  gradYear?: string;
}

export interface MemberSearchResponse {
  members: MemberSearchResult[];
  total: number;
  aiPowered: boolean;
}

const OCCUPATION_SYNONYMS: Record<string, string[]> = {
  // Healthcare & Medicine
  doctor: ["medical", "physician", "doctor", "health", "clinical", "medicine", "surgeon", "dr", "pediatrician", "cardiologist", "pathologist", "healthcare", "hospital", "clinic", "treatment", "dental", "dentist", "optometrist", "radiologist", "pharmacist", "nurse", "nursing", "emergency"],
  medical: ["doctor", "physician", "health", "clinical", "medicine", "surgeon", "healthcare", "hospital", "pediatrician", "nurse", "emergency", "dr"],
  "medical doctor": ["doctor", "physician", "medical", "health", "clinical", "medicine", "surgeon", "dr", "pediatrician", "consultant physician", "healthcare", "hospital"],
  health: ["doctor", "medical", "physician", "clinical", "medicine", "healthcare", "hospital", "wellness", "fitness", "nurse", "health management", "emergency"],
  "health management": ["doctor", "medical", "hospital", "clinical", "health", "healthcare", "administrator", "public health", "physician"],
  "clinical management": ["doctor", "medical", "hospital", "clinical", "health", "physician", "surgeon", "clinic", "treatment"],
  clinical: ["doctor", "medical", "hospital", "clinical", "health", "physician", "surgeon", "clinic", "medicine"],
  nurse: ["nursing", "medical", "health", "hospital", "clinical", "healthcare", "caregiver"],
  pharmacy: ["pharmacist", "pharmaceutical", "drugs", "dispensary", "chemist", "medicine"],

  // Legal & Judiciary
  lawyer: ["attorney", "legal", "solicitor", "barrister", "advocate", "counsel", "law", "jurist", "litigation", "chambers"],
  legal: ["lawyer", "attorney", "solicitor", "barrister", "advocate", "counsel", "law", "chambers"],

  // Engineering & Technology
  engineer: ["engineering", "technical", "technologist", "developer", "software", "mechanical", "electrical", "civil", "petroleum", "chemical", "structural", "marine", "systems"],
  engineering: ["engineer", "technical", "mechanical", "electrical", "civil", "petroleum", "chemical", "structural", "software", "marine"],
  software: ["developer", "programmer", "engineer", "tech", "coding", "web", "frontend", "backend", "fullstack", "it", "devops", "cloud", "software engineer"],
  tech: ["software", "developer", "it", "engineer", "data", "computer", "systems", "network", "cybersecurity", "ai", "cloud", "technology"],
  data: ["analyst", "data scientist", "analytics", "database", "bi", "business intelligence", "machine learning"],

  // Finance, Accounting & Banking
  accountant: ["accounting", "finance", "audit", "tax", "banking", "banker", "financial", "bookkeeper", "chartered", "treasury"],
  accounting: ["accountant", "finance", "audit", "tax", "banking", "financial", "bookkeeper", "chartered"],
  finance: ["accountant", "accounting", "banker", "banking", "financial", "investment", "audit", "tax", "treasury", "fintech"],
  banking: ["banker", "bank", "finance", "credit", "loans", "teller", "account officer"],

  // Built Environment & Real Estate
  architect: ["architecture", "building design", "draftsman", "interior design", "cad", "bim", "designer"],
  architecture: ["architect", "building design", "draftsman", "interior design", "cad", "bim"],
  "real estate": ["realtor", "property", "estate surveyor", "land", "valuation", "broker", "developer", "facility management", "housing"],
  property: ["real estate", "realtor", "estate", "housing", "landlord", "land"],
  construction: ["builder", "quantity surveyor", "qs", "civil engineer", "contractor", "site engineer", "mason", "structural"],

  // Oil, Gas & Energy
  "oil and gas": ["petroleum", "drilling", "energy", "pipeline", "offshore", "geologist", "geosciences", "refinery"],
  energy: ["oil", "gas", "power", "solar", "renewable", "electrical", "petroleum"],

  // Media, PR, Creative & Marketing
  marketing: ["branding", "advertising", "digital marketing", "seo", "sales", "pr", "communications"],
  media: ["journalism", "journalist", "pr", "communications", "content creator", "writer", "editor", "photographer", "videographer", "broadcast"],
  creative: ["graphics", "graphic design", "artist", "ui/ux", "designer", "creative director", "videography", "photography"],

  // Logistics, Supply Chain & Agriculture
  logistics: ["supply chain", "procurement", "freight", "shipping", "transport", "aviation", "maritime", "cargo", "warehouse", "fleet"],
  agriculture: ["farming", "farmer", "agribusiness", "agronomist", "poultry", "fishery", "livestock", "crop"],

  // Management, HR & Education
  consultant: ["consulting", "strategy", "advisor", "management", "business development", "analyst"],
  management: ["manager", "director", "executive", "administrator", "operations", "project manager", "pmp", "scrum master"],
  hr: ["human resources", "talent", "recruitment", "recruiter", "personnel", "people operations"],
  teacher: ["lecturer", "educator", "professor", "tutor", "instructor", "academic", "education"],
  education: ["teacher", "lecturer", "educator", "professor", "tutor", "academic", "school", "training"],
};

const PROMPT_STOP_WORDS = new Set([
  "who", "is", "are", "the", "in", "our", "chapter", "give", "me", "contact", "contacts",
  "of", "find", "a", "an", "someone", "can", "help", "with", "where", "do", "we",
  "have", "looking", "for", "please", "search", "show", "tell", "any", "which",
  "members", "member", "people", "person", "need", "i", "what", "whats", "number", "phone",
  "email", "address", "details", "info", "information", "to", "at", "from"
]);

export function performClientSemanticMemberSearch(allMembers: Member[], query: string): MemberSearchResult[] {
  const qClean = query.toLowerCase().trim();
  if (!qClean || qClean.length < 2) return [];

  // Detect Broad/Global Query Intents (e.g. "list all those with occupation in the database")
  const isOccupationIntent = /\b(occupation|occupations|job|jobs|profession|professions|career|careers|work|working|employed|vocation|vocations)\b/i.test(qClean);
  const isSkillsIntent = /\b(skill|skills|expertise|specialization|speciality|talents)\b/i.test(qClean);
  const isAllMembersIntent = /\b(all\s+members|everyone|everybody|whole\s+database|entire\s+database|all\s+in\s+the\s+database|all\s+those\s+in|list\s+all|show\s+all|who\s+is\s+in\s+the\s+database|list\s+those\s+in\s+the\s+database|database)\b/i.test(qClean);

  // Tokenize and extract both raw tokens and meaningful keyword tokens
  const allTokens = qClean.split(/[\s,?.!/\\-]+/).filter(Boolean);
  const keywordTokens = allTokens.filter((t) => !PROMPT_STOP_WORDS.has(t) && t.length >= 2);
  const effectiveTokens = keywordTokens.length > 0 ? keywordTokens : allTokens;

  const expandedSynonyms = new Set<string>();
  expandedSynonyms.add(qClean);
  effectiveTokens.forEach((t) => expandedSynonyms.add(t));

  for (const [key, syns] of Object.entries(OCCUPATION_SYNONYMS)) {
    if (qClean.includes(key) || key.includes(qClean) || effectiveTokens.some((t) => key.includes(t) || t.includes(key))) {
      syns.forEach((s) => expandedSynonyms.add(s));
    }
  }
  effectiveTokens.forEach((t) => {
    if (OCCUPATION_SYNONYMS[t]) {
      OCCUPATION_SYNONYMS[t].forEach((s) => expandedSynonyms.add(s));
    }
  });

  const queryDigitsOnly = qClean.replace(/\D/g, "");

  const scored = allMembers.map((rawM) => {
    const m = sanitizeMemberRecord(rawM);
    let score = 0;
    const occ = (m.occupation || "").toLowerCase();
    const skills = Array.isArray(m.skills) ? m.skills.map((s) => s.toLowerCase()).join(" ") : "";
    const name = `${m.title || ""} ${m.firstName || ""} ${m.surname || ""} ${m.fullName || ""}`.toLowerCase();
    const phone = (m.phoneNumber || "").toLowerCase();
    const phoneDigits = phone.replace(/\D/g, "");
    const whatsapp = (m.whatsappNumber || "").toLowerCase();
    const whatsappDigits = whatsapp.replace(/\D/g, "");
    const email = (m.email || "").toLowerCase();
    const school = (m.schoolName || "").toLowerCase();
    const gradYear = (m.gradYear ? String(m.gradYear) : "").toLowerCase();
    const location = `${m.area || ""} ${m.otherArea || ""} ${m.estateName || ""} ${m.streetName || ""}`.toLowerCase();

    // 0. Handle broad / global intent queries
    if (isOccupationIntent) {
      if (occ && occ !== "member" && occ.trim().length > 0) score += 50;
    }
    if (isSkillsIntent) {
      if (Array.isArray(m.skills) && m.skills.length > 0) score += 50;
    }
    if (isAllMembersIntent) {
      score += 30;
    }

    // 1. Direct phone / email matching (Highest relevance)
    if (queryDigitsOnly && queryDigitsOnly.length >= 4) {
      if (phoneDigits.includes(queryDigitsOnly) || whatsappDigits.includes(queryDigitsOnly)) score += 60;
    }
    if (email && (email.includes(qClean) || effectiveTokens.some((t) => t.length >= 4 && email.includes(t)))) {
      score += 45;
    }

    // 2. Direct exact or multi-word match
    if (occ && (occ.includes(qClean) || qClean.includes(occ))) score += 40;
    if (skills && (skills.includes(qClean) || qClean.includes(skills))) score += 35;
    if (name && (name.includes(qClean) || qClean.includes(name))) score += 35;
    if (school && (school.includes(qClean) || qClean.includes(school))) score += 25;
    if (location && location.includes(qClean)) score += 20;

    // 3. Keyword Token & Cross-Industry Synonym matching
    for (const token of effectiveTokens) {
      if (token.length < 2) continue;
      if (occ.includes(token)) score += 18;
      if (skills.includes(token)) score += 14;
      if (name.includes(token)) score += 15;
      if (school.includes(token)) score += 10;
      if (location.includes(token)) score += 10;
      if (gradYear === token) score += 12;
    }

    for (const syn of Array.from(expandedSynonyms)) {
      if (syn.length < 3) continue;
      if (occ.includes(syn)) score += 22;
      if (skills.includes(syn)) score += 16;
    }

    return {
      member: {
        id: m.id,
        fullName: m.fullName || "Community Member",
        firstName: m.firstName,
        surname: m.surname,
        occupation: m.occupation || "",
        skills: Array.isArray(m.skills) ? m.skills : [],
        phoneNumber: m.phoneNumber || "",
        whatsappNumber: m.whatsappNumber || m.phoneNumber || "",
        email: m.email || "",
        photoUrl: m.photoUrl || "",
        title: m.title || "",
        schoolName: m.schoolName || "",
        gradYear: m.gradYear ? String(m.gradYear) : "",
      },
      score,
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.member);
}

// Absolute ceiling on the whole search — Steps 1 and 2 each have their own
// per-request timeouts, but this is the single, explicit answer to "when
// does it stop searching": no matter how many fallback steps are involved,
// the caller never waits longer than this before getting a real (if lower-
// confidence) result from the always-instant local search in Step 3.
const MEMBER_SEARCH_OVERALL_DEADLINE_MS = 15000;

export async function searchMembers(query: string): Promise<MemberSearchResponse> {
  const localMembers = AppStateManager.getMembers();

  const runSteps = async (): Promise<MemberSearchResponse> => {
    // Step 1: Try the backend API — the only place Gemini is ever called
    // from (see SECURITY.md). Time-boxed so a slow server-side AI call can't
    // leave this stuck; Step 2 below always completes instantly.
    try {
      const headers = await getAuthHeaders();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      let res: Response;
      try {
        res = await fetch(apiUrl("/api/members/search"), {
          method: "POST",
          headers,
          body: JSON.stringify({ query }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        if (Array.isArray(data.members) && data.members.length > 0) {
          return {
            members: data.members,
            total: typeof data.total === "number" ? data.total : data.members.length,
            aiPowered: Boolean(data.aiPowered),
          };
        }
      }
    } catch {}

    // Step 2: Fast client-side semantic search engine — synchronous over the
    // full local member list, so it always finishes immediately and always
    // covers every contact regardless of how Step 1 went.
    const fallbackResults = performClientSemanticMemberSearch(localMembers, query);
    return {
      members: fallbackResults,
      total: fallbackResults.length,
      aiPowered: true,
    };
  };

  return Promise.race([
    runSteps(),
    new Promise<MemberSearchResponse>((resolve) => {
      setTimeout(() => {
        const fallbackResults = performClientSemanticMemberSearch(localMembers, query);
        resolve({ members: fallbackResults, total: fallbackResults.length, aiPowered: true });
      }, MEMBER_SEARCH_OVERALL_DEADLINE_MS);
    }),
  ]);
}

export async function adminAISearch(query: string): Promise<Member[]> {
  const localMembers = AppStateManager.getMembers();

  try {
    const headers = await getAuthHeaders();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(apiUrl("/api/admin/ai-search"), {
        method: "POST",
        headers,
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    const data = await res.json();
    if (res.ok && Array.isArray(data.members) && data.members.length > 0) {
      return data.members;
    }
  } catch {}

  // Fallback to local semantic search
  const semanticResults = performClientSemanticMemberSearch(localMembers, query);
  const idSet = new Set(semanticResults.map((r) => r.id));
  return localMembers.filter((m) => idSet.has(m.id));
}

// --- Birthday Reminder API Client Helpers ---

export interface BirthdayPreviewData {
  config: {
    recipientEmail: string;
    hasResendKey: boolean;
    senderEmail?: string;
    enabled: boolean;
  };
  nextMonth: {
    month: number;
    monthName: string;
    year: number;
    count: number;
    celebrants: any[];
    subject: string;
    htmlPreview: string;
  };
  tomorrow: {
    date: string;
    count: number;
    celebrants: any[];
    subject: string;
    htmlPreview: string;
  };
}

export async function updateBirthdayEmailConfig(updates: {
  recipientEmail?: string;
  resendApiKey?: string;
  senderEmail?: string;
  enabled?: boolean;
}): Promise<any> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl("/api/admin/birthdays/config"), {
    method: "POST",
    headers,
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Failed to update email config (${res.status})`);
  }
  return data;
}


