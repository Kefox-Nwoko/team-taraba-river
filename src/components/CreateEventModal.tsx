import React, { useState, useEffect, useRef } from "react";
import { DatePicker } from "./DatePicker";
import { logger } from "../lib/logger";
import { Member, GroupEvent } from "../types";
import { createEvent, updateEvent } from "../services/apiClient";
import { AppStateManager } from "../services/storage";
import { FirebaseSyncManager } from "../services/firebaseService";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../lib/firebase";
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  CheckCircle2,
  Plus,
  Sparkles,
  ChevronDown,
  Edit,
  Image as ImageIcon,
  Upload,
  Loader2,
} from "lucide-react";
import { CategoryMultiSelect } from "./CategoryMultiSelect";
import { parseEventCategories, formatEventCategories } from "../constants/eventCategories";

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Member | null;
  onSuccess: (event?: GroupEvent) => void;
  eventToEdit?: GroupEvent | null;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSuccess,
  eventToEdit,
}) => {
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventTime, setEventTime] = useState("09:00");
  const [eventLocation, setEventLocation] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["General Announcement"]);
  const [eventDescription, setEventDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Digital announcement poster — uploaded directly to Firebase Storage so
  // the form always holds a ready-to-save URL, same pattern as media uploads.
  const [posterUrl, setPosterUrl] = useState("");
  const [posterUploadPct, setPosterUploadPct] = useState<number | null>(null);
  const [posterError, setPosterError] = useState<string | null>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (eventToEdit) {
      setEventTitle(eventToEdit.title || "");
      setEventDate(eventToEdit.date || new Date().toISOString().split("T")[0]);
      setEventEndDate(eventToEdit.endDate || "");
      setEventTime(eventToEdit.time || "09:00");
      setEventLocation(eventToEdit.location || "");
      setSelectedCategories(parseEventCategories(eventToEdit.category));
      setEventDescription(eventToEdit.description || "");
      setPosterUrl(eventToEdit.posterUrl || "");
    } else {
      setEventTitle("");
      setEventDate(new Date().toISOString().split("T")[0]);
      setEventEndDate("");
      setEventTime("09:00");
      setEventLocation("");
      setSelectedCategories(["Meeting"]);
      setEventDescription("");
      setPosterUrl("");
    }
    setPosterUploadPct(null);
    setPosterError(null);
  }, [eventToEdit, isOpen]);

  const handlePosterFileSelect = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPosterError("Please select an image file (JPG, PNG, or WEBP).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setPosterError("Poster image must be under 8MB.");
      return;
    }
    setPosterError(null);
    setPosterUploadPct(0);
    try {
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storageRef = ref(storage, `events/posters/${Date.now()}_${cleanName}`);
      const uploadTask = uploadBytesResumable(storageRef, file, { contentType: file.type });

      const downloadUrl = await new Promise<string>((resolve, reject) => {
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            if (snapshot.totalBytes > 0) {
              setPosterUploadPct(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
            }
          },
          reject,
          async () => {
            try {
              resolve(await getDownloadURL(uploadTask.snapshot.ref));
            } catch (e) {
              reject(e);
            }
          }
        );
      });

      setPosterUrl(downloadUrl);
    } catch (err: any) {
      logger.error("Poster upload error", err);
      setPosterError(err?.message || "Poster upload failed. Please try again.");
    } finally {
      setPosterUploadPct(null);
    }
  };

  const handleRemovePoster = () => {
    if (posterUrl && posterUrl.includes("firebasestorage.googleapis.com")) {
      try {
        deleteObject(ref(storage, posterUrl)).catch(() => {});
      } catch {}
    }
    setPosterUrl("");
    setPosterError(null);
    if (posterInputRef.current) posterInputRef.current.value = "";
  };

  if (!isOpen) return null;

  const formatDateLabel = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventDate || !eventLocation.trim()) {
      setErrorMessage("Please fill in all required fields (Title, Date, Location).");
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    let savedEvent: GroupEvent | null = null;
    const categoryString = formatEventCategories(selectedCategories);
    try {
      if (eventToEdit) {
        // Edit mode
        const updated = await updateEvent(eventToEdit.id, {
          title: eventTitle.trim(),
          date: eventDate,
          endDate: eventEndDate && eventEndDate !== eventDate ? eventEndDate : undefined,
          time: eventTime,
          location: eventLocation.trim(),
          category: categoryString,
          description: eventDescription.trim(),
          driveImageUrls: eventToEdit.driveImageUrls || [],
          driveFolderId: eventToEdit.driveFolderId || '',
          youtubeVideoUrl: eventToEdit.youtubeVideoUrl || '',
          posterUrl: posterUrl || '',
        });
        const currentEvents = AppStateManager.getEvents();
        const idx = currentEvents.findIndex((ev) => ev.id === eventToEdit.id);
        if (idx !== -1) {
          currentEvents[idx] = updated;
        } else {
          currentEvents.unshift(updated);
        }
        AppStateManager.saveEvents(currentEvents);
        try {
          await FirebaseSyncManager.saveEvent(updated);
        } catch {}
        savedEvent = updated;
      } else {
        // Create mode
        const newEvt = await createEvent({
          title: eventTitle.trim(),
          date: eventDate,
          endDate: eventEndDate && eventEndDate !== eventDate ? eventEndDate : undefined,
          time: eventTime,
          location: eventLocation.trim(),
          category: categoryString,
          description: eventDescription.trim(),
          driveImageUrls: [],
          youtubeVideoUrl: "",
          posterUrl: posterUrl || "",
          createdBy: currentUser ? currentUser.fullName : "Community Member",
          createdById: currentUser ? currentUser.id : "mem_admin",
        });
        const currentEvents = AppStateManager.getEvents();
        const existingIdx = currentEvents.findIndex((ev) => ev.id === newEvt.id);
        if (existingIdx >= 0) {
          currentEvents[existingIdx] = newEvt;
        } else {
          currentEvents.unshift(newEvt);
        }
        AppStateManager.saveEvents(currentEvents);
        try {
          await FirebaseSyncManager.saveEvent(newEvt);
        } catch {}
        savedEvent = newEvt;
      }
      await Promise.resolve(onSuccess(savedEvent));
      onClose();
    } catch (err: any) {
      logger.error("Save event error", err);
      setErrorMessage(err.message || "Failed to save event. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-2xl my-8 bg-white dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-3xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Modal Header */}
        <div className="bg-teal-800 dark:bg-slate-900 text-white p-6 sm:p-8 flex items-center justify-between relative">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 px-3 py-0.5 rounded-full bg-white/20 text-amber-300 text-xs uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> <span>Admin Management</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight">
              {eventToEdit ? "Edit Event / Announcement" : "Create New Group Event"}
            </h2>
            <p className="text-xs sm:text-sm text-teal-100 dark:text-slate-400">
              {eventToEdit
                ? "Update event schedule, venue details, category, or agenda instructions"
                : "Publish official team meetings, hangouts, workshops, social activities or celebrations"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-300 text-sm">
              {errorMessage}
            </div>
          )}

          {/* Section 1: Event Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400 border-b border-slate-100 dark:border-slate-800 pb-2">
              1. Basic Event Information
            </h3>
            <div>
              <label className="block text-xs uppercase font-medium text-slate-700 dark:text-slate-300 mb-1">
                Event Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Taraba Riverbank Community Clean-up & Assembly"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#2A2A2A] border-none rounded-2xl px-5 py-4 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition shadow-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Start Date *
                </label>
                <div className="relative w-full rounded-2xl bg-slate-50 dark:bg-[#2A2A2A] border-none px-5 py-4 flex items-center justify-between text-sm text-slate-900 dark:text-white cursor-pointer select-none">
                  <span className="truncate">{formatDateLabel(eventDate)}</span>
                  <div className="flex items-center space-x-1 text-slate-400 dark:text-slate-500 shrink-0">
                    <CalendarIcon className="w-4 h-4" />
                    <ChevronDown className="w-4 h-4 text-cyan-500" />
                  </div>
                  <DatePicker
                    value={eventDate}
                    onChange={(val) => {
                      setEventDate(val);
                      if (eventEndDate && val > eventEndDate) {
                        setEventEndDate(val);
                      }
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs uppercase font-medium text-slate-700 dark:text-slate-300">
                    End Date (Optional)
                  </label>
                  {eventEndDate && eventEndDate !== eventDate && (
                    <button
                      type="button"
                      onClick={() => setEventEndDate("")}
                      className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                    >
                      Single Day
                    </button>
                  )}
                </div>
                <div className="relative w-full rounded-2xl bg-slate-50 dark:bg-[#2A2A2A] border-none px-5 py-4 flex items-center justify-between text-sm text-slate-900 dark:text-white cursor-pointer select-none">
                  <span className={`truncate ${!eventEndDate || eventEndDate === eventDate ? "text-slate-400 dark:text-slate-500" : "text-cyan-600 dark:text-cyan-400 font-semibold"}`}>
                    {eventEndDate && eventEndDate !== eventDate ? formatDateLabel(eventEndDate) : "Same Day (1-Day Event)"}
                  </span>
                  <div className="flex items-center space-x-1 text-slate-400 dark:text-slate-500 shrink-0">
                    <CalendarIcon className="w-4 h-4" />
                    <ChevronDown className="w-4 h-4 text-cyan-500" />
                  </div>
                  <DatePicker
                    value={eventEndDate || eventDate}
                    minDate={eventDate}
                    onChange={(val) => {
                      if (val && val >= eventDate) {
                        setEventEndDate(val);
                      } else {
                        setEventEndDate(eventDate);
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Multi-day duration banner */}
            {eventEndDate && eventEndDate > eventDate && (
              <div className="p-3.5 bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/70 rounded-2xl flex items-center justify-between text-xs text-cyan-900 dark:text-cyan-200">
                <span className="font-bold flex items-center gap-1.5">
                  <span>📅</span>
                  <span>
                    Multi-Day Activity: {Math.max(1, Math.round((new Date(eventEndDate).getTime() - new Date(eventDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)} Days Duration
                  </span>
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {formatDateLabel(eventDate)} ➔ {formatDateLabel(eventEndDate)}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Event Time
                </label>
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#2A2A2A] border-none rounded-2xl px-5 py-4 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Location / Venue *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Port Harcourt Club / Unity Lounge"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#2A2A2A] border-none rounded-2xl px-5 py-4 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition shadow-sm"
                />
              </div>
            </div>

            <CategoryMultiSelect
              selectedCategories={selectedCategories}
              onChange={setSelectedCategories}
            />

            <div>
              <label className="block text-xs uppercase font-medium text-slate-700 dark:text-slate-300 mb-1">
                Description & Agenda
              </label>
              <textarea
                rows={4}
                placeholder="Detailed outline of event goals, logistics, and instructions for members..."
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#2A2A2A] border-none rounded-2xl px-5 py-4 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition resize-none shadow-sm"
              />
            </div>
          </div>

          {/* Section 2: Digital Poster */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400 border-b border-slate-100 dark:border-slate-800 pb-2">
              2. Digital Poster (Optional)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Add a flyer or announcement graphic to feature this event on the Home page.
            </p>

            <input
              ref={posterInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePosterFileSelect(e.target.files?.[0])}
            />

            {posterUrl ? (
              <div className="flex flex-col sm:flex-row gap-4 p-4 bg-slate-50 dark:bg-[#2A2A2A] rounded-2xl">
                <img
                  src={posterUrl}
                  alt="Event poster preview"
                  className="w-full sm:w-40 h-40 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shrink-0"
                />
                <div className="flex flex-col justify-between gap-3">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    This poster will display on the Home page announcement card — image beside the event details on larger screens, image above the details on phones.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => posterInputRef.current?.click()}
                      className="px-3.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={handleRemovePoster}
                      className="px-3.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 hover:text-rose-600 dark:hover:text-rose-400 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-800 transition cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => posterInputRef.current?.click()}
                disabled={posterUploadPct !== null}
                className="w-full flex flex-col items-center justify-center gap-2 py-8 bg-slate-50 dark:bg-[#2A2A2A] hover:bg-slate-100 dark:hover:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl transition cursor-pointer disabled:opacity-60"
              >
                {posterUploadPct !== null ? (
                  <>
                    <Loader2 className="w-6 h-6 text-teal-600 dark:text-teal-400 animate-spin" />
                    <span className="text-xs text-slate-600 dark:text-slate-300">Uploading… {posterUploadPct}%</span>
                  </>
                ) : (
                  <>
                    <div className="w-11 h-11 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" /> Upload Poster Image
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">JPG, PNG, or WEBP — up to 8MB</span>
                  </>
                )}
              </button>
            )}

            {posterError && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{posterError}</p>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-xl transition shadow-lg shadow-teal-700/20 flex items-center space-x-2 disabled:opacity-50 active:scale-95 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? "Saving..." : (eventToEdit ? "Save Changes" : "Publish Event")}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
