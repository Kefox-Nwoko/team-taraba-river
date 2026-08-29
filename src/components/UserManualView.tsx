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
  HelpCircle
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
    title: "1. Login & Member Verification",
    subtitle: "Authenticate using your registered Email, Phone Number, or Google Account",
    icon: LogIn,
    badgeText: "Member",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    screenshotSrc: imgLoginGate,
    screenshotAlt: "Mobile Login Gate Interface",
    content: {
      purpose: "Enable instant verification for all Team Taraba River members without password friction.",
      screenTitle: "Login Gate (Mobile View)",
      uiCallouts: [
        {
          number: 1,
          title: "Brand Logo & Welcome Header",
          description: "Confirms official connection to URIP Team Taraba River - USOSA Port Harcourt portal.",
        },
        {
          number: 2,
          title: "Single Credential Input Box",
          description: "Type either your registered Email or Nigerian Phone Number (e.g., 08023456789 or +234...).",
        },
        {
          number: 3,
          title: "Instant Sign-In Action",
          description: "Instantly queries offline and cloud rosters for matching records.",
        },
        {
          number: 4,
          title: "Google One-Tap Authentication",
          description: "Use your linked Google account (e.g. kefox.nwoko@gmail.com) for 1-tap secure sign-in.",
        },
        {
          number: 5,
          title: "Profile Registration Link",
          description: "New members can register their profile if not yet in the official roster.",
        }
      ],
      steps: [
        "Open https://team-taraba-river.web.app/ on your mobile browser.",
        "Enter your registered Email Address or Phone Number in the input box.",
        "Tap the teal 'Sign In' button to authenticate.",
        "Alternatively, tap 'Google' to sign in with your verified Google account.",
        "If you are a new member, tap 'Register your profile' to fill in your personal details."
      ],
      proTips: [
        "You can type your phone number with or without the Nigerian country code (+234 or 080...).",
        "Your session is securely cached on your device, so you won't need to re-login every time."
      ],
      importantNotes: [
        "Ensure the phone number you enter matches the record submitted during chapter onboarding.",
        "If your record is not found, tap 'Register your profile' to submit your details."
      ]
    }
  },
  {
    id: "mem-home",
    section: "member",
    title: "2. Home Hub & Event Calendar",
    subtitle: "Personalized welcome, executive message, and community gatherings",
    icon: Home,
    badgeText: "Member",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    screenshotSrc: imgHomeEvents,
    screenshotAlt: "Mobile Home Hub & Community Impact",
    content: {
      purpose: "Serve as the central home dashboard greeting members, displaying community metrics, and upcoming events.",
      screenTitle: "Home Hub & Events (Mobile View)",
      uiCallouts: [
        {
          number: 1,
          title: "Personalized Greeting & Avatar",
          description: "Displays your first name (e.g., 'Welcome, back Kefox') and your profile avatar with quick dropdown access.",
        },
        {
          number: 2,
          title: "Executive Welcome Message",
          description: "Official address encouraging active participation and brotherhood across USOSA Port Harcourt.",
        },
        {
          number: 3,
          title: "Community Impact Real-Time Metrics",
          description: "Live counters tracking total Registered Members, Active Events, and Portal Visits.",
        },
        {
          number: 4,
          title: "Mobile Bottom Navigation Bar",
          description: "Instant switching between Home, Media Hub, Admin (for authorized personnel), and Dark Mode toggle.",
        }
      ],
      steps: [
        "Upon successful login, you will arrive directly at the Home Hub.",
        "Review community announcements and live participation stats.",
        "Scroll down to explore upcoming chapter events and RSVP your attendance.",
        "Use the bottom navigation bar to switch between app features effortlessly."
      ],
      proTips: [
        "Tap your avatar in the top-right corner to access 'My Profile' or 'Sign Out' at any time.",
        "Tap the Moon/Sun icon in the bottom bar to switch between Dark Mode and Light Mode."
      ],
      importantNotes: [
        "Community Impact metrics update in real-time as members engage across the portal."
      ]
    }
  },
  {
    id: "mem-news",
    section: "member",
    title: "3. USOSA News Updates & Audio Reader",
    subtitle: "Stay updated with federal unity school news and voice-assisted article playback",
    icon: Newspaper,
    badgeText: "Member",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    screenshotSrc: imgNewsReader,
    screenshotAlt: "Mobile USOSA News Update Card",
    content: {
      purpose: "Deliver curated national USOSA news stories, national secretariat updates, and interactive audio narration.",
      screenTitle: "USOSA News & Headlines (Mobile View)",
      uiCallouts: [
        {
          number: 1,
          title: "USOSA News Update Card",
          description: "Live feed aggregating the latest 15 stories from national unity alumni events and communiques.",
        },
        {
          number: 2,
          title: "Expand / Collapse Toggle",
          description: "Tap to expand full headline cards with thumbnail images, dates, and summary snippets.",
        },
        {
          number: 3,
          title: "Headlines / AI Xplora Switcher",
          description: "Switch between reading articles and asking AI Xplora about news context.",
        },
        {
          number: 4,
          title: "Back-to-Top Floating Button",
          description: "Quickly return to the top of the feed with one tap.",
        }
      ],
      steps: [
        "Scroll down on the Home Hub to the 'USOSA News Update' card.",
        "Tap 'Expand' to reveal all recent articles and headlines.",
        "Tap any article title or thumbnail to open the full story reading modal.",
        "Tap the 'Play / Listen' audio button inside the article to have the story read aloud in natural speech.",
        "Tap the external link icon to read the source article on the original news publisher website."
      ],
      proTips: [
        "The built-in Audio Reader is ideal for listening to updates on the go.",
        "Tap the refresh icon to pull the latest news feeds."
      ],
      importantNotes: [
        "Audio playback works in background mode on mobile browsers that support speech synthesis."
      ]
    }
  },
  {
    id: "mem-birthdays",
    section: "member",
    title: "4. Birthday Celebrations & Monthly Roll",
    subtitle: "Celebrate chapter brothers and sisters with animated greetings and confetti",
    icon: Cake,
    badgeText: "Member",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    screenshotSrc: imgBirthdays,
    screenshotAlt: "Mobile Birthday Celebrants Hub",
    content: {
      purpose: "Foster community spirit by highlighting monthly celebrants with festive confetti celebrations.",
      screenTitle: "Member Birthdays (Mobile View)",
      uiCallouts: [
        {
          number: 1,
          title: "Member Birthdays Card",
          description: "Automatic monthly roll listing all chapter members celebrating in the active month.",
        },
        {
          number: 2,
          title: "Celebrant Avatars & Names",
          description: "Displays member initials/photo, full formal name, and birth date.",
        },
        {
          number: 3,
          title: "Interactive Celebration Trigger",
          description: "Tapping any celebrant card triggers festive screen confetti and celebration greetings.",
        }
      ],
      steps: [
        "Scroll to the 'Member Birthdays' section on the Home page.",
        "View the list of celebrants for the current month.",
        "Tap any celebrant's card to celebrate them with on-screen confetti.",
        "Copy their contact or message them directly to send personal birthday wishes."
      ],
      proTips: [
        "Make sure your date of birth is up to date in 'My Profile' so the chapter can celebrate you on your special day.",
        "Birth year is kept strictly private; only your birth day and month are displayed."
      ],
      importantNotes: [
        "Only members with verified date of birth records appear in the monthly birthday roll."
      ]
    }
  },
  {
    id: "mem-directory",
    section: "member",
    title: "5. Member Directory & Multi-Field Search",
    subtitle: "Search verified alumni by name, unity school, class year, profession, or location",
    icon: Users,
    badgeText: "Member",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    screenshotSrc: imgMemberDirectory,
    screenshotAlt: "Mobile Member Directory Search & Filters",
    content: {
      purpose: "Connect members with fellow USOSA alumni across 115 Federal Unity Colleges resident in Port Harcourt.",
      screenTitle: "Members Directory (Mobile View)",
      uiCallouts: [
        {
          number: 1,
          title: "Multi-Field Smart Search",
          description: "Instant filtering by First Name, Surname, Federal College, Graduation Year, or Occupation.",
        },
        {
          number: 2,
          title: "Member Count Status",
          description: "Shows real-time matching count (e.g., 'Showing 29 of 29 member entries').",
        },
        {
          number: 3,
          title: "Member Card Detail Deck",
          description: "Displays verified avatar, full name, Federal Unity School badge, and contact links.",
        },
        {
          number: 4,
          title: "Export to Excel (.csv) Action",
          description: "Allows exporting the directory roster for chapter administration and offline records.",
        }
      ],
      steps: [
        "Navigate to the Members Directory via Admin or top menu.",
        "Type any keyword into the search bar (e.g. 'Owerri', 'Doctor', 'Ikpeama').",
        "Tap on any member card to view their verified details, Federal Unity School, and graduation year.",
        "Tap phone or WhatsApp action icons to reach out directly."
      ],
      proTips: [
        "You can filter by graduation year (e.g. '2007') to find classmates from your set.",
        "All 115 Federal Unity Colleges across Nigeria are supported."
      ],
      importantNotes: [
        "Sensitive address details are protected and only accessible to authorized administrators."
      ]
    }
  },
  {
    id: "mem-media-hub",
    section: "member",
    title: "6. Event Media Hub & Album Browsing",
    subtitle: "Browse chapter events, photos, videos, and switch between Grid and List layouts",
    icon: FolderOpen,
    badgeText: "Member",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    screenshotSrc: imgMediaFolders,
    screenshotAlt: "Mobile Event Media Hub Folders",
    content: {
      purpose: "Organize chapter memories and event galleries into categorized albums with cloud storage.",
      screenTitle: "Media Hub & Folders (Mobile View)",
      uiCallouts: [
        {
          number: 1,
          title: "Event Folder Search",
          description: "Quickly locate specific events by name, location, or date.",
        },
        {
          number: 2,
          title: "Grid / List View Switcher",
          description: "Toggle between 4-quadrant photo preview grids and compact list rows.",
        },
        {
          number: 3,
          title: "Event Album Cards",
          description: "Shows event title, date, location, asset counter (e.g., '5 items'), and photo mosaic preview.",
        }
      ],
      steps: [
        "Tap 'Media' in the bottom navigation bar.",
        "Browse the available event folders (e.g., 'Testing event', 'URIP Health Aerobics').",
        "Use the search box to find specific events by title or month.",
        "Tap on any folder card to open the complete Event Media Gallery."
      ],
      proTips: [
        "Use the List View toggle when browsing on slower mobile connections for faster scrolling.",
        "Folders indicate the exact number of media items stored."
      ],
      importantNotes: [
        "All media items are optimized with responsive sizing for fast mobile loading."
      ]
    }
  },
  {
    id: "mem-media-gallery",
    section: "member",
    title: "7. Media Gallery, Multi-Upload & Batch Deletion",
    subtitle: "View full-resolution photos, stream video clips, batch-select, and upload new media",
    icon: Upload,
    badgeText: "Member",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    screenshotSrc: imgMediaGallery,
    screenshotAlt: "Mobile Event Media Gallery & Controls",
    content: {
      purpose: "Provide a comprehensive media gallery with live MB progress indicators, multi-select, and batch actions.",
      screenTitle: "Event Media Gallery (Mobile View)",
      uiCallouts: [
        {
          number: 1,
          title: "Select Multiple Action Button",
          description: "Activates selection mode to choose multiple photos/videos for batch deletion or download.",
        },
        {
          number: 2,
          title: "Update / Add Media Button",
          description: "Opens the Full-Page Multi-File Upload modal to add new photos and YouTube video links.",
        },
        {
          number: 3,
          title: "Delete Folder Action",
          description: "Permits folder deletion and cloud storage cleanup (with confirmation protection).",
        },
        {
          number: 4,
          title: "Media Asset Grid",
          description: "Interactive thumbnails with video play overlays, full-screen lightbox viewer, and captions.",
        }
      ],
      steps: [
        "Inside any event album, tap on any thumbnail to open the full-screen photo/video lightbox.",
        "To upload new media: Tap 'Update / Add Media'. Select photos or videos from your phone. Watch the live MB Transferred reading as files upload.",
        "To delete multiple items: Tap 'Select Multiple'. Tap individual items (or 'Select All'), then tap 'Delete Selected' to purge.",
        "Tap 'Return' to navigate back to the Media Hub."
      ],
      proTips: [
        "You can upload multiple high-res photos at once; the progress bar tracks individual and total MB transferred.",
        "Future dates are restricted to prevent incorrect event timestamps."
      ],
      importantNotes: [
        "Deleted media is permanently removed from Cloud Storage and YouTube records."
      ]
    }
  },

  // ── PART 2: ADMIN SECTION ──
  {
    id: "adm-portal",
    section: "admin",
    title: "8. Administrator Portal & Governance",
    subtitle: "Executive dashboard, member record management, moderation queue, and cloud sync",
    icon: ShieldCheck,
    badgeText: "Admin Only",
    badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800",
    screenshotSrc: imgAdminDashboard,
    screenshotAlt: "Mobile Admin Portal Dashboard",
    content: {
      purpose: "Centralized administration console for chapter executives to manage members, moderate photos, and monitor cloud health.",
      screenTitle: "Admin Portal (Mobile View)",
      uiCallouts: [
        {
          number: 1,
          title: "Admin Navigation Hub",
          description: "Quick switcher between Members Directory, Events Management, Top Engagement, Media Moderation, and Cloud Media Integration.",
        },
        {
          number: 2,
          title: "AI-Enhanced Member Search",
          description: "Search across all member fields with real-time fuzzy matching.",
        },
        {
          number: 3,
          title: "Export to Excel (.csv)",
          description: "Download the complete chapter membership dataset into Excel-compatible CSV format.",
        },
        {
          number: 4,
          title: "Quick Action Toolbar",
          description: "Back navigation, data refresh, and system health status.",
        }
      ],
      steps: [
        "Sign in using an authorized Google Admin account (e.g., kefox.nwoko@gmail.com or tarabateam@gmail.com).",
        "Tap 'Admin' in the bottom navigation bar to open the Admin Portal.",
        "Select 'Members Directory' to edit member profiles, assign admin roles, or seed 115 CSV records.",
        "Select 'Media Moderation' to approve or reject pending member profile photos with 1-tap review.",
        "Select 'Cloud Media Integration' to manage YouTube channel direct uploads and Google Drive backups."
      ],
      proTips: [
        "Use 'Export to Excel' before general meetings to generate attendance rosters.",
        "Photo approval queue ensures all member avatars meet community standards."
      ],
      importantNotes: [
        "Only emails listed in the system's ADMIN_EMAILS configuration have access to the Admin Portal."
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
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 font-sans animate-fadeIn">
      {/* ── TOP HEADER / BREADCRUMB ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all shadow-sm flex items-center justify-center cursor-pointer group"
            title="Return to previous view"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800/60">
                Official Help Center
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                • Version 2.4 (Mobile Edition)
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1 flex items-center gap-2">
              <BookOpen className="w-7 h-7 text-teal-700 dark:text-teal-400 shrink-0" />
              User Manual & Operations Guide
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-xs font-semibold shadow-sm transition-all cursor-pointer"
            title="Print or Save as PDF"
          >
            <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span>Print / PDF</span>
          </button>
          <button
            onClick={onBack}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-md shadow-teal-700/20 transition-all cursor-pointer"
          >
            <span>Return to App</span>
          </button>
        </div>
      </div>

      {/* ── SECTION SELECTOR TABS & SEARCH BAR ── */}
      <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Two-Part Switcher */}
        <div className="inline-flex p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-inner">
          <button
            onClick={() => setActiveSection("member")}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeSection === "member"
                ? "bg-white dark:bg-slate-800 text-teal-800 dark:text-teal-300 shadow-md border border-slate-200/80 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <User className="w-4 h-4" />
            <span>Part 1: Member Operations Guide</span>
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              7 Chapters
            </span>
          </button>

          <button
            onClick={() => setActiveSection("admin")}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeSection === "admin"
                ? "bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 shadow-md border border-slate-200/80 dark:border-slate-700"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Part 2: Administrator Portal Manual</span>
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              Executive
            </span>
          </button>
        </div>

        {/* Live Search Filter */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search manual topics & features..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700 dark:focus:ring-teal-400 transition-all shadow-sm"
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

      {/* ── CHAPTERS ACCORDION / LIST ── */}
      <div className="mt-8 space-y-6">
        {filteredChapters.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            <HelpCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No matching topics found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Try searching for terms like "Login", "Media", "News", "Birthdays", or "Admin".
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
                    ? "bg-white dark:bg-slate-900/95 border-teal-500/40 dark:border-teal-500/30 shadow-xl shadow-slate-900/5 ring-1 ring-teal-500/20"
                    : "bg-white/80 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
                }`}
              >
                {/* Chapter Header Banner */}
                <button
                  onClick={() => setExpandedChapterId(isExpanded ? "" : ch.id)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left cursor-pointer transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                >
                  <div className="flex items-center space-x-4 min-w-0">
                    <div
                      className={`p-3 rounded-2xl shrink-0 ${
                        ch.section === "admin"
                          ? "bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60"
                          : "bg-teal-100 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-800/60"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide border ${ch.badgeColor}`}
                        >
                          {ch.badgeText}
                        </span>
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                          {ch.title}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {ch.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0 ml-4">
                    <span className="hidden sm:inline-block text-[11px] font-semibold text-teal-700 dark:text-teal-400">
                      {isExpanded ? "Hide Details" : "View Chapter & Phone Guide"}
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
                  <div className="px-6 pb-8 pt-2 border-t border-slate-100 dark:border-slate-800/80 animate-fadeIn">
                    {/* Purpose Statement */}
                    <div className="p-4 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-900/40 text-xs sm:text-sm text-teal-950 dark:text-teal-200 mb-8 flex items-start space-x-3">
                      <Sparkles className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Feature Objective: </span>
                        <span>{ch.content.purpose}</span>
                      </div>
                    </div>

                    {/* 2-Column Responsive Layout: Real Mobile Phone Frame vs Callout Specs */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                      {/* Left Column: Real Mobile Phone Screen Canvas */}
                      <div className="lg:col-span-5 flex flex-col items-center">
                        <div className="w-full max-w-[340px] bg-slate-950 p-3 rounded-[40px] shadow-2xl border-4 border-slate-800 ring-1 ring-slate-700/60 relative">
                          {/* Speaker Notch */}
                          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-900 rounded-full z-20 flex items-center justify-center">
                            <div className="w-3 h-3 rounded-full bg-slate-800 mr-2" />
                            <div className="w-8 h-1 rounded-full bg-slate-800" />
                          </div>

                          {/* Screenshot Container */}
                          <div className="rounded-[32px] overflow-hidden bg-slate-900 border border-slate-800 pt-3 relative">
                            <img
                              src={ch.screenshotSrc}
                              alt={ch.screenshotAlt}
                              className="w-full h-auto object-cover rounded-b-[30px] select-none pointer-events-none"
                              loading="lazy"
                            />
                            {/* Glass overlay badge */}
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-slate-950/80 backdrop-blur-md px-3 py-1 rounded-full border border-teal-500/40 text-[10px] text-teal-300 font-bold tracking-wider whitespace-nowrap">
                              📱 {ch.content.screenTitle}
                            </div>
                          </div>

                          {/* Home Bar Indicator */}
                          <div className="w-24 h-1 bg-slate-700 rounded-full mx-auto mt-2" />
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 text-center font-medium">
                          Captured live on mobile browser canvas
                        </p>
                      </div>

                      {/* Right Column: Detailed Numbered Feature Callouts & Step-by-Step */}
                      <div className="lg:col-span-7 space-y-6">
                        {/* Numbered Callout Breakdown */}
                        <div>
                          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                            Key Interface Elements & Badges
                          </h3>
                          <div className="space-y-3">
                            {ch.content.uiCallouts.map((callout) => (
                              <div
                                key={callout.number}
                                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-start space-x-3 hover:border-teal-500/40 transition-colors"
                              >
                                <span className="w-6 h-6 rounded-full bg-teal-700 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-sm">
                                  {callout.number}
                                </span>
                                <div>
                                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
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

                        {/* Step-by-Step How To Use */}
                        <div>
                          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            Step-by-Step Instructions
                          </h3>
                          <ol className="space-y-2.5">
                            {ch.content.steps.map((step, idx) => (
                              <li
                                key={idx}
                                className="flex items-start space-x-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300"
                              >
                                <span className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                                  {idx + 1}
                                </span>
                                <span className="leading-relaxed">{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>

                        {/* Pro Tips & Notes */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                          {ch.content.proTips.length > 0 && (
                            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40">
                              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5 mb-2">
                                <span>💡</span> Pro Tip
                              </h4>
                              <ul className="space-y-1.5 text-xs text-amber-950 dark:text-amber-200">
                                {ch.content.proTips.map((tip, idx) => (
                                  <li key={idx} className="leading-relaxed">• {tip}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {ch.content.importantNotes.length > 0 && (
                            <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40">
                              <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5 mb-2">
                                <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Important Note
                              </h4>
                              <ul className="space-y-1.5 text-xs text-blue-950 dark:text-blue-200">
                                {ch.content.importantNotes.map((note, idx) => (
                                  <li key={idx} className="leading-relaxed">• {note}</li>
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
      <div className="mt-12 p-8 rounded-3xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-lg font-bold">Have additional questions or feedback?</h3>
          <p className="text-xs text-slate-400">
            Reach out to chapter executives or use the AI Xplora assistant for 24/7 instant guidance.
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-2xl bg-teal-700 hover:bg-teal-600 text-white font-bold text-sm shadow-lg shadow-teal-700/30 transition-all cursor-pointer shrink-0"
        >
          Return to Community Portal
        </button>
      </div>
    </div>
  );
};
