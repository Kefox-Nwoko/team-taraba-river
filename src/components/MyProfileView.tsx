import React, { useState } from "react";
import { Member } from "../types";
import { MEMBER_DATABASE_SCHEMA } from "../constants/memberSchema";
import { MemberAvatar } from "./MemberAvatar";
import { MemberRegistrationModal } from "./MemberRegistrationModal";
import { UserCheck, Mail, Phone, MessageSquare } from "lucide-react";

function formatWhatsappUrl(phone?: string): string {
  if (!phone) return "#";
  const clean = phone.replace(/\D/g, "");
  return `https://wa.me/${clean}`;
}

function formatMemberName(_title?: string, fullName?: string): string {
  if (!fullName) return "";
  let cleanName = fullName.trim();
  cleanName = cleanName.replace(
    /^(Dr\.|Mr\.|Mrs\.|Ms\.|Engr\.|Chief|Prof\.|Dr|Mr|Mrs|Ms|Engr|Prof)\s+/i,
    ""
  );
  const parts = cleanName.split(/\s+/);
  if (parts.length > 1) {
    const surname = parts.pop() || "";
    parts.push(surname.toUpperCase());
    return parts.join(" ");
  }
  return cleanName.toUpperCase();
}

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

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-36 pb-16 animate-fadeIn font-normal">
      {/* Header & Avatar */}
      <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8 mb-12">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 w-full">
          <MemberAvatar
            member={currentUser}
            sizeClassName="w-32 h-32 sm:w-40 sm:h-40"
            textClassName="text-3xl"
          />
          <div className="flex-1 text-center sm:text-left space-y-3 mt-4 sm:mt-0">
            <h1 className="text-xl sm:text-2xl tracking-tight text-slate-900 dark:text-white">
              {formattedName}
            </h1>
            <p className="text-sm sm:text-sm text-teal-700 dark:text-teal-400">
              {currentUser.role === "admin" ? "Administrator" : "Team Member"}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-4">
              {currentUser.email && (
                <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
                  <Mail className="w-5 h-5 text-teal-600" />
                  <span className="text-sm">{currentUser.email}</span>
                </div>
              )}
              {currentUser.phoneNumber && (
                <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
                  <Phone className="w-5 h-5 text-slate-400" />
                  <span className="text-sm">{currentUser.phoneNumber}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <button onClick={() => setIsEditing(true)}
          className="shrink-0 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs rounded-full transition shadow-lg flex items-center space-x-3 cursor-pointer w-full md:w-auto justify-center"
        >
          <UserCheck className="w-6 h-6" />
          <span>Edit My Profile</span>
        </button>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800 mb-10" />

      {/* Dynamic Data Display */}
      <div className="space-y-12">
        {categories.map((cat) => {
          const fieldsInCategory = MEMBER_DATABASE_SCHEMA.filter((f) => f.category === cat);
          const categoryTitle = fieldsInCategory[0]?.categoryLabel || cat;

          return (
            <div key={cat} className="space-y-6">
              <h3 className="text-sm font-normal text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-3">
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
                      <p className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                        {field.label}
                      </p>
                      {field.type === "file" && displayValue !== "Not specified" ? (
                        <img 
                          src={displayValue} 
                          alt="Profile Preview" 
                          className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700" 
                        />
                      ) : (
                        <p className="text-sm text-slate-900 dark:text-white break-words">
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
