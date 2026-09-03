import React, { useState } from "react";
import { logger } from "../lib/logger";
import { Member } from "../types";
import { registerMember, updateMemberProfile } from "../services/apiClient";
import { AppStateManager } from "../services/storage";
import { FirebaseSyncManager } from "../services/firebaseService";
import { MEMBER_DATABASE_SCHEMA } from "../constants/memberSchema";
import { ALL_115_UNITY_SCHOOLS } from "../constants/unitySchools";
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
  Ruler,
  ChevronDown,
} from "lucide-react";
import { DatePicker } from "./DatePicker";
import { MemberAvatar, getMemberInitials } from "./MemberAvatar";
import { TShirtSizeGuideModal } from "./TShirtSizeGuideModal";
import {
  extractAndCleanMemberNames,
  stripTitlePrefixes,
  normalizeTitle,
} from "../utils/nameUtils";
import { isMemberProfileComplete, getMissingMemberFields } from "../utils/memberValidation";

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
  const isForceUpdate = memberToEdit ? !isMemberProfileComplete(memberToEdit) : false;
  const missingFields = memberToEdit ? getMissingMemberFields(memberToEdit) : [];

  const [formData, setFormData] = useState<Record<string, any>>(() => {
    if (memberToEdit) {
      const cleaned = extractAndCleanMemberNames(memberToEdit);
      return {
        title: cleaned.title,
        firstName: cleaned.firstName,
        surname: cleaned.surname,
        fullName: cleaned.fullName,
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
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);

  if (!isOpen) return null;

  const handleFieldChange = (key: string, value: any) => {
    setFormData((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === "title") {
        updated.title = normalizeTitle(value);
      }
      if (key === "firstName") {
        updated.firstName = stripTitlePrefixes(value);
      }
      if (key === "surname") {
        updated.surname = stripTitlePrefixes(value);
      }
      if (key === "firstName" || key === "surname" || key === "title") {
        updated.fullName = [updated.firstName, updated.surname].filter(Boolean).join(" ");
      }
      return updated;
    });
  };

  const formatBirthdayLabel = (val: string) => {
    if (!val || typeof val !== "string" || !val.trim()) {
      return "Select Birthday (Date & Month)";
    }
    try {
      const parts = val.trim().split(/[-/]/);
      if (parts.length === 3) {
        const [year, month, day] = parts;
        const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
        }
      }
      return val;
    } catch {
      return val;
    }
  };

  const getNormalizedIsoDate = (val: string) => {
    if (!val || typeof val !== "string") {
      return new Date().toISOString().split("T")[0];
    }
    const clean = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      return clean;
    }
    const parsed = new Date(`${clean} 2000`);
    if (!isNaN(parsed.getTime())) {
      const y = 2000;
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      const d = String(parsed.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return new Date().toISOString().split("T")[0];
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

    const cleanedNames = extractAndCleanMemberNames({
      title: formData.title,
      firstName: formData.firstName,
      surname: formData.surname,
      fullName: formData.fullName,
    });

    // Validate all mandatory schema fields
    const missingLabels: string[] = [];
    for (const field of MEMBER_DATABASE_SCHEMA) {
      if (field.required) {
        let val = formData[field.key];
        if (field.key === "title") val = cleanedNames.title;
        if (field.key === "firstName") val = cleanedNames.firstName;
        if (field.key === "surname") val = cleanedNames.surname;
        if (field.key === "fullName") val = cleanedNames.fullName;

        if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) {
          missingLabels.push(field.label);
        }
      }
    }

    if (missingLabels.length > 0) {
      setError(`Please complete all required mandatory fields before saving: ${missingLabels.join(", ")}`);
      return;
    }

    setIsSubmitting(true);

    try {
      const skillsArray = typeof formData.skills === "string"
        ? formData.skills.split(",").map((s: string) => s.trim()).filter(Boolean)
        : formData.skills || [];

      const payload: Partial<Member> = {
        title: cleanedNames.title,
        firstName: cleanedNames.firstName,
        surname: cleanedNames.surname,
        fullName: cleanedNames.fullName,
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
            <div className="p-5 bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-300 text-sm rounded-2xl flex items-start space-x-3.5 font-normal shadow-xs animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <p className="font-bold text-sm text-amber-800 dark:text-amber-200">
                  ⚠️ Action Required: Mandatory Profile & T-Shirt / Jersey Size Update
                </p>
                <p className="text-xs opacity-90 leading-relaxed text-slate-700 dark:text-slate-300">
                  Welcome! To keep our community member directory up to date and prepare official event apparel, all returning members must update any blank mandatory fields and <strong>select their T-shirt / Jersey size</strong>.
                </p>
                {missingFields.length > 0 && (
                  <div className="pt-2">
                    <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                      Fields requiring your update ({missingFields.length}):
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {missingFields.map((f) => (
                        <span
                          key={f.key}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                            f.key === "jerseySize"
                              ? "bg-teal-500/20 text-teal-800 dark:text-teal-300 border-teal-500/40 animate-pulse"
                              : "bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-500/30"
                          }`}
                        >
                          {f.key === "jerseySize" ? "👕 " : "• "}{f.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-sm text-slate-800 dark:text-slate-200 font-normal">
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                          </label>
                          {field.key === "jerseySize" && (
                            <button
                              type="button"
                              onClick={() => setIsSizeGuideOpen(true)}
                              className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1 hover:underline cursor-pointer bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-lg border border-teal-200 dark:border-teal-800/60 transition"
                            >
                              <Ruler className="w-3.5 h-3.5" />
                              <span>📐 View Size Chart</span>
                            </button>
                          )}
                        </div>
                        {field.type === "select" ? (
                          <select
                            required={field.required}
                            value={value}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition shadow-sm font-normal"
                          >
                            <option value="">-- {field.placeholder || "Select option"} --</option>
                            {field.key === "schoolName" ? (
                              <>
                                {value && !ALL_115_UNITY_SCHOOLS.some((s) => s.shortName === value) && value !== "Other / External High School" && (
                                  <option value={value}>📌 {value} (Current / Custom)</option>
                                )}
                                <optgroup label="── 📍 SOUTH-SOUTH (18 Unity Colleges) ──">
                                  {ALL_115_UNITY_SCHOOLS.filter((s) => s.zone === "South-South")
                                    .sort((a, b) => a.shortName.localeCompare(b.shortName))
                                    .map((s) => (
                                      <option key={s.id} value={s.shortName}>
                                        {s.shortName} ({s.state} State)
                                      </option>
                                    ))}
                                </optgroup>
                                <optgroup label="── 📍 SOUTH-EAST (15 Unity Colleges) ──">
                                  {ALL_115_UNITY_SCHOOLS.filter((s) => s.zone === "South-East")
                                    .sort((a, b) => a.shortName.localeCompare(b.shortName))
                                    .map((s) => (
                                      <option key={s.id} value={s.shortName}>
                                        {s.shortName} ({s.state} State)
                                      </option>
                                    ))}
                                </optgroup>
                                <optgroup label="── 📍 SOUTH-WEST (19 Unity Colleges) ──">
                                  {ALL_115_UNITY_SCHOOLS.filter((s) => s.zone === "South-West")
                                    .sort((a, b) => a.shortName.localeCompare(b.shortName))
                                    .map((s) => (
                                      <option key={s.id} value={s.shortName}>
                                        {s.shortName} ({s.state} State)
                                      </option>
                                    ))}
                                </optgroup>
                                <optgroup label="── 📍 NORTH-CENTRAL (24 Unity Colleges) ──">
                                  {ALL_115_UNITY_SCHOOLS.filter((s) => s.zone === "North-Central")
                                    .sort((a, b) => a.shortName.localeCompare(b.shortName))
                                    .map((s) => (
                                      <option key={s.id} value={s.shortName}>
                                        {s.shortName} ({s.state} State)
                                      </option>
                                    ))}
                                </optgroup>
                                <optgroup label="── 📍 NORTH-EAST (18 Unity Colleges) ──">
                                  {ALL_115_UNITY_SCHOOLS.filter((s) => s.zone === "North-East")
                                    .sort((a, b) => a.shortName.localeCompare(b.shortName))
                                    .map((s) => (
                                      <option key={s.id} value={s.shortName}>
                                        {s.shortName} ({s.state} State)
                                      </option>
                                    ))}
                                </optgroup>
                                <optgroup label="── 📍 NORTH-WEST (21 Unity Colleges) ──">
                                  {ALL_115_UNITY_SCHOOLS.filter((s) => s.zone === "North-West")
                                    .sort((a, b) => a.shortName.localeCompare(b.shortName))
                                    .map((s) => (
                                      <option key={s.id} value={s.shortName}>
                                        {s.shortName} ({s.state} State)
                                      </option>
                                    ))}
                                </optgroup>
                                <optgroup label="── 🌍 OTHER / EXTERNAL ──">
                                  <option value="Other / External High School">Other / External High School</option>
                                </optgroup>
                              </>
                            ) : field.key === "jerseySize" ? (
                              <>
                                <optgroup label="── 🇳🇬 ASIAN SIZING (Nigerian Local Markets) ──">
                                  {field.options
                                    ?.filter((opt) => opt.startsWith("Asian"))
                                    .map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                </optgroup>
                                <optgroup label="── 🇺🇸 AMERICAN / UK SIZING (US Brands) ──">
                                  {field.options
                                    ?.filter((opt) => opt.startsWith("US"))
                                    .map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                </optgroup>
                              </>
                            ) : (
                              field.options?.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))
                            )}
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
                        ) : field.key === "dateOfBirth" ? (
                          <div className="relative w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-5 py-4 flex items-center justify-between text-sm text-slate-900 dark:text-white cursor-pointer select-none shadow-sm hover:border-teal-500/60 transition font-normal">
                            <span className={`truncate ${!value ? "text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white font-medium"}`}>
                              {formatBirthdayLabel(value)}
                            </span>
                            <div className="flex items-center space-x-1 text-slate-400 dark:text-slate-500 shrink-0">
                              <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                              <ChevronDown className="w-4 h-4 text-cyan-500" />
                            </div>
                            <DatePicker
                              value={getNormalizedIsoDate(value)}
                              onChange={(val) => {
                                handleFieldChange("dateOfBirth", val);
                                if (val) {
                                  const [y, m, d] = val.split("-");
                                  const mIndex = parseInt(m, 10) - 1;
                                  const mName = [
                                    "January", "February", "March", "April", "May", "June",
                                    "July", "August", "September", "October", "November", "December"
                                  ][mIndex];
                                  handleFieldChange("birthMonth", mName);
                                  handleFieldChange("birthDay", parseInt(d, 10).toString());
                                }
                              }}
                              required={field.required}
                            />
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

      <TShirtSizeGuideModal
        isOpen={isSizeGuideOpen}
        onClose={() => setIsSizeGuideOpen(false)}
        selectedSize={formData.jerseySize}
        onSelectSize={(sz) => handleFieldChange("jerseySize", sz)}
      />
    </div>
  );
};
