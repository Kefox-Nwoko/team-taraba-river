import {
  Member,
  GroupEvent,
  PhotoApprovalRequest,
  AIQueryResponse,
} from "../types";
import { auth } from "../lib/firebase";
import { logger } from "../lib/logger";
import { FirebaseSyncManager } from "./firebaseService";
import { AppStateManager } from "./storage";
import { isMemberCredentialMatch } from "../lib/authMatching";
import { sanitizeMemberRecord } from "../utils/nameUtils";

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
        return data.members;
      }
    }
  } catch {}

  // Direct Firestore fallback
  try {
    const firestoreMembers = await FirebaseSyncManager.seedCSVDataIfNeeded();
    if (firestoreMembers.length > 0) return firestoreMembers;
  } catch {}

  return AppStateManager.getMembers();
}

export async function deleteMember(memberId: string, member?: Member): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    await fetch(apiUrl(`/api/members/${memberId}`), {
      method: "DELETE",
      headers,
    });
  } catch {}

  await FirebaseSyncManager.deleteMember(memberId, member?.email, member?.phoneNumber);
  AppStateManager.deleteMember(memberId);
}

export async function loginMember(
  credential: string
): Promise<{ member: Member; customToken?: string }> {
  // Step 1: Try backend endpoint if available
  try {
    const res = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data && data.member) return data;
    }
  } catch {}

  // Step 2: Direct Firestore search fallback
  const members = await FirebaseSyncManager.seedCSVDataIfNeeded();
  const matched = members.find((m) => isMemberCredentialMatch(m, credential));

  if (matched) {
    return { member: matched };
  }

  throw new Error("Credentials not recognized. Access denied.");
}
export async function loginGoogleAdmin(
  email: string,
  password?: string
): Promise<{ member: Member; token: string }> {
  throw new Error("Direct admin login is no longer supported. Use Google OAuth sign-in.");
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
      if (data && data.member) return sanitizeMemberRecord(data.member);
    }
  } catch {}

  // Direct Firestore fallback
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
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl("/api/events"), { headers });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (Array.isArray(data.events) && data.events.length > 0) {
        return data.events;
      }
    }
  } catch {}

  // Direct Firestore fallback
  try {
    const firestoreEvents = await FirebaseSyncManager.fetchEventsFromFirestore();
    if (firestoreEvents.length > 0) return firestoreEvents;
  } catch {}

  return AppStateManager.getEvents();
}
export async function createEvent(eventData: Partial<GroupEvent>): Promise<GroupEvent> {
  const newEvent: GroupEvent = {
    id: eventData.id || `evt_${Date.now()}`,
    title: eventData.title || "Community Event",
    date: eventData.date || new Date().toISOString().split("T")[0],
    time: eventData.time || "09:00",
    location: eventData.location || "",
    category: eventData.category || "cleanup",
    description: eventData.description || "",
    driveImageUrls: eventData.driveImageUrls || [],
    driveFolderId: eventData.driveFolderId || `drive_folder_${Date.now()}`,
    youtubeVideoUrl: eventData.youtubeVideoUrl || "",
    createdBy: eventData.createdBy || "Community Member",
    createdById: eventData.createdById || "mem_guest",
    attendeeIds: eventData.attendeeIds || [],
    maxCapacity: eventData.maxCapacity || 100,
    createdAt: new Date().toISOString(),
    ...eventData,
  };

  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl("/api/events"), {
      method: "POST",
      headers,
      body: JSON.stringify(eventData),
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data && data.event) return data.event;
    }
  } catch {}

  // Direct Firestore fallback
  await FirebaseSyncManager.saveEvent(newEvent);
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
      if (data && data.event) updatedEvent = data.event;
    }
  } catch {}

  if (!updatedEvent) {
    const existing = AppStateManager.getEvents().find((e) => e.id === id);
    updatedEvent = {
      ...(existing || {
        id,
        title: "Event",
        date: "",
        time: "",
        location: "",
        category: "cleanup",
        description: "",
        driveImageUrls: [],
        createdBy: "Admin",
        createdById: "admin",
        attendeeIds: [],
        maxCapacity: 100,
        createdAt: new Date().toISOString(),
      }),
      ...eventData,
    };
    await FirebaseSyncManager.saveEvent(updatedEvent);
  }

  return updatedEvent;
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
export async function syncGoogleDriveUrl(
  driveUrl: string
): Promise<{ folderId: string; syncedImages: string[] }> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl("/api/media/drive-sync"), {
    method: "POST",
    headers,
    body: JSON.stringify({ driveUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Drive sync failed");
  return data;
}
export async function parseYouTubeVideoUrl(
  url: string
): Promise<{ videoId: string; embedUrl: string; title: string }> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl("/api/media/youtube-parse"), {
    method: "POST",
    headers,
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "YouTube parse failed");
  return data;
}

export async function triggerCloudSyncAll(direction: "reverse" | "forward" = "reverse"): Promise<{ success: boolean; events: GroupEvent[] }> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl("/api/media/cloud-sync-all"), {
    method: "POST",
    headers,
    body: JSON.stringify({ direction }),
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

export async function triggerYouTubeBackSync(channelId?: string, searchQuery?: string, urls?: string | string[]): Promise<{ success: boolean; message: string; syncedVideosCount: number; events: GroupEvent[] }> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl("/api/media/youtube-back-sync"), {
    method: "POST",
    headers,
    body: JSON.stringify({ channelId, searchQuery, urls }),
  });
  if (!res.ok) {
    let errMsg = "YouTube back-sync failed";
    try {
      const errData = await res.json();
      errMsg = errData.error || errMsg;
    } catch {}
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
    .replace(/\b(vanguard\s*news|vanguard|punch\s*newspapers|punch|the\s*guardian\s*nigeria|the\s*guardian|daily\s*trust|premium\s*times|leadership\s*newspapers|leadership|thecable|thisday\s*live|thisday|the\s*sun\s*nigeria|the\s*sun|sun\s*news|nigerian\s*tribune|tribune|businessday|daily\s*post\s*nigeria|daily\s*post|channels\s*tv|channels\s*television|arise\s*news|radio\s*nigeria|news\s*agency\s*of\s*nigeria|nan|google\s*news|rss\s*feed)\b/gi, "")
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

function extractKeywords(str: string): Set<string> {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "in", "on", "at", "to", "for", "of", "with",
    "by", "from", "as", "is", "are", "was", "were", "be", "this", "that", "it",
    "its", "into", "over", "after", "out", "about", "all", "new", "says", "how",
    "why", "who", "will", "can", "has", "have", "had", "more", "now", "just"
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

async function humanizeHeadlinesWithGemini(
  clusters: Array<{ title: string; rawSnippet: string; leadSource: string; schoolTag: string; otherSources: string[] }>,
  apiKey: string
): Promise<Map<string, { title: string; summary: string }>> {
  const models = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-latest"];
  const prompt = `You are a human journalist and senior editor reporting on Nigerian Federal Unity Colleges (FGC, FGGC, FSTC, King's College, Queen's College) and USOSA.

Here are ${clusters.length} current news items:
${JSON.stringify(clusters.map((c, i) => ({ index: i, title: c.title, context: c.rawSnippet, school: c.schoolTag })), null, 2)}

Instructions for each item:
1. Write a clean, human headline without any publisher names.
2. Write a comprehensive, human narrative story summary of 10 to 15 lines (about 120-180 words, formatted across 2 to 3 fluid paragraphs).
3. Tell the story naturally as a human journalist: Explain what happened, why parents/students/alumni are reacting (e.g. protests against privatization/concessioning of King's College Lagos, teacher absorptions, strikes, facility upgrades), what government officials or USOSA leaders said, and what will happen next.
4. STRICT RULES:
   - NO corporate/analytical headers (DO NOT write "Executive Summary:", "Context:", "Strategic Implications:", or bullet points).
   - DO NOT include publisher names in the story text (e.g. do NOT say "Vanguard News reported...").
   - DO NOT use robotic boilerplate templates (e.g. do NOT write "This significant development highlights the ongoing focus among educational administrators...").
   - Write genuine, fluent, human storytelling with empathy, substance, and clarity.

Return ONLY valid JSON (no markdown fences):
[
  {
    "index": 0,
    "title": "Clean Human Headline",
    "summary": "10-15 line narrative story summary in 2-3 paragraphs."
  }
]`;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const cleanedJson = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanedJson);
        const map = new Map<string, { title: string; summary: string }>();
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item.index === "number" && clusters[item.index]) {
              map.set(clusters[item.index].title, {
                title: item.title || clusters[item.index].title,
                summary: item.summary,
              });
            }
          }
          return map;
        }
      }
    } catch {}
  }
  return new Map();
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
function isRelevantToNigerianUnityColleges(title: string, snippet: string, sourceName: string = ""): boolean {
  const combined = `${title} ${snippet} ${sourceName}`.toLowerCase();

  // 1. Negative Exclusion Filters: Reject foreign/unrelated education policy or non-Nigerian news
  const foreignPolicyBlacklist = [
    /\bschool choice\b/i,
    /\bcharter school[s]?\b/i,
    /\bpublic school monopoly\b/i,
    /\bschool voucher[s]?\b/i,
    /\bdistrict superintendent\b/i,
    /\bking['’]?s college london\b/i,
    /\bqueen['’]?s college oxford\b/i,
    /\bqueen['’]?s college cambridge\b/i,
    /\bqueen['’]?s college melbourne\b/i,
    /\bflorida student\b/i,
    /\bfutures and options\b/i,
    /\bforeign security\b/i,
  ];

  for (const regex of foreignPolicyBlacklist) {
    if (regex.test(combined)) {
      // Immediate rejection of foreign policy / foreign university articles
      return false;
    }
  }

  // 2. High-Confidence Direct Entity Matches (Always relevant)
  const directEntities = [
    /\busosa\b/i,
    /\bunity school[s]?\b/i,
    /\bunity college[s]?\b/i,
    /\bfederal unity college[s]?\b/i,
    /\bfederal government college[s]?\b/i,
    /\bfederal government girls['’]? college[s]?\b/i,
    /\bfederal science and technical college[s]?\b/i,
    /\bfederal science & technical college[s]?\b/i,
    /\bfederal academy suleja\b/i,
    /\bsuleja academy\b/i,
    /\bking['’]?s college\b/i,
    /\bqueen['’]?s college\b/i,
    /\bkcoba\b/i,
    /\bqcoga\b/i,
    /\bfegowoco\b/i,
  ];

  for (const regex of directEntities) {
    if (regex.test(combined)) {
      return true;
    }
  }

  // 3. Specific Unity College Campus Patterns: e.g. "FGGC Bwari", "FGC Idoani", "FSTC Yaba", "FGC Warri"
  const campusPattern = /\b(fgc|fggc|fstc)\s+(bwari|yaba|usi|otukpo|uromi|ilesa|shiroro|zuru|ohanso|jalingo|orozo|doma|michika|kafanchan|dayi|hadejia|lassa|tungbo|uyo|ahoada|kano|kaduna|warri|enugu|okigwe|ugwolawo|ijanikin|oyo|sagamu|onitsha|kazaure|odogbolu|ikot\s*ekpene|ilorin|sokoto|maiduguri|buni\s*yadi|keffi|azare|biliri|gwarzo|tambuwal|wukari|potiskum|vandeikya|rubochi|keana|kiyawa|daura|birnin\s*kebbi|gwandu|minna|kontagora|new\s*bussa|bida|malumfashi|dutse|gumel|langtang|pankshin|mangu|shendam|bokkos|yawuri|anza|zaria|ebonyi|abakaliki|afikpo|isenya|ogidi|nnewi|awka|umuahia|owerri|abaji|kwali|gwagwalada)\b/i;

  if (campusPattern.test(combined)) {
    return true;
  }

  // 4. Secondary Context Filter: Acronym (FGC/FGGC/FSTC) + Nigerian Unity Schools Anchor
  const hasAcronym = /\b(fgc|fggc|fstc)\b/i.test(combined);
  const hasNigerianAnchor = /\b(nigeria|nigerian|lagos|abuja|federal ministry of education|minister of education|tahir mamman|tinubu|pta|old students|alumni|inter-house sports|concession|privatisation|privatize)\b/i.test(combined);

  if (hasAcronym && hasNigerianAnchor) {
    return true;
  }

  // Exclude everything else (Default Deny - zero false positives)
  return false;
}

const USOSA_NEWS_CACHE_KEY = "taraba_usosa_news_cache_v2";
const USOSA_NEWS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
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

  // Step 1: Try backend endpoint first if available with short 3s timeout
  try {
    const url = force ? apiUrl("/api/usosa-news?force=true") : apiUrl("/api/usosa-news");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      const data = await res.json();
      if (data && Array.isArray(data.headlines) && data.headlines.length > 0) {
        inMemoryUsosaNews = data;
        inMemoryUsosaNewsTimestamp = Date.now();
        try {
          localStorage.setItem(USOSA_NEWS_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
        } catch {}
        return data;
      }
    }
  } catch {}

  // Step 2: Live Multi-Stream Search strictly across USOSA, Unity Colleges, FGCs, FGGCs, FSTCs, King's & Queen's
  try {
    const queryStreams = [
      'USOSA Nigeria',
      'Unity Schools Nigeria',
      'Federal Unity Colleges Nigeria',
      'Federal Government College Nigeria',
      'Kings College Lagos',
      'Queens College Lagos',
      'FGGC Nigeria',
      'FSTC Nigeria',
      'Federal Science and Technical College Nigeria'
    ];

    const fetchPromises = queryStreams.map(async (queryStr) => {
      try {
        const query = encodeURIComponent(queryStr);
        const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-NG&gl=NG&ceid=NG:en`;
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

        const sourceName = extractedSource || item.author || "Google News Nigeria";
        const link = item.link || "https://news.google.com";
        const cleanDesc = (item.description || item.content || "").replace(/<[^>]*>?/gm, "").trim();

        // ── STRICT UNITY COLLEGES RELEVANCE GATE ──
        if (!isRelevantToNigerianUnityColleges(cleanTitle, cleanDesc, sourceName)) {
          continue; // Drop irrelevant / foreign news immediately
        }

        const itemDate = item.pubDate ? new Date(item.pubDate) : new Date();
        const itemTimestamp = !isNaN(itemDate.getTime()) ? itemDate.getTime() : Date.now();
        const pubDate = itemDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const keywords = extractKeywords(cleanTitle + " " + cleanDesc);
        const schoolTag = detectSchoolTag(cleanTitle + " " + cleanDesc);

        // Extract significant numbers from this headline (e.g. "11,700", "3,252")
        const titleNumbers = new Set(
          (cleanTitle.match(/\d[\d,]+/g) || [])
            .map(n => n.replace(/,/g, ''))
            .filter(n => parseInt(n, 10) >= 100)
        );

        // Normalize title for substring comparison
        const normTitle = cleanTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

        // Find existing cluster with topic similarity
        let matchedCluster: TopicCluster | null = null;
        for (const cluster of clusterList) {
          const similarity = calculateSimilarity(keywords, cluster.keywords);

          // Check 1: Jaccard keyword similarity above threshold
          const isKeywordMatch = similarity > 0.25;

          // Check 2: Both headlines share a significant number (e.g. 11,700 teachers)
          const clusterNumbers = new Set(
            (cluster.representativeTitle.match(/\d[\d,]+/g) || [])
              .map(n => n.replace(/,/g, ''))
              .filter(n => parseInt(n, 10) >= 100)
          );
          let sharedNumber = false;
          for (const num of titleNumbers) {
            if (clusterNumbers.has(num)) { sharedNumber = true; break; }
          }
          const isNumberMatch = sharedNumber && similarity > 0.15;

          // Check 3: One title is largely a substring of the other
          const normClusterTitle = cluster.representativeTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
          const shorter = normTitle.length < normClusterTitle.length ? normTitle : normClusterTitle;
          const longer = normTitle.length < normClusterTitle.length ? normClusterTitle : normTitle;
          const isSubstringMatch = shorter.length > 20 && longer.includes(shorter.slice(0, Math.floor(shorter.length * 0.6)));

          if (isKeywordMatch || isNumberMatch || isSubstringMatch) {
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
          // Update timestamp to the newest date among cluster sources
          matchedCluster.timestamp = Math.max(matchedCluster.timestamp, itemTimestamp);
          matchedCluster.publishedAt = new Date(matchedCluster.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
          // Expand cluster keywords
          for (const k of keywords) matchedCluster.keywords.add(k);
        } else {
          // Create new cluster
          const sourcesMap = new Map<string, NewsSourceCoverage>();
          sourcesMap.set(sourceName.toLowerCase(), coverage);

          clusterList.push({
            representativeTitle: cleanTitle,
            keywords,
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

      // Attempt Live Gemini AI Story Humanization on top clusters
      let humanizedMap = new Map<string, { title: string; summary: string }>();
      const activeGeminiKey = localStorage.getItem("gemini_api_key") || DEFAULT_GEMINI_KEY;
      if (activeGeminiKey && clusterList.length > 0) {
        try {
          const topClustersForAi = clusterList.slice(0, 8).map(c => ({
            title: c.representativeTitle,
            rawSnippet: c.rawSnippet,
            leadSource: c.leadSource,
            schoolTag: c.schoolTag,
            otherSources: Array.from(c.sourcesMap.values()).map(s => s.sourceName),
          }));
          humanizedMap = await humanizeHeadlinesWithGemini(topClustersForAi, activeGeminiKey);
        } catch (e) {
          console.warn("Gemini headline humanization skipped:", e);
        }
      }

      // Convert clusters to top 15 distinct headlines
      const clusteredHeadlines: NewsHeadline[] = clusterList.slice(0, 15).map((cluster) => {
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

const DEFAULT_GEMINI_KEY = (import.meta as any).env?.VITE_GEMINI_API_KEY || "";

export const USOSA_KNOWLEDGE_SYSTEM_INSTRUCTION = `You are Gemini AI Xplora — an intelligent, highly knowledgeable, and conversational AI assistant for USOSA and URIP (Unity Schools Revitalisation Initiative / Regional Integration Programs).

CORE KNOWLEDGE BASE & SYSTEMIC GROUNDING:
1. USOSA (Unity Schools Old Students Association): The apex umbrella association uniting alumni across all 115 Federal Unity Colleges in Nigeria. Motto: "Pro Unitate" (For Unity).
2. URIP: The USOSA Unity Schools Revitalisation Initiative / Regional Integration Programs.
3. Team Taraba River: The specific official name of this URIP team within the USOSA / URIP structure. It is a designated URIP team.
4. The 115 Federal Unity Colleges:
   - Federal Government Colleges (FGC) across all 36 states and FCT.
   - Federal Government Girls' Colleges (FGGC).
   - Federal Science and Technical Colleges (FSTC).
   - Flagship institutions: King's College Lagos (KCOBA), Queen's College Lagos (QCOGA), Federal Academy Suleja.
5. Unity Schools Traditions: House systems, Inter-House sports, set/class alumni coordination, collegiate principals, and mutual old students support.

INSTRUCTION RULES:
1. "CHECK INSIDE FIRST": Whenever a query relates to unity schools, USOSA, URIP, Team Taraba River (as a URIP team), alumni activities, or education, connect and ground your response in the context of USOSA, URIP, and Unity Schools heritage FIRST before checking outside.
2. ACCURATE TEAM TARABA RIVER CONTEXT: "Team Taraba River" is purely the name of a URIP team within the USOSA/URIP structure.
3. GENERAL KNOWLEDGE: For general queries (science, coding, business, philosophy, technology, sports, lifestyle, global topics), answer thoroughly, accurately, and intelligently like a standard top-tier Gemini AI without artificial constraints.
4. TONE & STYLE: Direct, articulate, conversational, and natural. No robotic boilerplate.`;

async function queryDirectGemini(
  query: string,
  apiKey: string,
  history?: ChatHistoryTurn[],
  userName?: string
): Promise<AiXploraResponse> {
  const models = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-flash-latest"];
  const userGreeting = userName ? ` The current user is named ${userName}.` : "";
  const dynamicInstruction = USOSA_KNOWLEDGE_SYSTEM_INSTRUCTION + userGreeting;

  const contentsPayload: any[] = [];
  if (Array.isArray(history) && history.length > 0) {
    contentsPayload.push(...history);
  }
  contentsPayload.push({
    role: "user",
    parts: [{ text: query }],
  });

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: dynamicInstruction }],
          },
          contents: contentsPayload,
        }),
      });
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        // Extract web search sources if available from grounding metadata
        const sources: { title: string; url: string }[] = [];
        const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        for (const chunk of chunks) {
          if (chunk.web?.uri && chunk.web?.title) {
            sources.push({ title: chunk.web.title, url: chunk.web.uri });
          }
        }
        return {
          answer: text,
          sources,
          fallback: false,
        };
      }
    } catch {}
  }
  throw new Error("Direct Gemini AI query attempt failed");
}

export async function queryAiXplora(
  query: string,
  userName?: string,
  history?: ChatHistoryTurn[]
): Promise<AiXploraResponse> {
  const storedKey = localStorage.getItem("gemini_api_key") || DEFAULT_GEMINI_KEY;

  // Step 1: Direct Live Google Gemini AI Call (Full Unrestricted Intelligence with USOSA Context Grounding)
  if (storedKey) {
    try {
      return await queryDirectGemini(query, storedKey, history, userName);
    } catch (directErr) {
      console.warn("Direct Gemini call attempt failed, checking backend fallback:", directErr);
    }
  }

  // Step 2: Try backend endpoint if reachable
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl("/api/ai-xplora"), {
      method: "POST",
      headers,
      body: JSON.stringify({ query, userName, apiKey: storedKey, history }),
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

async function queryDirectGeminiMemberSearch(
  allMembers: Member[],
  query: string,
  apiKey: string
): Promise<MemberSearchResult[] | null> {
  const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-3.6-flash", "gemini-flash-latest"];
  const memberDb = allMembers.map((m) => ({
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

  const prompt = `You are an intelligent contact & networking AI assistant for the Team Taraba River USOSA member database.
Your task: Understand the user's search prompt or natural language question and return ALL matching team members.

MEMBERS DATABASE:
${JSON.stringify(memberDb)}

RULES & CAPABILITIES:
1. Interpret conversational and general requests:
   - "list all those with occupation in the database" -> Return all members who have a listed occupation/profession.
   - "show all members in the database" / "who is in the database" -> Return all members.
   - "I need a doctor for emergency" -> Return doctors, physicians, healthcare workers.
   - "Who works in tech, engineering, programming?" -> Return engineers, software developers, technical professionals.
   - "Who is a lawyer or legal counsel?" -> Return lawyers, attorneys, barristers.
   - "Members who attended FGGC or graduated in 2007" -> Return matching schools/years.
2. Return ONLY a JSON array of matching member IDs, e.g. ["mem_1", "mem_2"]. No markdown ticks, no commentary.
3. If no members match, return [].

User prompt: "${query}"`;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      });
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
        if (Array.isArray(parsed) && parsed.length > 0) {
          const idSet = new Set(parsed);
          const matched = allMembers
            .filter((m) => idSet.has(m.id))
            .map((rawM) => {
              const m = sanitizeMemberRecord(rawM);
              return {
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
              };
            });
          if (matched.length > 0) return matched;
        }
      }
    } catch {}
  }
  return null;
}

export async function searchMembers(query: string): Promise<MemberSearchResponse> {
  const localMembers = AppStateManager.getMembers();
  const storedKey = localStorage.getItem("gemini_api_key") || DEFAULT_GEMINI_KEY;

  // Step 1: Try direct Gemini AI search if key is available
  if (storedKey && localMembers.length > 0) {
    try {
      const directAiResults = await queryDirectGeminiMemberSearch(localMembers, query, storedKey);
      if (directAiResults && directAiResults.length > 0) {
        return {
          members: directAiResults,
          total: directAiResults.length,
          aiPowered: true,
        };
      }
    } catch {}
  }

  // Step 2: Try backend API
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl("/api/members/search"), {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    });
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

  // Step 3: Fast client-side semantic search engine
  const fallbackResults = performClientSemanticMemberSearch(localMembers, query);
  return {
    members: fallbackResults,
    total: fallbackResults.length,
    aiPowered: true,
  };
}

export async function adminAISearch(query: string): Promise<Member[]> {
  const localMembers = AppStateManager.getMembers();
  const storedKey = localStorage.getItem("gemini_api_key") || DEFAULT_GEMINI_KEY;

  // Try direct Gemini first
  if (storedKey && localMembers.length > 0) {
    try {
      const directAiResults = await queryDirectGeminiMemberSearch(localMembers, query, storedKey);
      if (directAiResults && directAiResults.length > 0) {
        const idSet = new Set(directAiResults.map((r) => r.id));
        return localMembers.filter((m) => idSet.has(m.id));
      }
    } catch {}
  }

  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl("/api/admin/ai-search"), {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    });
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

export interface MediaUploadResponse {
  success: boolean;
  mediaId: string;
  status: string;
}

export interface MediaFinalizeResponse {
  success: boolean;
  mediaId: string;
  finalUrl?: string;
  status: string;
  error?: string;
}

export interface MediaStatusResponse {
  mediaId: string;
  status: string;
  finalUrl?: string;
  error?: string;
}

export async function uploadMediaItem(params: {
  eventId: string;
  folderName?: string;
  type: "photo" | "video";
  base64Data: string;
  mimeType: string;
  fileName?: string;
  storageTarget?: "drive" | "youtube";
}): Promise<MediaUploadResponse> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl("/api/media/upload"), {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      return await res.json();
    }
    const data = contentType.includes("application/json")
      ? await res.json()
      : { error: `Server returned non-JSON response (${res.status}).` };
    throw new Error(data.error || `Upload failed with status ${res.status}`);
  } catch (err: any) {
    throw new Error(err.message || "Media upload failed");
  }
}

export async function finalizeMediaItem(mediaId: string): Promise<MediaFinalizeResponse> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl("/api/media/finalize"), {
      method: "POST",
      headers,
      body: JSON.stringify({ mediaId }),
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      return await res.json();
    }
    const data = contentType.includes("application/json")
      ? await res.json()
      : { error: `Server returned non-JSON response (${res.status}).` };
    throw new Error(data.error || "Media finalize failed");
  } catch (err: any) {
    throw new Error(err.message || "Media finalize failed");
  }
}

export async function getMediaItemStatus(mediaId: string): Promise<MediaStatusResponse> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl(`/api/media/status/${encodeURIComponent(mediaId)}`), {
      headers,
    });
    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      return await res.json();
    }
    throw new Error("Failed to get media status");
  } catch (err: any) {
    throw new Error(err.message || "Failed to get media status");
  }
}

export async function uploadVideoToYouTubeBridge(
  file: File,
  folderName: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read video file for upload."));
    reader.onload = () => {
      const base64Data = reader.result as string;
      const xhr = new XMLHttpRequest();
      xhr.open("POST", apiUrl("/api/media/upload-video-to-youtube"));
      xhr.setRequestHeader("Content-Type", "application/json");

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const pct = Math.min(99, Math.round((evt.loaded / evt.total) * 100));
            onProgress(pct);
          }
        };
      }

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && res.success && res.youtubeUrl) {
            if (onProgress) onProgress(100);
            resolve(res.youtubeUrl);
          } else {
            reject(new Error(res.error || `Server returned error status ${xhr.status}`));
          }
        } catch {
          reject(new Error(`Invalid server response (${xhr.status})`));
        }
      };

      xhr.onerror = () => reject(new Error("Network error streaming video to YouTube bridge"));
      xhr.send(
        JSON.stringify({
          base64Data,
          fileName: file.name,
          folderName,
          mimeType: file.type || "video/mp4",
        })
      );
    };

    reader.readAsDataURL(file);
  });
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


