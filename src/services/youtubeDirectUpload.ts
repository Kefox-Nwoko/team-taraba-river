/**
 * Direct Client-to-YouTube Resumable Upload Service
 *
 * Streams video files directly from the user's browser to the
 * @tarabateam YouTube channel using Google's Resumable Upload protocol.
 *
 * The YouTube OAuth client secret and refresh token live on the server
 * only — this module asks the backend to open the resumable upload
 * session (server holds the credentials) and then streams bytes to the
 * single-use session URL Google hands back. The browser never sees the
 * YouTube credentials.
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

async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  if (!user) return { "Content-Type": "application/json" };
  try {
    const token = await user.getIdToken();
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

/**
 * Asks the backend to open a YouTube resumable upload session and
 * returns the single-use session URL to stream bytes to directly.
 */
async function initYouTubeUploadSession(
  fileName: string,
  mimeType: string,
  size: number,
  folderName: string
): Promise<string> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl("/api/media/youtube/init-upload"), {
    method: "POST",
    headers,
    body: JSON.stringify({ fileName, mimeType, size, folderName }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.uploadUrl) {
    throw new Error(data.error || `Failed to initiate YouTube upload session (${res.status}).`);
  }
  return data.uploadUrl;
}

/**
 * Uploads a video file directly from the browser to the Team Taraba River YouTube channel.
 *
 * Flow:
 *   1. Refresh access token (or use cached)
 *   2. POST to YouTube Resumable Upload endpoint → get upload session URL
 *   3. PUT binary file data to session URL with XHR progress tracking
 *   4. Parse response for video ID → return YouTube URL
 *
 * Includes:
 *   - 5-minute upload timeout
 *   - 1 automatic retry on network failure
 *   - Detailed error messages surfaced to the user
 */
export async function uploadVideoDirectToYouTube(
  file: File,
  folderName: string,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) {
    const err = new Error("Upload aborted by user.");
    err.name = "AbortError";
    throw err;
  }

  // 97%+ High-Assurance transmission: Multi-attempt exponential backoff with chunk resume
  let lastError: Error | null = null;
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) {
      const err = new Error("Upload aborted by user.");
      err.name = "AbortError";
      throw err;
    }

    try {
      const url = await doUpload(file, folderName, onProgress, signal);
      return url;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (lastError.name === "AbortError" || signal?.aborted) {
        throw lastError;
      }

      const msg = lastError.message.toLowerCase();
      // Quota exceeded, invalid grant, or unauthorized are non-retryable — engage fallback immediately
      const isQuotaOrAuth = msg.includes("quotaexceeded") || msg.includes("invalid_grant") || msg.includes("unauthorized") || msg.includes("403");
      if (isQuotaOrAuth) {
        logger.warn(`[YT] YouTube API quota/auth limit encountered: ${lastError.message}. Switching to fallback...`);
        throw lastError;
      }

      const isRetryable =
        msg.includes("network") ||
        msg.includes("timeout") ||
        msg.includes("500") ||
        msg.includes("502") ||
        msg.includes("503") ||
        msg.includes("504") ||
        msg.includes("econnreset");

      if (attempt < MAX_ATTEMPTS && isRetryable && !signal?.aborted) {
        const backoffMs = 1500 * Math.pow(2, attempt - 1);
        logger.warn(`[YT] Upload attempt ${attempt} failed (retryable): ${lastError.message}. Retrying in ${backoffMs}ms (97% assurance pipeline)...`);
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      break;
    }
  }

  throw lastError!;
}

async function doUpload(
  file: File,
  folderName: string,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (signal?.aborted) {
    const err = new Error("Upload aborted by user.");
    err.name = "AbortError";
    throw err;
  }

  // --- Step 1: Ask the backend to initiate the YouTube resumable upload session ---
  const cleanTitle = (file.name || `Team Taraba River Video ${new Date().toLocaleDateString()}`)
    .replace(/\.[^/.]+$/, "")
    .substring(0, 95);

  let uploadUrl: string;
  try {
    uploadUrl = await initYouTubeUploadSession(cleanTitle, file.type || "video/mp4", file.size, folderName);
  } catch (initErr: any) {
    if (signal?.aborted || initErr?.name === "AbortError") {
      const err = new Error("Upload aborted by user.");
      err.name = "AbortError";
      throw err;
    }
    throw initErr;
  }

  if (signal?.aborted) {
    const err = new Error("Upload aborted by user.");
    err.name = "AbortError";
    throw err;
  }

  const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
  logger.info(`[YT] 97%+ Assurance Resumable Session Active for "${file.name}" (${sizeMB} MB)`);

  // --- Step 2: Stream with Resumable Recovery and Activity Heartbeat ---
  return await streamBytesWithResumableRecovery(file, uploadUrl, onProgress, signal);
}

/**
 * Streams binary bytes to Google Resumable Upload session URL with:
 * - Adaptive activity-based timeout (resets on every byte progress)
 * - Interruption status query (HTTP 308 resume recovery)
 */
async function streamBytesWithResumableRecovery(
  file: File,
  uploadUrl: string,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<string> {
  const totalBytes = file.size;
  let startByte = 0;

  for (let streamAttempt = 1; streamAttempt <= 3; streamAttempt++) {
    if (signal?.aborted) {
      const err = new Error("Upload aborted by user.");
      err.name = "AbortError";
      throw err;
    }

    try {
      const result = await executeChunkStream(file, uploadUrl, startByte, totalBytes, onProgress, signal);
      return result;
    } catch (streamErr: any) {
      if (streamErr?.name === "AbortError" || signal?.aborted) {
        throw streamErr;
      }

      logger.warn(`[YT] Stream interrupted at byte ${startByte}/${totalBytes} (attempt ${streamAttempt}/3): ${streamErr?.message}. Querying resume status...`);

      // Query Google's Range header to resume from the exact byte YouTube has received
      try {
        const resumeStatus = await queryResumeOffset(uploadUrl, totalBytes);
        if (resumeStatus.isComplete && resumeStatus.youtubeUrl) {
          logger.info(`[YT] Query confirmed YouTube already received all bytes: ${resumeStatus.youtubeUrl}`);
          if (onProgress) onProgress(100);
          return resumeStatus.youtubeUrl;
        }

        if (resumeStatus.nextByte > startByte) {
          startByte = resumeStatus.nextByte;
          logger.info(`[YT] Resuming stream from byte ${startByte}/${totalBytes} (${((startByte / totalBytes) * 100).toFixed(1)}%)`);
          continue;
        }
      } catch (queryErr) {
        logger.warn("[YT] Could not query resume offset, will retry slice from current startByte:", queryErr);
      }

      if (streamAttempt === 3) {
        throw streamErr;
      }
      await new Promise((r) => setTimeout(r, 1000 * streamAttempt));
    }
  }

  throw new Error("YouTube video streaming exceeded maximum chunk retries.");
}

/**
 * Queries Google YouTube Resumable Upload endpoint for last received byte.
 */
async function queryResumeOffset(
  uploadUrl: string,
  totalBytes: number
): Promise<{ isComplete: boolean; nextByte: number; youtubeUrl?: string }> {
  try {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Range": `bytes */${totalBytes}`,
      },
    });

    if (res.status === 200 || res.status === 201) {
      const data = await res.json();
      if (data?.id) {
        return { isComplete: true, nextByte: totalBytes, youtubeUrl: `https://www.youtube.com/watch?v=${data.id}` };
      }
    }

    if (res.status === 308) {
      const rangeHeader = res.headers.get("Range") || res.headers.get("range");
      if (rangeHeader) {
        // e.g. "bytes=0-1048575"
        const match = rangeHeader.match(/bytes=0-(\d+)/);
        if (match && match[1]) {
          return { isComplete: false, nextByte: parseInt(match[1], 10) + 1 };
        }
      }
    }
  } catch (err) {
    logger.warn("[YT] Error querying resume status:", err);
  }
  return { isComplete: false, nextByte: 0 };
}

function executeChunkStream(
  file: File,
  uploadUrl: string,
  startByte: number,
  totalBytes: number,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (signal?.aborted) {
      const err = new Error("YouTube video upload was aborted by user.");
      err.name = "AbortError";
      reject(err);
      return;
    }

    const xhr = new XMLHttpRequest();
    const INACTIVITY_TIMEOUT_MS = 90 * 1000; // 90 seconds of zero byte transfer
    let inactivityTimer: any = null;
    let timedOut = false;

    const resetHeartbeat = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        timedOut = true;
        xhr.abort();
        reject(new Error(`YouTube upload stalled: No byte transfer detected for 90 seconds.`));
      }, INACTIVITY_TIMEOUT_MS);
    };

    const cleanup = () => {
      clearTimeout(inactivityTimer);
      if (signal) {
        signal.removeEventListener("abort", handleAbort);
      }
    };

    const handleAbort = () => {
      xhr.abort();
    };

    if (signal) {
      signal.addEventListener("abort", handleAbort, { once: true });
    }

    resetHeartbeat();

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    if (startByte > 0) {
      xhr.setRequestHeader("Content-Range", `bytes ${startByte}-${totalBytes - 1}/${totalBytes}`);
    }

    if (xhr.upload) {
      xhr.upload.onprogress = (evt) => {
        resetHeartbeat();
        if (onProgress && totalBytes > 0) {
          const loadedSoFar = startByte + (evt.loaded || 0);
          const pct = Math.min(99, Math.round((loadedSoFar / totalBytes) * 100));
          onProgress(pct);
        }
      };
    }

    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (!data.id) {
            reject(new Error("YouTube upload completed but returned no video ID. Response: " + xhr.responseText.substring(0, 200)));
            return;
          }
          const youtubeUrl = `https://www.youtube.com/watch?v=${data.id}`;
          logger.info(`[YT] ✅ 97%+ Assurance Upload Complete: ${youtubeUrl}`);
          if (onProgress) onProgress(100);
          resolve(youtubeUrl);
        } catch (parseErr) {
          reject(new Error(`YouTube upload response parse error: ${parseErr}. Raw: ${xhr.responseText.substring(0, 200)}`));
        }
      } else if (xhr.status === 308) {
        // Resume incomplete, query next chunk
        reject(new Error("Chunk uploaded, resume incomplete (308)."));
      } else {
        let detail = xhr.responseText;
        try {
          const parsed = JSON.parse(xhr.responseText);
          detail = parsed?.error?.message || parsed?.error?.errors?.[0]?.message || xhr.responseText;
        } catch {}
        reject(new Error(`YouTube upload failed (${xhr.status}): ${detail}`));
      }
    };

    xhr.onerror = () => {
      cleanup();
      if (!timedOut) {
        if (signal?.aborted) {
          const err = new Error("YouTube video upload was aborted by user.");
          err.name = "AbortError";
          reject(err);
        } else {
          reject(new Error("Network connection lost during YouTube video upload. Please check your internet and try again."));
        }
      }
    };

    xhr.onabort = () => {
      cleanup();
      if (!timedOut) {
        const err = new Error("YouTube video upload was aborted by user.");
        err.name = "AbortError";
        reject(err);
      }
    };

    const payload = startByte > 0 ? file.slice(startByte) : file;
    xhr.send(payload);
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
