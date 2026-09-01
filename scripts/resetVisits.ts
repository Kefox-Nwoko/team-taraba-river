import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as path from "path";
import * as fs from "fs";

async function resetVisits() {
  const serviceAccountPath = path.resolve(process.cwd(), "service-account.json");
  if (!fs.existsSync(serviceAccountPath)) {
    console.error("service-account.json not found!");
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

  const app = getApps().length === 0
    ? initializeApp({
        credential: cert(serviceAccount),
        projectId: "team-taraba-river",
      })
    : getApps()[0];

  const db = getFirestore(app, "team-taraba-database");

  console.log("Resetting system/metrics in Firestore to 0...");
  await db.collection("system").doc("metrics").set(
    {
      totalVisits: 0,
      lastVisitAt: FieldValue.serverTimestamp(),
      lastRecordedSession: Date.now(),
      latestUniqueUser: "Community Member",
    },
    { merge: true }
  );

  console.log("Resetting systemConfig/visit_metrics in Firestore to 0...");
  await db.collection("systemConfig").doc("visit_metrics").set(
    {
      totalVisits: 0,
      lastVisitTimestamp: new Date().toISOString(),
      latestUniqueUser: "Community Member",
    },
    { merge: true }
  );

  console.log("✅ Successfully reset all portal visit counters in Firestore to 0!");
  process.exit(0);
}

resetVisits().catch((err) => {
  console.error("Error resetting visits:", err);
  process.exit(1);
});
