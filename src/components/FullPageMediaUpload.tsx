import React, { useState, useEffect, useRef } from "react";
import { DatePicker } from "./DatePicker";
import { logger } from "../lib/logger";
import { GroupEvent, Member } from "../types";
import { FirebaseSyncManager } from "../services/firebaseService";
import { syncGoogleDriveUrl, parseYouTubeVideoUrl, uploadMediaItem, finalizeMediaItem } from "../services/apiClient";
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
  onSuccess: (updatedEvent: GroupEvent) => void;
}

export const FullPageMediaUpload: React.FC<FullPageMediaUploadProps> = ({
  events,
  currentUser,
  initialFolderId,
  onReturn,
  onSuccess,
}) => {
  const [folderMode, setFolderMode] = useState<"new" | "existing">(
    initialFolderId ? "existing" : "new"
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    initialFolderId || (events && events.length > 0 ? events[0].id : "")
  );

  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newCategory, setNewCategory] = useState<
    "cleanup" | "workshop" | "celebration" | "outreach" | "general"
  >("cleanup");
  const [newLocation, setNewLocation] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [youtubeUrlInput, setYoutubeUrlInput] = useState("");

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [totalBatchSizeMB, setTotalBatchSizeMB] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

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
      setFolderMode("existing");
      setSelectedFolderId(initialFolderId);
    } else if (events && events.length > 0 && !selectedFolderId) {
      setSelectedFolderId(events[0].id);
    }
  }, [initialFolderId, events, selectedFolderId]);

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
    if (!files || files.length === 0) return;
    setErrorMessage(null);
    const newItems: MediaItem[] = [];
    let addedSizeMB = 0;
    const MAX_BATCH_SIZE_MB = 300;
    Array.from(files).forEach((file) => {
      const isVideo = file.type.startsWith("video/");
      const isPhoto = file.type.startsWith("image/");
      if (!isVideo && !isPhoto) return;
      const sizeMB = file.size / (1024 * 1024);
      if (totalBatchSizeMB + addedSizeMB + sizeMB > MAX_BATCH_SIZE_MB) {
        setErrorMessage(`Total batch size exceeds ${MAX_BATCH_SIZE_MB} MB limit. Please select fewer files.`);
        return;
      }
      addedSizeMB += sizeMB;
      newItems.push({
        id: `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        file,
        type: isVideo ? "video" : "photo",
        previewUrl: URL.createObjectURL(file),
        sizeMB: parseFloat(sizeMB.toFixed(2)),
        status: "ready",
      });
    });
    setTotalBatchSizeMB((prev) => prev + addedSizeMB);
    setMediaItems((prev) => [...prev, ...newItems]);
  };

  const handleRemoveItem = (id: string) => {
    setMediaItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
        setTotalBatchSizeMB((prevSize) => Math.max(0, prevSize - item.sizeMB));
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const isFormValid =
    totalBatchSizeMB <= 300 &&
    (folderMode === "existing" ? !!selectedFolderId : !!newTitle.trim() && !!newDate) &&
    (mediaItems.length > 0 || !!youtubeUrlInput.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isUploading) return;
    setIsUploading(true);
    setErrorMessage(null);
    setUploadProgress(0);
    
    const timeout = (ms: number) => new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out - please check your connection and try again.")), ms));

    try {
      setUploadProgressText("Processing request...");
      setUploadProgress(10);

      const eventId = folderMode === "existing" ? selectedFolderId : `evt_folder_${Date.now()}`;
      const folderNameTitle = folderMode === "new" ? `${newDate} - ${newTitle.trim()}` : (events.find((e) => e.id === selectedFolderId)?.title || "Community Gathering");
      const isAdmin = currentUser?.role === "admin";

      const photoFinalUrls: string[] = [];
      const videoFinalUrls: string[] = [];
      const approvalsToSave: Array<{ id: string; type: "photo" | "video"; url: string; previewDataUrl?: string }> = [];

      // Handle YouTube URL — parse client-side to avoid extra network round-trip
      const trimmedYtUrl = youtubeUrlInput.trim();
      if (trimmedYtUrl) {
        const ytMatch = trimmedYtUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/);
        if (!ytMatch) {
          throw new Error("Invalid YouTube URL. Please paste a valid YouTube watch, short, or share link (e.g. https://youtu.be/xxxxx or https://www.youtube.com/watch?v=xxxxx).");
        }
        const cleanYtUrl = `https://www.youtube.com/watch?v=${ytMatch[1]}`;
        videoFinalUrls.unshift(cleanYtUrl);
        approvalsToSave.push({
          id: `req_yt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: "video",
          url: cleanYtUrl,
        });
      }

      for (let i = 0; i < mediaItems.length; i++) {
        const item = mediaItems[i];
        const progressBase = 10;
        const totalSteps = 80;
        const uploadStart = progressBase + (i * totalSteps / mediaItems.length);
        const finalizeEnd = progressBase + ((i + 1) * totalSteps / mediaItems.length);

        setUploadProgressText(`Uploading asset ${i + 1} of ${mediaItems.length}...`);
        setUploadProgress(Math.round(uploadStart));

        let base64Data: string;
        let mimeType: string;
        let fileName: string;

        if (item.type === "photo") {
          const webpDataUrl = await compressAndConvertToWebp(item.file);
          base64Data = webpDataUrl;
          mimeType = "image/webp";
          fileName = `photo_${eventId}_${i + 1}.webp`;
        } else {
          base64Data = await readVideoAsDataUrl(item.file);
          mimeType = item.file.type || "video/mp4";
          fileName = item.file.name || `video_${eventId}_${i + 1}.mp4`;
        }

        const uploadResult = await Promise.race([
          uploadMediaItem({
            eventId,
            type: item.type,
            base64Data,
            mimeType,
            fileName,
            storageTarget: item.type === "video" ? "youtube" : "drive",
          }),
          timeout(60000)
        ]) as any;

        const finalizeResult = await Promise.race([
          finalizeMediaItem(uploadResult.mediaId),
          timeout(30000)
        ]) as any;

        if (finalizeResult.success && finalizeResult.finalUrl) {
          if (item.type === "photo") {
            photoFinalUrls.push(finalizeResult.finalUrl);
          } else {
            videoFinalUrls.push(finalizeResult.finalUrl);
          }
          approvalsToSave.push({
            id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: item.type,
            url: finalizeResult.finalUrl,
          });
        } else {
          throw new Error(finalizeResult.error || `Failed to finalize ${item.type}`);
        }

        setUploadProgress(Math.round(finalizeEnd));
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
          location: newLocation.trim() || "Taraba State",
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
      const folderLocation = folderMode === "new" ? newLocation.trim() : (events.find((e) => e.id === selectedFolderId)?.location || "Taraba State");
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
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
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
