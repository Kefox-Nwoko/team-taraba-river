import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  increment,
  serverTimestamp,
  arrayUnion,
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
  DeletedMemberEntry,
} from "../types";
import { sanitizeMemberRecord } from "../utils/nameUtils"; /** * Google Admin Sign-In via OAuth popup. * * SECURITY: If the Google popup fails, we throw an error instead of * falling back to a hardcoded admin session. The backend determines * the actual role via Firebase Custom Claims. */
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
        const raw = d.data() as Member;
        const clean = sanitizeMemberRecord(raw);
        firestoreMembers.push(clean);

        // Self-heal records in Firestore if there were repeated title prefixes or placeholder 'Member' occupation
        if (
          raw.fullName !== clean.fullName ||
          raw.firstName !== clean.firstName ||
          raw.surname !== clean.surname ||
          raw.title !== clean.title ||
          raw.occupation !== clean.occupation
        ) {
          setDoc(doc(db, "members", clean.id), clean, { merge: true }).catch(() => {});
        }
      });
      return AppStateManager.filterDeleted(firestoreMembers);
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
          const raw = docSnap.data() as Member;
          list.push(sanitizeMemberRecord(raw));
        });
        const cleanList = AppStateManager.filterDeleted(list);
        if (cleanList.length > 0) {
          onUpdate(cleanList);
        }
      });
    } catch (err) {
      logger.warn("Firestore subscribeMembers fallback", { error: err });
      return () => {};
    }
  }
  public static async fetchEventsFromFirestore(): Promise<GroupEvent[]> {
    try {
      const colRef = collection(db, "events");
      const snapshot = await getDocs(colRef);
      const firestoreEvents: GroupEvent[] = [];
      snapshot.forEach((d) => {
        firestoreEvents.push(d.data() as GroupEvent);
      });
      return firestoreEvents;
    } catch (err) {
      logger.warn("Firestore events fetch fallback", { error: err });
      return [];
    }
  }

  public static subscribeEvents(onUpdate: (events: GroupEvent[]) => void) {
    try {
      const colRef = collection(db, "events");
      return onSnapshot(colRef, (snapshot) => {
        const list: GroupEvent[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as GroupEvent);
        });
        if (list.length > 0) {
          onUpdate(list);
        }
      });
    } catch (err) {
      logger.warn("Firestore subscribeEvents fallback", { error: err });
      return () => {};
    }
  }

  public static async saveMember(member: Member): Promise<void> {
    try {
      const clean = sanitizeMemberRecord(member);
      await setDoc(doc(db, "members", clean.id), clean);
    } catch (err) {
      logger.error("Failed to save member to Firestore", err);
    }
  }

  public static async deleteMember(memberId: string, memberEmail?: string, memberPhone?: string): Promise<void> {
    if (!memberId && !memberEmail && !memberPhone) return;

    // 1. Direct document deletion by document ID
    if (memberId) {
      try {
        await deleteDoc(doc(db, "members", memberId));
      } catch (err) {
        logger.warn(`Direct delete of members/${memberId} note:`, err);
      }
    }

    // 2. Query-based cleanup to guarantee documents with matching fields are removed
    try {
      const colRef = collection(db, "members");
      const idsToDelete = new Set<string>();

      if (memberId) {
        const qId = query(colRef, where("id", "==", memberId));
        const snapId = await getDocs(qId);
        snapId.forEach((d) => idsToDelete.add(d.id));
      }

      if (memberEmail && memberEmail.trim()) {
        const qEmail = query(colRef, where("email", "==", memberEmail.trim()));
        const snapEmail = await getDocs(qEmail);
        snapEmail.forEach((d) => idsToDelete.add(d.id));
      }

      if (memberPhone && memberPhone.trim()) {
        const qPhone = query(colRef, where("phoneNumber", "==", memberPhone.trim()));
        const snapPhone = await getDocs(qPhone);
        snapPhone.forEach((d) => idsToDelete.add(d.id));
      }

      for (const dId of idsToDelete) {
        try {
          await deleteDoc(doc(db, "members", dId));
        } catch {}
      }
    } catch (queryErr) {
      logger.warn("Query cleanup during member deletion warning:", queryErr);
    }
  }


  /**
   * Persistently marks a headline article as read in both LocalStorage and Firestore
   * so that across 20+ logins and different devices, read status is permanently retained.
   */
  public static async markNewsArticleAsRead(memberId: string, articleKey: string): Promise<string[]> {
    const cleanKey = (articleKey || "").trim();
    if (!cleanKey) return [];

    const storageKeys = [
      `usosa_news_read_v1_${memberId || "guest"}`,
      `usosa_news_read_v1_persisted`,
    ];

    let currentSet = new Set<string>();

    storageKeys.forEach((k) => {
      try {
        const saved = localStorage.getItem(k);
        if (saved) {
          const arr = JSON.parse(saved);
          if (Array.isArray(arr)) arr.forEach((item) => currentSet.add(item));
        }
      } catch {}
    });

    currentSet.add(cleanKey);
    const updatedArray = Array.from(currentSet);

    storageKeys.forEach((k) => {
      try {
        localStorage.setItem(k, JSON.stringify(updatedArray));
      } catch {}
    });

    // Cloud persistence in Firestore if member ID exists
    if (memberId && memberId !== "guest") {
      try {
        const memberDocRef = doc(db, "members", memberId);
        await setDoc(memberDocRef, { readNewsArticles: arrayUnion(cleanKey) }, { merge: true });
      } catch (err) {
        logger.warn("Failed to persist read news article to Firestore", err);
      }
    }

    return updatedArray;
  }

  /**
   * Fetches the complete, deduplicated set of read news articles across LocalStorage & Firestore.
   */
  public static async getMemberReadArticles(memberId: string): Promise<string[]> {
    const merged = new Set<string>();

    const storageKeys = [
      `usosa_news_read_v1_${memberId || "guest"}`,
      `usosa_news_read_v1_persisted`,
    ];

    storageKeys.forEach((k) => {
      try {
        const saved = localStorage.getItem(k);
        if (saved) {
          const arr = JSON.parse(saved);
          if (Array.isArray(arr)) arr.forEach((item) => merged.add(item));
        }
      } catch {}
    });

    if (memberId && memberId !== "guest") {
      try {
        const memberDocRef = doc(db, "members", memberId);
        const snap = await getDoc(memberDocRef);
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data?.readNewsArticles)) {
            data.readNewsArticles.forEach((item: string) => merged.add(item));
          }
        }
      } catch (err) {
        logger.warn("Failed to read news articles from Firestore", err);
      }
    }

    const result = Array.from(merged);
    try {
      localStorage.setItem(`usosa_news_read_v1_${memberId || "guest"}`, JSON.stringify(result));
      localStorage.setItem(`usosa_news_read_v1_persisted`, JSON.stringify(result));
    } catch {}

    return result;
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
      // 1. Delete main event document in Firestore
      await deleteDoc(doc(db, "events", id));

      // 2. Cascade delete any associated photo approvals for this event in Firestore
      const approvalsSnap = await getDocs(collection(db, "photoRequests"));
      for (const d of approvalsSnap.docs) {
        const data = d.data();
        if (data.eventId === id) {
          await deleteDoc(d.ref);
        }
      }
    } catch (err) {
      logger.error("Failed to delete event from Firestore", err);
    }
    try {
      const localEvents = AppStateManager.getEvents();
      const clean = localEvents.filter((e) => e.id !== id);
      AppStateManager.saveEvents(clean);

      const localApprovals = AppStateManager.getApprovals();
      const cleanApprovals = localApprovals.filter((a) => a.eventId !== id);
      AppStateManager.saveApprovals(cleanApprovals);
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
      AppStateManager.addApproval(approval);
    } catch (localErr) {
      logger.warn("LocalStorage save approval notice", localErr);
    }
    try {
      const cleanApproval: PhotoApprovalRequest = { ...approval };
      delete cleanApproval.previewDataUrl;
      await setDoc(doc(db, "photoRequests", approval.id), cleanApproval);
    } catch (err) {
      logger.error("Failed to save approval to Firestore", err);
    }
  }

  public static async deleteApproval(id: string): Promise<void> {
    try {
      AppStateManager.removeApproval(id);
    } catch {}
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

  /**
   * Resets all member activity points to 0 and clears activity logs in Firestore and LocalStorage.
   */
  public static async resetSystemDataDirectly(): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Reset all members in Firestore
      const membersSnap = await getDocs(collection(db, "members"));
      for (const d of membersSnap.docs) {
        await updateDoc(d.ref, { activityPoints: 0 });
      }

      // 2. Clear activity logs in Firestore
      const logsSnap = await getDocs(collection(db, "activityLogs"));
      for (const d of logsSnap.docs) {
        await deleteDoc(d.ref);
      }

      // 3. Reset local storage members & logs
      const localMembers = AppStateManager.getMembers();
      const resetLocalMembers = localMembers.map((m) => ({ ...m, activityPoints: 0 }));
      AppStateManager.saveMembers(resetLocalMembers);
      AppStateManager.saveActivityLogs([]);

      return {
        success: true,
        message: "System engagement points and logs successfully reset to 0.",
      };
    } catch (err: any) {
      logger.error("Direct Firestore reset error", err);
      // Fallback local reset
      const localMembers = AppStateManager.getMembers();
      const resetLocalMembers = localMembers.map((m) => ({ ...m, activityPoints: 0 }));
      AppStateManager.saveMembers(resetLocalMembers);
      AppStateManager.saveActivityLogs([]);
      return {
        success: true,
        message: "System engagement points reset locally.",
      };
    }
  }

  /**
   * Resets the home page portal visit metrics in Firestore and clears local session cache.
   */
  public static async resetPortalVisits(): Promise<{ success: boolean; message: string }> {
    try {
      await setDoc(
        doc(db, "system", "metrics"),
        {
          totalVisits: 0,
          lastVisitAt: serverTimestamp(),
          lastRecordedSession: Date.now(),
          latestUniqueUser: "Community Member",
        },
        { merge: true }
      );

      try {
        await setDoc(
          doc(db, "systemConfig", "visit_metrics"),
          {
            totalVisits: 0,
            lastVisitTimestamp: new Date().toISOString(),
            latestUniqueUser: "Community Member",
          },
          { merge: true }
        );
      } catch {}

      sessionStorage.removeItem("taraba_active_session_ts");
      localStorage.removeItem("taraba_user_session_visits_v1");

      return {
        success: true,
        message: "Portal visits count has been successfully reset to 0.",
      };
    } catch (err: any) {
      logger.error("Failed to reset portal visits in Firestore", err);
      sessionStorage.removeItem("taraba_active_session_ts");
      return {
        success: true,
        message: "Portal visits reset locally.",
      };
    }
  }

  /**
   * Records a realistic, deduplicated session visit in Firestore.
   * Debounced per browser session with an industry-standard 30-minute inactivity window.
   */
  public static async recordSessionVisit(): Promise<number> {
    try {
      const SESSION_KEY = "taraba_active_session_ts";
      const lastRecorded = sessionStorage.getItem(SESSION_KEY);
      const now = Date.now();
      const THIRTY_MINUTES_MS = 30 * 60 * 1000;

      // If user already registered a visit within this session in the last 30 minutes, skip incrementing
      if (lastRecorded && now - parseInt(lastRecorded, 10) < THIRTY_MINUTES_MS) {
        const snap = await getDoc(doc(db, "system", "metrics"));
        if (snap.exists()) {
          return snap.data().totalVisits || 1;
        }
        return 1;
      }

      sessionStorage.setItem(SESSION_KEY, now.toString());

      // Atomically increment the genuine visits counter in Firestore
      await setDoc(
        doc(db, "system", "metrics"),
        {
          totalVisits: increment(1),
          lastVisitAt: serverTimestamp(),
          lastRecordedSession: now,
        },
        { merge: true }
      );

      const updatedSnap = await getDoc(doc(db, "system", "metrics"));
      if (updatedSnap.exists()) {
        return updatedSnap.data().totalVisits || 1;
      }
      return 1;
    } catch (err) {
      logger.warn("Firestore recordSessionVisit fallback", err);
      return AppStateManager.getSessionCount() || 1;
    }
  }

  /**
   * Queues an email directly to the Firestore 'mail' collection (Firebase Trigger Email extension compatible)
   */
  public static async queueEmail(params: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    try {
      const mailDocRef = doc(collection(db, "mail"));
      await setDoc(mailDocRef, {
        to: [params.to],
        message: {
          subject: params.subject,
          html: params.html,
          text: params.text || "",
        },
        queuedAt: serverTimestamp(),
        status: "PENDING",
      });
      // Also log to notification_logs
      const logRef = doc(collection(db, "notification_logs"));
      await setDoc(logRef, {
        type: "birthday_email",
        recipient: params.to,
        subject: params.subject,
        timestamp: new Date().toISOString(),
        status: "queued",
      });
    } catch (err) {
      logger.warn("Firestore queueEmail fallback", err);
    }
  }

  /**
   * Saves email reminder settings in Firestore under system/email_config
   */
  public static async saveEmailConfig(config: {
    recipientEmail: string;
    resendApiKey?: string;
    enabled?: boolean;
  }): Promise<void> {
    try {
      await setDoc(
        doc(db, "system", "email_config"),
        {
          recipientEmail: config.recipientEmail,
          resendApiKey: config.resendApiKey || "",
          enabled: config.enabled ?? true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      logger.warn("Firestore saveEmailConfig fallback", err);
    }
  }

  /**
   * Subscribes to real-time synchronized visits metric across all clients
   */
  public static subscribeVisitMetrics(onUpdate: (totalVisits: number) => void) {
    try {
      return onSnapshot(doc(db, "system", "metrics"), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (typeof data.totalVisits === "number") {
            onUpdate(data.totalVisits);
          }
        }
      });
    } catch (err) {
      logger.warn("Firestore subscribeVisitMetrics fallback", err);
      return () => {};
    }
  }

  /**
   * Stores a deleted member entry into the Firestore recycle_bin / deleted_members collection.
   */
  public static async addToRecycleBin(entry: DeletedMemberEntry): Promise<void> {
    try {
      await setDoc(doc(db, "deleted_members", entry.originalId), {
        ...entry,
        storedAt: serverTimestamp(),
      });
    } catch (err) {
      logger.warn("Firestore addToRecycleBin fallback", err);
    }
  }

  /**
   * Retrieves all deleted member entries from Firestore recycle bin.
   */
  public static async getRecycleBin(): Promise<DeletedMemberEntry[]> {
    try {
      const snap = await getDocs(collection(db, "deleted_members"));
      if (!snap.empty) {
        return snap.docs.map((d) => {
          const data = d.data();
          return {
            originalId: data.originalId || d.id,
            member: data.member,
            deletedAt: data.deletedAt || new Date().toISOString(),
            deletedBy: data.deletedBy || "Admin",
            originalLocation: data.originalLocation || "Member Directory",
          } as DeletedMemberEntry;
        });
      }
    } catch (err) {
      logger.warn("Firestore getRecycleBin fallback", err);
    }
    return AppStateManager.getRecycleBin();
  }

  /**
   * Restores a member from the recycle bin back to the active members collection.
   */
  public static async restoreMemberFromRecycleBin(originalId: string): Promise<Member | null> {
    try {
      // 1. Get from Firestore deleted_members
      const docRef = doc(db, "deleted_members", originalId);
      const snap = await getDoc(docRef);
      let memberToRestore: Member | null = null;

      if (snap.exists()) {
        const data = snap.data() as DeletedMemberEntry;
        memberToRestore = data.member;
      } else {
        const localEntry = AppStateManager.getRecycleBin().find((e) => e.originalId === originalId);
        if (localEntry) memberToRestore = localEntry.member;
      }

      if (!memberToRestore) return null;

      // 2. Save back to active Firestore members
      await this.saveMember(memberToRestore);

      // 3. Remove from Firestore deleted_members
      try {
        await deleteDoc(docRef);
      } catch {}

      // 4. Update local state
      AppStateManager.restoreMember(originalId);

      return memberToRestore;
    } catch (err) {
      logger.error("Failed to restore member from recycle bin", err);
      return AppStateManager.restoreMember(originalId);
    }
  }

  /**
   * Permanently purges a single member from the recycle bin (cannot be recovered).
   */
  public static async purgeMemberFromRecycleBin(originalId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "deleted_members", originalId));
    } catch (err) {
      logger.warn("Firestore purgeMemberFromRecycleBin fallback", err);
    }
    AppStateManager.removeFromRecycleBin(originalId);
  }

  /**
   * Empties the entire recycle bin permanently.
   */
  public static async emptyRecycleBin(): Promise<void> {
    try {
      const snap = await getDocs(collection(db, "deleted_members"));
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
    } catch (err) {
      logger.warn("Firestore emptyRecycleBin fallback", err);
    }
    AppStateManager.clearRecycleBin();
  }

  /**
   * Subscribes to real-time changes in the recycle bin.
   */
  public static subscribeRecycleBin(onUpdate: (entries: DeletedMemberEntry[]) => void): () => void {
    try {
      return onSnapshot(collection(db, "deleted_members"), (snap) => {
        const list: DeletedMemberEntry[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            originalId: data.originalId || d.id,
            member: data.member,
            deletedAt: data.deletedAt || new Date().toISOString(),
            deletedBy: data.deletedBy || "Admin",
            originalLocation: data.originalLocation || "Member Directory",
          } as DeletedMemberEntry;
        });

        // Merge with local recycle bin if any
        const local = AppStateManager.getRecycleBin();
        const map = new Map<string, DeletedMemberEntry>();
        local.forEach((e) => map.set(e.originalId, e));
        list.forEach((e) => map.set(e.originalId, e));

        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
        );
        onUpdate(merged);
      });
    } catch (err) {
      logger.warn("Firestore subscribeRecycleBin fallback", err);
      return () => {};
    }
  }
}

export const FirebaseService = FirebaseSyncManager;
