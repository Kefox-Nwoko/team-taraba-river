import {
  Member,
  GroupEvent,
  PhotoApprovalRequest,
  ActivityLog,
  KnowledgeBaseArticle,
} from "../types";
import { CSV_SEED_MEMBERS } from "./csvMembers";

export const INITIAL_MEMBERS: Member[] = CSV_SEED_MEMBERS as Member[];
export const INITIAL_EVENTS: GroupEvent[] = [];
export const INITIAL_PHOTO_REQUESTS: PhotoApprovalRequest[] = [];
export const INITIAL_ACTIVITY_LOGS: ActivityLog[] = [];
export const INITIAL_KNOWLEDGE_BASE: KnowledgeBaseArticle[] = [];
