export type UserRole = "member" | "admin";
export type PhotoApprovalStatus = "approved" | "pending" | "rejected";

export interface Member {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string; // YYYY-MM-DD
  occupation: string;
  skills: string[];
  photoUrl: string;
  photoStatus: PhotoApprovalStatus;
  rejectionReason?: string;
  role: UserRole;
  activityPoints: number;
  joinedAt: string; // ISO String
  lastActive: string; // ISO String
  title?: string;
  firstName?: string;
  surname?: string;
  whatsappNumber?: string;
  gradYear?: string | number;
  schoolName?: string;
  maritalStatus?: string;
  jerseySize?: string;
  estateName?: string;
  area?: string;
  otherArea?: string;
  streetName?: string;
  closestNeighborName?: string;
  closestNeighborPhone?: string;
  nextOfKinName?: string;
  nextOfKinPhone?: string;
  isGoogleAuth?: boolean;
}

export interface GroupEvent {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  location: string;
  category: string;
  driveImageUrls: string[]; // Google Drive links or direct image URLs
  driveFolderId?: string;
  youtubeVideoUrl?: string; // YouTube video link or video ID
  youtubeTitle?: string;
  createdBy: string; // Member Name
  createdById: string; // Member ID
  attendeeIds: string[]; // List of member IDs attending (Yes)
  maybeIds?: string[]; // List of member IDs who selected Maybe
  declinedIds?: string[]; // List of member IDs who declined (No)
  maxCapacity?: number;
  createdAt: string;
}

export interface PhotoApprovalRequest {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  photoUrl: string;
  uploadedAt: string;
  status: PhotoApprovalStatus;
  adminNotes?: string;
  title?: string;
}

export interface ActivityLog {
  id: string;
  memberId: string;
  memberName: string;
  action: string;
  timestamp: string;
  pointsEarned: number;
  details?: string;
}

export interface KnowledgeBaseArticle {
  id: string;
  title: string;
  category: "membership" | "events" | "drive_videos" | "bylaws" | "general" | "about";
  content: string;
  tags: string[];
  updatedAt: string;
}

export interface AIQueryRequest {
  userQuery: string;
  userContext?: { memberId?: string; role?: UserRole };
}

export interface AIQueryResponse {
  intent:
    | "MEMBER_SEARCH"
    | "EVENT_INFO"
    | "MEDIA_RESOURCES"
    | "KNOWLEDGE_BASE"
    | "GENERAL_HELP";
  confidence: number;
  routedService: string;
  answer: string;
  sources: string[];
  suggestedActions: {
    label: string;
    actionType:
      "NAVIGATE_EVENTS" | "NAVIGATE_MEMBERS" | "OPEN_ASSISTANT" | "VIEW_MEDIA";
    payload?: string;
  }[];
}

export interface SystemMetrics {
  uptimeSeconds: number;
  activeConnections: number;
  dbLatencyMs: number;
  aiLatencyMs: number;
  pendingApprovalsCount: number;
  totalMembersCount: number;
  totalEventsCount: number;
  cpuUsagePercent: number;
  memoryUsageMB: number;
}

export interface TestResult {
  suiteName: string;
  testName: string;
  status: "passed" | "failed";
  durationMs: number;
  errorDetails?: string;
}
