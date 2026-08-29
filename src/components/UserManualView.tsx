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
  Lightbulb,
  AlertTriangle
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
    title: "3. Reading USOSA News & Listening to Audio",
    subtitle: "Stay informed with national unity school news and voice-assisted article playback",
    icon: Newspaper,
    badgeText: "Member Guide",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    screenshotSrc: imgNewsReader,
    screenshotAlt: "Mobile USOSA News Update Screen",
    content: {
      purpose: "Read national alumni news updates and listen to automated voice playback while on the road.",
      screenTitle: "USOSA News & Audio Reader",
      uiCallouts: [
        {
          number: 1,
          title: "USOSA News Card",
          description: "Shows the latest headlines from Federal Unity Schools across Nigeria.",
        },
        {
          number: 2,
          title: "'Expand' Button",
          description: "Tap here to open up the full list of news articles and read the complete stories.",
        },
        {
          number: 3,
          title: "Headlines / AI Assistant Tab",
          description: "Switch between reading recent news and asking AI questions about the articles.",
        },
        {
          number: 4,
          title: "Blue 'Scroll Up' Arrow",
          description: "Tap this floating blue circle anytime to instantly return to the top of the page.",
        }
      ],
      steps: [
        "On the Home page, scroll down until you see the yellow 'USOSA News Update' card.",
        "Tap the 'Expand' button on the right side of the card.",
        "Tap any news headline that interests you to open the full article.",
        "Don't want to read? Tap the 'Listen / Play' audio button to have the app read the news aloud to you.",
        "Tap the 'X' button when you are done reading to close the article."
      ],
      proTips: [
        "The voice audio player is great for listening to community news while driving or multitasking.",
        "Tap the small refresh circle icon to pull down the newest headlines."
      ],
      importantNotes: [
        "Make sure your phone's volume is turned on if you want to use the audio reader feature."
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
    <div className="w-full max-w-5xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-8 font-sans animate-fadeIn">
      {/* ── TOP HEADER / BREADCRUMB ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 sm:pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-start sm:items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all shadow-sm flex items-center justify-center cursor-pointer shrink-0 group mt-0.5 sm:mt-0"
            title="Return to previous view"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800/60">
                Official Help Center
              </span>
              <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                • Step-by-Step Mobile Guide
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1 flex items-center gap-2">
              <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 text-teal-700 dark:text-teal-400 shrink-0" />
              <span>User Manual & Operations Guide</span>
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            onClick={handlePrint}
            className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold shadow-sm transition-all cursor-pointer"
            title="Print or Save as PDF"
          >
            <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span>Print / PDF</span>
          </button>
          <button
            onClick={onBack}
            className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-md shadow-teal-700/20 transition-all cursor-pointer"
          >
            <span>Return to App</span>
          </button>
        </div>
      </div>

      {/* ── SECTION SELECTOR TABS & SEARCH BAR ── */}
      <div className="mt-5 sm:mt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Responsive Two-Part Grid Switcher */}
        <div className="w-full md:w-auto grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-inner">
          <button
            onClick={() => setActiveSection("member")}
            className={`w-full flex items-center justify-center sm:justify-start space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeSection === "member"
                ? "bg-white dark:bg-slate-800 text-teal-800 dark:text-teal-300 shadow-md border border-slate-200/80 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <User className="w-4 h-4 shrink-0" />
            <span>Part 1: Member Guide</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 shrink-0">
              7 Chapters
            </span>
          </button>

          <button
            onClick={() => setActiveSection("admin")}
            className={`w-full flex items-center justify-center sm:justify-start space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeSection === "admin"
                ? "bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 shadow-md border border-slate-200/80 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Part 2: Admin Portal</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
              Executive
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search topics (e.g. Login, Photos, News)..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700 dark:focus:ring-teal-400 transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              CLEAR
            </button>
          )}
        </div>
      </div>

      {/* ── CHAPTERS LIST (ACCORDION) ── */}
      <div className="mt-6 sm:mt-8 space-y-4 sm:space-y-6">
        {filteredChapters.length === 0 ? (
          <div className="p-8 sm:p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
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
                className={`rounded-2xl sm:rounded-3xl border transition-all duration-300 overflow-hidden ${
                  isExpanded
                    ? "bg-white dark:bg-slate-900 border-teal-500/50 dark:border-teal-500/40 shadow-xl ring-1 ring-teal-500/20"
                    : "bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
                }`}
              >
                {/* Chapter Banner Button */}
                <button
                  onClick={() => setExpandedChapterId(isExpanded ? "" : ch.id)}
                  className="w-full px-4 py-4 sm:px-6 sm:py-5 flex items-center justify-between text-left cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 gap-3"
                >
                  <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                    <div
                      className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shrink-0 mt-0.5 sm:mt-0 ${
                        ch.section === "admin"
                          ? "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60"
                          : "bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-800/60"
                      }`}
                    >
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-0.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wide border ${ch.badgeColor}`}
                        >
                          {ch.badgeText}
                        </span>
                        <h2 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                          {ch.title}
                        </h2>
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                        {ch.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="hidden md:inline-block text-xs font-semibold text-teal-700 dark:text-teal-400">
                      {isExpanded ? "Close Guide" : "Open Guide"}
                    </span>
                    <div
                      className={`p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 transition-transform duration-300 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </button>

                {/* Chapter Expanded Body */}
                {isExpanded && (
                  <div className="px-4 pb-6 pt-2 sm:px-6 sm:pb-8 border-t border-slate-100 dark:border-slate-800 animate-fadeIn">
                    {/* Plain English Objective */}
                    <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/50 text-xs sm:text-sm text-teal-950 dark:text-teal-200 mb-6 flex items-start space-x-3">
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">What this is for: </span>
                        <span>{ch.content.purpose}</span>
                      </div>
                    </div>

                    {/* Responsive Grid: Smartphone Canvas + Callouts / Steps */}
                    <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 items-start">
                      {/* Left: Responsive Real Mobile Phone Mockup */}
                      <div className="w-full lg:w-[340px] shrink-0 flex flex-col items-center">
                        <div className="w-full max-w-[280px] sm:max-w-[320px] bg-slate-950 p-2.5 sm:p-3 rounded-[36px] sm:rounded-[44px] shadow-2xl border-4 border-slate-800 ring-1 ring-slate-700/60 relative">
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
                            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-slate-950/85 backdrop-blur-md px-3 py-1 rounded-full border border-teal-500/40 text-[9px] sm:text-[10px] text-teal-300 font-bold tracking-wider whitespace-nowrap shadow-lg">
                              📱 {ch.content.screenTitle}
                            </div>
                          </div>

                          {/* Home Bar Indicator */}
                          <div className="w-20 sm:w-24 h-1 bg-slate-700 rounded-full mx-auto mt-2" />
                        </div>
                        <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-2 text-center font-medium">
                          Real mobile phone view
                        </p>
                      </div>

                      {/* Right: Callouts Breakdown, Simple Steps, Pro Tips */}
                      <div className="w-full flex-1 space-y-5 sm:space-y-6">
                        {/* 1. Key Interface Elements */}
                        <div>
                          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                            <span>What You See on Your Screen</span>
                          </h3>
                          <div className="space-y-2.5 sm:space-y-3">
                            {ch.content.uiCallouts.map((callout) => (
                              <div
                                key={callout.number}
                                className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-start gap-3 hover:border-teal-500/40 transition-colors"
                              >
                                <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-teal-700 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-sm mt-0.5">
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
                          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>Simple Step-by-Step Actions</span>
                          </h3>
                          <div className="space-y-2">
                            {ch.content.steps.map((step, idx) => (
                              <div
                                key={idx}
                                className="flex items-start gap-3 p-2.5 sm:p-3 rounded-xl bg-white dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60"
                              >
                                <span className="w-5 h-5 rounded-md bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 pt-1">
                          {ch.content.proTips.length > 0 && (
                            <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40">
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
                            <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40">
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
      <div className="mt-8 sm:mt-12 p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 shadow-xl">
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
