import React, { useState, useEffect } from "react";
import { DatePicker } from "./DatePicker";
import { logger } from "../lib/logger";
import { Member, GroupEvent } from "../types";
import { createEvent, updateEvent } from "../services/apiClient";
import { AppStateManager } from "../services/storage";
import { FirebaseSyncManager } from "../services/firebaseService";
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
} from "lucide-react";

interface CreateEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Member | null;
  onSuccess: () => void;
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
  const [eventTime, setEventTime] = useState("09:00");
  const [eventLocation, setEventLocation] = useState("");
  const [eventCategory, setEventCategory] = useState<string>("");
  const [eventDescription, setEventDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (eventToEdit) {
      setEventTitle(eventToEdit.title || "");
      setEventDate(eventToEdit.date || new Date().toISOString().split("T")[0]);
      setEventTime(eventToEdit.time || "09:00");
      setEventLocation(eventToEdit.location || "");
      setEventCategory(eventToEdit.category || "");
      setEventDescription(eventToEdit.description || "");
    } else {
      setEventTitle("");
      setEventDate(new Date().toISOString().split("T")[0]);
      setEventTime("09:00");
      setEventLocation("");
      setEventCategory("");
      setEventDescription("");
    }
  }, [eventToEdit, isOpen]);

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
    try {
      if (eventToEdit) {
        // Edit mode
        const updated = await updateEvent(eventToEdit.id, {
          title: eventTitle.trim(),
          date: eventDate,
          time: eventTime,
          location: eventLocation.trim(),
          category: eventCategory.trim() || "General",
          description: eventDescription.trim(),
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
      } else {
        // Create mode
        const newEvt = await createEvent({
          title: eventTitle.trim(),
          date: eventDate,
          time: eventTime,
          location: eventLocation.trim(),
          category: eventCategory.trim() || "General",
          description: eventDescription.trim(),
          driveImageUrls: [],
          youtubeVideoUrl: "",
          createdBy: currentUser ? currentUser.fullName : "Admin User",
          createdById: currentUser ? currentUser.id : "mem_1",
        });
        const currentEvents = AppStateManager.getEvents();
        currentEvents.unshift(newEvt);
        AppStateManager.saveEvents(currentEvents);
        try {
          await FirebaseSyncManager.saveEvent(newEvt);
        } catch {}
      }
      onSuccess();
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
                  Event Date *
                </label>
                <div className="relative w-full rounded-2xl bg-slate-50 dark:bg-[#2A2A2A] border-none px-5 py-4 flex items-center justify-between text-sm text-slate-900 dark:text-white cursor-pointer select-none">
                  <span className="truncate">{formatDateLabel(eventDate)}</span>
                  <div className="flex items-center space-x-1 text-slate-400 dark:text-slate-500 shrink-0">
                    <CalendarIcon className="w-4 h-4" />
                    <ChevronDown className="w-4 h-4 text-cyan-500" />
                  </div>
                  <DatePicker
                    value={eventDate}
                    onChange={setEventDate}
                    required
                  />
                </div>
              </div>

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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Location / Venue *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jalingo Town Hall / Port Harcourt Venue"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#2A2A2A] border-none rounded-2xl px-5 py-4 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Category (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cleanup, Workshop, Hangout..."
                  value={eventCategory}
                  onChange={(e) => setEventCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#2A2A2A] border-none rounded-2xl px-5 py-4 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition shadow-sm"
                />
              </div>
            </div>

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
