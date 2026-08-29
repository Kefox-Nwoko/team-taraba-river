import React, { useState } from "react";
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
  Sparkles,
  Zap,
  CheckCircle2,
  HelpCircle,
  Info,
  Calendar,
  Image as ImageIcon,
  Newspaper,
  ChevronDown,
  ChevronUp,
  X,
  Star,
  ShieldCheck,
} from "lucide-react";
import { formatMemberDirectoryName } from "../utils/nameUtils";

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

const POINT_EARNING_RULES = [
  {
    icon: ImageIcon,
    title: "Media Uploads (Approved)",
    points: "+30 pts",
    desc: "Earned for each chapter event photo or video submitted and approved by portal administrators.",
    color: "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800",
  },
  {
    icon: Calendar,
    title: "Event RSVPs & Attendance",
    points: "+20 pts",
    desc: "Earned when you commit to upcoming gatherings, meetings, and activities.",
    color: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800",
  },
  {
    icon: UserCheck,
    title: "Profile Completion & Updates",
    points: "+15 pts",
    desc: "Earned by keeping your profile 100% complete with verified contact info, school, and sizes.",
    color: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800",
  },
  {
    icon: Zap,
    title: "Daily Portal Engagement",
    points: "+10 pts",
    desc: "Earned for active visits, AI searches, and staying engaged with community updates.",
    color: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800",
  },
  {
    icon: Newspaper,
    title: "USOSA News & Updates Read",
    points: "+5 pts",
    desc: "Earned each time you read and stay informed on official chapter and national updates.",
    color: "text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800",
  },
];

interface MyProfileViewProps {
  currentUser: Member;
  onUpdateSuccess: (m: Member) => void;
  onOpenTerms?: () => void;
}

export const MyProfileView: React.FC<MyProfileViewProps> = ({
  currentUser,
  onUpdateSuccess,
  onOpenTerms,
}) => {
  const isProfileComplete = (user: Member | null): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;

    const requiredFields: Array<keyof Member> = [
      'fullName', 'email', 'phoneNumber', 'dateOfBirth', 'occupation',
      'title', 'firstName', 'surname', 'whatsappNumber', 'gradYear',
      'schoolName', 'jerseySize', 'estateName', 'area', 'streetName',
      'closestNeighborName', 'closestNeighborPhone', 'nextOfKinName',
      'nextOfKinPhone'
    ];

    for (const field of requiredFields) {
      const val = user[field];
      if (val === undefined || val === null) return false;
      if (typeof val === 'string' && val.trim() === '') return false;
    }
    return true;
  };

  const isIncomplete = !isProfileComplete(currentUser);
  const [isEditing, setIsEditing] = useState(isIncomplete);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isRulesExpanded, setIsRulesExpanded] = useState(true);

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

  const progressPercent = tier.nextTarget
    ? Math.min(100, Math.max(0, Math.round(((activityPoints - tier.prevTarget) / (tier.nextTarget - tier.prevTarget)) * 100)))
    : 100;

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
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {formattedName}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${tier.badgeClass} flex items-center gap-1`}>
                <span>{tier.icon}</span>
                <span>{tier.name}</span>
              </span>
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

      {/* ========================================================================= */}
      {/* ⭐ HIGH-VISIBILITY ACTIVITY POINTS & RULES SHOWCASE SECTION ⭐ */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-teal-500/10 dark:from-amber-950/30 dark:via-slate-900 dark:to-teal-950/30 border-2 border-amber-400/50 dark:border-amber-500/30 rounded-3xl p-5 sm:p-7 shadow-md transition-all">
        {/* Top Points Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-amber-200/60 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center shadow-lg shrink-0">
              <Award className="w-9 h-9 sm:w-11 sm:h-11 drop-shadow-sm" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] sm:text-xs uppercase font-extrabold tracking-wider text-amber-700 dark:text-amber-400">
                  My Community Engagement Points
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-400/30">
                  Official Record
                </span>
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                  {activityPoints}
                </span>
                <span className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400">
                  Points
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Current Standing: <strong className="text-slate-900 dark:text-white font-bold">{tier.name}</strong> ({tier.icon})
              </p>
            </div>
          </div>

          {/* Progress / Next Tier Goal */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 min-w-[260px]">
            {tier.nextTarget ? (
              <div className="w-full sm:w-64 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 font-medium">
                  <span>Next: {getPointsTier(tier.nextTarget).name}</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">{activityPoints} / {tier.nextTarget} pts</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-teal-500 transition-all duration-500 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 text-right">
                  {tier.nextTarget - activityPoints} points to next milestone
                </p>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-800 dark:text-cyan-300 text-xs font-bold">
                <span>🌟</span>
                <span>Maximum Tier Achieved</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsRulesExpanded(!isRulesExpanded)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700 font-bold text-xs shadow-xs transition cursor-pointer"
            >
              <Info className="w-3.5 h-3.5 text-amber-600" />
              <span>{isRulesExpanded ? "Hide Point Earning Rules" : "View Point Earning Rules"}</span>
              {isRulesExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Expandable Points Rules & Breakdown */}
        {isRulesExpanded && (
          <div className="pt-6 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>How Points Are Earned (Official Chapter Rules)</span>
              </h3>
              {onOpenTerms && (
                <button
                  type="button"
                  onClick={onOpenTerms}
                  className="text-xs text-teal-700 dark:text-teal-400 hover:underline font-medium cursor-pointer"
                >
                  Section 7 Terms & Conditions ↗
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {POINT_EARNING_RULES.map((rule, rIdx) => {
                const RuleIcon = rule.icon;
                return (
                  <div
                    key={rIdx}
                    className="p-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-start gap-3 hover:border-amber-400/60 transition"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${rule.color}`}>
                      <RuleIcon className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {rule.title}
                        </h4>
                        <span className="px-1.5 py-0.5 rounded-md text-[11px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 shrink-0">
                          {rule.points}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {rule.desc}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Special Recognition Policy */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-teal-500/10 to-emerald-500/10 dark:from-teal-950/40 dark:to-emerald-950/40 border border-teal-200 dark:border-teal-800 shadow-xs flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-950 border-teal-300 dark:border-teal-700">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      Community Recognition
                    </h4>
                    <span className="px-1.5 py-0.5 rounded-md text-[11px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 shrink-0">
                      Honors
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Points celebrate active participation and may qualify members for recognition, gifts, or awards at gatherings. Points have no monetary cash value.
                  </p>
                </div>
              </div>
            </div>
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
