import React, { useState } from "react";
import { logger } from "../lib/logger";
import { clientConfig } from "../lib/config";
import { Member, PhotoApprovalRequest, GroupEvent } from "../types";
import { MemberDirectoryView } from "./MemberDirectoryView";
import { AppStateManager } from "../services/storage";
import { FirebaseSyncManager } from "../services/firebaseService";
import { triggerCloudSyncAll, triggerYouTubeBackSync, resetSystemData, deleteEvent as deleteEventApi } from "../services/apiClient";
import { deleteYouTubeVideo } from "../services/youtubeDirectUpload";
import { CreateEventModal } from "./CreateEventModal";
import { ReturnButton } from "./ReturnButton";
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  Calendar,
  Plus,
  RefreshCw,
  HelpCircle,
  UserX,
  ArrowLeft,
  FolderOpen,
  Video,
  Cloud,
  Save,
  CheckSquare,
  Square,
  CheckCheck,
  Edit,
  Trash2,
  CalendarDays,
} from "lucide-react";

interface AdminDashboardViewProps {
  members: Member[];
  currentUser: Member | null;
  events: GroupEvent[];
  onRefreshData: () => void;
  onEditMember: (member: Member) => void;
  onRegisterClick: () => void;
  onReturn?: () => void;
}

function handleGoogleDriveImageError(e: React.SyntheticEvent<HTMLImageElement, Event>): void {
  const img = e.currentTarget;
  const currentUrl = img.src;
  const attemptCount = parseInt((img as any).dataset?.fallbackAttempt || "0", 10);
  if (attemptCount >= 4) return;
  if ((img as any).dataset) (img as any).dataset.fallbackAttempt = String(attemptCount + 1);

  let fileId: string | null = null;
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/api\/media\/image\/([a-zA-Z0-9_-]+)/,
    /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const pat of patterns) {
    const m = currentUrl.match(pat);
    if (m && m[1].length > 8) { fileId = m[1]; break; }
  }

  if (fileId) {
    if (attemptCount === 0) {
      img.src = `https://lh3.googleusercontent.com/d/${fileId}`;
    } else if (attemptCount === 1) {
      img.src = `/api/media/image/${fileId}`;
    } else if (attemptCount === 2) {
      img.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    } else if (attemptCount === 3) {
      img.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
  }
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  members,
  currentUser,
  events,
  onRefreshData,
  onEditMember,
  onRegisterClick,
  onReturn,
}) => {
  const [activeTab, setActiveTab] = useState<"directory" | "rsvps" | "analytics" | "moderation" | "cloud_settings">("directory");
  const [pendingApprovals, setPendingApprovals] = useState<PhotoApprovalRequest[]>([]);
  const [createEventModalOpen, setCreateEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<GroupEvent | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Cloud Config State
  const [cloudConfig, setCloudConfig] = useState(() => AppStateManager.getCloudMediaConfig());
  const [driveUrlInput, setDriveUrlInput] = useState(() => cloudConfig.dedicatedDriveUrl);
  const [youtubeUrlInput, setYoutubeUrlInput] = useState(() => cloudConfig.dedicatedYoutubeUrl);
  const [cloudSaveMessage, setCloudSaveMessage] = useState<string | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [syncDirection, setSyncDirection] = useState<"reverse" | "forward">("forward");

  const handleOpenCreateEvent = () => {
    setEditingEvent(null);
    setCreateEventModalOpen(true);
  };

  const handleEditEvent = (evt: GroupEvent) => {
    setEditingEvent(evt);
    setCreateEventModalOpen(true);
  };

  const handleDeleteEvent = async (eventId: string, title: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete "${title}"?\n\nThis will permanently remove the event/announcement and its RSVP records from the calendar and database.`
      )
    ) {
      try {
        setDeletingEventId(eventId);
        const remainingEvents = events.filter((e) => e.id !== eventId);
        AppStateManager.saveEvents(remainingEvents);
        await FirebaseSyncManager.deleteEvent(eventId);
        try {
          await deleteEventApi(eventId);
        } catch {}
        onRefreshData();
      } catch (err) {
        logger.error("Delete event failed", err);
        alert("Failed to delete event. Please try again.");
      } finally {
        setDeletingEventId(null);
      }
    }
  };

  React.useEffect(() => {
    // Real-time live stream for media moderation approvals
    const unsubscribe = FirebaseSyncManager.subscribeApprovals((list) => {
      setPendingApprovals(list.filter((r) => r.status === "pending"));
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const fetchApprovals = async () => {
    // Real-time onSnapshot handles live updates automatically
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    onRefreshData();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleSaveCloudSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = AppStateManager.saveCloudMediaConfig({
      dedicatedDriveUrl: driveUrlInput.trim(),
      dedicatedYoutubeUrl: youtubeUrlInput.trim(),
      ownerEmail: clientConfig.ownerEmail,
    });
    setCloudConfig(updated);
    setCloudSaveMessage(`✅ Cloud settings saved! Connected to ${clientConfig.ownerEmail} pipeline.`);
    setTimeout(() => setCloudSaveMessage(null), 4000);
  };

  const handleTriggerCloudSyncNow = async () => {
    setIsCloudSyncing(true);
    setCloudSaveMessage(
      syncDirection === "reverse"
        ? "🔄 Connecting to Cloud Media Archive... Pulling folders and photos..."
        : "🔄 Connecting to Cloud Media Archive... Pushing events and local assets..."
    );
    try {
      const res = await triggerCloudSyncAll(syncDirection);
      if (res && res.events) {
        AppStateManager.saveEvents(res.events);
      }
      const updated = AppStateManager.saveCloudMediaConfig({
        lastSyncedAt: new Date().toISOString(),
      });
      setCloudConfig(updated);
      onRefreshData();
      const syncMsg = (res as any).message || "Cloud sync complete!";
      setCloudSaveMessage(`⚡ ${syncMsg}`);
    } catch (e: any) {
      const errMsg = e?.message || "Cloud sync encountered an issue.";
      setCloudSaveMessage(`⚠️ ${errMsg}`);
    } finally {
      setTimeout(() => {
        setIsCloudSyncing(false);
        setTimeout(() => setCloudSaveMessage(null), 8000);
      }, 1500);
    }
  };

  const [ytSyncDirection, setYtSyncDirection] = useState<"reverse" | "forward">("forward");
  const [isYtSyncing, setIsYtSyncing] = useState(false);
  const [ytSyncMessage, setYtSyncMessage] = useState<string | null>(null);

  const handleTriggerYouTubeSyncNow = async () => {
    setIsYtSyncing(true);
    setYtSyncMessage(
      ytSyncDirection === "reverse"
        ? "🔄 Connecting to Media Stream... Back-syncing video clips & recordings..."
        : "🚀 Syncing local event video metadata to cloud stream..."
    );
    try {
      const res = await triggerYouTubeBackSync();
      if (res && res.events) {
        AppStateManager.saveEvents(res.events);
      }
      onRefreshData();
      const syncMsg = (res as any).message || "Video sync complete!";
      setYtSyncMessage(`⚡ ${syncMsg}`);
    } catch (e: any) {
      const errMsg = e?.message || "Video sync encountered an issue.";
      setYtSyncMessage(`⚠️ ${errMsg}`);
    } finally {
      setTimeout(() => {
        setIsYtSyncing(false);
        setTimeout(() => setYtSyncMessage(null), 8000);
      }, 1500);
    }
  };

  const handleApprovePhoto = async (req: PhotoApprovalRequest) => {
    // 1. Award activity points to the uploading member
    const memIdx = members.findIndex((m) => m.id === req.memberId);
    if (memIdx !== -1) {
      if (members[memIdx].role !== "admin") {
        members[memIdx].activityPoints = (members[memIdx].activityPoints || 0) + 30;
      }
      AppStateManager.saveMembers(members);
      try {
        await FirebaseSyncManager.saveMember(members[memIdx]);
      } catch (e) {}
    }

    // 2. Attach media to target event
    const allEvents = AppStateManager.getEvents();
    let targetEvt = req.eventId ? allEvents.find((e) => e.id === req.eventId) : undefined;

    if (targetEvt) {
      // Event exists — add the approved photo/video to it
      if (req.type === "video") {
        const existingVideos = targetEvt.youtubeVideoUrls || (targetEvt.youtubeVideoUrl ? [targetEvt.youtubeVideoUrl] : []);
        if (!existingVideos.includes(req.photoUrl)) {
          targetEvt.youtubeVideoUrls = [req.photoUrl, ...existingVideos];
          targetEvt.youtubeVideoUrl = targetEvt.youtubeVideoUrls[0] || req.photoUrl;
        }
      } else {
        const existingImgs = targetEvt.driveImageUrls || [];
        if (!existingImgs.includes(req.photoUrl)) {
          targetEvt.driveImageUrls = [req.photoUrl, ...existingImgs];
        }
      }
      AppStateManager.saveEvents(allEvents);
      try {
        await FirebaseSyncManager.saveEvent(targetEvt);
      } catch (e) {}
    } else {
      // This was a new folder upload submitted by a member — create and publish the event now
      const newEvt: GroupEvent = {
        id: req.eventId || `evt_folder_${Date.now()}`,
        title: req.folderName || req.title || "Community Event",
        date: req.date || req.uploadedAt?.split("T")[0] || new Date().toISOString().split("T")[0],
        time: "09:00",
        location: req.location || "",
        category: req.category || "cleanup",
        description: req.description || `Archival media collection for ${req.folderName || "Community Event"}.`,
        driveImageUrls: req.type === "photo" ? [req.photoUrl] : [],
        driveFolderId: `drive_folder_${Date.now()}`,
        youtubeVideoUrl: req.type === "video" ? req.photoUrl : "",
        youtubeVideoUrls: req.type === "video" ? [req.photoUrl] : [],
        createdBy: req.memberName || "Community Member",
        createdById: req.memberId || "mem_guest",
        attendeeIds: [],
        maxCapacity: 100,
        createdAt: req.uploadedAt || new Date().toISOString(),
      };
      allEvents.unshift(newEvt);
      AppStateManager.saveEvents(allEvents);
      try {
        await FirebaseSyncManager.saveEvent(newEvt);
      } catch (e) {}
    }

    // 3. Zero-residue: Delete approval request document from Firestore immediately
    try {
      await FirebaseSyncManager.deleteApproval(req.id);
    } catch (e) {
      logger.warn("Admin delete approval notice", { error: e });
    }

    setPendingApprovals((prev) => prev.filter((r) => r.id !== req.id));
    onRefreshData();
  };

  const handleRejectPhoto = async (req: PhotoApprovalRequest) => {
    // If rejecting a video, also delete it from YouTube to prevent orphaned assets
    if (req.type === "video" && req.photoUrl) {
      try {
        await deleteYouTubeVideo(req.photoUrl);
      } catch (ytErr) {
        logger.warn("YouTube video delete on reject notice", ytErr);
      }
    }

    const allEvents = AppStateManager.getEvents();
    let targetEvt = req.eventId
      ? allEvents.find((e) => e.id === req.eventId)
      : allEvents.find((e) => (e.driveImageUrls || []).includes(req.photoUrl) || (e.youtubeVideoUrls || []).includes(req.photoUrl) || e.youtubeVideoUrl === req.photoUrl);

    if (targetEvt) {
      if (req.type === "video") {
        targetEvt.youtubeVideoUrls = (targetEvt.youtubeVideoUrls || []).filter((u) => u !== req.photoUrl);
        if (targetEvt.youtubeVideoUrl === req.photoUrl) {
          targetEvt.youtubeVideoUrl = targetEvt.youtubeVideoUrls[0] || "";
        }
      } else if (req.type === "photo") {
        targetEvt.driveImageUrls = (targetEvt.driveImageUrls || []).filter((u) => u !== req.photoUrl);
      }

      // If the event now has no media and was created specifically for this upload batch, clean it up
      const hasVideos = (targetEvt.youtubeVideoUrls || []).length > 0 || !!targetEvt.youtubeVideoUrl;
      if ((targetEvt.driveImageUrls || []).length === 0 && !hasVideos && targetEvt.id.startsWith("evt_folder_")) {
        const remainingEvents = allEvents.filter((e) => e.id !== targetEvt!.id);
        AppStateManager.saveEvents(remainingEvents);
        try {
          await FirebaseSyncManager.deleteEvent(targetEvt.id);
        } catch (e) {}
      } else {
        AppStateManager.saveEvents(allEvents);
        try {
          await FirebaseSyncManager.saveEvent(targetEvt);
        } catch (e) {}
      }
    }

    // Zero-residue: Delete rejected approval request document from Firestore immediately
    try {
      await FirebaseSyncManager.deleteApproval(req.id);
    } catch (e) {
      logger.warn("Admin delete approval notice", { error: e });
    }

    setPendingApprovals((prev) => prev.filter((r) => r.id !== req.id));
    onRefreshData();
  };

  // Media Moderation Multi-Selection State
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const handleToggleSelectMedia = (id: string) => {
    setSelectedMediaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAllMedia = () => {
    if (selectedMediaIds.size === pendingApprovals.length) {
      setSelectedMediaIds(new Set());
    } else {
      setSelectedMediaIds(new Set(pendingApprovals.map((r) => r.id)));
    }
  };

  const handleBatchApprove = async () => {
    const itemsToApprove = pendingApprovals.filter((r) => selectedMediaIds.has(r.id));
    if (itemsToApprove.length === 0) return;
    setIsBatchProcessing(true);
    for (const req of itemsToApprove) {
      await handleApprovePhoto(req);
    }
    setSelectedMediaIds(new Set());
    setIsBatchProcessing(false);
  };

  const handleBatchReject = async () => {
    const itemsToReject = pendingApprovals.filter((r) => selectedMediaIds.has(r.id));
    if (itemsToReject.length === 0) return;
    if (!window.confirm(`Are you sure you want to reject ${itemsToReject.length} selected media submissions?`)) return;
    setIsBatchProcessing(true);
    for (const req of itemsToReject) {
      await handleRejectPhoto(req);
    }
    setSelectedMediaIds(new Set());
    setIsBatchProcessing(false);
  };

  const getMemberName = (id: string) => {
    const member = members.find((m) => m.id === id);
    return member ? member.fullName : "Member";
  };

  const handleResetSystemData = async () => {
    const confirmed = window.confirm(
      "⚠️ WARNING: This will permanently reset all member activity points to 0 and clear all activity logs. This cannot be undone.\n\nAre you sure you want to proceed?"
    );
    if (!confirmed) return;

    try {
      setIsRefreshing(true);
      const res = await resetSystemData();
      alert(`⚡ Success: ${res.message || "System has been reset to a blank slate!"}`);
      onRefreshData();
    } catch (e: any) {
      alert(`❌ Error: ${e.message || "Failed to reset system data."}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const topActiveMembers = [...members]
    .filter((m) => (m.activityPoints || 0) > 0)
    .sort((a, b) => (b.activityPoints || 0) - (a.activityPoints || 0))
    .slice(0, 5);

  return (
    <div className="space-y-6 font-sans font-normal">
      {/* Header Bar - Mobile-First Flexbox Layout */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl shrink-0">
            <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl text-slate-900 dark:text-white tracking-tight font-semibold">
              Admin Portal
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              System Administration & Cloud Media Control
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3 shrink-0 self-end sm:self-auto">
          {onReturn && (
            <ReturnButton onClick={onReturn} />
          )}
          <button onClick={handleManualRefresh} className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px]" title="Refresh Data" >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs Bar - Responsive Grid on Mobile, Flex on Desktop */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full font-normal">
        <button onClick={() => setActiveTab("directory")}
          className={`px-3 py-2.5 sm:px-3.5 sm:py-2 rounded-2xl text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 font-medium cursor-pointer min-h-[42px] ${
            activeTab === "directory"
              ? "bg-teal-700 text-white shadow-md shadow-teal-700/20"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Users className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
          <span className="truncate">Members Directory</span>
        </button>

        <button onClick={() => setActiveTab("rsvps")}
          className={`px-3 py-2.5 sm:px-3.5 sm:py-2 rounded-2xl text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 font-medium cursor-pointer min-h-[42px] ${
            activeTab === "rsvps"
              ? "bg-teal-700 text-white shadow-md shadow-teal-700/20"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Calendar className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
          <span className="truncate">Events</span>
        </button>

        <button onClick={() => setActiveTab("analytics")}
          className={`px-3 py-2.5 sm:px-3.5 sm:py-2 rounded-2xl text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 font-medium cursor-pointer min-h-[42px] ${
            activeTab === "analytics"
              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-semibold"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Award className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
          <span className="truncate">Top Engagement</span>
        </button>

        <button onClick={() => setActiveTab("moderation")}
          className={`relative px-3 py-2.5 sm:px-3.5 sm:py-2 rounded-2xl text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 font-medium cursor-pointer min-h-[42px] ${
            activeTab === "moderation"
              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-semibold"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Clock className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
          <span className="truncate">Media Moderation</span>
          {pendingApprovals.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1">
              {pendingApprovals.length}
            </span>
          )}
        </button>

        <button onClick={() => setActiveTab("cloud_settings")}
          className={`col-span-2 sm:col-span-1 px-3 py-2.5 sm:px-3.5 sm:py-2 rounded-2xl text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 font-medium cursor-pointer min-h-[42px] ${
            activeTab === "cloud_settings"
              ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <FolderOpen className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 text-cyan-400" />
          <span className="truncate">Cloud Media Integration</span>
        </button>
      </div>

      {/* TAB 0: MEMBERS DIRECTORY */}
      {activeTab === "directory" && (
        <MemberDirectoryView
          members={members}
          currentUser={currentUser}
          onEditMember={onEditMember}
          onRegisterClick={onRegisterClick}
        />
      )}

      {/* TAB 1: EVENTS & ANNOUNCEMENTS */}
      {activeTab === "rsvps" && (
        <div className="space-y-8 font-normal">
          {/* Section 1: Events & Announcements Header Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-base sm:text-lg text-slate-900 dark:text-white font-bold flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  <span>Active Events & Announcements</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-normal">
                  Publish, edit, delete, and track live member RSVPs for upcoming events and announcements
                </p>
              </div>
              <button
                onClick={handleOpenCreateEvent}
                className="shrink-0 px-4 py-2.5 rounded-2xl text-xs sm:text-sm bg-cyan-600 hover:bg-cyan-700 text-white shadow-md shadow-cyan-600/20 transition-all flex items-center space-x-2 font-medium cursor-pointer min-h-[42px]"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-white" />
                <span className="whitespace-nowrap font-semibold">Create Event / Announcement</span>
              </button>
            </div>
          </div>

          {/* Section 2: Future Events & Member RSVP Board */}
          <div className="space-y-4">
            {(() => {
              const today = new Date();
              const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
              // STRICT RULE: Only future/upcoming events (date >= todayStr) are displayed. Past events are completely excluded.
              const activeEvents = events.filter((evt) => evt.date >= todayStr);

              return (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                    <h3 className="text-sm sm:text-base text-slate-900 dark:text-white font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <span>Member RSVP & Attendance Board ({activeEvents.length})</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Real-time tracking of member responses (Yes, Maybe, No) for all upcoming events
                    </p>
                  </div>

                  {/* Empty State */}
                  {activeEvents.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm font-normal rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      No upcoming events or announcements currently scheduled.
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {activeEvents.map((evt, idx) => {
                        const yesIds = evt.attendeeIds || [];
                        const maybeIds = evt.maybeIds || [];
                        const noIds = evt.declinedIds || [];

                        return (
                          <div
                            key={evt.id}
                            className="bg-white dark:bg-slate-900/95 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 hover:border-cyan-500/50 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-xs"
                          >
                            {/* Event Title, Details & Description */}
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="w-6 h-6 rounded-full bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-400 text-xs font-bold flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>

                                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shrink-0">
                                  Upcoming
                                </span>

                                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                                  {evt.title}
                                </h3>

                                {evt.category && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/60 text-[11px] font-medium shrink-0">
                                    🏷️ {evt.category}
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  📅 {evt.date} • {evt.time}
                                </span>
                                <span>•</span>
                                <span className="truncate">📍 {evt.location || "Venue TBA"}</span>
                              </p>

                              {evt.description && (
                                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                  {evt.description}
                                </p>
                              )}
                            </div>

                            {/* RSVP Summary Pills */}
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {/* Yes Pill */}
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="font-semibold">Yes ({yesIds.length})</span>
                                {yesIds.length > 0 && (
                                  <span
                                    className="text-[11px] text-emerald-700 dark:text-emerald-400 truncate max-w-[130px]"
                                    title={yesIds.map(getMemberName).join(", ")}
                                  >
                                    : {yesIds.map(getMemberName).join(", ")}
                                  </span>
                                )}
                              </div>

                              {/* Maybe Pill */}
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
                                <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span className="font-semibold">Maybe ({maybeIds.length})</span>
                                {maybeIds.length > 0 && (
                                  <span
                                    className="text-[11px] text-amber-700 dark:text-amber-400 truncate max-w-[130px]"
                                    title={maybeIds.map(getMemberName).join(", ")}
                                  >
                                    : {maybeIds.map(getMemberName).join(", ")}
                                  </span>
                                )}
                              </div>

                              {/* No Pill */}
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/60 text-xs text-red-800 dark:text-red-300">
                                <UserX className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                                <span className="font-semibold">No ({noIds.length})</span>
                              </div>
                            </div>

                            {/* Action Buttons: Edit & Delete */}
                            <div className="flex items-center gap-2 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                              <button
                                onClick={() => handleEditEvent(evt)}
                                className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 text-slate-700 dark:text-slate-200 hover:text-cyan-700 dark:hover:text-cyan-400 border border-slate-200 dark:border-slate-700 hover:border-cyan-400 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                title="Edit Event Details & Announcement"
                              >
                                <Edit className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                                <span>Edit</span>
                              </button>

                              <button
                                onClick={() => handleDeleteEvent(evt.id, evt.title)}
                                disabled={deletingEventId === evt.id}
                                className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                                title="Permanently Delete Event"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                                <span>{deletingEventId === evt.id ? "Deleting..." : "Delete"}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* TAB 2: DATA VISUALIZATION */}
      {activeTab === "analytics" && (
        <div className="space-y-6 font-normal">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 py-6 sm:py-8 text-slate-900 dark:text-slate-100 space-y-4 transition-colors border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm text-slate-900 dark:text-white flex items-center space-x-2 font-normal">
                    <Award className="w-5 h-5 text-amber-500" />
                    <span>Top 5 Active Members Engagement</span>
                  </h3>
                </div>
                <button
                  onClick={handleResetSystemData}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-normal rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-sm active:scale-95 border border-red-500/20"
                  title="Wipe database and start with a fresh blank slate"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset Data</span>
                </button>
              </div>
              <div className="space-y-4 pt-2">
                {topActiveMembers.length > 0 ? (
                  topActiveMembers.map((m, idx) => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center space-x-3">
                        <span className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm font-normal">
                          #{idx + 1}
                        </span>
                        <span className="text-sm text-slate-900 dark:text-white font-normal">{m.fullName}</span>
                      </div>
                      <span className="text-sm text-amber-600 dark:text-amber-400 font-normal">
                        {m.activityPoints || 0} Points
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500">
                    No member engagement recorded yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PHOTO MODERATION */}
      {activeTab === "moderation" && (
        <div className="py-6 text-slate-900 dark:text-slate-100 space-y-5 transition-colors font-normal">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                <span>Pending Events Photo and Video Submissions</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                  {pendingApprovals.length} pending
                </span>
              </h3>
            </div>
            {pendingApprovals.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleSelectAllMedia}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium transition-all flex items-center gap-2 cursor-pointer shadow-xs border border-slate-200 dark:border-slate-700"
                >
                  {selectedMediaIds.size === pendingApprovals.length ? (
                    <CheckSquare className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>
                    {selectedMediaIds.size === pendingApprovals.length
                      ? "Deselect All"
                      : `Select All (${selectedMediaIds.size}/${pendingApprovals.length})`}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Sticky Batch Action Bar */}
          {selectedMediaIds.size > 0 && (
            <div className="sticky top-20 z-30 p-3.5 bg-gradient-to-r from-cyan-950/95 via-slate-900/95 to-cyan-950/95 backdrop-blur-md rounded-2xl border border-cyan-500/40 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-white animate-fadeIn">
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-cyan-200">
                <CheckCheck className="w-4 h-4 text-cyan-400" />
                <span>
                  <strong>{selectedMediaIds.size}</strong> media item{selectedMediaIds.size !== 1 ? 's' : ''} selected
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleBatchApprove}
                  disabled={isBatchProcessing}
                  className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-medium rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isBatchProcessing ? "Processing..." : `Approve Selected (${selectedMediaIds.size})`}</span>
                </button>
                <button
                  type="button"
                  onClick={handleBatchReject}
                  disabled={isBatchProcessing}
                  className="flex-1 sm:flex-none px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-medium rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  <span>{isBatchProcessing ? "Processing..." : `Reject Selected (${selectedMediaIds.size})`}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMediaIds(new Set())}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {pendingApprovals.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm font-normal">
              No pending media uploads requiring review.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 font-normal">
              {pendingApprovals.map((req) => (
                <div
                  key={req.id}
                  className={`relative bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border transition-all space-y-4 ${
                    selectedMediaIds.has(req.id)
                      ? "border-cyan-500 ring-2 ring-cyan-500/50 bg-cyan-50/20 dark:bg-cyan-950/20 shadow-md"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {/* Select Checkbox Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleSelectMedia(req.id)}
                    className="absolute top-3 left-3 z-10 p-1.5 bg-black/75 hover:bg-black/90 backdrop-blur-md rounded-lg text-white transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                    title={selectedMediaIds.has(req.id) ? "Deselect" : "Select"}
                  >
                    {selectedMediaIds.has(req.id) ? (
                      <CheckSquare className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300" />
                    )}
                    <span className="text-[11px] font-medium pr-1">
                      {selectedMediaIds.has(req.id) ? "Selected" : "Select"}
                    </span>
                  </button>

                  <div className="w-full h-48 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative">
                    {req.type === "video" ? (
                      <div className="flex flex-col items-center gap-2 text-red-600 dark:text-red-400">
                        <Video className="w-12 h-12" />
                        <span className="text-xs font-medium">Video Submission</span>
                      </div>
                    ) : (
                      <img
                        src={req.previewDataUrl || req.photoUrl}
                        alt={req.folderName || "Pending Upload"}
                        className="w-full h-full object-cover"
                        onError={handleGoogleDriveImageError}
                      />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm text-slate-900 dark:text-white font-normal">{req.memberName}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{req.memberEmail}</p>
                    <p className="text-xs text-slate-400 mt-1 capitalize">{req.type} • {req.folderName || req.adminNotes || "Event Media"}</p>
                  </div>
                  <div className="flex items-center space-x-3 pt-2">
                    <button onClick={() => handleApprovePhoto(req)}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-xl transition flex items-center justify-center space-x-2 font-normal cursor-pointer"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Approve</span>
                    </button>
                    <button onClick={() => handleRejectPhoto(req)}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-xl transition flex items-center justify-center space-x-2 font-normal cursor-pointer"
                    >
                      <XCircle className="w-5 h-5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CLOUD MEDIA INTEGRATION (Single Unified Card Container) */}
      {activeTab === "cloud_settings" && (
        <div className="py-2 sm:py-4 space-y-6 font-normal animate-fadeIn">
          <div className="bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
            
            {/* ── CARD HEADER ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
              <div className="flex items-start sm:items-center space-x-3.5 min-w-0 w-full sm:w-auto">
                <div className="p-3 bg-gradient-to-br from-cyan-500 to-indigo-600 text-white rounded-2xl shadow-sm shrink-0">
                  <Cloud className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg text-slate-900 dark:text-white font-semibold leading-snug break-words">
                    Official Admin Cloud Media & YouTube Integration Hub
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">
                    Pipeline Account: <strong className="text-cyan-600 dark:text-cyan-400 font-medium">{clientConfig.ownerEmail}</strong>
                  </p>
                </div>
              </div>
            </div>

            {cloudSaveMessage && (
              <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60 text-teal-800 dark:text-teal-300 text-xs sm:text-sm font-normal animate-fadeIn">
                {cloudSaveMessage}
              </div>
            )}

            {ytSyncMessage && (
              <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-300 text-xs sm:text-sm font-normal animate-fadeIn">
                {ytSyncMessage}
              </div>
            )}

            {/* ── SECTION 1: PHOTO & EVENT ALBUMS CLOUD SYNC ENGINE ── */}
            <div className="flex flex-col gap-3.5 p-4 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              {/* Text Block (Placed Full Width Above Button) */}
              <div className="flex items-start space-x-3 w-full">
                <div className="p-2 bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400 rounded-xl shrink-0 mt-0.5">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm sm:text-base text-slate-900 dark:text-white font-semibold leading-snug">
                    Photo & Event Albums Cloud Sync Engine
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Bidirectional sync for cloud media photos & event albums
                  </p>
                </div>
              </div>

              {/* Compact Button (Placed Below Text) */}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={handleTriggerCloudSyncNow}
                  disabled={isCloudSyncing}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white text-xs font-medium rounded-lg transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCloudSyncing ? "animate-spin" : ""}`} />
                  <span>{isCloudSyncing ? "Syncing..." : "Trigger Media Sync"}</span>
                </button>
              </div>

              {/* Sync Direction Sliding Toggle Switch */}
              <div className="flex flex-col space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide">
                  MEDIA SYNC DIRECTION
                </label>
                <div className="relative flex items-center p-1 bg-slate-200 dark:bg-slate-900 rounded-xl w-full sm:max-w-sm border border-slate-300 dark:border-slate-800/80 shadow-inner">
                  {/* Sliding background indicator */}
                  <div
                    className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-cyan-600 shadow-sm transition-all duration-300 ${
                      syncDirection === "forward" ? "left-[calc(50%+2px)]" : "left-1"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setSyncDirection("reverse")}
                    className={`relative z-10 flex-1 py-1.5 px-2 text-xs font-medium transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5 min-w-0 ${
                      syncDirection === "reverse" ? "text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <span className="shrink-0">🔄</span>
                    <span className="truncate">Cloud ➔ App</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSyncDirection("forward")}
                    className={`relative z-10 flex-1 py-1.5 px-2 text-xs font-medium transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5 min-w-0 ${
                      syncDirection === "forward" ? "text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <span className="shrink-0">🚀</span>
                    <span className="truncate">App ➔ Cloud</span>
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-normal leading-relaxed pt-0.5">
                  {syncDirection === "reverse"
                    ? "👉 Pulls all folders and media from cloud storage into the App Media Hub."
                    : "👉 Pushes all locally created events, photo folders, and assets from App database up to Cloud."}
                </p>
              </div>
            </div>

            {/* ── SECTION 2: VIDEO STREAM & HIGHLIGHTS SYNC ENGINE ── */}
            <div className="flex flex-col gap-3.5 p-4 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              {/* Text Block (Placed Full Width Above Button) */}
              <div className="flex items-start space-x-3 w-full">
                <div className="p-2 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 rounded-xl shrink-0 mt-0.5">
                  <Video className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm sm:text-base text-slate-900 dark:text-white font-semibold leading-snug">
                    Video Stream & Highlights Sync Engine
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Sync video recordings, clips, and highlights directly with event media
                  </p>
                </div>
              </div>

              {/* Compact Button (Placed Below Text) */}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={handleTriggerYouTubeSyncNow}
                  disabled={isYtSyncing}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-medium rounded-lg transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isYtSyncing ? "animate-spin" : ""}`} />
                  <span>{isYtSyncing ? "Syncing Videos..." : "Trigger Video Sync"}</span>
                </button>
              </div>

              {/* Sync Direction Sliding Toggle Switch */}
              <div className="flex flex-col space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide">
                  VIDEO SYNC DIRECTION
                </label>
                <div className="relative flex items-center p-1 bg-slate-200 dark:bg-slate-900 rounded-xl w-full sm:max-w-sm border border-slate-300 dark:border-slate-800/80 shadow-inner">
                  {/* Sliding background indicator */}
                  <div
                    className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-red-600 shadow-sm transition-all duration-300 ${
                      ytSyncDirection === "forward" ? "left-[calc(50%+2px)]" : "left-1"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setYtSyncDirection("reverse")}
                    className={`relative z-10 flex-1 py-1.5 px-2 text-xs font-medium transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5 min-w-0 ${
                      ytSyncDirection === "reverse" ? "text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <span className="shrink-0">🔄</span>
                    <span className="truncate">Stream ➔ App</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setYtSyncDirection("forward")}
                    className={`relative z-10 flex-1 py-1.5 px-2 text-xs font-medium transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5 min-w-0 ${
                      ytSyncDirection === "forward" ? "text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <span className="shrink-0">🚀</span>
                    <span className="truncate">App ➔ Stream</span>
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-normal leading-relaxed pt-0.5">
                  {ytSyncDirection === "reverse"
                    ? "👉 Pulls all video clips, recordings, and highlights directly into Team Taraba River Event media folders."
                    : "👉 Forward syncs local video links and video metadata up to the video stream."}
                </p>
              </div>
            </div>

            {/* ── CARD FOOTER ── */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5 shrink-0">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Last Sync: {cloudConfig.lastSyncedAt ? new Date(cloudConfig.lastSyncedAt).toLocaleString() : "Never"}</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                <span className="shrink-0">⚡</span>
                <span>Auto 1-Hour Firestore Cleanup Active</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Event Modal */}
      <CreateEventModal
        isOpen={createEventModalOpen}
        onClose={() => {
          setCreateEventModalOpen(false);
          setEditingEvent(null);
        }}
        currentUser={currentUser}
        eventToEdit={editingEvent}
        onSuccess={onRefreshData}
      />
    </div>
  );
};
