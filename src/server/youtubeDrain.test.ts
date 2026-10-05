import { describe, expect, it } from "vitest";
import {
  buildDrainReportEmail,
  buildVideoUrlAttach,
  buildVideoUrlSwap,
  extractAllDriveFileIds,
  extractDriveFileId,
  findEventDriveLinks,
  isYouTubeBlockedError,
  matchEventForFolder,
  normalizeFolderTitle,
  planDriveVideos,
  type DrainResult,
  type DriveFileRow,
  type EventLite,
} from "../../server/youtubeDrain";

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const ID2 = "1ZyXwVuTsRqPoNmLkJiHgFeDcBa987654";
const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

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

describe("extractAllDriveFileIds", () => {
  it("finds every Drive id in a blob of text, once each", () => {
    const text = JSON.stringify({
      photoUrl: `https://lh3.googleusercontent.com/d/${ID}`,
      nested: { assetUrl: `https://drive.google.com/file/d/${ID2}/view`, again: `https://lh3.googleusercontent.com/d/${ID}` },
      other: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(extractAllDriveFileIds(text).sort()).toEqual([ID, ID2].sort());
  });

  it("returns nothing for text without Drive links", () => {
    expect(extractAllDriveFileIds("no links here")).toEqual([]);
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

describe("findEventDriveLinks", () => {
  it("finds Drive links in the video list, the single field and the image list, once each", () => {
    const a = `https://lh3.googleusercontent.com/d/${ID}`;
    const b = `https://lh3.googleusercontent.com/d/${ID2}#type=video`;
    const links = findEventDriveLinks({ youtubeVideoUrls: [a, YT], youtubeVideoUrl: a, driveImageUrls: [b] });
    expect(links.map((l) => l.fileId)).toEqual([ID, ID2]);
  });

  it("ignores YouTube, Firebase Storage and events with no links", () => {
    expect(findEventDriveLinks({ youtubeVideoUrls: [YT, "https://firebasestorage.googleapis.com/v0/b/x/o/a.mp4?alt=media"] })).toEqual([]);
    expect(findEventDriveLinks({})).toEqual([]);
    expect(findEventDriveLinks(null)).toEqual([]);
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

describe("buildVideoUrlAttach", () => {
  it("adds the link without duplicating it and fills an empty single field", () => {
    expect(buildVideoUrlAttach({ youtubeVideoUrls: ["x"], youtubeVideoUrl: "" }, YT)).toEqual({ youtubeVideoUrls: ["x", YT], youtubeVideoUrl: "x" });
    expect(buildVideoUrlAttach({ youtubeVideoUrls: [YT] }, YT)).toEqual({ youtubeVideoUrls: [YT], youtubeVideoUrl: YT });
    expect(buildVideoUrlAttach({}, YT)).toEqual({ youtubeVideoUrls: [YT], youtubeVideoUrl: YT });
  });
});

describe("folder -> event matching", () => {
  const events: EventLite[] = [
    { id: "e1", title: "The Confluence Jersey Party", date: "2026-09-26" },
    { id: "e2", title: "Revisiting School Party", date: "2026-08-29" },
    { id: "e3", title: "Club Nite", date: "2026-01-10" },
    { id: "e4", title: "Club Nite", date: "2026-03-14" },
  ];

  it("normalises the date prefix, case and spacing", () => {
    expect(normalizeFolderTitle("2026-09-26 - The  Confluence Jersey Party")).toBe("the confluence jersey party");
    expect(normalizeFolderTitle("Revisiting School Party")).toBe("revisiting school party");
  });

  it("matches dated and undated folder names to the same event", () => {
    expect(matchEventForFolder("2026-08-29 - Revisiting School Party", events).event?.id).toBe("e2");
    expect(matchEventForFolder("Revisiting School Party", events).event?.id).toBe("e2");
  });

  it("resolves two events with one title by the folder's date, otherwise calls it ambiguous", () => {
    expect(matchEventForFolder("2026-03-14 - Club Nite", events).event?.id).toBe("e4");
    expect(matchEventForFolder("Club Nite", events).ambiguous).toBe(true);
  });

  it("matches nothing for unknown titles and the Drive root", () => {
    expect(matchEventForFolder("Some Other Folder", events)).toEqual({});
    expect(matchEventForFolder("(root)", events)).toEqual({});
  });
});

describe("planDriveVideos", () => {
  const NOW = Date.parse("2026-10-05T12:00:00Z");
  const OLD = "2026-09-27T10:00:00Z";
  const GRACE = 12 * 60 * 60 * 1000;
  const events: EventLite[] = [
    { id: "e1", title: "The Confluence Jersey Party", date: "2026-09-26" },
    { id: "e2", title: "Revisiting School Party", date: "2026-08-29" },
  ];
  const file = (id: string, over: Partial<DriveFileRow> = {}): DriveFileRow => ({
    id, name: "602675.mp4", size: 5 * 1024 * 1024, md5: "aaa", createdTime: OLD, folder: "2026-09-26 - The Confluence Jersey Party", ...over,
  });
  const plan = (files: DriveFileRow[], extra: { links?: Map<string, { eventId: string; url: string }[]>; protectedIds?: Set<string> } = {}) =>
    planDriveVideos({ files, links: extra.links || new Map(), protectedIds: extra.protectedIds || new Set(), events, now: NOW, graceMs: GRACE });

  it("collapses byte-identical copies into one group and matches the folder to its event", () => {
    const groups = plan([file("f1"), file("f2"), file("f3")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].files).toHaveLength(3);
    expect(groups[0].action).toBe("move-orphan");
    expect(groups[0].eventId).toBe("e1");
  });

  it("keeps different videos that merely share a name apart", () => {
    const groups = plan([file("f1", { md5: "aaa" }), file("f2", { md5: "bbb" })]);
    expect(groups).toHaveLength(2);
  });

  it("never merges files whose checksum is unknown", () => {
    const groups = plan([file("f1", { md5: undefined }), file("f2", { md5: undefined })]);
    expect(groups).toHaveLength(2);
  });

  it("holds any group where one copy is referenced by an approval or the recycle bin", () => {
    const groups = plan([file("f1"), file("f2")], { protectedIds: new Set(["f2"]) });
    expect(groups[0].action).toBe("held");
  });

  it("treats a video an event already links to as linked, with all its links", () => {
    const links = new Map([["f1", [{ eventId: "e2", url: "https://lh3.googleusercontent.com/d/f1" }]]]);
    const groups = plan([file("f1"), file("f2")], { links });
    expect(groups[0].action).toBe("move-linked");
    expect(groups[0].eventId).toBe("e2");
    expect(groups[0].links).toHaveLength(1);
  });

  it("leaves very new unlinked files alone", () => {
    const groups = plan([file("f1", { createdTime: "2026-10-05T08:00:00Z" })]);
    expect(groups[0].action).toBe("too-new");
  });

  it("does not delay a file that is already linked, however new", () => {
    const links = new Map([["f1", [{ eventId: "e1", url: "u" }]]]);
    const groups = plan([file("f1", { createdTime: "2026-10-05T11:00:00Z" })], { links });
    expect(groups[0].action).toBe("move-linked");
  });

  it("reports unmatched folders and the Drive root instead of guessing", () => {
    expect(plan([file("f1", { folder: "Mystery Folder" })])[0].action).toBe("unmatched");
    expect(plan([file("f1", { folder: "(root)" })])[0].action).toBe("unmatched");
  });

  it("calls it ambiguous when identical copies sit in folders of two different events", () => {
    const groups = plan([file("f1"), file("f2", { folder: "Revisiting School Party" })]);
    expect(groups[0].action).toBe("ambiguous");
  });

  it("orders linked, then unlinked, then everything that needs attention", () => {
    const links = new Map([["f9", [{ eventId: "e1", url: "u" }]]]);
    const groups = plan(
      [
        file("f1", { md5: "m1", folder: "Mystery Folder" }),
        file("f2", { md5: "m2" }),
        file("f9", { md5: "m9", createdTime: "2026-09-29T00:00:00Z" }),
      ],
      { links }
    );
    expect(groups.map((g) => g.action)).toEqual(["move-linked", "move-orphan", "unmatched"]);
  });
});

describe("buildDrainReportEmail", () => {
  const result: DrainResult = {
    moved: 3, failed: 1, duplicatesRemoved: 40, driveFreedMB: 212, waiting: 6, held: 1, unmatched: 1, ambiguous: 0, tooNew: 0,
    blocked: true, blockedReason: "The user has exceeded the number of videos they may upload.", timeBudgetHit: false,
    movedVideos: [{ name: "a.mp4", event: "Club <Nite>", youtubeUrl: YT, copiesRemoved: 20 }],
    failures: [{ name: "b.mp4", reason: "boom" }],
    attention: [{ name: "c.mp4", copies: 2, folders: ["Mystery Folder"], issue: "No matching event." }],
  };

  it("summarises the session in the subject and body", () => {
    const { subject, html } = buildDrainReportEmail(result);
    expect(subject).toBe("YouTube transfer report: 3 moved to YouTube, 40 duplicates removed, 1 failed");
    expect(html).toContain("212 MB");
    expect(html).toContain("6</b> videos still waiting");
    expect(html).toContain("exceeded the number of videos");
    expect(html).toContain(YT);
    expect(html).toContain("Mystery Folder");
  });

  it("escapes event and file names", () => {
    expect(buildDrainReportEmail(result).html).toContain("Club &lt;Nite&gt;");
  });
});
