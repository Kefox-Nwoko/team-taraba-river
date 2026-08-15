import React, { useState } from "react";
import { Member } from "../types";
import { triggerGoogleAdminSignIn } from "../services/firebaseService";
import { ShieldAlert, ChevronLeft, ShieldCheck, KeyRound } from "lucide-react";
interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (member: Member) => void;
  onOpenRegister?: () => void;
  availableMembers?: Member[];
  originatingPageName?: string;
}
export const SignInModal: React.FC<SignInModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  originatingPageName = "Community Portal",
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!isOpen) return null;
  const handleGoogleSignInClick = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const adminMember = await triggerGoogleAdminSignIn();
      onSuccess(adminMember);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google Auth sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fadeIn pb-12">
      {" "}
      {/* Top Header & Navigation */}{" "}
      <div className="py-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 transition-colors">
        {" "}
        <div className="flex items-center space-x-3">
          {" "}
          <button onClick={onClose} className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full transition shadow-sm flex items-center justify-center cursor-pointer" >
            {" "}
            <ChevronLeft className="w-5 h-5" />{" "}
          </button>{" "}
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />{" "}
          <div>
            {" "}
            <h1 className="text-sm sm:text-sm text-slate-900 dark:text-white tracking-tight">
              {" "}
              Admin Google Authentication{" "}
            </h1>{" "}
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {" "}
              Google Account Direct OAuth Sign-In{" "}
            </p>{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
      {/* Main Container */}{" "}
      <div className="py-6 sm:py-8 transition-colors space-y-6">
        {" "}
        {/* Header Icon & Intro */}{" "}
        <div className="flex items-center space-x-3 p-4 bg-amber-500/10 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-800/80 rounded-2xl">
          {" "}
          <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl shrink-0">
            {" "}
            <ShieldCheck className="w-6 h-6" />{" "}
          </div>{" "}
          <div>
            {" "}
            <h2 className="text-sm text-slate-900 dark:text-white">
              {" "}
              Google OAuth Authentication{" "}
            </h2>{" "}
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {" "}
              Sign in directly with your Google account. A popup window will prompt you to select
              your account.{" "}
            </p>{" "}
          </div>{" "}
        </div>{" "}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm rounded-2xl flex items-center space-x-3 animate-shake">
            {" "}
            <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />{" "}
            <span>{error}</span>{" "}
          </div>
        )}{" "}
        {/* Single Direct Google Auth Button */}{" "}
        <div className="pt-2">
          {" "}
          <button type="button" onClick={handleGoogleSignInClick} disabled={isLoading} className="w-full py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 text-sm rounded-2xl transition shadow-md shadow-amber-500/20 flex items-center justify-center space-x-3 disabled:opacity-50" >
            {" "}
            <KeyRound className="w-5 h-5" />{" "}
            <span>
              {isLoading ? "Connecting to Google OAuth..." : "Sign In directly with Google Account"}
            </span>{" "}
          </button>{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
};
