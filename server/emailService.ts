import { db, isFirestoreAvailable } from "./firebaseAdmin";
import { serverLogger } from "./logger";

export interface EmailConfig {
  recipientEmail: string;
  apiKey?: string;
  senderEmail?: string;
  enabled: boolean;
}

const DEFAULT_SENDER = "Team Taraba River <tarabateam@gmail.com>";

const DEFAULT_CONFIG: EmailConfig = {
  recipientEmail: process.env.ADMIN_NOTIFICATION_EMAIL || "tarabateam@gmail.com",
  apiKey: process.env.BREVO_API_KEY || "",
  senderEmail: process.env.SENDER_EMAIL || DEFAULT_SENDER,
  enabled: true,
};

let inMemoryConfig: EmailConfig = { ...DEFAULT_CONFIG };

/**
 * Retrieve current email configuration from Firestore or memory.
 * Permanently enabled and locked to the organization owner: tarabateam@gmail.com
 */
export async function getEmailConfig(): Promise<EmailConfig> {
  const apiKey = process.env.BREVO_API_KEY || inMemoryConfig.apiKey || "";
  return {
    recipientEmail: "tarabateam@gmail.com",
    apiKey,
    senderEmail: process.env.SENDER_EMAIL || inMemoryConfig.senderEmail || DEFAULT_SENDER,
    enabled: true,
  };
}

/**
 * Update email configuration in Firestore and memory.
 */
export async function updateEmailConfig(updates: Partial<EmailConfig>): Promise<EmailConfig> {
  const current = await getEmailConfig();
  const updated: EmailConfig = {
    ...current,
    ...updates,
  };
  inMemoryConfig = updated;

  try {
    if (isFirestoreAvailable() && db) {
      await db.collection("settings").doc("email_config").set(updated, { merge: true });
    }
  } catch (err) {
    serverLogger.warn("[EmailService] Could not persist email_config to Firestore", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return updated;
}

export interface SendEmailParams {
  to?: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  provider: "brevo" | "firestore_mail" | "simulation";
  error?: string;
}

/**
 * Parses a "Name <email>" string (or a bare email) into Brevo's
 * `{ name, email }` sender shape.
 */
function parseSender(raw: string): { name: string; email: string } {
  const match = raw.match(/^(.*)<(.+)>$/);
  if (match) {
    return { name: match[1].trim() || "Team Taraba River", email: match[2].trim() };
  }
  return { name: "Team Taraba River", email: raw.trim() };
}

/**
 * Dispatches an email via the Brevo transactional email API (or falls back
 * to Firestore queuing / preview simulation).
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const config = await getEmailConfig();
  const recipient = params.to || config.recipientEmail || "tarabateam@gmail.com";
  const apiKey = config.apiKey || process.env.BREVO_API_KEY;

  if (!config.enabled) {
    serverLogger.info("[EmailService] Email dispatch skipped (service is disabled)");
    return {
      success: false,
      provider: "simulation",
      error: "Email service is disabled in settings.",
    };
  }

  // 1. If a Brevo API Key is available, dispatch via the Brevo REST API
  if (apiKey) {
    try {
      const sender = parseSender(config.senderEmail || DEFAULT_SENDER);
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": apiKey.trim(),
          "Content-Type": "application/json",
          "accept": "application/json",
        },
        body: JSON.stringify({
          sender,
          to: [{ email: recipient }],
          subject: params.subject,
          htmlContent: params.html,
          textContent: params.text || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      serverLogger.info("[EmailService] ✅ Email successfully sent via Brevo", {
        to: recipient,
        subject: params.subject,
        messageId: data.messageId,
      });

      return {
        success: true,
        messageId: data.messageId,
        provider: "brevo",
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      serverLogger.error("[EmailService] Failed to send email via Brevo", {
        error: errorMsg,
        to: recipient,
      });
      return {
        success: false,
        provider: "brevo",
        error: errorMsg,
      };
    }
  }

  // 2. Fallback: If Firebase Trigger Email extension is configured in Firestore
  if (isFirestoreAvailable() && db) {
    try {
      const docRef = await db.collection("mail").add({
        to: [recipient],
        message: {
          subject: params.subject,
          html: params.html,
          text: params.text || "",
        },
        createdAt: new Date().toISOString(),
      });

      serverLogger.info("[EmailService] Email queued to Firestore 'mail' collection", {
        docId: docRef.id,
        to: recipient,
      });

      return {
        success: true,
        messageId: docRef.id,
        provider: "firestore_mail",
      };
    } catch (firestoreErr) {
      serverLogger.warn("[EmailService] Could not queue email in Firestore 'mail'", {
        error: firestoreErr instanceof Error ? firestoreErr.message : String(firestoreErr),
      });
    }
  }

  // 3. Simulation mode when no API key is yet configured
  serverLogger.info("[EmailService] ℹ️ Simulation Mode: Email rendered and logged (Add BREVO_API_KEY to send real emails)", {
    to: recipient,
    subject: params.subject,
  });

  return {
    success: true,
    messageId: `sim_${Date.now()}`,
    provider: "simulation",
  };
}
