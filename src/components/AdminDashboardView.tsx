import React, { useState } from "react";
import { logger } from "../lib/logger";
import { clientConfig } from "../lib/config";
import { Member, PhotoApprovalRequest, GroupEvent } from "../types";
import { MemberDirectoryView } from "./MemberDirectoryView";
import { AppStateManager } from "../services/storage";
import { FirebaseSyncManager } from "../services/firebaseService";
import { triggerCloudSyncAll, triggerYouTubeBackSync, resetSystemData } from "../services/apiClient";
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
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Cloud Config State
  const [cloudConfig, setCloudConfig] = useState(() => AppStateManager.getCloudMediaConfig());
  const [driveUrlInput, setDriveUrlInput] = useState(() => cloudConfig.dedicatedDriveUrl);
  const [youtubeUrlInput, setYoutubeUrlInput] = useState(() => cloudConfig.dedicatedYoutubeUrl);
  const [cloudSaveMessage, setCloudSaveMessage] = useState<string | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [syncDirection, setSyncDirection] = useState<"reverse" | "forward">("forward");

  const fetchApprovals = async () => {
    try {
      const local = AppStateManager.getApprovals();
      setPendingApprovals(local.filter((r) => r.status === "pending"));
    } catch (e) {
      logger.warn("Admin fetch approvals notice", { error: e });
    }
  };

  React.useEffect(() => {
    fetchApprovals();
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchApprovals();
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
        ? "🔄 Connecting to Google Drive API... Pulling folders and images..."
        : "🔄 Connecting to Google Drive API... Pushing events and local assets..."
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
        ? "🔄 Connecting to YouTube API... Direct back-syncing video clips & shorts..."
        : "🚀 Syncing local event video metadata up to YouTube..."
    );
    try {
      const res = await triggerYouTubeBackSync();
      if (res && res.events) {
        AppStateManager.saveEvents(res.events);
      }
      onRefreshData();
      const syncMsg = (res as any).message || "YouTube sync complete!";
      setYtSyncMessage(`⚡ ${syncMsg}`);
    } catch (e: any) {
      const errMsg = e?.message || "YouTube sync encountered an issue.";
      setYtSyncMessage(`⚠️ ${errMsg}`);
    } finally {
      setTimeout(() => {
        setIsYtSyncing(false);
        setTimeout(() => setYtSyncMessage(null), 8000);
      }, 1500);
    }
  };

  const handleApprovePhoto = async (req: PhotoApprovalRequest) => {
    const updated: PhotoApprovalRequest = { ...req, status: "approved" };
    try {
      await FirebaseSyncManager.saveApproval(updated);
    } catch (e) {
      logger.warn("Admin fetch approvals notice", { error: e });
    }
    const current = AppStateManager.getApprovals();
    const idx = current.findIndex((r) => r.id === req.id);
    if (idx !== -1) current[idx] = updated;
    else current.push(updated);
    AppStateManager.saveApprovals(current);

    // Award activity points to the uploading member
    const memIdx = members.findIndex((m) => m.id === req.memberId);
    if (memIdx !== -1) {
      if (members[memIdx].role !== "admin") {
        members[memIdx].activityPoints = (members[memIdx].activityPoints || 0) + 30;
      }
      AppStateManager.saveMembers(members);
    }

    const allEvents = AppStateManager.getEvents();
    let targetEvt = req.eventId ? allEvents.find((e) => e.id === req.eventId) : undefined;

    if (targetEvt) {
      // Event exists — add the approved photo/video to it
      if (req.type === "video") {
        targetEvt.youtubeVideoUrl = req.photoUrl;
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
        location: req.location || "Taraba State",
        category: req.category || "cleanup",
        description: req.description || `Archival media collection for ${req.folderName || "Community Event"}.`,
        driveImageUrls: req.type === "photo" ? [req.photoUrl] : [],
        driveFolderId: `drive_folder_${Date.now()}`,
        youtubeVideoUrl: req.type === "video" ? req.photoUrl : "",
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

    setPendingApprovals((prev) => prev.filter((r) => r.id !== req.id));
    onRefreshData();
  };

  const handleRejectPhoto = async (req: PhotoApprovalRequest) => {
    const updated: PhotoApprovalRequest = { ...req, status: "rejected" };
    try {
      await FirebaseSyncManager.saveApproval(updated);
    } catch (e) {
      logger.warn("Admin fetch approvals notice", { error: e });
    }
    const current = AppStateManager.getApprovals();
    const idx = current.findIndex((r) => r.id === req.id);
    if (idx !== -1) current[idx] = updated;
    else current.push(updated);
    AppStateManager.saveApprovals(current);

    const allEvents = AppStateManager.getEvents();
    let targetEvt = req.eventId
      ? allEvents.find((e) => e.id === req.eventId)
      : allEvents.find((e) => (e.driveImageUrls || []).includes(req.photoUrl) || e.youtubeVideoUrl === req.photoUrl);

    if (targetEvt) {
      if (req.type === "video" && targetEvt.youtubeVideoUrl === req.photoUrl) {
        targetEvt.youtubeVideoUrl = "";
      } else if (req.type === "photo") {
        targetEvt.driveImageUrls = (targetEvt.driveImageUrls || []).filter((u) => u !== req.photoUrl);
      }

      // If the event now has no media and was created specifically for this upload batch, clean it up
      if ((targetEvt.driveImageUrls || []).length === 0 && !targetEvt.youtubeVideoUrl && targetEvt.id.startsWith("evt_folder_")) {
        const remainingEvents = allEvents.filter((e) => e.id !== targetEvt!.id);
        AppStateManager.saveEvents(remainingEvents);
        try {
          await FirebaseSyncManager.saveEvent(targetEvt);
        } catch (e) {}
      } else {
        AppStateManager.saveEvents(allEvents);
        try {
          await FirebaseSyncManager.saveEvent(targetEvt);
        } catch (e) {}
      }
    }

    setPendingApprovals((prev) => prev.filter((r) => r.id !== req.id));
    onRefreshData();
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

  const getMemberName = (id: string): string => {
    const m = members.find((mem) => mem.id === id);
    return m ? m.fullName : id;
  };

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

      {/* Navigation Sub-Tabs Bar - Mobile-First Flexbox Horizontal Scroll / Wrap */}
      <div className="flex flex-nowrap overflow-x-auto sm:flex-wrap items-center gap-2 pb-2 sm:pb-0 w-full no-scrollbar font-normal border-b border-slate-100 dark:border-slate-800/60 sm:border-0">
        <button onClick={() => setActiveTab("directory")}
          className={`shrink-0 px-3.5 py-2 rounded-2xl text-xs sm:text-sm transition-all flex items-center space-x-2 font-medium cursor-pointer min-h-[40px] ${
            activeTab === "directory"
              ? "bg-teal-700 text-white shadow-md shadow-teal-700/20"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Users className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span className="whitespace-nowrap">Members Directory</span>
        </button>

        <button onClick={() => setActiveTab("rsvps")}
          className={`shrink-0 px-3.5 py-2 rounded-2xl text-xs sm:text-sm transition-all flex items-center space-x-2 font-medium cursor-pointer min-h-[40px] ${
            activeTab === "rsvps"
              ? "bg-teal-700 text-white shadow-md shadow-teal-700/20"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Calendar className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span className="whitespace-nowrap">Events</span>
        </button>

        <button onClick={() => setActiveTab("analytics")}
          className={`shrink-0 px-3.5 py-2 rounded-2xl text-xs sm:text-sm transition-all flex items-center space-x-2 font-medium cursor-pointer min-h-[40px] ${
            activeTab === "analytics"
              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Award className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span className="whitespace-nowrap">Top Engagement</span>
        </button>

        <button onClick={() => setActiveTab("moderation")}
          className={`shrink-0 relative px-3.5 py-2 rounded-2xl text-xs sm:text-sm transition-all flex items-center space-x-2 font-medium cursor-pointer min-h-[40px] ${
            activeTab === "moderation"
              ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Clock className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span className="whitespace-nowrap">Media Moderation</span>
          {pendingApprovals.length > 0 && (
            <span className="bg-red-500 text-white text-[11px] px-2 py-0.5 rounded-full font-bold ml-1">
              {pendingApprovals.length}
            </span>
          )}
        </button>

        <button onClick={() => setActiveTab("cloud_settings")}
          className={`shrink-0 px-3.5 py-2 rounded-2xl text-xs sm:text-sm transition-all flex items-center space-x-2 font-medium cursor-pointer min-h-[40px] ${
            activeTab === "cloud_settings"
              ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-cyan-400" />
          <span className="whitespace-nowrap">Cloud Media Integration</span>
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

      {/* TAB 1: EVENTS */}
      {activeTab === "rsvps" && (
        <div className="space-y-8 font-normal">
          {/* Section 1: Create Events */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-sm sm:text-sm text-slate-900 dark:text-white font-normal">
                  Create Events
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-normal">
                  Publish new group events for community members to RSVP
                </p>
              </div>
              <button
                onClick={() => setCreateEventModalOpen(true)}
                className={`shrink-0 px-3.5 py-2 rounded-2xl text-xs sm:text-sm transition-all flex items-center space-x-2 font-medium cursor-pointer min-h-[40px] ${
                  activeTab === "rsvps"
                    ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20"
                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Plus className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${activeTab === "rsvps" ? "text-white" : "text-cyan-400"}`} />
                <span className="whitespace-nowrap">Create Event</span>
              </button>
            </div>
          </div>

          {/* Section 2: Member RSVP/Attendance Board */}
          <div className="py-6 sm:py-8 space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-sm sm:text-sm text-slate-900 dark:text-white font-normal">
                Member RSVP/Attendance Board</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-normal">
                Real-time tracking of member responses (Yes, Maybe, No) per event</p>
            </div>

            {(() => {
              const today = new Date();
              const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
              const activeEvents = events.filter(evt => evt.date >= todayStr);

              if (activeEvents.length === 0) {
                return (
                  <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm font-normal">
                    No active events currently published.
                  </div>
                );
              }

              return (
                <div className="space-y-8 font-normal">
                  {activeEvents.map((evt) => {
                    const yesIds = evt.attendeeIds || [];
                  const maybeIds = evt.maybeIds || [];
                  const noIds = evt.declinedIds || [];

                  return (
                    <div
                      key={evt.id}
                      className="bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-6 font-normal"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-4">
                        <div className="w-full md:w-auto md:flex-1 order-1 md:order-none">
                          <h3 className="text-sm font-normal text-slate-900 dark:text-white">
                            {evt.title}
                          </h3>
                          {/* Desktop details position */}
                          <p className="hidden md:block text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {evt.date} • {evt.time} • {evt.location}
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-4 sm:gap-6 md:gap-3 text-sm font-normal w-full md:w-auto py-1 md:py-0 order-2 md:order-none">
                          <span className="px-6 md:px-3.5 py-1.5 md:py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-center flex-1 md:flex-none shadow-sm md:shadow-none">
                            Yes: {yesIds.length}
                          </span>
                          <span className="px-6 md:px-3.5 py-1.5 md:py-1 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-center flex-1 md:flex-none shadow-sm md:shadow-none">
                            Maybe: {maybeIds.length}
                          </span>
                          <span className="px-6 md:px-3.5 py-1.5 md:py-1 rounded-xl bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800 text-center flex-1 md:flex-none shadow-sm md:shadow-none">
                            No: {noIds.length}
                          </span>
                        </div>
                        {/* Mobile details position */}
                        <div className="w-full md:hidden order-3">
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {evt.date} • {evt.time} • {evt.location}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-normal">
                        {/* Yes Column */}
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 space-y-3">
                          <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="text-sm font-normal">Yes ({yesIds.length})</span>
                          </div>
                          {yesIds.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No responses yet.</p>
                          ) : (
                            <ul className="space-y-1.5 text-sm text-slate-800 dark:text-slate-200">
                              {yesIds.map((id) => (
                                <li key={id} className="flex items-center space-x-2">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                  <span>{getMemberName(id)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* Maybe Column */}
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-amber-200 dark:border-amber-900/50 space-y-3">
                          <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                            <HelpCircle className="w-5 h-5" />
                            <span className="text-sm font-normal">Maybe ({maybeIds.length})</span>
                          </div>
                          {maybeIds.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No responses yet.</p>
                          ) : (
                            <ul className="space-y-1.5 text-sm text-slate-800 dark:text-slate-200">
                              {maybeIds.map((id) => (
                                <li key={id} className="flex items-center space-x-2">
                                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                                  <span>{getMemberName(id)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {/* No Column */}
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-red-200 dark:border-red-900/50 space-y-3">
                          <div className="flex items-center space-x-2 text-red-700 dark:text-red-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                            <UserX className="w-5 h-5" />
                            <span className="text-sm font-normal">No ({noIds.length})</span>
                          </div>
                          {noIds.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No responses yet.</p>
                          ) : (
                            <ul className="space-y-1.5 text-sm text-slate-800 dark:text-slate-200">
                              {noIds.map((id) => (
                                <li key={id} className="flex items-center space-x-2">
                                  <span className="w-2 h-2 rounded-full bg-red-500" />
                                  <span>{getMemberName(id)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
        <div className="py-8 text-slate-900 dark:text-slate-100 space-y-6 transition-colors font-normal">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-sm text-slate-900 dark:text-white flex items-center space-x-2 font-normal">
                <Clock className="w-6 h-6 text-amber-500" />
                <span>Pending Events Photo and Video Submissions</span>
              </h3>
            </div>
          </div>

          {pendingApprovals.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm font-normal">
              No pending media uploads requiring review.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 font-normal">
              {pendingApprovals.map((req) => (
                <div key={req.id} className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
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

            {/* ── SECTION 1: GOOGLE DRIVE IMAGE SYNC ENGINE ── */}
            <div className="flex flex-col gap-3.5 p-4 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              {/* Text Block (Placed Full Width Above Button) */}
              <div className="flex items-start space-x-3 w-full">
                <div className="p-2 bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400 rounded-xl shrink-0 mt-0.5">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm sm:text-base text-slate-900 dark:text-white font-semibold leading-snug">
                    Google Drive Photo & Event Albums Sync Engine
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Bidirectional sync for Google Drive photos & event media
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
                  <span>{isCloudSyncing ? "Syncing Drive..." : "Trigger Cloud Sync"}</span>
                </button>
              </div>

              {/* Sync Direction Sliding Toggle Switch */}
              <div className="flex flex-col space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide">
                  GOOGLE DRIVE SYNC DIRECTION
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
                    <span className="truncate">Drive ➔ App</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSyncDirection("forward")}
                    className={`relative z-10 flex-1 py-1.5 px-2 text-xs font-medium transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5 min-w-0 ${
                      syncDirection === "forward" ? "text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <span className="shrink-0">🚀</span>
                    <span className="truncate">App ➔ Drive</span>
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-normal leading-relaxed pt-0.5">
                  {syncDirection === "reverse"
                    ? "👉 Pulls all folders and images from official Google Drive into the App Media Hub UI."
                    : "👉 Pushes all locally created events, photo folders, and assets from App database up to Google Drive."}
                </p>
              </div>
            </div>

            {/* ── SECTION 2: YOUTUBE VIDEO & SHORTS SYNC ENGINE ── */}
            <div className="flex flex-col gap-3.5 p-4 bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
              {/* Text Block (Placed Full Width Above Button) */}
              <div className="flex items-start space-x-3 w-full">
                <div className="p-2 bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 rounded-xl shrink-0 mt-0.5">
                  <Video className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm sm:text-base text-slate-900 dark:text-white font-semibold leading-snug">
                    YouTube Video & Shorts Sync Engine
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Reverse & Forward sync YouTube videos directly with event media
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
                  <span>{isYtSyncing ? "Syncing YouTube..." : "Trigger YouTube Sync"}</span>
                </button>
              </div>

              {/* Sync Direction Sliding Toggle Switch */}
              <div className="flex flex-col space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide">
                  YOUTUBE SYNC DIRECTION
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
                    <span className="truncate">YouTube ➔ App</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setYtSyncDirection("forward")}
                    className={`relative z-10 flex-1 py-1.5 px-2 text-xs font-medium transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5 min-w-0 ${
                      ytSyncDirection === "forward" ? "text-white" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <span className="shrink-0">🚀</span>
                    <span className="truncate">App ➔ YouTube</span>
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-normal leading-relaxed pt-0.5">
                  {ytSyncDirection === "reverse"
                    ? "👉 Pulls all YouTube short clips, videos, and channel uploads directly into Team Taraba River Event media folders."
                    : "👉 Forward syncs local YouTube video links and video metadata up to YouTube."}
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

      {/* Create Event Modal */}
      <CreateEventModal
        isOpen={createEventModalOpen}
        onClose={() => setCreateEventModalOpen(false)}
        currentUser={currentUser}
        onSuccess={onRefreshData}
      />
    </div>
  );
};
