import { Member, GroupEvent, PhotoApprovalRequest, ActivityLog } from "../types";
import { logger } from "../lib/logger";
import { clientConfig } from "../lib/config";
import { isMemberCredentialMatch } from "../lib/authMatching";
import { INITIAL_MEMBERS } from "../data/seedData";
const LOCAL_STORAGE_KEY_MEMBERS = "taraba_river_members_v7_live";
const LOCAL_STORAGE_KEY_EVENTS = "taraba_river_events_v1";
const LOCAL_STORAGE_KEY_APPROVALS = "taraba_river_approvals_v1";
const LOCAL_STORAGE_KEY_LOGS = "taraba_river_logs_v1";
const LOCAL_STORAGE_KEY_CURRENT_USER = "taraba_river_user_v1"; // Session & Visit Keys
const LOCAL_STORAGE_KEY_VISIT_LOGS = "taraba_river_visit_logs_v2";
const LOCAL_STORAGE_KEY_SESSION_COUNT = "taraba_river_session_counter_v2";
const LOCAL_STORAGE_KEY_ACTIVE_SESSION = "taraba_river_active_session_user_v2";
const LOCAL_STORAGE_KEY_USER_HISTORY = "taraba_river_user_history_v2";
const LOCAL_STORAGE_KEY_CLOUD_CONFIG = "taraba_river_cloud_media_config_v1";

export interface CloudMediaConfig {
  dedicatedDriveUrl: string;
  dedicatedYoutubeUrl: string;
  ownerEmail: string;
  autoSyncOnApproval: boolean;
  lastSyncedAt?: string;
}

const DEFAULT_CLOUD_CONFIG: CloudMediaConfig = {
  dedicatedDriveUrl: "https://drive.google.com/drive/folders/19UcHi6ItJBeOAENfsOCM69K05NHc_13D?usp=drive_link",
  dedicatedYoutubeUrl: "https://www.youtube.com/channel/UC_tarabateam_official",
  ownerEmail: clientConfig.ownerEmail,
  autoSyncOnApproval: true,
  lastSyncedAt: new Date().toISOString(),
};

const sanitizeMember = (m: Member): Member => {
  let occ = m.occupation || "";
  if (occ.trim().toLowerCase() === "member") occ = "";
  let skills = Array.isArray(m.skills) ? [...m.skills] : [];
  if (skills.length > 0 && skills[0].toLowerCase() === "community support") skills = [];
  return {
    ...m,
    occupation: occ,
    skills,
  };
};

export interface SessionUserRecord {
  id: string;
  fullName: string;
  email: string;
  photoUrl: string;
  loginAt: string;
}
export interface VisitLogRecord {
  sessionId: string;
  userId: string | null;
  userName: string | null;
  timestamp: string;
}
function getTabSessionId(): string {
  try {
    let sid = sessionStorage.getItem("taraba_tab_session_id_v2");
    if (!sid) {
      sid = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      sessionStorage.setItem("taraba_tab_session_id_v2", sid);
    }
    return sid;
  } catch {
    return `tab_${Date.now()}`;
  }
}
const LOCAL_STORAGE_KEY_DELETED_MEMBERS = "taraba_river_deleted_member_ids_v1";

export class AppStateManager {
  private static listeners: Set<() => void> = new Set();

  public static getDeletedMemberIds(): Set<string> {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY_DELETED_MEMBERS);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  }

  public static markMemberAsDeleted(memberId: string): void {
    try {
      const set = this.getDeletedMemberIds();
      set.add(memberId);
      localStorage.setItem(LOCAL_STORAGE_KEY_DELETED_MEMBERS, JSON.stringify([...set]));
    } catch {}
  }

  public static getCloudMediaConfig(): CloudMediaConfig {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_CLOUD_CONFIG);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY_CLOUD_CONFIG, JSON.stringify(DEFAULT_CLOUD_CONFIG));
      return DEFAULT_CLOUD_CONFIG;
    }
    try {
      return { ...DEFAULT_CLOUD_CONFIG, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_CLOUD_CONFIG;
    }
  }

  public static saveCloudMediaConfig(config: Partial<CloudMediaConfig>): CloudMediaConfig {
    const current = this.getCloudMediaConfig();
    const updated = { ...current, ...config, lastSyncedAt: new Date().toISOString() };
    localStorage.setItem(LOCAL_STORAGE_KEY_CLOUD_CONFIG, JSON.stringify(updated));
    this.notify();
    return updated;
  }
  public static getMembers(): Member[] {
    const deletedIds = this.getDeletedMemberIds();
    const filterAdminAcc = (list: Member[]) =>
      list
        .filter((m) => m.email?.toLowerCase() !== clientConfig.ownerEmail.toLowerCase() && !deletedIds.has(m.id))
        .map(sanitizeMember);
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_MEMBERS);
    if (!raw) {
      const clean = filterAdminAcc(INITIAL_MEMBERS);
      localStorage.setItem(LOCAL_STORAGE_KEY_MEMBERS, JSON.stringify(clean));
      return clean;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return filterAdminAcc(parsed);
      }
      const clean = filterAdminAcc(INITIAL_MEMBERS);
      localStorage.setItem(LOCAL_STORAGE_KEY_MEMBERS, JSON.stringify(clean));
      return clean;
    } catch {
      const clean = filterAdminAcc(INITIAL_MEMBERS);
      return clean;
    }
  }
  public static saveMembers(members: Member[]) {
    const deletedIds = this.getDeletedMemberIds();
    const cleanList = members.filter((m) => !deletedIds.has(m.id));
    localStorage.setItem(LOCAL_STORAGE_KEY_MEMBERS, JSON.stringify(cleanList));
    this.notify();
  }
  public static deleteMember(memberId: string): Member[] {
    this.markMemberAsDeleted(memberId);
    const list = this.getMembers().filter((m) => m.id !== memberId);
    this.saveMembers(list);
    return list;
  }
  public static getEvents(): GroupEvent[] {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_EVENTS);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY_EVENTS, JSON.stringify([]));
      return [];
    }
    try {
      const parsed: GroupEvent[] = JSON.parse(raw);
      const cleanEvents = parsed.filter((e) => !e.id.startsWith("evt_arch_"));
      if (cleanEvents.length !== parsed.length) {
        localStorage.setItem(LOCAL_STORAGE_KEY_EVENTS, JSON.stringify(cleanEvents));
      }
      return cleanEvents;
    } catch {
      return [];
    }
  }
  public static saveEvents(events: GroupEvent[]) {
    localStorage.setItem(LOCAL_STORAGE_KEY_EVENTS, JSON.stringify(events));
    this.notify();
  }
  public static getApprovals(): PhotoApprovalRequest[] {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY_APPROVALS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  public static saveApprovals(approvals: PhotoApprovalRequest[]) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_APPROVALS, JSON.stringify(approvals));
    } catch (e) {
      logger.warn("LocalStorage saveApprovals error", e);
    }
    this.notify();
  }
  public static addApproval(approval: PhotoApprovalRequest) {
    try {
      const list = this.getApprovals();
      const existingIdx = list.findIndex((a) => a.id === approval.id);
      if (existingIdx !== -1) {
        list[existingIdx] = approval;
      } else {
        list.unshift(approval);
      }
      this.saveApprovals(list);
    } catch (e) {
      logger.warn("LocalStorage addApproval error", e);
    }
  }
  public static removeApproval(id: string) {
    try {
      const list = this.getApprovals().filter((a) => a.id !== id);
      this.saveApprovals(list);
    } catch (e) {
      logger.warn("LocalStorage removeApproval error", e);
    }
  }
  public static getActivityLogs(): ActivityLog[] {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_LOGS);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY_LOGS, JSON.stringify([]));
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  public static saveActivityLogs(logs: ActivityLog[]) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_LOGS, JSON.stringify(logs.slice(0, 50)));
    } catch {}
    this.notify();
  }
  public static addActivityLog(log: ActivityLog) {
    const logs = this.getActivityLogs();
    logs.unshift(log);
    localStorage.setItem(LOCAL_STORAGE_KEY_LOGS, JSON.stringify(logs.slice(0, 50)));
    this.notify();
  }
  /** * Look up matching member in database by ID, email, phone number, or credential object. */
  public static findMatchingMember(
    target: Partial<Member> | string | null | undefined
  ): Member | null {
    if (!target) return null;
    const members = this.getMembers();

    if (typeof target === "string") {
      return members.find((m) => isMemberCredentialMatch(m, target)) || null;
    }

    return (
      members.find((m) => {
        if (target.id && m.id === target.id) return true;
        if (target.email && m.email && m.email.trim().toLowerCase() === target.email.trim().toLowerCase()) return true;
        if (target.phoneNumber && isMemberCredentialMatch(m, target.phoneNumber)) return true;
        if (target.whatsappNumber && isMemberCredentialMatch(m, target.whatsappNumber)) return true;
        if (target.fullName && isMemberCredentialMatch(m, target.fullName)) return true;
        return false;
      }) || null
    );
  }

  /** * Get the cached current user for UI display, strictly preserving Google Auth profile image. */
  public static getCurrentUser(): Member | null {
    const activeSession = sessionStorage.getItem("taraba_session_auth_active");
    if (!activeSession) {
      localStorage.removeItem(LOCAL_STORAGE_KEY_CURRENT_USER);
      return null;
    }
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_CURRENT_USER);
    if (!raw) return null;
    try {
      const parsed: Member = JSON.parse(raw);
      const dbMatch = this.findMatchingMember(parsed);
      if (dbMatch) {
        const isGoogleAuthUser = parsed.isGoogleAuth || (parsed.photoUrl && parsed.photoUrl.includes("googleusercontent.com"));
        const strictPhoto = isGoogleAuthUser
          ? parsed.photoUrl || dbMatch.photoUrl || ""
          : dbMatch.photoUrl || parsed.photoUrl || "";

        return {
          ...dbMatch,
          ...parsed,
          photoUrl: strictPhoto,
          photoStatus: dbMatch.photoStatus || parsed.photoStatus || "approved",
          role: parsed.role || dbMatch.role || "member",
        };
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /** * Cache the current user for UI display, preserving Google Auth image. */
  public static setCurrentUser(user: Member | null) {
    if (!user) {
      localStorage.removeItem(LOCAL_STORAGE_KEY_CURRENT_USER);
      sessionStorage.removeItem("taraba_session_auth_active");
    } else {
      const dbMatch = this.findMatchingMember(user);
      const isGoogleAuthUser = user.isGoogleAuth || (user.photoUrl && user.photoUrl.includes("googleusercontent.com"));
      const strictPhoto = isGoogleAuthUser
        ? user.photoUrl || (dbMatch ? dbMatch.photoUrl : "")
        : (dbMatch ? dbMatch.photoUrl : user.photoUrl) || "";

      const enrichedUser: Member = dbMatch
        ? {
            ...dbMatch,
            ...user,
            photoUrl: strictPhoto,
            photoStatus: dbMatch.photoStatus || user.photoStatus || "approved",
          }
        : user;

      localStorage.setItem(LOCAL_STORAGE_KEY_CURRENT_USER, JSON.stringify(enrichedUser));
      sessionStorage.setItem("taraba_session_auth_active", `sess_${Date.now()}`);
      this.recordUserLogin(enrichedUser);
    }
    this.notify();
  }
  // Visit tracking logic excluding current user's session activity
  public static recordVisit(currentUserId: string | null): string {
    const tabSessionId = getTabSessionId();
    const rawLogs = localStorage.getItem(LOCAL_STORAGE_KEY_VISIT_LOGS);
    let visitLogs: VisitLogRecord[] = [];
    if (rawLogs) {
      try {
        visitLogs = JSON.parse(rawLogs);
      } catch {
        visitLogs = [];
      }
    }
    // Default fallback timestamp (28 mins ago) if no previous logs exist
    const defaultPastTime = new Date(Date.now() - 28 * 60 * 1000).toISOString();
    // Exclude current session and current user's visits
    const otherVisits = visitLogs.filter(
      (log) =>
        log.sessionId !== tabSessionId && (currentUserId ? log.userId !== currentUserId : true)
    );
    const lastVisitExcludingCurrent =
      otherVisits.length > 0 ? otherVisits[0].timestamp : defaultPastTime;
    // Record new visit log for current session
    visitLogs.unshift({
      sessionId: tabSessionId,
      userId: currentUserId,
      userName: null,
      timestamp: new Date().toISOString(),
    });
    localStorage.setItem(LOCAL_STORAGE_KEY_VISIT_LOGS, JSON.stringify(visitLogs.slice(0, 50)));
    return lastVisitExcludingCurrent;
  }
  public static getLastVisitExcludingCurrent(currentUserId: string | null): string {
    const tabSessionId = getTabSessionId();
    const rawLogs = localStorage.getItem(LOCAL_STORAGE_KEY_VISIT_LOGS);
    let visitLogs: VisitLogRecord[] = [];
    if (rawLogs) {
      try {
        visitLogs = JSON.parse(rawLogs);
      } catch {
        visitLogs = [];
      }
    }
    const otherVisits = visitLogs.filter(
      (log) =>
        log.sessionId !== tabSessionId && (currentUserId ? log.userId !== currentUserId : true)
    );
    return otherVisits.length > 0
      ? otherVisits[0].timestamp
      : new Date(Date.now() - 28 * 60 * 1000).toISOString();
  }

  // User-specific visit counter
  public static getUserVisitCount(userId: string | null): number {
    if (!userId) return 1;
    const raw = localStorage.getItem(`taraba_user_visit_count_${userId}`);
    if (raw) return parseInt(raw, 10);
    // If not recorded yet, check if member was recently registered (joinedAt)
    const members = this.getMembers();
    const user = members.find((m) => m.id === userId);
    if (user && user.joinedAt) {
      const joinedDate = new Date(user.joinedAt).getTime();
      if (!isNaN(joinedDate) && Date.now() - joinedDate < 24 * 60 * 60 * 1000) {
        return 1;
      }
    }
    return 2; // Default to returning visit for established members
  }

  public static recordUserVisit(userId: string): number {
    const current = this.getUserVisitCount(userId);
    const next = current + 1;
    localStorage.setItem(`taraba_user_visit_count_${userId}`, next.toString());
    return next;
  }

  // Session & Counter Logic
  public static getSessionCount(): number {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_SESSION_COUNT);
    return raw ? parseInt(raw, 10) : 0;
  }
  public static getActiveSessionUser(): SessionUserRecord | null {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_ACTIVE_SESSION);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  public static getUserHistory(): SessionUserRecord[] {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_USER_HISTORY);
    if (!raw) {
      const defaultHistory: SessionUserRecord[] = [
        {
          id: "mem_2",
          fullName: "Aisha Hassan",
          email: "aisha.hassan@tarabariver.org",
          photoUrl:
            "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80",
          loginAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        },
        {
          id: "mem_3",
          fullName: "Emmanuel Nwankwo",
          email: "emmanuel.n@tarabariver.org",
          photoUrl:
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
          loginAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        },
      ];
      localStorage.setItem(LOCAL_STORAGE_KEY_USER_HISTORY, JSON.stringify(defaultHistory));
      return defaultHistory;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  public static recordUserLogin(user: Member): {
    sessionCount: number;
    activeUser: SessionUserRecord;
    latestUniqueUser: SessionUserRecord | null;
  } {
    let sessionCount = this.getSessionCount();
    const activeUser = this.getActiveSessionUser();
    let userHistory = this.getUserHistory();
    const newUserRecord: SessionUserRecord = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      photoUrl: user.photoUrl,
      loginAt: new Date().toISOString(),
    };

    if (activeUser) {
      if (activeUser.id === user.id) {
        localStorage.setItem(
          LOCAL_STORAGE_KEY_ACTIVE_SESSION,
          JSON.stringify({ ...activeUser, loginAt: new Date().toISOString() })
        );
      } else {
        sessionCount += 1;
        localStorage.setItem(LOCAL_STORAGE_KEY_SESSION_COUNT, sessionCount.toString());
        const existsInHistory = userHistory.some((u) => u.id === activeUser.id);
        if (!existsInHistory) {
          userHistory.unshift(activeUser);
          localStorage.setItem(
            LOCAL_STORAGE_KEY_USER_HISTORY,
            JSON.stringify(userHistory.slice(0, 20))
          );
        }
        localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_SESSION, JSON.stringify(newUserRecord));
      }
    } else {
      localStorage.setItem(LOCAL_STORAGE_KEY_ACTIVE_SESSION, JSON.stringify(newUserRecord));
    }

    const latestUniqueUser = this.getLatestUniqueUser(user.id);
    this.notify();
    return { sessionCount, activeUser: newUserRecord, latestUniqueUser };
  }
  public static getLatestUniqueUser(currentUserId: string | null): SessionUserRecord | null {
    const activeUser = this.getActiveSessionUser();
    const userHistory = this.getUserHistory();
    // Combine active session and history to find the most recent unique user other than current user
    const combined = [...(activeUser ? [activeUser] : []), ...userHistory];
    const match = combined.find((record) => !currentUserId || record.id !== currentUserId);
    if (match) return match;
    // Fallback to Aisha Hassan if no other user is recorded
    return {
      id: "mem_2",
      fullName: "Aisha Hassan",
      email: "aisha.hassan@tarabariver.org",
      photoUrl:
        "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80",
      loginAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    };
  }
  public static subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private static notify() {
    this.listeners.forEach((fn) => fn());
  }
}
