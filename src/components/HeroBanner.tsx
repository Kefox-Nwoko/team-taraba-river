import React from "react";
import { Member, GroupEvent } from "../types";
import {
   Users,
   Calendar,
   Eye,
   UserPlus,
} from "lucide-react";

import { AppStateManager } from "../services/storage";

interface HeroBannerProps {
  currentUser: Member | null;
  members: Member[];
  events: GroupEvent[];
  totalVisits?: number;
  lastVisitTimestamp?: string;
  sessionCount?: number;
  latestUniqueUser?: string;
   onOpenRegister: () => void;
   onOpenSignIn: () => void;
   onNavigateTab?: (tab: "media" | "events" | "admin") => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  currentUser,
  members,
  events,
  totalVisits = 1428,
   onOpenRegister,
}) => {
  const memberCount = members.length;
  const currentDateStr = new Date().toISOString().split("T")[0];
  const activeEvents = events.filter(
    (e) => e.date >= currentDateStr && !e.id.startsWith("gdrive_") && !e.id.startsWith("evt_arch_") && e.id !== "evt_taraba_gdrive"
  );
  const eventCount = activeEvents.length;

  const getUserDisplayName = (user?: Member | null): string => {
    if (!user) return "Guest";
    let cleanName = user.firstName || (user.fullName ? user.fullName.trim() : "");
    cleanName = cleanName.replace(
      /^(Dr\.|Mr\.|Mrs\.|Ms\.|Engr\.|Chief|Prof\.|Dr|Mr|Mrs|Ms|Engr|Prof)\s+/i,
      ""
    );
    const parts = cleanName.split(/\s+/);
    const first = parts[0] || "Guest";
    if (first.toLowerCase() === "local") return "Admin";
    return first;
  };

  const userName = getUserDisplayName(currentUser);
  const roleTitle = currentUser?.role === "admin" ? "Admin" : "User";

  // Determine if it's user's first visit vs returning visit
  const userVisitCount = currentUser ? AppStateManager.getUserVisitCount(currentUser.id) : 1;
  const isFirstVisit = userVisitCount <= 1;

  return (
    <div className="space-y-6 py-2 w-full font-normal">
      {/* Welcome Header Container - No background container block */}
      <div className="space-y-6 font-normal">
        <div className="space-y-3">
          {isFirstVisit ? (
            <>
              <h1 className="text-xl sm:text-2xl font-normal tracking-tight text-slate-900 dark:text-white leading-tight">
                Welcome,{" "}
                <span className="text-teal-700 dark:text-teal-400 font-normal">
                  {userName}
                </span>
                .
              </h1>
              <p className="text-sm sm:text-sm font-normal text-slate-600 dark:text-slate-300 leading-relaxed w-full">
                We are thrilled to have you here! Together, we are building a vibrant, connected,
                and impactful community dedicated to sharing our stories and fostering meaningful
                relationships for mutual growth.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl sm:text-2xl font-normal tracking-tight text-slate-900 dark:text-white leading-tight">
                Welcome, back{" "}
                <span className="text-teal-700 dark:text-teal-400 font-normal">
                  {userName}
                </span>
                .
              </h1>
              <p className="text-sm sm:text-sm font-normal text-slate-600 dark:text-slate-300 leading-relaxed w-full">
                We are thrilled to have you return here! As you know, we are still building a
                vibrant, connected, and impactful community dedicated to sharing our stories and
                fostering meaningful relationships for mutual growth. We are relying on your
                efforts to grow our Team by physical participation. Hoping to see more of your
                visits.
              </p>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-3">
            <button onClick={onOpenRegister} className="px-3 py-1.5 rounded-2xl text-xs font-normal transition flex items-center space-x-2.5 active:scale-95 bg-teal-700 hover:bg-teal-800 text-white cursor-pointer" >
              <UserPlus className="w-5 h-5" />
              <span>Registration</span>
            </button>
          </div>
        </div>

        {/* Metrics Section Header & Cards - Separation & Extra space with horizontal line */}
        <div className="py-3 my-3 border-y border-slate-200 dark:border-slate-800 space-y-4 sm:space-y-6">
          {/* Stacked Header mimicking Welcome style */}
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-normal tracking-tight text-slate-900 dark:text-white leading-tight">
              Community Impact
            </h2>
            <p className="text-sm sm:text-sm font-normal text-slate-600 dark:text-slate-300 leading-relaxed w-full">
              Real-time public metrics
            </p>
          </div>

          {/* Metric Section - Left aligned group, vertically centered figures */}
          <div className="flex flex-wrap items-start justify-between sm:justify-start gap-4 sm:gap-16 lg:gap-24 font-normal w-full sm:w-auto">
            {/* Card 1: Registered */}
            <div className="flex flex-col items-center justify-center text-center space-y-1 font-normal min-w-0">
              <div className="flex flex-col items-center justify-center space-y-1.5">
                <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
                <span className="text-[10px] sm:text-sm text-slate-700 dark:text-slate-200 font-normal whitespace-nowrap truncate">
                  Registered
                </span>
              </div>
              <span className="text-lg sm:text-3xl text-slate-900 dark:text-white tracking-tight font-normal block text-center mt-0 sm:mt-1">
                {memberCount}
              </span>
            </div>

            {/* Card 2: Active Events */}
            <div className="flex flex-col items-center justify-center text-center space-y-1 font-normal min-w-0">
              <div className="flex flex-col items-center justify-center space-y-1.5">
                <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-400 flex items-center justify-center shrink-0">
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
                <span className="text-[10px] sm:text-sm text-slate-700 dark:text-slate-200 font-normal whitespace-nowrap truncate">
                  Active Events
                </span>
              </div>
              <span className="text-lg sm:text-3xl text-slate-900 dark:text-white tracking-tight font-normal block text-center mt-0 sm:mt-1">
                {eventCount}
              </span>
            </div>

            {/* Card 3: Portal Visits */}
            <div className="flex flex-col items-center justify-center text-center space-y-1 font-normal min-w-0">
              <div className="flex flex-col items-center justify-center space-y-1.5">
                <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
                <span className="text-[10px] sm:text-sm text-slate-700 dark:text-slate-200 font-normal whitespace-nowrap truncate">
                  Portal Visits
                </span>
              </div>
              <span className="text-lg sm:text-3xl text-slate-900 dark:text-white tracking-tight font-normal block text-center mt-0 sm:mt-1">
                {totalVisits.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
