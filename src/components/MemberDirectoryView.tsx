import React, { useState, useEffect, useMemo, useDeferredValue } from "react";
import { Member } from "../types";
import { adminAISearch } from "../services/apiClient";
import { logger } from "../lib/logger";
import { MemberAvatar } from "./MemberAvatar";
import { formatMemberDirectoryName } from "../utils/nameUtils";
import {
  Search,
  Lock,
  Edit3,
  CheckCircle,
  MapPin,
  Mail,
  Phone,
  MessageSquare,
  UserCheck,
  Users,
  User,
  Briefcase,
  Cake,
  Shirt,
  Award,
  Sparkles,
  FileSpreadsheet,
} from "lucide-react";

interface MemberDirectoryViewProps {
  members: Member[];
  currentUser: Member | null;
  onEditMember: (member: Member) => void;
  onRegisterClick: () => void;
}

function formatWhatsappUrl(num: string): string {
  if (!num) return "#";
  const clean = num.replace(/\D/g, "");
  if (clean.startsWith("0")) return `https://wa.me/234${clean.substring(1)}`;
  if (clean.startsWith("234")) return `https://wa.me/${clean}`;
  return `https://wa.me/${clean}`;
}

function formatMemberName(title?: string, fullName?: string): string {
  return formatMemberDirectoryName(title, fullName);
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export function getMonthNameFromDate(dateStr: string): string | null {
  const lower = dateStr.toLowerCase();
  const found = MONTH_NAMES.find((m) => lower.includes(m));
  if (found) return found;

  const isoMatch = dateStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const monthIndex = parseInt(isoMatch[2], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return MONTH_NAMES[monthIndex];
    }
  }

  return null;
}

export function getMemberSearchableText(m: Member): string {
  const parts = [
    m.title,
    m.firstName,
    m.surname,
    m.fullName,
    m.email,
    m.phoneNumber,
    m.whatsappNumber,
    m.occupation,
    m.schoolName,
    m.gradYear,
    m.area,
    m.estateName,
    m.otherArea,
    m.streetName,
    m.maritalStatus,
    m.jerseySize,
    m.nextOfKinName,
    m.nextOfKinPhone,
    m.closestNeighborName,
    m.closestNeighborPhone,
    m.skills?.join(" "),
  ];

  if (m.dateOfBirth) {
    parts.push(m.dateOfBirth);
    const month = getMonthNameFromDate(m.dateOfBirth);
    if (month) parts.push(month);
  }

  return parts.filter(Boolean).join(" ").toLowerCase();
}

export const MemberDirectoryView: React.FC<MemberDirectoryViewProps> = ({
  members,
  currentUser,
  onEditMember,
  onRegisterClick,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [aiResults, setAiResults] = useState<Member[] | null>(null);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const isAdmin = currentUser?.role === "admin";

  const deferredSearch = useDeferredValue(searchTerm);
  const localFiltered = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    if (!term) return members;
    return members.filter((m) => {
      const searchable = getMemberSearchableText(m);
      return searchable.includes(term);
    });
  }, [members, deferredSearch]);

  const displayedMembers = aiResults !== null ? aiResults : localFiltered;

  const runAiSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || !isAdmin) return;

    setIsAiSearching(true);
    try {
      const results = await adminAISearch(trimmed);
      setAiResults(results.length > 0 ? results : []);
    } catch (err) {
      logger.error("AI member search failed", err);
      setAiResults(null);
    } finally {
      setIsAiSearching(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value.trim().length === 0) {
      setAiResults(null);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim() && isAdmin) {
      runAiSearch(searchTerm);
    } else {
      setAiResults(null);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim().length >= 3 && isAdmin) {
        runAiSearch(searchTerm);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [searchTerm, isAdmin]);

  const handleExportToExcel = () => {
    if (!members || members.length === 0) {
      alert("No member records available to export.");
      return;
    }

    const headers = [
      "Member ID",
      "Title",
      "Full Name",
      "First Name",
      "Surname",
      "Birthday",
      "Jersey / T-Shirt Size",
      "Email Address",
      "Phone Number",
      "WhatsApp Number",
      "Unity School / High School",
      "Grad / Set Year",
      "Occupation / Profession",
      "Skills & Expertise",
      "Estate / Housing Layout",
      "Area / District",
      "Other Area / Landmark",
      "Street Name",
      "Next of Kin Name",
      "Next of Kin Phone",
      "Closest Neighbor Name",
      "Closest Neighbor Phone",
      "Activity Points",
      "Role",
      "Registration Date"
    ];

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '""';
      let str = Array.isArray(val) ? val.join("; ") : String(val);
      str = str.replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = members.map((m) => [
      escapeCsv(m.id),
      escapeCsv(m.title || ""),
      escapeCsv(m.fullName || ""),
      escapeCsv(m.firstName || ""),
      escapeCsv(m.surname || ""),
      escapeCsv(m.dateOfBirth || ""),
      escapeCsv(m.jerseySize || ""),
      escapeCsv(m.email || ""),
      escapeCsv(m.phoneNumber || ""),
      escapeCsv(m.whatsappNumber || ""),
      escapeCsv(m.schoolName || ""),
      escapeCsv(m.gradYear || ""),
      escapeCsv(m.occupation || ""),
      escapeCsv(m.skills || ""),
      escapeCsv(m.estateName || ""),
      escapeCsv(m.area || ""),
      escapeCsv(m.otherArea || ""),
      escapeCsv(m.streetName || ""),
      escapeCsv(m.nextOfKinName || ""),
      escapeCsv(m.nextOfKinPhone || ""),
      escapeCsv(m.closestNeighborName || ""),
      escapeCsv(m.closestNeighborPhone || ""),
      escapeCsv(m.activityPoints || 0),
      escapeCsv(m.role || "member"),
      escapeCsv(m.createdAt || "")
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `URIP_Member_Database_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isAdmin) {
    const myProfile = currentUser || members[0];
    const formattedMyName = myProfile ? formatMemberName(myProfile.title, myProfile.fullName) : "";
    return (
      <div className="space-y-8 font-sans font-normal">
        <div className="py-6 sm:py-10 text-slate-900 dark:text-slate-100 relative transition-colors">
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center space-x-2.5 px-4 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-400 text-sm font-normal">
              <Lock className="w-5 h-5" />
              <span>Restricted Access • Administrator Permission Required</span>
            </div>
            <h1 className="text-2xl sm:text-3xl text-slate-900 dark:text-white font-normal tracking-tight">
              Member Directory
            </h1>
          </div>
        </div>

        {myProfile && (
          <div className="py-8 sm:py-10 space-y-8 text-slate-900 dark:text-slate-100 font-normal transition-colors border-b border-slate-200 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-slate-100 dark:border-slate-800 pb-8">
              <div className="flex items-center space-x-6">
                <div className="relative">
                  <MemberAvatar member={myProfile} sizeClassName="w-24 h-24" textClassName="text-sm font-normal" />
                  <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-2 rounded-full ring-4 ring-white dark:ring-slate-900">
                    <CheckCircle className="w-6 h-6" />
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-3">
                    <h2 className="text-sm sm:text-sm text-slate-900 dark:text-white font-normal">{formattedMyName}</h2>
                    {myProfile.role === "admin" && (
                      <span className="px-4 py-1 text-sm uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded-full border border-amber-300 dark:border-amber-800/50 font-normal">
                        ADMIN
                      </span>
                    )}
                  </div>
                  {myProfile.occupation && (
                    <p className="text-sm text-teal-700 dark:text-teal-400 font-normal">{myProfile.occupation}</p>
                  )}
                  {myProfile.location && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center space-x-2 font-normal">
                      <MapPin className="w-5 h-5 shrink-0" />
                      <span>{myProfile.location}</span>
                    </p>
                  )}
                </div>
              </div>
              {!isAdmin && (
                <div className="flex items-center space-x-4 w-full sm:w-auto">
                  <button onClick={() => onEditMember(myProfile)}
                    className="w-full sm:w-auto px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs rounded-2xl transition shadow-sm flex items-center justify-center space-x-3 font-normal cursor-pointer"
                  >
                    <Edit3 className="w-6 h-6" />
                    <span>Edit Profile & Upload Media</span>
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-sm font-normal">
              <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-sm uppercase text-slate-500 dark:text-slate-400 block font-normal">Email Address</span>
                <span className="text-slate-900 dark:text-white font-mono text-sm break-all font-normal">{myProfile.email}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-sm uppercase text-slate-500 dark:text-slate-400 block font-normal">Phone / WhatsApp</span>
                <span className="text-slate-900 dark:text-white font-mono text-sm font-normal">{myProfile.phoneNumber}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-sm uppercase text-slate-500 dark:text-slate-400 block font-normal">Date of Birth</span>
                <span className="text-slate-900 dark:text-white text-sm font-normal">{myProfile.dateOfBirth || "—"}</span>
              </div>
              <div className="bg-amber-500/10 dark:bg-amber-950/40 p-6 rounded-2xl border border-amber-300 dark:border-amber-700/60 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase text-amber-800 dark:text-amber-400 font-extrabold block">Activity Points</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">Official</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{myProfile.activityPoints || 0}</span>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Points</span>
                </div>
              </div>
            </div>

            {myProfile.bio && (
              <div className="py-4 space-y-2 font-normal">
                <span className="text-sm uppercase text-slate-500 dark:text-slate-400 block font-normal">Bio / Summary</span>
                <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed font-normal">
                  "{myProfile.bio}"
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans font-normal">
      {/* Sticky Filter & Search Bar - Pinned directly below the sticky Sub-Tabs Bar */}
      <div className="sticky top-[136px] sm:top-[150px] z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl pt-2.5 pb-3.5 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b border-slate-200/80 dark:border-slate-800 transition-colors shadow-xs font-normal">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="w-6 h-6 text-slate-400 absolute left-4 top-3.5" />
            <input
              type="text"
              placeholder="Search members by any detail — AI-enhanced for birthdays, locations, skills..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-13 pr-6 py-3.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-normal shadow-xs"
            />
            {isAiSearching && (
              <div className="absolute right-4 top-3.5">
                <Sparkles className="w-5 h-5 text-purple-500 animate-spin" />
              </div>
            )}
          </form>

          {isAdmin && (
            <button
              type="button"
              onClick={handleExportToExcel}
              className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-semibold rounded-2xl transition shadow-sm flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
              title="Download full member database as Microsoft Excel CSV"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export to Excel (.csv)</span>
            </button>
          )}
        </div>
        <div className="flex items-center justify-between text-xs sm:text-sm text-slate-500 dark:text-slate-400 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60 font-normal mt-2.5">
          <span>
            Showing <strong className="text-slate-900 dark:text-white font-normal">{displayedMembers.length}</strong> of {members.length} member entries
            {aiResults !== null && isAiSearching === false && (
              <span className="ml-2 text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1 inline-flex">
                <Sparkles className="w-3 h-3" /> AI ranked
              </span>
            )}
            {isAiSearching && (
              <span className="ml-2 text-purple-600 dark:text-purple-400 font-medium inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3 animate-spin" /> AI searching...
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Standalone Desktop Table Header Row - LOCKED DIRECTLY BELOW FIXED NAVBAR */}
      <div className="hidden">
      </div>

      {/* RESPONSIVE TABLE / CONTAINER */}
      <div className="transition-colors font-normal overflow-hidden">
        {/* Rows (Desktop) / Lists (Mobile) */}
        <div className="p-4 md:p-0">
          {displayedMembers.length === 0 ? (
            <div className="p-16 text-center text-slate-500 dark:text-slate-400 text-sm font-normal">
              No member records found matching your search.
            </div>
          ) : (
            displayedMembers.map((m) => {
              const addressParts = [m.streetName, m.estateName, m.area, m.otherArea].filter(Boolean);
              const fullAddressStr = addressParts.length > 0 ? addressParts.join(", ") : "Not Specified";
              const formattedName = formatMemberName(m.title, m.fullName);

              return (
                  <div
                    key={m.id}
                    data-id={m.id}
                    className="flex flex-col py-6 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors border-b border-slate-200/80 dark:border-slate-800 font-normal"
                  >
                    {/* Header Card (Identity) */}
                    <div className="w-full mb-6 px-5 py-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-1 md:gap-4">
                      <div className="flex w-full md:w-auto items-center gap-4 shrink-0">
                        <MemberAvatar member={m} sizeClassName="w-14 h-14 shrink-0 shadow-xs" textClassName="text-base font-medium" />
                        <div className="flex flex-col pb-1.5 md:pb-0 border-b border-slate-200 dark:border-slate-700 md:border-b-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-semibold text-slate-900 dark:text-white leading-tight break-words">
                              {formattedName}
                            </span>
                            {m.role === "admin" && (
                              <span className="px-2 py-0.5 text-[10px] uppercase bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 rounded-full border border-amber-300 dark:border-amber-800/50 font-bold tracking-wide">
                                ADMIN
                              </span>
                            )}
                            {m.status && (
                              <span className="px-2 py-0.5 text-[10px] uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-600 font-bold tracking-wide">
                                {m.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row flex-wrap items-center mt-1 w-full md:w-auto md:mt-0 md:ml-auto text-sm">
                        <div className="pr-3 md:px-3 flex items-center gap-1.5 md:border-l border-slate-200 dark:border-slate-700">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">School:</span>
                          <span className="text-slate-900 dark:text-white font-medium">{m.schoolName || "N/A"}</span>
                        </div>
                        {m.gradYear && (
                          <div className="pl-3 md:px-3 flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700">
                            <span className="text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">Class of</span>
                            <span className="text-slate-900 dark:text-white font-medium">{m.gradYear}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Body Section (Unified Modern Layout) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 px-2 sm:px-6 py-4">
                      
                      {/* Column 1 */}
                      <div className="space-y-10">
                        {/* Personal & Status Section */}
                        <div className="space-y-5">
                          <h4 className="text-xs font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800/60 pb-2">Personal & Status</h4>
                          <div className="space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-500">
                                <User className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-slate-500 font-medium">Marital Status</span>
                                <span className="text-sm text-slate-900 dark:text-white font-medium mt-0.5">
                                  {m.maritalStatus && m.maritalStatus.trim() !== "" ? m.maritalStatus : <span className="text-slate-400 font-normal italic">Unspecified</span>}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-500">
                                <Briefcase className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-slate-500 font-medium">Occupation</span>
                                <span className="text-sm text-slate-900 dark:text-white font-medium mt-0.5">
                                  {m.occupation && m.occupation.trim() !== "" && m.occupation.trim().toLowerCase() !== "member" ? m.occupation : <span className="text-slate-400 font-normal italic">Unspecified</span>}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-500">
                                <Users className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-slate-500 font-medium">Skills</span>
                                <span className="text-sm text-slate-900 dark:text-white font-medium mt-0.5">
                                  {m.skills && m.skills.length > 0 && m.skills[0].toLowerCase() !== "community support" ? m.skills.join(", ") : <span className="text-slate-400 font-normal italic">Unspecified</span>}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Residence & Details Section */}
                        <div className="space-y-5">
                          <h4 className="text-xs font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800/60 pb-2">Residence & Details</h4>
                          <div className="space-y-4">
                            <div className="flex items-start gap-4">
                              <div className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400">
                                <MapPin className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col pt-1">
                                <span className="text-xs text-slate-500 font-medium">Address</span>
                                <span className="text-sm text-slate-900 dark:text-white font-medium mt-0.5 leading-relaxed">
                                  {fullAddressStr}
                                </span>
                              </div>
                            </div>
                            
                            <div className="space-y-4 pt-2">
                              {m.dateOfBirth && (
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400">
                                    <Cake className="w-5 h-5" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs text-slate-500 font-medium">Birthday</span>
                                    <span className="text-sm text-slate-900 dark:text-white font-medium mt-0.5">{m.dateOfBirth}</span>
                                  </div>
                                </div>
                              )}
                              {m.jerseySize && (
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400">
                                    <Shirt className="w-5 h-5" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-xs text-slate-500 font-medium">Jersey Size</span>
                                    <span className="text-sm text-slate-900 dark:text-white font-semibold mt-0.5">{m.jerseySize}</span>
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                                  <Award className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs text-slate-500 font-medium">Points (Pts)</span>
                                  <span className="text-sm text-amber-600 dark:text-amber-400 font-bold mt-0.5">{m.activityPoints || 0}</span>
                                </div>
                              </div>
                            </div>
                            
                            {m.bio && m.bio.trim().toLowerCase() !== "team taraba river member" && (
                              <div className="pt-3">
                                <p className="text-sm text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                  "{m.bio}"
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Column 2 */}
                      <div className="space-y-10">
                        {/* Contact Info Section */}
                        <div className="space-y-5">
                          <h4 className="text-xs font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800/60 pb-2">Contact Info</h4>
                          <div className="space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400">
                                <Mail className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs text-slate-500 font-medium">Email Address</span>
                                {m.email ? (
                                  <a href={`mailto:${m.email}`} className="text-sm text-slate-900 dark:text-white font-medium hover:text-teal-600 transition-colors mt-0.5 truncate">
                                    {m.email}
                                  </a>
                                ) : (
                                  <span className="text-sm text-slate-400 font-normal italic mt-0.5">Not provided</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                                <Phone className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs text-slate-500 font-medium">Phone Number</span>
                                {m.phoneNumber ? (
                                  <a href={`tel:${m.phoneNumber}`} className="text-sm text-slate-900 dark:text-white font-medium hover:text-indigo-600 transition-colors mt-0.5 truncate">
                                    {m.phoneNumber}
                                  </a>
                                ) : (
                                  <span className="text-sm text-slate-400 font-normal italic mt-0.5">Not provided</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                                <MessageSquare className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs text-slate-500 font-medium">WhatsApp</span>
                                {m.whatsappNumber ? (
                                  <a href={formatWhatsappUrl(m.whatsappNumber)} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-900 dark:text-white font-medium hover:text-emerald-600 transition-colors mt-0.5 truncate">
                                    {m.whatsappNumber}
                                  </a>
                                ) : (
                                  <span className="text-sm text-slate-400 font-normal italic mt-0.5">Not provided</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Emergency & Contacts Section */}
                        <div className="space-y-5">
                          <h4 className="text-xs font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase border-b border-slate-100 dark:border-slate-800/60 pb-2">Emergency Contacts</h4>
                          <div className="space-y-4">
                            <div className="flex items-start gap-4">
                              <div className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400">
                                <Users className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col pt-1">
                                <span className="text-xs text-slate-500 font-medium">Next of Kin</span>
                                {m.nextOfKinName ? (
                                  <span className="text-sm text-slate-900 dark:text-white font-medium mt-0.5">
                                    {m.nextOfKinName} {m.nextOfKinPhone && <span className="text-slate-500 font-normal ml-1">({m.nextOfKinPhone})</span>}
                                  </span>
                                ) : (
                                  <span className="text-sm text-slate-400 font-normal italic mt-0.5">Unspecified</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-start gap-4">
                              <div className="w-10 h-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400">
                                <Users className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col pt-1">
                                <span className="text-xs text-slate-500 font-medium">Emergency Contact (Paddy)</span>
                                {m.closestNeighborName ? (
                                  <span className="text-sm text-slate-900 dark:text-white font-medium mt-0.5">
                                    {m.closestNeighborName} {m.closestNeighborPhone && <span className="text-slate-500 font-normal ml-1">({m.closestNeighborPhone})</span>}
                                  </span>
                                ) : (
                                  <span className="text-sm text-slate-400 font-normal italic mt-0.5">Unspecified</span>
                                )}
                              </div>
                            </div>
                            
                            {m.memberNotes && (
                              <div className="pt-3">
                                <div className="bg-amber-50/50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-100/50 dark:border-amber-900/30">
                                  <span className="text-xs text-amber-700 dark:text-amber-500 font-semibold uppercase tracking-wider mb-1 block">Admin Notes</span>
                                  <p className="text-sm text-slate-700 dark:text-slate-300">
                                    {m.memberNotes}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    </div>
                    
                    {!isAdmin && currentUser?.id === m.id && (
                      <div className="mt-4 flex justify-end">
                        <button onClick={() => onEditMember(m)}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 rounded-xl text-sm font-medium transition shadow-sm flex items-center gap-2 cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>Edit My Profile</span>
                        </button>
                      </div>
                    )}
                  </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
