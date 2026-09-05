import React, { useState, useEffect } from "react";
import { logger } from "../lib/logger";
import { GroupEvent, Member } from "../types";
import { submitEventRSVP } from "../services/apiClient";
import { AppStateManager } from "../services/storage";
import { FirebaseSyncManager } from "../services/firebaseService";
import { EngagementTracker } from "../services/EngagementTracker";
import { MemberAvatar } from "./MemberAvatar";
import { UsosaNewsCard } from "./UsosaNewsCard";
import { BirthdayCelebrationAnimation } from "./BirthdayCelebrationAnimation";
import { isOfficialFutureEvent, getDaysUntilEvent, isEventOngoing, getEventDurationInfo } from "../utils/eventUtils";
import {
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  Cake,
} from "lucide-react";

interface EventCalendarViewProps {
  events: GroupEvent[];
  members: Member[];
  currentUser: Member | null;
  onRefreshEvents: (event?: GroupEvent) => void | Promise<void>;
  originatingPageName?: string;
  defaultSubTab?: "media" | "calendar";
  onSubViewChange?: (isOpen: boolean) => void;
}

export const EventCalendarView: React.FC<EventCalendarViewProps> = ({
  events: propEvents,
  members,
  currentUser,
  onRefreshEvents,
  defaultSubTab = "calendar",
  onSubViewChange,
}) => {
  const [events, setEvents] = useState<GroupEvent[]>(propEvents);

  useEffect(() => {
    setEvents(propEvents);
  }, [propEvents]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const isAdmin = currentUser?.role === "admin";

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
      return (days !== null && days >= 0 && days <= 7) || isEventOngoing(e);
    })
    .sort((a, b) => {
      const ongoingA = isEventOngoing(a);
      const ongoingB = isEventOngoing(b);
      if (ongoingA && !ongoingB) return -1;
      if (!ongoingA && ongoingB) return 1;

      const dA = getDaysUntilEvent(a.date) ?? 999;
      const dB = getDaysUntilEvent(b.date) ?? 999;
      return dA - dB;
    });

  const filteredEvents = officialUpcomingEvents
    .filter((e) => {
      if (selectedCategory === "next7days") {
        const days = getDaysUntilEvent(e.date);
        return (days !== null && days >= 0 && days <= 7) || isEventOngoing(e);
      }
      if (selectedCategory === "all") return true;
      return (e.category || "").toLowerCase().includes(selectedCategory.toLowerCase());
    })
    .sort((a, b) => {
      // 1. Ongoing events always come first
      const ongoingA = isEventOngoing(a);
      const ongoingB = isEventOngoing(b);
      if (ongoingA && !ongoingB) return -1;
      if (!ongoingA && ongoingB) return 1;

      const dA = getDaysUntilEvent(a.date) ?? 999;
      const dB = getDaysUntilEvent(b.date) ?? 999;
      return dA - dB;
    });

  const dynamicCategories = Array.from(
    new Set(
      officialUpcomingEvents.flatMap((e) =>
        (e.category || "General")
          .split(/[,/]/)
          .map((c) => c.trim())
          .filter(Boolean)
      )
    )
  ).sort();

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
      // Directly update local events state for optimistic UI
      setEvents((prev) => prev.map((e) => (e.id === updatedEvt.id ? updatedEvt : e)));

      try {
        await FirebaseSyncManager.saveEvent(updatedEvt);
      } catch (e) {
        logger.warn("Firebase RSVP sync notice", { error: e });
      }
    }

    // 2. Also notify backend API
    try {
      await submitEventRSVP(eventId, memberId, status);
      await EngagementTracker.trackRsvp(memberId);
    } catch (err) {
      logger.error("Event RSVP API sync", err);
    }

    await Promise.resolve(onRefreshEvents());
  };

  return (
    <div className="space-y-8 font-sans font-normal">
      {/* MAIN CALENDAR VIEW CONTAINER */}
      <div className="space-y-3 sm:space-y-4 font-normal">
        {/* Header Section */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-normal tracking-tight text-slate-900 dark:text-white leading-tight">
              Updates
            </h1>
            <p className="text-sm font-normal text-slate-600 dark:text-slate-300 leading-relaxed w-full">
              Community Gatherings, Activities & Member Birthdays
            </p>
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
                  const isOngoing = isEventOngoing(event);
                  const durationInfo = getEventDurationInfo(event);

                  return (
                    <div
                      key={event.id}
                      className={`group relative bg-white dark:bg-slate-900 rounded-2xl p-3.5 sm:p-4 border shadow-xs hover:shadow-md transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 overflow-hidden font-normal ${
                        isOngoing
                          ? "border-emerald-500/80 ring-2 ring-emerald-400/60 dark:ring-emerald-500/50 shadow-lg shadow-emerald-500/15 bg-gradient-to-r from-emerald-500/[0.04] via-teal-500/[0.03] to-cyan-500/[0.04]"
                          : isPastWithin7Days
                          ? "border-slate-200/90 dark:border-slate-800 opacity-90"
                          : "border-slate-200/90 dark:border-slate-800 hover:border-cyan-500/60"
                      }`}
                    >
                      {/* Left Accent Bar: Vibrant gradient when ongoing, amber when within 7 days */}
                      {isOngoing ? (
                        <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-emerald-400 via-teal-500 to-cyan-500 animate-pulse" />
                      ) : isWithin7Days ? (
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-amber-400 to-orange-500" />
                      ) : null}

                      {/* Left: Compact Date Tag & Event Details */}
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 pl-1">
                        {/* Compact Date Box */}
                        {durationInfo.isMultiDay ? (
                          <div className="flex flex-col items-center justify-center shrink-0 w-14 sm:w-16 py-1.5 px-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-center font-normal">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-600 dark:text-cyan-400 leading-none">
                              {new Date(event.date).toLocaleString("default", { month: "short" })}
                            </span>
                            <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight mt-0.5">
                              {new Date(event.date).getDate()}–{new Date(event.endDate!).getDate()}
                            </span>
                            <span className="text-[9px] font-extrabold uppercase px-1 py-0.2 rounded bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 mt-0.5">
                              {durationInfo.totalDays}D
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center shrink-0 w-12 sm:w-14 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-center font-normal">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-600 dark:text-cyan-400 leading-none">
                              {new Date(event.date).toLocaleString("default", { month: "short" })}
                            </span>
                            <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight mt-0.5">
                              {new Date(event.date).getDate()}
                            </span>
                            {isOngoing && (
                              <span className="text-[9px] font-extrabold uppercase px-1 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 mt-0.5">
                                Today
                              </span>
                            )}
                          </div>
                        )}

                        {/* Event Title & Metadata (Time, Location, Description) */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* ONGOING BADGE WITH ANIMATED PING */}
                            {isOngoing && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-xs animate-pulse shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0" />
                                ⚡ Ongoing Activity {durationInfo.isMultiDay && durationInfo.currentDayNumber ? `(Day ${durationInfo.currentDayNumber} of ${durationInfo.totalDays})` : "Today"}
                              </span>
                            )}

                            {/* Event Title with Celebratory Animation Effect when Ongoing */}
                            <BirthdayCelebrationAnimation autoPlay={isOngoing} continuous={isOngoing} durationMs={10000}>
                              <h3 className={`text-sm sm:text-base font-semibold truncate transition ${
                                isOngoing
                                  ? "text-emerald-700 dark:text-emerald-300 font-bold"
                                  : "text-slate-900 dark:text-white"
                              }`}>
                                {event.title}
                              </h3>
                            </BirthdayCelebrationAnimation>

                            {event.category && (
                              <div className="flex flex-wrap items-center gap-1 shrink-0">
                                {event.category.split(/[,/]/).map((c) => c.trim()).filter(Boolean).map((catName) => (
                                  <span key={catName} className="px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800/40 text-[11px] font-medium shrink-0">
                                    {catName}
                                  </span>
                                ))}
                              </div>
                            )}

                            {durationInfo.isMultiDay && !isOngoing && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 text-[11px] font-medium shrink-0">
                                📅 {durationInfo.totalDays} Days ({durationInfo.formattedRange})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 sm:gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                            {durationInfo.isMultiDay && (
                              <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300 shrink-0">
                                <CalendarIcon className="w-3.5 h-3.5 text-cyan-500" />
                                <span>{durationInfo.formattedRange}</span>
                              </span>
                            )}
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

                      {/* Right: Inline RSVP Buttons (Members Only) */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800/60">
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

      </div>
    );
};
