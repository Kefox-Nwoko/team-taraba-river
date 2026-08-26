import React, { useState, useEffect, useRef } from "react";
import { DatePicker } from "./DatePicker";
import { logger } from "../lib/logger";
import { GroupEvent, Member } from "../types";
import { FirebaseSyncManager } from "../services/firebaseService";
import { storage } from "../lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { ReturnButton } from "./ReturnButton";
import { useToast } from "./ui/Toast";
import {
  Upload,
  FolderOpen,
  FolderPlus,
  Calendar,
  Loader2,
  CheckCircle2,
  X,
  ChevronDown,
  Play,
} from "lucide-react";
import { uploadVideoDirectToYouTube } from "../services/youtubeDirectUpload";

interface MediaItem {
  id: string;
  file: File;
  type: "photo" | "video";
  previewUrl: string;
  sizeMB: number;
  status: "ready";
}

interface FullPageMediaUploadProps {
  events: GroupEvent[];
  currentUser: Member | null;
  initialFolderId?: string;
  onReturn: () => void;
  onSuccess: (updatedEvent: GroupEvent | undefined) => void;
}

export const FullPageMediaUpload: React.FC<FullPageMediaUploadProps> = ({
  events,
  currentUser,
  initialFolderId,
  onReturn,
  onSuccess,
}) => {
  const { notify } = useToast();
  const [folderMode, setFolderMode] = useState<"existing" | "new">(
    initialFolderId ? "existing" : "new"
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    initialFolderId || (events && events.length > 0 ? events[0].id : "")
  );
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newCategory, setNewCategory] = useState<GroupEvent["category"]>("cleanup");
  const [newLocation, setNewLocation] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const formatDateLabel = (dateStr?: string) => {
    if (!dateStr) return "Select Date";
    try {
      const parts = dateStr.split("-");
      if (parts.length < 3) return dateStr;
      const [year, month, day] = parts;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr || "Select Date";
    }
  };

  useEffect(() => {
    if (initialFolderId) {
      setSelectedFolderId(initialFolderId);
      setFolderMode("existing");
    } else if (events && events.length > 0 && !selectedFolderId) {
      setSelectedFolderId(events[0].id);
    }
  }, [initialFolderId, events, selectedFolderId]);

  const compressAndConvertToWebpBlob = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 1280;
          const MAX_HEIGHT = 960;
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas context unavailable"));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error("Failed to convert image to WebP blob"));
            },
            "image/webp",
            0.82
          );
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });
  };

  const uploadMediaFileWithProgress = async (
    item: MediaItem,
    eventId: string,
    folderName: string,
    index: number,
    onFileProgress: (percent: number) => void
  ): Promise<string> => {
    const isVideo = item.type === "video";

    // 1. For Videos: Stream directly to YouTube Channel with real-time resumable chunks
    if (isVideo) {
      const ytUrl = await uploadVideoDirectToYouTube(item.file, folderName, onFileProgress);
      return ytUrl;
    }

    // 2. For Photos (WebP compressed) or Video Fallback
    let uploadPayload: Blob = item.file;
    let contentType = item.file.type || (isVideo ? "video/mp4" : "image/jpeg");
    let ext = isVideo ? "mp4" : "webp";

    if (!isVideo) {
      try {
        uploadPayload = await compressAndConvertToWebpBlob(item.file);
        contentType = "image/webp";
        ext = "webp";
      } catch {
        uploadPayload = item.file;
      }
    }

    return new Promise((resolve, reject) => {
      const cleanName = (item.file.name.replace(/\.[^/.]+$/, "") || `media_${index + 1}`).replace(/[^a-zA-Z0-9._-]/g, "_");
      const folderPath = isVideo ? "videos" : "photos";
      const storageRef = ref(storage, `events/${eventId}/${folderPath}/${Date.now()}_${index + 1}_${cleanName}.${ext}`);
      const uploadTask = uploadBytesResumable(storageRef, uploadPayload, {
        contentType,
      });

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            const pct = Math.min(99, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
            onFileProgress(pct);
          }
        },
        (error) => {
          logger.error("Cloud storage upload error", error);
          reject(error);
        },
        async () => {
          try {
            onFileProgress(100);
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadUrl);
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMessage(null);
    const newItems: MediaItem[] = [];
    let addedSizeMB = 0;
    const MAX_BATCH_SIZE_MB = 300;

    Array.from(files).forEach((file) => {
      const filename = (file.name || "").toLowerCase();
      const isVideoExt = /\.(mp4|mov|avi|mkv|webm|3gp|3gpp|m4v|wmv|flv|ts|mts|m2ts|ogv|vob|qt)$/i.test(filename);
      const isPhotoExt = /\.(jpe?g|png|gif|webp|heic|heif|bmp|svg|tiff|raw|cr2|nef)$/i.test(filename);

      const isVideo = (file.type && file.type.startsWith("video/")) || isVideoExt;
      const isPhoto = (file.type && file.type.startsWith("image/")) || isPhotoExt;

      if (!isVideo && !isPhoto) {
        return;
      }

      const sizeMB = file.size / (1024 * 1024);
      addedSizeMB += sizeMB;
      const previewUrl = URL.createObjectURL(file);
      newItems.push({
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        type: isVideo ? "video" : "photo",
        previewUrl,
        sizeMB: parseFloat(sizeMB.toFixed(2)),
        status: "ready",
      });
    });

    const currentTotalSize = mediaItems.reduce((acc, it) => acc + it.sizeMB, 0);
    if (currentTotalSize + addedSizeMB > MAX_BATCH_SIZE_MB) {
      setErrorMessage(`Upload batch (${(currentTotalSize + addedSizeMB).toFixed(1)} MB) exceeds ${MAX_BATCH_SIZE_MB}MB limit. Please select fewer files.`);
      return;
    }

    setMediaItems((prev) => [...prev, ...newItems]);
  };

  const handleRemoveItem = (id: string) => {
    setMediaItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const totalBatchSizeMB = mediaItems.reduce((acc, it) => acc + (it.sizeMB || 0), 0);

  const isFormValid =
    (folderMode === "existing" ? !!selectedFolderId : !!newFolderTitle.trim() && !!newDate) &&
    mediaItems.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mediaItems.length === 0) {
      setErrorMessage("Please select photos or videos to upload.");
      return;
    }
    if (folderMode === "new" && !newFolderTitle.trim()) {
      setErrorMessage("Please enter an event folder title.");
      return;
    }
    if (folderMode === "existing" && !selectedFolderId) {
      setErrorMessage("Please select an existing event folder.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);
    setUploadProgressText("Initializing media upload...");
    setErrorMessage(null);

    const folderNameTitle = folderMode === "new"
      ? newFolderTitle.trim()
      : (events.find((e) => e.id === selectedFolderId)?.title || "Event Gallery");
    const eventId = folderMode === "new" ? `evt_${Date.now()}` : selectedFolderId;
    const folderEventDate = folderMode === "new" ? newDate : (events.find((e) => e.id === selectedFolderId)?.date || newDate);
    const folderLocation = folderMode === "new" ? newLocation.trim() : (events.find((e) => e.id === selectedFolderId)?.location || "");
    const folderCategory = folderMode === "new" ? newCategory : (events.find((e) => e.id === selectedFolderId)?.category || "cleanup");
    const folderDescription = folderMode === "new" ? newDescription.trim() : (events.find((e) => e.id === selectedFolderId)?.description || "");
    const isAdmin = currentUser?.role === "admin";

    // ──────────────────────────────────────────────────────────────────
    // FAULT-TOLERANT UPLOAD: Each file is independent — one failure
    // does NOT kill the others. Results are tracked per-file.
    // ──────────────────────────────────────────────────────────────────
    const photoFinalUrls: string[] = [];
    const videoFinalUrls: string[] = [];
    const failedFiles: Array<{ name: string; reason: string }> = [];

    const fileProgresses = new Array(mediaItems.length).fill(0);
    const updateOverallProgress = () => {
      const totalPct = fileProgresses.reduce((a, b) => a + b, 0) / (mediaItems.length || 1);
      const overall = Math.round(10 + totalPct * 0.8);
      setUploadProgress(Math.min(90, Math.max(10, overall)));
    };

    // Upload all files concurrently with per-file progress tracking
    const uploadPromises = mediaItems.map((item, i) => {
      const isVideo = item.type === "video";
      return (async () => {
        setUploadProgressText(
          `Uploading ${isVideo ? "video" : "photo"} ${i + 1} of ${mediaItems.length} (${item.file.name || "asset"})...`
        );
        const finalUrl = await uploadMediaFileWithProgress(item, eventId, folderNameTitle, i, (pct) => {
          fileProgresses[i] = pct;
          updateOverallProgress();
        });
        return { index: i, url: finalUrl, type: item.type, name: item.file.name };
      })();
    });

    const results = await Promise.allSettled(uploadPromises);

    // Process results — separate successes from failures
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const item = mediaItems[i];

      if (result.status === "fulfilled" && result.value.url) {
        const finalUrl = result.value.url;
        if (item.type === "video") {
          videoFinalUrls.push(finalUrl);
        } else {
          photoFinalUrls.push(finalUrl);
        }

        // Save approval for non-admin members immediately
        if (!isAdmin) {
          try {
            await FirebaseSyncManager.saveApproval({
              id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              memberId: currentUser?.id || "mem_guest",
              memberName: currentUser?.fullName || "Community Member",
              memberEmail: currentUser?.email || "member@tarabateam.org",
              photoUrl: finalUrl,
              uploadedAt: new Date().toISOString(),
              status: "pending",
              adminNotes: `${item.type === "video" ? "Video" : "Photo"} submission for folder: ${folderNameTitle}`,
              type: item.type === "video" ? "video" : "photo",
              eventId,
              folderName: folderNameTitle,
              date: folderEventDate,
              location: folderLocation,
              category: folderCategory,
              description: folderDescription,
            });
          } catch (syncErr) {
            logger.warn("Per-item approval save notice:", syncErr);
          }
        }
      } else {
        const reason = result.status === "rejected"
          ? (result.reason?.message || result.reason || "Unknown error")
          : "No URL returned";
        failedFiles.push({ name: item.file.name || `File ${i + 1}`, reason: String(reason) });
        logger.error(`Upload failed for item ${i + 1} (${item.file.name}):`, reason);
      }
    }

    // ──────────────────────────────────────────────────────────────────
    // SAVE EVENT: Register all successful uploads to the event folder.
    // Runs even if some files failed — successful files are still saved.
    // Admin uploads are published directly (no approval queue).
    // ──────────────────────────────────────────────────────────────────
    const totalSucceeded = photoFinalUrls.length + videoFinalUrls.length;

    if (totalSucceeded > 0) {
      setUploadProgressText("Registering media in Event Gallery...");
      setUploadProgress(95);

      try {
        let targetEvent: GroupEvent;
        if (folderMode === "existing") {
          const existingEvent = events.find((e) => e.id === selectedFolderId);
          if (!existingEvent) throw new Error("Selected existing event folder not found.");
          targetEvent = {
            ...existingEvent,
            driveImageUrls: isAdmin
              ? [...(existingEvent.driveImageUrls || []), ...photoFinalUrls]
              : (existingEvent.driveImageUrls || []),
            driveFolderId: existingEvent.driveFolderId || `drive_folder_${Date.now()}`,
            youtubeVideoUrl: isAdmin
              ? (videoFinalUrls[videoFinalUrls.length - 1] || existingEvent.youtubeVideoUrl || "")
              : (existingEvent.youtubeVideoUrl || ""),
            // Store ALL video URLs (not just the first one)
            youtubeVideoUrls: isAdmin
              ? [...((existingEvent as any).youtubeVideoUrls || (existingEvent.youtubeVideoUrl ? [existingEvent.youtubeVideoUrl] : [])), ...videoFinalUrls]
              : ((existingEvent as any).youtubeVideoUrls || (existingEvent.youtubeVideoUrl ? [existingEvent.youtubeVideoUrl] : [])),
          };
          // Admin: directly publish to Event Gallery (no approval needed)
          if (isAdmin) {
            await FirebaseSyncManager.saveEvent(targetEvent);
          }
        } else {
          targetEvent = {
            id: eventId,
            title: folderNameTitle,
            date: newDate,
            time: "09:00",
            location: newLocation.trim(),
            category: newCategory,
            description: newDescription.trim() || `Archival media collection for ${folderNameTitle}.`,
            driveImageUrls: isAdmin ? photoFinalUrls : [],
            driveFolderId: `drive_folder_${Date.now()}`,
            youtubeVideoUrl: isAdmin ? (videoFinalUrls[videoFinalUrls.length - 1] || "") : "",
            youtubeVideoUrls: isAdmin ? videoFinalUrls : [],
            createdBy: currentUser?.fullName || "Community Member",
            createdById: currentUser?.id || "mem_guest",
            attendeeIds: currentUser ? [currentUser.id] : [],
            maxCapacity: 100,
            createdAt: new Date().toISOString(),
          } as any;
          // Admin: directly publish new Event folder (no approval needed)
          if (isAdmin) {
            await FirebaseSyncManager.saveEvent(targetEvent);
          }
        }

        setUploadProgress(100);
        setIsUploading(false);

        // ──────────────────────────────────────────────────────────────
        // SMART NOTIFICATION: Shows exactly what succeeded and what failed
        // ──────────────────────────────────────────────────────────────
        if (failedFiles.length === 0) {
          // All files succeeded
          notify(
            isAdmin
              ? `✅ ${totalSucceeded} media item${totalSucceeded !== 1 ? "s" : ""} published to the Event Gallery.`
              : `✅ ${totalSucceeded} media item${totalSucceeded !== 1 ? "s" : ""} submitted for Admin review.`,
            "success"
          );
        } else {
          // Partial success — some succeeded, some failed
          const failReasons = failedFiles.map((f) => `"${f.name}"`).join(", ");
          notify(
            `⚠️ ${totalSucceeded} of ${mediaItems.length} uploaded successfully. Failed: ${failReasons}. ${failedFiles[0].reason}`,
            "info"
          );
        }

        // Reset form state
        mediaItems.forEach((it) => {
          try { URL.revokeObjectURL(it.previewUrl); } catch {}
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
        setMediaItems([]);
        setNewFolderTitle("");
        setNewLocation("");
        setNewDescription("");
        setNewDate(() => new Date().toISOString().split("T")[0]);
        setSelectedFolderId(initialFolderId || "");
        setFolderMode(initialFolderId ? "existing" : "new");
        setUploadProgress(0);
        setErrorMessage(null);

        onSuccess(targetEvent);
      } catch (saveErr) {
        logger.error("Event save error after successful uploads:", saveErr);
        const msg = saveErr instanceof Error ? saveErr.message : "Failed to register media in event gallery.";
        setErrorMessage(`Uploads completed but event save failed: ${msg}`);
        setUploadProgress(0);
        setIsUploading(false);
      }
    } else {
      // ALL files failed — show the error clearly
      const allReasons = failedFiles.map((f) => `"${f.name}": ${f.reason}`).join(" | ");
      setErrorMessage(`❌ All ${mediaItems.length} upload${mediaItems.length !== 1 ? "s" : ""} failed. ${allReasons}`);
      setUploadProgress(0);
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#121212] text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8 animate-fadeIn">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-row items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Upload className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              <span>Upload Media</span>
            </h1>
          </div>
          <div className="flex items-center space-x-3 shrink-0">
            {onReturn && <ReturnButton onClick={onReturn} />}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMessage && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs leading-relaxed">
              <p className="font-semibold mb-1">Upload Notice:</p>
              <p>{errorMessage}</p>
            </div>
          )}
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <span>1. Select or Create Event Folder & Upload Media</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFolderMode("new")}
                className={`p-3.5 rounded-2xl border text-left flex items-start space-x-3 cursor-pointer transition ${
                  folderMode === "new"
                    ? "border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/40 text-slate-900 dark:text-white shadow-xs"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
                }`}
              >
                <FolderPlus className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold">Create New Event Folder</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Start a new photo & video collection
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFolderMode("existing")}
                className={`p-3.5 rounded-2xl border text-left flex items-start space-x-3 cursor-pointer transition ${
                  folderMode === "existing"
                    ? "border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/40 text-slate-900 dark:text-white shadow-xs"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
                }`}
              >
                <FolderOpen className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold">Select Existing Event Folder</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Add media into an already published event
                  </div>
                </div>
              </button>
            </div>

            {folderMode === "new" ? (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs uppercase font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Event Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. URIP Taraba River Sports & Assembly"
                      value={newFolderTitle}
                      onChange={(e) => setNewFolderTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Date *
                    </label>
                    <div className="relative w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 flex items-center justify-between text-sm text-slate-900 dark:text-white cursor-pointer select-none">
                      <span className="truncate">{formatDateLabel(newDate)}</span>
                      <div className="flex items-center space-x-1 text-slate-400 dark:text-slate-500 shrink-0">
                        <Calendar className="w-4 h-4" />
                        <ChevronDown className="w-4 h-4 text-cyan-500" />
                      </div>
                      <DatePicker
                        value={newDate}
                        onChange={setNewDate}
                        required
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs uppercase font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Location (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Jalingo / Abuja / Port Harcourt"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <label className="block text-xs uppercase font-medium text-slate-700 dark:text-slate-300">
                  Select Existing Folder *
                </label>
                <select
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  {(events || []).map((evt) => (
                    <option key={evt?.id || Math.random().toString()} value={evt?.id || ""}>
                      📁 {evt?.title || "Untitled"} ({evt?.date || "No Date"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                multiple
                accept="image/*,video/*,.mp4,.mov,.3gp,.mkv,.webm,.avi,.m4v,.jpg,.jpeg,.png,.webp,.heic,.heif"
                onChange={(e) => {
                  handleFilesSelected(e.target.files);
                  e.target.value = "";
                }}
                className="hidden"
              />

              {/* Single Unified Media Upload Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-cyan-300 dark:border-cyan-800 bg-cyan-50/30 dark:bg-cyan-950/20 rounded-2xl p-6 sm:p-8 text-center cursor-pointer flex flex-col items-center justify-center space-y-2.5 hover:bg-cyan-50/60 dark:hover:bg-cyan-950/30 transition-all active:scale-[0.99]"
              >
                <div className="w-12 h-12 rounded-2xl bg-cyan-100 dark:bg-cyan-900/60 flex items-center justify-center text-cyan-600 dark:text-cyan-300 shadow-xs">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Tap to select photos or videos from your phone or computer
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Supports MP4, MOV, WebM, JPEG, PNG, WebP • Up to 300MB per batch
                  </p>
                </div>
              </div>

              {mediaItems.length > 0 && (
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Selected Files ({mediaItems.length})
                    </span>
                    <span>Total Batch: {totalBatchSizeMB.toFixed(1)} MB / 300 MB</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto">
                    {mediaItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl border flex items-center space-x-3 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-xs"
                      >
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-900 border border-slate-700/80 shrink-0 relative flex items-center justify-center">
                          {item.type === "video" ? (
                            <div className="w-full h-full bg-slate-950 flex items-center justify-center">
                              <div className="w-8 h-8 rounded-full bg-red-600/90 flex items-center justify-center shadow-md">
                                <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                              </div>
                            </div>
                          ) : (
                            <img src={item.previewUrl} alt="preview" className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-xs">
                          <p className="font-medium text-slate-900 dark:text-white truncate">
                            {item.file.name}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold ${
                              item.type === "video" ? "bg-red-500/20 text-red-600 dark:text-red-400" : "bg-teal-500/20 text-teal-600 dark:text-teal-400"
                            }`}>
                              {item.type === "video" ? "Video" : "Photo"}
                            </span>
                            <span>•</span>
                            <span>{item.sizeMB} MB</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition cursor-pointer"
                          title="Remove item"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {isUploading && (
            <div className="space-y-2.5 p-4 rounded-2xl bg-cyan-50/50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/80 animate-fadeIn">
              <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-2 font-medium">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <span>{uploadProgressText}</span>
                </span>
                <span className="font-mono font-bold text-cyan-700 dark:text-cyan-300 text-sm">
                  {uploadProgress}%
                </span>
              </div>
              <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-300 dark:border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-row items-center justify-end gap-4 pt-4 pb-20 border-t border-slate-200 dark:border-slate-800">
            <button
              type="submit"
              disabled={!isFormValid || isUploading}
              style={{ cursor: !isFormValid || isUploading ? "not-allowed" : "pointer" }}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center space-x-2 transition-all shadow-md"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                  <span>Uploading & Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>{currentUser?.role === "admin" ? "Publish Event Now" : "Submit for Review"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
