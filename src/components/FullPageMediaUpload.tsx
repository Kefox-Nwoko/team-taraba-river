import React, { useState, useEffect, useRef } from "react";
import { DatePicker } from "./DatePicker";
import { logger } from "../lib/logger";
import { GroupEvent, Member } from "../types";
import { FirebaseSyncManager } from "../services/firebaseService";
import { syncGoogleDriveUrl, parseYouTubeVideoUrl, uploadMediaItem, finalizeMediaItem } from "../services/apiClient";
import { storage } from "../lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { ReturnButton } from "./ReturnButton";
import { useToast } from "./ui/Toast";
import {
  ArrowLeft,
  Upload,
  FolderOpen,
  FolderPlus,
  Calendar,
  MapPin,
  ImageIcon,
  Video,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  X,
  ExternalLink,
  ChevronDown,
} from "lucide-react";

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
  const { showToast } = useToast();
  const [folderMode, setFolderMode] = useState<"existing" | "new">(
    initialFolderId ? "existing" : (events && events.length > 0 ? "existing" : "new")
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string>(initialFolderId || (events && events.length > 0 ? events[0].id : ""));
  const [newFolderTitle, setNewFolderTitle] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [youtubeUrlInput, setYoutubeUrlInput] = useState("");

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const formatDateLabel = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
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
          const MAX_WIDTH = 1920;
          const MAX_HEIGHT = 1080;
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
              else reject(new Error("Failed to encode WebP blob"));
            },
            "image/webp",
            0.85
          );
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });
  };

  const compressAndConvertToWebp = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 1920;
          const MAX_HEIGHT = 1080;
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
          resolve(canvas.toDataURL("image/webp", 0.85));
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });
  };

  const readVideoAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error("Failed to read video"));
      reader.readAsDataURL(file);
    });
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const newItems: MediaItem[] = [];
    let addedSizeMB = 0;
    const MAX_BATCH_SIZE_MB = 300;
    
    Array.from(files).forEach((file) => {
      const isVideo = file.type.startsWith("video/");
      const isPhoto = file.type.startsWith("image/");
      if (!isVideo && !isPhoto) return;

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
      setErrorMessage(`Upload batch exceeds ${MAX_BATCH_SIZE_MB}MB limit. Please select fewer or smaller files.`);
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

  const isFormValid =
    (folderMode === "existing" ? !!selectedFolderId : !!newFolderTitle.trim() && !!newDate) &&
    (mediaItems.length > 0 || !!youtubeUrlInput.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mediaItems.length === 0 && !youtubeUrlInput.trim()) {
      setErrorMessage("Please select media or add a YouTube link.");
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
    setErrorMessage(null);

    const folderNameTitle = folderMode === "new" 
      ? newFolderTitle.trim() 
      : (events.find((e) => e.id === selectedFolderId)?.title || "Event Gallery");
    const eventId = folderMode === "new" ? `evt_${Date.now()}` : selectedFolderId;
    
    const photoFinalUrls: string[] = [];
    const videoFinalUrls: string[] = [];
    const approvalsToSave: Array<{ id: string; type: "photo" | "video"; url: string }> = [];

    try {
      const trimmedYtUrl = youtubeUrlInput.trim();
      if (trimmedYtUrl) {
        const ytMatch = trimmedYtUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/);
        if (!ytMatch) throw new Error("Invalid YouTube URL.");
        const cleanYtUrl = `https://www.youtube.com/watch?v=${ytMatch[1]}`;
        videoFinalUrls.unshift(cleanYtUrl);
        approvalsToSave.push({ id: `req_yt_${Date.now()}`, type: "video", url: cleanYtUrl });
      }

      for (let i = 0; i < mediaItems.length; i++) {
        const item = mediaItems[i];
        setUploadProgressText(`Uploading asset ${i + 1} of ${mediaItems.length}...`);
        
        let finalUrl = "";
        try {
          if (item.type === "photo") {
            const webpBlob = await compressAndConvertToWebpBlob(item.file);
            const storageRef = ref(storage, `events/${eventId}/${Date.now()}_${i + 1}.webp`);
            await uploadBytes(storageRef, webpBlob, { contentType: "image/webp" });
            finalUrl = await getDownloadURL(storageRef);
          } else {
            const storageRef = ref(storage, `events/${eventId}/${Date.now()}_${item.file.name || "video.mp4"}`);
            await uploadBytes(storageRef, item.file, { contentType: item.file.type || "video/mp4" });
            finalUrl = await getDownloadURL(storageRef);
          }
        } catch (storageErr) {
          logger.warn("Direct storage upload notice, trying gateway fallback", { error: storageErr });
          try {
            const base64Data = item.type === "photo" ? await compressAndConvertToWebp(item.file) : await readVideoAsDataUrl(item.file);
            const uploadResult = await uploadMediaItem({
              eventId,
              type: item.type,
              base64Data,
              mimeType: item.type === "photo" ? "image/webp" : (item.file.type || "video/mp4"),
              fileName: item.file.name,
              storageTarget: item.type === "video" ? "youtube" : "drive",
            });
            const finalizeResult = await finalizeMediaItem(uploadResult.mediaId);
            if (finalizeResult.success && finalizeResult.finalUrl) {
              finalUrl = finalizeResult.finalUrl;
            }
          } catch (gateErr) {
            logger.warn("Gateway fallback failed", { error: gateErr });
          }
        }

        if (finalUrl) {
          if (item.type === "photo") {
            photoFinalUrls.push(finalUrl);
          } else {
            videoFinalUrls.push(finalUrl);
          }
          approvalsToSave.push({
            id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: item.type,
            url: finalUrl,
          });
        }
      }

      setUploadProgressText("Submitting media for Admin approval...");
      setUploadProgress(95);

      let targetEvent: GroupEvent;
      if (folderMode === "existing") {
        const existingEvent = events.find((e) => e.id === selectedFolderId);
        if (!existingEvent) throw new Error("Selected existing event folder not found.");
        targetEvent = {
          ...existingEvent,
          driveImageUrls: [...(existingEvent.driveImageUrls || []), ...photoFinalUrls],
          driveFolderId: existingEvent.driveFolderId || `drive_folder_${Date.now()}`,
          youtubeVideoUrl: videoFinalUrls[0] || existingEvent.youtubeVideoUrl || "",
        };
      } else {
        targetEvent = {
          id: eventId,
          title: folderNameTitle,
          date: newDate,
          time: "09:00",
          location: newLocation.trim(),
          category: newCategory,
          description: newDescription.trim() || `Archival media collection for ${folderNameTitle}.`,
          driveImageUrls: photoFinalUrls,
          driveFolderId: `drive_folder_${Date.now()}`,
          youtubeVideoUrl: videoFinalUrls[0] || "",
          createdBy: currentUser?.fullName || "Community Member",
          createdById: currentUser?.id || "mem_guest",
          attendeeIds: currentUser ? [currentUser.id] : [],
          maxCapacity: 100,
          createdAt: new Date().toISOString(),
        };
      }

      // --- Step 4: Save approvals with full folder metadata and instant preview ---
      const folderEventDate = folderMode === "new" ? newDate : (events.find((e) => e.id === selectedFolderId)?.date || newDate);
      const folderLocation = folderMode === "new" ? newLocation.trim() : (events.find((e) => e.id === selectedFolderId)?.location || "");
      const folderCategory = folderMode === "new" ? newCategory : (events.find((e) => e.id === selectedFolderId)?.category || "cleanup");
      const folderDescription = folderMode === "new" ? newDescription.trim() : (events.find((e) => e.id === selectedFolderId)?.description || "");

      for (const approval of approvalsToSave) {
        await FirebaseSyncManager.saveApproval({
          id: approval.id,
          memberId: currentUser?.id || "mem_guest",
          memberName: currentUser?.fullName || "Community Member",
          memberEmail: currentUser?.email || "member@tarabateam.org",
          photoUrl: approval.url,
          uploadedAt: new Date().toISOString(),
          status: "pending",
          adminNotes: `Media submission for folder: ${folderNameTitle}`,
          type: approval.type,
          eventId: targetEvent.id,
          folderName: folderNameTitle,
          date: folderEventDate,
          location: folderLocation,
          category: folderCategory,
          description: folderDescription,
        });
      }

      setUploadProgress(100);
      setIsUploading(false);
      
      const totalCount = approvalsToSave.length;
      toast.notify(
        `${totalCount} media item${totalCount !== 1 ? 's' : ''} submitted for Admin review. The folder and images will appear on the public Media page once approved by an Admin.`,
        "success"
      );
      
      onSuccess(undefined);
    } catch (err) {
      logger.error("Full page media upload error", err);
      const message = err instanceof Error ? err.message : "Failed to upload media.";
      setErrorMessage(message.includes("NetworkError") ? "Check internet connection or server status." : message);
      setUploadProgress(0);
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#121212] text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8 animate-fadeIn">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-row items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-sm sm:text-sm text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
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
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-xs">
              {errorMessage}
            </div>
          )}
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                <span>1. Select or Create Event Folder & Upload Media</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
               <button type="button" onClick={() => setFolderMode("new")}
                 className={`p-3 rounded-2xl border text-left flex items-start space-x-3 cursor-pointer ${
                  folderMode === "new"
                    ? "border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/40 text-slate-900 dark:text-white"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300"
                }`}
              >
                <FolderPlus className="w-5 h-5" />
                <div>
                  <div className="text-sm">Create New Event Folder</div>
                </div>
              </button>
              <button type="button" onClick={() => setFolderMode("existing")}
                className={`p-4 rounded-2xl border text-left flex items-start space-x-3 cursor-pointer ${
                  folderMode === "existing"
                    ? "border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/40 text-slate-900 dark:text-white"
                    : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300"
                }`}
              >
                <FolderOpen className="w-5 h-5" />
                <div>
                  <div className="text-sm">Select Existing Event Folder</div>
                </div>
              </button>
            </div>

            {folderMode === "new" ? (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1.5">
                      Event Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. URIP Sports Activity"
                      value={newFolderTitle}
                      onChange={(e) => setNewFolderTitle(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1.5">Date *</label>
                    <div className="relative w-full rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-between text-sm text-slate-900 dark:text-white cursor-pointer select-none">
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
                    <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1.5">
                      Location (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Lagos"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <label className="block text-sm text-slate-700 dark:text-slate-300">
                  Select Existing Folder *
                </label>
                <select
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
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
                accept="image/*,video/*"
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
              />
              {/* Device Upload Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-cyan-300 dark:border-cyan-800 bg-cyan-50/30 dark:bg-cyan-950/20 rounded-2xl p-4 text-center cursor-pointer flex flex-col items-center justify-center space-y-2 hover:bg-cyan-50/50 transition-colors"
              >
                <Upload className="w-6 h-6 text-cyan-600" />
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  Click to select photos or videos from your device (Phone, PC, Laptop)
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Photos auto-converted to WebP • Total batch max 300MB • Requires Admin approval before Google Drive / YouTube auto-sync
                </p>
              </div>

              {/* YouTube Video URL / Direct Upload Section */}
              <div className="p-3 rounded-2xl border border-red-200 dark:border-red-950 bg-red-50/40 dark:bg-red-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-red-600" />
                    <span>YouTube Video Integration</span>
                  </label>
                  <a
                    href="https://www.youtube.com/upload"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-900 shadow-sm transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Upload to YouTube Studio</span>
                  </a>
                </div>
                <input
                  type="url"
                  value={youtubeUrlInput}
                  onChange={(e) => setYoutubeUrlInput(e.target.value)}
                  placeholder="Paste YouTube Video link (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...)"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <p className="text-[0.8rem] text-slate-500 dark:text-slate-400">
                  Tip: Upload videos to YouTube directly for zero file size limits, then paste the YouTube link here to embed it in event galleries.
                </p>
              </div>

              {mediaItems.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Total: {totalBatchSizeMB.toFixed(1)} MB / 300 MB</span>
                    <span>{mediaItems.length} file{mediaItems.length !== 1 ? 's' : ''} selected</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                    {mediaItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl border flex items-center space-x-3 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                      >
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 relative flex items-center justify-center">
                          {item.type === "photo" ? (
                            <img src={item.previewUrl} alt="preview" className="w-full h-full object-cover" />
                          ) : (
                            <Video className="w-6 h-6 text-red-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-sm">
                          <p className="text-slate-900 dark:text-white truncate">{item.file.name}</p>
                          <p className="text-sm text-slate-500">{item.sizeMB} MB</p>
                        </div>
                        <button type="button" onClick={() => handleRemoveItem(item.id)}>
                          <X className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {isUploading && (
            <div className="space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-600" />
                  {uploadProgressText}
                </span>
                <span className="font-mono font-semibold text-cyan-700 dark:text-cyan-300">{uploadProgress}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-row items-center justify-end gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button type="submit" disabled={!isFormValid || isUploading} className="w-full sm:w-auto px-3 py-1.5 rounded-2xl bg-teal-600 text-white text-xs disabled:opacity-50 flex items-center justify-center space-x-2" >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>{isUploading ? "Publishing..." : (currentUser?.role === "admin" ? "Publish Event Now" : "Submit for Review")}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
