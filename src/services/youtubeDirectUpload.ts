/**
 * YouTube Upload via Server Relay
 *
 * Streams a video file from the browser to OUR OWN server, which then
 * relays it to the @tarabateam YouTube channel using the official Google
 * API client library (server-to-server, not a browser XHR/fetch call to
 * googleapis.com).
 *
 * This replaces an earlier direct-from-browser resumable-upload approach.
 * That approach was retired after extensive real-world testing showed a
 * specific, reproducible failure: every video's upload would succeed for
 * every intermediate chunk, then fail — every single time, regardless of
 * file, regardless of how many times it was retried — on the one request
 * that actually completes the upload. `xhr.onerror` (the only signal a
 * browser gives for that class of failure) carries zero diagnostic detail
 * by design: it looks identical whether the connection genuinely dropped
 * or a real HTTP response came back but was blocked from JS by a CORS
 * policy. There was no way to tell those apart, or fix the problem, from
 * inside a browser tab. Relaying through our own server sidesteps the
 * question entirely — the browser only ever talks to our own domain
 * (already CORS-configured and working for every other API call in this
 * app), and our server's call to YouTube uses the official Node client,
 * which surfaces real Google API error messages instead of an opaque
 * browser network error.
 *
 * The YouTube OAuth client secret and refresh token live on the server
 * only, exactly as before — this module never sees them.
 */
import { logger } from "../lib/logger";
import { auth } from "../lib/firebase";
import { pauseForConnectivity } from "../lib/networkWait";

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
 * Uploads a video file to the Team Taraba River YouTube channel by relaying
 * it through our own server (browser -> our server -> YouTube), instead of
 * streaming resumable chunks directly from the browser to Google. See the
 * module comment above for why.
 *
 * Retries persistently on network-class failures, pausing for a
 * backgrounded tab or offline device rather than hammering a connection
 * that isn't there — but bounded to a small number of LIVE failures
 * (online, visible, still failing) before giving up so a structurally
 * broken attempt falls back to the caller's Drive/Storage tiers instead of
 * hanging the batch.
 */
export async function uploadVideoViaServerRelay(
  file: File,
  folderName: string,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<string> {
  if (signal?.aborted) {
    const err = new Error("Upload aborted by user.");
    err.name = "AbortError";
    throw err;
  }

  let attempt = 0;
  let liveFailures = 0;
  const MAX_LIVE_FAILURES = 4;

  while (true) {
    attempt++;
    if (signal?.aborted) {
      const err = new Error("Upload aborted by user.");
      err.name = "AbortError";
      throw err;
    }

    try {
      return await relayOnce(file, folderName, onProgress, signal);
    } catch (err: any) {
      if (err?.name === "AbortError" || signal?.aborted) {
        throw err;
      }

      const msg = String(err?.message || "").toLowerCase();
      // Quota exceeded, invalid grant, or unauthorized are non-retryable — engage fallback immediately
      const isNonRetryable = msg.includes("quotaexceeded") || msg.includes("invalid_grant") || msg.includes("unauthorized") || msg.includes("403") || msg.includes("401");
      if (isNonRetryable) {
        logger.warn(`[YT Relay] Non-retryable error: ${err.message}. Switching to fallback...`);
        throw err;
      }

      logger.warn(`[YT Relay] Upload attempt ${attempt} for "${file.name}" failed: ${err?.message || err}.`);
      const wasBackgroundedOrOffline = await pauseForConnectivity("YT Relay", 0, file.size, logger);
      if (wasBackgroundedOrOffline) {
        liveFailures = 0;
      } else {
        liveFailures++;
        if (liveFailures >= MAX_LIVE_FAILURES) {
          logger.warn(`[YT Relay] ${liveFailures} consecutive live failures for "${file.name}" - giving up so it can fall back to Drive.`);
          throw err;
        }
      }

      const backoffMs = Math.min(20000, 2000 * Math.min(attempt, 10));
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
}

function relayOnce(
  file: File,
  folderName: string,
  onProgress: ((percent: number) => void) | undefined,
  signal: AbortSignal | undefined
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (signal?.aborted) {
      const err = new Error("Upload aborted by user.");
      err.name = "AbortError";
      reject(err);
      return;
    }

    getAuthHeaders().then((authHeaders) => {
      if (signal?.aborted) {
        const err = new Error("Upload aborted by user.");
        err.name = "AbortError";
        reject(err);
        return;
      }

      const cleanFileName = encodeURIComponent(file.name || `video_${Date.now()}.mp4`);
      const cleanFolderName = encodeURIComponent(folderName || "Event Media");
      const xhr = new XMLHttpRequest();

      const handleAbort = () => xhr.abort();
      if (signal) signal.addEventListener("abort", handleAbort, { once: true });

      // Once every byte has left the browser, the server is already
      // relaying them on to YouTube as they arrive (it streams, it doesn't
      // wait for the full file first) — but the client has no event for
      // "YouTube received byte N of the tail", only the final response.
      // Rather than freeze the bar at 90% for that last honest-but-silent
      // stretch, creep it gently toward 99% so it keeps visibly moving;
      // the jump to 100 only ever happens on the real completion response.
      let creepTimer: any = null;
      let creepPct = 90;
      const startCreep = () => {
        if (creepTimer) return;
        creepTimer = setInterval(() => {
          creepPct = Math.min(99, creepPct + 1);
          if (onProgress) onProgress(creepPct);
        }, 600);
      };
      const stopCreep = () => {
        if (creepTimer) {
          clearInterval(creepTimer);
          creepTimer = null;
        }
      };

      const cleanup = () => {
        if (signal) signal.removeEventListener("abort", handleAbort);
        stopCreep();
      };

      xhr.open("POST", apiUrl(`/api/media/youtube/relay-upload?fileName=${cleanFileName}&folderName=${cleanFolderName}`));
      if (authHeaders.Authorization) {
        xhr.setRequestHeader("Authorization", authHeaders.Authorization);
      }
      xhr.setRequestHeader("Content-Type", file.type || "video/mp4");

      if (xhr.upload) {
        if (onProgress) {
          xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
              const pct = Math.min(90, Math.round((evt.loaded / evt.total) * 100));
              creepPct = pct;
              onProgress(pct);
            }
          };
        }
        xhr.upload.onload = () => {
          // All bytes handed off - start the visible creep while we wait
          // for YouTube to finish confirming the upload.
          startCreep();
        };
      }

      xhr.onload = () => {
        cleanup();
        let data: any = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          reject(new Error(`YouTube relay upload returned an invalid response (status ${xhr.status}).`));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300 && data?.success && data?.youtubeUrl) {
          if (onProgress) onProgress(100);
          logger.info(`[YT Relay] ✅ Upload complete: ${data.youtubeUrl}`);
          resolve(data.youtubeUrl);
        } else {
          reject(new Error(data?.error || `YouTube relay upload failed (status ${xhr.status}).`));
        }
      };

      xhr.onerror = () => {
        cleanup();
        if (signal?.aborted) {
          const err = new Error("Upload aborted by user.");
          err.name = "AbortError";
          reject(err);
        } else {
          reject(new Error(`Network error reaching our server while relaying video to YouTube (xhr.status=${xhr.status}).`));
        }
      };

      xhr.onabort = () => {
        cleanup();
        const err = new Error("Upload aborted by user.");
        err.name = "AbortError";
        reject(err);
      };

      xhr.send(file);
    });
  });
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
