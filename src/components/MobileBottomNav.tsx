import React from "react";
import {
  Home,
  FolderOpen,
  Upload,
  ShieldCheck,
  Sun,
  Moon,
  UserCheck,
  User,
} from "lucide-react";
import { Member } from "../types";
import { useTheme } from "../context/ThemeContext";

interface MobileBottomNavProps {
  activeTab: "media" | "events" | "admin" | "upload";
  setActiveTab: (tab: "media" | "events" | "admin" | "upload") => void;
  currentUser: Member | null;
  pendingApprovalsCount?: number;
  onOpenSignIn: () => void;
  onEditProfile: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  pendingApprovalsCount = 0,
  onOpenSignIn,
  onEditProfile,
}) => {
  const { theme, toggleTheme } = useTheme();
  const isAdmin = currentUser?.role === "admin";

  return (
    <nav className="xl:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 shadow-2xl transition-colors font-normal">
      <div className="flex items-center justify-around px-2 py-2.5 max-w-lg mx-auto">
        {/* 1. Home Button (Hidden when on Home page) */}
        {activeTab !== "events" && (
          <button onClick={() => setActiveTab("events")}
            className="flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl text-slate-600 dark:text-slate-300 hover:text-teal-700 transition-all cursor-pointer"
          >
            <Home className="w-6 h-6" />
            <span className="text-xs mt-1 font-normal">Home</span>
          </button>
        )}

        {/* 2. Media Button (Hidden when on Media page) */}
        {activeTab !== "media" && (
          <button onClick={() => setActiveTab("media")}
            className="flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl text-slate-600 dark:text-slate-300 hover:text-teal-700 transition-all cursor-pointer"
          >
            <FolderOpen className="w-6 h-6" />
            <span className="text-xs mt-1 font-normal">Media</span>
          </button>
        )}

        {/* 3. Upload Button (Shown on Media page) */}
        {activeTab === "media" && (
          <button onClick={() => setActiveTab("upload")}
            className="flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl text-teal-700 dark:text-teal-400 font-normal transition-all cursor-pointer"
          >
            <Upload className="w-6 h-6" />
            <span className="text-xs mt-1 font-normal">Upload</span>
          </button>
        )}

        {/* 4. Admin Button (Hidden when on Admin page) */}
        {activeTab !== "admin" && (
          <button onClick={() => {
              if (isAdmin) {
                setActiveTab("admin");
              } else {
                onOpenSignIn();
              }
            }}
            className="relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl text-slate-600 dark:text-slate-300 hover:text-teal-700 transition-all cursor-pointer"
          >
            <ShieldCheck className="w-6 h-6" />
            <span className="text-xs mt-1 font-normal">Admin</span>
            {isAdmin && pendingApprovalsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-teal-700 text-white text-[10px] rounded-full flex items-center justify-center font-normal">
                {pendingApprovalsCount}
              </span>
            )}
          </button>
        )}

        {/* 5. Theme Toggle Button */}
        <button onClick={toggleTheme} title={theme === "dark" ? "Light Mode" : "Dark Mode"} className="flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl text-slate-600 dark:text-slate-300 hover:text-teal-700 transition-all cursor-pointer" >
          {theme === "dark" ? (
            <Sun className="w-6 h-6 text-amber-400" />
          ) : (
            <Moon className="w-6 h-6 text-slate-700" />
          )}
          <span className="text-xs mt-1 font-normal">{theme === "dark" ? "Light" : "Dark"}</span>
        </button>

        {/* 6. Profile / Sign In Button */}
        {currentUser ? (
          currentUser.role !== "admin" && (
            <button onClick={onEditProfile} className="flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl text-slate-600 dark:text-slate-300 hover:text-teal-700 transition-all cursor-pointer" >
              <UserCheck className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              <span className="text-xs mt-1 font-normal">Profile</span>
            </button>
          )
        ) : (
          <button onClick={onOpenSignIn} className="flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl text-slate-600 dark:text-slate-300 hover:text-teal-700 transition-all cursor-pointer" >
            <User className="w-6 h-6" />
            <span className="text-xs mt-1 font-normal">Sign In</span>
          </button>
        )}
      </div>
    </nav>
  );
};
