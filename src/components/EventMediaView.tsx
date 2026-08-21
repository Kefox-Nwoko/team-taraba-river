import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { logger } from "../lib/logger";
import { GroupEvent, Member } from "../types";
import { FullPageMediaUpload } from "./FullPageMediaUpload";
import { DatePicker } from "./DatePicker";
import { ReturnButton } from "./ReturnButton";
import { FirebaseSyncManager } from "../services/firebaseService";
import { AppStateManager } from "../services/storage";
import { deleteEvent as deleteEventApi, updateEvent } from "../services/apiClient";
import {
  FolderOpen,
  Folder,
  FileImage,
  Video,
  Play,
  Search,
  Grid,
  List,
  RefreshCw,
  X,
  ChevronRight,
  ChevronLeft,
  Calendar,
  MapPin,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Upload,
  ArrowLeft,
  Trash2,
  Move,
  Edit3,
  ChevronDown,
} from "lucide-react";

interface EventMediaViewProps {
  events: GroupEvent[];
  currentUser: Member | null;
  onBackToDashboard?: () => void;
  originatingPageName?: string;
  onRefreshEvents?: () => void;
  syncStatus?: "idle" | "syncing" | "success" | "error";
  syncAttemptCount?: number;
  syncErrorMessage?: string | null;
}

function extractYouTubeId(url?: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function getYouTubeThumbnail(url?: string): string | null {
  const id = extractYouTubeId(url);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

function handleGoogleDriveImageError(e: React.SyntheticEvent<HTMLImageElement, Event>): void {
  const img = e.currentTarget;
  const currentUrl = img.src;

  const attemptCount = parseInt((img as any).dataset?.fallbackAttempt || "0", 10);
  if (attemptCount >= 4) {
    return;
  }
  if ((img as any).dataset) (img as any).dataset.fallbackAttempt = String(attemptCount + 1);

  let fileId: string | null = null;

  // Extract file ID from various Drive URL formats
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
      // Tier 1: Google UserContent CDN host
      img.src = `https://lh3.googleusercontent.com/d/${fileId}`;
    } else if (attemptCount === 1) {
      // Tier 2: Authenticated backend streaming proxy
      img.src = `/api/media/image/${fileId}`;
    } else if (attemptCount === 2) {
      // Tier 3: Drive thumbnail
      img.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    } else if (attemptCount === 3) {
      // Tier 4: Direct UC export
      img.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
  }
}

function parseDateFromTitle(title: string): string | null {
  if (!title) return null;
  const months: { [key: string]: number } = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };
  const regex = new RegExp(`(${Object.keys(months).join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s*(\\d{4})`, 'i');
  const match = title.match(regex);
  if (match) {
    const monthName = match[1].toLowerCase();
    const day = parseInt(match[2]);
    const year = parseInt(match[3]);
    const monthIndex = months[monthName];
    const mm = String(monthIndex + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }
  return null;
}

function sanitizeUIField(val: string | undefined): string {
  if (!val) return "";
  let clean = val;
  // Remove google drive or email mentions case-insensitively
  clean = clean.replace(/google\s*drive/gi, "");
  clean = clean.replace(/tarabateam@gmail\.com/gi, "");
  clean = clean.replace(/tarabateam/gi, "");
  // Clean up remaining dangling punctuation
  clean = clean.replace(/\(\s*\)/g, "");
  clean = clean.replace(/•\s*•/g, "•");
  clean = clean.replace(/\s+/g, " ").trim();
  // Remove trailing/leading bullet points or punctuation
  clean = clean.replace(/^[•\s,\-\|]+|[•\s,\-\|]+$/g, "").trim();
  const lower = clean.toLowerCase();
  if (!clean || lower === "sync" || lower === "official pipeline" || lower === "official cloud pipeline" || lower === "taraba river") {
    return "";
  }
  return clean;
}

const FolderCollagePreview: React.FC<{ images: string[]; youtubeVideoUrl?: string; eventTitle: string; heightClass?: string }> = ({
  images,
  youtubeVideoUrl,
  eventTitle,
  heightClass = "h-full w-full aspect-square",
}) => {
  const videoThumb = getYouTubeThumbnail(youtubeVideoUrl);
  const mediaList: Array<{ src: string; isVideo?: boolean }> = [];
  if (videoThumb) {
    mediaList.push({ src: videoThumb, isVideo: true });
  }
  images.forEach((img) => mediaList.push({ src: img }));

  const previewItems = mediaList.slice(0, 4);

  if (previewItems.length === 0) {
    return (
      <div className={`w-full ${heightClass} rounded-xl bg-slate-200/60 dark:bg-slate-800/60 flex items-center justify-center text-slate-400`}>
        <Folder className="w-8 h-8 text-cyan-600/60 dark:text-cyan-400/60" />
      </div>
    );
  }

  // 1 Image: Full size
  if (previewItems.length === 1) {
    return (
      <div className={`w-full ${heightClass} rounded-xl overflow-hidden bg-slate-900 relative`}>
        <div className="relative w-full h-full">
          <img
            src={previewItems[0].src}
            alt={`${eventTitle} preview 1`}
            className="w-full h-full object-cover"
            onError={handleGoogleDriveImageError}
            loading="lazy"
          />
          {previewItems[0].isVideo && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md">
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2 Images: 50/50 split (2 equal columns)
  if (previewItems.length === 2) {
    return (
      <div className={`w-full ${heightClass} rounded-xl overflow-hidden grid grid-cols-2 gap-0.5 bg-slate-900 relative`}>
        {previewItems.map((item, i) => (
          <div key={i} className="relative w-full h-full overflow-hidden">
            <img
              src={item.src}
              alt={`${eventTitle} preview ${i + 1}`}
              className="w-full h-full object-cover"
              onError={handleGoogleDriveImageError}
              loading="lazy"
            />
            {item.isVideo && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // 3 Images: Left column (top/bottom rows), Right column (stretched/row-span-2)
  if (previewItems.length === 3) {
    return (
      <div className={`w-full ${heightClass} rounded-xl overflow-hidden grid grid-cols-2 grid-rows-2 gap-0.5 bg-slate-900 relative`}>
        {/* Left Column, Row 1 */}
        <div className="relative w-full h-full overflow-hidden col-start-1 row-start-1">
          <img
            src={previewItems[0].src}
            alt={`${eventTitle} preview 1`}
            className="w-full h-full object-cover"
            onError={handleGoogleDriveImageError}
            loading="lazy"
          />
          {previewItems[0].isVideo && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md">
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              </div>
            </div>
          )}
        </div>

        {/* Right Column, spanning both rows (stretched vertically) */}
        <div className="relative w-full h-full overflow-hidden col-start-2 row-start-1 row-span-2">
          <img
            src={previewItems[1].src}
            alt={`${eventTitle} preview 2`}
            className="w-full h-full object-cover"
            onError={handleGoogleDriveImageError}
            loading="lazy"
          />
          {previewItems[1].isVideo && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md">
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              </div>
            </div>
          )}
        </div>

        {/* Left Column, Row 2 */}
        <div className="relative w-full h-full overflow-hidden col-start-1 row-start-2">
          <img
            src={previewItems[2].src}
            alt={`${eventTitle} preview 3`}
            className="w-full h-full object-cover"
            onError={handleGoogleDriveImageError}
            loading="lazy"
          />
          {previewItems[2].isVideo && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md">
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3 or 4 Images: Equal quadrants inside a 2x2 grid (1/4 size each) to avoid overshadowing
  return (
    <div className={`w-full ${heightClass} rounded-xl overflow-hidden grid grid-cols-2 grid-rows-2 gap-0.5 bg-slate-905 relative`}>
      {previewItems.map((item, i) => (
        <div key={i} className="relative w-full h-full overflow-hidden">
          <img
            src={item.src}
            alt={`${eventTitle} preview ${i + 1}`}
            className="w-full h-full object-cover"
            onError={handleGoogleDriveImageError}
            loading="lazy"
          />
          {item.isVideo && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md">
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export const EventMediaView: React.FC<EventMediaViewProps> = ({
  events,
  currentUser,
  onBackToDashboard,
  originatingPageName,
  onRefreshEvents,
  syncStatus = "idle",
  syncAttemptCount = 0,
  syncErrorMessage = null,
}) => {
  const mappedEvents = useMemo(() => {
    return (events || []).map((event) => {
      if (!event) return event;
      const parsedDate = parseDateFromTitle(event.title);
      if (parsedDate) {
        return { ...event, date: parsedDate };
      }
      return event;
    });
  }, [events]);

  const [selectedFolder, setSelectedFolder] = useState<GroupEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name" | "mediaCount">("newest");
  const [isFullPageUploadOpen, setIsFullPageUploadOpen] = useState(false);
  const [uploadFolderId, setUploadFolderId] = useState<string | undefined>(undefined);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [isMoveDropdownOpen, setIsMoveDropdownOpen] = useState(false);

  // Lightbox arrows fade-out timeout & slideshow autoplay
  const [showArrows, setShowArrows] = useState(true);
  const arrowsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetArrowsTimeout = useCallback(() => {
    setShowArrows(true);
    if (arrowsTimeoutRef.current) {
      clearTimeout(arrowsTimeoutRef.current);
    }
    arrowsTimeoutRef.current = setTimeout(() => {
      setShowArrows(false);
    }, 3000);
  }, []);

  const handleArrowMouseEnter = () => {
    if (arrowsTimeoutRef.current) {
      clearTimeout(arrowsTimeoutRef.current);
    }
    setShowArrows(true);
  };

  const handleArrowMouseLeave = () => {
    resetArrowsTimeout();
  };

  const [isEditingFolderInfo, setIsEditingFolderInfo] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editLocation, setEditLocation] = useState("");

  const { completedEvents } = useMemo(() => {
    const currentDateStr = new Date().toISOString().split("T")[0];
    const completed: GroupEvent[] = [];
    mappedEvents.forEach((event) => {
      if (!event) return;
      const hasMedia = (event.driveImageUrls && event.driveImageUrls.length > 0) || !!event.youtubeVideoUrl;
      if (event.date <= currentDateStr || hasMedia) {
        completed.push(event);
      }
    });
    return { completedEvents: completed };
  }, [mappedEvents]);

  const galleryItems = useMemo(() => {
    if (!selectedFolder) return [];
    const items: Array<{
      type: "photo" | "video";
      url: string;
      videoUrl?: string;
      title: string;
    }> = [];

    const ytThumb = getYouTubeThumbnail(selectedFolder.youtubeVideoUrl);
    if (selectedFolder.youtubeVideoUrl && ytThumb) {
      items.push({
        type: "video",
        url: ytThumb,
        videoUrl: selectedFolder.youtubeVideoUrl,
        title: selectedFolder.youtubeTitle || `${selectedFolder.title} Video Highlights`,
      });
    }

    (selectedFolder.driveImageUrls || []).forEach((imgUrl, i) => {
      items.push({
        type: "photo",
        url: imgUrl,
        title: `${selectedFolder.title} Photo ${i + 1}`,
      });
    });

    return items;
  }, [selectedFolder]);

  // Autoplay timer cleanup
  useEffect(() => {
    return () => {
      if (arrowsTimeoutRef.current) {
        clearTimeout(arrowsTimeoutRef.current);
      }
    };
  }, []);

  // Autoplay Slideshow: Industry standard is 5 seconds, which provides comfortable viewing time
  useEffect(() => {
    if (lightboxIndex === null) return;
    const currentItem = galleryItems[lightboxIndex];
    if (currentItem?.type === "video") return; // Do not auto-advance when watching videos

    const interval = setInterval(() => {
      setLightboxIndex((prev) => {
        if (prev === null) return null;
        return prev === galleryItems.length - 1 ? 0 : prev + 1;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [lightboxIndex, galleryItems]);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    resetArrowsTimeout();
  };

  const [isUploading, setIsUploading] = useState(false);

  if (isFullPageUploadOpen) {
    return (
      <FullPageMediaUpload
        events={mappedEvents}
        currentUser={currentUser}
        initialFolderId={uploadFolderId}
        onReturn={() => setIsFullPageUploadOpen(false)}
        onSuccess={(updatedEvent) => {
          setIsFullPageUploadOpen(false);
          if (onRefreshEvents) {
            onRefreshEvents();
          }
          if (updatedEvent) {
            setSelectedFolder(updatedEvent);
          }
        }}
      />
    );
  }

  const performDeleteFolder = async (folderId: string) => {
    try {
      await FirebaseSyncManager.deleteEvent(folderId);
      await deleteEventApi(folderId);
    } catch (err) {
      logger.warn("Delete folder notice", { error: err });
    }
    const current = AppStateManager.getEvents();
    const clean = current.filter((evt) => evt.id !== folderId);
    AppStateManager.saveEvents(clean);
    setSelectedFolder(null);
    if (onRefreshEvents) onRefreshEvents();
  };

  const handleDeleteFolder = async (folderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to permanently delete this media folder and all attached content?")) return;
    await performDeleteFolder(folderId);
  };

  const handleDeleteSingleAsset = async (assetUrl: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!selectedFolder) return;
    if (!window.confirm("Are you sure you want to remove this photo/video from this event folder?")) return;

    const updatedFolder: GroupEvent = {
      ...selectedFolder,
      driveImageUrls: (selectedFolder.driveImageUrls || []).filter((u) => u !== assetUrl),
      youtubeVideoUrl: selectedFolder.youtubeVideoUrl === assetUrl ? "" : selectedFolder.youtubeVideoUrl,
    };

    const isFolderEmpty = (updatedFolder.driveImageUrls || []).length === 0 && !updatedFolder.youtubeVideoUrl;

    if (isFolderEmpty) {
      alert("This folder has become empty and will be automatically deleted.");
      await performDeleteFolder(selectedFolder.id);
      return;
    }

    try {
      await FirebaseSyncManager.saveEvent(updatedFolder);
    } catch (err) {
      logger.warn("Update folder error", { error: err });
    }

    const current = AppStateManager.getEvents();
    const idx = current.findIndex((evt) => evt.id === selectedFolder.id);
    if (idx !== -1) current[idx] = updatedFolder;
    AppStateManager.saveEvents(current);
    setSelectedFolder(updatedFolder);
    setLightboxIndex(null);
    if (onRefreshEvents) onRefreshEvents();
  };

  const handleMoveAsset = async (assetUrl: string, destinationFolderId: string) => {
    if (!selectedFolder) return;
    
    // 1. Remove asset from current folder
    const sourceUpdatedFolder: GroupEvent = {
      ...selectedFolder,
      driveImageUrls: (selectedFolder.driveImageUrls || []).filter((u) => u !== assetUrl),
      youtubeVideoUrl: selectedFolder.youtubeVideoUrl === assetUrl ? "" : selectedFolder.youtubeVideoUrl,
    };
    
    // 2. Add asset to target folder
    const targetFolder = mappedEvents.find((e) => e.id === destinationFolderId);
    if (!targetFolder) return;
    const targetUpdatedFolder: GroupEvent = {
      ...targetFolder,
      driveImageUrls: [...(targetFolder.driveImageUrls || []), assetUrl],
    };
    
    const isSourceFolderEmpty = (sourceUpdatedFolder.driveImageUrls || []).length === 0 && !sourceUpdatedFolder.youtubeVideoUrl;
    
    try {
      if (isSourceFolderEmpty) {
        await FirebaseSyncManager.deleteEvent(selectedFolder.id);
        await deleteEventApi(selectedFolder.id);
      } else {
        await FirebaseSyncManager.saveEvent(sourceUpdatedFolder);
      }
      await FirebaseSyncManager.saveEvent(targetUpdatedFolder);
    } catch (err) {
      logger.warn("Transfer asset error", { error: err });
    }
    
    // Update local state storage
    const current = AppStateManager.getEvents();
    if (isSourceFolderEmpty) {
      const clean = current.filter((evt) => evt.id !== selectedFolder.id);
      const targetIdx = clean.findIndex((evt) => evt.id === destinationFolderId);
      if (targetIdx !== -1) clean[targetIdx] = targetUpdatedFolder;
      AppStateManager.saveEvents(clean);
      setSelectedFolder(null);
      alert(`Photo moved successfully. The source folder became empty and was automatically deleted.`);
    } else {
      const sourceIdx = current.findIndex((evt) => evt.id === selectedFolder.id);
      if (sourceIdx !== -1) current[sourceIdx] = sourceUpdatedFolder;
      const targetIdx = current.findIndex((evt) => evt.id === destinationFolderId);
      if (targetIdx !== -1) current[targetIdx] = targetUpdatedFolder;
      AppStateManager.saveEvents(current);
      setSelectedFolder(sourceUpdatedFolder);
    }
    
    setLightboxIndex(null);
    setIsMoveDropdownOpen(false);
    if (onRefreshEvents) onRefreshEvents();
  };

  const startEditingFolder = () => {
    if (!selectedFolder) return;
    setEditTitle(selectedFolder.title);
    setEditDate(selectedFolder.date);
    setEditLocation(selectedFolder.location || "");
    setIsEditingFolderInfo(true);
  };

  const handleSaveFolderInfo = async () => {
    if (!selectedFolder) return;
    if (!editTitle.trim()) {
      alert("Title is required.");
      return;
    }
    if (!editDate) {
      alert("Date is required.");
      return;
    }

    const updatedFolder: GroupEvent = {
      ...selectedFolder,
      title: editTitle.trim(),
      date: editDate,
      location: editLocation.trim(),
    };

    try {
      await updateEvent(selectedFolder.id, updatedFolder);
    } catch (err) {
      logger.warn("API event update error", { error: err });
      try {
        await FirebaseSyncManager.saveEvent(updatedFolder);
      } catch (fbErr) {
        logger.error("Direct Firestore update failed", fbErr);
        alert("Failed to update folder details.");
        return;
      }
    }

    const current = AppStateManager.getEvents();
    const idx = current.findIndex((evt) => evt.id === selectedFolder.id);
    if (idx !== -1) current[idx] = updatedFolder;
    AppStateManager.saveEvents(current);
    setSelectedFolder(updatedFolder);
    setIsEditingFolderInfo(false);
    if (onRefreshEvents) onRefreshEvents();
  };

  const filteredFolders = completedEvents
    .filter((event) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        (event.title || "").toLowerCase().includes(q) ||
        (event.location || "").toLowerCase().includes(q) ||
        (event.date || "").includes(q) ||
        (event.description && event.description.toLowerCase().includes(q));
      return matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === "newest") return (b.date || "").localeCompare(a.date || "");
      if (sortBy === "oldest") return (a.date || "").localeCompare(b.date || "");
      if (sortBy === "name") return (a.title || "").localeCompare(b.title || "");
      if (sortBy === "mediaCount") {
        const countA = (a.driveImageUrls?.length || 0) + (a.youtubeVideoUrl ? 1 : 0);
        const countB = (b.driveImageUrls?.length || 0) + (b.youtubeVideoUrl ? 1 : 0);
        return countB - countA;
      }
      return 0;
    });

  const formatDateLabel = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch { return dateStr; }
  };

  return (
    <div className="space-y-8 font-sans font-normal">
      {!selectedFolder ? (
        <div className="space-y-6">
          <div className="flex flex-row items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                <FolderOpen className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-sm sm:text-sm font-normal text-slate-900 dark:text-white">Media Hub</h1>
                <p className="text-sm sm:text-sm text-slate-600 dark:text-slate-300">Media Management</p>
              </div>
            </div>
            
            {/* Global Sync Status Indicator & Return Button */}
            <div className="flex items-center gap-3">
              {syncStatus === "syncing" && (
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-slate-800 text-white text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Syncing (Attempt {syncAttemptCount} of 5)...</span>
                </div>
              )}
              {syncStatus === "success" && (
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-emerald-900/50 text-emerald-400 border border-emerald-800/50 text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Sync Complete</span>
                </div>
              )}
              {syncStatus === "error" && (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-red-900/50 text-red-400 border border-red-800/50 text-xs">
                    <X className="w-4 h-4" />
                    <span>Sync Failed</span>
                  </div>
                  {syncErrorMessage && (
                    <span className="text-[10px] text-red-400 max-w-[200px] text-right">{syncErrorMessage}</span>
                  )}
                </div>
              )}
              {/* Upload Media Button */}
              <button
                onClick={() => {
                  setUploadFolderId(undefined);
                  setIsFullPageUploadOpen(true);
                }}
                className="shrink-0 px-3.5 py-2 rounded-2xl text-xs sm:text-sm transition-all flex items-center space-x-2 font-medium cursor-pointer min-h-[40px] bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white shadow-xs"
              >
                <Upload className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-white" />
                <span className="whitespace-nowrap font-medium">Upload Media</span>
              </button>
              {onBackToDashboard && (
                <button onClick={onBackToDashboard} className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full transition shadow-sm flex items-center justify-center cursor-pointer">
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          <div className="sticky top-[80px] sm:top-[92px] z-40 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="relative flex-1 w-full md:w-auto">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search event folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-10 py-3 text-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-white"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <div className="flex items-center bg-slate-200/60 dark:bg-slate-800/60 p-1 rounded-2xl">
                <button onClick={() => setViewMode("grid")} className={`p-2 rounded-xl transition ${viewMode === "grid" ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs" : "text-slate-600 dark:text-slate-400"}`}><Grid className="w-5 h-5" /></button>
                <button onClick={() => setViewMode("list")} className={`p-2 rounded-xl transition ${viewMode === "list" ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs" : "text-slate-600 dark:text-slate-400"}`}><List className="w-5 h-5" /></button>
              </div>
            </div>
          </div>

          {filteredFolders.length === 0 ? (
            <div className="py-16 text-center text-slate-500 dark:text-slate-400 text-sm">No completed event folders match your search filter.</div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredFolders.map((folder) => {
                const mediaCount = (folder.driveImageUrls?.length || 0) + (folder.youtubeVideoUrl ? 1 : 0);
                return (
                  <div
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder)}
                    className="group relative bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="aspect-video w-full overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800 relative">
                        <FolderCollagePreview
                          images={folder.driveImageUrls || []}
                          youtubeVideoUrl={folder.youtubeVideoUrl}
                          eventTitle={folder.title}
                          heightClass="h-full w-full"
                        />
                        <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-lg text-white text-[11px] font-medium flex items-center gap-1">
                          <FileImage className="w-3.5 h-3.5" />
                          <span>{mediaCount} items</span>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-cyan-600 transition truncate">
                          {folder.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatDateLabel(folder.date)}</span>
                          {sanitizeUIField(folder.location) ? (
                            <>
                              <span>•</span>
                              <span className="truncate">{sanitizeUIField(folder.location)}</span>
                            </>
                          ) : null}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFolders.map((folder) => {
                const mediaCount = (folder.driveImageUrls?.length || 0) + (folder.youtubeVideoUrl ? 1 : 0);
                return (
                  <div
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder)}
                    className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-center justify-between hover:border-cyan-500 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                        <FolderCollagePreview
                          images={folder.driveImageUrls || []}
                          youtubeVideoUrl={folder.youtubeVideoUrl}
                          eventTitle={folder.title}
                          heightClass="w-full h-full"
                        />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-medium text-sm text-slate-900 dark:text-white truncate">{folder.title}</h4>
                        <p className="text-xs text-slate-500">{formatDateLabel(folder.date)} • {mediaCount} items</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Folder Details View */
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
            {isEditingFolderInfo ? (
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 font-normal">Folder Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                      placeholder="Folder title"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-normal">Location (optional)</label>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                      placeholder="Event location"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs text-slate-500 font-normal">Date</label>
                    <div className="relative mt-1">
                      <div className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs cursor-pointer">
                        <span>{formatDateLabel(editDate)}</span>
                        <ChevronDown className="w-4 h-4 text-cyan-500 font-bold" />
                      </div>
                      <DatePicker
                        value={editDate}
                        onChange={setEditDate}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1.5">
                  <button
                    onClick={handleSaveFolderInfo}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-normal rounded-xl transition cursor-pointer"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setIsEditingFolderInfo(false)}
                    className="px-3.5 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-normal rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 w-full">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white tracking-tight">{selectedFolder.title}</h1>
                  {(currentUser?.role === "admin" || (currentUser && selectedFolder.createdById === currentUser.id)) && (
                    <button
                      onClick={startEditingFolder}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-cyan-600 transition cursor-pointer"
                      title="Edit folder information"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-sm font-normal text-slate-500 mt-1">
                  {formatDateLabel(selectedFolder.date)}
                  {sanitizeUIField(selectedFolder.location) ? ` • ${sanitizeUIField(selectedFolder.location)}` : ""}
                </p>
              </div>
            )}
            {!isEditingFolderInfo && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setUploadFolderId(selectedFolder.id);
                    setIsFullPageUploadOpen(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white text-xs font-medium rounded-xl transition flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
                  title="Upload more photos or videos to this folder"
                >
                  <Upload className="w-4 h-4" />
                  <span>Update / Add Media</span>
                </button>
                {(currentUser?.role === "admin" || (currentUser && selectedFolder.createdById === currentUser.id)) && (
                  <button
                    onClick={(e) => handleDeleteFolder(selectedFolder.id, e)}
                    className="px-3.5 py-2 bg-red-600/90 hover:bg-red-700 text-white text-xs font-normal rounded-xl transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                    title="Delete entire media folder"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Folder</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <h2 className="text-sm sm:text-sm font-normal text-slate-900 dark:text-white">Event Media Gallery ({galleryItems.length} Media Assets)</h2>
            {galleryItems.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <p className="text-slate-500 dark:text-slate-400 text-sm font-normal">No photos or videos uploaded for this event folder yet.</p>
                <button
                  onClick={() => {
                    setUploadFolderId(selectedFolder.id);
                    setIsFullPageUploadOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white text-xs font-medium transition cursor-pointer shadow-xs"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Media to this Folder</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                {galleryItems.map((item, i) => (
                  <div key={i} onClick={() => openLightbox(i)} className="group relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer aspect-square">
                    <img
                      src={item.url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={handleGoogleDriveImageError}
                    />
                    {item.type === "video" && (
                      <>
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                            <Play className="w-6 h-6 fill-current ml-0.5" />
                          </div>
                        </div>
                        <div className="absolute bottom-2 left-2 right-2 bg-slate-950/85 backdrop-blur-md px-2.5 py-1 rounded-lg text-white text-xs flex items-center justify-between font-normal">
                          <span className="truncate">VIDEO</span>
                          <span className="bg-red-600 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">YouTube</span>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Return Button Below the Last Card on the Left (50% Reduced Size, Non-bold) */}
          <div className="pt-2 flex justify-start">
            <button onClick={() => setSelectedFolder(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-normal text-xs transition cursor-pointer shadow-xs"
            >
              <ChevronLeft className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Back to Media Folders</span>
            </button>
          </div>
        </div>
      )}

      {/* Apple Media Player Standard Lightbox / Player Overlay */}
      {lightboxIndex !== null && galleryItems[lightboxIndex] && (
        <div 
          onMouseMove={resetArrowsTimeout}
          onTouchStart={resetArrowsTimeout}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col justify-between p-3 sm:p-5 animate-fadeIn select-none"
        >
          {/* Top Bar */}
          <div className="relative z-30 flex items-center justify-between w-full max-w-5xl mx-auto py-1.5 px-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md font-normal shrink-0">
            <div className="flex items-center space-x-3 min-w-0">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-normal uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">
                {galleryItems[lightboxIndex].type === "video" ? "YOUTUBE VIDEO" : "PHOTO"} {lightboxIndex + 1} OF {galleryItems.length}
              </span>
              <h3 className="text-sm sm:text-sm text-white font-normal truncate">{galleryItems[lightboxIndex].title}</h3>
            </div>
            <div className="flex items-center space-x-3 shrink-0">
              {galleryItems[lightboxIndex].type === "video" && galleryItems[lightboxIndex].videoUrl && (
                <a
                  href={`https://www.youtube.com/watch?v=${extractYouTubeId(galleryItems[lightboxIndex].videoUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-xs font-normal transition flex items-center space-x-1.5"
                  title="Trace & open exact YouTube video URL"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Trace YouTube Link</span>
                </a>
              )}
               {galleryItems[lightboxIndex].type === "photo" && (
                <button
                  onClick={() => setIsMoveDropdownOpen(true)}
                  className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-normal transition flex items-center space-x-1.5 cursor-pointer border border-slate-700/60"
                  title="Transfer image to another folder"
                >
                  <Move className="w-3.5 h-3.5" />
                  <span>Transfer Image to Folder</span>
                </button>
              )}
              {(currentUser?.role === "admin" || (currentUser && selectedFolder?.createdById === currentUser.id)) && (
                <button
                  onClick={(e) => handleDeleteSingleAsset(galleryItems[lightboxIndex].url, e)}
                  className="px-3 py-1 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-xs font-normal transition flex items-center space-x-1.5 cursor-pointer"
                  title="Delete this photo/video asset"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Asset</span>
                </button>
              )}
              <button onClick={() => setLightboxIndex(null)} className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white flex items-center justify-center transition cursor-pointer shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Media Player Viewport Container */}
          <div className="relative flex-1 flex flex-col items-center justify-center my-2 max-w-5xl mx-auto w-full min-h-0">
            {/* Left Nav Arrow - Overlaying the image stage inside screen boundaries */}
            <button onClick={() => setLightboxIndex((prev) => (prev !== null ? (prev === 0 ? galleryItems.length - 1 : prev - 1) : 0))}
              onMouseEnter={handleArrowMouseEnter}
              onMouseLeave={handleArrowMouseLeave}
              className={`absolute left-4 z-20 w-10 h-10 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white flex items-center justify-center border border-slate-700/60 cursor-pointer shadow-xl active:scale-95 transition-all duration-300 ${
                showArrows ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
              }`}
              aria-label="Previous image"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Media Screen Stage */}
            <div className="w-full flex-1 max-h-[62vh] flex items-center justify-center overflow-hidden">
              {galleryItems[lightboxIndex].type === "video" ? (
                <div className="w-full h-full aspect-video rounded-3xl overflow-hidden shadow-2xl border border-slate-800 bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${extractYouTubeId(galleryItems[lightboxIndex].videoUrl)}?autoplay=1`}
                    title={galleryItems[lightboxIndex].title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <img
                  src={galleryItems[lightboxIndex].url}
                  alt={galleryItems[lightboxIndex].title}
                  className="max-w-full max-h-[62vh] object-contain rounded-2xl shadow-2xl border border-slate-800/50"
                  onError={handleGoogleDriveImageError}
                />
              )}
            </div>

            {/* Right Nav Arrow - Overlaying the image stage inside screen boundaries */}
            <button onClick={() => setLightboxIndex((prev) => (prev !== null ? (prev === galleryItems.length - 1 ? 0 : prev + 1) : 0))}
              onMouseEnter={handleArrowMouseEnter}
              onMouseLeave={handleArrowMouseLeave}
              className={`absolute right-4 z-20 w-10 h-10 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white flex items-center justify-center border border-slate-700/60 cursor-pointer shadow-xl active:scale-95 transition-all duration-300 ${
                showArrows ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
              }`}
              aria-label="Next image"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Control Bar DIRECTLY Under Screen (Return Button Reduced by 50% + Image Thumbnails) */}
            <div className="w-full z-10 flex flex-col sm:flex-row items-center justify-between gap-3 mt-3 py-2 px-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/90 backdrop-blur-md">
              {/* Return Button - Reduced 50% Size, Left Side */}
              <button onClick={() => setLightboxIndex(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/60 font-normal text-xs transition cursor-pointer shrink-0 shadow-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-teal-400" />
                <span>Return to Gallery</span>
              </button>

              {/* Set of Thumbnails Directly Under Screen */}
              <div className="flex items-center gap-2 overflow-x-auto py-0.5 max-w-full">
                {galleryItems.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => setLightboxIndex(idx)}
                    className={`relative w-12 h-8 rounded-md overflow-hidden cursor-pointer border transition-all shrink-0 ${
                      idx === lightboxIndex ? "border-teal-400 scale-105 shadow-md" : "border-slate-800 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={item.url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" onError={handleGoogleDriveImageError} />
                    {item.type === "video" && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Play className="w-2.5 h-2.5 text-white fill-current" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Move Photo Modal Sidebar */}
          {isMoveDropdownOpen && (
            <div className="fixed right-4 sm:right-6 top-1/2 -translate-y-1/2 z-[100] w-[calc(100%-2rem)] sm:w-80 bg-slate-900/95 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 text-left select-none animate-fadeIn backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="text-sm font-normal text-white">Transfer Image to Folder</h4>
                <button
                  onClick={() => setIsMoveDropdownOpen(false)}
                  className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg hover:bg-slate-850"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                <div className="px-2 py-1 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                  Choose target folder:
                </div>
                {mappedEvents
                  .filter((e) => e.id !== selectedFolder?.id && !e.id.startsWith("evt_arch_"))
                  .map((evt) => (
                    <button
                      key={evt.id}
                      onClick={() => handleMoveAsset(galleryItems[lightboxIndex].url, evt.id)}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 transition truncate block font-normal cursor-pointer"
                      title={evt.title}
                    >
                      📁 {evt.title}
                    </button>
                  ))}
                {mappedEvents.filter((e) => e.id !== selectedFolder?.id && !e.id.startsWith("evt_arch_")).length === 0 && (
                  <div className="text-center py-4 text-xs text-slate-500 italic">
                    No other folders available
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
