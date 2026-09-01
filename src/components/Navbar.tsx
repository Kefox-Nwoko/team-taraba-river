import React, { useState, useEffect, useRef } from "react";
import { Member } from "../types";
import { useTheme } from "../context/ThemeContext";
import { MemberAvatar } from "./MemberAvatar";
import { BRAND_LOGO } from "../constants/assets";
import { stripTitlePrefixes } from "../utils/nameUtils";
import {
  Sun,
  Moon,
  ShieldCheck,
  ChevronDown,
  LogOut,
  FolderOpen,
  Home,
  UserCheck,
  Upload,
  BookOpen,
  Smartphone,
  Download,
} from "lucide-react";

interface NavbarProps {
  currentUser: Member | null;
  activeTab: "media" | "events" | "admin" | "upload" | "profile" | "manual";
  setActiveTab: (tab: "media" | "events" | "admin" | "upload" | "profile" | "manual") => void;
  onOpenSignIn: () => void;
  onOpenRegister: () => void;
  onSignOut: () => void;
  onToggleAiAssistant?: () => void;
  isAiAssistantOpen?: boolean;
  pendingApprovalsCount?: number;
  onCreateEvent?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  onOpenSignIn,
  onOpenRegister,
  onSignOut,
  onToggleAiAssistant,
  isAiAssistantOpen,
  pendingApprovalsCount = 0,
  onCreateEvent,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileUserMenuOpen, setIsMobileUserMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const desktopMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (isMobileUserMenuOpen && mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileUserMenuOpen(false);
      }
      if (isDropdownOpen && desktopMenuRef.current && !desktopMenuRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isMobileUserMenuOpen, isDropdownOpen]);

  const isAdmin = currentUser?.role === "admin";

  const getFirstName = (user?: Member | null): string => {
    if (!user) return "Member";
    if (user.role === "admin") return "Admin";
    const cleanName = stripTitlePrefixes(user.firstName || user.fullName || "");
    const parts = cleanName.split(/\s+/).filter(Boolean);
    const first = parts[0] || "Member";
    if (first.toLowerCase() === "local") return "Admin";
    return first;
  };

  const firstName = getFirstName(currentUser);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl text-slate-900 dark:text-slate-100 transition-colors border-b border-slate-200/80 dark:border-slate-800 shadow-md font-normal">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-[80px] sm:h-[92px]">
          {/* Brand Logo & Title + Desktop Nav Tabs */}
          <div className="flex items-center space-x-6 sm:space-x-8">
            <div
              className="flex items-center space-x-3.5 cursor-pointer shrink-0"
              onClick={() => setActiveTab("events")}
            >
              <img
                src={BRAND_LOGO}
                alt="Team Taraba River Logo"
                className="w-9 h-9 sm:w-11 sm:h-11 object-contain transition-transform hover:scale-105"
              />
              <div>
                <span className="text-base sm:text-lg font-normal tracking-tight text-slate-900 dark:text-white block leading-tight whitespace-nowrap">
                  Team Taraba River
                </span>
              </div>
            </div>

            {/* Desktop Navigation Buttons - HIDE ACTIVE PAGE BUTTON TO SAVE SPACE */}
            <div className="hidden xl:flex items-center space-x-6 pl-8 border-l border-slate-200 dark:border-slate-800 font-normal">
              {activeTab !== "events" && (
                <button onClick={() => setActiveTab("events")}
                  className="flex items-center space-x-2 text-sm  font-normal transition text-slate-600 hover:text-teal-700 dark:text-slate-300 dark:hover:text-teal-400 cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  <span>Home</span>
                </button>
              )}

              {activeTab !== "media" && (
                <button onClick={() => setActiveTab("media")}
                  className="flex items-center space-x-2 text-sm  font-normal transition text-slate-600 hover:text-teal-700 dark:text-slate-300 dark:hover:text-teal-400 cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Media</span>
                </button>
              )}

              {activeTab === "media" && (
                <button onClick={() => setActiveTab("upload")}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-normal transition shadow-sm active:scale-95 bg-teal-700 hover:bg-teal-800 text-white cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Media</span>
                </button>
              )}

              {activeTab !== "admin" && (
                <button onClick={() => {
                    if (isAdmin) {
                      setActiveTab("admin");
                    } else {
                      onOpenSignIn();
                    }
                  }}
                  className="flex items-center space-x-2 text-sm  font-normal transition text-slate-600 hover:text-teal-700 dark:text-slate-300 dark:hover:text-teal-400 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Admin</span>
                  {isAdmin && pendingApprovalsCount > 0 && (
                    <span className="bg-teal-700 text-white text-sm px-2.5 py-0.5 rounded-full ml-1 font-normal">
                      {pendingApprovalsCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* Install App Quick Button (Visible if not in standalone mode) */}
            {!isStandalone && onOpenInstallModal && (
              <button
                onClick={onOpenInstallModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/80 hover:bg-teal-100 dark:hover:bg-teal-900/80 transition cursor-pointer shrink-0 shadow-2xs active:scale-95"
                title="Install App on this device"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Install App</span>
              </button>
            )}

            {/* Theme Toggle (Desktop Only) */}
            <button id="nav-theme-toggle" onClick={toggleTheme} title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"} className="hidden xl:flex p-3.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-400 transition shrink-0 cursor-pointer" >
              {theme === "dark" ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-slate-700" />
              )}
            </button>

            {/* Mobile Mode Top Right User ID / Avatar Badge + Animated Sign Out Dropdown */}
            <div className="md:hidden flex items-center shrink-0">
              {currentUser ? (
                <div className="relative" ref={mobileMenuRef}>
                  <button onClick={() => setIsMobileUserMenuOpen(!isMobileUserMenuOpen)}
                    className="flex items-center space-x-2 text-slate-900 dark:text-white cursor-pointer transition hover:opacity-80"
                  >
                    <MemberAvatar member={currentUser} sizeClassName="w-6 h-6" textClassName="text-xs font-normal" />
                    <span className="text-sm font-normal max-w-[100px] truncate">{firstName}</span>
                    <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isMobileUserMenuOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isMobileUserMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 translate-y-[50px] w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl z-50 p-3 space-y-1.5 animate-fadeIn border border-slate-200/80 dark:border-slate-700 font-normal">
                      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                        <p className="text-lg font-normal text-slate-900 dark:text-white truncate">{firstName}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-normal">
                          {isAdmin ? "Admin" : "Team Member"}
                        </p>
                      </div>

                      {!isAdmin && (
                        <button onClick={() => {
                            setIsMobileUserMenuOpen(false);
                            setActiveTab("profile");
                          }}
                          className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-normal text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center space-x-2.5 cursor-pointer"
                        >
                          <UserCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                          <span>My Profile</span>
                        </button>
                      )}

                      <button onClick={() => {
                          setIsMobileUserMenuOpen(false);
                          setActiveTab("manual");
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-normal text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center space-x-2.5 cursor-pointer"
                      >
                        <BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                        <span>User Guide / Manual</span>
                      </button>

                      {!isStandalone && onOpenInstallModal && (
                        <button onClick={() => {
                            setIsMobileUserMenuOpen(false);
                            onOpenInstallModal();
                          }}
                          className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-normal text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center space-x-2.5 cursor-pointer"
                        >
                          <Smartphone className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                          <span>Install App</span>
                        </button>
                      )}

                      <button onClick={() => {
                          setIsMobileUserMenuOpen(false);
                          onSignOut();
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-xl text-xs font-normal text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition flex items-center space-x-2.5 cursor-pointer"
                      >
                        <LogOut className="w-5 h-5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={onOpenSignIn} className="px-3 py-1.5 rounded-full text-xs font-normal bg-teal-700 text-white cursor-pointer" >
                  Sign In
                </button>
              )}
            </div>

            {/* Auth Dropdown (Desktop) */}
            {currentUser ? (
              <div className="relative hidden md:block shrink-0 font-normal" ref={desktopMenuRef}>
                <button onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center space-x-4 transition hover:opacity-80 cursor-pointer shrink-0"
                >
                  <MemberAvatar
                    member={currentUser}
                    sizeClassName="w-8 h-8"
                    textClassName="text-sm font-normal"
                  />
                  <div className="flex flex-col items-start text-left max-w-[150px]">
                    <span className="text-sm sm:text-base font-normal text-slate-900 dark:text-white leading-tight truncate w-full">
                      {firstName}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 leading-tight font-normal truncate w-full">
                      {isAdmin ? "Admin" : "Team Member"}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                      isDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 top-full mt-3 translate-y-[50px] w-72 sm:w-80 bg-white dark:bg-slate-800 rounded-3xl shadow-xl z-50 p-4 space-y-2 animate-fadeIn border border-slate-200/80 dark:border-slate-700 font-normal">
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 space-y-1">
                      <p className="text-sm sm:text-base font-normal text-slate-900 dark:text-white truncate">
                        {currentUser?.fullName || firstName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-normal">
                        {currentUser?.email ? `✉ ${currentUser.email}` : (currentUser?.phoneNumber ? `📱 ${currentUser.phoneNumber}` : (isAdmin ? "Administrator Portal" : "Team Member"))}
                      </p>
                    </div>

                    {!isAdmin && (
                      <button onClick={() => {
                          setActiveTab("profile");
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-2xl text-xs  font-normal text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center space-x-3 cursor-pointer"
                      >
                        <UserCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                        <span>My Profile</span>
                      </button>
                    )}

                    <button onClick={() => {
                        setActiveTab("manual");
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-2xl text-xs font-normal text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center space-x-3 cursor-pointer"
                    >
                      <BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                      <span>User Guide / Manual</span>
                    </button>

                    {!isStandalone && onOpenInstallModal && (
                      <button onClick={() => {
                          setIsDropdownOpen(false);
                          onOpenInstallModal();
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-2xl text-xs font-normal text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center space-x-3 cursor-pointer"
                      >
                        <Smartphone className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                        <span>Install App</span>
                      </button>
                    )}

                    <button onClick={() => {
                        onSignOut();
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-2xl text-xs  font-normal text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition flex items-center space-x-3 cursor-pointer"
                    >
                      <LogOut className="w-5 h-5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden md:flex items-center space-x-3">
                <button onClick={onOpenSignIn} className="px-3 py-1.5 rounded-full text-xs font-normal bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer" >
                  Sign In
                </button>
                <button onClick={onOpenRegister} className="px-3 py-1.5 rounded-full text-xs font-normal bg-teal-700 hover:bg-teal-800 text-white transition shadow-sm cursor-pointer" >
                  Register
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
