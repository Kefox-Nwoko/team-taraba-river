import React, { useState } from "react";
import {
  BookOpen,
  User,
  ShieldCheck,
  Search,
  ChevronRight,
  ChevronDown,
  LogIn,
  Home,
  Newspaper,
  Cake,
  Users,
  UserCheck,
  Sparkles,
  FolderOpen,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowLeft,
  Smartphone,
  Info,
  ExternalLink,
  Layers,
  Database,
  CloudUpload,
  Calendar,
  Volume2,
  Printer
} from "lucide-react";
import { BRAND_LOGO } from "../constants/assets";

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
  content: {
    purpose: string;
    phoneMockup: {
      screenTitle: string;
      headerColor: string;
      uiElements: Array<{
        calloutNumber: number;
        label: string;
        description: string;
        visualPreview: React.ReactNode;
      }>;
    };
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
    title: "1. Login & Quick Verification",
    subtitle: "How to authenticate using your registered Email or Nigerian Phone Number",
    icon: LogIn,
    badgeText: "Member",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    content: {
      purpose: "Provide seamless, instant (<1ms) verification for members without needing complex passwords.",
      phoneMockup: {
        screenTitle: "Login Gate Screen",
        headerColor: "from-slate-900 via-teal-950 to-slate-950",
        uiElements: [
          {
            calloutNumber: 1,
            label: "Logo & Brand Header",
            description: "Identifies the official Team Taraba River - USOSA Port Harcourt branch portal.",
            visualPreview: (
              <div className="flex items-center space-x-2 bg-slate-900/90 p-2 rounded-xl border border-teal-500/30">
                <img src={BRAND_LOGO} alt="Brand" className="w-6 h-6 object-contain" />
                <span className="text-[11px] font-bold text-white tracking-wide">TEAM TARABA RIVER</span>
              </div>
            ),
          },
          {
            calloutNumber: 2,
            label: "Credential Input Field",
            description: "Enter your registered Email Address or Phone Number (accepts standard formats like '08023456789' or '+2348023456789').",
            visualPreview: (
              <div className="w-full bg-slate-950 border border-teal-500/40 rounded-xl px-2.5 py-1.5 text-[10px] text-slate-300 text-center font-mono">
                member@domain.com / 08023456789
              </div>
            ),
          },
          {
            calloutNumber: 3,
            label: "Sign In Action Button",
            description: "Tap to verify credentials against offline memory and Firestore real-time roster.",
            visualPreview: (
              <div className="w-3/4 mx-auto py-1 bg-cyan-600 rounded-lg text-white text-[10px] text-center font-semibold shadow-xs">
                Sign In
              </div>
            ),
          },
          {
            calloutNumber: 4,
            label: "Register Profile Link",
            description: "First time here? Tap 'Register your profile' to fill in member details.",
            visualPreview: (
              <div className="text-[9px] text-cyan-400 text-center underline font-medium">
                Not registered yet? Register your profile
              </div>
            ),
          },
        ],
      },
      steps: [
        "Open the application URL (https://team-taraba-river.web.app).",
        "Enter your registered Email or Nigerian Phone Number into the central input box.",
        "Tap 'Sign In'. The application matches your credential instantly against the 115 registered member records.",
        "If you are not yet registered, tap 'Register your profile' and complete the registration form.",
      ],
      proTips: [
        "The system normalizes phone numbers automatically—you can type with or without international country codes (+234).",
        "Once signed in on your mobile browser, your session is securely remembered so you stay logged in.",
      ],
      importantNotes: [
        "If your profile is missing key contact details (like Jersey Size or Next of Kin), the app will prompt you to complete them upon initial login.",
      ],
    },
  },
  {
    id: "mem-home",
    section: "member",
    title: "2. Home Hub & Event Calendar",
    subtitle: "Navigating upcoming events, branch schedules, and member RSVPs",
    icon: Home,
    badgeText: "Member",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    content: {
      purpose: "Keep all branch members informed about upcoming meetings, sports days, and executive announcements.",
      phoneMockup: {
        screenTitle: "Home & Calendar View",
        headerColor: "from-teal-900 to-slate-900",
        uiElements: [
          {
            calloutNumber: 1,
            label: "Hero Welcome Banner",
            description: "Displays executive welcome, member status, and quick stats.",
            visualPreview: (
              <div className="bg-gradient-to-r from-teal-800/80 to-cyan-800/80 p-2 rounded-xl border border-teal-400/30 text-white text-[10px]">
                <div className="font-bold">Welcome, USOSAN! 🌟</div>
                <div className="text-[8px] text-teal-200">Pro Unitate • Port Harcourt Chapter</div>
              </div>
            ),
          },
          {
            calloutNumber: 2,
            label: "Event Cards & RSVP",
            description: "View date, venue, time, and tap 'RSVP / Attend' to register attendance.",
            visualPreview: (
              <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between items-center text-[9px] text-white">
                  <span className="font-bold">Monthly Chapter Meeting</span>
                  <span className="text-teal-400">📅 Sept 14</span>
                </div>
                <div className="text-[8px] text-slate-400">📍 Port Harcourt Club • 4:00 PM</div>
                <div className="w-fit px-2 py-0.5 bg-teal-600 rounded text-[8px] text-white font-medium">Attending (28)</div>
              </div>
            ),
          },
        ],
      },
      steps: [
        "From the top navigation or mobile bottom bar, tap 'Home'.",
        "Scroll through the list of scheduled events.",
        "Tap on any event to see detailed directions, host contact info, and fellow attendees.",
        "Tap 'RSVP' to confirm whether you will be physically attending.",
      ],
      proTips: [
        "Use the Calendar Filter to switch between 'Upcoming Events' and 'Past Event Archives'.",
      ],
      importantNotes: [
        "Past events with uploaded media links have a direct button to jump straight into that event's photo album.",
      ],
    },
  },
  {
    id: "mem-news",
    section: "member",
    title: "3. USOSA News & Built-in Audio Reader",
    subtitle: "Read national updates and listen to articles hands-free with AI Text-to-Speech",
    icon: Newspaper,
    badgeText: "Member",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    content: {
      purpose: "Deliver curated national USOSA news with hands-free audio playback for members on the go.",
      phoneMockup: {
        screenTitle: "USOSA News Feed",
        headerColor: "from-blue-900 to-slate-900",
        uiElements: [
          {
            calloutNumber: 1,
            label: "News Article Card",
            description: "Features high-res imagery, headline, source timestamp, and summary snippet.",
            visualPreview: (
              <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 space-y-1">
                <div className="text-[10px] font-bold text-white leading-tight">USOSA National Plenary 2026 Announcements</div>
                <div className="text-[8px] text-slate-400 line-clamp-2">Delegates from 115 Federal Unity Colleges convene for annual symposium...</div>
              </div>
            ),
          },
          {
            calloutNumber: 2,
            label: "Listen / Read Aloud Button",
            description: "Tap the speaker icon to stream natural voice reading of the news article.",
            visualPreview: (
              <div className="flex items-center space-x-1 px-2 py-0.5 bg-teal-500/20 text-teal-300 rounded border border-teal-500/40 text-[9px] w-fit">
                <Volume2 className="w-3 h-3 text-teal-400" />
                <span>Listen to Article</span>
              </div>
            ),
          },
        ],
      },
      steps: [
        "Navigate to the USOSA News section on the Home feed.",
        "Tap on any headline card to open the complete full-text article modal.",
        "Tap the 'Listen to Article' button to activate the automated voice narrator.",
        "Use playback controls to pause or resume reading at any time.",
      ],
      proTips: [
        "Audio playback continues seamlessly while you browse other sections of the article.",
      ],
      importantNotes: [
        "Articles are curated directly from verified USOSA national releases and verified alumni circulars.",
      ],
    },
  },
  {
    id: "mem-birthdays",
    section: "member",
    title: "4. Birthday Celebrations & Confetti",
    subtitle: "Celebrate branch celebrants each month with animated greeting cards",
    icon: Cake,
    badgeText: "Member",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    content: {
      purpose: "Foster community bond by highlighting members celebrating birthdays in the current active month.",
      phoneMockup: {
        screenTitle: "Birthday Celebrants Carousel",
        headerColor: "from-amber-900 to-slate-900",
        uiElements: [
          {
            calloutNumber: 1,
            label: "Monthly Celebrants Carousel",
            description: "Scrolls horizontally showing all celebrants born in the active calendar month.",
            visualPreview: (
              <div className="flex items-center space-x-2 bg-slate-900 p-2 rounded-xl border border-amber-500/30">
                <div className="w-7 h-7 rounded-full bg-amber-500/30 flex items-center justify-center text-[10px] text-amber-300 font-bold">🎂</div>
                <div>
                  <div className="text-[10px] font-bold text-white">Chima Nnamdi</div>
                  <div className="text-[8px] text-amber-400">Sept 18 • FGC Enugu</div>
                </div>
              </div>
            ),
          },
          {
            calloutNumber: 2,
            label: "Celebration Confetti",
            description: "Tapping any celebrant triggers a celebratory confetti burst and contact card.",
            visualPreview: (
              <div className="text-[9px] text-amber-300 text-center font-medium bg-amber-950/60 p-1 rounded border border-amber-800">
                🎉 Tap to Send Birthday Wishes!
              </div>
            ),
          },
        ],
      },
      steps: [
        "Locate the Birthday Celebration section on the home page.",
        "Browse the horizontal card deck to see all members celebrating this month.",
        "Tap on any celebrant's card to trigger the celebration animation and copy their WhatsApp number to send greetings.",
      ],
      proTips: [
        "Keep your date of birth updated in 'My Profile' so the branch never misses celebrating your special day!",
      ],
      importantNotes: [
        "Only the birth day and month are publicly visible; your birth year remains strictly confidential.",
      ],
    },
  },
  {
    id: "mem-directory",
    section: "member",
    title: "5. Member Directory & Unity Schools Search",
    subtitle: "Search 115 verified members across Federal Unity Colleges by name, occupation, or school",
    icon: Users,
    badgeText: "Member",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    content: {
      purpose: "Enable instant alumni networking across all 115 Federal Unity Colleges across Nigeria.",
      phoneMockup: {
        screenTitle: "Member Directory Search",
        headerColor: "from-teal-900 to-slate-900",
        uiElements: [
          {
            calloutNumber: 1,
            label: "Instant Multi-Filter Bar",
            description: "Filter by full name, profession, residential estate, or graduation year.",
            visualPreview: (
              <div className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[9px] text-slate-300 flex items-center space-x-1">
                <Search className="w-3 h-3 text-slate-500" />
                <span>Search by name, occupation, estate...</span>
              </div>
            ),
          },
          {
            calloutNumber: 2,
            label: "Unity School Selector",
            description: "Dropdown filter containing all 115 official Federal Government Colleges and Unity Schools.",
            visualPreview: (
              <div className="bg-slate-900 border border-teal-500/30 rounded-lg px-2 py-1 text-[9px] text-teal-300">
                🏫 Filter: Federal Government College, Port Harcourt
              </div>
            ),
          },
          {
            calloutNumber: 3,
            label: "Verified Member Card",
            description: "Displays avatar photo, official title, school crest badge, and occupation.",
            visualPreview: (
              <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 space-y-0.5">
                <div className="text-[10px] font-bold text-white">Engr. Amadi Victor</div>
                <div className="text-[8px] text-teal-400">Civil Engineer • FGC Warri '98</div>
              </div>
            ),
          },
        ],
      },
      steps: [
        "Open the Directory view from the top navigation or mobile menu.",
        "Type any keyword into the search bar (e.g. 'Doctor', 'Enugu', '1995').",
        "Select a specific Unity School from the dropdown to find school alumni mates.",
        "Tap on any member card to view their verified contact details and WhatsApp connection.",
      ],
      proTips: [
        "Searching for a city or estate (e.g. 'GRA', 'Peter Odili') helps you find neighbors nearby for carpooling to events!",
      ],
      importantNotes: [
        "Only members approved by branch administrators are visible in the verified directory.",
      ],
    },
  },
  {
    id: "mem-profile",
    section: "member",
    title: "6. My Profile & Photo Verification",
    subtitle: "Managing your contact information, jersey sizing, and photo verification",
    icon: UserCheck,
    badgeText: "Member",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    content: {
      purpose: "Empower members to keep their branch records, emergency contacts, and jersey sizes up to date.",
      phoneMockup: {
        screenTitle: "My Profile Management",
        headerColor: "from-teal-900 to-slate-900",
        uiElements: [
          {
            calloutNumber: 1,
            label: "Profile Photo & Upload Badge",
            description: "Displays current portrait with live status badge ('Approved' or 'Pending Verification').",
            visualPreview: (
              <div className="flex items-center space-x-2 bg-slate-900 p-2 rounded-xl border border-slate-800">
                <div className="w-8 h-8 rounded-full bg-teal-700 text-white flex items-center justify-center text-xs font-bold">👤</div>
                <div>
                  <div className="text-[10px] font-bold text-white">Your Profile Photo</div>
                  <div className="text-[8px] text-emerald-400 font-semibold">● Status: Approved</div>
                </div>
              </div>
            ),
          },
          {
            calloutNumber: 2,
            label: "Emergency Contacts & Jersey Size",
            description: "Set T-shirt size (S, M, L, XL, XXL) for branch sports outings and specify Next of Kin info.",
            visualPreview: (
              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1.5 rounded-lg text-[8px] text-slate-300">
                <div>Jersey Size: <strong className="text-teal-400">XL</strong></div>
                <div>Next of Kin: <strong className="text-teal-400">Added ✓</strong></div>
              </div>
            ),
          },
        ],
      },
      steps: [
        "Tap your avatar at the top right and choose 'My Profile'.",
        "Review your personal information, address, and closest neighbor in Port Harcourt.",
        "To update your photo, tap 'Change Photo' and choose a high-quality portrait from your gallery.",
        "Tap 'Save Changes' to update your live profile.",
      ],
      proTips: [
        "A clear, well-lit portrait photo ensures quick approval by branch administrators.",
      ],
      importantNotes: [
        "All required profile fields must be filled in to ensure complete records for branch welfare planning.",
      ],
    },
  },
  {
    id: "mem-xplora",
    section: "member",
    title: "7. AI Xplora Knowledge Assistant",
    subtitle: "Ask instant questions about branch bylaws, meetings, unity schools, and alumni history",
    icon: Sparkles,
    badgeText: "Member",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    content: {
      purpose: "Provide 24/7 AI-powered answers regarding alumni policies, chapter meeting locations, and history.",
      phoneMockup: {
        screenTitle: "AI Xplora Assistant",
        headerColor: "from-cyan-900 to-slate-900",
        uiElements: [
          {
            calloutNumber: 1,
            label: "AI Question Prompt",
            description: "Type any question in natural English (e.g., 'When was Team Taraba River founded?').",
            visualPreview: (
              <div className="bg-slate-950 border border-cyan-500/40 rounded-xl px-2 py-1.5 text-[9px] text-cyan-200">
                "Where is the next branch meeting holding?"
              </div>
            ),
          },
          {
            calloutNumber: 2,
            label: "Instant AI Response",
            description: "Returns synthesized answers with verified references from official branch records.",
            visualPreview: (
              <div className="bg-slate-900 p-2 rounded-xl border border-cyan-500/30 text-[8px] text-slate-300 space-y-0.5">
                <div className="text-cyan-400 font-bold">AI Xplora:</div>
                <div>The next chapter meeting is on Sept 14 at Port Harcourt Club. Dress code: Branch Polo.</div>
              </div>
            ),
          },
        ],
      },
      steps: [
        "Open 'AI Xplora' from the main menu.",
        "Type your question or choose one of the quick suggested prompts.",
        "Tap 'Ask AI' to receive an immediate response.",
      ],
      proTips: [
        "You can ask questions in conversational language—AI Xplora understands natural context!",
      ],
      importantNotes: [
        "AI Xplora answers are grounded strictly in official Team Taraba River data and verified guidelines.",
      ],
    },
  },
  {
    id: "mem-media",
    section: "member",
    title: "8. Event Media Galleries & Multi-Upload",
    subtitle: "Browse high-res event photos/videos, upload new files with live progress, and batch delete",
    icon: FolderOpen,
    badgeText: "Member",
    badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-300 dark:border-teal-800",
    content: {
      purpose: "Preserve and showcase high-resolution photos and YouTube video highlights of all branch events.",
      phoneMockup: {
        screenTitle: "Event Media Gallery",
        headerColor: "from-teal-900 to-slate-900",
        uiElements: [
          {
            calloutNumber: 1,
            label: "Event Album Cards",
            description: "Displays cover thumbnail, title, date, media asset count, and YouTube badge.",
            visualPreview: (
              <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 space-y-1">
                <div className="text-[10px] font-bold text-white">Annual Sports Gala 2026</div>
                <div className="text-[8px] text-teal-400">📁 18 Photos • 🎥 2 Video Clips</div>
              </div>
            ),
          },
          {
            calloutNumber: 2,
            label: "Multi-Media Upload with MB Tracking",
            description: "Upload multiple photos/videos at once with live MB transfer readings (e.g. '45 MB / 120 MB') and single file count percentage.",
            visualPreview: (
              <div className="bg-slate-950 p-2 rounded-xl border border-teal-500/40 space-y-1">
                <div className="flex justify-between text-[8px] text-white font-bold">
                  <span>Uploading File 2 of 4</span>
                  <span className="text-teal-400">45%</span>
                </div>
                <div className="text-[7px] text-slate-400">45.2 MB / 100.5 MB Transferred</div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-teal-500 h-full w-[45%] rounded-full" />
                </div>
              </div>
            ),
          },
          {
            calloutNumber: 3,
            label: "Batch Deletion & Select All",
            description: "Select multiple items or use 'Select All' to delete unwanted media simultaneously.",
            visualPreview: (
              <div className="flex items-center space-x-2 bg-slate-900 p-1.5 rounded-lg border border-red-500/30 text-[8px] text-red-300 font-medium">
                <span>3 of 8 items selected</span>
                <span className="px-1.5 py-0.5 bg-red-600 text-white rounded text-[7px]">Delete (3)</span>
              </div>
            ),
          },
        ],
      },
      steps: [
        "Tap 'Media' in the navigation bar to see all event folders.",
        "Tap on any event folder to browse the photo gallery and streaming video clips.",
        "Tap any item to open the high-res Lightbox viewer with swipe gestures.",
        "To upload, tap 'Update / Add Media', choose your photos/videos, select the event date (restricted to past or present days), and track the live transfer progress.",
        "To delete multiple items, tap 'Select Multiple', tap the desired cards (or tap 'Select All'), and tap 'Delete Selected'.",
      ],
      proTips: [
        "Videos are automatically transcoded and synced to YouTube for smooth streaming on mobile devices.",
        "Future dates are restricted to prevent scheduling discrepancies in photo albums.",
      ],
      importantNotes: [
        "Deleting a media item permanently purges it from cloud storage and YouTube.",
      ],
    },
  },

  // ── PART 2: ADMINISTRATOR SECTION ──
  {
    id: "adm-login",
    section: "admin",
    title: "9. Admin Authentication (Google OAuth)",
    subtitle: "Strict access control restricted to authorized administrator Google accounts",
    icon: ShieldCheck,
    badgeText: "Admin",
    badgeColor: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-800",
    content: {
      purpose: "Enforce enterprise-grade security for branch management functions using verified Google OAuth.",
      phoneMockup: {
        screenTitle: "Admin Google Authentication",
        headerColor: "from-slate-950 via-red-950 to-slate-950",
        uiElements: [
          {
            calloutNumber: 1,
            label: "Google Sign-In Button",
            description: "Tap the official Google button to trigger OAuth credential verification.",
            visualPreview: (
              <div className="w-3/4 mx-auto py-1.5 bg-white text-slate-800 rounded-lg text-[9px] text-center font-bold shadow-sm flex items-center justify-center space-x-1">
                <span>G</span>
                <span>Sign in with Google</span>
              </div>
            ),
          },
          {
            calloutNumber: 2,
            label: "Authorized Email Matching",
            description: "Validates against approved administrator email addresses configured in system security.",
            visualPreview: (
              <div className="bg-slate-900 p-1.5 rounded-lg border border-red-500/40 text-[8px] text-red-300 text-center font-mono">
                🔒 Security Check: Approved Administrator Email Required
              </div>
            ),
          },
        ],
      },
      steps: [
        "From the Login Gate or Navigation bar, tap the 'Google' login button or 'Admin' tab.",
        "Authenticate using your authorized administrator Google email account.",
        "Upon successful verification, the system unlocks the full Administrator Portal and Dashboard.",
      ],
      proTips: [
        "Admins have full privileges to manage members, approve media, create events, and inspect system logs.",
      ],
      importantNotes: [
        "Non-admin accounts attempting Google Sign-In will receive an 'Access Denied: Account not permitted' notification.",
      ],
    },
  },
  {
    id: "adm-dashboard",
    section: "admin",
    title: "10. Admin Dashboard & Real-Time Analytics",
    subtitle: "Monitor active sessions, visitor logs, and database health metrics",
    icon: Database,
    badgeText: "Admin",
    badgeColor: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-800",
    content: {
      purpose: "Provide administrators with situational awareness of branch engagement and server status.",
      phoneMockup: {
        screenTitle: "Admin Analytics Dashboard",
        headerColor: "from-red-950 to-slate-900",
        uiElements: [
          {
            calloutNumber: 1,
            label: "Live Metric Cards",
            description: "Displays Total Members (115), Total Events, Pending Approvals, and Active Visits.",
            visualPreview: (
              <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1.5 rounded-xl border border-slate-800 text-[8px]">
                <div className="bg-slate-950 p-1 rounded">Members: <strong className="text-teal-400">115</strong></div>
                <div className="bg-slate-950 p-1 rounded">Pending: <strong className="text-amber-400">3</strong></div>
              </div>
            ),
          },
          {
            calloutNumber: 2,
            label: "Visitor Log Stream",
            description: "Real-time audit log showing timestamped member sign-ins and system actions.",
            visualPreview: (
              <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-[7px] text-slate-400 space-y-0.5">
                <div>[13:04] Member John Doe verified credentials ✓</div>
                <div>[12:45] New photo submitted for approval 📸</div>
              </div>
            ),
          },
        ],
      },
      steps: [
        "Navigate to the 'Admin' tab after authenticating as an administrator.",
        "Review the top stat counters to monitor member activity.",
        "Inspect the live audit trail to track recent updates across the platform.",
      ],
      proTips: [
        "The dashboard automatically refreshes via Firestore real-time listeners—no manual reload needed.",
      ],
      importantNotes: [
        "Activity logs are permanently preserved for audit and security tracking.",
      ],
    },
  },
  {
    id: "adm-members",
    section: "admin",
    title: "11. Member Management & CSV Seeding",
    subtitle: "Manage member accounts, assign roles, edit phone/email records, and seed data",
    icon: Users,
    badgeText: "Admin",
    badgeColor: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-800",
    content: {
      purpose: "Give executives full control over member onboarding, role assignment, and roster accuracy.",
      phoneMockup: {
        screenTitle: "Member Roster Management",
        headerColor: "from-red-950 to-slate-900",
        uiElements: [
          {
            calloutNumber: 1,
            label: "Member Row Controls",
            description: "Quick buttons to Edit Credentials, Assign Admin, or Remove Member.",
            visualPreview: (
              <div className="bg-slate-900 p-1.5 rounded-xl border border-slate-800 flex justify-between items-center text-[8px] text-white">
                <div>
                  <span className="font-bold">Engr. Emeka Okon</span>
                  <span className="text-[7px] text-slate-400 block">FGC Nise • 08031234567</span>
                </div>
                <div className="flex space-x-1">
                  <span className="px-1.5 py-0.5 bg-teal-600 rounded text-[7px]">Edit</span>
                  <span className="px-1.5 py-0.5 bg-slate-700 rounded text-[7px]">Role</span>
                </div>
              </div>
            ),
          },
          {
            calloutNumber: 2,
            label: "Seed Initial CSV Data Button",
            description: "One-click button to populate Firestore with all 115 official alumni records.",
            visualPreview: (
              <div className="w-full py-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded text-[8px] text-center font-bold shadow-xs">
                🌱 Seed Official 115 CSV Records
              </div>
            ),
          },
        ],
      },
      steps: [
        "In Admin Portal, switch to the 'Members' sub-tab.",
        "Search or filter by name to find any specific member.",
        "Tap 'Edit' to update their phone, email, or Unity school info.",
        "To assign administrative privileges to a trustworthy executive, toggle their role to 'Admin'.",
      ],
      proTips: [
        "If setting up a fresh database, tap 'Seed Official 115 CSV Records' to automatically initialize the entire verified branch roster.",
      ],
      importantNotes: [
        "Always confirm member identity before updating emergency contact or phone records.",
      ],
    },
  },
  {
    id: "adm-approvals",
    section: "admin",
    title: "12. Photo Approval & Moderation Queue",
    subtitle: "Review submitted profile portraits and event media before public publishing",
    icon: CheckCircle2,
    badgeText: "Admin",
    badgeColor: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-800",
    content: {
      purpose: "Maintain pristine quality and appropriateness of all photos displayed across the public portal.",
      phoneMockup: {
        screenTitle: "Photo Moderation Queue",
        headerColor: "from-red-950 to-slate-900",
        uiElements: [
          {
            calloutNumber: 1,
            label: "Submitted Photo Card",
            description: "Shows photo preview, member name, submission timestamp, and target album.",
            visualPreview: (
              <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 space-y-1">
                <div className="text-[9px] font-bold text-white">Profile Photo: Tunde Balogun</div>
                <div className="text-[7px] text-slate-400">Submitted Today at 11:20 AM</div>
                <div className="flex space-x-1.5 pt-1">
                  <div className="flex-1 py-1 bg-emerald-600 text-white rounded text-[8px] text-center font-bold">Approve ✓</div>
                  <div className="flex-1 py-1 bg-red-600 text-white rounded text-[8px] text-center font-bold">Reject ✕</div>
                </div>
              </div>
            ),
          },
        ],
      },
      steps: [
        "In the Admin Portal, switch to 'Approvals'.",
        "Inspect the preview of each submitted photo.",
        "Tap 'Approve' to instantly publish the photo and notify the member.",
        "Tap 'Reject' if the image is blurry or inappropriate.",
      ],
      proTips: [
        "The badge on the top navigation displays the live count of pending approvals so you never miss a submission.",
      ],
      importantNotes: [
        "Approved profile pictures reflect immediately across all directory listings and celebrant carousels.",
      ],
    },
  },
  {
    id: "adm-events",
    section: "admin",
    title: "13. Event Creation & Cloud Management",
    subtitle: "Create event folders, set dates, configure YouTube streaming, and manage storage",
    icon: Calendar,
    badgeText: "Admin",
    badgeColor: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 dark:border-red-800",
    content: {
      purpose: "Allow executives to publish branch schedules and organize high-res multimedia archives.",
      phoneMockup: {
        screenTitle: "Event Album Creator",
        headerColor: "from-red-950 to-slate-900",
        uiElements: [
          {
            calloutNumber: 1,
            label: "Event Form Inputs",
            description: "Enter Event Title, Date Picker (with past/present validation), Venue, and Description.",
            visualPreview: (
              <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 space-y-1 text-[8px] text-slate-300">
                <div>Title: <span className="text-white font-bold">End of Year Banquet 2026</span></div>
                <div>Date: <span className="text-teal-400 font-bold">2026-12-19</span></div>
              </div>
            ),
          },
          {
            calloutNumber: 2,
            label: "YouTube Sync Integration",
            description: "Direct OAuth sync to publish video clips to the dedicated branch YouTube channel.",
            visualPreview: (
              <div className="bg-slate-900 p-1.5 rounded-lg border border-red-500/30 text-[8px] text-red-300 flex items-center space-x-1">
                <span>🎥</span>
                <span>Auto-Sync Highlights to YouTube Channel</span>
              </div>
            ),
          },
        ],
      },
      steps: [
        "From the Event Calendar or Media section, tap 'Create New Event'.",
        "Fill in the event title, select the valid date, specify the venue, and write a brief summary.",
        "Tap 'Publish Event'. The album is created in Firestore and media upload slots become immediately active.",
      ],
      proTips: [
        "You can delete empty event folders or complete media archives using the red 'Delete Folder' action with automatic cloud cleanup.",
      ],
      importantNotes: [
        "Future dates cannot be selected for media uploads to maintain strict chronological integrity of photo records.",
      ],
    },
  },
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
    return (
      ch.title.toLowerCase().includes(q) ||
      ch.subtitle.toLowerCase().includes(q) ||
      ch.content.purpose.toLowerCase().includes(q) ||
      ch.content.steps.some((s) => s.toLowerCase().includes(q))
    );
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 pt-4 font-normal select-text">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* ── TOP HEADER / NAV BAR ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-3.5">
            <button
              onClick={onBack}
              className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shadow-xs active:scale-95 flex items-center space-x-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
              title="Return to Application"
            >
              <ArrowLeft className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Back</span>
            </button>
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-cyan-500 flex items-center justify-center shadow-md text-white">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Team Taraba River User Manual
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Interactive Step-by-Step Guide & Visual Operations Manual
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-medium transition cursor-pointer shadow-xs flex items-center space-x-2"
              title="Print Manual or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        {/* ── SECTION SELECTOR TABS & SEARCH ── */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center bg-slate-200/80 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-300 dark:border-slate-800 shadow-inner">
            <button
              onClick={() => {
                setActiveSection("member");
                setExpandedChapterId("mem-login");
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeSection === "member"
                  ? "bg-white dark:bg-teal-600 text-teal-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Part 1: Member Operations Guide</span>
            </button>
            <button
              onClick={() => {
                setActiveSection("admin");
                setExpandedChapterId("adm-login");
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center space-x-2 px-5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeSection === "admin"
                  ? "bg-white dark:bg-red-600 text-red-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Part 2: Administrator Portal Manual</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${activeSection === "member" ? "Member" : "Admin"} guide...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-500 transition shadow-xs"
            />
          </div>
        </div>

        {/* ── CHAPTERS ACCORDION LIST WITH PHONE SCREENSHOTS ── */}
        <div className="space-y-6">
          {filteredChapters.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-3">
              <HelpCircle className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No matching topics found</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Try searching for keywords like "login", "birthday", "upload", or "schools".</p>
            </div>
          ) : (
            filteredChapters.map((chapter) => {
              const isExpanded = expandedChapterId === chapter.id;
              const IconComp = chapter.icon;

              return (
                <div
                  key={chapter.id}
                  className={`bg-white dark:bg-slate-900 rounded-3xl border transition-all duration-200 overflow-hidden shadow-xs ${
                    isExpanded
                      ? "border-teal-500/50 dark:border-teal-500/40 ring-4 ring-teal-500/10 shadow-md"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  {/* Chapter Header Card */}
                  <div
                    onClick={() => setExpandedChapterId(isExpanded ? "" : chapter.id)}
                    className="p-5 sm:p-6 flex items-center justify-between cursor-pointer select-none hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
                  >
                    <div className="flex items-start sm:items-center space-x-3.5">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                          chapter.section === "admin"
                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
                            : "bg-teal-500/10 text-teal-600 dark:text-teal-400"
                        }`}
                      >
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                            {chapter.title}
                          </h3>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${chapter.badgeColor}`}
                          >
                            {chapter.badgeText}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {chapter.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0 ml-2">
                      <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium hidden sm:inline">
                        {isExpanded ? "Hide Details" : "View Step-by-Step"}
                      </span>
                      <div
                        className={`w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center transition-transform duration-200 ${
                          isExpanded ? "rotate-180 bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400" : "text-slate-400"
                        }`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content Section */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-800 p-5 sm:p-8 space-y-8 bg-slate-50/50 dark:bg-slate-950/40 animate-fadeIn">
                      
                      {/* Section Purpose */}
                      <div className="p-4 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-900/60 flex items-start space-x-3 text-xs text-teal-900 dark:text-teal-200">
                        <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-semibold block mb-0.5">Feature Purpose:</strong>
                          <span>{chapter.content.purpose}</span>
                        </div>
                      </div>

                      {/* 2-Column Grid: Left (Phone Mockup) + Right (Steps & Annotations) */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        
                        {/* ── LEFT COLUMN: PHONE MOCKUP (45%) ── */}
                        <div className="lg:col-span-5 flex justify-center">
                          <div className="w-full max-w-[320px] bg-slate-900 rounded-[40px] p-3 shadow-2xl border-4 border-slate-800 ring-1 ring-slate-700">
                            {/* Phone Speaker Notch */}
                            <div className="w-24 h-4 bg-slate-950 rounded-full mx-auto mb-2 flex items-center justify-center space-x-1.5">
                              <div className="w-8 h-1 bg-slate-800 rounded-full" />
                              <div className="w-1.5 h-1.5 bg-slate-800 rounded-full" />
                            </div>

                            {/* Phone Screen Glass */}
                            <div className="bg-slate-950 rounded-[30px] overflow-hidden border border-slate-800/80 flex flex-col min-h-[460px] relative">
                              {/* Screen Top Status Bar */}
                              <div className={`bg-gradient-to-r ${chapter.content.phoneMockup.headerColor} p-3 text-white flex items-center justify-between border-b border-slate-800`}>
                                <div className="text-[10px] font-bold tracking-tight truncate">
                                  📱 {chapter.content.phoneMockup.screenTitle}
                                </div>
                                <div className="text-[8px] opacity-70 font-mono">9:41 AM</div>
                              </div>

                              {/* Screen Body with Callout Anchors */}
                              <div className="p-3.5 space-y-3.5 flex-1 overflow-y-auto">
                                {chapter.content.phoneMockup.uiElements.map((elem) => (
                                  <div key={elem.calloutNumber} className="relative group">
                                    {/* Callout Number Badge */}
                                    <div className="absolute -left-2 -top-2 z-20 w-5 h-5 rounded-full bg-teal-500 text-white font-black text-[10px] flex items-center justify-center shadow-lg border border-white">
                                      {elem.calloutNumber}
                                    </div>
                                    <div className="pl-2 pt-1">
                                      {elem.visualPreview}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Phone Bottom Home Bar */}
                              <div className="p-2 bg-slate-950 flex justify-center">
                                <div className="w-20 h-1 bg-slate-700 rounded-full" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ── RIGHT COLUMN: NUMBERED ANNOTATIONS & INSTRUCTIONS (55%) ── */}
                        <div className="lg:col-span-7 space-y-6">
                          
                          {/* Callout Guide Matching Phone Screen */}
                          <div className="space-y-3">
                            <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                              Screen Layout & Callout Guide
                            </h4>
                            <div className="space-y-2.5">
                              {chapter.content.phoneMockup.uiElements.map((elem) => (
                                <div
                                  key={elem.calloutNumber}
                                  className="flex items-start space-x-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs shadow-xs"
                                >
                                  <div className="w-5 h-5 rounded-full bg-teal-500 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                                    {elem.calloutNumber}
                                  </div>
                                  <div className="space-y-0.5">
                                    <strong className="text-slate-900 dark:text-white font-semibold block">
                                      {elem.label}
                                    </strong>
                                    <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                                      {elem.description}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Step-by-Step Instructions */}
                          <div className="space-y-3">
                            <h4 className="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
                              Step-by-Step Instructions
                            </h4>
                            <ol className="space-y-2 text-xs text-slate-700 dark:text-slate-300 list-decimal list-inside pl-1">
                              {chapter.content.steps.map((step, idx) => (
                                <li key={idx} className="leading-relaxed pl-1">
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>

                          {/* Pro Tips */}
                          {chapter.content.proTips.length > 0 && (
                            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 space-y-1.5 text-xs text-emerald-900 dark:text-emerald-200">
                              <div className="flex items-center space-x-2 font-bold text-emerald-700 dark:text-emerald-300">
                                <Sparkles className="w-4 h-4 text-emerald-500" />
                                <span>💡 Pro Tip:</span>
                              </div>
                              <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
                                {chapter.content.proTips.map((tip, idx) => (
                                  <li key={idx}>{tip}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Important Notes */}
                          {chapter.content.importantNotes.length > 0 && (
                            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
                              <div className="flex items-center space-x-2 font-bold text-amber-700 dark:text-amber-300">
                                <AlertCircle className="w-4 h-4 text-amber-500" />
                                <span>📌 Important Note:</span>
                              </div>
                              <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
                                {chapter.content.importantNotes.map((note, idx) => (
                                  <li key={idx}>{note}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── FOOTER ACTIONS & SUPPORT HELP ── */}
        <div className="p-6 sm:p-8 bg-gradient-to-r from-teal-900 to-slate-900 text-white rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <div className="space-y-1.5">
            <h3 className="text-base sm:text-lg font-bold">Need Further Assistance?</h3>
            <p className="text-xs text-teal-200 max-w-xl">
              Team Taraba River executive administrators are available to assist with profile adjustments, photo verification, or technical access.
            </p>
          </div>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-white text-teal-900 hover:bg-teal-50 active:scale-95 font-semibold text-xs rounded-2xl transition shadow-lg shrink-0 cursor-pointer"
          >
            Return to App
          </button>
        </div>
      </div>
    </div>
  );
};
