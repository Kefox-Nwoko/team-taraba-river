/**
 * Direct Client-to-Google Drive Resumable Upload Service
 *
 * Streams photo and image files directly from the user's browser to the
 * Team Taraba River dedicated Google Drive folder using Google's Resumable Upload protocol.
 *
 * Credentials and Target Folder ID are injected at build time via Vite's import.meta.env.VITE_* mechanism.
 */
import { logger } from "../lib/logger";

// Vite statically replaces these at build time with values from .env
const DRIVE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID ||
  import.meta.env.VITE_YOUTUBE_CLIENT_ID ||
  "";
const DRIVE_CLIENT_SECRET =
  import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_SECRET ||
  import.meta.env.VITE_YOUTUBE_CLIENT_SECRET ||
  "";
const DRIVE_REFRESH_TOKEN =
  import.meta.env.VITE_GOOGLE_DRIVE_REFRESH_TOKEN ||
  import.meta.env.VITE_YOUTUBE_REFRESH_TOKEN ||
  "";
const DRIVE_ROOT_FOLDER_ID =
  import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID ||
  "19UcHi6ItJBeOAENfsOCM69K05NHc_13D";

let cachedAccessToken: string | null = null;
let tokenExpiryTime = 0;
const subfolderCache = new Map<string, string>();

/**
 * Refreshes the Google OAuth2 access token using the permanent refresh token.
 * Caches the token and reuses it until 60 seconds before expiry.
 */
async function getDriveAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiryTime - 60_000) {
    return cachedAccessToken;
  }

  if (!DRIVE_CLIENT_ID || !DRIVE_CLIENT_SECRET || !DRIVE_REFRESH_TOKEN) {
    throw new Error(
      "Google Drive upload credentials are not configured. " +
      `Client ID: ${DRIVE_CLIENT_ID ? "OK" : "MISSING"}, ` +
      `Client Secret: ${DRIVE_CLIENT_SECRET ? "OK" : "MISSING"}, ` +
      `Refresh Token: ${DRIVE_REFRESH_TOKEN ? "OK" : "MISSING"}`
    );
  }

  const body = new URLSearchParams({
    client_id: DRIVE_CLIENT_ID,
    client_secret: DRIVE_CLIENT_SECRET,
    refresh_token: DRIVE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });

  let res: Response;
  try {
    res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (networkErr: any) {
    throw new Error(`Network error refreshing Google Drive token: ${networkErr?.message || networkErr}`);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Google token endpoint returned non-JSON (status ${res.status})`);
  }

  if (!res.ok || !data.access_token) {
    throw new Error(
      `Google Drive token refresh failed (${res.status}): ${data.error_description || data.error || JSON.stringify(data)}`
    );
  }

  cachedAccessToken = data.access_token;
  tokenExpiryTime = Date.now() + (data.expires_in || 3600) * 1000;
  logger.info("[Drive] Access token refreshed OK");
  return data.access_token;
}

/**
 * Finds or creates an event subfolder under the root Google Drive folder.
 */
async function getOrCreateEventSubfolder(
  folderName: string,
  accessToken: string
): Promise<string> {
  const rootId = DRIVE_ROOT_FOLDER_ID;
  if (!folderName || !rootId) return rootId;

  const cacheKey = `${rootId}::${folderName}`;
  if (subfolderCache.has(cacheKey)) {
    return subfolderCache.get(cacheKey)!;
  }

  try {
    // 1. Check if folder already exists
    const query = `'${rootId}' in parents and name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        const foundId = searchData.files[0].id;
        subfolderCache.set(cacheKey, foundId);
        return foundId;
      }
    }

    // 2. Create subfolder under root
    const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [rootId],
      }),
    });

    if (createRes.ok) {
      const createData = await createRes.json();
      if (createData.id) {
        // Make folder public readable
        makeFilePublicReadable(createData.id, accessToken).catch(() => {});
        subfolderCache.set(cacheKey, createData.id);
        logger.info(`[Drive] Created new subfolder "${folderName}" (${createData.id})`);
        return createData.id;
      }
    }
  } catch (err) {
    logger.warn(`[Drive] Subfolder creation fallback to root for "${folderName}":`, err);
  }

  return rootId;
}

/**
 * Grants public read permissions to a Google Drive file or folder so it can be viewed by all users.
 */
async function makeFilePublicReadable(fileId: string, accessToken: string): Promise<void> {
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        role: "reader",
        type: "anyone",
      }),
    });
  } catch (err) {
    logger.warn(`[Drive] Could not set public permission on ${fileId}:`, err);
  }
}

/**
 * Uploads an image file or blob directly from the client browser to Google Drive.
 *
 * Flow:
 *   1. Refresh Google OAuth access token
 *   2. Resolve or create event subfolder in Drive
 *   3. Initiate Google Drive Resumable Upload session
 *   4. Stream bytes with real-time XHR progress tracking
 *   5. Set public read permissions on uploaded image
 *   6. Return direct CDN image URL (`https://lh3.googleusercontent.com/d/${fileId}`)
 */
export async function uploadImageDirectToDrive(
  fileOrBlob: File | Blob,
  fileName: string,
  folderName: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  // Step 1: Get Access Token
  const accessToken = await getDriveAccessToken();

  // Step 2: Resolve target Google Drive folder
  const targetFolderId = await getOrCreateEventSubfolder(folderName, accessToken);

  // Step 3: Initialize Google Drive Resumable Upload Session
  const cleanName = (fileName || `image_${Date.now()}.webp`).replace(/[^a-zA-Z0-9._-]/g, "_");
  const mimeType = fileOrBlob.type || "image/webp";

  const metadata = {
    name: cleanName,
    mimeType,
    ...(targetFolderId ? { parents: [targetFolderId] } : {}),
  };

  let initRes: Response;
  try {
    initRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink,webContentLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Length": String(fileOrBlob.size),
          "X-Upload-Content-Type": mimeType,
        },
        body: JSON.stringify(metadata),
      }
    );
  } catch (networkErr: any) {
    throw new Error(`Network error initiating Google Drive upload session: ${networkErr?.message || networkErr}`);
  }

  if (!initRes.ok) {
    let errBody = "";
    try { errBody = await initRes.text(); } catch {}
    let detail = errBody;
    try {
      const parsed = JSON.parse(errBody);
      detail = parsed?.error?.message || parsed?.error?.errors?.[0]?.message || errBody;
    } catch {}
    throw new Error(`Google Drive upload init failed (${initRes.status}): ${detail}`);
  }

  const uploadUrl = initRes.headers.get("location") || initRes.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("Google Drive upload session URL missing in Location header.");
  }

  // Step 4: PUT binary file data with XHR progress
  return new Promise<string>((resolve, reject) => {
    const UPLOAD_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
    const xhr = new XMLHttpRequest();
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
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
      clearTimeout(timeoutId);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (!data.id) {
            reject(new Error("Google Drive upload succeeded but returned no file ID."));
            return;
          }
          const fileId = data.id;
          // Step 5: Make image public readable so CDN image link works
          await makeFilePublicReadable(fileId, accessToken);

          // Step 6: Direct Google UserContent CDN link
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
      clearTimeout(timeoutId);
      if (!timedOut) {
        reject(new Error("Network connection error during Google Drive upload."));
      }
    };

    xhr.onabort = () => {
      clearTimeout(timeoutId);
      if (!timedOut) {
        reject(new Error("Google Drive upload was aborted."));
      }
    };

    xhr.send(fileOrBlob);
  });
}
