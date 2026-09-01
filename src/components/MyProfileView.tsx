import React, { useState, useEffect } from "react";
import { Member } from "../types";
import { MEMBER_DATABASE_SCHEMA } from "../constants/memberSchema";
import { MemberAvatar } from "./MemberAvatar";
import { MemberRegistrationModal } from "./MemberRegistrationModal";
import {
  UserCheck,
  Mail,
  Phone,
  MessageSquare,
  Award,
  Smartphone,
  Trash2,
  HardDrive,
  CheckCircle2,
  Download,
  Zap,
  RefreshCw,
} from "lucide-react";
import { formatMemberDirectoryName } from "../utils/nameUtils";
import { isMemberProfileComplete } from "../utils/memberValidation";
import { getStorageStats, clearAppCache, StorageStats } from "../utils/storageManager";

function formatWhatsappUrl(phone?: string): string {
  if (!phone) return "#";
  const clean = phone.replace(/\D/g, "");
  return `https://wa.me/${clean}`;
}

function formatMemberName(title?: string, fullName?: string): string {
  return formatMemberDirectoryName(title, fullName);
}

interface PointsTier {
  name: string;
  badgeClass: string;
  icon: string;
  nextTarget: number | null;
  prevTarget: number;
}

function getPointsTier(points: number): PointsTier {
  if (points >= 600) {
    return {
      name: "Diamond Pillar",
      badgeClass: "bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-400/40",
      icon: "💎",
      nextTarget: null,
      prevTarget: 600,
    };
  }
  if (points >= 350) {
    return {
      name: "Gold Contributor",
      badgeClass: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400/40",
      icon: "🥇",
      nextTarget: 600,
      prevTarget: 350,
    };
  }
  if (points >= 150) {
    return {
      name: "Silver Contributor",
      badgeClass: "bg-slate-400/20 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600",
      icon: "🥈",
      nextTarget: 350,
      prevTarget: 150,
    };
  }
  if (points >= 50) {
    return {
      name: "Bronze Contributor",
      badgeClass: "bg-amber-700/15 text-amber-900 dark:text-amber-400 border-amber-600/40",
      icon: "🥉",
      nextTarget: 150,
      prevTarget: 50,
    };
  }
  return {
    name: "Active Member",
    badgeClass: "bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-400/40",
    icon: "🌱",
    nextTarget: 50,
    prevTarget: 0,
  };
}

interface MyProfileViewProps {
  currentUser: Member;
  onUpdateSuccess: (m: Member) => void;
  onOpenTerms: () => void;
}

export const MyProfileView: React.FC<MyProfileViewProps> = ({
  currentUser,
  onUpdateSuccess,
  onOpenTerms,
}) => {
  const isIncomplete = !isMemberProfileComplete(currentUser);
  const [isEditing, setIsEditing] = useState(isIncomplete);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheClearedSuccess, setCacheClearedSuccess] = useState(false);

  useEffect(() => {
    getStorageStats().then(setStorageStats);
  }, []);

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      await clearAppCache();
      const updated = await getStorageStats();
      setStorageStats(updated);
      setCacheClearedSuccess(true);
      setTimeout(() => setCacheClearedSuccess(false), 4000);
    } finally {
      setIsClearingCache(false);
    }
  };

  if (isEditing) {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-36 pb-16 animate-fadeIn">
        <MemberRegistrationModal
          isOpen={true}
          onClose={() => { if (!isIncomplete) setIsEditing(false); }}
          onOpenTerms={onOpenTerms}
          memberToEdit={currentUser}
          originatingPageName="My Profile"
          onSuccess={(m) => {
            setIsEditing(false);
            onUpdateSuccess(m);
          }}
        />
      </div>
    );
  }

  const formattedName = formatMemberName(currentUser.title, currentUser.fullName);
  const categories = Array.from(new Set(MEMBER_DATABASE_SCHEMA.map((f) => f.category)));
  const activityPoints = currentUser.activityPoints || 0;
  const tier = getPointsTier(activityPoints);

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-36 pb-16 animate-fadeIn font-normal space-y-8">
      {/* Header & Avatar */}
      <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 w-full">
          <MemberAvatar
            member={currentUser}
            sizeClassName="w-32 h-32 sm:w-40 sm:h-40"
            textClassName="text-3xl"
          />
          <div className="flex-1 text-center sm:text-left space-y-3 mt-4 sm:mt-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {formattedName}
              </h1>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400/40 shadow-2xs">
                <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="font-extrabold">{activityPoints} Points</span>
                <span className="opacity-40">•</span>
                <span>{tier.name}</span>
                <span>{tier.icon}</span>
              </div>
            </div>

            <p className="text-sm text-teal-700 dark:text-teal-400 font-semibold">
              {currentUser.role === "admin" ? "Administrator" : "Team Member"}
              {currentUser.occupation && ` • ${currentUser.occupation}`}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2">
              {currentUser.email && (
                <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300 text-xs sm:text-sm">
                  <Mail className="w-4 h-4 text-teal-600" />
                  <span>{currentUser.email}</span>
                </div>
              )}
              {currentUser.phoneNumber && (
                <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300 text-xs sm:text-sm">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{currentUser.phoneNumber}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsEditing(true)}
          className="shrink-0 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-md flex items-center space-x-2 cursor-pointer w-full md:w-auto justify-center"
        >
          <UserCheck className="w-4 h-4" />
          <span>Edit My Profile</span>
        </button>
      </div>

      {/* App & Storage Management Card */}
      <div className="bg-gradient-to-r from-teal-500/10 via-cyan-500/10 to-blue-500/10 border border-teal-500/20 dark:border-teal-500/30 rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-600/15 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  Device App & Storage Settings
                </h3>
                {isStandalone ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    Installed App
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Web Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Zero-bloat storage architecture with hardware-accelerated 120fps UI performance.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {!isStandalone && onOpenInstallModal && (
              <button
                onClick={onOpenInstallModal}
                className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install on Device</span>
              </button>
            )}

            <button
              onClick={handleClearCache}
              disabled={isClearingCache}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
              title="Clear temporary cache while keeping login intact"
            >
              {isClearingCache ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
              ) : (
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{isClearingCache ? "Cleaning…" : "Clear Cache & Speed Up"}</span>
            </button>
          </div>
        </div>

        {storageStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
            <div className="p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Storage Used</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">{storageStats.usageFormatted}</span>
            </div>
            <div className="p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Storage Quota</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm">{storageStats.quotaFormatted}</span>
            </div>
            <div className="p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Cache Policy</span>
              <span className="font-bold text-teal-700 dark:text-teal-400 text-sm">LRU (Max 40)</span>
            </div>
            <div className="p-3 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Video Streams</span>
              <span className="font-bold text-cyan-700 dark:text-cyan-400 text-sm">Zero Bloat (Excluded)</span>
            </div>
          </div>
        )}

        {cacheClearedSuccess && (
          <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Cache successfully purged! All temporary media storage has been reclaimed.</span>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800" />

      {/* Dynamic Data Display */}
      <div className="space-y-12">
        {categories.map((cat) => {
          const fieldsInCategory = MEMBER_DATABASE_SCHEMA.filter((f) => f.category === cat);
          const categoryTitle = fieldsInCategory[0]?.categoryLabel || cat;

          return (
            <div key={cat} className="space-y-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-3">
                {categoryTitle}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {fieldsInCategory.map((field) => {
                  let value = currentUser[field.key as keyof Member];
                  let displayValue = "Not specified";

                  if (value) {
                    if (Array.isArray(value)) {
                      displayValue = value.length > 0 ? value.join(", ") : "Not specified";
                    } else if (typeof value === "string") {
                      displayValue = value.trim() !== "" ? value : "Not specified";
                    } else {
                      displayValue = String(value);
                    }
                  }

                  return (
                    <div
                      key={field.key}
                      className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800"
                    >
                      <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 font-bold">
                        {field.label}
                      </p>
                      {field.type === "file" && displayValue !== "Not specified" ? (
                        <img 
                          src={displayValue} 
                          alt="Profile Preview" 
                          className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700" 
                        />
                      ) : (
                        <p className="text-sm text-slate-900 dark:text-white break-words font-medium">
                          {displayValue}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
