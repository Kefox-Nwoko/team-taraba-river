import React from "react";
import { Member } from "../types";
import { AppStateManager } from "../services/storage";
import { LazyImage } from "./ui/LazyImage";

export function getMemberInitials(
  member?: { firstName?: string; surname?: string; fullName?: string } | null,
): string {
  if (!member) return "TR";
  let f = member.firstName?.trim();
  let s = member.surname?.trim();
  if (!f || !s) {
    if (member.fullName) {
      const cleanName = member.fullName
        .replace(
          /^(Mr\.|Mrs\.|Ms\.|Dr\.|Engr\.|Prof\.|Chief|Admin|Dr|Mr|Mrs|Ms|Engr|Prof)\s+/i,
          "",
        )
        .trim();
      const parts = cleanName.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        f = parts[0];
        s = parts[parts.length - 1];
      } else if (parts.length === 1) {
        f = parts[0];
        s = parts[0];
      }
    }
  }
  const firstLetter = f ? f[0].toUpperCase() : "";
  const surnameLetter = s ? s[0].toUpperCase() : "";
  const initials = `${firstLetter}${surnameLetter}`.trim();
  return initials || "TR";
}
const AVATAR_GRADIENTS = [
  "bg-gradient-to-br from-teal-700 to-emerald-900 text-white",
  "bg-gradient-to-br from-cyan-700 to-blue-900 text-white",
  "bg-gradient-to-br from-indigo-700 to-purple-900 text-white",
  "bg-gradient-to-br from-blue-700 to-indigo-900 text-white",
  "bg-gradient-to-br from-emerald-700 to-teal-900 text-white",
  "bg-gradient-to-br from-amber-600 to-yellow-800 text-white",
  "bg-gradient-to-br from-rose-700 to-red-900 text-white",
  "bg-gradient-to-br from-violet-700 to-purple-900 text-white",
  "bg-gradient-to-br from-sky-700 to-cyan-900 text-white",
  "bg-gradient-to-br from-slate-700 to-slate-900 text-white",
];
function getAvatarGradient(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}
interface MemberAvatarProps {
  member?: Partial<Member> | null;
  sizeClassName?: string;
  textClassName?: string;
  className?: string;
}
export const MemberAvatar: React.FC<MemberAvatarProps> = ({
  member,
  sizeClassName = "w-8 h-8",
  textClassName = "text-sm",
  className = "",
}) => {
  let effectivePhotoUrl = member?.photoUrl || "";
  let effectivePhotoStatus = member?.photoStatus;
  let effectiveMember = member;

  // Systemwide database image lookup by email, phone, or ID if direct photoUrl is missing
  if (!effectivePhotoUrl && member) {
    const matched = AppStateManager.findMatchingMember(member);
    if (matched && matched.photoUrl) {
      effectivePhotoUrl = matched.photoUrl;
      effectivePhotoStatus = matched.photoStatus;
      effectiveMember = { ...matched, ...member, photoUrl: matched.photoUrl };
    }
  }


  const initials = getMemberInitials(effectiveMember);
  const colorKey = effectiveMember?.id || effectiveMember?.fullName || effectiveMember?.firstName || "TR";
  const gradientClass = getAvatarGradient(colorKey);

  if (effectivePhotoUrl && effectivePhotoStatus !== 'rejected') {
    return (
      <LazyImage
        src={effectivePhotoUrl}
        alt={effectiveMember?.fullName || "Member Profile"}
        referrerPolicy="no-referrer"
        className={`${sizeClassName} rounded-full object-cover shrink-0 shadow-sm border border-slate-200 dark:border-slate-700 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClassName} rounded-full ${gradientClass} flex items-center justify-center shrink-0 shadow-sm uppercase tracking-wider border border-white/20 dark:border-slate-700/50 ${textClassName} ${className}`}
      title={effectiveMember?.fullName || "Member Profile"}
    >
      {initials}
    </div>
  );
};
