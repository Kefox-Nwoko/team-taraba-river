import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { logger } from "./lib/logger";
import { Member, GroupEvent, PhotoApprovalRequest } from "./types";
import { AppStateManager } from "./services/storage";
import { fetchMembers, fetchEvents, fetchApprovals, fetchVisitMetrics } from "./services/apiClient";
import { FirebaseSyncManager, FirebaseService, triggerGoogleAdminSignIn } from "./services/firebaseService";
import { ChevronUp } from "lucide-react";
import { ViewSkeleton } from "./components/ui/Skeleton";
import { NetworkStatusBanner } from "./components/NetworkStatusBanner";
import { useToast } from "./components/ui/Toast";

// Eager (shell) components — needed for first paint
import { LoginGate } from "./components/LoginGate";
import { Navbar } from "./components/Navbar";
import { HeroBanner } from "./components/HeroBanner";
import { EventCalendarView } from "./components/EventCalendarView";
import { SignInModal } from "./components/SignInModal";
import { MobileBottomNav } from "./components/MobileBottomNav";

// Lazy (code-split) — heavy views & modals loaded on demand to shrink the
// initial bundle and speed up first paint on low-bandwidth connections.
const TermsAndConditionsModal = lazy(() =>
  import("./components/TermsAndConditionsModal").then((m) => ({ default: m.TermsAndConditionsModal }))
);
const EventMediaView = lazy(() =>
  import("./components/EventMediaView").then((m) => ({ default: m.EventMediaView }))
);
const AdminDashboardView = lazy(() =>
  import("./components/AdminDashboardView").then((m) => ({ default: m.AdminDashboardView }))
);
const AIKnowledgeAssistant = lazy(() =>
  import("./components/AIKnowledgeAssistant").then((m) => ({ default: m.AIKnowledgeAssistant }))
);
const MemberRegistrationModal = lazy(() =>
  import("./components/MemberRegistrationModal").then((m) => ({ default: m.MemberRegistrationModal }))
);
const MicroservicesArchModal = lazy(() =>
  import("./components/MicroservicesArchModal").then((m) => ({ default: m.MicroservicesArchModal }))
);
const CreateEventModal = lazy(() =>
  import("./components/CreateEventModal").then((m) => ({ default: m.CreateEventModal }))
);
const FullPageMediaUpload = lazy(() =>
  import("./components/FullPageMediaUpload").then((m) => ({ default: m.FullPageMediaUpload }))
);
const MyProfileView = lazy(() =>
  import("./components/MyProfileView").then((m) => ({ default: m.MyProfileView }))
);

const ModalFallback = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md animate-fadeIn">
    <div className="h-10 w-10 rounded-full border-2 border-white/30 border-t-white animate-spin" />
  </div>
);

function isProfileComplete(user: Member | null): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;

  const requiredFields: Array<keyof Member> = [
    'fullName', 'email', 'phoneNumber', 'dateOfBirth', 'occupation',
    'title', 'firstName', 'surname', 'whatsappNumber', 'gradYear',
    'schoolName', 'jerseySize', 'estateName', 'area', 'streetName',
    'closestNeighborName', 'closestNeighborPhone', 'nextOfKinName',
    'nextOfKinPhone'
  ];

  for (const field of requiredFields) {
    const val = user[field];
    if (val === undefined || val === null) return false;
    if (typeof val === 'string' && val.trim() === '') return false;
  }
  return true;
}

export default function App() {
  const { notify } = useToast();
  const [currentUser, setCurrentUser] = useState<Member | null>(AppStateManager.getCurrentUser());
  const [activeTab, setActiveTab] = useState<
    "media" | "events" | "admin" | "architecture" | "upload" | "profile"
  >("events");

  const handleSetActiveTab = (tab: any) => {
    if (currentUser && !isProfileComplete(currentUser)) {
      notify("Action Required: Please complete all required profile fields before accessing other features.", "info");
      setActiveTab("profile");
      return;
    }
    setActiveTab(tab);
  };

  // Redirect to profile page if user profile is incomplete on load or login
  useEffect(() => {
    if (currentUser && !isProfileComplete(currentUser)) {
      setActiveTab("profile");
    }
  }, [currentUser]);
  const [members, setMembers] = useState<Member[]>(AppStateManager.getMembers());
  const [events, setEvents] = useState<GroupEvent[]>(AppStateManager.getEvents());
  const [approvals, setApprovals] = useState<PhotoApprovalRequest[]>(
    AppStateManager.getApprovals()
  );

  // Portal Visit Tracking (Synced globally via Firestore)
  const [totalVisits, setTotalVisits] = useState<number>(0);
  const [lastVisitTimestamp, setLastVisitTimestamp] = useState<string>("");
  const [sessionCount, setSessionCount] = useState<number>(() => {
    return AppStateManager.getSessionCount();
  });
  const [latestUniqueUser, setLatestUniqueUser] = useState<string>("Community Member");

  // Global Sync State
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncAttemptCount, setSyncAttemptCount] = useState(0);
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

  const triggerBackgroundSync = () => {
    if (syncStatus === "syncing") return;
    setSyncStatus("syncing");
    setSyncErrorMessage(null);
    setSyncAttemptCount(1);
    
    let attempts = 1;
    const maxAttempts = 5;

    const attemptSync = async () => {
      try {
        // Simulate checking external services (Drive/YouTube)
        await new Promise((resolve) => setTimeout(resolve, 3000));
        
        // For demonstration purposes, we will simulate a success.
        // If an error were thrown here, it would retry up to 5 times.
        setSyncStatus("success");
        setTimeout(() => setSyncStatus("idle"), 5000);
      } catch (err) {
        if (attempts < maxAttempts) {
          attempts++;
          setSyncAttemptCount(attempts);
          setTimeout(attemptSync, 3000); // Wait 3s before next retry
        } else {
          setSyncStatus("error");
          setSyncErrorMessage("Failed to sync media from Google Drive/YouTube after 5 attempts.");
          setTimeout(() => setSyncStatus("idle"), 8000);
        }
      }
    };
    
    attemptSync();
  };

  // Fetch real-time visit metrics and record genuine session
  useEffect(() => {
    // 1. Record authentic session visit (deduplicated by 30-minute window)
    FirebaseService.recordSessionVisit().then((visits) => {
      if (visits > 0) setTotalVisits(visits);
    });

    // 2. Real-time synchronized subscription across all active clients
    const unsubscribe = FirebaseService.subscribeVisitMetrics((liveVisits) => {
      setTotalVisits(liveVisits);
    });

    // 3. Backend fallback sync
    fetchVisitMetrics()
      .then((metrics) => {
        if (metrics.totalVisits > 0) {
          setTotalVisits((prev) => Math.max(prev, metrics.totalVisits));
        }
        setLastVisitTimestamp(metrics.lastVisitTimestamp);
        setLatestUniqueUser(metrics.latestUniqueUser);
      })
      .catch((err) => logger.warn("Failed to fetch visit metrics from backend", { error: err }));

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUser?.id]);

  // Modals state
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [signInModalOpen, setSignInModalOpen] = useState(false);
  const [archModalOpen, setArchModalOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [createEventModalOpen, setCreateEventModalOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isEventsSubViewOpen, setIsEventsSubViewOpen] = useState(false);

  const tabHistoryRef = useRef<("media" | "events" | "admin" | "architecture" | "upload" | "profile")[]>(["events"]);
  const isBackNavigationRef = useRef(false);

  useEffect(() => {
    if (isBackNavigationRef.current) {
      isBackNavigationRef.current = false;
    } else {
      const history = tabHistoryRef.current;
      if (history[history.length - 1] !== activeTab) {
        history.push(activeTab);
      }
    }
  }, [activeTab]);

  const handleReturn = () => {
    const history = tabHistoryRef.current;
    if (history.length > 1) {
      history.pop(); // Remove current tab
      isBackNavigationRef.current = true;
      setActiveTab(history[history.length - 1]);
    } else {
      isBackNavigationRef.current = true;
      setActiveTab("events");
    }
  };

  useEffect(() => {
    const handleScroll = (e?: Event) => {
      const winScroll = window.scrollY || document.documentElement.scrollTop;
      let containerScroll = 0;
      if (e && e.target && (e.target as HTMLElement).scrollTop) {
        containerScroll = (e.target as HTMLElement).scrollTop;
      }
      const scrollables = document.querySelectorAll(".overflow-y-auto, [data-scroll-container]");
      scrollables.forEach((el) => {
        if (el.scrollTop > containerScroll) {
          containerScroll = el.scrollTop;
        }
      });
      setShowScrollTop(winScroll > 150 || containerScroll > 150);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", handleScroll, { capture: true } as any);
  }, [activeTab, registerModalOpen, signInModalOpen, archModalOpen, aiAssistantOpen]);

  const scrollToTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {}

    const scrollables = document.querySelectorAll(".overflow-y-auto, [data-scroll-container], .overflow-auto");
    scrollables.forEach((el) => {
      try {
        el.scrollTo({ top: 0, behavior: "smooth" });
      } catch (e) {}
      (el as HTMLElement).scrollTop = 0;
    });
    setShowScrollTop(false);
  };

  // Subscribe to storage changes
  useEffect(() => {
    const unsubscribe = AppStateManager.subscribe(() => {
      setMembers(AppStateManager.getMembers());
      setEvents(AppStateManager.getEvents());
      const u = AppStateManager.getCurrentUser();
      setCurrentUser(u);
      setSessionCount(AppStateManager.getSessionCount());
      setLatestUniqueUser(AppStateManager.getLatestUniqueUser(u?.id || null));
      setLastVisitTimestamp(AppStateManager.getLastVisitExcludingCurrent(u?.id || null));
    });
    return () => unsubscribe();
  }, []);

  // Sync from Firestore & backend server on mount + real-time listeners
  useEffect(() => {
    async function initData() {
      try {
        const seededMembers = await FirebaseSyncManager.seedCSVDataIfNeeded();
        setMembers(seededMembers);
        AppStateManager.saveMembers(seededMembers);

        const fetchedE = await fetchEvents();
        setEvents(fetchedE);
        AppStateManager.saveEvents(fetchedE);
      } catch (err) {
        logger.warn("Backend/Firestore sync warning, using cached local data", { error: err });
      }
    }
    initData();

    const unsubMembers = FirebaseSyncManager.subscribeMembers((updatedList) => {
      if (updatedList) {
        setMembers(updatedList);
        AppStateManager.saveMembers(updatedList);
      }
    });

    const unsubEvents = FirebaseSyncManager.subscribeEvents((updatedEvents) => {
      if (updatedEvents) {
        setEvents(updatedEvents);
        AppStateManager.saveEvents(updatedEvents);
      }
    });

    const unsubApprovals = FirebaseSyncManager.subscribeApprovals((updatedList) => {
      if (updatedList) {
        setApprovals(updatedList);
      }
    });

    // Auto-sync whenever the app comes into focus / active tab / phone unlock
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        handleRefreshAll();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleVisibilityChange);

    return () => {
      unsubMembers();
      unsubEvents();
      unsubApprovals();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleVisibilityChange);
    };
  }, []);

  const handleRefreshEvents = async () => {
    try {
      const fetchedE = await fetchEvents();
      setEvents(fetchedE);
      AppStateManager.saveEvents(fetchedE);
    } catch (err) {
      setEvents(AppStateManager.getEvents());
    }
  };

  const handleRefreshAll = async () => {
    try {
      const [m, e] = await Promise.all([fetchMembers(), fetchEvents()]);
      setMembers(m);
      AppStateManager.saveMembers(m);
      setEvents(e);
      AppStateManager.saveEvents(e);
    } catch (err) {
      setMembers(AppStateManager.getMembers());
      setEvents(AppStateManager.getEvents());
    }
  };

  const handleSignOut = () => {
    AppStateManager.setCurrentUser(null);
    setCurrentUser(null);
  };

  const pendingApprovalsCount = approvals.filter((a) => a.status === "pending").length;

  const getOriginatingPageName = () => {
    if (activeTab === "media") return "Media";
    if (activeTab === "events") return "Events";
    if (activeTab === "admin") return "Admin Dashboard";
    return "Community Portal";
  };

  const handleDirectAdminGoogleAuth = async () => {
    setRegisterModalOpen(false);
    setArchModalOpen(false);
    setAiAssistantOpen(false);
    setSignInModalOpen(false);
    try {
      const adminMember = await triggerGoogleAdminSignIn();
      setCurrentUser(adminMember);
      setActiveTab("admin");
    } catch (err) {
      logger.error("Google Admin Sign In error", err);
    }
  };

  const renderScrollToTopButton = () => (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-[199px] sm:bottom-[151px] md:bottom-[119px] right-6 sm:right-8 w-8 h-8 rounded-full bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 z-[9999] flex items-center justify-center border border-white/30 cursor-pointer interactive
        ${showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"}`}
      title="Back to top"
      aria-label="Back to top"
    >
      <ChevronUp className="w-4.5 h-4.5 stroke-[2.5]" />
    </button>
  );

  // Login Gate
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#121212] font-sans">
        <LoginGate
          onLoginSuccess={(loggedUser) => {
            setCurrentUser(loggedUser);
            AppStateManager.setCurrentUser(loggedUser);
            setActiveTab("events");
            // Fetch updated visit metrics to reflect the new login
            fetchVisitMetrics().then(metrics => setTotalVisits(metrics.totalVisits)).catch((err) => logger.error("Failed to fetch visit metrics", err));
          }}
          onOpenRegister={() => {
            setMemberToEdit(null);
            setRegisterModalOpen(true);
          }}
          availableMembers={members}
        />
        {registerModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-16 overflow-y-auto flex items-start justify-center animate-fadeIn">
            <div className="w-full max-w-[1600px] mx-auto">
              <Suspense fallback={<ModalFallback />}>
                <MemberRegistrationModal
                  isOpen={registerModalOpen}
                  onClose={() => setRegisterModalOpen(false)}
                  onOpenTerms={() => setTermsModalOpen(true)}
                  memberToEdit={null}
                  originatingPageName="Member Sign-In Gate"
                  onSuccess={(updatedM) => {
                    handleRefreshAll();
                    setCurrentUser(updatedM);
                    AppStateManager.setCurrentUser(updatedM);
                    setActiveTab("events");
                    setRegisterModalOpen(false);
                  }}
                />
              </Suspense>
            </div>
          </div>
        )}
        <Suspense fallback={null}>
          <TermsAndConditionsModal 
            isOpen={termsModalOpen} 
            onClose={() => setTermsModalOpen(false)} 
          />
        </Suspense>
        <NetworkStatusBanner />
        {renderScrollToTopButton()}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-100 font-sans selection:bg-teal-700 selection:text-white flex flex-col transition-colors duration-200">
      {/* Top Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setRegisterModalOpen(false);
          setSignInModalOpen(false);
          setAiAssistantOpen(false);
          if (tab === "architecture") {
            setArchModalOpen(true);
          } else {
            setArchModalOpen(false);
            handleSetActiveTab(tab);
          }
        }}
        onOpenSignIn={handleDirectAdminGoogleAuth}
        onOpenRegister={() => {
          setSignInModalOpen(false);
          setArchModalOpen(false);
          setAiAssistantOpen(false);
          setMemberToEdit(null);
          setRegisterModalOpen(true);
        }}

        onSignOut={handleSignOut}
        onToggleAiAssistant={() => {
          if (currentUser && !isProfileComplete(currentUser)) {
            notify("Action Required: Please complete your member profile details first.", "info");
            return;
          }
          setRegisterModalOpen(false);
          setSignInModalOpen(false);
          setArchModalOpen(false);
          setAiAssistantOpen(!aiAssistantOpen);
        }}
        isAiAssistantOpen={aiAssistantOpen}
        pendingApprovalsCount={pendingApprovalsCount}
        onCreateEvent={() => setCreateEventModalOpen(true)}
      />

      {/* Terms and Conditions Modal */}
      <Suspense fallback={null}>
        <TermsAndConditionsModal 
          isOpen={termsModalOpen} 
          onClose={() => setTermsModalOpen(false)} 
        />
      </Suspense>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-16">
        <Suspense fallback={<ModalFallback />}>
          <CreateEventModal
            isOpen={createEventModalOpen}
            onClose={() => setCreateEventModalOpen(false)}
            currentUser={currentUser}
            onSuccess={() => {
              handleRefreshEvents();
              setCreateEventModalOpen(false);
            }}
          />
        </Suspense>

        {registerModalOpen && currentUser?.role !== "admin" ? (
          <Suspense fallback={<ModalFallback />}>
            <MemberRegistrationModal
              isOpen={registerModalOpen}
              onClose={() => setRegisterModalOpen(false)}
              onOpenTerms={() => setTermsModalOpen(true)}
              memberToEdit={memberToEdit}
              originatingPageName={getOriginatingPageName()}
              onSuccess={(updatedM) => {
                handleRefreshAll();
                if (!currentUser || currentUser.id === updatedM.id) {
                  setCurrentUser(updatedM);
                  AppStateManager.setCurrentUser(updatedM);
                }
                setRegisterModalOpen(false);
              }}
            />
          </Suspense>
        ) : signInModalOpen ? (
          <SignInModal
            isOpen={signInModalOpen}
            onClose={() => setSignInModalOpen(false)}
            originatingPageName={getOriginatingPageName()}
            onSuccess={(loggedMember) => {
              setCurrentUser(loggedMember);
              AppStateManager.setCurrentUser(loggedMember);
              setSignInModalOpen(false);
            }}
            onOpenRegister={() => {
              setSignInModalOpen(false);
              setMemberToEdit(null);
              setRegisterModalOpen(true);
            }}
            availableMembers={members}
          />
        ) : archModalOpen ? (
          <Suspense fallback={<ModalFallback />}>
            <MicroservicesArchModal
              isOpen={archModalOpen}
              onClose={() => setArchModalOpen(false)}
              originatingPageName={getOriginatingPageName()}
            />
          </Suspense>
        ) : aiAssistantOpen ? (
          <Suspense fallback={<ModalFallback />}>
            <AIKnowledgeAssistant
              isOpen={aiAssistantOpen}
              onClose={() => setAiAssistantOpen(false)}
              currentUser={currentUser}
              originatingPageName={getOriginatingPageName()}
              onNavigateTab={(tab) => {
                if (tab === "directory") {
                  handleSetActiveTab("admin");
                } else {
                  handleSetActiveTab(tab as any);
                }
                setAiAssistantOpen(false);
              }}
            />
          </Suspense>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {/* Hero Banner & Calendar - Events page only */}
            {activeTab === "events" && (
              <div className="w-full flex flex-col">
                {!isEventsSubViewOpen && (
                  <HeroBanner
                    members={members}
                    events={events}
                    totalVisits={totalVisits}
                    lastVisitTimestamp={lastVisitTimestamp}
                    currentUser={currentUser}
                    onSelectTab={(tab) => handleSetActiveTab(tab)}
                    onOpenRegister={() => {
                      setSignInModalOpen(false);
                      setArchModalOpen(false);
                      setAiAssistantOpen(false);
                      setMemberToEdit(null);
                      setRegisterModalOpen(true);
                    }}
                     activeTab={activeTab}
                   />
                )}
                <EventCalendarView
                  key="event-calendar-view"
                  events={events}
                  members={members}
                  currentUser={currentUser}
                  onRefreshEvents={handleRefreshEvents}
                  onSubViewChange={setIsEventsSubViewOpen}
                />
              </div>
            )}

            {/* Tab Views */}
            {activeTab === "upload" && (
              <Suspense fallback={<ViewSkeleton label="Media upload" />}>
                <FullPageMediaUpload
                  events={events}
                  currentUser={currentUser}
                  onReturn={handleReturn}
                  onSuccess={(_updatedEvent) => {
                    handleRefreshEvents();
                    triggerBackgroundSync();
                    handleSetActiveTab("media");
                  }}
                />
              </Suspense>
            )}
            {activeTab === "media" && (
              <Suspense fallback={<ViewSkeleton label="Event media" />}>
                <EventMediaView
                  events={events}
                  currentUser={currentUser}
                  onBackToDashboard={handleReturn}
                  originatingPageName={getOriginatingPageName()}
                  onRefreshEvents={handleRefreshEvents}
                  syncStatus={syncStatus}
                  syncAttemptCount={syncAttemptCount}
                  syncErrorMessage={syncErrorMessage}
                />
              </Suspense>
            )}

            {activeTab === "admin" && (
              <Suspense fallback={<ViewSkeleton label="Admin dashboard" />}>
                <AdminDashboardView
                  members={members}
                  events={events}
                  currentUser={currentUser}
                  onRefreshData={handleRefreshAll}
                  onEditMember={(m) => {
                    setMemberToEdit(m);
                    setRegisterModalOpen(true);
                  }}
                  onRegisterClick={() => {
                    setMemberToEdit(null);
                    setRegisterModalOpen(true);
                  }}
                  onReturn={handleReturn}
                />
              </Suspense>
            )}
            {activeTab === "profile" && currentUser && (
              <Suspense fallback={<ViewSkeleton label="Profile" />}>
                <MyProfileView
                  currentUser={currentUser}
                  onOpenTerms={() => setTermsModalOpen(true)}
                  onUpdateSuccess={(updatedUser) => {
                    setCurrentUser(updatedUser);
                    AppStateManager.setCurrentUser(updatedUser);
                    handleRefreshAll();
                  }}
                />
              </Suspense>
            )}
          </div>
        )}
      </main>

      {/* Modern Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setRegisterModalOpen(false);
          setSignInModalOpen(false);
          setAiAssistantOpen(false);
          if (tab === "architecture") {
            setArchModalOpen(true);
          } else {
            setArchModalOpen(false);
            handleSetActiveTab(tab);
          }
        }}
        currentUser={currentUser}
        pendingApprovalsCount={pendingApprovalsCount}
        onOpenSignIn={handleDirectAdminGoogleAuth}
        onEditProfile={() => {
          if (currentUser) {
            handleSetActiveTab("profile");
          } else {
            handleDirectAdminGoogleAuth();
          }
        }}
      />

      {/* Scroll to Top Button */}
      <NetworkStatusBanner />
      {renderScrollToTopButton()}

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl py-4 mb-20 md:mb-0 text-slate-600 dark:text-slate-400 text-sm">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-row items-center justify-between gap-4">
          {/* Left: Copyright */}
          <div className="flex items-center min-w-0 shrink-0">
            <p className="text-slate-500 dark:text-slate-400 whitespace-nowrap text-[10px] sm:text-xs md:text-sm">
              © 2026 Xtratex Ltd for URIP Team Taraba River
            </p>
          </div>

          {/* Right: Terms and Conditions */}
          <div className="flex items-center space-x-3 sm:space-x-4 shrink-0 text-right">
            <button onClick={() => setTermsModalOpen(true)} className="interactive text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 whitespace-nowrap text-[10px] sm:text-xs md:text-sm transition-colors cursor-pointer">
              Terms & Conditions
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
