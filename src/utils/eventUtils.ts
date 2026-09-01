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

  const parts = event.date.split("-");
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
