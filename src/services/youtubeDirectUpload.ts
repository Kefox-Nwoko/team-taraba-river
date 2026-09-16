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
 *   1. POST to the backend to open a YouTube Resumable Upload session
 *   2. PUT the file to that session URL in bounded chunks, each checkpointed
 *      against Google's server-confirmed byte offset (not just local state)
 *   3. Parse the final chunk's response for the video ID → return YouTube URL
 *
 * Includes:
 *   - Chunked transfer so a failure only costs the current chunk, never
 *     the whole file
 *   - Session-level resume (queries Google's actual offset before any retry)
 *   - Bounded retry budget so one stuck video can't stall an entire batch
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

  const totalBytes = file.size;
  const cleanTitle = (file.name || `Team Taraba River Video ${new Date().toLocaleDateString()}`)
    .replace(/\.[^/.]+$/, "")
    .substring(0, 95);

  // A single session + byte offset, carried across EVERY retry attempt at
  // every level. Previously there were two retry layers and only the inner
  // one actually resumed the existing session - the outer layer discarded
  // it and opened a brand-new session from byte 0 whenever the inner
  // recovery exhausted. Now every attempt, at every level, tries to resume
  // the current session first and only opens a fresh one if that session
  // is confirmed dead.
  //
  // On top of that, the whole file used to be sent as ONE PUT request.
  // xhr.upload.onprogress reports bytes handed to the OS socket, not bytes
  // Google has actually received - on a congested/throttled mobile link the
  // OS can buffer most of a multi-MB body locally, so the bar visibly climbs
  // toward 99% while the wire transfer is still trickling out. When that
  // single giant request then failed (a carrier proxy reset, a slow/failed
  // ack), there was nothing smaller to retry - the whole file was the only
  // unit of work, so the whole file restarted from byte 0. That is the
  // "99%, pause, reupload the same video" loop, and it can recur within
  // seconds because it isn't a timeout firing - it's a fast failure dragging
  // an all-or-nothing request down with it.
  //
  // Fixed by chunking: each PUT carries only CHUNK_SIZE bytes, and Google's
  // 308 response after every chunk names the exact byte offset it actually
  // has. A failure can only ever cost the current chunk, never the file.
  let uploadUrl: string | null = null;
  let startByte = 0;
  let lastError: Error | null = null;
  // Bounded low: a batch of several files uploads sequentially, so every
  // attempt here blocks the rest of the batch behind it.
  const MAX_ATTEMPTS = 4;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) {
      const err = new Error("Upload aborted by user.");
      err.name = "AbortError";
      throw err;
    }

    try {
      if (!uploadUrl) {
        uploadUrl = await initYouTubeUploadSession(cleanTitle, file.type || "video/mp4", file.size, folderName);
        startByte = 0;
        const sizeMB = (totalBytes / (1024 * 1024)).toFixed(1);
        logger.info(`[YT] Resumable session opened for "${file.name}" (${sizeMB} MB)`);
      } else {
        // Already have a session from a prior attempt - confirm exactly
        // where it left off instead of assuming it's dead.
        const resumeStatus = await queryResumeOffset(uploadUrl, totalBytes).catch(() => null);
        if (resumeStatus?.isComplete && resumeStatus.youtubeUrl) {
          if (onProgress) onProgress(100);
          return resumeStatus.youtubeUrl;
        }
        if (resumeStatus && resumeStatus.nextByte >= startByte) {
          startByte = resumeStatus.nextByte;
        }
        // If the query itself failed, keep the existing startByte and let
        // the next chunk's own Content-Range header settle it.
      }

      const url = await uploadInChunks(file, uploadUrl, startByte, totalBytes, onProgress, signal, (confirmedByte) => {
        // Fires after EVERY server-confirmed chunk, not just on failure -
        // startByte is always at most one chunk stale, never the whole file.
        startByte = confirmedByte;
      });
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

      // Try to resume the SAME session before giving up on it - only open a
      // fresh one (losing all progress) if that genuinely fails.
      if (uploadUrl) {
        const resumeStatus = await queryResumeOffset(uploadUrl, totalBytes).catch(() => null);
        if (resumeStatus?.isComplete && resumeStatus.youtubeUrl) {
          if (onProgress) onProgress(100);
          return resumeStatus.youtubeUrl;
        }
        if (resumeStatus && resumeStatus.nextByte >= startByte) {
          startByte = resumeStatus.nextByte;
        } else if (!resumeStatus) {
          logger.warn(`[YT] Could not confirm resume offset for the current session; will open a fresh one.`);
          uploadUrl = null;
        }
      }

      if (attempt < MAX_ATTEMPTS) {
        const backoffMs = Math.min(15000, 1000 * attempt);
        logger.warn(`[YT] Upload attempt ${attempt}/${MAX_ATTEMPTS} failed at byte ${startByte}/${totalBytes}: ${lastError.message}. Resuming in ${backoffMs}ms...`);
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
    }
  }

  throw lastError!;
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

// Must be a multiple of 256 KiB per Google's resumable-upload spec for every
// non-final chunk. 4 MiB keeps each request's worst-case stall/ack window
// short on a poor connection while not adding excessive round-trips for
// larger videos.
const CHUNK_SIZE = 4 * 1024 * 1024;

/**
 * Streams a file to a YouTube resumable session in bounded chunks, reporting
 * the server-confirmed byte offset back via onChunkConfirmed after every
 * chunk. A chunk that fails after its own short local retry only costs that
 * chunk - the loop resumes at the last confirmed offset, never byte 0.
 */
async function uploadInChunks(
  file: File,
  uploadUrl: string,
  startByte: number,
  totalBytes: number,
  onProgress: ((percent: number) => void) | undefined,
  signal: AbortSignal | undefined,
  onChunkConfirmed: (confirmedByte: number) => void
): Promise<string> {
  let current = startByte;

  while (current < totalBytes) {
    if (signal?.aborted) {
      const err = new Error("YouTube video upload was aborted by user.");
      err.name = "AbortError";
      throw err;
    }

    const chunkEnd = Math.min(current + CHUNK_SIZE, totalBytes);
    const result = await putChunkWithRetry(file, uploadUrl, current, chunkEnd, totalBytes, onProgress, signal);

    if (result.done && result.youtubeUrl) {
      if (onProgress) onProgress(100);
      logger.info(`[YT] ✅ Upload complete: ${result.youtubeUrl}`);
      return result.youtubeUrl;
    }

    current = result.nextByte;
    onChunkConfirmed(current);
  }

  throw new Error("Upload loop exited without a completion response from YouTube.");
}

/**
 * A single chunk PUT with a couple of quick local retries before bubbling
 * the failure up to the session-level attempt loop - most transient blips
 * (a reset connection, a slow ack) resolve within these without needing to
 * re-query the session or burn an outer attempt.
 */
async function putChunkWithRetry(
  file: File,
  uploadUrl: string,
  start: number,
  end: number,
  totalBytes: number,
  onProgress: ((percent: number) => void) | undefined,
  signal: AbortSignal | undefined
): Promise<{ done: boolean; nextByte: number; youtubeUrl?: string }> {
  const CHUNK_RETRY_ATTEMPTS = 2;
  let lastErr: Error | null = null;

  for (let i = 0; i <= CHUNK_RETRY_ATTEMPTS; i++) {
    if (signal?.aborted) {
      const err = new Error("YouTube video upload was aborted by user.");
      err.name = "AbortError";
      throw err;
    }
    try {
      return await putChunk(file, uploadUrl, start, end, totalBytes, onProgress, signal);
    } catch (err: any) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (lastErr.name === "AbortError" || signal?.aborted) {
        throw lastErr;
      }
      if (i < CHUNK_RETRY_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
      }
    }
  }

  throw lastErr!;
}

function putChunk(
  file: File,
  uploadUrl: string,
  start: number,
  end: number,
  totalBytes: number,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<{ done: boolean; nextByte: number; youtubeUrl?: string }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const err = new Error("YouTube video upload was aborted by user.");
      err.name = "AbortError";
      reject(err);
      return;
    }

    const xhr = new XMLHttpRequest();
    const INACTIVITY_TIMEOUT_MS = 90 * 1000; // 90s of zero byte transfer within this chunk
    // Once this chunk's bytes are on the wire, upload.onprogress stops
    // firing - from then we're only waiting on Google's ack for this one
    // small chunk, which should arrive in seconds, not minutes.
    const CHUNK_ACK_TIMEOUT_MS = 45 * 1000;
    let inactivityTimer: any = null;
    let timedOut = false;
    let chunkBytesSent = false;

    const resetHeartbeat = () => {
      clearTimeout(inactivityTimer);
      const timeoutMs = chunkBytesSent ? CHUNK_ACK_TIMEOUT_MS : INACTIVITY_TIMEOUT_MS;
      inactivityTimer = setTimeout(() => {
        timedOut = true;
        xhr.abort();
        reject(new Error(
          chunkBytesSent
            ? `YouTube did not acknowledge a chunk within ${CHUNK_ACK_TIMEOUT_MS / 1000}s.`
            : `YouTube upload stalled: No byte transfer detected for 90 seconds.`
        ));
      }, timeoutMs);
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
    xhr.setRequestHeader("Content-Range", `bytes ${start}-${end - 1}/${totalBytes}`);

    if (xhr.upload) {
      xhr.upload.onprogress = (evt) => {
        if (evt.total > 0 && evt.loaded >= evt.total) {
          chunkBytesSent = true;
        }
        resetHeartbeat();
        if (onProgress && totalBytes > 0) {
          const loadedSoFar = start + (evt.loaded || 0);
          const pct = Math.min(99, Math.round((loadedSoFar / totalBytes) * 100));
          onProgress(pct);
        }
      };
      xhr.upload.onload = () => {
        chunkBytesSent = true;
        resetHeartbeat();
      };
    }

    xhr.onload = () => {
      cleanup();
      if (xhr.status === 200 || xhr.status === 201) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (!data.id) {
            reject(new Error("YouTube upload completed but returned no video ID. Response: " + xhr.responseText.substring(0, 200)));
            return;
          }
          resolve({ done: true, nextByte: totalBytes, youtubeUrl: `https://www.youtube.com/watch?v=${data.id}` });
        } catch (parseErr) {
          reject(new Error(`YouTube upload response parse error: ${parseErr}. Raw: ${xhr.responseText.substring(0, 200)}`));
        }
      } else if (xhr.status === 308) {
        // Chunk accepted, more remaining - Google names exactly how much of
        // THIS chunk it actually has, which we trust over our own send count.
        const rangeHeader = xhr.getResponseHeader("Range");
        let nextByte = end;
        if (rangeHeader) {
          const match = rangeHeader.match(/bytes=0-(\d+)/);
          if (match && match[1]) {
            nextByte = parseInt(match[1], 10) + 1;
          }
        }
        resolve({ done: false, nextByte });
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

    xhr.send(file.slice(start, end));
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
