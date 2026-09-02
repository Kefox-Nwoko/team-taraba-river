import {
  getWATDate,
  isFirstDayOfMonth,
  getUpcomingNextMonthCelebrants,
  getTomorrowCelebrants,
  getTodayCelebrants,
} from "./birthdayService";
import {
  buildMonthlyDigestEmailHtml,
  buildDailyEveAlertEmailHtml,
  buildDailyDDayAlertEmailHtml,
} from "./emailTemplates";
import { getEmailConfig, sendEmail, SendEmailResult } from "./emailService";
import { db, isFirestoreAvailable } from "./firebaseAdmin";
import { serverLogger } from "./logger";

// In-memory set to prevent duplicate dispatches
const sentDispatches = new Set<string>();

async function hasAlreadySent(dispatchKey: string): Promise<boolean> {
  if (sentDispatches.has(dispatchKey)) return true;

  try {
    if (isFirestoreAvailable() && db) {
      const doc = await db.collection("notification_logs").doc(dispatchKey).get();
      if (doc.exists) {
        sentDispatches.add(dispatchKey);
        return true;
      }
    }
  } catch {}

  return false;
}

async function recordSentDispatch(dispatchKey: string, details: Record<string, unknown>): Promise<void> {
  sentDispatches.add(dispatchKey);
  try {
    if (isFirestoreAvailable() && db) {
      await db.collection("notification_logs").doc(dispatchKey).set({
        ...details,
        sentAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    serverLogger.warn("[BirthdayScheduler] Could not persist notification log to Firestore", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Triggers the Monthly Advance Digest for next month's celebrants.
 */
export async function triggerMonthlyDigest(force: boolean = false): Promise<SendEmailResult & { celebrantsCount: number }> {
  const watDate = getWATDate();
  const nextMonthInfo = await getUpcomingNextMonthCelebrants(watDate);
  const dispatchKey = `monthly_digest_${nextMonthInfo.year}_${nextMonthInfo.nextMonth}`;

  if (!force && (await hasAlreadySent(dispatchKey))) {
    serverLogger.info(`[BirthdayScheduler] Monthly digest for ${nextMonthInfo.nextMonthName} ${nextMonthInfo.year} already sent today.`);
    return { success: true, provider: "simulation", celebrantsCount: nextMonthInfo.celebrants.length };
  }

  const config = await getEmailConfig();
  const { subject, html, text } = buildMonthlyDigestEmailHtml({
    monthName: nextMonthInfo.nextMonthName,
    year: nextMonthInfo.year,
    celebrants: nextMonthInfo.celebrants,
    adminRecipientEmail: config.recipientEmail,
  });

  const result = await sendEmail({
    to: config.recipientEmail,
    subject,
    html,
    text,
  });

  if (result.success) {
    await recordSentDispatch(dispatchKey, {
      type: "monthly_digest",
      month: nextMonthInfo.nextMonth,
      monthName: nextMonthInfo.nextMonthName,
      year: nextMonthInfo.year,
      celebrantsCount: nextMonthInfo.celebrants.length,
      recipient: config.recipientEmail,
      provider: result.provider,
    });
  }

  return { ...result, celebrantsCount: nextMonthInfo.celebrants.length };
}

/**
 * Triggers the Daily 24-Hour Eve Alert for tomorrow's celebrants.
 */
export async function triggerDailyEveAlert(force: boolean = false): Promise<SendEmailResult & { celebrantsCount: number }> {
  const watDate = getWATDate();
  const tomorrowInfo = await getTomorrowCelebrants(watDate);
  const dateKey = watDate.toISOString().slice(0, 10);
  const dispatchKey = `daily_eve_${dateKey}`;

  if (tomorrowInfo.celebrants.length === 0) {
    serverLogger.info("[BirthdayScheduler] No celebrants tomorrow. Daily eve alert skipped.");
    return { success: true, provider: "simulation", celebrantsCount: 0 };
  }

  if (!force && (await hasAlreadySent(dispatchKey))) {
    serverLogger.info(`[BirthdayScheduler] Daily eve alert for ${dateKey} already sent today.`);
    return { success: true, provider: "simulation", celebrantsCount: tomorrowInfo.celebrants.length };
  }

  const config = await getEmailConfig();
  const { subject, html, text } = buildDailyEveAlertEmailHtml({
    tomorrowDate: tomorrowInfo.tomorrowDate,
    celebrants: tomorrowInfo.celebrants,
    adminRecipientEmail: config.recipientEmail,
  });

  const result = await sendEmail({
    to: config.recipientEmail,
    subject,
    html,
    text,
  });

  if (result.success) {
    await recordSentDispatch(dispatchKey, {
      type: "daily_eve_alert",
      targetDate: tomorrowInfo.tomorrowDate.toISOString().slice(0, 10),
      celebrantsCount: tomorrowInfo.celebrants.length,
      celebrants: tomorrowInfo.celebrants.map((c) => ({
        id: c.member.id,
        name: c.member.fullName || c.member.firstName,
      })),
      recipient: config.recipientEmail,
      provider: result.provider,
    });
  }

  return { ...result, celebrantsCount: tomorrowInfo.celebrants.length };
}

/**
 * Triggers the 6 AM D-Day Alert for today's celebrants.
 */
export async function triggerDailyDDayAlert(force: boolean = false): Promise<SendEmailResult & { celebrantsCount: number }> {
  const watDate = getWATDate();
  const todayInfo = await getTodayCelebrants(watDate);
  const dateKey = watDate.toISOString().slice(0, 10);
  const dispatchKey = `daily_dday_${dateKey}`;

  if (todayInfo.celebrants.length === 0) {
    serverLogger.info("[BirthdayScheduler] No celebrants today. Daily D-Day alert skipped.");
    return { success: true, provider: "simulation", celebrantsCount: 0 };
  }

  if (!force && (await hasAlreadySent(dispatchKey))) {
    serverLogger.info(`[BirthdayScheduler] Daily D-Day alert for ${dateKey} already sent today.`);
    return { success: true, provider: "simulation", celebrantsCount: todayInfo.celebrants.length };
  }

  const config = await getEmailConfig();
  const { subject, html, text } = buildDailyDDayAlertEmailHtml({
    todayDate: todayInfo.todayDate,
    celebrants: todayInfo.celebrants,
    adminRecipientEmail: config.recipientEmail,
  });

  const result = await sendEmail({
    to: config.recipientEmail,
    subject,
    html,
    text,
  });

  if (result.success) {
    await recordSentDispatch(dispatchKey, {
      type: "daily_dday_alert",
      targetDate: todayInfo.todayDate.toISOString().slice(0, 10),
      celebrantsCount: todayInfo.celebrants.length,
      celebrants: todayInfo.celebrants.map((c) => ({
        id: c.member.id,
        name: c.member.fullName || c.member.firstName,
      })),
      recipient: config.recipientEmail,
      provider: result.provider,
    });
  }

  return { ...result, celebrantsCount: todayInfo.celebrants.length };
}

/**
 * Main cron tick function running periodically to check for triggers.
 */
export async function checkAndRunBirthdaySchedules(): Promise<void> {
  const watDate = getWATDate();
  const hours = watDate.getHours();

  serverLogger.info(`[BirthdayScheduler] ⏰ Checking schedules... Current WAT time: ${watDate.toISOString()} (Hour: ${hours})`);

  // 1. 1st of every month for Monthly Digest (Triggered around 10 AM to avoid overlap, or anytime on the 1st)
  if (isFirstDayOfMonth(watDate) && hours === 10) {
    try {
      serverLogger.info("[BirthdayScheduler] Today is the 1st of the month (10 AM)! Triggering Monthly Advance Digest...");
      await triggerMonthlyDigest(false);
    } catch (err) {
      serverLogger.error("[BirthdayScheduler] Error running monthly digest", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 2. Daily 24-Hour Eve Alert for tomorrow's birthdays (Triggered at 20:00 / 8 PM)
  if (hours === 20) {
    try {
      serverLogger.info("[BirthdayScheduler] 8:00 PM WAT Trigger: Running daily eve alert...");
      await triggerDailyEveAlert(false);
    } catch (err) {
      serverLogger.error("[BirthdayScheduler] Error running daily eve alert", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 3. Daily D-Day Alert for today's birthdays (Triggered at 6:00 AM)
  if (hours === 6) {
    try {
      serverLogger.info("[BirthdayScheduler] 6:00 AM WAT Trigger: Running daily D-Day alert...");
      await triggerDailyDDayAlert(false);
    } catch (err) {
      serverLogger.error("[BirthdayScheduler] Error running daily D-Day alert", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

let schedulerTimer: NodeJS.Timeout | null = null;

/**
 * Initializes the background birthday scheduler.
 */
export function startBirthdayScheduler(checkIntervalMs: number = 30 * 60 * 1000): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }

  serverLogger.info("[BirthdayScheduler] 🚀 Birthday Email Reminder Scheduler initialized (checking every 30 minutes for triggers)");

  // Initial check on boot
  checkAndRunBirthdaySchedules().catch((err) => {
    serverLogger.warn("[BirthdayScheduler] Error during initial scheduler tick", {
      error: err instanceof Error ? err.message : String(err),
    });
  });

  // Periodic interval check (every 30 minutes)
  schedulerTimer = setInterval(() => {
    checkAndRunBirthdaySchedules().catch((err) => {
      serverLogger.warn("[BirthdayScheduler] Error during periodic scheduler tick", {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }, checkIntervalMs);
}

export function stopBirthdayScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
