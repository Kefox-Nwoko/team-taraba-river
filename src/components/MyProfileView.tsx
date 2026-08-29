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
  Search,
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
    icon: Zap,
    title: "Visiting the App & Exploring",
    points: "+30 pts",
    badge: "Core Recognition",
    desc: "Earned for regular portal visits, exploring photo galleries, event archives, and chapter updates.",
    color: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800",
  },
  {
    icon: Sparkles,
    title: "Using AI Xplora Research",
    points: "+25 pts",
    badge: "Core Recognition",
    desc: "Earned for querying AI Xplora, exploring USOSA knowledge, unity schools history, and live information.",
    color: "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800",
  },
  {
    icon: Search,
    title: "Searching Member Skills & Professions",
    points: "+25 pts",
    badge: "Core Recognition",
    desc: "Earned for looking up fellow members' occupational affiliations, skills, and emergency/business contacts.",
    color: "text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800",
  },
  {
    icon: Newspaper,
    title: "Reading USOSA News Headlines",
    points: "+10 pts",
    badge: "Engagement",
    desc: "Earned each time you open and read official USOSA news updates and chapter announcements.",
    color: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800",
  },
  {
    icon: UserCheck,
    title: "Profile Completeness & Verification",
    points: "+15 pts",
    badge: "Profile",
    desc: "Earned by maintaining 100% complete registration data with verified contact info, skills, and occupation.",
    color: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800",
  },
  {
    icon: ImageIcon,
    title: "Media Uploads & Event RSVPs",
    points: "+20 pts",
    badge: "Community",
    desc: "Earned for uploading approved gathering photos/videos and confirming event attendance.",
    color: "text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800",
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
                        <div className="flex items-center gap-1.5 shrink-0">
                          {rule.badge && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              rule.badge === "Core Recognition"
                                ? "bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-400/40"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            }`}>
                              {rule.badge}
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded-md text-[11px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                            {rule.points}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {rule.desc}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Special Recognition Policy */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/15 via-teal-500/10 to-emerald-500/10 dark:from-amber-950/40 dark:via-teal-950/40 dark:to-emerald-950/40 border-2 border-amber-400/50 dark:border-amber-500/40 shadow-xs flex items-start gap-3 col-span-1 sm:col-span-2 lg:col-span-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 border-amber-300 dark:border-amber-700 shadow-xs mt-0.5">
                  <Award className="w-5 h-5" />
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>⭐ Core Community Recognition Policy</span>
                    </h4>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-400/40">
                      Primary Recognition Drivers
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    Community recognition and standing tiers are <strong>principally awarded for visiting the portal, exploring the app, querying AI Xplora, and actively searching for fellow members' occupational affiliations, skills, and emergency/business contacts</strong> to foster chapter bonding and mutual support.
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Points celebrate proactive exploration and qualify members for special recognition, gifts, or honors during Team Taraba River gatherings (non-monetary incentive).
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
