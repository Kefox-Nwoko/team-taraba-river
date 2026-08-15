import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import {
  fetchUsosaNews,
  queryAiXplora,
  NewsHeadline,
} from "../services/apiClient";
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

const TABS = ["Headlines", "AI Xplora"] as const;
type Tab = (typeof TABS)[number];

export const UsosaNewsCard: React.FC<UsosaNewsCardProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<Tab>("Headlines");

  // ---------- Headlines state ----------
  const [headlines, setHeadlines] = useState<NewsHeadline[]>([]);
  const [newsFetched, setNewsFetched] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [selectedHeadline, setSelectedHeadline] = useState<NewsHeadline | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string>("");

  // ---------- AI Xplora state ----------
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const firstName = currentUser?.firstName || currentUser?.fullName?.split(" ")[0] || null;

  // Auto-scroll chat container ONLY (does NOT scroll browser window or displace page)
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Set welcome message when AI Xplora tab opens for first time
  useEffect(() => {
    if (activeTab === "AI Xplora" && messages.length === 0) {
      const greeting = firstName
        ? `Hi ${firstName}! 👋 I'm Gemini AI Xplora — your open AI assistant connected live to the web. Ask me anything in the world — science, current affairs, tech, coding, sports, recommendations, or general knowledge!`
        : `Hi there! 👋 I'm Gemini AI Xplora — connected live to the web. Ask me anything on any topic in the world!`;
      setMessages([
        {
          id: "welcome",
          sender: "ai",
          text: greeting,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [activeTab]);

  // Fetch news on mount
  useEffect(() => {
    loadNews();
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

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsAiLoading(true);

    try {
      const res = await queryAiXplora(query, firstName || undefined);
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
        {/* Card Header */}
        <div className="flex items-center justify-between px-5 pt-3.5 pb-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Newspaper className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-medium text-slate-900 dark:text-white tracking-tight">
                USOSA News Update
              </h3>
              {fetchedAt && activeTab === "Headlines" && (
                <p className="text-xs sm:text-sm font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                  Updated {formatFetchedAt(fetchedAt)}
                </p>
              )}
            </div>
          </div>

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
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 mx-6 mt-3">
          <div className="flex space-x-2">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 pb-2.5 px-3 text-sm sm:text-base font-normal border-b-2 transition-colors cursor-pointer ${
                  activeTab === tab
                    ? "border-amber-500 text-amber-600 dark:text-amber-400"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                {tab === "Headlines" ? <Globe className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                <span>{tab}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
        </div>

        {/* ── Tab: Headlines ── */}
        {activeTab === "Headlines" && (
          <div className="p-4 sm:p-5 space-y-2.5 h-[420px] sm:h-[460px] overflow-y-auto">
            {newsLoading && (
              <div className="flex flex-col items-center justify-center py-12 space-y-3 text-slate-400">
                <Loader2 className="w-7 h-7 animate-spin text-amber-500" />
                <p className="text-sm">Fetching USOSA news…</p>
              </div>
            )}

            {!newsLoading && newsError && headlines.length === 0 && (
              <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/40">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">{newsError}</p>
              </div>
            )}

            {!newsLoading && headlines.map((h, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedHeadline(h)}
                className="w-full text-left group flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:bg-white dark:hover:bg-slate-800/60 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <p className="text-sm sm:text-base font-normal text-slate-800 dark:text-slate-100 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors flex-1 min-w-0">
                    {h.title}
                  </p>
                </div>
                {h.publishedAt && (
                  <span className="text-xs sm:text-sm font-normal text-slate-500 dark:text-slate-400 shrink-0 ml-2">
                    · {h.publishedAt}
                  </span>
                )}
              </button>
            ))}

            {!newsLoading && !newsError && headlines.length === 0 && newsFetched && (
              <div className="py-8 text-center text-slate-400 text-sm">
                No headlines available. Try refreshing.
              </div>
            )}
          </div>
        )}

        {/* ── Tab: AI Xplora ── */}
        {activeTab === "AI Xplora" && (
          <div className="flex flex-col h-[420px] sm:h-[460px]">
            {/* Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      msg.sender === "ai"
                        ? "bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400"
                        : "bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-400"
                    }`}
                  >
                    {msg.sender === "ai" ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div className={`max-w-[85%] space-y-1.5 ${msg.sender === "user" ? "items-end flex flex-col" : ""}`}>
                    <div
                      className={`px-4.5 py-3.5 rounded-2xl text-sm sm:text-base leading-relaxed whitespace-pre-wrap ${
                        msg.sender === "ai"
                          ? "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-tl-sm"
                          : "bg-teal-600 text-white rounded-tr-sm"
                      }`}
                    >
                      {msg.text}
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
                    <span className="text-xs sm:text-sm font-normal text-slate-400 dark:text-slate-500 px-1 mt-1 block">
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              ))}

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
                placeholder={firstName ? `Ask Gemini anything, ${firstName}…` : "Ask Gemini anything on any topic…"}
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
      </div>

      {/* Headline Detail Drawer (slide-up overlay) */}
      {selectedHeadline && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center font-normal p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedHeadline(null)}
          />
          <div className="relative w-full sm:max-w-2xl max-h-[85vh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-slideUp">
            {/* Drawer Header */}
            <div className="shrink-0 flex items-start justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex-1 pr-4">
                <p className="text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 font-normal mb-1">
                  {selectedHeadline.source} · {selectedHeadline.publishedAt}
                </p>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white leading-snug">
                  {selectedHeadline.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedHeadline(null)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Clean News Summary */}
            <div className="flex-1 overflow-y-auto p-6">
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 font-normal">
                {selectedHeadline.summary}
              </p>
            </div>

            {/* Direct Source Link Button */}
            <div className="shrink-0 p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <a
                href={selectedHeadline.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                <span>Read Full Story on {selectedHeadline.source}</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
