import { afterAll, beforeEach, describe, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

/**
 * Verifies firestore.rules directly against the Firestore emulator — the
 * only way to test the actual rules engine rather than a mental model of
 * it. Run with: firebase emulators:exec --only firestore "vitest run src/server/firestoreRules.test.ts"
 * (skipped automatically if no emulator is reachable, e.g. in plain `npm test`).
 *
 * The connection attempt happens at module load (top-level await) rather
 * than in beforeAll, so describe.skipIf below sees the real outcome —
 * beforeAll runs after the test tree is already collected, which is too
 * late to decide whether to skip.
 */

const ADMIN_EMAIL = "tarabateam@gmail.com";
const OTHER_ADMIN_EMAIL = "xtraworxng@gmail.com";
const NON_ADMIN_EMAIL = "someone@example.com";

let testEnv: RulesTestEnvironment | null = null;
try {
  testEnv = await initializeTestEnvironment({
    projectId: "team-taraba-rules-test",
    firestore: {
      rules: fs.readFileSync(path.resolve(process.cwd(), "firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
} catch (err) {
  console.warn(
    "Firestore emulator not reachable — skipping rules tests. Run via " +
      '`firebase emulators:exec --only firestore "vitest run src/server/firestoreRules.test.ts"`.',
    err
  );
}

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  if (testEnv) await testEnv.clearFirestore();
});

describe.skipIf(!testEnv)("firestore.rules", () => {
  describe("members", () => {
    it("denies an anonymous user from reading the members collection", async () => {
      const anon = testEnv!.unauthenticatedContext();
      await assertFails(anon.firestore().collection("members").doc("mem_1").get());
    });

    it("allows any signed-in user to read a member document", async () => {
      const member = testEnv!.authenticatedContext("mem_1", { email: NON_ADMIN_EMAIL });
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection("members").doc("mem_1").set({ fullName: "Test" });
      });
      await assertSucceeds(member.firestore().collection("members").doc("mem_1").get());
    });

    it("allows an anonymous visitor to create a brand-new member document (registration)", async () => {
      const anon = testEnv!.unauthenticatedContext();
      await assertSucceeds(
        anon.firestore().collection("members").doc("mem_new").set({ fullName: "New Registrant" })
      );
    });

    it("does not let an anonymous write overwrite an EXISTING member (routed to update, not create)", async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection("members").doc("mem_victim").set({ email: "victim@example.com" });
      });
      const anon = testEnv!.unauthenticatedContext();
      await assertFails(
        anon.firestore().collection("members").doc("mem_victim").set({ email: "attacker@example.com" })
      );
    });

    it("allows a member to update their own document", async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection("members").doc("mem_self").set({ fullName: "Self" });
      });
      const self = testEnv!.authenticatedContext("mem_self", { email: NON_ADMIN_EMAIL });
      await assertSucceeds(
        self.firestore().collection("members").doc("mem_self").set({ fullName: "Updated" })
      );
    });

    it("denies a member from updating someone else's document", async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection("members").doc("mem_other").set({ fullName: "Other" });
      });
      const attacker = testEnv!.authenticatedContext("mem_attacker", { email: NON_ADMIN_EMAIL });
      await assertFails(
        attacker.firestore().collection("members").doc("mem_other").update({ email: "hijacked@example.com" })
      );
    });

    it("allows an admin to update any member's document", async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection("members").doc("mem_other").set({ fullName: "Other" });
      });
      const admin = testEnv!.authenticatedContext("admin_uid", { email: ADMIN_EMAIL });
      await assertSucceeds(
        admin.firestore().collection("members").doc("mem_other").update({ activityPoints: 0 })
      );
    });

    it("allows the second confirmed admin email too", async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection("members").doc("mem_other").set({ fullName: "Other" });
      });
      const admin = testEnv!.authenticatedContext("admin_uid_2", { email: OTHER_ADMIN_EMAIL });
      await assertSucceeds(
        admin.firestore().collection("members").doc("mem_other").update({ activityPoints: 0 })
      );
    });

    it("denies kefox.nwoko@gmail.com — removed from the admin roster", async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection("members").doc("mem_other").set({ fullName: "Other" });
      });
      const notAdminAnymore = testEnv!.authenticatedContext("former_admin_uid", {
        email: "kefox.nwoko@gmail.com",
      });
      await assertFails(
        notAdminAnymore.firestore().collection("members").doc("mem_other").update({ activityPoints: 0 })
      );
    });

    it("denies a non-admin from deleting a member", async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection("members").doc("mem_x").set({ fullName: "X" });
      });
      const member = testEnv!.authenticatedContext("mem_x", { email: NON_ADMIN_EMAIL });
      await assertFails(member.firestore().collection("members").doc("mem_x").delete());
    });

    it("allows an admin to delete a member", async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection("members").doc("mem_x").set({ fullName: "X" });
      });
      const admin = testEnv!.authenticatedContext("admin_uid", { email: ADMIN_EMAIL });
      await assertSucceeds(admin.firestore().collection("members").doc("mem_x").delete());
    });
  });

  describe("events", () => {
    it("denies anonymous read", async () => {
      const anon = testEnv!.unauthenticatedContext();
      await assertFails(anon.firestore().collection("events").doc("evt_1").get());
    });

    it("allows any signed-in member to read events", async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection("events").doc("evt_1").set({ title: "Meetup" });
      });
      const member = testEnv!.authenticatedContext("mem_1", { email: NON_ADMIN_EMAIL });
      await assertSucceeds(member.firestore().collection("events").doc("evt_1").get());
    });

    it("denies a non-admin member from creating an event", async () => {
      const member = testEnv!.authenticatedContext("mem_1", { email: NON_ADMIN_EMAIL });
      await assertFails(member.firestore().collection("events").doc("evt_new").set({ title: "Hack" }));
    });

    it("allows an admin to create/update/delete an event", async () => {
      const admin = testEnv!.authenticatedContext("admin_uid", { email: ADMIN_EMAIL });
      await assertSucceeds(admin.firestore().collection("events").doc("evt_admin").set({ title: "Real" }));
      await assertSucceeds(
        admin.firestore().collection("events").doc("evt_admin").update({ title: "Updated" })
      );
      await assertSucceeds(admin.firestore().collection("events").doc("evt_admin").delete());
    });
  });

  describe("photoRequests", () => {
    it("allows any signed-in member to submit a photo request", async () => {
      const member = testEnv!.authenticatedContext("mem_1", { email: NON_ADMIN_EMAIL });
      await assertSucceeds(
        member.firestore().collection("photoRequests").doc("req_1").set({ status: "pending" })
      );
    });

    it("denies an anonymous visitor from submitting a photo request", async () => {
      const anon = testEnv!.unauthenticatedContext();
      await assertFails(
        anon.firestore().collection("photoRequests").doc("req_2").set({ status: "pending" })
      );
    });

    it("denies a non-admin member from approving (updating) a photo request", async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection("photoRequests").doc("req_3").set({ status: "pending" });
      });
      const member = testEnv!.authenticatedContext("mem_1", { email: NON_ADMIN_EMAIL });
      await assertFails(
        member.firestore().collection("photoRequests").doc("req_3").update({ status: "approved" })
      );
    });

    it("allows an admin to approve/delete a photo request", async () => {
      await testEnv!.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection("photoRequests").doc("req_4").set({ status: "pending" });
      });
      const admin = testEnv!.authenticatedContext("admin_uid", { email: ADMIN_EMAIL });
      await assertSucceeds(
        admin.firestore().collection("photoRequests").doc("req_4").update({ status: "approved" })
      );
      await assertSucceeds(admin.firestore().collection("photoRequests").doc("req_4").delete());
    });
  });

  describe("system", () => {
    it("denies a non-admin from reading or writing system/email_config", async () => {
      const member = testEnv!.authenticatedContext("mem_1", { email: NON_ADMIN_EMAIL });
      await assertFails(member.firestore().collection("system").doc("email_config").get());
      await assertFails(
        member.firestore().collection("system").doc("email_config").set({ resendApiKey: "stolen" })
      );
    });

    it("allows an admin to read/write system/email_config", async () => {
      const admin = testEnv!.authenticatedContext("admin_uid", { email: ADMIN_EMAIL });
      await assertSucceeds(
        admin.firestore().collection("system").doc("email_config").set({ resendApiKey: "real" })
      );
    });

    it("allows any signed-in member to write the visit-metrics document", async () => {
      const member = testEnv!.authenticatedContext("mem_1", { email: NON_ADMIN_EMAIL });
      await assertSucceeds(
        member.firestore().collection("system").doc("metrics").set({ totalVisits: 1 }, { merge: true })
      );
    });

    it("denies an anonymous visitor from writing the visit-metrics document", async () => {
      const anon = testEnv!.unauthenticatedContext();
      await assertFails(
        anon.firestore().collection("system").doc("metrics").set({ totalVisits: 999 })
      );
    });
  });

  describe("systemConfig", () => {
    it("denies a non-admin from writing a generic systemConfig document", async () => {
      const member = testEnv!.authenticatedContext("mem_1", { email: NON_ADMIN_EMAIL });
      await assertFails(
        member.firestore().collection("systemConfig").doc("cloud_pipeline").set({ dedicatedDriveUrl: "hijacked" })
      );
    });

    it("allows an admin to write a generic systemConfig document", async () => {
      const admin = testEnv!.authenticatedContext("admin_uid", { email: ADMIN_EMAIL });
      await assertSucceeds(
        admin.firestore().collection("systemConfig").doc("cloud_pipeline").set({ dedicatedDriveUrl: "real" })
      );
    });

    it("allows any signed-in member to write systemConfig/visit_metrics", async () => {
      const member = testEnv!.authenticatedContext("mem_1", { email: NON_ADMIN_EMAIL });
      await assertSucceeds(
        member.firestore().collection("systemConfig").doc("visit_metrics").set({ totalVisits: 1 }, { merge: true })
      );
    });

    it("denies an anonymous visitor from writing systemConfig/visit_metrics", async () => {
      const anon = testEnv!.unauthenticatedContext();
      await assertFails(
        anon.firestore().collection("systemConfig").doc("visit_metrics").set({ totalVisits: 999 })
      );
    });
  });

  describe("mediaItems", () => {
    it("denies write even from an admin (server-only collection)", async () => {
      const admin = testEnv!.authenticatedContext("admin_uid", { email: ADMIN_EMAIL });
      await assertFails(admin.firestore().collection("mediaItems").doc("m_1").set({ url: "x" }));
    });

    it("denies read from a non-admin", async () => {
      const member = testEnv!.authenticatedContext("mem_1", { email: NON_ADMIN_EMAIL });
      await assertFails(member.firestore().collection("mediaItems").doc("m_1").get());
    });
  });

  describe("loginCodes", () => {
    it("denies all client access, including admins (server-only via Admin SDK)", async () => {
      const admin = testEnv!.authenticatedContext("admin_uid", { email: ADMIN_EMAIL });
      await assertFails(admin.firestore().collection("loginCodes").doc("mem_1").get());
      await assertFails(admin.firestore().collection("loginCodes").doc("mem_1").set({ codeHash: "x" }));
    });
  });

  describe("default deny", () => {
    it("denies read/write to any collection not explicitly listed", async () => {
      const admin = testEnv!.authenticatedContext("admin_uid", { email: ADMIN_EMAIL });
      await assertFails(admin.firestore().collection("somethingUnlisted").doc("d1").get());
      await assertFails(admin.firestore().collection("somethingUnlisted").doc("d1").set({ x: 1 }));
    });
  });
});
