import { describe, expect, it, vi } from "vitest";
import { findDuplicateFolder, textSimilarity, type FolderCandidate } from "../../server/duplicateFolder";

const folders: FolderCandidate[] = [
  { id: "folder_1", title: "Club Nite", date: "2026-07-07", time: "19:00", location: "Old GRA" },
  { id: "folder_2", title: "Revisiting School Party", date: "2026-08-29", location: "Port Harcourt Club" },
  { id: "folder_3", title: "Sports Day", date: "2026-08-29", time: "09:00", location: "Stadium" },
  { id: "evt_100", title: "Club Nite", date: "2026-09-01" }, // calendar announcement: never a folder
];

describe("textSimilarity", () => {
  it("treats spelling variants and filler words as the same title", () => {
    expect(textSimilarity("Club Nite", "club night")).toBe(1);
    expect(textSimilarity("The Annual Club Night", "Club Nite")).toBe(1);
  });

  it("scores a longer title that contains the shorter one as a near match, but not on a single shared word", () => {
    expect(textSimilarity("Revisiting School Party", "School Party")).toBe(0.9);
    expect(textSimilarity("Jersey Party", "Party")).toBeLessThan(0.6);
  });

  it("scores unrelated titles low", () => {
    expect(textSimilarity("Sports Day", "Revisiting School Party")).toBe(0);
  });
});

describe("findDuplicateFolder", () => {
  it("finds nothing when no folder exists for that day", async () => {
    const v = await findDuplicateFolder({ title: "Club Nite", date: "2026-07-08" }, folders);
    expect(v.duplicate).toBe(false);
    expect(v.method).toBe("none");
  });

  it("flags the same title on the same day without calling the AI", async () => {
    const askAi = vi.fn();
    const v = await findDuplicateFolder({ title: "club night", date: "2026-07-07" }, folders, askAi);
    expect(v.duplicate).toBe(true);
    expect(v.event?.id).toBe("folder_1");
    expect(v.method).toBe("rules");
    expect(askAi).not.toHaveBeenCalled();
  });

  it("ignores calendar announcements, only media folders count", async () => {
    const v = await findDuplicateFolder({ title: "Club Nite", date: "2026-09-01" }, folders);
    expect(v.duplicate).toBe(false);
  });

  it("matches dates written in different formats", async () => {
    const v = await findDuplicateFolder({ title: "Club Nite", date: "07/07/2026" }, folders);
    expect(v.duplicate).toBe(true);
  });

  it("can exclude the folder being edited", async () => {
    const v = await findDuplicateFolder({ title: "Club Nite", date: "2026-07-07" }, folders, undefined, "folder_1");
    expect(v.duplicate).toBe(false);
  });

  it("lets the AI recognise the same event under a different name", async () => {
    const askAi = vi.fn().mockResolvedValue({ matchId: "folder_2", confidence: 0.9, reason: "Same school party at the same club." });
    const v = await findDuplicateFolder({ title: "Back to school get-together", date: "2026-08-29", location: "Port Harcourt Club" }, folders, askAi);
    expect(v.duplicate).toBe(true);
    expect(v.event?.id).toBe("folder_2");
    expect(v.method).toBe("ai");
    expect(askAi).toHaveBeenCalledOnce();
    expect(askAi.mock.calls[0][0]).toContain("Sports Day");
  });

  it("trusts the AI when it says two same-day events differ", async () => {
    const askAi = vi.fn().mockResolvedValue({ matchId: "", confidence: 0.9, reason: "Morning sports vs evening party." });
    const v = await findDuplicateFolder({ title: "Evening Gala", date: "2026-08-29" }, folders, askAi);
    expect(v.duplicate).toBe(false);
    expect(v.method).toBe("ai");
  });

  it("does not block on a low-confidence or invalid AI match", async () => {
    const low = vi.fn().mockResolvedValue({ matchId: "folder_2", confidence: 0.4 });
    expect((await findDuplicateFolder({ title: "Evening Gala", date: "2026-08-29" }, folders, low)).duplicate).toBe(false);
    const bogus = vi.fn().mockResolvedValue({ matchId: "not_a_folder", confidence: 0.99 });
    expect((await findDuplicateFolder({ title: "Evening Gala", date: "2026-08-29" }, folders, bogus)).duplicate).toBe(false);
  });

  it("falls back to the rules when the AI fails", async () => {
    const boom = vi.fn().mockRejectedValue(new Error("AI down"));
    const events: FolderCandidate[] = [{ id: "folder_9", title: "Jersey Party Night", date: "2026-09-26", location: "Old GRA" }];
    const v = await findDuplicateFolder({ title: "Jersey Party Dinner", date: "2026-09-26", location: "Old GRA" }, events, boom);
    expect(v.duplicate).toBe(true);
    expect(v.method).toBe("rules");
    const unrelated = await findDuplicateFolder({ title: "Regatta", date: "2026-09-26" }, events, boom);
    expect(unrelated.duplicate).toBe(false);
  });
});
