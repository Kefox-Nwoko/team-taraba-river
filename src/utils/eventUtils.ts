import { GroupEvent } from "../types";

/**
 * Returns true if an event is an official future/upcoming chapter event for the Notice Board / Calendar.
 * Strict rules:
 * 1. Excludes all media folders, historical photo albums, and Google Drive synced folders (gdrive_*, folder_*, media_*, album_*, evt_arch_*).
 * 2. Excludes past events (events that have already taken place before today).
 */
export function isOfficialFutureEvent(event: GroupEvent): boolean {
  if (!event || !event.id || !event.date) return false;

  // 1. Exclude all media gallery folders & cloud media albums
  const id = event.id.toLowerCase();
  if (
    id.startsWith("gdrive_") ||
    id.startsWith("folder_") ||
    id.startsWith("media_") ||
    id.startsWith("album_") ||
    id.startsWith("evt_arch_") ||
    id === "evt_taraba_gdrive"
  ) {
    return false;
  }

  // 2. Strict future / today check (WAT/local timezone safe)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // If multi-day event, use endDate for determining if the event is already in the past
  const effectiveEndStr = event.endDate && event.endDate.trim() ? event.endDate.trim() : event.date.trim();
  const parts = effectiveEndStr.split("-");
  if (parts.length !== 3) return false;
  const eventDateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  if (isNaN(eventDateObj.getTime())) return false;
  eventDateObj.setHours(0, 0, 0, 0);

  return eventDateObj.getTime() >= today.getTime();
}

/**
 * Calculates days until an event from today.
 * Returns negative numbers for past dates, positive for future dates, 0 for today.
 */
export function getDaysUntilEvent(dateStr?: string): number | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  const eventDateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  if (isNaN(eventDateObj.getTime())) return null;
  eventDateObj.setHours(0, 0, 0, 0);
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

  const startParts = event.date.trim().split("-");
  if (startParts.length !== 3) return false;
  const startDate = new Date(parseInt(startParts[0], 10), parseInt(startParts[1], 10) - 1, parseInt(startParts[2], 10));
  if (isNaN(startDate.getTime())) return false;
  startDate.setHours(0, 0, 0, 0);

  let endDate = startDate;
  if (event.endDate && event.endDate.trim()) {
    const endParts = event.endDate.trim().split("-");
    if (endParts.length === 3) {
      const parsedEnd = new Date(parseInt(endParts[0], 10), parseInt(endParts[1], 10) - 1, parseInt(endParts[2], 10));
      if (!isNaN(parsedEnd.getTime())) {
        parsedEnd.setHours(0, 0, 0, 0);
        endDate = parsedEnd;
      }
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
  const startParts = (event.date || "").trim().split("-");
  if (startParts.length !== 3) {
    return {
      isMultiDay: false,
      totalDays: 1,
      formattedRange: event.date || "",
      isOngoing,
    };
  }

  const startDate = new Date(parseInt(startParts[0], 10), parseInt(startParts[1], 10) - 1, parseInt(startParts[2], 10));
  if (isNaN(startDate.getTime())) {
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

  const endParts = event.endDate!.trim().split("-");
  if (endParts.length !== 3) {
    const formattedRange = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return { isMultiDay: false, totalDays: 1, formattedRange, isOngoing };
  }

  const endDate = new Date(parseInt(endParts[0], 10), parseInt(endParts[1], 10) - 1, parseInt(endParts[2], 10));
  if (isNaN(endDate.getTime()) || endDate.getTime() < startDate.getTime()) {
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
