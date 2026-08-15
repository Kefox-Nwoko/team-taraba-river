import { z } from 'zod';

/**
 * Validation schemas for all mutable API endpoints.
 * Using Zod v4 for runtime type-checking and input sanitization.
 */

// --- Member Schemas ---

export const MemberRegistrationSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(200),
  email: z.string().email('Invalid email address'),
  phoneNumber: z.string().min(7, 'Phone number must be at least 7 digits').max(20),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  occupation: z.string().min(1, 'Occupation is required').max(200),
  skills: z.union([
    z.array(z.string()),
    z.string().transform(s => s.split(',').map(v => v.trim()).filter(Boolean))
  ]).optional().default(['Community Support']),
  photoUrl: z.string().min(1, 'Profile photo is required'),
  // Extended CSV fields
  title: z.string().min(1, 'Title is required').max(20),
  firstName: z.string().min(1, 'First name is required').max(100),
  surname: z.string().min(1, 'Surname is required').max(100),
  whatsappNumber: z.string().min(7, 'WhatsApp number is required').max(20),
  gradYear: z.union([z.string().min(1, 'Graduation year is required'), z.number()]),
  schoolName: z.string().min(1, 'School name is required').max(200),
  maritalStatus: z.string().max(20).optional().or(z.literal('')),
  jerseySize: z.string().min(1, 'Jersey size is required').max(10),
  estateName: z.string().min(1, 'Estate name is required').max(200),
  area: z.string().min(1, 'Area is required').max(200),
  otherArea: z.string().max(200).optional().or(z.literal('')),
  streetName: z.string().min(1, 'Street name is required').max(300),
  closestNeighborName: z.string().min(1, 'Closest neighbor name is required').max(200),
  closestNeighborPhone: z.string().min(7, 'Closest neighbor phone is required').max(20),
  nextOfKinName: z.string().min(1, 'Next of kin name is required').max(200),
  nextOfKinPhone: z.string().min(7, 'Next of kin phone is required').max(20),
});

export const MemberUpdateSchema = MemberRegistrationSchema.partial();

// --- Event Schemas ---

export const EventCreationSchema = z.object({
  title: z.string().min(2, 'Event title is required').max(300),
  description: z.string().max(2000).optional().default('Group activity organized by Team Taraba River.'),
  date: z.string().min(1, 'Event date is required'),
  time: z.string().optional().default('09:00'),
  location: z.string().min(2, 'Event location is required').max(300),
  category: z.enum(['cleanup', 'meeting', 'workshop', 'celebration', 'sports', 'outreach']).optional().default('meeting'),
  driveImageUrls: z.array(z.string().url()).optional().default([]),
  driveFolderId: z.string().max(200).optional(),
  youtubeVideoUrl: z.string().optional().default(''),
  youtubeTitle: z.string().max(300).optional(),
  createdBy: z.string().max(200).optional().default('Team Member'),
  createdById: z.string().optional(),
  maxCapacity: z.number().int().positive().optional().default(100),
});

// --- Approval Schemas ---

export const ApprovalDecisionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  adminNotes: z.string().max(500).optional().default(''),
});

// --- RSVP Schema ---

export const RSVPSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
  status: z.enum(['attending', 'maybe', 'declined']),
});

// --- AI Query Schema ---

export const AIQuerySchema = z.object({
  userQuery: z.string().min(1, 'Query prompt is required').max(2000),
  userContext: z.object({
    memberId: z.string().optional(),
    role: z.enum(['member', 'admin']).optional(),
  }).optional(),
});

// --- Media Schemas ---

export const DriveSyncSchema = z.object({
  driveUrl: z.string().url('A valid Google Drive URL is required'),
});

export const YouTubeParseSchema = z.object({
  url: z.string().url('A valid YouTube URL is required'),
});

// --- Auth Schema ---

export const LoginCredentialSchema = z.object({
  credential: z.string().min(1, 'Email or Phone number is required'),
});

// --- Admin AI Search Schema ---

export const AdminAISearchSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(500),
});

// --- Media Pipeline Schemas ---

export const MediaUploadSchema = z.object({
  eventId: z.string().min(1, 'eventId is required'),
  type: z.enum(['photo', 'video']),
  base64Data: z.string().min(1, 'base64Data is required'),
  mimeType: z.string().min(1, 'mimeType is required'),
  fileName: z.string().optional(),
  storageTarget: z.enum(['drive', 'youtube']).optional().default('drive'),
});

export const MediaFinalizeSchema = z.object({
  mediaId: z.string().min(1, 'mediaId is required'),
});

export const MediaStatusSchema = z.object({
  mediaId: z.string().min(1, 'mediaId is required'),
});

/**
 * Helper to validate request body against a schema.
 * Returns the parsed data or a formatted error string.
 */
export function validateBody<T>(schema: z.ZodType<T>, body: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issues = result.error.issues || [];
    const messages = issues.map((e: any) => `${(e.path || []).join('.')}: ${e.message}`).join('; ');
    return { success: false, error: messages || 'Validation failed' };
  }
  return { success: true, data: result.data };
}
