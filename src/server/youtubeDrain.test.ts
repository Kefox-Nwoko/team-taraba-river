import { describe, expect, it } from "vitest";
import { buildVideoUrlSwap, extractDriveFileId, findDriveVideoUrls, isYouTubeBlockedError } from "../../server/youtubeDrain";

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

const ID2 = "1ZyXwVuTsRqPoNmLkJiHgFeDcBa987654";
const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

describe("findDriveVideoUrls", () => {
  it("finds Drive videos in the video list, including the single-link field", () => {
    const found = findDriveVideoUrls({
      youtubeVideoUrls: [`https://lh3.googleusercontent.com/d/${ID}`, YT],
      youtubeVideoUrl: `https://lh3.googleusercontent.com/d/${ID2}`,
    });
    expect(found.map((f) => f.fileId)).toEqual([ID, ID2]);
    expect(found.every((f) => f.source === "youtubeVideoUrls")).toBe(true);
  });

  it("finds reverse-synced Drive videos hiding in the image list, but not real images", () => {
    const found = findDriveVideoUrls({
      driveImageUrls: [
        `https://lh3.googleusercontent.com/d/${ID}#type=video&name=a.mp4`,
        `https://lh3.googleusercontent.com/d/${ID2}#name=b.mp4`,
        "https://lh3.googleusercontent.com/d/1PhotoPhotoPhotoPhotoPhoto123",
      ],
    });
    expect(found.map((f) => f.fileId)).toEqual([ID, ID2]);
    expect(found.every((f) => f.source === "driveImageUrls")).toBe(true);
  });

  it("ignores YouTube, Firebase Storage and events with no videos", () => {
    expect(findDriveVideoUrls({ youtubeVideoUrls: [YT, "https://firebasestorage.googleapis.com/v0/b/x/o/a.mp4?alt=media"] })).toEqual([]);
    expect(findDriveVideoUrls({})).toEqual([]);
    expect(findDriveVideoUrls(null)).toEqual([]);
  });
});

describe("buildVideoUrlSwap", () => {
  const drive = `https://lh3.googleusercontent.com/d/${ID}`;

  it("replaces the Drive link in the video list and single field", () => {
    expect(buildVideoUrlSwap({ youtubeVideoUrls: [drive, "x"], youtubeVideoUrl: drive }, drive, YT)).toEqual({
      youtubeVideoUrls: [YT, "x"],
      youtubeVideoUrl: YT,
    });
  });

  it("moves a video found in the image list across to the video list", () => {
    const marked = `${drive}#type=video`;
    expect(buildVideoUrlSwap({ youtubeVideoUrls: [], driveImageUrls: ["keep", marked] }, marked, YT)).toEqual({
      youtubeVideoUrls: [YT],
      youtubeVideoUrl: YT,
      driveImageUrls: ["keep"],
    });
  });

  it("keeps an existing single link that is a different video", () => {
    const update = buildVideoUrlSwap({ youtubeVideoUrls: [drive], youtubeVideoUrl: "other" }, drive, YT);
    expect(update?.youtubeVideoUrl).toBe("other");
  });

  it("returns null when the old link is gone from the event", () => {
    expect(buildVideoUrlSwap({ youtubeVideoUrls: ["x"], driveImageUrls: [] }, drive, YT)).toBeNull();
  });
});
