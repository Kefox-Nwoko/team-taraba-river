/**
 * Direct Client-to-YouTube Resumable Upload Service
 *
 * Streams video files directly from the user's browser to the
 * @tarabateam YouTube channel using Google's Resumable Upload protocol.
 *
 * Credentials are injected at build time via Vite's import.meta.env.VITE_* mechanism.
 * The .env file (gitignored) holds the secrets; Vite inlines them as static strings.
 */
import { logger } from "../lib/logger";

// Vite statically replaces these at build time with the literal values from .env
const YT_CLIENT_ID = import.meta.env.VITE_YOUTUBE_CLIENT_ID ?? "";
const YT_CLIENT_SECRET = import.meta.env.VITE_YOUTUBE_CLIENT_SECRET ?? "";
const YT_REFRESH_TOKEN = import.meta.env.VITE_YOUTUBE_REFRESH_TOKEN ?? "";

let cachedAccessToken: string | null = null;
let tokenExpiryTime = 0;

/**
 * Refreshes the Google OAuth2 access token using the permanent channel refresh token.
 * Caches the token and reuses it until 60 seconds before expiry.
 */
async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedAccessToken && Date.now() < tokenExpiryTime - 60_000) {
    return cachedAccessToken;
  }

  if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) {
    throw new Error(
      "YouTube upload credentials are not configured. " +
      `Client ID: ${YT_CLIENT_ID ? "OK" : "MISSING"}, ` +
      `Client Secret: ${YT_CLIENT_SECRET ? "OK" : "MISSING"}, ` +
      `Refresh Token: ${YT_REFRESH_TOKEN ? "OK" : "MISSING"}`
    );
  }

  const body = new URLSearchParams({
    client_id: YT_CLIENT_ID,
    client_secret: YT_CLIENT_SECRET,
    refresh_token: YT_REFRESH_TOKEN,
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
    throw new Error(`Network error refreshing YouTube token: ${networkErr?.message || networkErr}`);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`YouTube token endpoint returned non-JSON (status ${res.status})`);
  }

  if (!res.ok || !data.access_token) {
    throw new Error(
      `YouTube token refresh failed (${res.status}): ${data.error_description || data.error || JSON.stringify(data)}`
    );
  }

  cachedAccessToken = data.access_token;
  tokenExpiryTime = Date.now() + (data.expires_in || 3600) * 1000;
  logger.info("[YT] Access token refreshed OK");
  return data.access_token;
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
): Promise<string> {
  // Attempt upload with 1 automatic retry on transient failures
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const url = await doUpload(file, folderName, onProgress);
      return url;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message.toLowerCase();
      const isRetryable = msg.includes("network") || msg.includes("timeout") || msg.includes("aborted");

      if (attempt === 1 && isRetryable) {
        logger.warn(`[YT] Upload attempt ${attempt} failed (retryable): ${lastError.message}. Retrying...`);
        // Small delay before retry
        await new Promise((r) => setTimeout(r, 2000));
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
): Promise<string> {
  // --- Step 1: Get access token ---
  const accessToken = await getAccessToken();

  // --- Step 2: Initialize resumable upload session ---
  const cleanTitle = (file.name || `Team Taraba River Video ${new Date().toLocaleDateString()}`)
    .replace(/\.[^/.]+$/, "")
    .substring(0, 95);

  const metadata = {
    snippet: {
      title: cleanTitle,
      description: `Team Taraba River Community Event Media Archive (${folderName || "General Event"})\nUploaded via Team Taraba River Portal.`,
      tags: ["Team Taraba River", "Community", "URIP", "USOSA", "Event"],
      categoryId: "22", // People & Blogs
    },
    status: {
      privacyStatus: "unlisted",
      selfDeclaredMadeForKids: false,
    },
  };

  let initRes: Response;
  try {
    initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Length": String(file.size),
          "X-Upload-Content-Type": file.type || "video/mp4",
        },
        body: JSON.stringify(metadata),
      },
    );
  } catch (networkErr: any) {
    throw new Error(`Network error creating YouTube upload session: ${networkErr?.message || networkErr}`);
  }

  if (!initRes.ok) {
    let errBody = "";
    try { errBody = await initRes.text(); } catch {}
    // Parse Google API error for a cleaner message
    let detail = errBody;
    try {
      const parsed = JSON.parse(errBody);
      detail = parsed?.error?.message || parsed?.error?.errors?.[0]?.message || errBody;
    } catch {}
    throw new Error(`YouTube upload init failed (${initRes.status}): ${detail}`);
  }

  // The resumable session URL is in the Location header
  const uploadUrl = initRes.headers.get("location") || initRes.headers.get("Location");
  if (!uploadUrl) {
    // Log all visible headers for debugging
    const visibleHeaders: string[] = [];
    initRes.headers.forEach((v, k) => visibleHeaders.push(`${k}: ${v}`));
    logger.error("[YT] No Location header. Visible headers:", visibleHeaders.join(", "));
    throw new Error(
      "YouTube returned OK but no upload session URL (Location header missing). " +
      "This may be a browser CORS restriction. Visible headers: " + visibleHeaders.join(", ")
    );
  }

  const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
  logger.info(`[YT] Upload session ready for "${file.name}" (${sizeMB} MB)`);

  // --- Step 3: Stream file bytes to YouTube via XHR with progress ---
  return new Promise<string>((resolve, reject) => {
    const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max
    const xhr = new XMLHttpRequest();
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      xhr.abort();
      reject(new Error(`YouTube upload timed out after ${UPLOAD_TIMEOUT_MS / 60000} minutes for "${file.name}" (${sizeMB} MB).`));
    }, UPLOAD_TIMEOUT_MS);

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const pct = Math.min(99, Math.round((evt.loaded / evt.total) * 100));
          onProgress(pct);
        }
      };
    }

    xhr.onload = () => {
      clearTimeout(timeoutId);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (!data.id) {
            reject(new Error("YouTube upload completed but returned no video ID. Response: " + xhr.responseText.substring(0, 200)));
            return;
          }
          const youtubeUrl = `https://www.youtube.com/watch?v=${data.id}`;
          logger.info(`[YT] ✅ Upload complete: ${youtubeUrl}`);
          if (onProgress) onProgress(100);
          resolve(youtubeUrl);
        } catch (parseErr) {
          reject(new Error(`YouTube upload response parse error: ${parseErr}. Raw: ${xhr.responseText.substring(0, 200)}`));
        }
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
      clearTimeout(timeoutId);
      if (!timedOut) {
        reject(new Error("Network connection lost during YouTube video upload. Please check your internet and try again."));
      }
    };

    xhr.onabort = () => {
      clearTimeout(timeoutId);
      if (!timedOut) {
        reject(new Error("YouTube video upload was aborted."));
      }
    };

    xhr.send(file);
  });
}
