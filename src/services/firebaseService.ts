import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import {
  signInWithPopup,
  signInWithCustomToken as firebaseSignInWithCustomToken,
} from "firebase/auth";
import { db, auth, googleProvider } from "../lib/firebase";
import { AppStateManager } from "./storage";
import { logger } from "../lib/logger";
import {
  Member,
  GroupEvent,
  PhotoApprovalRequest,
  ActivityLog,
} from "../types"; /** * Google Admin Sign-In via OAuth popup. * * SECURITY: If the Google popup fails, we throw an error instead of * falling back to a hardcoded admin session. The backend determines * the actual role via Firebase Custom Claims. */
export async function triggerGoogleAdminSignIn(): Promise<Member> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const googleEmail = result.user.email || "";
    const googleName = result.user.displayName || googleEmail.split("@")[0] || "Admin";
    const googlePhoto = result.user.photoURL || "";

    const adminMember: Member = {
      id: result.user.uid,
      title: "",
      firstName: googleName.split(" ")[0] || "Admin",
      surname: googleName.split(" ").slice(1).join(" ") || "",
      fullName: googleName,
      email: googleEmail,
      phoneNumber: "",
      whatsappNumber: "",
      dateOfBirth: "",
      maritalStatus: "",
      schoolName: "",
      gradYear: "",
      jerseySize: "",
      nextOfKinName: "",
      nextOfKinPhone: "",
      closestNeighborName: "",
      closestNeighborPhone: "",
      occupation: "",
      skills: [],
      photoUrl: googlePhoto,
      photoStatus: "approved",
      role: "admin",
      isGoogleAuth: true,
      activityPoints: 0,
      joinedAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    };

    return adminMember;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("popup-blocked") || message.includes("auth/popup-blocked")) {
      throw new Error("Google sign-in popup was blocked. Please allow popups and try again.");
    }

    if (
      message.includes("unauthorized-domain") ||
      message.includes("auth/unauthorized-domain") ||
      message.includes("redirect_uri_mismatch") ||
      message.includes("auth/configuration-not-found")
    ) {
      throw new Error(
        "Google sign-in is not authorized for this domain. Use the local dev localhost domain or configure the Firebase auth domain correctly.",
      );
    }

    throw new Error(`Google authentication failed: ${message}`);
  }
}

export async function signInWithCustomToken(customToken: string): Promise<void> {
  await firebaseSignInWithCustomToken(auth, customToken);
}

export async function getCurrentIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

// Converts Month Name & Day to YYYY-MM-DD
function parseBirthdayToISO(
  yearStr: string | number,
  monthName: string,
  dayNum: string | number
): string {
  const monthMap: Record<string, string> = {
    January: "01",
    February: "02",
    March: "03",
    April: "04",
    May: "05",
    June: "06",
    July: "07",
    August: "08",
    September: "09",
    October: "10",
    November: "11",
    December: "12",
  };
  const m = monthMap[monthName] || "01";
  const d = String(dayNum || 1).padStart(2, "0");
  const y = String(yearStr || "1990").trim();
  return `${y}-${m}-${d}`;
}
export class FirebaseSyncManager {
  private static isInitialized = false;
  public static async seedCSVDataIfNeeded(): Promise<Member[]> {
    try {
      const colRef = collection(db, "members");
      const snapshot = await getDocs(colRef);
      const firestoreMembers: Member[] = [];
      snapshot.forEach((d) => {
        firestoreMembers.push(d.data() as Member);
      });
      return firestoreMembers;
    } catch (err) {
      logger.warn("Firestore data fetch fallback", { error: err });
      return [];
    }
  }
  public static subscribeMembers(onUpdate: (members: Member[]) => void) {
    try {
      const colRef = collection(db, "members");
      return onSnapshot(colRef, (snapshot) => {
        const list: Member[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as Member);
        });
        if (list.length > 0) {
          onUpdate(list);
        }
      });
    } catch (err) {
      logger.warn("Firestore subscribeMembers fallback", { error: err });
      return () => {};
    }
  }
  public static async saveMember(member: Member): Promise<void> {
    try {
      await setDoc(doc(db, "members", member.id), member);
    } catch (err) {
      logger.error("Failed to save member to Firestore", err);
    }
  }
  public static async saveEvent(event: GroupEvent): Promise<void> {
    try {
      await setDoc(doc(db, "events", event.id), event);
    } catch (err) {
      logger.error("Failed to save event to Firestore", err);
    }
    try {
      const localEvents = AppStateManager.getEvents();
      const idx = localEvents.findIndex((e) => e.id === event.id);
      if (idx >= 0) {
        localEvents[idx] = event;
      } else {
        localEvents.unshift(event);
      }
      AppStateManager.saveEvents(localEvents);
    } catch (e) {
        logger.warn("AppStateManager fallback update error", e);
    }
  }

  public static async deleteEvent(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "events", id));
    } catch (err) {
      logger.error("Failed to delete event from Firestore", err);
    }
    try {
      const localEvents = AppStateManager.getEvents();
      const clean = localEvents.filter((e) => e.id !== id);
      AppStateManager.saveEvents(clean);
    } catch (e) {
        logger.warn("AppStateManager delete error", e);
    }
  }
  public static subscribeApprovals(onUpdate: (approvals: PhotoApprovalRequest[]) => void) {
    try {
      const colRef = collection(db, "photoRequests");
      return onSnapshot(colRef, (snapshot) => {
        const list: PhotoApprovalRequest[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as PhotoApprovalRequest);
        });
        onUpdate(list);
      });
    } catch (err) {
      logger.warn("Firestore subscribeApprovals fallback", { error: err });
      return () => {};
    }
  }

  public static async saveApproval(approval: PhotoApprovalRequest): Promise<void> {
    try {
      // Lightweight clean copy: Ensure no base64 dataUrl is sent into Firestore
      const cleanApproval: PhotoApprovalRequest = { ...approval };
      delete cleanApproval.previewDataUrl;
      await setDoc(doc(db, "photoRequests", approval.id), cleanApproval);
    } catch (err) {
      logger.error("Failed to save approval to Firestore", err);
    }
  }

  public static async deleteApproval(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "photoRequests", id));
    } catch (err) {
      logger.error("Failed to delete approval from Firestore", err);
    }
  }
  public static async addActivityLog(log: ActivityLog): Promise<void> {
    try {
      await setDoc(doc(db, "activityLogs", log.id), log);
    } catch (err) {
      logger.error("Failed to save activity log to Firestore", err);
    }
  }
}
