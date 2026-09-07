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
): Promise<string> {
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
  return data.uploadUrl;
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
 */
export async function uploadImageDirectToDrive(
  fileOrBlob: File | Blob,
  fileName: string,
  folderName: string,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<string> {
  if (signal?.aborted) {
    const err = new Error("Google Drive upload was aborted by user.");
    err.name = "AbortError";
    throw err;
  }

  const cleanName = (fileName || `image_${Date.now()}.webp`).replace(/[^a-zA-Z0-9._-]/g, "_");
  const mimeType = fileOrBlob.type || "image/webp";

  // Step 1: Ask the backend to initiate the Drive resumable upload session
  let uploadUrl: string;
  try {
    uploadUrl = await initDriveUploadSession(cleanName, mimeType, fileOrBlob.size, folderName);
  } catch (initErr: any) {
    if (signal?.aborted) {
      const err = new Error("Google Drive upload was aborted by user.");
      err.name = "AbortError";
      throw err;
    }
    throw initErr;
  }

  if (signal?.aborted) {
    const err = new Error("Google Drive upload was aborted by user.");
    err.name = "AbortError";
    throw err;
  }

  // Step 2: PUT binary file data with XHR progress
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

    const cleanup = () => {
      clearTimeout(timeoutId);
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

    const timeoutId = setTimeout(() => {
      timedOut = true;
      cleanup();
      xhr.abort();
      reject(new Error(`Google Drive upload timed out for "${fileName}".`));
    }, UPLOAD_TIMEOUT_MS);

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", mimeType);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const pct = Math.min(99, Math.round((evt.loaded / evt.total) * 100));
          onProgress(pct);
        }
      };
    }

    xhr.onload = async () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (!data.id) {
            reject(new Error("Google Drive upload succeeded but returned no file ID."));
            return;
          }
          const fileId = data.id;
          // Step 3: Make image public readable so CDN image link works
          await makeFilePublicReadable(fileId);

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
