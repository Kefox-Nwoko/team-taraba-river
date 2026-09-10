import React, { useState, useEffect } from "react";
import { Member } from "../types";
import { requestLoginCode, verifyLoginCode, verifySession } from "../services/apiClient";
import {
  signInWithCustomToken,
  triggerGoogleAdminSignIn,
  checkGoogleRedirectResult,
  FirebaseSyncManager,
} from "../services/firebaseService";
import { AppStateManager } from "../services/storage";
import { isMemberCredentialMatch } from "../lib/authMatching";
import { INITIAL_MEMBERS } from "../data/seedData";
import { LogIn, UserPlus, ArrowRight, AlertCircle, CheckCircle2, ShieldCheck, BookOpen, X } from "lucide-react";
import { BRAND_LOGO, LOGIN_WALL_BG } from "../constants/assets";
import { logger } from "../lib/logger";

interface LoginGateProps {
  onLoginSuccess: (member: Member) => void;
  onOpenRegister: () => void;
  availableMembers: Member[];
  onExploreGuest?: () => void;
  onOpenManual?: () => void;
}

export const LoginGate: React.FC<LoginGateProps> = ({
  onLoginSuccess,
  onOpenRegister,
  availableMembers,
  onExploreGuest,
  onOpenManual,
}) => {
  const [credential, setCredential] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Two-step credential login: "credential" (email/phone entry) -> "code"
  // (enter the one-time code emailed to the account's registered address).
  const [stage, setStage] = useState<"credential" | "code">("credential");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [codeInput, setCodeInput] = useState("");

  // Load the heavy login wallpaper after first paint so it never blocks the
  // initial render on slow connections — a cheap gradient shows instantly.
  const [wallLoaded, setWallLoaded] = useState(false);
  useEffect(() => {
    const img = new Image();
    img.src = LOGIN_WALL_BG;
    img.onload = () => setWallLoaded(true);
  }, []);

  const processGoogleUser = async (googleMember: Member) => {
    const userEmail = (googleMember.email || "").toLowerCase().trim();
    if (!userEmail) {
      throw new Error("No email address was returned by Google authentication.");
    }

    // Admin status must come from the server (ADMIN_EMAILS in server/config.ts
    // is the single source of truth) — never decide it locally. Defaults to
    // false (member) if the server can't be reached, so a verification
    // failure never silently grants admin.
    const serverMember = await verifySession();
    const isAdmin = serverMember?.role === "admin";
    let memberSession: Member | undefined;

    if (isAdmin) {
      const cached = AppStateManager.getMembers();
      const pool = availableMembers.length > 0 ? availableMembers : (cached.length > 0 ? cached : INITIAL_MEMBERS);
      const match = pool.find((m) => m.email?.toLowerCase().trim() === userEmail);
      memberSession = {
        ...(match || googleMember),
        role: "admin",
        isGoogleAuth: true,
        photoUrl: googleMember.photoUrl || match?.photoUrl || "",
        photoStatus: "approved",
      };
    } else {
      const cached = AppStateManager.getMembers();
      const pool = availableMembers.length > 0 ? availableMembers : (cached.length > 0 ? cached : INITIAL_MEMBERS);
      let match = pool.find((m) => isMemberCredentialMatch(m, userEmail));

      if (!match) {
        try {
          const live = await FirebaseSyncManager.seedCSVDataIfNeeded();
          match = live.find((m) => isMemberCredentialMatch(m, userEmail));
        } catch {}
      }

      if (match) {
        memberSession = {
          ...match,
          isGoogleAuth: true,
          photoUrl: match.photoUrl || googleMember.photoUrl || "",
        };
      }
    }

    if (memberSession) {
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
      throw new Error(
        `Google account (${userEmail}) is not recognized. Please sign in with your registered email or phone number, or register your profile below.`
      );
    }
  };

  // Check if returning from a mobile redirect authentication flow
  useEffect(() => {
    let active = true;
    checkGoogleRedirectResult()
      .then(async (googleUser) => {
        if (!active || !googleUser) return;
        setIsAdminLoading(true);
        try {
          await processGoogleUser(googleUser);
        } catch (err) {
          if (active) {
            setError(err instanceof Error ? err.message : "Google authentication failed.");
          }
        } finally {
          if (active) setIsAdminLoading(false);
        }
      })
      .catch((err) => {
        logger.warn("Redirect check notification:", err);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleAdminLogin = async () => {
    setIsAdminLoading(true);
    setError(null);
    try {
      const googleUser = await triggerGoogleAdminSignIn();
      await processGoogleUser(googleUser);
    } catch (err: any) {
      if (err?.isCancellation || err?.message?.includes("closed before completing")) {
        setError("Google sign-in was closed before completing. Click Google to try again or enter your email or phone number above.");
      } else {
        setError(
          err instanceof Error ? err.message : "Authentication failed. Please try again."
        );
      }
    } finally {
      setIsAdminLoading(false);
    }
  };
  // Completes a session once we have a server-verified member + optional
  // custom token — shared by the local-dev one-step fallback and the
  // code-verification step.
  const completeLogin = (member: Member, customToken?: string | null) => {
    if (customToken) signInWithCustomToken(customToken).catch(() => {});
    const memberSession: Member = { ...member, role: member.role || "member" };
    if (!memberSession.photoUrl) {
      const matchedPhoto = AppStateManager.findMatchingMember(memberSession);
      if (matchedPhoto && matchedPhoto.photoUrl) {
        memberSession.photoUrl = matchedPhoto.photoUrl;
        memberSession.photoStatus = matchedPhoto.photoStatus || "approved";
      }
    }
    AppStateManager.setCurrentUser(memberSession);
    onLoginSuccess(memberSession);
  };

  // Step 1: resolve the credential server-side. A match never logs the
  // member in directly here — either they're routed to Google (Gmail
  // accounts), or a one-time code is emailed to their registered address
  // and we move to the code-entry stage. Deciding this locally from a
  // cached member list would let anyone skip the code entirely.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credential.trim()) return;
    setError(null);
    setIsLoading(true);

    try {
      const rawCred = credential.trim();
      const result = await requestLoginCode(rawCred);

      if (result.requiresGoogle) {
        setError("This account uses Gmail. Please sign in with the Google button below.");
        return;
      }

      // Local-dev fallback only: no email service is available offline, so
      // the server completes the login in one step here instead.
      if (result.member) {
        completeLogin(result.member, result.customToken);
        return;
      }

      if (result.codeSent) {
        setMaskedEmail(result.maskedEmail || "your registered email");
        setCodeInput("");
        setStage("code");
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

  // Step 2: verify the emailed code and complete the session.
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (codeInput.trim().length !== 6) return;
    setError(null);
    setIsLoading(true);
    try {
      const res = await verifyLoginCode(credential.trim(), codeInput.trim());
      completeLogin(res.member, res.customToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await requestLoginCode(credential.trim());
      if (result.codeSent) {
        setMaskedEmail(result.maskedEmail || "your registered email");
        setCodeInput("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToCredential = () => {
    setStage("credential");
    setCodeInput("");
    setError(null);
  };
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 py-12 bg-slate-950 overflow-x-hidden">
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
          <div className="p-3 bg-red-950/80 border border-red-800/80 text-red-200 text-xs sm:text-sm rounded-xl flex items-start justify-between gap-2 animate-fadeIn">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-200 p-0.5 rounded cursor-pointer transition shrink-0"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {stage === "credential" ? (
          <>
            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-center text-sm text-slate-300 uppercase tracking-wider mb-1.5">
                  Email or Phone Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 'member@domain.com/08023456789'"
                  value={credential}
                  onChange={(e) => {
                    setCredential(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full block bg-slate-950/90 border border-slate-700/80 focus:border-cyan-400 rounded-2xl px-3 sm:px-4 py-3 text-xs sm:text-sm text-white focus:outline-none transition placeholder:text-slate-500 placeholder:text-[11px] sm:placeholder:text-xs text-center"
                />
              </div>{" "}
              <div className="flex justify-center">
                <button type="submit" disabled={isLoading || !credential.trim()} className="w-3/4 py-2 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-sm rounded-xl transition shadow-md shadow-cyan-600/30 flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer" >
                  {" "}
                  <LogIn className="w-3.5 h-3.5" />{" "}
                  <span>
                    {isLoading ? "Sending code..." : "Sign In"}
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
              <button onClick={onOpenRegister} className="w-full sm:w-auto py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition flex items-center justify-center space-x-2 cursor-pointer" >
                {" "}
                <UserPlus className="w-4 h-4 text-cyan-400" />{" "}
                <span>Register your profile</span>{" "}
              </button>{" "}
              {onOpenManual && (
                <button
                  type="button"
                  onClick={onOpenManual}
                  className="mt-1 text-xs text-teal-400 hover:text-teal-300 transition flex items-center space-x-1.5 cursor-pointer underline underline-offset-4 py-1"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>📖 Open User Guide & Documentation</span>
                </button>
              )}
            </div>{" "}
          </>
        ) : (
          /* Code entry stage — enter the one-time code emailed to the account's registered address */
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="text-center space-y-1">
              <ShieldCheck className="w-6 h-6 text-cyan-400 mx-auto mb-1" />
              <p className="text-sm text-slate-300">
                We sent a 6-digit code to <span className="text-cyan-400 font-medium">{maskedEmail}</span>
              </p>
            </div>
            <div>
              <label className="block text-center text-sm text-slate-300 uppercase tracking-wider mb-1.5">
                Enter Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                placeholder="000000"
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6));
                  if (error) setError(null);
                }}
                className="w-full block bg-slate-950/90 border border-slate-700/80 focus:border-cyan-400 rounded-2xl px-3 sm:px-4 py-3 text-lg tracking-[0.5em] text-white focus:outline-none transition placeholder:text-slate-600 text-center"
              />
            </div>
            <div className="flex justify-center">
              <button type="submit" disabled={isLoading || codeInput.length !== 6} className="w-3/4 py-2 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-sm rounded-xl transition shadow-md shadow-cyan-600/30 flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer" >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isLoading ? "Verifying..." : "Verify & Sign In"}</span>
              </button>
            </div>
            <div className="pt-2 flex flex-col items-center gap-2 text-xs">
              <button type="button" onClick={handleResendCode} disabled={isLoading} className="text-cyan-400 hover:text-cyan-300 underline underline-offset-4 cursor-pointer disabled:opacity-50">
                Resend code
              </button>
              <button type="button" onClick={handleBackToCredential} className="text-slate-400 hover:text-slate-300 cursor-pointer">
                Use a different email or phone number
              </button>
            </div>
          </form>
        )}
      </div>{" "}
    </div>
  );
};

