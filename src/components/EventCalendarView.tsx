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
import { isOfficialFutureEvent, getDaysUntilEvent } from "../utils/eventUtils";
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

  const formatDateLabel = (dateStr?: string) => {
    if (!dateStr || typeof dateStr !== "string") return "";
    try {
      const parts = dateStr.split("-");
      if (parts.length < 3) return dateStr;
      const [year, month, day] = parts;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr || "";
    }
  };

  // STRICT RULE: Only official future chapter events (excludes past events and media gallery folders)
  const officialUpcomingEvents = events.filter(isOfficialFutureEvent);

  const eventsInNext7Days = officialUpcomingEvents
    .filter((e) => {
      const days = getDaysUntilEvent(e.date);
      return days !== null && days >= 0 && days <= 7;
    })
    .sort((a, b) => {
      const dA = getDaysUntilEvent(a.date) ?? 999;
      const dB = getDaysUntilEvent(b.date) ?? 999;
      return dA - dB;
    });

  const filteredEvents = officialUpcomingEvents
    .filter((e) => {
      if (selectedCategory === "next7days") {
        const days = getDaysUntilEvent(e.date);
        return days !== null && days >= 0 && days <= 7;
      }
      if (selectedCategory === "all") return true;
      return e.category === selectedCategory;
    })
    .sort((a, b) => {
      const dA = getDaysUntilEvent(a.date) ?? 999;
      const dB = getDaysUntilEvent(b.date) ?? 999;
      return dA - dB;
    });

  const dynamicCategories = Array.from(
    new Set(officialUpcomingEvents.map((e) => e.category))
  ).filter(Boolean).sort();

  // BIRTHDAYS FILTER: Current month, and next month's birthdays starting from the 25th of the current month
  const todayObj = new Date();
  const currentMonth = todayObj.getMonth() + 1; // 1-12
  const currentDay = todayObj.getDate(); // 1-31
  const nextMonth = (currentMonth % 12) + 1;

  const monthMap: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, september: 9, oct: 10, october: 10,
    nov: 11, november: 11, dec: 12, december: 12
  };

  const birthdaysList = members
    .map((m) => {
      const dobStr = (m.dateOfBirth || "").trim();
      const bMonthRaw = (m as any).birthMonth;
      const bDayRaw = (m as any).birthDay;

      let bMonth = 0;
      let bDay = 0;

      if (bDayRaw) bDay = parseInt(bDayRaw, 10) || 0;
      if (bMonthRaw) {
        bMonth = parseInt(bMonthRaw, 10) || 0;
        if (isNaN(bMonth) || bMonth === 0) {
          const lowercase = String(bMonthRaw).toLowerCase();
          for (const [mName, mNum] of Object.entries(monthMap)) {
            if (lowercase.includes(mName)) {
              bMonth = mNum;
              break;
            }
          }
        }
      }

      if (dobStr) {
        const isoMatch = dobStr.match(/^\d{4}-(\d{1,2})-(\d{1,2})$/);
        if (isoMatch) {
          bMonth = parseInt(isoMatch[1], 10);
          bDay = parseInt(isoMatch[2], 10);
        } else {
          const cleanDob = dobStr.replace(/(\d+)(st|nd|rd|th)/gi, "$1").toLowerCase();
          for (const [mName, mNum] of Object.entries(monthMap)) {
            if (cleanDob.includes(mName)) {
              bMonth = mNum;
              const dayMatch = cleanDob.match(/\b([0-2]?[0-9]|3[01])\b/);
              if (dayMatch) {
                bDay = parseInt(dayMatch[1], 10);
              }
              break;
            }
          }
        }
      }

      const isToday = bMonth === currentMonth && bDay === currentDay;
      // Birthdays that have passed (bDay < currentDay) disappear once the day is over
      const isUpcomingThisMonth = bMonth === currentMonth && bDay >= currentDay;
      const isNextMonthNearEnd = currentDay >= 25 && bMonth === nextMonth;

      const isVisible = isUpcomingThisMonth || isNextMonthNearEnd;

      return {
        memberId: m.id,
        memberName: m.fullName,
        photoUrl: m.photoUrl,
        fullDob: m.dateOfBirth || (((m as any).birthDay || "") + " " + ((m as any).birthMonth || "")).trim(),
        bDay,
        bMonth,
        isToday,
        isVisible,
      };
    })
    .filter((item) => item.isVisible)
    .sort((a, b) => {
      // 1. Today's celebrants come first
      if (a.isToday && !b.isToday) return -1;
      if (!a.isToday && b.isToday) return 1;
      // 2. Sort chronologically by day
      if (a.bMonth === b.bMonth) return a.bDay - b.bDay;
      return a.bMonth - b.bMonth;
    });

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

  const handleRSVP = async (eventId: string, status: "attending" | "maybe" | "declined") => {
    if (!currentUser) return;
    const memberId = currentUser.id;

    // 1. Optimistic Real-Time Local & Firestore Sync
    const currentEvents = AppStateManager.getEvents();
    const evtIndex = currentEvents.findIndex((e) => e.id === eventId);
    if (evtIndex !== -1) {
      const evt = currentEvents[evtIndex];
      const newAttendeeIds = (evt.attendeeIds || []).filter((id) => id !== memberId);
      const newMaybeIds = (evt.maybeIds || []).filter((id) => id !== memberId);
      const newDeclinedIds = (evt.declinedIds || []).filter((id) => id !== memberId);

      if (status === "attending") {
        newAttendeeIds.push(memberId);
      } else if (status === "maybe") {
        newMaybeIds.push(memberId);
      } else if (status === "declined") {
        newDeclinedIds.push(memberId);
      }

      const updatedEvt: GroupEvent = {
        ...evt,
        attendeeIds: newAttendeeIds,
        maybeIds: newMaybeIds,
        declinedIds: newDeclinedIds,
      };

      currentEvents[evtIndex] = updatedEvt;
      AppStateManager.saveEvents(currentEvents);
      try {
        await FirebaseSyncManager.saveEvent(updatedEvt);
      } catch (e) {
        logger.warn("Firebase RSVP sync notice", { error: e });
      }
    }

    // 2. Also notify backend API
    try {
      await submitEventRSVP(eventId, memberId, status);
    } catch (err) {
      logger.error("Event RSVP API sync", err);
    }

    onRefreshEvents();
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
                  const isAttending = currentUser ? (event.attendeeIds || []).includes(currentUser.id) : false;
                  const isMaybe = currentUser ? (event.maybeIds || []).includes(currentUser.id) : false;
                  const isDeclined = currentUser ? (event.declinedIds || []).includes(currentUser.id) : false;
                  const isAdmin = currentUser?.role === "admin";
                  const daysUntil = getDaysUntilEvent(event.date);
                  const isWithin7Days = daysUntil !== null && daysUntil >= 0 && daysUntil <= 7;
                  const isPastWithin7Days = daysUntil !== null && daysUntil < 0 && daysUntil >= -7;
                  return (
                    <div
                      key={event.id}
                      className={`group relative bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 dark:border-slate-800 hover:border-cyan-500/60 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 overflow-hidden font-normal ${
                        isPastWithin7Days ? "opacity-90" : ""
                      }`}
                    >
                      {isWithin7Days && (
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber-400 to-orange-500" />
                      )}

                      {/* Left: Compact Date Tag & Event Details in straight alignment */}
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 pl-1">
                        {/* Compact Date Box */}
                        <div className="flex flex-col items-center justify-center shrink-0 w-12 sm:w-14 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-center font-normal">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-600 dark:text-cyan-400 leading-none">
                            {new Date(event.date).toLocaleString("default", { month: "short" })}
                          </span>
                          <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight mt-0.5">
                            {new Date(event.date).getDate()}
                          </span>
                        </div>

                        {/* Event Title & Metadata (Time, Location, Description) */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition truncate">
                              {event.title}
                            </h3>
                            {event.category && (
                              <span className="px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/40 text-[11px] font-medium shrink-0">
                                {event.category}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 sm:gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1 shrink-0">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{event.time}</span>
                            </span>
                            <span className="flex items-center gap-1 truncate">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{event.location}</span>
                            </span>
                            {event.description && (
                              <span className="hidden xl:inline text-slate-400 dark:text-slate-500 truncate max-w-xs">
                                • {event.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Inline RSVP Buttons (Members Only) & Admin Edit/Delete Controls */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800/60">
                        {/* Member RSVP Buttons (Shown ONLY to regular members, hidden for Admin) */}
                        {currentUser && !isAdmin && (
                          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl gap-1">
                            <button
                              type="button"
                              onClick={() => handleRSVP(event.id, "attending")}
                              className={`px-3 py-1 rounded-lg text-xs transition cursor-pointer font-medium ${
                                isAttending
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:bg-white dark:hover:bg-slate-700"
                              }`}
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRSVP(event.id, "maybe")}
                              className={`px-3 py-1 rounded-lg text-xs transition cursor-pointer font-medium ${
                                isMaybe
                                  ? "bg-amber-500 text-slate-950 shadow-xs"
                                  : "text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:bg-white dark:hover:bg-slate-700"
                              }`}
                            >
                              Maybe
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRSVP(event.id, "declined")}
                              className={`px-3 py-1 rounded-lg text-xs transition cursor-pointer font-medium ${
                                isDeclined
                                  ? "bg-red-600 text-white shadow-xs"
                                  : "text-slate-600 dark:text-slate-300 hover:text-red-600 hover:bg-white dark:hover:bg-slate-700"
                              }`}
                            >
                              No
                            </button>
                          </div>
                        )}

                        {/* Admin Event Controls */}
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditEvent(event)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                              title="Edit Event"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteEvent(event.id, e)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                              title="Delete Event"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
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

                <div className="space-y-2.5">
                  {birthdaysList.length === 0 ? (
                    <div className="py-6 text-center text-slate-500 dark:text-slate-400 text-sm font-normal">
                      No upcoming member birthdays.
                    </div>
                  ) : (
                    birthdaysList.map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between group py-1.5 px-2.5 rounded-2xl transition-all ${
                          item.isToday
                            ? "bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-amber-500/10 dark:from-pink-950/40 dark:via-purple-950/40 dark:to-amber-950/30 border border-pink-500/30 dark:border-pink-500/40 shadow-xs"
                            : ""
                        }`}
                      >
                        <div className="flex items-center space-x-3.5 min-w-0">
                          <div className="relative shrink-0">
                            <MemberAvatar
                              member={{ fullName: item.memberName, photoUrl: item.photoUrl }}
                              sizeClassName={item.isToday ? "w-13 h-13 ring-2 ring-pink-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900" : "w-12 h-12"}
                              textClassName="text-sm font-normal"
                            />
                            {item.isToday && (
                              <span className="absolute -bottom-1 -right-1 text-sm select-none" title="Birthday Celebrant!">
                                🎂
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            {item.isToday ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <BirthdayCelebrationAnimation autoPlay durationMs={6000}>
                                  <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate block tracking-wide">
                                    {item.memberName}
                                  </span>
                                </BirthdayCelebrationAnimation>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-pink-500 to-amber-500 text-white shadow-xs animate-pulse">
                                  🎉 Birthday Today!
                                </span>
                              </div>
                            ) : (
                              <BirthdayCelebrationAnimation autoPlay={false}>
                                <span className="text-sm sm:text-sm text-slate-900 dark:text-white truncate block group-hover:text-purple-600 transition-colors font-normal">
                                  {item.memberName}
                                </span>
                              </BirthdayCelebrationAnimation>
                            )}
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-normal">
                              {item.isToday ? (
                                <span className="text-pink-600 dark:text-pink-400 font-semibold">{item.fullDob} • Today</span>
                              ) : (
                                item.fullDob
                              )}
                            </p>
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
