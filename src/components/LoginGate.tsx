import React, { useState, useEffect } from "react";
import { Member } from "../types";
import { loginMember } from "../services/apiClient";
import { signInWithCustomToken } from "../services/firebaseService";
import { AppStateManager } from "../services/storage";
import { triggerGoogleAdminSignIn } from "../services/firebaseService";
import { LogIn, UserPlus, ArrowRight, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { BRAND_LOGO, LOGIN_WALL_BG } from "../constants/assets";
import { clientConfig } from "../lib/config";
interface LoginGateProps {
  onLoginSuccess: (member: Member) => void;
  onOpenRegister: () => void;
  availableMembers: Member[];
  onExploreGuest?: () => void;
}
export const LoginGate: React.FC<LoginGateProps> = ({
  onLoginSuccess,
  onOpenRegister,
  availableMembers,
  onExploreGuest,
}) => {
  const [credential, setCredential] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Load the heavy login wallpaper after first paint so it never blocks the
  // initial render on slow connections — a cheap gradient shows instantly.
  const [wallLoaded, setWallLoaded] = useState(false);
  useEffect(() => {
    const img = new Image();
    img.src = LOGIN_WALL_BG;
    img.onload = () => setWallLoaded(true);
  }, []);
  const handleAdminLogin = async () => {
    setIsAdminLoading(true);
    setError(null);
    try {
      const adminMember = await triggerGoogleAdminSignIn();
      if (!adminMember.email || !clientConfig.adminEmails.includes(adminMember.email.toLowerCase())) {
        throw new Error("Access Denied: Account not permitted.");
      }
      AppStateManager.setCurrentUser(adminMember);
      onLoginSuccess(adminMember);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Admin authentication failed. Please try again."
      );
    } finally {
      setIsAdminLoading(false);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credential.trim()) return;
    setError(null);
    setIsLoading(true);

    try {
      const norm = credential.trim().toLowerCase();
      const cleanDigits = norm.replace(/\D/g, "");
      let membersList = availableMembers.length > 0 ? availableMembers : AppStateManager.getMembers();
      if (membersList.length === 0) {
        try {
          membersList = await FirebaseSyncManager.seedCSVDataIfNeeded();
        } catch {}
      }

      const matchFn = (m: Member): boolean => {
        // 1. Email match
        if (m.email && m.email.trim().toLowerCase() === norm) return true;
        // 2. ID match
        if (m.id && m.id.trim().toLowerCase() === norm) return true;
        // 3. Phone / WhatsApp match (Handles +234, 080..., 80..., spaces, dashes)
        if (cleanDigits.length >= 7) {
          const mPhoneDigits = (m.phoneNumber || "").replace(/\D/g, "");
          const mWaDigits = (m.whatsappNumber || "").replace(/\D/g, "");
          const searchLast10 = cleanDigits.slice(-10);
          const searchLast9 = cleanDigits.slice(-9);
          const searchLast8 = cleanDigits.slice(-8);

          if (mPhoneDigits.length >= 7) {
            if (mPhoneDigits === cleanDigits) return true;
            if (mPhoneDigits.slice(-10) === searchLast10) return true;
            if (mPhoneDigits.slice(-9) === searchLast9) return true;
            if (mPhoneDigits.slice(-8) === searchLast8) return true;
            if (mPhoneDigits.endsWith(cleanDigits) || cleanDigits.endsWith(mPhoneDigits)) return true;
          }
          if (mWaDigits.length >= 7) {
            if (mWaDigits === cleanDigits) return true;
            if (mWaDigits.slice(-10) === searchLast10) return true;
            if (mWaDigits.slice(-9) === searchLast9) return true;
            if (mWaDigits.slice(-8) === searchLast8) return true;
            if (mWaDigits.endsWith(cleanDigits) || cleanDigits.endsWith(mWaDigits)) return true;
          }
        }
        // 4. Name match (full name, first name, surname, or tokens)
        const fullNameLower = (m.fullName || "").trim().toLowerCase();
        const firstNameLower = (m.firstName || "").trim().toLowerCase();
        const surnameLower = (m.surname || "").trim().toLowerCase();
        if (fullNameLower && fullNameLower === norm) return true;
        if (firstNameLower && firstNameLower === norm) return true;
        if (surnameLower && surnameLower === norm) return true;
        if (norm.length >= 3) {
          if (fullNameLower && (fullNameLower.includes(norm) || norm.includes(fullNameLower))) return true;
          const tokens = fullNameLower.split(/\s+/);
          if (tokens.some((t) => t.length >= 3 && (t === norm || t.startsWith(norm) || norm.startsWith(t)))) return true;
        }
        return false;
      };

      // 1. Fast instant local memory match (< 1ms)
      let matched: Member | undefined = membersList.find(matchFn);

      if (!matched) {
        // 2. Fallback to API / Firestore search
        try {
          const res = await loginMember(credential.trim());
          matched = { ...res.member, role: res.member.role || "member" };
          if (res.customToken) {
            signInWithCustomToken(res.customToken).catch(() => {});
          }
        } catch (apiErr) {
          throw apiErr;
        }
      } else {
        // Background token refresh / session sync (non-blocking)
        loginMember(credential.trim())
          .then((res) => {
            if (res.customToken) signInWithCustomToken(res.customToken).catch(() => {});
          })
          .catch(() => {});
      }

      if (matched) {
        const memberSession: Member = { ...matched, role: matched.role || "member" };
        if (!memberSession.photoUrl) {
          const matchedPhoto = AppStateManager.findMatchingMember(memberSession);
          if (matchedPhoto && matchedPhoto.photoUrl) {
            memberSession.photoUrl = matchedPhoto.photoUrl;
            memberSession.photoStatus = matchedPhoto.photoStatus || "approved";
          }
        }
        AppStateManager.setCurrentUser(memberSession);
        onLoginSuccess(memberSession);
      } else {
        throw new Error("Credentials not recognized. Access denied.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Credentials not recognized. Access denied."
      );
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-y-auto bg-slate-950">
      {" "}
      {/* Background Login Wall Wallpaper — gradient shows instantly, heavy
          image fades in once decoded so first paint is never blocked. */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-teal-900 to-slate-950" />
      <div
        className={`absolute inset-0 bg-cover bg-center bg-no-referrer filter brightness-95 contrast-110 scale-105 transition-opacity duration-700 ${
          wallLoaded ? "opacity-100" : "opacity-0"
        }`}
        style={wallLoaded ? { backgroundImage: `url(${LOGIN_WALL_BG})` } : undefined}
      />{" "}
      {/* Light Uniform Overlay */}{" "}
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" />{" "}
      {/* Main Login Card */}{" "}
      <div className="login-card-pc-scale relative z-10 w-full max-w-md bg-slate-950/40 p-5 sm:p-6 backdrop-blur-2xl space-y-5">
        {" "}
        {/* Crest Logo & Brand Header */}{" "}
        <div className="text-center space-y-2.5">
          {" "}
          <div className="relative inline-block">
            {" "}
            <img
              src={BRAND_LOGO}
              alt="Team Taraba River Logo"
              className="w-[100px] h-[100px] sm:w-[116px] sm:h-[116px] mx-auto object-contain drop-shadow-xl"
            />{" "}
          </div>{" "}
          <div className="space-y-1">
            {" "}
            <h1 className="text-sm sm:text-sm text-white tracking-tight">
              {" "}
              TEAM TARABA RIVER{" "}
            </h1>{" "}
            <p className="text-xs uppercase tracking-widest text-cyan-400">
              {" "}
              USOSANS RESIDENT IN PORT HARCOURT{" "}
            </p>{" "}
            <p className="text-sm text-emerald-400 tracking-wider"> PRO UNITATE </p>{" "}
          </div>{" "}
        </div>{" "}
        {error && (
          <div className="p-3 bg-red-950/80 border border-red-800/80 text-red-200 text-sm rounded-xl flex items-center space-x-2">
            {" "}
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" /> <span>{error}</span>{" "}
          </div>
        )}{" "}
        {/* Form */}{" "}
        <form onSubmit={handleSubmit} className="space-y-4">
          {" "}
          <div>
            {" "}
            <label className="block text-center text-sm text-slate-300 uppercase tracking-wider mb-1.5">
              {" "}
              Email or Phone Number{" "}
            </label>{" "}
            <input
              type="text"
              required
              placeholder="e.g. 'member@domain.com/08023456789'"
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              className="w-full block bg-slate-950/90 border border-slate-700/80 focus:border-cyan-400 rounded-2xl px-3 sm:px-4 py-3 text-xs sm:text-sm text-white focus:outline-none transition placeholder:text-slate-500 placeholder:text-[11px] sm:placeholder:text-xs text-center"
            />{" "}

          </div>{" "}
          <div className="flex justify-center">
            <button type="submit" disabled={isLoading || !credential.trim()} className="w-3/4 py-2 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-sm rounded-xl transition shadow-md shadow-cyan-600/30 flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer" >
              {" "}
              <LogIn className="w-3.5 h-3.5" />{" "}
              <span>
                {isLoading ? "Verifying..." : "Sign In To Access Community"}
              </span>{" "}
            </button>{" "}
          </div>
        </form>{" "}
        {/* Google OAuth Button */}{" "}
        <div className="pt-4 border-t border-slate-800/80 flex justify-center">
          {" "}
          <button type="button" onClick={handleAdminLogin} disabled={isAdminLoading} className="w-3/4 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 text-sm rounded-xl transition shadow-sm flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50" >
            {" "}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-[15px] h-[15px] shrink-0">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>{" "}
            <span className="font-medium">
              {isAdminLoading ? "Authenticating..." : "Google"}
            </span>{" "}
          </button>{" "}
        </div>{" "}
        {/* Secondary Actions */}{" "}
        <div className="pt-4 border-t border-slate-800 flex flex-col items-center gap-3">
          {" "}
          <div className="text-slate-400 text-sm"> Not registered yet? </div>{" "}
          <button onClick={onOpenRegister} className="w-full sm:w-auto py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition flex items-center justify-center space-x-2" >
            {" "}
            <UserPlus className="w-4 h-4 text-cyan-400" />{" "}
            <span>Register your profile</span>{" "}
          </button>{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
};

