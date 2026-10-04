import { describe, expect, it } from "vitest";
import { extractDriveFileId, isYouTubeBlockedError } from "../../server/youtubeDrain";

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";

describe("extractDriveFileId", () => {
  it("reads the id from the CDN link the Drive upload returns", () => {
    expect(extractDriveFileId(`https://lh3.googleusercontent.com/d/${ID}`)).toBe(ID);
  });

  it("ignores the metadata hash on reverse-synced Drive links", () => {
    expect(extractDriveFileId(`https://lh3.googleusercontent.com/d/${ID}#type=video&name=a.mp4`)).toBe(ID);
  });

  it("reads Drive file-view and image-proxy links", () => {
    expect(extractDriveFileId(`https://drive.google.com/file/d/${ID}/view`)).toBe(ID);
    expect(extractDriveFileId(`/api/media/image/${ID}`)).toBe(ID);
  });

  it("returns null for YouTube, Firebase Storage and empty values", () => {
    expect(extractDriveFileId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(extractDriveFileId("https://firebasestorage.googleapis.com/v0/b/x/o/events%2Fe1%2Fvideos%2Fa.mp4?alt=media")).toBeNull();
    expect(extractDriveFileId("")).toBeNull();
    expect(extractDriveFileId(undefined)).toBeNull();
  });
});

describe("isYouTubeBlockedError", () => {
  it("treats the channel upload limit message as blocked", () => {
    expect(isYouTubeBlockedError({ message: "The user has exceeded the number of videos they may upload." })).toBe(true);
  });

  it("treats limit and quota reasons as blocked", () => {
    expect(isYouTubeBlockedError({ errors: [{ reason: "uploadLimitExceeded" }] })).toBe(true);
    expect(isYouTubeBlockedError({ response: { data: { error: { errors: [{ reason: "quotaExceeded" }] } } } })).toBe(true);
  });

  it("treats credential failures as blocked", () => {
    expect(isYouTubeBlockedError({ message: "invalid_grant" })).toBe(true);
    expect(isYouTubeBlockedError({ code: 401 })).toBe(true);
  });

  it("does not treat a bad single video as blocked", () => {
    expect(isYouTubeBlockedError({ message: "Invalid video file", code: 400 })).toBe(false);
    expect(isYouTubeBlockedError({ message: "socket hang up" })).toBe(false);
  });
});
