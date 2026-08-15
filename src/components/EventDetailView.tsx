import React from "react";
import { GroupEvent } from "../types";
import { Calendar as CalendarIcon, MapPin, Users } from "lucide-react";
import { ReturnButton } from "./ReturnButton";

interface EventDetailViewProps {
  event: GroupEvent;
  onReturn: () => void;
}

export const EventDetailView: React.FC<EventDetailViewProps> = ({ event, onReturn }) => {
  return (
    <div className="space-y-8 animate-fadeIn font-normal w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 sm:p-10 shadow-sm flex flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-4">
          <span className="w-fit text-xs uppercase text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-3.5 py-1 rounded-full border border-teal-200 dark:border-teal-800/60 font-normal">
            {event.category}
          </span>
          <h1 className="text-sm text-slate-900 dark:text-white tracking-tight font-normal">
            {event.title}
          </h1>
        </div>
        <div className="shrink-0">
          <ReturnButton onClick={onReturn} />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 sm:p-10 space-y-8 shadow-sm font-normal">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 p-4 sm:p-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/80 dark:border-slate-800 font-normal">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 flex items-center justify-center bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 rounded-2xl shrink-0">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-0.5">Date & Time</span>
              <span className="text-xs sm:text-sm text-slate-900 dark:text-white font-semibold leading-tight line-clamp-2 break-words">
                {event.date} at {event.time}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 flex items-center justify-center bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 rounded-2xl shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-0.5">Location</span>
              <span className="text-xs sm:text-sm text-slate-900 dark:text-white font-semibold leading-tight line-clamp-2 break-words">{event.location}</span>
            </div>
          </div>
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 flex items-center justify-center bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-2xl shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-0.5">Attendees</span>
              <span className="text-xs sm:text-sm text-slate-900 dark:text-white font-semibold leading-tight line-clamp-2 break-words">
                {event.attendeeIds.length} Members
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 font-normal">
          <h3 className="text-xl uppercase text-slate-500 dark:text-slate-400 tracking-wider font-normal">
            About This Event
          </h3>
          <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-950 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 font-normal">
            {event.description || "No detailed description provided."}
          </p>
        </div>
      </div>
    </div>
  );
};
