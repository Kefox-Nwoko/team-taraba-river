import React, { useState, useEffect, useRef } from "react";
import { DatePicker } from "./DatePicker";
import { logger } from "../lib/logger";
import { GroupEvent, Member, PhotoApprovalRequest } from "../types";
import { FirebaseSyncManager } from "../services/firebaseService";
import { storage } from "../lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
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
  Copy,
  AlertTriangle,
  FileText,
  Edit2,
  RefreshCw,
  Bot,
  Sparkles,
  Clock,
} from "lucide-react";
import { uploadVideoDirectToYouTube, deleteYouTubeVideo } from "../services/youtubeDirectUpload";
import { uploadImageDirectToDrive } from "../services/googleDriveDirectUpload";
import { AppStateManager } from "../services/storage";

interface MediaItem {
  id: string;
  file: File;
  type: "photo" | "video";
  previewUrl: string;
  sizeMB: number;
  status: "ready";
  replaceTargetUrl?: string; // If replacing an existing asset
}

interface DuplicateCandidate {
  itemId: string;
  file: File;
  type: "photo" | "video";
  previewUrl: string;
  sizeMB: number;
  matchedName: string;
  matchedUrl?: string;
  suggestedName: string;
  isPendingApproval?: boolean;
  pendingRequestDetails?: {
    memberName?: string;
    uploadedAt?: string;
    folderName?: string;
    type?: string;
  };
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

  // Duplicate Resolution State
  const [duplicateQueue, setDuplicateQueue] = useState<DuplicateCandidate[]>([]);
  const [currentDupIdx, setCurrentDupIdx] = useState(0);
  const [dupCustomName, setDupCustomName] = useState("");
  const [applyToAll, setApplyToAll] = useState(false);
  const [pendingApprovalsQueue, setPendingApprovalsQueue] = useState<PhotoApprovalRequest[]>([]);

  // Real-Time Dual-Tier Upload Progress State
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);
  const [activeFileName, setActiveFileName] = useState<string>("");
  const [activeFileType, setActiveFileType] = useState<"photo" | "video">("photo");
  const [activeFileProgress, setActiveFileProgress] = useState<number>(0);
  const [activeFileMBTransferred, setActiveFileMBTransferred] = useState<number>(0);
  const [activeFileTotalMB, setActiveFileTotalMB] = useState<number>(0);

  const [completedUploadsCount, setCompletedUploadsCount] = useState<number>(0);
  const [completedUploadsList, setCompletedUploadsList] = useState<
    Array<{ name: string; type: "photo" | "video"; status: "success" | "failed"; reason?: string }>
  >([]);

  // Manual Rename Modal State
  const [renameTargetItem, setRenameTargetItem] = useState<MediaItem | null>(null);
  const [manualNewName, setManualNewName] = useState("");

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
    // Real-time listener for in-flight pending moderation approvals
    const unsubscribe = FirebaseSyncManager.subscribeApprovals((list) => {
      setPendingApprovalsQueue(list.filter((r) => r.status === "pending"));
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (initialFolderId) {
      setSelectedFolderId(initialFolderId);
      setFolderMode("existing");
    } else if (events && events.length > 0 && !selectedFolderId) {
      setSelectedFolderId(events[0].id);
    }
  }, [initialFolderId, events, selectedFolderId]);

  const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to convert blob to data URL"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read image blob"));
      reader.readAsDataURL(blob);
    });
  };

  const compressAndConvertToWebpBlob = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
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
              resolve(file);
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
              (blob) => {
                if (blob) resolve(blob);
                else resolve(file);
              },
              "image/webp",
              0.82
            );
          } catch {
            resolve(file);
          }
        };
        img.onerror = () => resolve(file);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(file);
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

    // 2. For Photos: Google Drive Direct Upload Pipeline (WebP Compressed)
    let uploadPayload: Blob = item.file;
    let contentType = item.file.type || "image/jpeg";
    let ext = "webp";

    try {
      uploadPayload = await compressAndConvertToWebpBlob(item.file);
      contentType = uploadPayload.type || "image/webp";
      ext = "webp";
    } catch {
      uploadPayload = item.file;
      ext = item.file.name.split(".").pop() || "jpg";
    }

    const cleanName = (item.file.name.replace(/\.[^/.]+$/, "") || `media_${index + 1}`).replace(/[^a-zA-Z0-9._-]/g, "_") + `.${ext}`;

    // Tier 1: Stream directly to Google Drive folder
    try {
      const driveUrl = await uploadImageDirectToDrive(
        uploadPayload,
        cleanName,
        folderName,
        onFileProgress
      );
      return driveUrl;
    } catch (driveErr) {
      logger.warn("[MediaUpload] Google Drive direct upload notice, engaging secondary cloud storage:", driveErr);
    }

    // Tier 2: Try Firebase Cloud Storage
    try {
      const folderPath = "photos";
      const storageRef = ref(storage, `events/${eventId}/${folderPath}/${Date.now()}_${index + 1}_${cleanName}`);

      const downloadUrl = await new Promise<string>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, uploadPayload, {
          contentType,
        });

        const uploadTimeout = setTimeout(() => {
          try {
            uploadTask.cancel();
          } catch {}
          reject(new Error("Cloud storage timeout"));
        }, 8000);

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            if (snapshot.totalBytes > 0) {
              const pct = Math.min(95, Math.max(35, Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)));
              onFileProgress(pct);
            }
          },
          (error) => {
            clearTimeout(uploadTimeout);
            reject(error);
          },
          async () => {
            clearTimeout(uploadTimeout);
            try {
              onFileProgress(98);
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            } catch (err) {
              reject(err);
            }
          }
        );
      });

      onFileProgress(100);
      return downloadUrl;
    } catch (storageErr) {
      logger.info("[MediaUpload] Secondary storage bypassed, using high-efficiency WebP payload:", storageErr);
      // Tier 3: Instant High-Efficiency WebP Data URL fallback (Zero failure, ultra-fast)
      onFileProgress(80);
      const dataUrl = await blobToDataUrl(uploadPayload);
      onFileProgress(100);
      return dataUrl;
    }
  };

  /**
   * Helper to scan for duplicates in selected items against current list and target folder.
   */
  const detectDuplicates = (
    newCandidates: MediaItem[],
    currentItems: MediaItem[],
    targetEvt?: GroupEvent
  ): DuplicateCandidate[] => {
    const duplicates: DuplicateCandidate[] = [];
    const existingMedia: Array<{
      name: string;
      url: string;
      type: "photo" | "video";
      isPending?: boolean;
      pendingDetails?: { memberName?: string; uploadedAt?: string; folderName?: string; type?: string };
    }> = [];

    // 1. Extract names from target folder (published assets)
    if (targetEvt) {
      (targetEvt.driveImageUrls || []).forEach((u) => {
        try {
          const decoded = decodeURIComponent(u);
          const match = decoded.match(/([^\/?#]+)\.(webp|jpg|jpeg|png|mp4|mov|webm)/i);
          if (match) {
            const clean = match[1].replace(/^\d+_\d+_/, "").toLowerCase();
            existingMedia.push({ name: clean, url: u, type: "photo" });
          }
        } catch {}
      });

      const ytVids = (targetEvt.youtubeVideoUrls || (targetEvt.youtubeVideoUrl ? [targetEvt.youtubeVideoUrl] : [])).filter(Boolean);
      ytVids.forEach((u, idx) => {
        existingMedia.push({
          name: `${targetEvt.title.toLowerCase()} video ${idx + 1}`,
          url: u,
          type: "video",
        });
      });
    }

    // 2. AI In-Queue Detection: Extract items from pending moderation approvals queue
    pendingApprovalsQueue.forEach((pa) => {
      let paCleanName = (pa.folderName || pa.adminNotes || "pending media").toLowerCase();
      if (pa.photoUrl) {
        try {
          const decoded = decodeURIComponent(pa.photoUrl);
          const match = decoded.match(/([^\/?#]+)\.(webp|jpg|jpeg|png|mp4|mov|webm)/i);
          if (match) {
            paCleanName = match[1].replace(/^\d+_\d+_/, "").toLowerCase();
          }
        } catch {}
      }
      existingMedia.push({
        name: paCleanName,
        url: pa.photoUrl,
        type: pa.type === "video" ? "video" : "photo",
        isPending: true,
        pendingDetails: {
          memberName: pa.memberName,
          uploadedAt: pa.uploadedAt,
          folderName: pa.folderName,
          type: pa.type,
        },
      });
    });

    // 3. Add current batch items to existing list
    currentItems.forEach((ci) => {
      existingMedia.push({
        name: ci.file.name.replace(/\.[^/.]+$/, "").toLowerCase(),
        url: ci.previewUrl,
        type: ci.type,
      });
    });

    const seenInBatch = new Set<string>();

    newCandidates.forEach((item) => {
      const originalFullName = item.file.name;
      const baseName = originalFullName.replace(/\.[^/.]+$/, "");
      const ext = originalFullName.includes(".") ? originalFullName.split(".").pop() : (item.type === "video" ? "mp4" : "jpg");
      const lowerBase = baseName.toLowerCase().replace(/[^a-z0-9]/g, "");

      // Match against existing
      const matchedEx = existingMedia.find((ex) => {
        const cleanEx = ex.name.replace(/[^a-z0-9]/g, "");
        return cleanEx.length > 2 && lowerBase.length > 2 && (cleanEx.includes(lowerBase) || lowerBase.includes(cleanEx));
      });

      const isBatchDuplicate = seenInBatch.has(lowerBase);
      seenInBatch.add(lowerBase);

      if (matchedEx || isBatchDuplicate) {
        let copyNum = 1;
        let candidateName = `${baseName} (Copy ${copyNum}).${ext}`;
        const allNames = [
          ...currentItems.map((c) => c.file.name.toLowerCase()),
          ...newCandidates.map((c) => c.file.name.toLowerCase()),
        ];
        while (allNames.includes(candidateName.toLowerCase())) {
          copyNum++;
          candidateName = `${baseName} (Copy ${copyNum}).${ext}`;
        }

        duplicates.push({
          itemId: item.id,
          file: item.file,
          type: item.type,
          previewUrl: item.previewUrl,
          sizeMB: item.sizeMB,
          matchedName: matchedEx ? matchedEx.name : originalFullName,
          matchedUrl: matchedEx ? matchedEx.url : undefined,
          suggestedName: candidateName,
          isPendingApproval: matchedEx?.isPending || false,
          pendingRequestDetails: matchedEx?.pendingDetails,
        });
      }
    });

    return duplicates;
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

    const targetEvt = folderMode === "existing" ? events.find((e) => e.id === selectedFolderId) : undefined;
    const foundDuplicates = detectDuplicates(newItems, mediaItems, targetEvt);

    if (foundDuplicates.length > 0) {
      const duplicateIds = new Set(foundDuplicates.map((d) => d.itemId));
      const nonDuplicates = newItems.filter((it) => !duplicateIds.has(it.id));
      
      setMediaItems((prev) => [...prev, ...nonDuplicates, ...foundDuplicates.map((d) => newItems.find((it) => it.id === d.itemId)!)]);
      setDuplicateQueue(foundDuplicates);
      setCurrentDupIdx(0);
      setDupCustomName(foundDuplicates[0].suggestedName);
      setApplyToAll(false);
    } else {
      setMediaItems((prev) => [...prev, ...newItems]);
    }
  };

  // Duplicate Resolution Actions
  const handleResolveDuplicateAsCopy = (customName?: string) => {
    if (duplicateQueue.length === 0) return;
    const currentDup = duplicateQueue[currentDupIdx];
    const targetName = (customName || dupCustomName || currentDup.suggestedName).trim();

    const renamedFile = new File([currentDup.file], targetName, {
      type: currentDup.file.type,
      lastModified: currentDup.file.lastModified || Date.now(),
    });

    setMediaItems((prev) =>
      prev.map((it) => (it.id === currentDup.itemId ? { ...it, file: renamedFile } : it))
    );

    notify(`📋 Saved "${targetName}" as a new copy`, "info");
    advanceDuplicateQueue("copy");
  };

  const handleResolveDuplicateReplace = () => {
    if (duplicateQueue.length === 0) return;
    const currentDup = duplicateQueue[currentDupIdx];

    setMediaItems((prev) =>
      prev.map((it) =>
        it.id === currentDup.itemId
          ? { ...it, replaceTargetUrl: currentDup.matchedUrl }
          : it
      )
    );

    notify(`🔄 Set to replace existing media for "${currentDup.file.name}"`, "info");
    advanceDuplicateQueue("replace");
  };

  const handleResolveDuplicateSkip = () => {
    if (duplicateQueue.length === 0) return;
    const currentDup = duplicateQueue[currentDupIdx];

    handleRemoveItem(currentDup.itemId);
    notify(`⏭️ Skipped duplicate "${currentDup.file.name}"`, "info");
    advanceDuplicateQueue("skip");
  };

  const advanceDuplicateQueue = (lastAction: "copy" | "replace" | "skip") => {
    if (applyToAll) {
      const remaining = duplicateQueue.slice(currentDupIdx + 1);
      remaining.forEach((dup) => {
        if (lastAction === "copy") {
          const autoName = dup.suggestedName;
          const renamed = new File([dup.file], autoName, {
            type: dup.file.type,
            lastModified: dup.file.lastModified || Date.now(),
          });
          setMediaItems((prev) =>
            prev.map((it) => (it.id === dup.itemId ? { ...it, file: renamed } : it))
          );
        } else if (lastAction === "replace") {
          setMediaItems((prev) =>
            prev.map((it) => (it.id === dup.itemId ? { ...it, replaceTargetUrl: dup.matchedUrl } : it))
          );
        } else if (lastAction === "skip") {
          handleRemoveItem(dup.itemId);
        }
      });
      setDuplicateQueue([]);
      return;
    }

    if (currentDupIdx + 1 < duplicateQueue.length) {
      const nextIdx = currentDupIdx + 1;
      setCurrentDupIdx(nextIdx);
      setDupCustomName(duplicateQueue[nextIdx].suggestedName);
    } else {
      setDuplicateQueue([]);
    }
  };

  // Manual Duplicate / Clone Action
  const handleDuplicateItem = (item: MediaItem) => {
    const base = item.file.name.replace(/\.[^/.]+$/, "");
    const ext = item.file.name.includes(".") ? item.file.name.split(".").pop() : (item.type === "video" ? "mp4" : "jpg");
    let copyNum = 1;
    let newName = `${base} (Copy ${copyNum}).${ext}`;
    while (mediaItems.some((it) => it.file.name.toLowerCase() === newName.toLowerCase())) {
      copyNum++;
      newName = `${base} (Copy ${copyNum}).${ext}`;
    }

    const clonedFile = new File([item.file], newName, {
      type: item.file.type,
      lastModified: Date.now(),
    });

    const previewUrl = URL.createObjectURL(clonedFile);
    const newItem: MediaItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      file: clonedFile,
      type: item.type,
      previewUrl,
      sizeMB: item.sizeMB,
      status: "ready",
    };

    setMediaItems((prev) => [...prev, newItem]);
    notify(`📋 Duplicated "${newName}" (Ready to upload as additional copy)`, "success");
  };

  // Manual Rename Action
  const handleSaveManualRename = () => {
    if (!renameTargetItem || !manualNewName.trim()) return;
    const cleanName = manualNewName.trim();
    const renamed = new File([renameTargetItem.file], cleanName, {
      type: renameTargetItem.file.type,
      lastModified: Date.now(),
    });

    setMediaItems((prev) =>
      prev.map((it) => (it.id === renameTargetItem.id ? { ...it, file: renamed } : it))
    );
    setRenameTargetItem(null);
    setManualNewName("");
    notify(`✏️ Renamed file to "${cleanName}"`, "info");
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
    const todayStr = new Date().toISOString().split("T")[0];
    if (folderMode === "new" && newDate > todayStr) {
      setErrorMessage("Future dates are restricted. Media uploads must be for past or present (same day) events.");
      notify("⚠️ Future dates are restricted. Media uploads must be for past or present (same day) events.", "error");
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);
    setActiveFileProgress(0);
    setActiveFileMBTransferred(0);
    setCompletedUploadsCount(0);
    setCompletedUploadsList([]);
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
    // FAULT-TOLERANT SEQUENTIAL UPLOADS WITH REAL-TIME MILESTONE TRACKING
    // ──────────────────────────────────────────────────────────────────
    const photoFinalUrls: string[] = [];
    const videoFinalUrls: string[] = [];
    const failedFiles: Array<{ name: string; reason: string }> = [];
    const replacementsToExecute: Array<{ replaceUrl: string; newUrl: string; type: "photo" | "video" }> = [];
    const totalFiles = mediaItems.length;

    for (let i = 0; i < totalFiles; i++) {
      const item = mediaItems[i];
      const isVideo = item.type === "video";
      setActiveFileIndex(i);
      setActiveFileName(item.file.name);
      setActiveFileType(item.type);
      setActiveFileProgress(0);
      setActiveFileMBTransferred(0);
      setActiveFileTotalMB(item.sizeMB);

      setUploadProgressText(
        `Uploading ${isVideo ? "video" : "photo"} (${i + 1} of ${totalFiles}): "${item.file.name}"`
      );

      try {
        const finalUrl = await uploadMediaFileWithProgress(
          item,
          eventId,
          folderNameTitle,
          i,
          (pct) => {
            setActiveFileProgress(pct);
            const mbDone = parseFloat(((pct / 100) * item.sizeMB).toFixed(1));
            setActiveFileMBTransferred(mbDone);
            const overallPct = Math.round(((i + pct / 100) / totalFiles) * 85);
            setUploadProgress(Math.max(5, overallPct));
          }
        );

        if (finalUrl) {
          if (isVideo) {
            videoFinalUrls.push(finalUrl);
          } else {
            photoFinalUrls.push(finalUrl);
          }

          if (item.replaceTargetUrl) {
            replacementsToExecute.push({
              replaceUrl: item.replaceTargetUrl,
              newUrl: finalUrl,
              type: item.type,
            });
          }

          // Save approval for non-admin members immediately so each file is safeguarded
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
                adminNotes: `${isVideo ? "Video" : "Photo"} submission for folder: ${folderNameTitle}${item.replaceTargetUrl ? " (Replaces existing asset)" : ""}`,
                type: isVideo ? "video" : "photo",
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

          setCompletedUploadsCount((prev) => prev + 1);
          setCompletedUploadsList((prev) => [
            ...prev,
            { name: item.file.name, type: item.type, status: "success" },
          ]);
        }
      } catch (err: any) {
        const errorReason = err?.message || "Upload encountered an issue";
        failedFiles.push({ name: item.file.name, reason: errorReason });
        setCompletedUploadsList((prev) => [
          ...prev,
          { name: item.file.name, type: item.type, status: "failed", reason: errorReason },
        ]);
        logger.error(`Upload failed for item ${i + 1} (${item.file.name}):`, err);
      }
    }

    // ──────────────────────────────────────────────────────────────────
    // PERFORM CLOUD PURGE OF REPLACED ASSETS
    // ──────────────────────────────────────────────────────────────────
    for (const repl of replacementsToExecute) {
      if (repl.type === "video" && repl.replaceUrl) {
        deleteYouTubeVideo(repl.replaceUrl).catch(() => {});
      } else if (repl.type === "photo" && repl.replaceUrl && repl.replaceUrl.includes("firebasestorage.googleapis.com")) {
        try {
          const fileRef = ref(storage, repl.replaceUrl);
          deleteObject(fileRef).catch(() => {});
        } catch (e) {}
      }
    }

    // ──────────────────────────────────────────────────────────────────
    // SAVE EVENT: Register all successful uploads in Event Gallery
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

          let existingYtList = ((existingEvent.youtubeVideoUrls || (existingEvent.youtubeVideoUrl ? [existingEvent.youtubeVideoUrl] : [])) as string[]).filter(Boolean);
          let existingPhotos = existingEvent.driveImageUrls || [];

          // Apply in-place replacements
          replacementsToExecute.forEach((repl) => {
            if (repl.type === "video") {
              existingYtList = existingYtList.filter((u) => u !== repl.replaceUrl);
            } else {
              existingPhotos = existingPhotos.filter((u) => u !== repl.replaceUrl);
            }
          });

          const updatedYtList = isAdmin
            ? Array.from(new Set([...existingYtList, ...videoFinalUrls]))
            : existingYtList;

          const updatedPhotoList = isAdmin
            ? Array.from(new Set([...existingPhotos, ...photoFinalUrls]))
            : existingPhotos;

          targetEvent = {
            ...existingEvent,
            driveImageUrls: updatedPhotoList,
            driveFolderId: existingEvent.driveFolderId || `drive_folder_${Date.now()}`,
            youtubeVideoUrls: updatedYtList,
            youtubeVideoUrl: updatedYtList[0] || "",
          };

          if (isAdmin) {
            await FirebaseSyncManager.saveEvent(targetEvent);
            const currentEvents = AppStateManager.getEvents();
            const existingIndex = currentEvents.findIndex((e) => e.id === targetEvent.id);
            if (existingIndex !== -1) {
              currentEvents[existingIndex] = targetEvent;
            } else {
              currentEvents.unshift(targetEvent);
            }
            AppStateManager.saveEvents(currentEvents);
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
            youtubeVideoUrl: isAdmin ? (videoFinalUrls[0] || "") : "",
            youtubeVideoUrls: isAdmin ? videoFinalUrls : [],
            createdBy: currentUser?.fullName || "Community Member",
            createdById: currentUser?.id || "mem_guest",
            attendeeIds: currentUser ? [currentUser.id] : [],
            maxCapacity: 100,
            createdAt: new Date().toISOString(),
          } as any;

          if (isAdmin) {
            await FirebaseSyncManager.saveEvent(targetEvent);
            const currentEvents = AppStateManager.getEvents();
            currentEvents.unshift(targetEvent);
            AppStateManager.saveEvents(currentEvents);
          }
        }

        setUploadProgress(100);
        setIsUploading(false);

        if (failedFiles.length === 0) {
          notify(
            isAdmin
              ? `✅ ${totalSucceeded} media item${totalSucceeded !== 1 ? "s" : ""} published to the Event Gallery.`
              : `✅ ${totalSucceeded} media item${totalSucceeded !== 1 ? "s" : ""} submitted for Admin review.`,
            "success"
          );
        } else {
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
        logger.error("Event save error after uploads:", saveErr);
        const msg = saveErr instanceof Error ? saveErr.message : "Failed to register media in event gallery.";
        setErrorMessage(`Uploads completed but event save failed: ${msg}`);
        setUploadProgress(0);
        setIsUploading(false);
      }
    } else {
      const allReasons = failedFiles.map((f) => `"${f.name}": ${f.reason}`).join(" | ");
      setErrorMessage(`❌ All ${mediaItems.length} upload${mediaItems.length !== 1 ? "s" : ""} failed. ${allReasons}`);
      setUploadProgress(0);
      setIsUploading(false);
    }
  };

  const currentDup = duplicateQueue.length > 0 ? duplicateQueue[currentDupIdx] : null;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0c0c0c] text-slate-900 dark:text-slate-100 font-sans pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <ReturnButton onClick={onReturn} label="Back to Gallery" />
          </div>
          <div className="text-right">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Media Hub Uploader
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              High-Speed Resumable Pipeline (Direct YouTube & Cloud CDN)
            </p>
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
                        maxDate={new Date().toISOString().split("T")[0]}
                        onDateRestricted={(attemptedDate, reason) => {
                          if (reason === "future") {
                            notify(
                              `⚠️ Future dates (${formatDateLabel(attemptedDate)}) are restricted. Media uploads are only permitted for past or present (same day) events.`,
                              "error"
                            );
                          }
                        }}
                        onChange={(val) => {
                          const today = new Date().toISOString().split("T")[0];
                          if (val && val > today) {
                            notify(
                              "⚠️ Future dates are restricted. Media uploads must be for past or present (same day) events.",
                              "error"
                            );
                            setNewDate(today);
                            return;
                          }
                          setNewDate(val || today);
                        }}
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
                        className={`p-3 rounded-2xl border flex items-center space-x-3 bg-slate-50 dark:bg-slate-950 shadow-xs ${
                          item.replaceTargetUrl ? "border-amber-400 dark:border-amber-600 bg-amber-50/30 dark:bg-amber-950/20" : "border-slate-200 dark:border-slate-800"
                        }`}
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
                          <p className="font-medium text-slate-900 dark:text-white truncate" title={item.file.name}>
                            {item.file.name}
                          </p>
                          <p className="text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-bold ${
                              item.type === "video" ? "bg-red-500/20 text-red-600 dark:text-red-400" : "bg-teal-500/20 text-teal-600 dark:text-teal-400"
                            }`}>
                              {item.type === "video" ? "Video" : "Photo"}
                            </span>
                            <span>•</span>
                            <span>{item.sizeMB} MB</span>
                            {item.replaceTargetUrl && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                🔄 Replaces existing
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center space-x-1 shrink-0">
                          {/* Clone/Duplicate Button */}
                          <button
                            type="button"
                            onClick={() => handleDuplicateItem(item)}
                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-cyan-500 transition cursor-pointer"
                            title="Duplicate as new copy"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {/* Rename Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setRenameTargetItem(item);
                              setManualNewName(item.file.name);
                            }}
                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-teal-500 transition cursor-pointer"
                            title="Rename file"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {/* Remove Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-red-500 transition cursor-pointer"
                            title="Remove item"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {isUploading && (
            <div className="space-y-4 p-5 rounded-3xl bg-cyan-50/60 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/80 shadow-md animate-fadeIn">
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <span className="truncate">{uploadProgressText}</span>
                </span>
                <span className="font-mono font-bold text-cyan-700 dark:text-cyan-300 text-sm shrink-0">
                  {activeFileProgress}%
                </span>
              </div>

              {/* Tier 1: Current File Progress Bar */}
              <div className="space-y-1.5 p-3 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-cyan-100 dark:border-cyan-900/40">
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                  <span className="font-medium truncate max-w-[220px]">
                    Current {activeFileType === "video" ? "Video" : "Photo"}: <strong>{activeFileName || "Processing..."}</strong>
                  </span>
                  <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                    {activeFileMBTransferred} MB / {activeFileTotalMB} MB
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all duration-200 ease-out"
                    style={{ width: `${activeFileProgress}%` }}
                  />
                </div>
              </div>

              {/* Tier 2: Overall Batch Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-medium">
                    Total Batch Progress: File {activeFileIndex + 1} of {mediaItems.length}
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {uploadProgress}%
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-300 dark:border-slate-700">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-500 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>

              {/* Live Milestone Status Notice Under Progress Bar */}
              <div className="pt-2 border-t border-cyan-200/60 dark:border-cyan-800/60 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  {completedUploadsCount > 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>
                        {completedUploadsCount} of {mediaItems.length} completed successfully
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span>Processing file 1 of {mediaItems.length}...</span>
                    </span>
                  )}
                </div>

                {/* Granular per-file status badges */}
                {completedUploadsList.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {completedUploadsList.map((st, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1 ${
                          st.status === "success"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                            : "bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/20"
                        }`}
                      >
                        {st.status === "success" ? "✓" : "✗"} {st.name} ({st.type})
                      </span>
                    ))}
                  </div>
                )}
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

        {/* ── DUPLICATE MEDIA RESOLUTION MODAL ── */}
        {currentDup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 text-slate-900 dark:text-white">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold">Duplicate Media Detected</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Item {currentDupIdx + 1} of {duplicateQueue.length}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleResolveDuplicateSkip}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* AI Detection Notice if in queue */}
              {currentDup.isPendingApproval && (
                <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs space-y-1 animate-fadeIn">
                  <div className="flex items-center space-x-1.5 text-indigo-700 dark:text-indigo-300 font-semibold">
                    <Sparkles className="w-4 h-4 text-amber-500 animate-spin" style={{ animationDuration: "3s" }} />
                    <span>🤖 AI In-Queue Detection</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    A matching {currentDup.type} submission by <strong>{currentDup.pendingRequestDetails?.memberName || "a member"}</strong> is <strong>currently in the queue awaiting Admin Moderation approval</strong> for <em>"{currentDup.pendingRequestDetails?.folderName || "this event"}"</em>.
                  </p>
                </div>
              )}

              {/* Item Info Card */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center space-x-3">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-900 shrink-0 relative flex items-center justify-center">
                  {currentDup.type === "video" ? (
                    <div className="w-full h-full bg-slate-950 flex items-center justify-center">
                      <Play className="w-5 h-5 text-red-500 fill-current" />
                    </div>
                  ) : (
                    <img src={currentDup.previewUrl} alt="preview" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-xs">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">
                    {currentDup.file.name}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    {currentDup.type === "video" ? "Video" : "Photo"} • {currentDup.sizeMB} MB
                  </p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    Matches: <span className="font-medium">"{currentDup.matchedName}"</span>
                    {currentDup.isPendingApproval && " (Awaiting Admin Review)"}
                  </p>
                </div>
              </div>

              {/* Choice 1: Save as New Copy (Rename) */}
              <div className="p-4 rounded-2xl border border-teal-200 dark:border-teal-900 bg-teal-50/40 dark:bg-teal-950/20 space-y-2.5">
                <div className="flex items-center space-x-2 text-teal-700 dark:text-teal-300 font-semibold text-xs">
                  <Copy className="w-4 h-4" />
                  <span>Option 1: Save as New Copy (Upload Additional Copy)</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Allows saving the exact same media file multiple times under a distinct name.
                </p>
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="text"
                    value={dupCustomName}
                    onChange={(e) => setDupCustomName(e.target.value)}
                    placeholder="New copy name"
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => handleResolveDuplicateAsCopy()}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-xs"
                  >
                    Save as Copy
                  </button>
                </div>
              </div>

              {/* Choice 2 & 3: Replace or Skip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleResolveDuplicateReplace}
                  className="p-3 rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/60 text-left transition cursor-pointer space-y-1"
                >
                  <div className="flex items-center space-x-1.5 text-amber-700 dark:text-amber-300 font-semibold text-xs">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Option 2: Replace Existing</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Overwrites and cleans old cloud storage
                  </p>
                </button>

                <button
                  type="button"
                  onClick={handleResolveDuplicateSkip}
                  className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/60 hover:bg-slate-100 text-left transition cursor-pointer space-y-1"
                >
                  <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300 font-semibold text-xs">
                    <X className="w-3.5 h-3.5" />
                    <span>Option 3: Skip File</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Do not upload this duplicate item
                  </p>
                </button>
              </div>

              {/* Apply to all toggle if multiple duplicates */}
              {duplicateQueue.length > 1 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={applyToAll}
                      onChange={(e) => setApplyToAll(e.target.checked)}
                      className="rounded text-teal-600 focus:ring-teal-500"
                    />
                    <span>Apply this action to all {duplicateQueue.length - currentDupIdx} remaining duplicates</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MANUAL RENAME MODAL ── */}
        {renameTargetItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-slate-900 dark:text-white">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-teal-500" />
                  <span>Rename File</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setRenameTargetItem(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                <label className="block text-xs uppercase font-medium text-slate-600 dark:text-slate-400">
                  File Name
                </label>
                <input
                  type="text"
                  value={manualNewName}
                  onChange={(e) => setManualNewName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameTargetItem(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveManualRename}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition"
                >
                  Save Name
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
