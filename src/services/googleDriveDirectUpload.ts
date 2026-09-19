/**
 * Direct Client-to-Google Drive Resumable Upload Service
 *
 * Streams photo and image files directly from the user's browser to the
 * Team Taraba River dedicated Google Drive folder using Google's Resumable Upload protocol.
 *
 * The Drive OAuth client secret and refresh token live on the server only —
 * this module asks the backend to open the resumable upload session (server
 * holds the credentials) and then streams bytes to the single-use session
 * URL Google hands back. The browser never sees the Drive credentials.
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
 * Asks the backend to open a Google Drive resumable upload session and
 * returns the single-use session URL to stream bytes to directly.
 */
async function initDriveUploadSession(
  fileName: string,
  mimeType: string,
  size: number,
  folderName: string
): Promise<{ uploadUrl: string; folderId: string | null }> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl("/api/media/drive/init-upload"), {
    method: "POST",
    headers,
    body: JSON.stringify({ fileName, mimeType, size, folderName }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.uploadUrl) {
    throw new Error(data.error || `Failed to initiate Google Drive upload session (${res.status}).`);
  }
  return { uploadUrl: data.uploadUrl, folderId: data.folderId || null };
}

/**
 * Asks the backend to grant public read permissions to an uploaded Drive file.
 */
async function makeFilePublicReadable(fileId: string): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    await fetch(apiUrl("/api/media/drive/make-public"), {
      method: "POST",
      headers,
      body: JSON.stringify({ fileId }),
    });
  } catch (err) {
    logger.warn(`[Drive] Could not set public permission on ${fileId}:`, err);
  }
}

/**
 * Uploads an image file or blob directly from the client browser to Google Drive.
 *
 * Flow:
 *   1. Ask the backend to open a Drive resumable upload session (server holds the credentials)
 *   2. Stream bytes with real-time XHR progress tracking directly to that session URL
 *   3. Ask the backend to set public read permissions on the uploaded image
 *   4. Return direct CDN image URL (`https://lh3.googleusercontent.com/d/${fileId}`)
 *
 * `onFolderId` (optional) is called with the real Google Drive folder id the
 * server resolved/created for this upload, as soon as the session opens —
 * every file in a batch lands in the same folder, so callers use this to
 * learn the folder's real id instead of fabricating one for the event record.
 *
 * Retries persistently (pausing for a backgrounded tab / offline device)
 * on network-class failures — the same failure class that used to make
 * video uploads restart from scratch on mobile. A clear client error (bad
 * request, unauthorized, forbidden) is not retried; that's a real problem
 * retrying won't fix, so the caller's own fallback tier takes over instead.
 */
export async function uploadImageDirectToDrive(
  fileOrBlob: File | Blob,
  fileName: string,
  folderName: string,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
  onFolderId?: (folderId: string) => void
): Promise<string> {
  if (signal?.aborted) {
    const err = new Error("Google Drive upload was aborted by user.");
    err.name = "AbortError";
    throw err;
  }

  const cleanName = (fileName || `image_${Date.now()}.webp`).replace(/[^a-zA-Z0-9._-]/g, "_");
  const mimeType = fileOrBlob.type || "image/webp";

  let attempt = 0;
  // Counts only failures that happened while the device was online and
  // visible the whole time - a backgrounded/offline period gets its budget
  // refreshed once it's back, but repeated LIVE failures mean this tier is
  // actually broken for this session, not just slow. Retrying forever would
  // just hang the batch instead of letting the Firebase Storage fallback
  // (which has its own, separately-implemented resilience) take over.
  let liveFailures = 0;
  const MAX_LIVE_FAILURES = 6;

  while (true) {
    attempt++;
    if (signal?.aborted) {
      const err = new Error("Google Drive upload was aborted by user.");
      err.name = "AbortError";
      throw err;
    }

    try {
      const session = await initDriveUploadSession(cleanName, mimeType, fileOrBlob.size, folderName);
      if (session.folderId && onFolderId) onFolderId(session.folderId);
      return await putImageOnce(fileOrBlob, session.uploadUrl, fileName, mimeType, onProgress, signal);
    } catch (err: any) {
      if (err?.name === "AbortError" || signal?.aborted) {
        throw err;
      }

      // A clear client-error status means retrying the exact same request
      // will just fail the same way again - not a network blip to wait out.
      const msg = String(err?.message || "").toLowerCase();
      const isClientError = /\((400|401|403)\)/.test(msg) || msg.includes("no file id");
      if (isClientError) {
        throw err;
      }

      logger.warn(`[Drive] Upload attempt ${attempt} for "${fileName}" failed: ${err?.message || err}.`);
      const wasBackgroundedOrOffline = await pauseForConnectivity("Drive", 0, fileOrBlob.size, logger);
      if (wasBackgroundedOrOffline) {
        liveFailures = 0;
      } else {
        liveFailures++;
        if (liveFailures >= MAX_LIVE_FAILURES) {
          logger.warn(`[Drive] ${liveFailures} consecutive live failures for "${fileName}" while online and visible - giving up on Drive so it can fall back to Cloud Storage.`);
          throw err;
        }
      }

      const backoffMs = Math.min(30000, 2000 * Math.min(attempt, 15));
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
}

function putImageOnce(
  fileOrBlob: File | Blob,
  uploadUrl: string,
  fileName: string,
  mimeType: string,
  onProgress: ((percent: number) => void) | undefined,
  signal: AbortSignal | undefined
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (signal?.aborted) {
      const err = new Error("Google Drive upload was aborted by user.");
      err.name = "AbortError";
      reject(err);
      return;
    }

    const UPLOAD_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
    const xhr = new XMLHttpRequest();
    let timedOut = false;

    // Once every byte has left the browser, Drive still needs a moment to
    // acknowledge and create the file object before xhr.onload fires - the
    // client has no event for that in-between stretch, only the final
    // response. Creep progress gently toward 99% instead of freezing there,
    // same treatment as the YouTube relay upload; the jump to 100 only ever
    // happens on the real completion response.
    let creepTimer: any = null;
    let creepPct = 92;
    const startCreep = () => {
      if (creepTimer) return;
      creepTimer = setInterval(() => {
        creepPct = Math.min(99, creepPct + 1);
        if (onProgress) onProgress(creepPct);
      }, 500);
    };
    const stopCreep = () => {
      if (creepTimer) {
        clearInterval(creepTimer);
        creepTimer = null;
      }
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener("abort", handleAbort);
      }
      stopCreep();
    };

    const handleAbort = () => {
      xhr.abort();
    };

    if (signal) {
      signal.addEventListener("abort", handleAbort, { once: true });
    }

    const timeoutId = setTimeout(() => {
      timedOut = true;
      cleanup();
      xhr.abort();
      reject(new Error(`Google Drive upload timed out for "${fileName}".`));
    }, UPLOAD_TIMEOUT_MS);

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", mimeType);

    if (xhr.upload) {
      if (onProgress) {
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const pct = Math.min(92, Math.round((evt.loaded / evt.total) * 100));
            creepPct = pct;
            onProgress(pct);
          }
        };
      }
      xhr.upload.onload = () => {
        startCreep();
      };
    }

    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (!data.id) {
            reject(new Error("Google Drive upload succeeded but returned no file ID."));
            return;
          }
          const fileId = data.id;

          // The file's own parent folder was already made public read the
          // moment it was created (findOrCreateDriveFolder, server-side) —
          // Drive files inherit their folder's sharing, so this file is
          // already viewable. This per-file call is now a best-effort
          // safety net for the rare case that inheritance doesn't apply
          // (e.g. a permission override), not something the upload needs
          // to wait on. Awaiting it here used to add a full extra
          // round-trip of visible "still uploading" time after every
          // photo's bytes had already finished transferring — proportionally
          // the whole perceived delay for a small, fast image.
          makeFilePublicReadable(fileId);

          // Step 4: Direct Google UserContent CDN link
          const cdnUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
          logger.info(`[Drive] ✅ Image upload complete to Google Drive: ${cdnUrl}`);
          if (onProgress) onProgress(100);
          resolve(cdnUrl);
        } catch (parseErr) {
          reject(new Error(`Google Drive response parse error: ${parseErr}`));
        }
      } else {
        let detail = xhr.responseText;
        try {
          const parsed = JSON.parse(xhr.responseText);
          detail = parsed?.error?.message || xhr.responseText;
        } catch {}
        reject(new Error(`Google Drive upload failed (${xhr.status}): ${detail}`));
      }
    };

    xhr.onerror = () => {
      cleanup();
      if (!timedOut) {
        if (signal?.aborted) {
          const err = new Error("Google Drive upload was aborted by user.");
          err.name = "AbortError";
          reject(err);
        } else {
          reject(new Error("Network connection error during Google Drive upload."));
        }
      }
    };

    xhr.onabort = () => {
      cleanup();
      if (!timedOut) {
        const err = new Error("Google Drive upload was aborted by user.");
        err.name = "AbortError";
        reject(err);
      }
    };

    xhr.send(fileOrBlob);
  });
}
