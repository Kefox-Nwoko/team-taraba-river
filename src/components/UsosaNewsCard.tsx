import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Newspaper,
  Sparkles,
  Send,
  RefreshCw,
  ExternalLink,
  X,
  ChevronRight,
  Loader2,
  Globe,
  AlertCircle,
  Bot,
  User,
  Trash2,
  ChevronDown,
  ChevronUp,
  Users,
  Search,
  Phone,
  Mail,
  MessageSquare,
  Copy,
  Check,
  Stethoscope,
  Briefcase,
  GraduationCap,
  ShieldAlert,
  Zap,
} from "lucide-react";
import {
  fetchUsosaNews,
  queryAiXplora,
  searchMembers,
  fetchMembers,
  markNewsArticleAsRead,
  getMemberReadArticles,
  MemberSearchResult,
  NewsHeadline,
} from "../services/apiClient";
import { MarkdownMessage } from "./MarkdownMessage";
import { formatMemberDisplayName } from "../utils/nameUtils";
import { Member } from "../types";

interface UsosaNewsCardProps {
  currentUser: Member | null;
}

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  sources?: { title: string; url: string }[];
  timestamp: string;
}

const TABS = ["Headlines", "AI Xplora", "Contact Search"] as const;
type Tab = (typeof TABS)[number];

export const UsosaNewsCard: React.FC<UsosaNewsCardProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<Tab>("Headlines");
  const [isCollapsedOnMobile, setIsCollapsedOnMobile] = useState(true);
  const [showCapabilitiesBanner, setShowCapabilitiesBanner] = useState(false);

  // ---------- Headlines state ----------
  const [headlines, setHeadlines] = useState<NewsHeadline[]>([]);
  const [newsFetched, setNewsFetched] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [selectedHeadline, setSelectedHeadline] = useState<NewsHeadline | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string>("");

  const memberId = currentUser?.id || "guest";
  const userReadStorageKey = `usosa_news_read_v1_${memberId}`;

  const sortedHeadlines = useMemo(() => {
    return [...headlines].sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) {
        return dateB - dateA;
      }
      return 0;
    });
  }, [headlines]);

  // Track permanently read article IDs per member across logins & devices
  const [readArticleKeys, setReadArticleKeys] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(userReadStorageKey) || localStorage.getItem("usosa_news_read_v1_persisted");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Re-sync read articles permanently from Cloud Firestore & LocalStorage whenever user profile loads
  useEffect(() => {
    let isMounted = true;
    getMemberReadArticles(memberId)
      .then((articles) => {
        if (isMounted && Array.isArray(articles) && articles.length > 0) {
          setReadArticleKeys(new Set(articles));
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [memberId]);

  const handleOpenHeadline = (h: NewsHeadline) => {
    setSelectedHeadline(h);
    const key = (h.url || h.title).trim();
    if (key) {
      // Optimistic local state update
      setReadArticleKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      // Permanent cloud & device sync (retains across 20+ logins)
      markNewsArticleAsRead(memberId, key).catch(() => {});
    }
  };

  // ---------- AI Xplora state & 3-month persistence ----------
  const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;
  const userChatStorageKey = `taraba_aixplora_chat_v2_${currentUser?.id || "guest"}`;
  const userChatLastUsedKey = `taraba_aixplora_last_used_v2_${currentUser?.id || "guest"}`;

  const getInitialChatMessages = (): ChatMessage[] => {
    try {
      const lastUsed = localStorage.getItem(userChatLastUsedKey);
      if (lastUsed) {
        const lastUsedTime = parseInt(lastUsed, 10);
        if (!isNaN(lastUsedTime) && Date.now() - lastUsedTime > THREE_MONTHS_MS) {
          localStorage.removeItem(userChatStorageKey);
          localStorage.removeItem(userChatLastUsedKey);
          return [];
        }
      }
      const saved = localStorage.getItem(userChatStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: ChatMessage) => ({
            ...m,
            text: typeof m.text === "string" ? m.text.replace(/Gemini AI Xplora/g, "AI Xplora").replace(/Gemini AI/g, "AI Xplora") : m.text,
          }));
        }
      }
    } catch {}
    return [];
  };

  const [messages, setMessages] = useState<ChatMessage[]>(getInitialChatMessages);
  const [inputQuery, setInputQuery] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // ---------- Contact Search state ----------
  const [contactQuery, setContactQuery] = useState("");
  const [contactResults, setContactResults] = useState<MemberSearchResult[]>([]);
  const [contactTotal, setContactTotal] = useState(0);
  const [contactAiPowered, setContactAiPowered] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const contactAbortRef = useRef<AbortController | null>(null);

  const firstName = currentUser?.firstName || currentUser?.fullName?.split(" ")[0] || null;

  // Auto-scroll chat container ONLY
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Persist messages whenever updated & track last used timestamp
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(userChatStorageKey, JSON.stringify(messages));
        localStorage.setItem(userChatLastUsedKey, Date.now().toString());
      } catch {}
    }
  }, [messages, userChatStorageKey, userChatLastUsedKey]);

  // Update last used timestamp when user visits/switches to AI Xplora tab
  useEffect(() => {
    if (activeTab === "AI Xplora") {
      try {
        localStorage.setItem(userChatLastUsedKey, Date.now().toString());
      } catch {}
    }
  }, [activeTab, userChatLastUsedKey]);

  // Set concise welcome message when AI Xplora tab opens for first time
  useEffect(() => {
    if (activeTab === "AI Xplora" && messages.length === 0) {
      const greeting = firstName
        ? `Hi ${firstName}! 👋 How can I help you today?`
        : `Hi there! 👋 How can I help you today?`;

      setMessages([
        {
          id: "welcome",
          sender: "ai",
          text: greeting,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [activeTab, firstName, messages.length]);

  const handleClearChatLogs = () => {
    if (window.confirm("Are you sure you want to delete your AI Xplora chat history?")) {
      try {
        localStorage.removeItem(userChatStorageKey);
        localStorage.setItem(userChatLastUsedKey, Date.now().toString());
      } catch {}
      const greeting = firstName
        ? `Hi ${firstName}! 👋 How can I help you today?`
        : `Hi there! 👋 How can I help you today?`;

      setMessages([
        {
          id: `welcome_${Date.now()}`,
          sender: "ai",
          text: greeting,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  };

  // Fetch news on mount & pre-load members for instantaneous search
  useEffect(() => {
    loadNews();
    fetchMembers().catch(() => {});
  }, []);

  async function loadNews(force = false) {
    if (newsLoading) return;
    if (newsFetched && !force) return;
    setNewsLoading(true);
    setNewsError(null);
    try {
      const data = await fetchUsosaNews(force);
      setHeadlines(data.headlines);
      setFetchedAt(data.fetchedAt);
      if (data.fallback && data.message) {
        setNewsError(data.message);
      }
    } catch {
      setNewsError("Failed to load news. Please try again.");
    } finally {
      setNewsLoading(false);
      setNewsFetched(true);
    }
  }

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const query = inputQuery.trim();
    if (!query || isAiLoading) return;
    setInputQuery("");
    setIsAiLoading(true);

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    // Immediately display user's question in the chat
    setMessages((prev) => [...prev, userMsg]);

    const historyPayload = [...messages, userMsg]
      .filter((m) => m.id !== "welcome" && !m.id.startsWith("welcome_") && !m.id.startsWith("err_") && m.text)
      .slice(-8)
      .map((m) => ({
        role: (m.sender === "user" ? "user" : "model") as "user" | "model",
        parts: [{ text: m.text }],
      }));

    try {
      const res = await queryAiXplora(query, firstName || undefined, historyPayload);
      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: "ai",
        text: res.answer,
        sources: res.sources,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: "ai",
          text: "Sorry, I ran into an error. Please try again!",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  }

  async function executeContactSearch(queryText: string) {
    const query = queryText.trim();
    if (!query || query.length < 2 || contactLoading) return;

    if (contactAbortRef.current) contactAbortRef.current.abort();
    const controller = new AbortController();
    contactAbortRef.current = controller;

    setContactLoading(true);
    try {
      const res = await searchMembers(query);
      setContactResults(res.members);
      setContactTotal(res.total);
      setContactAiPowered(res.aiPowered);
    } catch {
      setContactResults([]);
      setContactTotal(0);
      setContactAiPowered(false);
    } finally {
      setContactLoading(false);
    }
  }

  function handleContactSearch(e: React.FormEvent) {
    e.preventDefault();
    executeContactSearch(contactQuery);
  }

  const handleCopyContact = (m: MemberSearchResult) => {
    const displayName = formatMemberDisplayName(m.title, m.fullName);
    const text = `${displayName}\nOccupation: ${m.occupation}\nPhone: ${m.phoneNumber}\nEmail: ${m.email}`;
    navigator.clipboard.writeText(text);
    setCopiedId(m.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatFetchedAt = (iso: string) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  return (
    <>
      <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden font-normal">
        {/* Card Header & Mobile Collapse Toggle */}
        <div className="flex items-center justify-between px-4 sm:px-5 pt-3.5 pb-0">
          <div className="flex items-center space-x-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Newspaper className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-medium text-slate-900 dark:text-white tracking-tight truncate">
                USOSA News & AI Knowledge Hub
              </h3>
              {fetchedAt && activeTab === "Headlines" && (
                <p className="text-xs sm:text-sm font-normal text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  Latest 15 Stories · Updated {formatFetchedAt(fetchedAt)}
                </p>
              )}
              {activeTab === "Contact Search" && (
                <p className="text-xs sm:text-sm font-normal text-teal-600 dark:text-teal-400 mt-0.5 truncate">
                  Member Database Scoped AI Search · Occupations, Skills & Contacts
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Refresh button (Headlines tab only) */}
            {activeTab === "Headlines" && (
              <button
                onClick={() => loadNews(true)}
                disabled={newsLoading}
                title="Refresh news"
                className="p-1.5 rounded-full text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${newsLoading ? "animate-spin" : ""}`} />
              </button>
            )}

            {/* Mobile Collapse/Expand Toggle */}
            <button
              onClick={() => setIsCollapsedOnMobile((prev) => !prev)}
              className="sm:hidden p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition flex items-center gap-1 text-xs cursor-pointer active:scale-95"
              title={isCollapsedOnMobile ? "Expand content" : "Collapse content"}
            >
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {isCollapsedOnMobile ? "Expand" : "Collapse"}
              </span>
              {isCollapsedOnMobile ? (
                <ChevronDown className="w-4 h-4 text-amber-500" />
              ) : (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {/* Tabs — Always exposed & visible on both mobile and desktop */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 mx-4 sm:mx-6 mt-3 overflow-x-auto scrollbar-none">
          <div className="flex space-x-1 sm:space-x-2">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  if (isCollapsedOnMobile) {
                    setIsCollapsedOnMobile(false);
                  }
                }}
                className={`flex items-center gap-1.5 sm:gap-2 pb-2.5 px-2.5 sm:px-3 text-xs sm:text-sm md:text-base font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab
                    ? tab === "Contact Search"
                      ? "border-teal-600 text-teal-700 dark:text-teal-400 font-bold"
                      : "border-amber-500 text-amber-600 dark:text-amber-400 font-bold"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                {tab === "Headlines" ? (
                  <Globe className="w-4 h-4" />
                ) : tab === "AI Xplora" ? (
                  <Sparkles className="w-4 h-4" />
                ) : (
                  <Users className="w-4 h-4" />
                )}
                <span>{tab}</span>
                {tab === "Contact Search" && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-800">
                    AI Scoped
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Capabilities Info Pill Toggle */}
          {(activeTab === "AI Xplora" || activeTab === "Contact Search") && (
            <button
              onClick={() => setShowCapabilitiesBanner((prev) => !prev)}
              className="text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 pb-2 cursor-pointer shrink-0 ml-2"
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Special AI Capabilities</span>
            </button>
          )}
        </div>

        {/* Collapsible Content Area on Mobile */}
        <div className={`${isCollapsedOnMobile ? "hidden sm:block" : "block"} transition-all duration-300`}>
          {/* Special AI Capabilities Banner (Expandable) */}
          {showCapabilitiesBanner && (activeTab === "AI Xplora" || activeTab === "Contact Search") && (
            <div className="mx-4 sm:mx-6 mt-3 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-teal-500/10 to-blue-500/10 border border-amber-300/40 dark:border-amber-700/40 text-xs space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Platform Special AI Capabilities
                </span>
                <button
                  onClick={() => setShowCapabilitiesBanner(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800">
                  <span className="font-bold text-amber-700 dark:text-amber-400 block mb-0.5">
                    🌐 Live Web Intelligence (AI Xplora)
                  </span>
                  Real-time web browsing across global current affairs, science, research, coding, and general knowledge.
                </div>
                <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/60 dark:border-slate-800">
                  <span className="font-bold text-teal-700 dark:text-teal-400 block mb-0.5">
                    👥 Member Contact AI (Contact Search)
                  </span>
                  Scoped exclusively to full registered member database for occupation, skills, phone, and email matching for emergencies & networking.
                </div>
              </div>
            </div>
          )}

          {/* ── Tab: Headlines ── */}
          {activeTab === "Headlines" && (
            <div className="p-4 sm:p-5 space-y-2 h-[440px] sm:h-[480px] overflow-y-auto">
              {newsLoading && (
                <div className="flex flex-col items-center justify-center py-12 space-y-3 text-slate-400">
                  <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
                  <p className="text-sm">Gathering latest 15 stories across Unity Colleges…</p>
                </div>
              )}

              {!newsLoading && newsError && headlines.length === 0 && (
                <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/40">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">{newsError}</p>
                </div>
              )}

              {!newsLoading &&
                sortedHeadlines.map((h, idx) => {
                  const articleKey = (h.url || h.title).trim();
                  const isUnread = !readArticleKeys.has(articleKey);

                  return (
                    <button
                      key={idx}
                      onClick={() => handleOpenHeadline(h)}
                      className={`w-full text-left group flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl transition-all border cursor-pointer ${
                        isUnread
                          ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-300/50 dark:border-amber-800/40 hover:bg-amber-100/70"
                          : "hover:bg-white dark:hover:bg-slate-800/60 border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 transition-transform ${
                            isUnread
                              ? "bg-amber-500 scale-125 shadow-xs shadow-amber-500"
                              : "bg-slate-300 dark:bg-slate-700"
                          }`}
                        />
                        <p
                          className={`text-sm sm:text-base truncate transition-colors flex-1 min-w-0 ${
                            isUnread
                              ? "font-bold text-slate-950 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400"
                              : "font-normal text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white"
                          }`}
                        >
                          {h.title}
                        </p>
                      </div>
                      {h.publishedAt && (
                        <span
                          className={`text-xs sm:text-sm shrink-0 ml-2 ${
                            isUnread
                              ? "font-semibold text-amber-700 dark:text-amber-400"
                              : "font-normal text-slate-400 dark:text-slate-500"
                          }`}
                        >
                          · {h.publishedAt}
                        </span>
                      )}
                    </button>
                  );
                })}

              {!newsLoading && !newsError && headlines.length === 0 && newsFetched && (
                <div className="py-8 text-center text-slate-400 text-sm">
                  No headlines available. Try refreshing.
                </div>
              )}
            </div>
          )}

          {/* ── Tab: AI Xplora (Live Web Intelligence) ── */}
          {activeTab === "AI Xplora" && (
            <div className="flex flex-col h-[420px] sm:h-[460px]">
              {/* Top Toolbar / Action Bar */}
              <div className="flex items-center justify-between px-4 py-2 bg-slate-100/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800 text-xs shrink-0">
                <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>AI Xplora</span>
                </span>
                <button
                  onClick={handleClearChatLogs}
                  title="Clear and reset chat history"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  <span>Clear History</span>
                </button>
              </div>

              {/* Messages */}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {messages.map((msg) => {
                  const isUser = msg.sender === "user";
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2.5 sm:gap-3 ${isUser ? "flex-row-reverse" : ""}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-xs ${
                          isUser
                            ? "bg-teal-700 text-white"
                            : "bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                        }`}
                      >
                        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>
                      <div className={`max-w-[85%] sm:max-w-[78%] space-y-1 ${isUser ? "items-end flex flex-col" : ""}`}>
                        <span
                          className={`text-[11px] font-bold uppercase tracking-wider block px-1 ${
                            isUser ? "text-teal-700 dark:text-teal-400" : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {isUser ? "You" : "AI Xplora"}
                        </span>
                        <div
                          className={`px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                            isUser
                              ? "bg-teal-700 text-white rounded-tr-xs shadow-sm font-normal"
                              : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/90 dark:border-slate-700/80 rounded-tl-xs shadow-xs font-normal"
                          }`}
                        >
                          <MarkdownMessage content={msg.text} isUser={isUser} />
                        </div>
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {msg.sources.slice(0, 4).map((src, i) => (
                              <a
                                key={i}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900 hover:bg-amber-100 transition-colors truncate max-w-[180px]"
                              >
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate">{src.title}</span>
                              </a>
                            ))}
                          </div>
                        )}
                        <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500 px-1 block">
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {isAiLoading && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="px-4.5 py-3.5 rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div className="flex space-x-1.5">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <form
                onSubmit={handleSendMessage}
                className="shrink-0 flex items-center gap-2 p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              >
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder={firstName ? `Ask AI Xplora anything, ${firstName}…` : "Ask AI Xplora anything on any topic…"}
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
                  disabled={isAiLoading}
                />
                <button
                  type="submit"
                  disabled={!inputQuery.trim() || isAiLoading}
                  className="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* ── Tab: Contact Search (Dedicated AI Member Search) ── */}
          {activeTab === "Contact Search" && (
            <div className="flex flex-col h-[460px] sm:h-[500px]">
              {/* Top Info Banner */}
              <div className="flex items-center justify-between px-4 py-2 bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 text-xs shrink-0">
                <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <Users className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Member Database AI Search · All Professions, Networking & Emergency Coordination</span>
                </span>
                <div className="flex items-center gap-2">
                  {contactAiPowered && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 text-[10px] font-bold uppercase tracking-wider border border-teal-300 dark:border-teal-800">
                      <Sparkles className="w-3 h-3" /> Semantic AI
                    </span>
                  )}
                  {contactTotal > 0 && (
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {contactTotal} member{contactTotal !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>

              {/* Search Form */}
              <div className="shrink-0 p-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <form onSubmit={handleContactSearch} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={contactQuery}
                      onChange={(e) => setContactQuery(e.target.value)}
                      placeholder="Ask or prompt anything (e.g. 'find a doctor', 'who is a lawyer', '0803...', 'architects')..."
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                    />
                    {contactQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setContactQuery("");
                          setContactResults([]);
                          setContactTotal(0);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={!contactQuery.trim() || contactLoading}
                    className="px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-40 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shrink-0 transition shadow-sm cursor-pointer"
                  >
                    {contactLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span className="hidden sm:inline">Search</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Results Container */}
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3 bg-slate-50/50 dark:bg-slate-950/40">
                {contactLoading && (
                  <div className="flex flex-col items-center justify-center py-12 space-y-2 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                    <p className="text-xs sm:text-sm font-medium">Processing prompt across registered member database...</p>
                  </div>
                )}

                {!contactLoading && contactQuery.trim().length >= 2 && contactResults.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2 text-center">
                    <Users className="w-10 h-10 opacity-30" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No members matched "{contactQuery}"</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                      Try prompting in another way or searching by professions, skills, school, location, or direct phone digits/email.
                    </p>
                  </div>
                )}

                {!contactLoading && contactQuery.trim().length < 2 && (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400 space-y-3 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-400 flex items-center justify-center shadow-sm">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div className="space-y-1 max-w-sm">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        Universal Professional & Contact AI Finder
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Prompt or search for members across <strong>any field of work, profession, or life skill</strong> (Healthcare, Legal, Engineering, Tech, Finance, Real Estate, Agriculture, Media, Education), locations, verified skills, phone numbers, or emails.
                      </p>
                    </div>
                  </div>
                )}

                {/* Member Cards */}
                {contactResults.map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-teal-500/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shrink-0 font-black text-sm overflow-hidden shadow-sm mt-0.5">
                        {m.photoUrl ? (
                          <img src={m.photoUrl} alt="" className="w-11 h-11 rounded-2xl object-cover" />
                        ) : (
                          (m.fullName || "M").charAt(0).toUpperCase()
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
                            {formatMemberDisplayName(m.title, m.fullName)}
                          </h4>
                          {m.schoolName && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs sm:text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700 shadow-2xs truncate max-w-xs">
                              🎓 {m.schoolName}
                            </span>
                          )}
                        </div>

                        {/* Occupation */}
                        {m.occupation && m.occupation.trim() && m.occupation.trim().toLowerCase() !== "member" && (
                          <div className="flex items-center gap-1.5 text-xs text-teal-800 dark:text-teal-300 font-bold">
                            <Briefcase className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                            <span className="truncate">{m.occupation}</span>
                          </div>
                        )}

                        {/* Skills */}
                        {m.skills && m.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {m.skills.map((s, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-lg text-xs sm:text-[13px] font-semibold bg-teal-50 dark:bg-teal-950/80 text-teal-900 dark:text-teal-200 border border-teal-300/80 dark:border-teal-700 shadow-2xs"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Phone & Email labels */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-600 dark:text-slate-400">
                          {m.phoneNumber && (
                            <span className="flex items-center gap-1 font-medium">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{m.phoneNumber}</span>
                            </span>
                          )}
                          {m.email && (
                            <span className="flex items-center gap-1 font-medium truncate max-w-[200px]">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{m.email}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Call, WhatsApp, Email, Copy */}
                    <div className="flex items-center gap-1.5 self-stretch sm:self-center justify-end border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100 dark:border-slate-800 shrink-0">
                      {m.phoneNumber && (
                        <>
                          <a
                            href={`tel:${m.phoneNumber}`}
                            title="Call phone directly"
                            className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition flex items-center justify-center cursor-pointer shadow-xs"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                          <a
                            href={`https://wa.me/${(m.whatsappNumber || m.phoneNumber).replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Chat on WhatsApp"
                            className="p-2 rounded-xl bg-green-50 dark:bg-green-950/50 hover:bg-green-100 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 transition flex items-center justify-center cursor-pointer shadow-xs"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </a>
                        </>
                      )}
                      {m.email && (
                        <a
                          href={`mailto:${m.email}`}
                          title="Send email"
                          className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition flex items-center justify-center cursor-pointer shadow-xs"
                        >
                          <Mail className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => handleCopyContact(m)}
                        title="Copy contact information"
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition flex items-center justify-center cursor-pointer shadow-xs"
                      >
                        {copiedId === m.id ? (
                          <Check className="w-4 h-4 text-teal-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Headline Detail Drawer (slide-up overlay) */}
      {selectedHeadline && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center font-normal p-0 sm:p-4 animate-fadeIn">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-md transition-opacity"
            onClick={() => setSelectedHeadline(null)}
          />
          <div className="relative w-full sm:max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-slideUp">
            {/* Drawer Header */}
            <div className="shrink-0 p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {selectedHeadline.schoolTag && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60">
                        🏷️ {selectedHeadline.schoolTag}
                      </span>
                    )}
                    <span className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400 font-medium">
                      {selectedHeadline.source} · {selectedHeadline.publishedAt}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                    {selectedHeadline.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedHeadline(null)}
                  className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* Story Summary Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 dark:bg-amber-950/30 border border-amber-300/30 dark:border-amber-700/30 w-fit">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                  Story Summary (10–15 Lines)
                </span>
              </div>

              {/* Comprehensive Summary */}
              <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 space-y-3 whitespace-pre-line font-normal bg-slate-50 dark:bg-slate-800/40 p-4.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                {selectedHeadline.summary}
              </div>

              {/* All Covering News Channels / Media Outlets */}
              {selectedHeadline.otherSources && selectedHeadline.otherSources.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Newspaper className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      News Outlets & Channels Covering This Story ({selectedHeadline.otherSources.length})
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedHeadline.otherSources.map((source, sIdx) => (
                      <a
                        key={sIdx}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-xs transition-all group"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
                            {source.sourceName}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {source.title}
                          </p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 shrink-0 transition-colors" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Direct Source Link Button Footer */}
            <div className="shrink-0 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Click any channel above to read alternate coverage.
              </span>
              <a
                href={selectedHeadline.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                <span>Read Full Story</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
