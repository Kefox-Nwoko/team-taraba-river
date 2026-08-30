import React, { useState } from "react";
import { AIQueryResponse, Member } from "../types";
import { queryAIAssistant } from "../services/apiClient";
import { Sparkles, Send, Bot, User, FileText, ExternalLink, Zap, ArrowLeft, ChevronLeft } from "lucide-react";
import { MarkdownMessage } from "./MarkdownMessage";
interface AIKnowledgeAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Member | null;
  onNavigateTab: (tab: "directory" | "calendar" | "admin" | "architecture") => void;
  originatingPageName?: string;
}
interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  responseMeta?: AIQueryResponse;
  timestamp: string;
}
export const AIKnowledgeAssistant: React.FC<AIKnowledgeAssistantProps> = ({
  isOpen,
  onClose,
  currentUser,
  onNavigateTab,
  originatingPageName = "Community Portal",
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_welcome",
      sender: "ai",
      text: "Hello! I'm the URIP Community AI Assistant. Ask me anything about our members, upcoming events, member birthdays, event photos, or who we are as Usosans Resident in Port Harcourt (USOSA alumni)!",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  if (!isOpen) return null;
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputQuery.trim() || isLoading) return;
    const queryText = inputQuery.trim();
    setInputQuery("");
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    try {
      const responseMeta = await queryAIAssistant(queryText, {
        memberId: currentUser?.id,
        role: currentUser?.role,
      });
      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: "ai",
        text: responseMeta.answer,
        responseMeta,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        sender: "ai",
        text: "I experienced a temporary connection delay. Please ensure your query relates to Team Taraba River members, events, or media archives.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };
  const samplePrompts = [
    "Who has birthdays coming up in July or August?",
    "Show me upcoming river cleanup events and location",
    "Where can I view event media albums and videos?",
  ];
  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[650px] animate-fadeIn font-normal relative">
      {" "}
      {/* Top Header & Context-Specific Back Navigation */}{" "}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        {" "}
        <div>
          {" "}
          <h1 className="text-xl sm:text-2xl font-normal tracking-tight text-slate-900 dark:text-white leading-tight">
            {" "}
            AI Xplore Assistant{" "}
          </h1>{" "}
          <p className="text-sm text-teal-700 dark:text-teal-400">
            {" "}
            Automated Query Routing & Vector Knowledge Base Synthesis{" "}
          </p>{" "}
        </div>{" "}
        <button onClick={onClose} className="p-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full transition shadow-sm flex items-center justify-center cursor-pointer" >
          {" "}
          <ChevronLeft className="w-5 h-5" />{" "}
        </button>{" "}
      </div>{" "}
      {/* Main Full Page Chat Interface Container */}{" "}
      <div className="flex-1 flex flex-col overflow-hidden">
        {" "}
        {/* Messages Area */}{" "}
        <div className="flex-1 py-6 overflow-y-auto space-y-4 text-sm">
          {" "}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
            >
              {" "}
              <div
                className={`${msg.sender === "user" ? "max-w-[85%] sm:max-w-[75%] bg-teal-700 text-white rounded-br-none shadow-md shadow-teal-700/20" : "w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none shadow-sm"} rounded-2xl p-4`}
              >
                {" "}
                <div className="flex items-center justify-between space-x-2 text-sm opacity-80 mb-1.5">
                  {" "}
                  <span className="uppercase tracking-wider flex items-center gap-1">
                    {" "}
                    {msg.sender === "user" ? (
                      <User className="w-3 h-3" />
                    ) : (
                      <Bot className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                    )}{" "}
                    {msg.sender === "user" ? "You" : "AI Assistant"}{" "}
                  </span>{" "}
                  <span>{msg.timestamp}</span>{" "}
                </div>{" "}
                {/* Message Content */}
                <div className="leading-relaxed text-sm sm:text-sm">
                  <MarkdownMessage content={msg.text} isUser={msg.sender === "user"} />
                </div>
                {/* If AI message with routed metadata */}{" "}
                {msg.responseMeta && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-sm">
                    {" "}
                    {/* Routed Service Badge */}{" "}
                    <div className="flex flex-wrap items-center gap-2">
                      {" "}
                      <span className="px-2.5 py-1 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 text-sm border border-purple-200 dark:border-purple-800/50 flex items-center gap-1">
                        {" "}
                        <Zap className="w-3 h-3 text-amber-500 dark:text-amber-400" />{" "}
                        <span>Intent: {msg.responseMeta.intent}</span>{" "}
                      </span>{" "}
                      <span className="text-[0.6875rem] text-slate-500 dark:text-slate-400">
                        {" "}
                        → Routed to {msg.responseMeta.routedService}{" "}
                      </span>{" "}
                    </div>{" "}
                    {/* Sources Citation */}{" "}
                    {msg.responseMeta.sources.length > 0 && (
                      <div className="text-[0.6875rem] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        {" "}
                        <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />{" "}
                        <span>Sources: {msg.responseMeta.sources.join(", ")}</span>{" "}
                      </div>
                    )}{" "}
                    {/* Suggested Actions Buttons */}{" "}
                    {msg.responseMeta.suggestedActions.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {" "}
                        {msg.responseMeta.suggestedActions.map((act, i) => (
                          <button key={i} onClick={() => {
                              onClose();
                              if (act.actionType === "NAVIGATE_EVENTS") onNavigateTab("calendar");
                              else if (act.actionType === "NAVIGATE_MEMBERS")
                                onNavigateTab("directory");
                            }}
                            className="px-3 py-1.5 bg-teal-100 dark:bg-teal-950 hover:bg-teal-200 dark:hover:bg-teal-900 text-teal-800 dark:text-teal-300 text-xs rounded-xl border border-teal-300 dark:border-teal-800 flex items-center space-x-1 transition"
                          >
                            {" "}
                            <span>{act.label}</span> <ExternalLink className="w-3 h-3" />{" "}
                          </button>
                        ))}{" "}
                      </div>
                    )}{" "}
                  </div>
                )}{" "}
              </div>{" "}
            </div>
          ))}{" "}
          {isLoading && (
            <div className="flex items-center space-x-2 text-sm text-purple-600 dark:text-purple-400 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 w-fit shadow-sm">
              {" "}
              <Sparkles className="w-4 h-4 animate-spin" />{" "}
              <span>Classifying Intent & Synthesizing Vector Knowledge...</span>{" "}
            </div>
          )}{" "}
        </div>{" "}
        {/* Suggested Quick Prompts */}{" "}
        <div className="py-4 space-y-2">
          {" "}
          <span className="text-sm uppercase text-slate-500 dark:text-slate-400 block tracking-wider">
            Suggested Prompts:
          </span>{" "}
          <div className="flex flex-wrap gap-2">
            {" "}
            {samplePrompts.map((prompt, i) => (
              <button key={i} onClick={() => {
                  setInputQuery(prompt);
                }}
                className="text-xs bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-left transition"
              >
                {" "}
                {prompt}{" "}
              </button>
            ))}{" "}
          </div>{" "}
        </div>{" "}
        {/* Input Form */}{" "}
        <form
          onSubmit={handleSend}
          className="pt-2 flex items-center space-x-3"
        >
          {" "}
          <input
            type="text"
            placeholder="Ask AI Assistant about members, cleanups, birthdays..."
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-sm sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
          />{" "}
          <button type="submit" disabled={!inputQuery.trim() || isLoading} className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl transition flex items-center space-x-2" >
            {" "}
            <Send className="w-4 h-4" /> <span className="hidden sm:inline">Send</span>{" "}
          </button>{" "}
        </form>{" "}
      </div>{" "}
      {/* Bottom Navigation */}{" "}
      <div className="flex justify-between items-center pt-2">
        {" "}
        <button onClick={onClose} className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs rounded-xl transition shadow-md flex items-center space-x-2" >
          {" "}
          <ArrowLeft className="w-4 h-4" /> <span>Back to {originatingPageName}</span>{" "}
        </button>{" "}
      </div>{" "}
    </div>
  );
};
