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
  signInWithRedirect,
  getRedirectResult,
  signInWithCustomToken as firebaseSignInWithCustomToken,
  User,
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
import { sanitizeMemberRecord } from "../utils/nameUtils";
import { sanitizeEventRecord, parseEventDateObj } from "../utils/eventUtils";

export function mapFirebaseUserToMember(user: User): Member {
  const googleEmail = user.email || "";
  const googleName = user.displayName || googleEmail.split("@")[0] || "Admin";
  const googlePhoto = user.photoURL || "";

  return {
    id: user.uid,
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
    // Never grant admin here — this is a locally-built session before the
    // server has verified anything. The real role is fetched from
    // /api/auth/verify (the single source of truth for ADMIN_EMAILS)
    // immediately after sign-in; see LoginGate.processGoogleUser.
    role: "member",
    isGoogleAuth: true,
    activityPoints: 0,
    joinedAt: new Date().toISOString(),
    lastActive: new Date().toISOString(),
  };
}

export async function checkGoogleRedirectResult(): Promise<Member | null> {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      return mapFirebaseUserToMember(result.user);
    }
    return null;
  } catch (error: any) {
    logger.warn("checkGoogleRedirectResult notification:", error);
    return null;
  }
}

export async function triggerGoogleAdminSignIn(forceRedirect = false): Promise<Member> {
  if (forceRedirect) {
    await signInWithRedirect(auth, googleProvider);
    return new Promise(() => {});
  }

  try {
    const result = await signInWithPopup(auth, googleProvider);
    return mapFirebaseUserToMember(result.user);
  } catch (error: any) {
    const code = error?.code || "";
    const rawMessage = error instanceof Error ? error.message : String(error);

    // If popup was blocked by browser, attempt seamless redirect fallback
    if (code === "auth/popup-blocked" || rawMessage.includes("popup-blocked")) {
      try {
        await signInWithRedirect(auth, googleProvider);
        return new Promise(() => {});
      } catch {
        throw new Error("Google sign-in popup was blocked by your browser. Please allow popups or try again.");
      }
    }

    // If popup was closed or cancelled by the user
    if (
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request" ||
      rawMessage.includes("popup-closed-by-user") ||
      rawMessage.includes("cancelled-popup-request")
    ) {
      const cancelErr = new Error("Google sign-in was closed before completing. Click Google to try again or sign in with your email/phone.");
      (cancelErr as any).isCancellation = true;
      throw cancelErr;
    }

    if (
      code === "auth/unauthorized-domain" ||
      rawMessage.includes("unauthorized-domain") ||
      rawMessage.includes("auth/unauthorized-domain") ||
      rawMessage.includes("redirect_uri_mismatch") ||
      rawMessage.includes("auth/configuration-not-found")
    ) {
      throw new Error(
        "Google sign-in is not authorized for this domain. Please ensure this domain is added to authorized domains in Firebase Console.",
      );
    }

    // Clean up any ugly "Firebase: Error (...)" raw string wrapper
    const cleanMsg = rawMessage.replace(/^Firebase:\s*Error\s*\((.*?)\)\.?/i, "$1").trim();
    throw new Error(`Google authentication failed: ${cleanMsg || rawMessage}`);
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
        const raw = { id: d.id, ...d.data() } as GroupEvent;
        firestoreEvents.push(sanitizeEventRecord(raw));
      });

      return firestoreEvents.filter((e) => !e.id.startsWith("evt_arch_") && !e.id.startsWith("folder_"));
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
          const raw = { id: docSnap.id, ...docSnap.data() } as GroupEvent;
          list.push(sanitizeEventRecord(raw));
        });
        const clean = list.filter((e) => !e.id.startsWith("evt_arch_") && !e.id.startsWith("folder_"));
        onUpdate(clean);
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

  /**
   * Atomically attaches one approved photo/video to an event's media
   * folder, creating the event if it doesn't exist yet. Uses arrayUnion +
   * merge instead of a local read-modify-write, so approving many items
   * from the same upload batch in quick succession (each a separate,
   * unserialized click) can never overwrite each other's contributions —
   * a plain saveEvent() read-then-setDoc is not safe under concurrent
   * writes to the same document.
   */
  public static async attachApprovedMedia(params: {
    eventId: string;
    photoUrl?: string;
    videoUrl?: string;
    createFields: Partial<GroupEvent>;
  }): Promise<void> {
    const update: Record<string, any> = { ...params.createFields, id: params.eventId };
    if (params.photoUrl) {
      update.driveImageUrls = arrayUnion(params.photoUrl);
    }
    if (params.videoUrl) {
      update.youtubeVideoUrls = arrayUnion(params.videoUrl);
      update.youtubeVideoUrl = params.videoUrl;
    }
    await setDoc(doc(db, "events", params.eventId), update, { merge: true });
  }

  /**
   * Atomically increments a member's activity points. Safer than a local
   * read-modify-write when several approvals for the same member can be
   * processed in quick succession (see attachApprovedMedia above).
   */
  public static async incrementMemberActivityPoints(memberId: string, amount: number): Promise<void> {
    try {
      await updateDoc(doc(db, "members", memberId), { activityPoints: increment(amount) });
    } catch (err) {
      logger.error("Failed to increment member activity points", err);
    }
  }

  public static async deleteMember(
    memberId: string,
    memberEmail?: string,
    memberPhone?: string,
    memberObj?: Member
  ): Promise<void> {
    if (!memberId && !memberEmail && !memberPhone) return;

    const deletedAt = new Date().toISOString();
    const softDeleteData = {
      isDeleted: true,
      deletedAt,
      deletedBy: "Admin",
    };

    // 1. Soft-delete primary document by document ID in "members" collection
    if (memberId) {
      try {
        await setDoc(doc(db, "members", memberId), softDeleteData, { merge: true });
      } catch (err) {
        logger.warn(`Soft delete of members/${memberId} note:`, err);
      }
    }

    // 2. Query-based cleanup to guarantee documents with matching fields are marked soft-deleted
    try {
      const colRef = collection(db, "members");
      const idsToMark = new Set<string>();

      if (memberId) {
        const qId = query(colRef, where("id", "==", memberId));
        const snapId = await getDocs(qId);
        snapId.forEach((d) => idsToMark.add(d.id));
      }

      if (memberEmail && memberEmail.trim()) {
        const qEmail = query(colRef, where("email", "==", memberEmail.trim()));
        const snapEmail = await getDocs(qEmail);
        snapEmail.forEach((d) => idsToMark.add(d.id));
      }

      if (memberPhone && memberPhone.trim()) {
        const qPhone = query(colRef, where("phoneNumber", "==", memberPhone.trim()));
        const snapPhone = await getDocs(qPhone);
        snapPhone.forEach((d) => idsToMark.add(d.id));
      }

      for (const dId of idsToMark) {
        try {
          await setDoc(doc(db, "members", dId), softDeleteData, { merge: true });
        } catch {}
      }
    } catch (queryErr) {
      logger.warn("Query cleanup during member soft-delete warning:", queryErr);
    }

    // 3. Stage in local storage and legacy recycle bin collection
    AppStateManager.deleteMember(memberId, memberEmail, memberPhone, memberObj);
    if (memberObj) {
      this.addToRecycleBin({
        originalId: memberId,
        member: { ...memberObj, isDeleted: true, deletedAt, deletedBy: "Admin" },
        deletedAt,
        deletedBy: "Admin",
        originalLocation: "Member Directory",
      }).catch(() => {});
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
    const clean = sanitizeEventRecord(event);
    try {
      await setDoc(doc(db, "events", clean.id), clean);
    } catch (err) {
      logger.error("Failed to save event to Firestore", err);
    }
    try {
      const localEvents = AppStateManager.getEvents();
      const idx = localEvents.findIndex((e) => e.id === clean.id);
      if (idx >= 0) {
        localEvents[idx] = clean;
      } else {
        localEvents.unshift(clean);
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
   * Reads soft-deleted members directly from the "members" collection (isDeleted == true),
   * plus legacy staged entries from "deleted_members" collection and local cache.
   */
  public static async getRecycleBin(): Promise<DeletedMemberEntry[]> {
    const entriesMap = new Map<string, DeletedMemberEntry>();

    // 1. Query soft-deleted members from primary "members" collection
    try {
      const snap = await getDocs(query(collection(db, "members"), where("isDeleted", "==", true)));
      snap.forEach((d) => {
        const data = d.data() as Member;
        const clean = sanitizeMemberRecord(data);
        const origId = clean.id || d.id;
        entriesMap.set(origId, {
          originalId: origId,
          member: clean,
          deletedAt: clean.deletedAt || new Date().toISOString(),
          deletedBy: clean.deletedBy || "Admin",
          originalLocation: "Member Directory",
        });
      });
    } catch (err) {
      logger.warn("Firestore getRecycleBin members query note", err);
    }

    // 2. Query legacy "deleted_members" collection for backward compatibility
    try {
      const legacySnap = await getDocs(collection(db, "deleted_members"));
      legacySnap.forEach((d) => {
        const data = d.data();
        const origId = data.originalId || d.id;
        if (!entriesMap.has(origId) && data.member) {
          entriesMap.set(origId, {
            originalId: origId,
            member: sanitizeMemberRecord(data.member),
            deletedAt: data.deletedAt || new Date().toISOString(),
            deletedBy: data.deletedBy || "Admin",
            originalLocation: data.originalLocation || "Member Directory",
          });
        }
      });
    } catch (err) {
      logger.warn("Firestore getRecycleBin legacy fallback", err);
    }

    // 3. Merge with local storage recycle bin
    const local = AppStateManager.getRecycleBin();
    local.forEach((e) => {
      if (!entriesMap.has(e.originalId)) {
        entriesMap.set(e.originalId, e);
      }
    });

    return Array.from(entriesMap.values()).sort(
      (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
    );
  }

  /**
   * Restores a member from the recycle bin back to the active members collection.
   * Flips isDeleted to false directly on the primary record.
   */
  public static async restoreMemberFromRecycleBin(originalId: string, memberObj?: Member): Promise<Member | null> {
    try {
      let memberToRestore: Member | null = memberObj || null;

      const restoreData = {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
      };

      // 1. If not provided, fetch from members or legacy deleted_members collection
      if (!memberToRestore) {
        try {
          const mSnap = await getDoc(doc(db, "members", originalId));
          if (mSnap.exists()) {
            memberToRestore = sanitizeMemberRecord(mSnap.data() as Member);
          }
        } catch {}
      }
      if (!memberToRestore) {
        try {
          const dSnap = await getDoc(doc(db, "deleted_members", originalId));
          if (dSnap.exists()) {
            const data = dSnap.data() as DeletedMemberEntry;
            memberToRestore = data.member ? sanitizeMemberRecord(data.member) : null;
          }
        } catch {}
      }

      // 2. Fallback to local storage
      if (!memberToRestore) {
        const local = AppStateManager.getRecycleBin().find((e) => e.originalId === originalId || e.member.id === originalId);
        if (local) memberToRestore = local.member;
      }

      if (memberToRestore) {
        memberToRestore = {
          ...memberToRestore,
          isDeleted: false,
          deletedAt: undefined,
          deletedBy: undefined,
        };
      }

      // 3. Update primary document in Firestore "members"
      if (originalId) {
        try {
          await setDoc(doc(db, "members", originalId), restoreData, { merge: true });
        } catch {}
      }
      if (memberToRestore?.id && memberToRestore.id !== originalId) {
        try {
          await setDoc(doc(db, "members", memberToRestore.id), restoreData, { merge: true });
        } catch {}
      }

      // 4. Update any matching documents found by ID query
      try {
        const qId = query(collection(db, "members"), where("id", "==", originalId));
        const snap = await getDocs(qId);
        for (const d of snap.docs) {
          await setDoc(d.ref, restoreData, { merge: true });
        }
      } catch {}

      // If member object exists, ensure active fields are fully synchronized
      if (memberToRestore) {
        await this.saveMember(memberToRestore);
      }

      // 5. Clean up legacy "deleted_members" collection
      try {
        await deleteDoc(doc(db, "deleted_members", originalId));
      } catch {}
      if (memberToRestore?.id && memberToRestore.id !== originalId) {
        try {
          await deleteDoc(doc(db, "deleted_members", memberToRestore.id));
        } catch {}
      }

      // 6. Update local state
      const restoredLocal = AppStateManager.restoreMember(originalId, memberToRestore || undefined);
      return restoredLocal || memberToRestore;
    } catch (err) {
      logger.error("Failed to restore member from recycle bin", err);
      return AppStateManager.restoreMember(originalId, memberObj);
    }
  }

  /**
   * Permanently purges a single member from the recycle bin (cannot be recovered).
   * This performs the permanent hard-delete (deleteDoc) from "members".
   */
  public static async purgeMemberFromRecycleBin(originalId: string): Promise<void> {
    try {
      // 1. Delete primary doc from "members" collection
      await deleteDoc(doc(db, "members", originalId));
      const snap = await getDocs(query(collection(db, "members"), where("id", "==", originalId)));
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
    } catch (err) {
      logger.warn("Firestore purge members doc error", err);
    }

    // 2. Delete legacy "deleted_members" doc
    try {
      await deleteDoc(doc(db, "deleted_members", originalId));
    } catch (err) {
      logger.warn("Firestore purge legacy fallback", err);
    }

    // 3. Purge from local storage
    AppStateManager.purgeMember(originalId);
  }

  /**
   * Empties the entire recycle bin permanently.
   */
  public static async emptyRecycleBin(): Promise<void> {
    try {
      // 1. Hard-delete all soft-deleted docs from "members"
      const snap = await getDocs(query(collection(db, "members"), where("isDeleted", "==", true)));
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
    } catch (err) {
      logger.warn("Firestore emptyRecycleBin members query fallback", err);
    }

    // 2. Empty legacy "deleted_members"
    try {
      const legacySnap = await getDocs(collection(db, "deleted_members"));
      for (const d of legacySnap.docs) {
        await deleteDoc(d.ref);
      }
    } catch (err) {
      logger.warn("Firestore emptyRecycleBin legacy fallback", err);
    }

    // 3. Clear local storage
    AppStateManager.clearRecycleBin();
  }

  /**
   * Subscribes to real-time changes in the recycle bin.
   * Listens to the primary "members" collection for isDeleted == true entries.
   */
  public static subscribeRecycleBin(onUpdate: (entries: DeletedMemberEntry[]) => void): () => void {
    try {
      const qMembers = query(collection(db, "members"), where("isDeleted", "==", true));
      return onSnapshot(qMembers, (snap) => {
        const entriesMap = new Map<string, DeletedMemberEntry>();

        snap.docs.forEach((d) => {
          const data = d.data() as Member;
          const clean = sanitizeMemberRecord(data);
          const origId = clean.id || d.id;
          entriesMap.set(origId, {
            originalId: origId,
            member: clean,
            deletedAt: clean.deletedAt || new Date().toISOString(),
            deletedBy: clean.deletedBy || "Admin",
            originalLocation: "Member Directory",
          });
        });

        // Merge with local recycle bin
        const local = AppStateManager.getRecycleBin();
        local.forEach((e) => {
          if (!entriesMap.has(e.originalId)) {
            entriesMap.set(e.originalId, e);
          }
        });

        const merged = Array.from(entriesMap.values()).sort(
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
