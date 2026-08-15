import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../server/config", () => ({
  config: {
    googleApplicationCredentials: "/fake/service-account.json",
  },
}));

vi.mock("fluent-ffmpeg", () => {
  const mockFfmpeg = vi.fn().mockImplementation(() => ({
    output: vi.fn().mockReturnThis(),
    videoCodec: vi.fn().mockReturnThis(),
    size: vi.fn().mockReturnThis(),
    fps: vi.fn().mockReturnThis(),
    videoBitrate: vi.fn().mockReturnThis(),
    audioCodec: vi.fn().mockReturnThis(),
    audioBitrate: vi.fn().mockReturnThis(),
    format: vi.fn().mockReturnThis(),
    on: vi.fn().mockImplementation((_event: string, callback: () => void) => {
      return {
        on: vi.fn().mockReturnThis(),
        run: vi.fn().mockImplementation(() => callback()),
      };
    }),
    run: vi.fn(),
  }));
  (mockFfmpeg as any).setFfmpegPath = vi.fn();
  return { default: mockFfmpeg };
});

vi.mock("googleapis", () => ({
  google: {
    drive: () => ({
      files: {
        create: vi.fn().mockResolvedValue({
          data: { id: "drive_file_123", webViewLink: "https://drive.google.com/file/d/drive_file_123/view" },
        }),
      },
    }),
    youtube: () => ({
      videos: {
        insert: vi.fn().mockResolvedValue({
          data: { id: "yt_video_123" },
        }),
      },
    }),
    auth: {
      JWT: vi.fn().mockImplementation(function JWT() {
        return {
          getAccessToken: vi.fn().mockResolvedValue({ token: "fake-token" }),
        };
      }),
    },
  },
}));

vi.mock("firebase-admin", async () => {
  const actual = await vi.importActual("firebase-admin");
  return {
    ...actual,
    credential: {
      cert: vi.fn(),
    },
  };
});

import fs from "fs";
import path from "path";
import { compressVideoForDrive, uploadVideoToDrive, uploadVideoToYouTube, base64ToBuffer } from "../../server/mediaPipeline";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("mediaPipeline", () => {
  describe("base64ToBuffer", () => {
    it("converts data URL to buffer", async () => {
      const result = await base64ToBuffer("data:image/webp;base64,Zm9vYmFy");
      expect(result.toString()).toBe("foobar");
    });

    it("throws on invalid base64", async () => {
      await expect(base64ToBuffer("not-a-data-url")).rejects.toThrow("Invalid base64 data URL format");
    });
  });

  describe("compressVideoForDrive", () => {
    it("returns compressed video when ffmpeg succeeds", async () => {
      const mockBuffer = Buffer.from("fake video data");
      const mockOutputBuffer = Buffer.from("compressed video data");

      vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
      vi.spyOn(fs, "readFileSync").mockImplementation((path: any) => {
        if (typeof path === "string" && path.includes("tmp_compressed_")) {
          return mockOutputBuffer;
        }
        return mockBuffer;
      });
      vi.spyOn(fs, "existsSync").mockReturnValue(true);
      vi.spyOn(fs, "unlinkSync").mockImplementation(() => {});

      const result = await compressVideoForDrive(mockBuffer, "test.mp4");
      expect(result).not.toBeNull();
      expect(result?.buffer).toBeInstanceOf(Buffer);
      expect(result?.mimeType).toBe("video/mp4");
      expect(result?.fileName).toBe("test_compressed.mp4");
    });
  });

  describe("uploadVideoToDrive", () => {
    it("uploads video to Drive and returns URL", async () => {
      const mockServiceAccount = {
        client_email: "test@example.com",
        private_key: "fake-key",
      };
      vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify(mockServiceAccount) as any);
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      const item = {
        id: "media_1",
        eventId: "evt_1",
        type: "video" as const,
        base64Data: "data:video/mp4;base64,ZmFrZQ==",
        mimeType: "video/mp4",
        fileName: "test.mp4",
        status: "pending" as const,
        storageTarget: "drive" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const url = await uploadVideoToDrive(item);
      expect(url).toBe("https://drive.google.com/file/d/drive_file_123/view");
    });
  });

  describe("uploadVideoToYouTube", () => {
    it("uploads video to YouTube and returns watch URL", async () => {
      const mockServiceAccount = {
        client_email: "test@example.com",
        private_key: "fake-key",
      };
      vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify(mockServiceAccount) as any);
      vi.spyOn(fs, "existsSync").mockReturnValue(true);

      const item = {
        id: "media_1",
        eventId: "evt_1",
        type: "video" as const,
        base64Data: "data:video/mp4;base64,ZmFrZQ==",
        mimeType: "video/mp4",
        fileName: "test.mp4",
        status: "pending" as const,
        storageTarget: "youtube" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const url = await uploadVideoToYouTube(item);
      expect(url).toBe("https://www.youtube.com/watch?v=yt_video_123");
    });
  });
});
