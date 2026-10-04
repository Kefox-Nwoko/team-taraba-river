/**
 * YouTube helpers (URL parsing, thumbnails, deletion).
 *
 * The browser never uploads to YouTube. Videos are uploaded to Google Drive
 * first (see googleDriveDirectUpload.ts) and a daily server job
 * (server/youtubeDrain.ts, triggered by /api/cron/youtube-drain) moves them
 * to the @tarabateam YouTube channel up to whatever daily upload limit
 * YouTube allows, then swaps the event's video URL to the YouTube link.
 *
 * The YouTube OAuth client secret and refresh token live on the server only.
 */
import { logger } from "../lib/logger";
import { auth } from "../lib/firebase";

function apiUrl(path: string): string {
  try {
    const meta = (window as any).__API_BASE_URL__;
    if (meta) return `${String(meta).replace(/\/$/, "")}${path}`;
  } catch {}
  const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  try {
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

/**
 * Extracts the 11-character YouTube video ID from various URL formats.
 */
export function extractYouTubeId(url?: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

/**
 * Returns the highest quality thumbnail available for a YouTube video URL.
 */
export function getYouTubeThumbnail(url?: string): string | null {
  const id = extractYouTubeId(url);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

/**
 * Permanently deletes a video from the YouTube channel via the backend
 * (admin-only route — the server holds the credentials and enforces the
 * admin check, so this never touches YouTube credentials in the browser).
 * Returns true if deleted or already non-existent (404).
 */
export async function deleteYouTubeVideo(videoUrlOrId: string): Promise<boolean> {
  const videoId = extractYouTubeId(videoUrlOrId) || (videoUrlOrId.length === 11 ? videoUrlOrId : null);
  if (!videoId) {
    logger.warn("[YT] Could not extract YouTube video ID for deletion", { videoUrlOrId });
    return false;
  }

  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl(`/api/media/youtube/${videoId}`), {
      method: "DELETE",
      headers,
    });

    if (res.ok || res.status === 404) {
      logger.info(`[YT] ✅ Permanently deleted YouTube video: ${videoId}`);
      return true;
    }

    const errText = await res.text();
    logger.warn(`[YT] Failed to delete video ${videoId} (status ${res.status})`, { error: errText });
    return false;
  } catch (err) {
    logger.error("[YT] Error deleting YouTube video:", err);
    return false;
  }
}
