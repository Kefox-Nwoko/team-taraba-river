import { db, isFirestoreAvailable } from "./firebaseAdmin";
import { serverLogger } from "./logger";

export interface EmailConfig {
  recipientEmail: string;
  resendApiKey?: string;
  senderEmail?: string;
  enabled: boolean;
}

const DEFAULT_CONFIG: EmailConfig = {
  recipientEmail: process.env.ADMIN_NOTIFICATION_EMAIL || "tarabateam@gmail.com",
  resendApiKey: process.env.RESEND_API_KEY || "",
  senderEmail: process.env.SENDER_EMAIL || "Team Taraba River <onboarding@resend.dev>",
  enabled: true,
};

let inMemoryConfig: EmailConfig = { ...DEFAULT_CONFIG };

/**
 * Retrieve current email configuration from Firestore or memory.
 */
export async function getEmailConfig(): Promise<EmailConfig> {
  try {
    if (isFirestoreAvailable() && db) {
      const doc = await db.collection("settings").doc("email_config").get();
      if (doc.exists) {
        const data = doc.data() as Partial<EmailConfig>;
        return {
          recipientEmail: data.recipientEmail || inMemoryConfig.recipientEmail,
          resendApiKey: data.resendApiKey || process.env.RESEND_API_KEY || inMemoryConfig.resendApiKey || "",
          senderEmail: data.senderEmail || inMemoryConfig.senderEmail,
          enabled: data.enabled !== undefined ? data.enabled : inMemoryConfig.enabled,
        };
      }
    }
  } catch (err) {
    serverLogger.warn("[EmailService] Could not read email_config from Firestore, using memory fallback", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return inMemoryConfig;
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
  provider: "resend" | "firestore_mail" | "simulation";
  error?: string;
}

/**
 * Dispatches an email via Resend API (or fallback to Firestore / preview simulation).
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const config = await getEmailConfig();
  const recipient = params.to || config.recipientEmail || "tarabateam@gmail.com";
  const apiKey = config.resendApiKey || process.env.RESEND_API_KEY;

  if (!config.enabled) {
    serverLogger.info("[EmailService] Email dispatch skipped (service is disabled)");
    return {
      success: false,
      provider: "simulation",
      error: "Email service is disabled in settings.",
    };
  }

  // 1. If Resend API Key is available, dispatch via Resend REST API
  if (apiKey) {
    try {
      const sender = config.senderEmail || "Team Taraba River <onboarding@resend.dev>";
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: sender,
          to: [recipient],
          subject: params.subject,
          html: params.html,
          text: params.text || "",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error?.message || `HTTP ${response.status}`);
      }

      serverLogger.info("[EmailService] ✅ Email successfully sent via Resend", {
        to: recipient,
        subject: params.subject,
        messageId: data.id,
      });

      return {
        success: true,
        messageId: data.id,
        provider: "resend",
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      serverLogger.error("[EmailService] Failed to send email via Resend", {
        error: errorMsg,
        to: recipient,
      });
      return {
        success: false,
        provider: "resend",
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
  serverLogger.info("[EmailService] ℹ️ Simulation Mode: Email rendered and logged (Add RESEND_API_KEY to send real emails)", {
    to: recipient,
    subject: params.subject,
  });

  return {
    success: true,
    messageId: `sim_${Date.now()}`,
    provider: "simulation",
  };
}
