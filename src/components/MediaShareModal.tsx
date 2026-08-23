import React, { useState } from "react";
import { GroupEvent, Member } from "../types";
import { MemberAvatar } from "./MemberAvatar";
import {
  X,
  ImageIcon,
  Video,
  Download,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  MessageCircle,
  Twitter,
  Facebook,
  Play,
} from "lucide-react";

interface MediaShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  mostInteractiveUser: Member;
  events: GroupEvent[];
}

export const MediaShareModal: React.FC<MediaShareModalProps> = ({
  isOpen,
  onClose,
  mostInteractiveUser,
  events,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"photos" | "videos">("photos");

  if (!isOpen) return null;

  const photoItems = events.flatMap((e) =>
    (e.driveImageUrls || []).map((url, idx) => ({
      id: `${e.id}_img_${idx}`,
      url,
      title: `${e.title} - Clip #${idx + 1}`,
      eventTitle: e.title,
      date: e.date,
      uploader: e.createdBy,
    }))
  );

  const videoItems = events
    .filter((e) => !!e.youtubeVideoUrl)
    .map((e, idx) => ({
      id: `${e.id}_vid_${idx}`,
      url: e.youtubeVideoUrl!,
      title: e.youtubeTitle || `${e.title} Video Highlights`,
      eventTitle: e.title,
      date: e.date,
      uploader: e.createdBy,
    }));

  const handleCopyLink = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShareWhatsApp = (title: string, url: string) => {
    const text = `Check out this media clip from Team Taraba River: "${title}" - ${url}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleShareTwitter = (title: string, url: string) => {
    const text = `Check out "${title}" on Team Taraba River Portal!`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(
        url
      )}`,
      "_blank"
    );
  };

  const handleShareFacebook = (url: string) => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
  };

  const handleDirectDownload = (url: string, filename: string) => {
    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `${filename.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => {
        window.open(url, "_blank");
      });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden transition-all">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <MemberAvatar member={mostInteractiveUser} sizeClassName="w-12 h-12" />
              <span className="absolute -bottom-1 -right-1 bg-teal-500 text-white rounded-full p-0.5">
                <Sparkles className="w-3 h-3" />
              </span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-sm text-slate-900 dark:text-white">
                  Media Showcase & Direct Sharing
                </h2>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Shared by <strong className="text-slate-800 dark:text-slate-200">{mostInteractiveUser.fullName}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 dark:bg-slate-800 rounded-full transition" >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Filters */}
        <div className="px-6 pt-4 bg-white dark:bg-slate-900 flex items-center space-x-3 border-b border-slate-200 dark:border-slate-800">
          <button onClick={() => setActiveTab("photos")}
            className={`px-3 py-1.5 text-xs  rounded-t-xl border-b-2 transition flex items-center space-x-2 ${
              activeTab === "photos"
                ? "border-teal-600 text-teal-700 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-950/30"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Photo Assets ({photoItems.length})</span>
          </button>
          <button onClick={() => setActiveTab("videos")}
            className={`px-3 py-1.5 text-xs  rounded-t-xl border-b-2 transition flex items-center space-x-2 ${
              activeTab === "videos"
                ? "border-red-600 text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/30"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Event Videos ({videoItems.length})</span>
          </button>
        </div>

        {/* Media Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "photos" ? (
            photoItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400">No photos available.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {photoItems.map((item) => (
                  <div
                    key={item.id}
                    className="group bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col shadow-sm"
                  >
                    <div className="relative aspect-video overflow-hidden bg-slate-200 dark:bg-slate-800">
                      <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-sm text-slate-900 dark:text-white line-clamp-1">
                          {item.title}
                        </h4>
                      </div>
                      <button onClick={() => handleDirectDownload(item.url, item.title)}
                        className="w-full py-1.5 px-3 bg-teal-700 hover:bg-teal-800 text-white text-xs rounded-xl flex items-center justify-center space-x-1.5 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Direct Download</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : videoItems.length === 0 ? (
            <div className="p-12 text-center text-slate-400">No videos available.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {videoItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-4"
                >
                  <h4 className="text-sm text-slate-900 dark:text-white">{item.title}</h4>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white text-xs rounded-xl flex items-center justify-center space-x-2 transition"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Watch Video</span>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between text-sm text-slate-500">
          <span>Direct web media access</span>
          <button onClick={onClose} className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl" >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
