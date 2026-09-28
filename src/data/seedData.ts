import {
  Member,
  GroupEvent,
  PhotoApprovalRequest,
  ActivityLog,
  KnowledgeBaseArticle,
} from "../types";

// Deliberately empty. This file is imported by the browser bundle, and it used
// to re-export the full CSV roster (phones, next of kin, neighbours) — which
// shipped every member's private details in the public JavaScript. The roster
// lives only on the server (server.ts / birthdayService import csvMembers
// directly); the client gets members from the authenticated API.
export const INITIAL_MEMBERS: Member[] = [];
export const INITIAL_EVENTS: GroupEvent[] = [];
export const INITIAL_PHOTO_REQUESTS: PhotoApprovalRequest[] = [];
export const INITIAL_ACTIVITY_LOGS: ActivityLog[] = [];
export const INITIAL_KNOWLEDGE_BASE: KnowledgeBaseArticle[] = [];
