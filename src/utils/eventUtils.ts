import { GroupEvent } from "../types";

/**
 * Robustly parses any valid date format into local midnight Date.
 * Handles YYYY-MM-DD, YYYY/MM/DD, DD-MM-YYYY, DD/MM/YYYY, ISO strings.
 */
export function parseEventDateObj(dateStr?: string | null): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const clean = dateStr.trim();
  if (!clean) return null;

  // YYYY-MM-DD or YYYY/MM/DD
  const ymd = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    const y = parseInt(ymd[1], 10);
    const m = parseInt(ymd[2], 10) - 1;
    const d = parseInt(ymd[3], 10);
    const dt = new Date(y, m, d);
    dt.setHours(0, 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    const d = parseInt(dmy[1], 10);
    const m = parseInt(dmy[2], 10) - 1;
    const y = parseInt(dmy[3], 10);
    const dt = new Date(y, m, d);
    dt.setHours(0, 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }

  const fallback = new Date(clean);
  if (!isNaN(fallback.getTime())) {
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
  return null;
}

/**
 * Checks if an event is a genuine chapter event (not a synced Google Drive media album or archived media folder).
 */
export function isChapterEvent(event: GroupEvent): boolean {
  if (!event || !event.id) return false;
  const id = event.id.toLowerCase();
  return !(
    id.startsWith("gdrive_") ||
    id.startsWith("folder_") ||
    id.startsWith("media_") ||
    id.startsWith("album_") ||
    id.startsWith("evt_arch_") ||
    id === "evt_taraba_gdrive"
  );
}

/**
 * Sanitizes an event record for reliable persistence in Firestore and LocalStorage.
 * Guarantees NO undefined fields (which crash Firestore setDoc).
 */
export function sanitizeEventRecord(event: Partial<GroupEvent>): GroupEvent {
  const cleanEndDate =
    event.endDate && event.endDate.trim() && event.endDate.trim() !== (event.date || "").trim()
      ? event.endDate.trim()
      : "";

  const cleanEvent: GroupEvent = {
    id: event.id && event.id.trim() ? event.id.trim() : `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: (event.title || "").trim() || "Community Event",
    date: (event.date || "").trim() || new Date().toISOString().split("T")[0],
    time: (event.time || "").trim() || "09:00",
    location: (event.location || "").trim().toLowerCase().includes("taraba river") ? "" : (event.location || "").trim(),
    category: (event.category || "").trim() || "General",
    description: (event.description || "").trim(),
    driveImageUrls: Array.isArray(event.driveImageUrls) ? event.driveImageUrls.filter(Boolean) : [],
    driveFolderId: (event.driveFolderId || "").trim() || `drive_folder_${Date.now()}`,
    youtubeVideoUrls: Array.isArray(event.youtubeVideoUrls)
      ? event.youtubeVideoUrls.filter((u): u is string => typeof u === "string" && Boolean(u.trim()))
      : (event.youtubeVideoUrl && event.youtubeVideoUrl.trim() ? [event.youtubeVideoUrl.trim()] : []),
    youtubeVideoUrl: (event.youtubeVideoUrl || "").trim() || (Array.isArray(event.youtubeVideoUrls) && event.youtubeVideoUrls[0] ? event.youtubeVideoUrls[0] : ""),
    youtubeTitle: (event.youtubeTitle || "").trim(),
    createdBy: (event.createdBy || "").trim() || "Community Member",
    createdById: (event.createdById || "").trim() || "mem_admin",
    attendeeIds: Array.isArray(event.attendeeIds) ? event.attendeeIds.filter(Boolean) : [],
    maybeIds: Array.isArray(event.maybeIds) ? event.maybeIds.filter(Boolean) : [],
    declinedIds: Array.isArray(event.declinedIds) ? event.declinedIds.filter(Boolean) : [],
    maxCapacity: typeof event.maxCapacity === "number" ? event.maxCapacity : 100,
    createdAt: event.createdAt || new Date().toISOString(),
  };

  if (cleanEndDate) {
    cleanEvent.endDate = cleanEndDate;
  }

  return cleanEvent;
}

/**
 * Returns true if an event is an official chapter event for the Notice Board / Calendar.
 * Rules:
 * 1. Excludes all media folders, historical photo albums, and Google Drive synced folders.
 * 2. Includes all upcoming events, today's events, ongoing multi-day activities, and recent activities from the past 7 days.
 */
export function isOfficialFutureEvent(event: GroupEvent): boolean {
  if (!isChapterEvent(event)) return false;
  if (!event.date) return false;

  // Window check: include ongoing, future, today, and last 7 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // If multi-day event, use endDate for determining if the event has completely elapsed
  const effectiveEndStr = event.endDate && event.endDate.trim() ? event.endDate.trim() : event.date.trim();
  const eventDateObj = parseEventDateObj(effectiveEndStr);
  if (!eventDateObj) {
    // If date format is custom or unparseable, don't drop legitimate chapter events
    return true;
  }

  return eventDateObj.getTime() >= sevenDaysAgo.getTime();
}

/**
 * Calculates days until an event from today.
 * Returns negative numbers for past dates, positive for future dates, 0 for today.
 */
export function getDaysUntilEvent(dateStr?: string): number | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDateObj = parseEventDateObj(dateStr);
  if (!eventDateObj) return null;
  const diffTime = eventDateObj.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Determines whether an activity or event is currently ONGOING today.
 * Handles both single-day events (today === start date) and multi-day activities (start date <= today <= end date).
 */
export function isEventOngoing(event: GroupEvent): boolean {
  if (!event || !event.date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = parseEventDateObj(event.date);
  if (!startDate) return false;

  let endDate = startDate;
  if (event.endDate && event.endDate.trim()) {
    const parsedEnd = parseEventDateObj(event.endDate);
    if (parsedEnd) {
      endDate = parsedEnd;
    }
  }

  return today.getTime() >= startDate.getTime() && today.getTime() <= endDate.getTime();
}

/**
 * Computes duration information for single or multi-day activities.
 */
export function getEventDurationInfo(event: GroupEvent): {
  isMultiDay: boolean;
  totalDays: number;
  currentDayNumber?: number;
  formattedRange: string;
  isOngoing: boolean;
} {
  const isOngoing = isEventOngoing(event);
  const startDate = parseEventDateObj(event.date);
  if (!startDate) {
    return {
      isMultiDay: false,
      totalDays: 1,
      formattedRange: event.date || "",
      isOngoing,
    };
  }

  // Check if valid multi-day
  const hasValidEndDate = Boolean(event.endDate && event.endDate.trim() && event.endDate.trim() !== event.date.trim());
  if (!hasValidEndDate) {
    const formattedRange = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return {
      isMultiDay: false,
      totalDays: 1,
      formattedRange,
      isOngoing,
    };
  }

  const endDate = parseEventDateObj(event.endDate);
  if (!endDate || endDate.getTime() < startDate.getTime()) {
    const formattedRange = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return { isMultiDay: false, totalDays: 1, formattedRange, isOngoing };
  }

  const diffTime = endDate.getTime() - startDate.getTime();
  const totalDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDayTime = new Date(startDate);
  startDayTime.setHours(0, 0, 0, 0);
  const daysSinceStart = Math.round((today.getTime() - startDayTime.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const currentDayNumber = isOngoing && daysSinceStart >= 1 && daysSinceStart <= totalDays ? daysSinceStart : undefined;

  const startMonth = startDate.toLocaleDateString("en-US", { month: "short" });
  const endMonth = endDate.toLocaleDateString("en-US", { month: "short" });
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  let formattedRange = "";
  if (startYear === endYear) {
    if (startMonth === endMonth) {
      formattedRange = `${startMonth} ${startDate.getDate()} – ${endDate.getDate()}, ${startYear}`;
    } else {
      formattedRange = `${startMonth} ${startDate.getDate()} – ${endMonth} ${endDate.getDate()}, ${startYear}`;
    }
  } else {
    formattedRange = `${startMonth} ${startDate.getDate()}, ${startYear} – ${endMonth} ${endDate.getDate()}, ${endYear}`;
  }

  return {
    isMultiDay: true,
    totalDays,
    currentDayNumber,
    formattedRange,
    isOngoing,
  };
}
