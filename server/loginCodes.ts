import crypto from "crypto";
import { db, isFirestoreAvailable } from "./firebaseAdmin";

/**
 * Short-lived sign-in codes for the non-Google login path (/api/auth/login).
 * Single-use, expiring, attempt-limited — stored in Firestore when available,
 * falling back to an in-memory map for local dev without Firestore Admin.
 */

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const COLLECTION = "loginCodes";

interface StoredCode {
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

const inMemoryCodes = new Map<string, StoredCode>();

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function createLoginCode(memberId: string): Promise<string> {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const entry: StoredCode = {
    codeHash: hashCode(code),
    expiresAt: Date.now() + CODE_TTL_MS,
    attempts: 0,
  };

  if (isFirestoreAvailable() && db) {
    await db.collection(COLLECTION).doc(memberId).set(entry);
  } else {
    inMemoryCodes.set(memberId, entry);
  }

  return code;
}

export async function verifyLoginCode(
  memberId: string,
  submittedCode: string
): Promise<{ ok: boolean; reason?: string }> {
  const useFirestore = isFirestoreAvailable() && !!db;
  const ref = useFirestore ? db!.collection(COLLECTION).doc(memberId) : null;

  let entry: StoredCode | undefined;
  if (ref) {
    const snap = await ref.get();
    entry = snap.exists ? (snap.data() as StoredCode) : undefined;
  } else {
    entry = inMemoryCodes.get(memberId);
  }

  const clear = async () => {
    if (ref) await ref.delete();
    else inMemoryCodes.delete(memberId);
  };

  if (!entry) {
    return { ok: false, reason: "No active code for this account. Request a new one." };
  }

  if (Date.now() > entry.expiresAt) {
    await clear();
    return { ok: false, reason: "This code has expired. Request a new one." };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    await clear();
    return { ok: false, reason: "Too many incorrect attempts. Request a new one." };
  }

  if (hashCode(submittedCode.trim()) !== entry.codeHash) {
    entry.attempts += 1;
    if (ref) await ref.update({ attempts: entry.attempts });
    else inMemoryCodes.set(memberId, entry);
    return { ok: false, reason: "Incorrect code." };
  }

  await clear();
  return { ok: true };
}
