import React, { useState } from "react";
import { logger } from "../lib/logger";
import { Member } from "../types";
import { registerMember, updateMemberProfile } from "../services/apiClient";
import { AppStateManager } from "../services/storage";
import { FirebaseSyncManager } from "../services/firebaseService";
import { MEMBER_DATABASE_SCHEMA } from "../constants/memberSchema";
import {
  X,
  User,
  Mail,
  Phone,
  Calendar,
  Briefcase,
  MapPin,
  School,
  Heart,
  Award,
  Shield,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Upload,
} from "lucide-react";
import { MemberAvatar, getMemberInitials } from "./MemberAvatar";

interface MemberRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberToEdit?: Member | null;
  onSuccess: (updatedMember: Member) => void;
  originatingPageName?: string;
  onOpenTerms?: () => void;
}

export const MemberRegistrationModal: React.FC<MemberRegistrationModalProps> = ({
  isOpen,
  onClose,
  memberToEdit,
  onSuccess,
  originatingPageName = "Dashboard",
  onOpenTerms,
}) => {
  const isProfileComplete = (user: Member | null | undefined): boolean => {
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

  const isForceUpdate = memberToEdit ? !isProfileComplete(memberToEdit) : false;

  const [formData, setFormData] = useState<Record<string, any>>(() => {
    if (memberToEdit) {
      return {
        title: memberToEdit.title || "",
        firstName: memberToEdit.firstName || memberToEdit.fullName.split(" ")[0] || "",
        surname: memberToEdit.surname || memberToEdit.fullName.split(" ").slice(1).join(" ") || "",
        fullName: memberToEdit.fullName || "",
        email: memberToEdit.email || "",
        phoneNumber: memberToEdit.phoneNumber || "",
        whatsappNumber: memberToEdit.whatsappNumber || "",
        dateOfBirth: memberToEdit.dateOfBirth || "",
        birthMonth: memberToEdit.birthMonth || "",
        birthDay: memberToEdit.birthDay || "",
        maritalStatus: memberToEdit.maritalStatus || "",
        schoolName: memberToEdit.schoolName || "",
        gradYear: memberToEdit.gradYear || "",
        occupation: memberToEdit.occupation || "",
        location: memberToEdit.location || "",
        estateName: memberToEdit.estateName || "",
        streetName: memberToEdit.streetName || "",
        area: memberToEdit.area || "",
        otherArea: memberToEdit.otherArea || "",
        photoUrl: memberToEdit.photoUrl || "",
        skills: (memberToEdit.skills || []).join(", "),
        jerseySize: memberToEdit.jerseySize || "",
        nextOfKinName: memberToEdit.nextOfKinName || "",
        nextOfKinPhone: memberToEdit.nextOfKinPhone || "",
        closestNeighborName: memberToEdit.closestNeighborName || "",
        closestNeighborPhone: memberToEdit.closestNeighborPhone || "",
        bio: memberToEdit.bio || "",
      };
    }
    const initial: Record<string, any> = {};
    MEMBER_DATABASE_SCHEMA.forEach((f) => {
      initial[f.key] = "";
    });
    return initial;
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  if (!isOpen) return null;

  const handleFieldChange = (key: string, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === "firstName" || key === "surname" || key === "title") {
        const parts = [updated.title, updated.firstName, updated.surname].filter(Boolean);
        updated.fullName = parts.join(" ");
      }
      return updated;
    });
  };

  const handleFileChange = (key: string, file: File | null) => {
    if (!file) {
      handleFieldChange(key, "");
      return;
    }
    
    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file (jpg, png, webp).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) { 
      setError("Image size should be less than 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setError(null);
        handleFieldChange(key, event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!acceptedTerms) {
      setError("You must read and agree to the Terms and Conditions before saving.");
      return;
    }

    const fName = formData.firstName?.trim() || "";
    const sName = formData.surname?.trim() || "";
    const computedFullName = `${fName} ${sName}`.trim();

    setIsSubmitting(true);

    try {
      const skillsArray = typeof formData.skills === "string"
        ? formData.skills.split(",").map((s: string) => s.trim()).filter(Boolean)
        : formData.skills || [];

      const payload: Partial<Member> = {
        title: formData.title || "",
        firstName: fName,
        surname: sName,
        fullName: computedFullName,
        email: formData.email.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        whatsappNumber: formData.whatsappNumber?.trim() || formData.phoneNumber.trim(),
        dateOfBirth: formData.dateOfBirth || "",
        maritalStatus: formData.maritalStatus || "",
        schoolName: formData.schoolName || "",
        gradYear: formData.gradYear || "",
        occupation: formData.occupation || "",
        estateName: formData.estateName || "",
        streetName: formData.streetName || "",
        area: formData.area || "",
        otherArea: formData.otherArea || "",
        photoUrl: formData.photoUrl || "",
        skills: skillsArray,
        jerseySize: formData.jerseySize || "",
        nextOfKinName: formData.nextOfKinName || "",
        nextOfKinPhone: formData.nextOfKinPhone || "",
        closestNeighborName: formData.closestNeighborName || "",
        closestNeighborPhone: formData.closestNeighborPhone || "",
      };

      let resultMember: Member;

      if (memberToEdit) {
        resultMember = await updateMemberProfile(memberToEdit.id, payload);
        await FirebaseSyncManager.saveMember(resultMember);
        const members = AppStateManager.getMembers();
        const idx = members.findIndex((m) => m.id === memberToEdit.id);
        if (idx !== -1) {
          members[idx] = { ...members[idx], ...resultMember };
          AppStateManager.saveMembers(members);
        }
      } else {
        resultMember = await registerMember(payload);
        await FirebaseSyncManager.saveMember(resultMember);
        const members = AppStateManager.getMembers();
        members.unshift(resultMember);
        AppStateManager.saveMembers(members);
        // Set first visit count for newly registered member
        localStorage.setItem(`taraba_user_visit_count_${resultMember.id}`, "1");
      }

      onSuccess(resultMember);
      onClose();
    } catch (err: any) {
      logger.error("Member registration error", err);
      setError(err.message || "Failed to save member details. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = Array.from(new Set(MEMBER_DATABASE_SCHEMA.map((f) => f.category)));

  return (
    <div className="w-full space-y-4 sm:space-y-6 animate-fadeIn font-normal">
      {/* Top Navigation Bar - No background block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-sm sm:text-sm text-slate-900 dark:text-white tracking-tight font-normal">
            {memberToEdit ? "Edit Member Profile" : "Member Registration Form"}
          </h1>
        </div>
        {!isForceUpdate && (
          <button onClick={onClose} className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs rounded-2xl transition shadow-md flex items-center justify-center space-x-2.5 group cursor-pointer shrink-0 font-normal" >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>Back to {originatingPageName}</span>
          </button>
        )}
      </div>

      {/* Main Form Body - No background block */}
      <div className="space-y-6 font-normal">
        <form onSubmit={handleSubmit} className="space-y-8 font-normal">
          {isForceUpdate && (
            <div className="p-5 bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 text-sm rounded-2xl flex items-start space-x-3.5 font-normal">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-sm">Action Required: Complete Your Profile</p>
                <p className="text-xs opacity-90 leading-relaxed">
                  Please update all mandatory fields (all fields except Marital Status and Skills) to activate your account. You will be able to explore the calendar, media library, and directories immediately after saving.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-red-800 dark:text-red-200 text-sm rounded-2xl flex items-center space-x-3 font-normal">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {categories.map((cat) => {
            const fieldsInCategory = MEMBER_DATABASE_SCHEMA.filter((f) => f.category === cat);
            const categoryTitle = fieldsInCategory[0]?.categoryLabel || cat;
            return (
              <div
                key={cat}
                className="space-y-4 py-4 sm:py-6 border-b border-slate-200 dark:border-slate-800 font-normal"
              >
                <h3 className="text-sm uppercase tracking-wider text-teal-800 dark:text-teal-400 border-b border-slate-200 dark:border-slate-700 pb-3 font-normal">
                  {categoryTitle}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-1">
                  {fieldsInCategory.map((field) => {
                    const value = formData[field.key] ?? "";
                    return (
                      <div
                        key={field.key}
                        className={field.type === "textarea" ? "sm:col-span-2 lg:col-span-3" : ""}
                      >
                        <label className="block text-sm text-slate-800 dark:text-slate-200 mb-1 font-normal">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        {field.type === "select" ? (
                          <select
                            required={field.required}
                            value={value}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition shadow-sm font-normal"
                          >
                            <option value="">-- {field.placeholder || "Select option"} --</option>
                            {field.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : field.type === "textarea" ? (
                          <textarea
                            required={field.required}
                            rows={4}
                            value={value}
                            placeholder={field.placeholder}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition shadow-sm resize-none font-normal"
                          />
                        ) : field.type === "file" ? (
                          <div className="flex flex-col space-y-3">
                            <label className="w-fit cursor-pointer inline-block bg-teal-50 text-teal-700 hover:bg-teal-100 py-3 px-6 rounded-xl text-sm font-semibold transition shadow-sm border border-teal-200 dark:border-teal-800">
                              Choose Image
                              <input
                                required={field.required && !value}
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleFileChange(field.key, e.target.files?.[0] || null)}
                                className="hidden"
                              />
                            </label>
                            {value && value.startsWith("data:image") && (
                              <img src={value} alt="Preview" className="w-24 h-24 object-cover rounded-xl shadow-sm border border-slate-200 dark:border-slate-700" />
                            )}
                            {value && !value.startsWith("data:image") && (
                              <img src={value} alt="Preview" className="w-24 h-24 object-cover rounded-xl shadow-sm border border-slate-200 dark:border-slate-700" />
                            )}
                          </div>
                        ) : (
                          <input
                            required={field.required}
                            type={field.type || "text"}
                            value={value}
                            placeholder={field.placeholder}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition shadow-sm font-normal"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}



          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <label className="flex items-start space-x-3 cursor-pointer group">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  required
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-600 dark:border-slate-600 dark:bg-slate-700 dark:ring-offset-slate-900 transition-colors"
                />
              </div>
              <div className="text-sm">
                <span className="text-slate-600 dark:text-slate-300 font-normal">
                  I have read and agreed to the{" "}
                </span>
                <button
                  type="button"
                  onClick={onOpenTerms}
                  className="text-teal-600 dark:text-teal-400 hover:underline font-medium"
                >
                  Terms and Conditions
                </button>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-800">
            {!isForceUpdate ? (
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition flex items-center space-x-2 font-normal cursor-pointer" >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to {originatingPageName}</span>
              </button>
            ) : (
              <div />
            )}
            <button type="submit" disabled={isSubmitting} className="px-3 py-1.5 text-xs text-white bg-teal-700 hover:bg-teal-800 rounded-2xl transition shadow-lg shadow-teal-700/20 flex items-center space-x-3 disabled:opacity-50 active:scale-95 font-normal cursor-pointer" >
              <CheckCircle2 className="w-6 h-6" />
              <span>
                {isSubmitting ? "Saving..." : memberToEdit ? "Save Changes" : "Submit Registration"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
