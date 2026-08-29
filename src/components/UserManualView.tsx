import React, { useState } from "react";
import {
  BookOpen,
  User,
  ShieldCheck,
  Search,
  ChevronDown,
  LogIn,
  Home,
  Newspaper,
  Cake,
  Users,
  FolderOpen,
  Upload,
  CheckCircle2,
  ArrowLeft,
  Info,
  Printer,
  Sparkles,
  Layers,
  HelpCircle,
  Lightbulb
} from "lucide-react";

import imgLoginGate from "../assets/manual/01_login_gate.png";
import imgHomeEvents from "../assets/manual/02_home_events.png";
import imgNewsReader from "../assets/manual/03_news_reader.png";
import imgBirthdays from "../assets/manual/04_birthdays.png";
import imgMediaFolders from "../assets/manual/03_media_folders.png";
import imgMediaGallery from "../assets/manual/04_media_gallery.png";
import imgMemberDirectory from "../assets/manual/08_member_directory.png";
import imgAdminDashboard from "../assets/manual/06_admin_dashboard.png";

interface UserManualViewProps {
  onBack: () => void;
  isAdmin?: boolean;
}

type ManualSection = "member" | "admin";

interface Chapter {
  id: string;
  section: ManualSection;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  badgeText: string;
  badgeColor: string;
  screenshotSrc: string;
  screenshotAlt: string;
  content: {
    purpose: string;
    screenTitle: string;
    uiCallouts: Array<{
      number: number;
      title: string;
      description: string;
    }>;
    steps: string[];
    proTips: string[];
    importantNotes: string[];
  };
}

const CHAPTERS: Chapter[] = [
  // ── PART 1: MEMBER SECTION ──
  {
    id: "mem-login",
    section: "member",
    title: "1. How to Log In & Sign In",
    subtitle: "Simple 1-step sign in with your phone number, email, or Google account",
    icon: LogIn,
    badgeText: "Member Guide",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    screenshotSrc: imgLoginGate,
    screenshotAlt: "Mobile Login Gate Screen",
    content: {
      purpose: "Get into the app in 3 seconds without having to remember any complicated passwords.",
      screenTitle: "Login Gate Screen",
      uiCallouts: [
        {
          number: 1,
          title: "Team Taraba River Logo",
          description: "Confirms you are on the official USOSA Port Harcourt portal.",
        },
        {
          number: 2,
          title: "Phone or Email Box",
          description: "Tap here to type your registered phone number (e.g. 08031234567) or your email address.",
        },
        {
          number: 3,
          title: "Green 'Sign In' Button",
          description: "Tap this button after typing your number to enter the app immediately.",
        },
        {
          number: 4,
          title: "Google Button",
          description: "If your email is linked to Google, tap here for 1-tap instant sign in.",
        },
        {
          number: 5,
          title: "Register Your Profile Link",
          description: "First time here? Tap this link to add your name, school, and photo.",
        }
      ],
      steps: [
        "Open the website on your phone browser (Chrome, Safari, etc.).",
        "Tap inside the box labeled 'EMAIL OR PHONE NUMBER'.",
        "Type your phone number (example: 08023456789) or your email.",
        "Tap the green 'Sign In' button. You are in!",
        "If you prefer Google, simply tap the white 'Google' button to log in automatically."
      ],
      proTips: [
        "You do not need a password! Just typing your phone number will log you in.",
        "Your phone saves your login so you won't have to type it again next time."
      ],
      importantNotes: [
        "Make sure to use the same phone number you gave when you joined Team Taraba River.",
        "If you get an error, tap 'Register your profile' at the bottom to register your details."
      ]
    }
  },
  {
    id: "mem-home",
    section: "member",
    title: "2. Exploring Your Home Page & Calendar",
    subtitle: "See upcoming gatherings, member stats, and personalized welcome notes",
    icon: Home,
    badgeText: "Member Guide",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    screenshotSrc: imgHomeEvents,
    screenshotAlt: "Mobile Home Hub & Events Screen",
    content: {
      purpose: "Your main dashboard showing community announcements, upcoming meetings, and member activities.",
      screenTitle: "Home & Events Dashboard",
      uiCallouts: [
        {
          number: 1,
          title: "Your Name & Avatar (Top Right)",
          description: "Shows your photo and greeting (e.g., 'Welcome, back Kefox'). Tap it to open your profile or log out.",
        },
        {
          number: 2,
          title: "Community Welcome Notice",
          description: "Official welcome address and updates from the executive team.",
        },
        {
          number: 3,
          title: "Live Community Counters",
          description: "Shows total Registered Members, Active Events, and Portal Visits in real time.",
        },
        {
          number: 4,
          title: "Bottom Navigation Bar",
          description: "The menu at the bottom of your phone screen that lets you jump between Home, Media, Admin, and Dark Mode.",
        }
      ],
      steps: [
        "When you log in, you will land directly on the Home page.",
        "Look at the top right to see your name and picture.",
        "Scroll down your screen to see upcoming events, meetings, and activities.",
        "Tap on any event to see where it will hold and RSVP your attendance.",
        "Use the buttons at the bottom of your screen to visit other sections of the app."
      ],
      proTips: [
        "Tap the Moon icon at the bottom of your screen anytime to switch to comfortable Dark Mode at night.",
        "Tap your profile picture at the top right anytime to view or edit your personal profile."
      ],
      importantNotes: [
        "The member counters update automatically every time a new member joins or visits."
      ]
    }
  },
  {
    id: "mem-news",
    section: "member",
    title: "3. USOSA News, AI Xplora & Contact Search",
    subtitle: "Browse latest unity school stories, ask AI anything live on the web, or find members by profession, phone, and email",
    icon: Newspaper,
    badgeText: "Member Guide",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    screenshotSrc: imgNewsReader,
    screenshotAlt: "Mobile USOSA News Update Screen",
    content: {
      purpose: "Read national alumni news stories, access live web AI intelligence, and quickly find member contact details by occupation (e.g. medical doctors for urgent health emergencies).",
      screenTitle: "News, AI Xplora & Contact Hub",
      uiCallouts: [
        {
          number: 1,
          title: "Headlines Tab",
          description: "Shows the latest 15 headlines and stories from Federal Unity Schools across Nigeria.",
        },
        {
          number: 2,
          title: "AI Xplora Tab",
          description: "Live web-connected AI assistant capable of answering questions on science, tech, research, and unity schools.",
        },
        {
          number: 3,
          title: "Contact Search Tab (New)",
          description: "Dedicated AI search scoped exclusively to querying the full registered member database by occupation, skills, phone, and email.",
        },
        {
          number: 4,
          title: "'Expand' Button",
          description: "Tap here to open up the full list of news articles with story summaries and photos.",
        }
      ],
      steps: [
        "On the Home page, scroll down to the 'USOSA News & AI Knowledge Hub' card.",
        "Tap 'Headlines' to read curated national stories, or tap 'Expand' to view complete summaries.",
        "Tap 'AI Xplora' to chat with live web AI and explore topics on any subject.",
        "Tap 'Contact Search' to find doctors, lawyers, engineers, or specific phone numbers (e.g. search 'medical doctor' or 'clinical management' for health emergencies).",
        "Tap the phone or WhatsApp icons on any result to call or message the member immediately."
      ],
      proTips: [
        "In Contact Search, you can tap quick filter chips like '🏥 Medical Doctors & Health' for instant 1-tap discovery.",
        "Your AI Xplora chat history is securely saved on your device for 3 months so you can resume conversations anytime."
      ],
      importantNotes: [
        "Contact Search queries only verified registered chapter members to protect privacy while enabling rapid emergency response."
      ]
    }
  },
  {
    id: "mem-birthdays",
    section: "member",
    title: "4. Celebrating Member Birthdays & Confetti",
    subtitle: "Find out who is celebrating this month and shower them with festive confetti",
    icon: Cake,
    badgeText: "Member Guide",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    screenshotSrc: imgBirthdays,
    screenshotAlt: "Mobile Member Birthdays Screen",
    content: {
      purpose: "Never miss a chapter brother or sister's birthday and celebrate them together.",
      screenTitle: "Monthly Birthday Celebrations",
      uiCallouts: [
        {
          number: 1,
          title: "Member Birthdays Banner",
          description: "Highlights all chapter members having their birthdays in the current month.",
        },
        {
          number: 2,
          title: "Celebrant Name & Date Card",
          description: "Shows the celebrant's picture/initials, full name, and birth day (e.g. August 13).",
        },
        {
          number: 3,
          title: "Tap to Celebrate Action",
          description: "Tapping any celebrant's card launches colourful party confetti across your screen!",
        }
      ],
      steps: [
        "Scroll down on the Home page to the 'Member Birthdays' card.",
        "Look through the list of members celebrating this month.",
        "Tap on any celebrant's name or picture to trigger a burst of celebration confetti on your screen.",
        "Tap their phone number or WhatsApp icon to send them a warm personal birthday message."
      ],
      proTips: [
        "Make sure your birthday is set in your profile so you can receive birthday love when your day arrives!",
        "Your birth year is completely hidden for privacy; only your day and month are shown."
      ],
      importantNotes: [
        "Only members with verified birthday records will appear in the monthly roll."
      ]
    }
  },
  {
    id: "mem-directory",
    section: "member",
    title: "5. Searching the Members Directory",
    subtitle: "Easily search alumni by name, federal unity school, set year, or profession",
    icon: Users,
    badgeText: "Member Guide",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    screenshotSrc: imgMemberDirectory,
    screenshotAlt: "Mobile Member Directory Screen",
    content: {
      purpose: "Connect with classmates, find business partners, and reach fellow alumni across Port Harcourt.",
      screenTitle: "Members Directory Search",
      uiCallouts: [
        {
          number: 1,
          title: "Smart Search Input Box",
          description: "Type any name, school name (e.g. 'Owerri', 'Enugu', 'Lagos'), graduation year (e.g. '2007'), or profession.",
        },
        {
          number: 2,
          title: "Total Count Indicator",
          description: "Shows how many members match your search in real time (e.g., 'Showing 29 of 29 member entries').",
        },
        {
          number: 3,
          title: "Member Information Card",
          description: "Displays the member's photo/initials, full name, Federal Unity School, and occupation.",
        },
        {
          number: 4,
          title: "Green 'Export to Excel' Button",
          description: "Allows chapter leaders to download a clean Excel CSV list of members for records.",
        }
      ],
      steps: [
        "Open the Members Directory from the menu.",
        "Tap on the search box with the magnifying glass.",
        "Type any keyword (example: your school name like 'FGGC Owerri' or someone's surname).",
        "The list instantly filters to show matching members.",
        "Tap on any member's card to view their full details or contact them directly."
      ],
      proTips: [
        "Try typing a year like '2005' or '2010' to find alumni who graduated in the same set as you.",
        "All 115 Federal Unity Colleges across Nigeria are supported."
      ],
      importantNotes: [
        "Private home addresses are protected and only accessible to authorized executive admins."
      ]
    }
  },
  {
    id: "mem-media-hub",
    section: "member",
    title: "6. Viewing Event Albums & Media Folders",
    subtitle: "Browse photos and videos from past chapter gatherings, health walks, and hangouts",
    icon: FolderOpen,
    badgeText: "Member Guide",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    screenshotSrc: imgMediaFolders,
    screenshotAlt: "Mobile Event Media Hub Folders Screen",
    content: {
      purpose: "Relive cherished memories, view high-definition event photos, and watch recorded video clips.",
      screenTitle: "Event Media Folders",
      uiCallouts: [
        {
          number: 1,
          title: "Search Folders Box",
          description: "Type an event name (e.g., 'Aerobics' or 'Hangout') to quickly locate a specific photo album.",
        },
        {
          number: 2,
          title: "Grid / List Toggle Buttons",
          description: "Tap the 4-box icon for big photo previews, or tap the list-lines icon for a compact list view.",
        },
        {
          number: 3,
          title: "Event Album Cover Card",
          description: "Shows 4 preview photos, the event title, date, and the total count of photos/videos inside.",
        },
        {
          number: 4,
          title: "Bottom Navigation 'Media' Icon",
          description: "Tap the folder icon in the bottom menu at any time to open the Media Hub.",
        }
      ],
      steps: [
        "Tap the 'Media' folder icon in the bottom navigation bar on your phone.",
        "Scroll through the event albums (e.g., 'URIP Health Aerobics', 'Testing event').",
        "Tap directly on any album card to open up all the photos and videos inside.",
        "Tap the back arrow '<' at the top left anytime to return to the album list."
      ],
      proTips: [
        "If your internet connection is slow, tap the List icon (the lines) to load albums faster.",
        "Each album tells you exactly how many photos and videos are stored inside."
      ],
      importantNotes: [
        "All photos are automatically optimized for your phone so they load smoothly without wasting data."
      ]
    }
  },
  {
    id: "mem-media-gallery",
    section: "member",
    title: "7. Gallery Lightbox, Multi-Upload & Deletion",
    subtitle: "View photos in full screen, select multiple files to delete, or upload new event media",
    icon: Upload,
    badgeText: "Member Guide",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    screenshotSrc: imgMediaGallery,
    screenshotAlt: "Mobile Event Media Gallery & Upload Controls",
    content: {
      purpose: "Manage event photos and videos with live upload progress bars and 1-tap batch selection.",
      screenTitle: "Event Gallery & Multi-Upload",
      uiCallouts: [
        {
          number: 1,
          title: "Green 'Select Multiple' Button",
          description: "Tap here to turn on checkmarks so you can select and delete multiple photos at once.",
        },
        {
          number: 2,
          title: "Teal 'Update / Add Media' Button",
          description: "Tap here to pick photos and videos from your phone gallery and upload them to this album.",
        },
        {
          number: 3,
          title: "Red 'Delete Folder' Button",
          description: "Allows deleting the entire album and its photos (with a safety confirmation prompt).",
        },
        {
          number: 4,
          title: "Photo & Video Thumbnails",
          description: "Tap any photo to view it full screen, or tap a video with the play icon to watch it.",
        }
      ],
      steps: [
        "To view a photo or video: Tap on any picture to open it in full screen lightbox.",
        "To upload new media: Tap the teal 'Update / Add Media' button. Select photos or videos from your phone. Watch the progress bar showing exactly how many Megabytes (MB) have uploaded.",
        "To delete multiple photos: Tap 'Select Multiple'. Tap the checkmarks on the photos you want to remove, then tap 'Delete Selected'.",
        "Tap the '<' back button at the top left when you want to return to the main folder list."
      ],
      proTips: [
        "You can pick 10 or 20 photos at once from your phone gallery; the upload screen will upload them all smoothly.",
        "Future dates are restricted on uploads to ensure accurate timestamps."
      ],
      importantNotes: [
        "Deleted photos are permanently removed from cloud storage to protect member privacy."
      ]
    }
  },

  // ── PART 2: ADMIN SECTION ──
  {
    id: "adm-portal",
    section: "admin",
    title: "8. Administrator Portal & Chapter Governance",
    subtitle: "Executive dashboard, member records, photo approval queue, and cloud storage management",
    icon: ShieldCheck,
    badgeText: "Admin Only",
    badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800",
    screenshotSrc: imgAdminDashboard,
    screenshotAlt: "Mobile Admin Portal Dashboard Screen",
    content: {
      purpose: "Dedicated control panel for chapter executives to manage members, approve photos, and oversee system data.",
      screenTitle: "Admin Portal & Governance",
      uiCallouts: [
        {
          number: 1,
          title: "Admin Navigation Switcher",
          description: "Quick buttons to switch between Members Directory, Events, Top Engagement, Media Moderation, and Cloud Media.",
        },
        {
          number: 2,
          title: "AI-Powered Member Search",
          description: "Instant search across all fields with fuzzy matching.",
        },
        {
          number: 3,
          title: "Green 'Export to Excel (.csv)' Button",
          description: "Download the complete membership roster directly into an Excel spreadsheet file.",
        },
        {
          number: 4,
          title: "Top Action Toolbar",
          description: "Back button '<', refresh data circle, and system health status.",
        }
      ],
      steps: [
        "Sign in using an authorized Google Admin account (e.g. kefox.nwoko@gmail.com or tarabateam@gmail.com).",
        "Tap the 'Admin' badge icon in the bottom navigation bar.",
        "Tap 'Members Directory' to edit member profiles, assign roles, or seed member rosters.",
        "Tap 'Media Moderation' to review and approve newly uploaded member profile pictures with 1 tap.",
        "Tap 'Cloud Media Integration' to manage YouTube uploads and cloud backups."
      ],
      proTips: [
        "Always use 'Export to Excel' before chapter general meetings to produce accurate physical attendance rolls.",
        "The photo moderation queue helps maintain a professional, dignified appearance across the portal."
      ],
      importantNotes: [
        "Only emails configured in the chapter's authorized admin list have access to this section."
      ]
    }
  }
];

export const UserManualView: React.FC<UserManualViewProps> = ({ onBack, isAdmin = false }) => {
  const [activeSection, setActiveSection] = useState<ManualSection>("member");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedChapterId, setExpandedChapterId] = useState<string>("mem-login");

  const filteredChapters = CHAPTERS.filter((ch) => {
    const matchesSection = ch.section === activeSection;
    if (!matchesSection) return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    const matchesTitle = ch.title.toLowerCase().includes(q) || ch.subtitle.toLowerCase().includes(q);
    const matchesSteps = ch.content.steps.some((s) => s.toLowerCase().includes(q));
    const matchesCallouts = ch.content.uiCallouts.some(
      (c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );
    return matchesTitle || matchesSteps || matchesCallouts;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-6 font-sans pb-28 md:pb-12 text-slate-900 dark:text-slate-100 animate-fadeIn">
      {/* ── INDEPENDENT HERO HEADER ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-slate-900 to-slate-950 text-white p-4 sm:p-6 md:p-7 shadow-xl border border-teal-500/30 mb-5">
        {/* Ambient background glow */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top bar: Back button + Badges + Actions */}
        <div className="flex items-center justify-between gap-2.5 relative z-10 mb-4 pb-3 border-b border-white/10 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onBack}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-md border border-white/15"
              title="Return to previous view"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-teal-400/20 text-teal-300 border border-teal-400/30 backdrop-blur-md">
              📖 Official Help Center
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-300 bg-white/5 border border-white/10">
              v2.4 Mobile Edition
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer backdrop-blur-md border border-white/15 shadow-sm"
              title="Print or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>
            <button
              onClick={onBack}
              className="px-3.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-black transition-all shadow-md shadow-teal-500/30 cursor-pointer active:scale-95 whitespace-nowrap"
            >
              Return to App
            </button>
          </div>
        </div>

        {/* Main Title & Subtitle */}
        <div className="relative z-10 flex items-start gap-3.5 sm:gap-4">
          <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 flex items-center justify-center shrink-0 shadow-lg shadow-teal-500/25 mt-0.5">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
              User Manual & Operations Guide
            </h1>
            <p className="text-xs sm:text-sm text-teal-100/85 mt-1 leading-relaxed max-w-2xl font-normal">
              Official step-by-step visual handbook and operating manual for Team Taraba River members and chapter executives.
            </p>
          </div>
        </div>
      </div>

      {/* ── RESPONSIVE TWO-PART SEGMENTED SWITCHER ── */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 bg-slate-200/80 dark:bg-slate-900/90 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 mb-4 shadow-inner">
        <button
          onClick={() => setActiveSection("member")}
          className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeSection === "member"
              ? "bg-white dark:bg-slate-800 text-teal-800 dark:text-teal-300 shadow-sm border border-slate-200 dark:border-slate-700"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <User className="w-4 h-4 shrink-0" />
          <span className="truncate">Part 1: Members</span>
          <span className="inline-flex px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 shrink-0">
            7
          </span>
        </button>

        <button
          onClick={() => setActiveSection("admin")}
          className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 px-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
            activeSection === "admin"
              ? "bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 shadow-sm border border-slate-200 dark:border-slate-700"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span className="truncate">Part 2: Admins</span>
          <span className="inline-flex px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 shrink-0">
            Admin
          </span>
        </button>
      </div>

      {/* ── SEARCH BAR ── */}
      <div className="relative w-full mb-5">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search topics (e.g. Login, Photos, News)..."
          className="w-full pl-11 pr-10 py-3 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 dark:focus:ring-teal-400 shadow-sm transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── CHAPTERS LIST (ACCORDION) ── */}
      <div className="space-y-4">
        {filteredChapters.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <HelpCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No matching topics found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Try searching for "Login", "Sign In", "Photos", "Birthdays", or "News".
            </p>
          </div>
        ) : (
          filteredChapters.map((ch) => {
            const isExpanded = expandedChapterId === ch.id;
            const Icon = ch.icon;

            return (
              <div
                key={ch.id}
                id={ch.id}
                className={`rounded-3xl border transition-all duration-300 overflow-hidden ${
                  isExpanded
                    ? "bg-white dark:bg-slate-900 border-teal-500/50 dark:border-teal-500/40 shadow-xl ring-1 ring-teal-500/20"
                    : "bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
                }`}
              >
                {/* Chapter Banner Button */}
                <button
                  onClick={() => setExpandedChapterId(isExpanded ? "" : ch.id)}
                  className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 gap-3"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                        ch.section === "admin"
                          ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                          : "bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${ch.badgeColor}`}
                        >
                          {ch.badgeText}
                        </span>
                      </div>
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
                        {ch.title}
                      </h2>
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                        {ch.subtitle}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 transition-transform duration-300 ${
                      isExpanded ? "rotate-180 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300" : ""
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {/* Chapter Expanded Body */}
                {isExpanded && (
                  <div className="px-4 pb-6 pt-2 sm:px-6 sm:pb-8 border-t border-slate-100 dark:border-slate-800 animate-fadeIn">
                    {/* Plain English Objective Banner */}
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/50 text-xs sm:text-sm text-teal-950 dark:text-teal-200 mb-6 flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        <span className="font-bold">What this is for: </span>
                        <span>{ch.content.purpose}</span>
                      </p>
                    </div>

                    {/* Responsive Grid: Smartphone Canvas + Callouts / Steps */}
                    <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 items-start">
                      {/* Left: Responsive Real Mobile Phone Mockup */}
                      <div className="w-full lg:w-[320px] shrink-0 flex flex-col items-center">
                        <div className="w-full max-w-[270px] sm:max-w-[300px] bg-slate-950 p-2.5 sm:p-3 rounded-[38px] sm:rounded-[44px] shadow-2xl border-4 border-slate-800 ring-1 ring-slate-700/60 relative">
                          {/* Top Speaker / Dynamic Island */}
                          <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-20 sm:w-24 h-4 sm:h-4.5 bg-slate-900 rounded-full z-20 flex items-center justify-center gap-1.5 shadow-inner">
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                            <div className="w-8 h-1 rounded-full bg-slate-800" />
                          </div>

                          {/* Mobile Screenshot Screen */}
                          <div className="rounded-[28px] sm:rounded-[34px] overflow-hidden bg-slate-900 border border-slate-800/80 pt-4 relative">
                            <img
                              src={ch.screenshotSrc}
                              alt={ch.screenshotAlt}
                              className="w-full h-auto object-cover rounded-b-[26px] select-none pointer-events-none"
                              loading="lazy"
                            />
                            {/* Glass screen label */}
                            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-slate-950/90 backdrop-blur-md px-3 py-1 rounded-full border border-teal-500/40 text-[9px] sm:text-[10px] text-teal-300 font-bold tracking-wider whitespace-nowrap shadow-lg">
                              📱 {ch.content.screenTitle}
                            </div>
                          </div>

                          {/* Home Bar Indicator */}
                          <div className="w-20 sm:w-24 h-1 bg-slate-700 rounded-full mx-auto mt-2" />
                        </div>
                        <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-2 text-center font-medium">
                          Actual Phone Screen
                        </p>
                      </div>

                      {/* Right: Callouts Breakdown, Simple Steps, Pro Tips */}
                      <div className="w-full flex-1 space-y-6">
                        {/* 1. Key Interface Elements */}
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                            <span>What You See on Your Screen</span>
                          </h3>
                          <div className="space-y-2.5">
                            {ch.content.uiCallouts.map((callout) => (
                              <div
                                key={callout.number}
                                className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-start gap-3 hover:border-teal-500/40 transition-colors"
                              >
                                <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-teal-700 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                                  {callout.number}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                                    {callout.title}
                                  </h4>
                                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                                    {callout.description}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 2. Step-by-Step Instructions */}
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>Simple Step-by-Step Actions</span>
                          </h3>
                          <div className="space-y-2">
                            {ch.content.steps.map((step, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60"
                              >
                                <span className="w-5 h-5 rounded-md bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-black text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                                  {idx + 1}
                                </span>
                                <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                                  {step}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 3. Pro Tips & Important Notes */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                          {ch.content.proTips.length > 0 && (
                            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40">
                              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5 mb-2">
                                <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                <span>Helpful Tip</span>
                              </h4>
                              <ul className="space-y-1.5 text-xs text-amber-950 dark:text-amber-200">
                                {ch.content.proTips.map((tip, idx) => (
                                  <li key={idx} className="leading-relaxed flex items-start gap-1.5">
                                    <span className="text-amber-600 font-bold">•</span>
                                    <span>{tip}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {ch.content.importantNotes.length > 0 && (
                            <div className="p-3.5 sm:p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40">
                              <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5 mb-2">
                                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                <span>Please Remember</span>
                              </h4>
                              <ul className="space-y-1.5 text-xs text-blue-950 dark:text-blue-200">
                                {ch.content.importantNotes.map((note, idx) => (
                                  <li key={idx} className="leading-relaxed flex items-start gap-1.5">
                                    <span className="text-blue-600 font-bold">•</span>
                                    <span>{note}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── FOOTER ACTIONS ── */}
      <div className="mt-8 p-6 rounded-3xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-base sm:text-lg font-bold">Still need help or have a question?</h3>
          <p className="text-xs text-slate-400">
            Reach out to chapter executives anytime or use the AI Assistant for instant guidance.
          </p>
        </div>
        <button
          onClick={onBack}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-teal-700/30 transition-all cursor-pointer shrink-0"
        >
          Return to Community Portal
        </button>
      </div>
    </div>
  );
};
