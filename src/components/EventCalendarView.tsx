import React, { useState, useRef, useEffect } from "react";
import { DatePicker } from "./DatePicker";
import { logger } from "../lib/logger";
import { GroupEvent, Member, PhotoApprovalRequest } from "../types";
import {
  createEvent,
  submitEventRSVP,
  syncGoogleDriveUrl,
  parseYouTubeVideoUrl,
  deleteEvent as deleteEventApi,
} from "../services/apiClient";
import { AppStateManager } from "../services/storage";
import { FirebaseSyncManager } from "../services/firebaseService";
import { MemberAvatar } from "./MemberAvatar";
import { ReturnButton } from "./ReturnButton";
import { UsosaNewsCard } from "./UsosaNewsCard";
import { BirthdayCelebrationAnimation } from "./BirthdayCelebrationAnimation";
import {
  Calendar as CalendarIcon,
  MapPin,
  Clock,
   Users,
   CheckCircle2,
  X,
  Upload,
  Folder,
  Video,
  ImageIcon,
  ArrowLeft,
  Edit3,
  Trash2,
  Flame,
  ChevronRight,
  ChevronDown,
  Cake,
  Loader2,
  Sparkles,
} from "lucide-react";

interface EventCalendarViewProps {
  events: GroupEvent[];
  members: Member[];
  currentUser: Member | null;
  onRefreshEvents: () => void;
  originatingPageName?: string;
  defaultSubTab?: "media" | "calendar";
  onSubViewChange?: (isOpen: boolean) => void;
}

export const EventCalendarView: React.FC<EventCalendarViewProps> = ({
  events,
  members,
  currentUser,
  onRefreshEvents,
  defaultSubTab = "calendar",
  onSubViewChange,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isCreatingEventView, setIsCreatingEventView] = useState(false);
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<string | null>(null);

  // Form State
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [eventTime, setEventTime] = useState("09:00");
  const [eventLocation, setEventLocation] = useState("");
  const [eventCategory, setEventCategory] = useState<string>("meeting");
  const [eventDescription, setEventDescription] = useState("");
  const [driveUrlInput, setDriveUrlInput] = useState("");
  const [youtubeUrlInput, setYoutubeUrlInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File upload state
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [uploadingStatusText, setUploadingStatusText] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (onSubViewChange) {
      onSubViewChange(isCreatingEventView);
    }
  }, [isCreatingEventView, onSubViewChange]);

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingStatusText("⚡ Uploading to Firestore...");
    const newUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.readAsDataURL(file);
      });
      newUrls.push(dataUrl);

      const photoReq: PhotoApprovalRequest = {
        id: `req_fb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        memberId: currentUser?.id || "mem_1",
        memberName: currentUser?.fullName || "Community Member",
        memberEmail: currentUser?.email || "member@tarabateam.org",
        photoUrl: dataUrl,
        uploadedAt: new Date().toISOString(),
        status: "approved",
        adminNotes: `Media upload for ${eventTitle || "Community Event"}`,
        type: "photo",
      };
      try {
        await FirebaseSyncManager.saveApproval(photoReq);
      } catch (err) {
        logger.warn("Firebase photo save notice", { error: err });
      }
    }
    setUploadedImageUrls((prev) => [...prev, ...newUrls]);
    setUploadingStatusText("✅ Media saved to Firestore!");
    setTimeout(() => setUploadingStatusText(""), 3500);
    if (e.target) e.target.value = "";
  };

  const getDaysUntilEvent = (dateStr: string): number | null => {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const parts = dateStr.split("-");
    if (parts.length !== 3) return null;
    const eventDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    eventDateObj.setHours(0, 0, 0, 0);
    const diffTime = eventDateObj.getTime() - today.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const eventsInNext7Days = events
    .filter((e) => {
      const days = getDaysUntilEvent(e.date);
      return days !== null && days >= 0 && days <= 7;
    })
    .sort((a, b) => {
      const dA = getDaysUntilEvent(a.date) ?? 999;
      const dB = getDaysUntilEvent(b.date) ?? 999;
      return dA - dB;
    });

  const filteredEvents = events.filter((e) => {
    const days = getDaysUntilEvent(e.date);
    if (days !== null && days < -7) return false;
    if (selectedCategory === "next7days") {
      return days !== null && days >= 0 && days <= 7;
    }
    if (selectedCategory === "all") return true;
    return e.category === selectedCategory;
  });

  const dynamicCategories = Array.from(
    new Set(
      events
        .filter((e) => {
          const days = getDaysUntilEvent(e.date);
          return !(days !== null && days < -7);
        })
        .map((e) => e.category)
    )
  ).filter(Boolean).sort();

  // BIRTHDAYS FILTER: Current month, and next month's birthdays starting from the 25th of the current month
  const todayObj = new Date();
  const currentMonth = todayObj.getMonth() + 1; // 1-12
  const currentDay = todayObj.getDate(); // 1-31
  const nextMonth = (currentMonth % 12) + 1;

  const birthdaysList = members
    .filter((m) => {
      const dobStr = m.dateOfBirth || "";
      const bMonthRaw = (m as any).birthMonth;
      if (!dobStr && !bMonthRaw) return false;

      let bMonth = 0;
      
      // If birthMonth is explicitly provided (from legacy data or CSV)
      if (bMonthRaw) {
        bMonth = parseInt(bMonthRaw, 10);
        if (isNaN(bMonth) || bMonth === 0) {
          const months: Record<string, number> = {
            jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
            apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
            aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
            nov: 11, november: 11, dec: 12, december: 12
          };
          const lowercaseDob = String(bMonthRaw).toLowerCase();
          for (const [monthName, monthNum] of Object.entries(months)) {
            if (lowercaseDob.includes(monthName)) {
              bMonth = monthNum;
              break;
            }
          }
        }
      }

      // If we still don't have a month, try parsing dateOfBirth
      if (!bMonth && dobStr) {
        const parts = dobStr.split("-");
        if (parts.length === 3) {
          bMonth = parseInt(parts[1], 10);
        } else {
          const d = new Date(dobStr);
          if (!isNaN(d.getTime())) {
            bMonth = d.getMonth() + 1;
          } else {
            const months: Record<string, number> = {
              jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
              apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
              aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
              nov: 11, november: 11, dec: 12, december: 12
            };
            const lowercaseDob = dobStr.toLowerCase();
            for (const [monthName, monthNum] of Object.entries(months)) {
              if (lowercaseDob.includes(monthName)) {
                bMonth = monthNum;
                break;
              }
            }
          }
        }
      }

      if (!bMonth) return false;

      // Show if in current month
      if (bMonth === currentMonth) return true;
      // Show if current day >= 25 AND in next month
      if (currentDay >= 25 && bMonth === nextMonth) return true;

      return false;
    })
    .map((m) => ({
      memberId: m.id,
      memberName: m.fullName,
      photoUrl: m.photoUrl,
      fullDob: m.dateOfBirth || (((m as any).birthDay || "") + " " + ((m as any).birthMonth || "")).trim(),
    }));

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventDate || !eventLocation.trim()) return;
    setIsSubmitting(true);
    try {
      let driveImageUrls: string[] = [...uploadedImageUrls];
      let driveFolderId = undefined;
      if (driveUrlInput.trim()) {
        const driveData = await syncGoogleDriveUrl(driveUrlInput.trim());
        driveImageUrls = [...driveImageUrls, ...driveData.syncedImages];
        driveFolderId = driveData.folderId;
      }
      let youtubeEmbed = "";
      if (youtubeUrlInput.trim()) {
        const ytData = await parseYouTubeVideoUrl(youtubeUrlInput.trim());
        youtubeEmbed = ytData.embedUrl;
      }
      const newEvt = await createEvent({
        title: eventTitle,
        date: eventDate,
        time: eventTime,
        location: eventLocation,
        category: eventCategory,
        description: eventDescription,
        driveImageUrls,
        driveFolderId,
        youtubeVideoUrl: youtubeEmbed || youtubeUrlInput,
        createdBy: currentUser ? currentUser.fullName : "Team Member",
        createdById: currentUser ? currentUser.id : "mem_1",
      });

      const currentEvents = AppStateManager.getEvents();
      currentEvents.unshift(newEvt);
      AppStateManager.saveEvents(currentEvents);
      onRefreshEvents();
      setIsCreatingEventView(false);
      setEventTitle("");
      setEventDescription("");
      setDriveUrlInput("");
      setYoutubeUrlInput("");
    } catch (err) {
      logger.error("Event create error", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAdmin = currentUser?.role === "admin";

  const handleRSVP = async (eventId: string, status: "attending" | "maybe" | "declined") => {
    if (!currentUser || isAdmin) return;
    try {
      await submitEventRSVP(eventId, currentUser.id, status);
      onRefreshEvents();
    } catch (err) {
      logger.error("Event create error", err);
    }
  };
  const handleStartEditEvent = (evt: GroupEvent) => {
    setEventTitle(evt.title);
    setEventDate(evt.date);
    setEventTime(evt.time);
    setEventLocation(evt.location);
    setEventCategory(evt.category as any);
    setEventDescription(evt.description);
    setUploadedImageUrls(evt.driveImageUrls || []);
    setIsCreatingEventView(true);
  };

  const handleDeleteEvent = async (eventId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to permanently delete this media event upload?")) return;
    try {
      await FirebaseSyncManager.deleteEvent(eventId);
      await deleteEventApi(eventId);
    } catch (err) {
      logger.warn("Delete event notice", { error: err });
    }
    const current = AppStateManager.getEvents();
    const clean = current.filter((evt) => evt.id !== eventId);
    AppStateManager.saveEvents(clean);
    onRefreshEvents();
  };

  return (
    <div className="space-y-8 font-sans font-normal">
      {/* 1. CREATE EVENT VIEW */}
      {isCreatingEventView ? (
        <div className="space-y-8 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 shadow-sm flex flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-sm text-slate-900 dark:text-white tracking-tight font-normal">
                  Create Group Event
                </h1>
                <p className="text-xl text-teal-700 dark:text-teal-400 mt-1 font-normal">
                  Publish community cleanups, workshops, or celebrations
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <ReturnButton onClick={() => setIsCreatingEventView(false)} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 sm:p-10 shadow-sm space-y-8 font-normal">
            <form onSubmit={handleCreateEvent} className="space-y-8 max-w-5xl mx-auto font-normal">
              <div className="space-y-6 bg-slate-50 dark:bg-slate-950 p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
                <h2 className="text-2xl uppercase text-teal-800 dark:text-teal-400 border-b border-slate-200 dark:border-slate-800 pb-3 font-normal">
                  1. Basic Event Details
                </h2>
                <div>
                  <label className="block text-xl text-slate-700 dark:text-slate-300 mb-2 font-normal">
                    Event Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Taraba Riverbank Community Clean-up"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-normal"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-slate-700 dark:text-slate-300 mb-1.5 font-normal">
                      Event Date *
                    </label>
                    <div className="relative w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 py-3.5 flex items-center justify-between text-xl font-normal text-slate-900 dark:text-white cursor-pointer select-none">
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
                    <label className="block text-xl text-slate-700 dark:text-slate-300 mb-2 font-normal">
                      Event Time
                    </label>
                    <input
                      type="time"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-normal"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xl text-slate-700 dark:text-slate-300 mb-2 font-normal">
                      Location / Venue *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Jalingo Town Hall"
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-normal"
                    />
                  </div>
                  <div>
                    <label className="block text-xl text-slate-700 dark:text-slate-300 mb-2 font-normal">
                      Category
                    </label>
                    <select
                      value={eventCategory}
                      onChange={(e) => setEventCategory(e.target.value as any)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-normal"
                    >
                      <option value="cleanup">Cleanup & Environmental</option>
                      <option value="workshop">Workshop & Education</option>
                      <option value="celebration">Celebration & Reunion</option>
                      <option value="meeting">General Assembly Meeting</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xl text-slate-700 dark:text-slate-300 mb-2 font-normal">
                    Description & Agenda
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Detailed outline of event goals and logistics..."
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-3.5 text-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none font-normal"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end pt-6 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3.5 bg-teal-700 hover:bg-teal-800 text-white text-xl font-normal rounded-2xl transition shadow-sm flex items-center space-x-2.5 disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-6 h-6" />
                  <span>{isSubmitting ? "Publishing..." : "Publish Event Now"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* 3. MAIN CALENDAR VIEW CONTAINER - No background blocks */
        <div className="space-y-3 sm:space-y-4 font-normal">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
            <div className="space-y-3">
              <h1 className="text-xl sm:text-2xl font-normal tracking-tight text-slate-900 dark:text-white leading-tight">
                Updates
              </h1>
              <p className="text-sm sm:text-sm font-normal text-slate-600 dark:text-slate-300 leading-relaxed w-full">
                Community Gatherings, Activities & Member Birthdays
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
            </div>
          </div>

          {/* Filter Pills Bar */}
          <div className="flex flex-wrap items-center gap-3 font-normal">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-3 py-1.5 rounded-xl text-xs transition font-normal ${
                selectedCategory === "all"
                  ? "bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200 dark:border-slate-700"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              All Events
            </button>
            {eventsInNext7Days.length > 0 && (
              <button
                onClick={() => setSelectedCategory("next7days")}
                className={`px-3 py-1.5 rounded-xl text-xs transition flex items-center space-x-2 font-normal ${
                  selectedCategory === "next7days"
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-amber-700 dark:text-amber-400 hover:bg-amber-100/50"
                }`}
              >
                <Flame className="w-5 h-5" />
                <span>Next 7 Days ({eventsInNext7Days.length})</span>
              </button>
            )}
            {dynamicCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs capitalize transition font-normal ${
                  selectedCategory === cat
                    ? "bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* USOSA News Update Card — full width above events */}
          <div className="pt-1 font-normal">
            <UsosaNewsCard currentUser={currentUser} />
          </div>

          {/* Main Grid: Events & Birthdays */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 pt-1 font-normal">
            {/* Events Stream */}
            <div className="lg:col-span-3 space-y-6">
              {filteredEvents.length === 0 ? (
                <div className="py-16 text-center rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-8 text-slate-500 dark:text-slate-400 text-sm font-normal">
                  No events found for this category.
                </div>
              ) : (
                filteredEvents.map((event) => {
                  const isAttending = currentUser ? event.attendeeIds.includes(currentUser.id) : false;
                  const daysUntil = getDaysUntilEvent(event.date);
                  const isWithin7Days = daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;
                  const isPastWithin7Days = daysUntil !== null && daysUntil < 0 && daysUntil >= -7;
                  return (
                    <div
                      key={event.id}
                      className={`group relative bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden font-normal ${
                        isPastWithin7Days ? "opacity-90" : ""
                      }`}
                    >
                      {isWithin7Days && (
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 to-orange-500" />
                      )}
                      
                      {/* Top Row: Date & Title */}
                      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
                        {/* Date Icon Display */}
                        <div className="flex flex-col items-center justify-center shrink-0 min-w-[110px] rounded-2xl p-5 h-fit bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-normal">
                          <span className="text-xs uppercase tracking-wider text-cyan-700 dark:text-cyan-400 font-normal">
                            {new Date(event.date).toLocaleString("default", { month: "short" })}
                          </span>
                          <span className="text-2xl sm:text-sm sm:text-base text-slate-900 dark:text-white tracking-tight leading-none mt-2 font-normal">
                            {new Date(event.date).getDate()}
                          </span>
                        </div>
                        
                        <div className="flex-1 w-full">
                          <h3 className="text-lg sm:text-2xl text-slate-900 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition leading-snug font-normal break-words">
                            {event.title}
                          </h3>
                        </div>
                      </div>

                      {/* Lower Text Block */}
                      <div className="mt-5 sm:mt-6 w-full font-normal">
                        <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600 dark:text-slate-300 font-normal">
                          <span className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300">
                            <Clock className="w-5 h-5 text-cyan-600 shrink-0" />
                            <span>{event.time}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-slate-400 shrink-0" />
                            <span>{event.location}</span>
                          </span>
                        </div>
                        {event.description && (
                          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-normal whitespace-pre-wrap break-words">
                            {event.description}
                          </p>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-sm px-1 font-normal">
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/40 text-xs font-normal shrink-0">
                            {event.category}
                          </span>
                          {currentUser && !isAdmin && (
                            <div className="flex items-center space-x-2 sm:space-x-3">
                              <button
                                onClick={() => handleRSVP(event.id, "attending")}
                                className={`px-3 py-1.5 rounded-2xl text-xs sm:text-xs transition font-normal cursor-pointer ${
                                  isAttending
                                    ? "bg-emerald-600 text-white shadow-sm"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                }`}
                              >
                                <span>Yes</span>
                              </button>
                              <button
                                onClick={() => handleRSVP(event.id, "maybe")}
                                className={`px-3 py-1.5 rounded-2xl text-xs sm:text-xs transition font-normal cursor-pointer ${
                                  (event.maybeIds || []).includes(currentUser.id)
                                    ? "bg-amber-500 text-slate-950 shadow-sm font-normal"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                }`}
                              >
                                <span>Maybe</span>
                              </button>
                              <button
                                onClick={() => handleRSVP(event.id, "declined")}
                                className={`px-3 py-1.5 rounded-2xl text-xs sm:text-xs transition font-normal cursor-pointer ${
                                  (event.declinedIds || []).includes(currentUser.id)
                                    ? "bg-red-600 text-white shadow-sm"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-950/40"
                                }`}
                              >
                                <span>No</span>
                              </button>
                            </div>
                          )}
                          {/* Edit & Delete Buttons: Visible only to original uploader or Admin */}
                          {(isAdmin || (currentUser && event.createdById === currentUser.id)) && (
                            <div className="flex items-center space-x-2 ml-auto">
                              <button
                                onClick={() => handleStartEditEvent(event)}
                                className="px-3 py-1 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/40 text-xs font-normal hover:bg-cyan-100 dark:hover:bg-cyan-900 transition flex items-center space-x-1.5 cursor-pointer"
                                title="Edit Upload Details"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={(e) => handleDeleteEvent(event.id, e)}
                                className="px-3 py-1 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/40 text-xs font-normal hover:bg-red-100 dark:hover:bg-red-900 transition flex items-center space-x-1.5 cursor-pointer"
                                title="Delete Upload"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Birthdays Sidebar */}
            <div className="lg:col-span-2">
              <div className="bg-slate-50 dark:bg-slate-950 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 font-normal">
                <div className="flex items-center space-x-4 pb-3 border-b border-slate-200 dark:border-slate-800 -mx-6 px-6">
                  <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 flex items-center justify-center shrink-0">
                    <Cake className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm text-slate-900 dark:text-white tracking-tight font-normal">
                    Member Birthdays
                  </h3>
                </div>

                <div className="space-y-4">
                  {birthdaysList.length === 0 ? (
                    <div className="py-6 text-center text-slate-500 dark:text-slate-400 text-sm font-normal">
                      No upcoming member birthdays.
                    </div>
                  ) : (
                    birthdaysList.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between group">
                        <div className="flex items-center space-x-4 min-w-0">
                          <MemberAvatar
                            member={{ fullName: item.memberName, photoUrl: item.photoUrl }}
                            sizeClassName="w-12 h-12"
                            textClassName="text-sm font-normal"
                          />
                          <div className="min-w-0">
                            <BirthdayCelebrationAnimation>
                              <span className="text-sm sm:text-sm text-slate-900 dark:text-white truncate block group-hover:text-purple-600 transition-colors font-normal">
                                {item.memberName}
                              </span>
                            </BirthdayCelebrationAnimation>
                            <span className="text-sm text-slate-500 font-normal">{item.fullDob}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
