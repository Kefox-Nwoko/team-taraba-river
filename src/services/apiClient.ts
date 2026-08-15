import {
  Member,
  GroupEvent,
  PhotoApprovalRequest,
  AIQueryResponse,
} from "../types";
import { auth } from "../lib/firebase";
import { logger } from "../lib/logger";
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
export async function fetchMembers(): Promise<Member[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/members", { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return data.members || [];
  } catch {
    return [];
  }
}
export async function loginMember(
  credential: string
): Promise<{ member: Member; customToken: string }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  return data;
}
export async function loginGoogleAdmin(
  email: string,
  password?: string
): Promise<{ member: Member; token: string }> {
  // This endpoint is no longer used — admin login goes through Google OAuth popup
  // Kept for backward compatibility but will throw
  throw new Error("Direct admin login is no longer supported. Use Google OAuth sign-in.");
}
export async function registerMember(memberData: Partial<Member>): Promise<Member> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/members", {
    method: "POST",
    headers,
    body: JSON.stringify(memberData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Registration failed");
  return data.member;
}
export async function updateMemberProfile(
  id: string,
  memberData: Partial<Member>
): Promise<Member> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/members/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(memberData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Update failed");
  return data.member;
}
export async function fetchEvents(): Promise<GroupEvent[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/events", { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return data.events || [];
  } catch {
    return [];
  }
}
export async function createEvent(eventData: Partial<GroupEvent>): Promise<GroupEvent> {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/events", {
    method: "POST",
    headers,
    body: JSON.stringify(eventData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Event creation failed");
  return data.event;
}

export async function updateEvent(id: string, eventData: Partial<GroupEvent>): Promise<GroupEvent> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/events/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(eventData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Event update failed");
  return data.event;
}

export async function deleteEvent(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/events/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Event deletion failed");
  }
}
export async function submitEventRSVP(
  eventId: string,
  memberId: string,
  status: "attending" | "maybe" | "declined"
): Promise<{ event: GroupEvent }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/events/${eventId}/rsvp`, {
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
    const res = await fetch("/api/admin/approvals", { headers });
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
  const res = await fetch(`/api/admin/approvals/${id}/decision`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, adminNotes }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Decision submit failed");
  return data;
}
export async function fetchAnalytics(): Promise<{
  topFiveMembers: Member[];
  categoryBreakdown: any[];
  totalActivityPointsEarned: number;
}> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/admin/analytics", { headers });
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
  const res = await fetch("/api/ai/query-router", {
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
  const res = await fetch("/api/media/drive-sync", {
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
  const res = await fetch("/api/media/youtube-parse", {
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
  const res = await fetch("/api/media/cloud-sync-all", {
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
  const res = await fetch("/api/media/youtube-back-sync", {
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
  const headers = await getAuthHeaders();
  const res = await fetch("/api/admin/reset-data", {
    method: "POST",
    headers,
  });
  if (!res.ok) {
    let errMsg = `Reset failed with status ${res.status}`;
    try {
      const errData = await res.json();
      errMsg = errData.error || errMsg;
    } catch {
      try {
        const text = await res.text();
        if (text) errMsg = text;
      } catch {}
    }
    throw new Error(errMsg);
  }
  return await res.json();
}

export async function fetchVisitMetrics(): Promise<{ totalVisits: number; lastVisitTimestamp: string; latestUniqueUser: string }> {
  const res = await fetch("/api/system/visits", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch visit metrics");
  return await res.json();
}

export interface NewsHeadline {
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
}

export interface UsosaNewsResponse {
  headlines: NewsHeadline[];
  fetchedAt: string;
  fallback: boolean;
  message?: string;
}

export async function fetchUsosaNews(force = false): Promise<UsosaNewsResponse> {
  try {
    const url = force ? "/api/usosa-news?force=true" : "/api/usosa-news";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { headlines: [], fetchedAt: new Date().toISOString(), fallback: true };
    return await res.json();
  } catch {
    return { headlines: [], fetchedAt: new Date().toISOString(), fallback: true, message: "Network error" };
  }
}

export interface AiXploraResponse {
  answer: string;
  sources: { title: string; url: string }[];
  fallback: boolean;
}

export async function queryAiXplora(query: string, userName?: string): Promise<AiXploraResponse> {
  try {
    const headers = await getAuthHeaders();
    const storedKey = localStorage.getItem("gemini_api_key");
    const res = await fetch("/api/ai-xplora", {
      method: "POST",
      headers,
      body: JSON.stringify({ query, userName, apiKey: storedKey }),
    });
    if (!res.ok) return { answer: "Something went wrong. Please try again.", sources: [], fallback: true };
    return await res.json();
  } catch {
    return { answer: "Network error. Please check your connection.", sources: [], fallback: true };
  }
}

export async function adminAISearch(query: string): Promise<Member[]> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/admin/ai-search", {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "AI search failed");
    return data.members || [];
  } catch {
    return [];
  }
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
  type: "photo" | "video";
  base64Data: string;
  mimeType: string;
  fileName?: string;
  storageTarget?: "drive" | "youtube";
}): Promise<MediaUploadResponse> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/media/upload", {
      method: "POST",
      headers,
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Media upload failed");
    return data;
  } catch (err: any) {
    throw new Error(err.message || "Media upload failed");
  }
}

export async function finalizeMediaItem(mediaId: string): Promise<MediaFinalizeResponse> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/media/finalize", {
      method: "POST",
      headers,
      body: JSON.stringify({ mediaId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Media finalize failed");
    return data;
  } catch (err: any) {
    throw new Error(err.message || "Media finalize failed");
  }
}

export async function getMediaItemStatus(mediaId: string): Promise<MediaStatusResponse> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/media/status/${encodeURIComponent(mediaId)}`, {
      headers,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to get media status");
    return data;
  } catch (err: any) {
    throw new Error(err.message || "Failed to get media status");
  }
}
