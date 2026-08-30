import React from "react";
import {
  Layers,
  Database,
  Shield,
  Zap,
  Server,
  Lock,
  Cpu,
  Folder,
  Video,
  Bot,
  ArrowLeft,
} from "lucide-react";
interface MicroservicesArchModalProps {
  isOpen: boolean;
  onClose: () => void;
  originatingPageName?: string;
}
export const MicroservicesArchModal: React.FC<MicroservicesArchModalProps> = ({
  isOpen,
  onClose,
  originatingPageName = "Community Portal",
}) => {
  if (!isOpen) return null;
  return (
    <div className="space-y-6 animate-fadeIn">
      {" "}
      {/* Top Header & Context-Specific Back Navigation */}{" "}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
        {" "}
        <div className="flex items-center space-x-3">
          {" "}
          <button onClick={onClose} className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs rounded-2xl transition shadow-md flex items-center space-x-2 group" >
            {" "}
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />{" "}
            <span>Back to {originatingPageName}</span>{" "}
          </button>{" "}
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />{" "}
          <div>
            {" "}
            <h1 className="text-sm sm:text-sm text-slate-900 dark:text-white tracking-tight">
              {" "}
              Microservices Architecture & DB Schema{" "}
            </h1>{" "}
            <p className="text-sm text-teal-700 dark:text-teal-400">
              {" "}
              Team Taraba River Full-Stack Cloud Infrastructure Overview{" "}
            </p>{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
      {/* Main Full Page Content */}{" "}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-md transition-colors space-y-8">
        {" "}
        {/* Microservices Grid Diagram */}{" "}
        <div className="space-y-4">
          {" "}
          <h3 className="text-sm uppercase tracking-wider text-teal-800 dark:text-teal-400 flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            {" "}
            <Server className="w-4 h-4 text-teal-600 dark:text-teal-400" />{" "}
            <span>1. Modular Microservices Topology</span>{" "}
          </h3>{" "}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            {" "}
            {/* Service 1 */}{" "}
            <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
              {" "}
              <div className="flex items-center space-x-2 text-teal-700 dark:text-teal-400 text-sm">
                {" "}
                <Lock className="w-4 h-4" /> <span>Auth & Gateway</span>{" "}
              </div>{" "}
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {" "}
                Handles registered email and phone authentication. Issues encrypted tokens and
                enforces Role-Based Access Controls (RBAC).{" "}
              </p>{" "}
            </div>{" "}
            {/* Service 2 */}{" "}
            <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
              {" "}
              <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-400 text-sm">
                {" "}
                <Database className="w-4 h-4" /> <span>Member Registry Service</span>{" "}
              </div>{" "}
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {" "}
                Manages real-time member profile creation, DOB extraction for birthday events, skill
                sets, and location data.{" "}
              </p>{" "}
            </div>{" "}
            {/* Service 3 */}{" "}
            <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
              {" "}
              <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-400 text-sm">
                {" "}
                <Shield className="w-4 h-4" /> <span>Admin Moderation Service</span>{" "}
              </div>{" "}
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {" "}
                Queue system holding member profile photo submissions in"Pending"state until
                reviewed and approved by administrators.{" "}
              </p>{" "}
            </div>{" "}
            {/* Service 4 */}{" "}
            <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
              {" "}
              <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-400 text-sm">
                {" "}
                <Folder className="w-4 h-4" /> <span>Media Integration Service</span>{" "}
              </div>{" "}
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {" "}
                Google Drive folder image gallery synchronization and YouTube video stream parsing
                attached to event records.{" "}
              </p>{" "}
            </div>{" "}
            {/* Service 5 */}{" "}
            <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
              {" "}
              <div className="flex items-center space-x-2 text-purple-700 dark:text-purple-400 text-sm">
                {" "}
                <Bot className="w-4 h-4" /> <span>RAG & AI Query Router</span>{" "}
              </div>{" "}
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {" "}
                Gemini 3.6 Flash vector knowledge base synthesis and automated query routing with
                intent classification.{" "}
              </p>{" "}
            </div>{" "}
            {/* Service 6 */}{" "}
            <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-2">
              {" "}
              <div className="flex items-center space-x-2 text-pink-700 dark:text-pink-400 text-sm">
                {" "}
                <Zap className="w-4 h-4" /> <span>Analytics & Leaderboard</span>{" "}
              </div>{" "}
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {" "}
                Real-time activity point tracking and data visualization of top 10 active members on
                the admin dashboard.{" "}
              </p>{" "}
            </div>{" "}
          </div>{" "}
        </div>{" "}
        {/* Database Schema Specifications */}{" "}
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          {" "}
          <h3 className="text-sm uppercase tracking-wider text-teal-800 dark:text-teal-400 flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            {" "}
            <Database className="w-4 h-4 text-teal-600 dark:text-teal-400" />{" "}
            <span>2. Clean Database Schema (Firestore"Team Taraba River"Collections)</span>{" "}
          </h3>{" "}
          <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 font-mono text-sm text-slate-800 dark:text-slate-300 space-y-3">
            {" "}
            <div>
              {" "}
              <span className="text-teal-700 dark:text-teal-400">collection("members"):</span>{" "}
              &#123; id, fullName, email, phoneNumber, dateOfBirth, occupation, photoUrl,
              photoStatus, role, activityPoints &#125;{" "}
            </div>{" "}
            <div>
              {" "}
              <span className="text-teal-700 dark:text-teal-400">collection("events"):</span> &#123;
              id, title, date, time, location, category, driveFolderId, driveImageUrls,
              youtubeVideoUrl, attendeeIds &#125;{" "}
            </div>{" "}
            <div>
              {" "}
              <span className="text-teal-700 dark:text-teal-400">
                collection("photo_approvals"):
              </span>{" "}
              &#123; id, memberId, photoUrl, uploadedAt, status: 'pending' | 'approved' | 'rejected'
              &#125;{" "}
            </div>{" "}
            <div>
              {" "}
              <span className="text-teal-700 dark:text-teal-400">
                collection("activity_logs"):
              </span>{" "}
              &#123; id, memberId, action, timestamp, pointsEarned &#125;{" "}
            </div>{" "}
          </div>{" "}
        </div>{" "}
        {/* Security & Data Encryption Protocols */}{" "}
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          {" "}
          <h3 className="text-sm uppercase tracking-wider text-teal-800 dark:text-teal-400 flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            {" "}
            <Lock className="w-4 h-4 text-teal-600 dark:text-teal-400" />{" "}
            <span>3. High Security Protocols & Encryption</span>{" "}
          </h3>{" "}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-700 dark:text-slate-300">
            {" "}
            <div className="bg-slate-50 dark:bg-slate-950/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              {" "}
              <strong className="text-slate-900 dark:text-white block mb-1">
                In-Transit & At-Rest Encryption:
              </strong>{" "}
              <span>
                TLS 1.3 enforced for all browser interactions; AES-256 cloud encryption for
                Firestore documents.
              </span>{" "}
            </div>{" "}
            <div className="bg-slate-50 dark:bg-slate-950/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              {" "}
              <strong className="text-slate-900 dark:text-white block mb-1">
                Role-Based Access Control (RBAC):
              </strong>{" "}
              <span>
                Administrative routes and moderation queue protected via server-side privilege
                validation.
              </span>{" "}
            </div>{" "}
          </div>{" "}
        </div>{" "}
        {/* Section 4: Authentic Analytics & Portal Visit Counting Methodology */}
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-sm uppercase tracking-wider text-teal-800 dark:text-teal-400 flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <Zap className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>4. Portal Visit Calculation & Authenticity Methodology</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-slate-700 dark:text-slate-300">
            <div className="bg-slate-50 dark:bg-slate-950/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <strong className="text-slate-900 dark:text-white block mb-1">
                30-Minute Session Deduplication:
              </strong>
              <span>
                To guarantee genuine metrics and prevent spam, repeat visits or browser refreshes (F5) within a 30-minute inactivity window are treated as the same active session and will not artificially inflate visit counts.
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <strong className="text-slate-900 dark:text-white block mb-1">
                Atomic Cloud Firestore Synchronization:
              </strong>
              <span>
                New unique sessions execute an atomic <code className="text-xs bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">increment(1)</code> in Firestore (<code className="text-xs">system/metrics</code>) with server timestamps, synchronized in real-time across all public clients and admin dashboards.
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="flex justify-between items-center pt-6 border-t border-slate-200 dark:border-slate-800">
          {" "}
          <button onClick={onClose} className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs rounded-xl transition shadow-md flex items-center space-x-2" >
            {" "}
            <ArrowLeft className="w-4 h-4" /> <span>Back to {originatingPageName}</span>{" "}
          </button>{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
};
