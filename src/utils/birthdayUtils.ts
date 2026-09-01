import { Member } from "../types";

export interface ParsedCelebrant {
  member: Member;
  day: number;
  month: number; // 1-12
  monthName: string;
  formattedDate: string; // e.g. "Sep 15"
  daysUntil: number; // 0 = today, 1 = tomorrow, etc.
}

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const MONTH_ABBRS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

/**
 * Normalizes and extracts (day, month) from various birthday strings.
 */
export function parseMemberBirthday(
  dobString?: string | null,
  birthDay?: string | null,
  birthMonth?: string | null
): { day: number; month: number } | null {
  // 1. If explicit birthDay and birthMonth are provided
  if (birthDay && birthMonth) {
    const d = parseInt(String(birthDay).trim(), 10);
    const mStr = String(birthMonth).trim().toLowerCase();
    let m = parseInt(mStr, 10);

    if (isNaN(m) || m < 1 || m > 12) {
      const foundIdx = MONTH_NAMES.findIndex(
        (name) => name.toLowerCase() === mStr || name.toLowerCase().startsWith(mStr.slice(0, 3))
      );
      if (foundIdx !== -1) {
        m = foundIdx + 1;
      }
    }

    if (!isNaN(d) && d >= 1 && d <= 31 && !isNaN(m) && m >= 1 && m <= 12) {
      return { day: d, month: m };
    }
  }

  if (!dobString || typeof dobString !== "string") return null;

  const cleanDob = dobString.trim();
  if (!cleanDob) return null;

  // 2. Format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = cleanDob.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { day: d, month: m };
  }

  // 3. Format: DD/MM/YYYY or DD-MM-YYYY or DD-MM
  const dmyMatch = cleanDob.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/]\d{2,4})?$/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return { day: d, month: m };
  }

  // 4. Format: "15, August" or "15 August" or "August 15" or "15th August"
  const wordMatch1 = cleanDob.match(/(\d{1,2})(?:st|nd|rd|th)?[\s,]+([a-zA-Z]+)/i);
  if (wordMatch1) {
    const d = parseInt(wordMatch1[1], 10);
    const mName = wordMatch1[2].toLowerCase();
    const foundIdx = MONTH_NAMES.findIndex(
      (name) => name.toLowerCase() === mName || name.toLowerCase().startsWith(mName.slice(0, 3))
    );
    if (foundIdx !== -1 && d >= 1 && d <= 31) {
      return { day: d, month: foundIdx + 1 };
    }
  }

  const wordMatch2 = cleanDob.match(/([a-zA-Z]+)[\s,]+(\d{1,2})(?:st|nd|rd|th)?/i);
  if (wordMatch2) {
    const mName = wordMatch2[1].toLowerCase();
    const d = parseInt(wordMatch2[2], 10);
    const foundIdx = MONTH_NAMES.findIndex(
      (name) => name.toLowerCase() === mName || name.toLowerCase().startsWith(mName.slice(0, 3))
    );
    if (foundIdx !== -1 && d >= 1 && d <= 31) {
      return { day: d, month: foundIdx + 1 };
    }
  }

  return null;
}

export function getWATDate(baseDate: Date = new Date()): Date {
  const utc = baseDate.getTime() + baseDate.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000); // UTC+1
}

export function getCelebrantsForMonth(
  targetMonth: number,
  members: Member[]
): ParsedCelebrant[] {
  const celebrants: ParsedCelebrant[] = [];

  for (const m of members) {
    const raw = m as any;
    const parsed = parseMemberBirthday(m.dateOfBirth, raw.birthDay, raw.birthMonth);
    if (parsed && parsed.month === targetMonth) {
      celebrants.push({
        member: m,
        day: parsed.day,
        month: parsed.month,
        monthName: MONTH_NAMES[parsed.month - 1],
        formattedDate: `${MONTH_ABBRS[parsed.month - 1]} ${parsed.day}`,
        daysUntil: 0,
      });
    }
  }

  return celebrants.sort((a, b) => a.day - b.day);
}

export function getUpcomingNextMonthCelebrants(
  members: Member[],
  currentDate: Date = getWATDate()
): { nextMonth: number; nextMonthName: string; year: number; celebrants: ParsedCelebrant[] } {
  const curMonth = currentDate.getMonth() + 1; // 1-12
  const curYear = currentDate.getFullYear();

  let nextMonth = curMonth + 1;
  let targetYear = curYear;
  if (nextMonth > 12) {
    nextMonth = 1;
    targetYear += 1;
  }

  const nextMonthName = MONTH_NAMES[nextMonth - 1];
  const celebrants = getCelebrantsForMonth(nextMonth, members);

  return {
    nextMonth,
    nextMonthName,
    year: targetYear,
    celebrants,
  };
}

export function getTomorrowCelebrants(
  members: Member[],
  currentDate: Date = getWATDate()
): { tomorrowDate: Date; celebrants: ParsedCelebrant[] } {
  const tomorrow = new Date(currentDate);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tDay = tomorrow.getDate();
  const tMonth = tomorrow.getMonth() + 1; // 1-12

  const celebrants: ParsedCelebrant[] = [];

  for (const m of members) {
    const raw = m as any;
    const parsed = parseMemberBirthday(m.dateOfBirth, raw.birthDay, raw.birthMonth);
    if (parsed && parsed.day === tDay && parsed.month === tMonth) {
      celebrants.push({
        member: m,
        day: parsed.day,
        month: parsed.month,
        monthName: MONTH_NAMES[parsed.month - 1],
        formattedDate: `${MONTH_ABBRS[parsed.month - 1]} ${parsed.day}`,
        daysUntil: 1,
      });
    }
  }

  return {
    tomorrowDate: tomorrow,
    celebrants,
  };
}

function sanitizeText(str?: string | null): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cleanPhoneForWhatsApp(phone?: string | null): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) {
    digits = "234" + digits.slice(1);
  }
  return digits;
}

function formatMemberName(c: ParsedCelebrant): string {
  const m = c.member;
  const fullName = (m.fullName || `${m.firstName || ""} ${m.surname || ""}`).trim();
  return sanitizeText(fullName) || "Member";
}

export function buildMonthlyDigestEmailHtml(params: {
  monthName: string;
  year: number;
  celebrants: ParsedCelebrant[];
  adminRecipientEmail: string;
}): { subject: string; html: string; text: string } {
  const { monthName, year, celebrants } = params;
  const count = celebrants.length;
  const subject = `[Team Taraba] Upcoming Birthday Celebrants for ${monthName} ${year}`;

  const celebrantListItems = celebrants.length > 0
    ? celebrants
        .map((c) => {
          const name = formatMemberName(c);
          return `<li style="margin-bottom: 8px;"><strong>${name}</strong> — ${monthName} ${c.day}</li>`;
        })
        .join("\n")
    : `<li style="color: #64748b;">No celebrants listed for this month.</li>`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <tr>
          <td style="padding: 24px 28px; border-bottom: 2px solid #0f766e;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #0f766e; margin-bottom: 4px;">
              Team Taraba River
            </div>
            <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">
              Birthday Reminder Notice — ${monthName} ${year}
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px 28px;">
            <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.5;">
              Upcoming birthday celebrants for <strong>${monthName} ${year}</strong> (${count} member${count !== 1 ? "s" : ""}):
            </p>
            <ol style="margin: 0 0 20px 0; padding-left: 20px; font-size: 15px; line-height: 2.2; color: #0f172a;">
              ${celebrantListItems}
            </ol>
            <p style="margin: 20px 0 0 0; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b; line-height: 1.5;">
              Admin reminder for preparing announcements to the general team group.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
Team Taraba River — Birthday Reminder Notice
Upcoming Celebrants for ${monthName} ${year} (${count} Members):

${celebrants.map((c, i) => `${i + 1}. ${formatMemberName(c)} — ${monthName} ${c.day}`).join("\n")}

Admin reminder for general team group notice.
  `.trim();

  return { subject, html, text };
}

export function buildDailyEveAlertEmailHtml(params: {
  tomorrowDate: Date;
  celebrants: ParsedCelebrant[];
  adminRecipientEmail: string;
}): { subject: string; html: string; text: string } {
  const { tomorrowDate, celebrants } = params;
  const count = celebrants.length;
  const dayName = tomorrowDate.toLocaleDateString("en-US", { weekday: "long" });
  const dateStr = tomorrowDate.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  const subject = count === 1
    ? `[Team Taraba] Birthday Tomorrow: ${formatMemberName(celebrants[0])} (${dayName}, ${dateStr})`
    : `[Team Taraba] Birthday Tomorrow Reminder (${dayName}, ${dateStr})`;

  const celebrantListItems = celebrants.length > 0
    ? celebrants
        .map((c) => {
          const name = formatMemberName(c);
          return `<li style="margin-bottom: 8px;"><strong>${name}</strong> — ${dayName}, ${dateStr}</li>`;
        })
        .join("\n")
    : `<li style="color: #64748b;">No celebrants listed for tomorrow.</li>`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <tr>
          <td style="padding: 24px 28px; border-bottom: 2px solid #d97706;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #d97706; margin-bottom: 4px;">
              Team Taraba River
            </div>
            <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a;">
              Birthday Tomorrow Reminder — ${dayName}, ${dateStr}
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px 28px;">
            <p style="margin: 0 0 16px 0; font-size: 14px; color: #475569; line-height: 1.5;">
              Member${count !== 1 ? "s" : ""} celebrating birthday tomorrow, <strong>${dayName}, ${dateStr}</strong>:
            </p>
            <ol style="margin: 0 0 20px 0; padding-left: 20px; font-size: 15px; line-height: 2.2; color: #0f172a;">
              ${celebrantListItems}
            </ol>
            <p style="margin: 20px 0 0 0; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b; line-height: 1.5;">
              Admin reminder for preparing birthday notice to the general team group.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
Team Taraba River — Birthday Tomorrow Reminder
Date: ${dayName}, ${dateStr}

${celebrants.map((c, i) => `${i + 1}. ${formatMemberName(c)} — ${dayName}, ${dateStr}`).join("\n")}

Admin reminder for general team group notice.
  `.trim();

  return { subject, html, text };
}

export function buildTestEmailHtml(recipientEmail: string): { subject: string; html: string; text: string } {
  const subject = `[Team Taraba] Birthday Reminder System Connected`;
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:24px;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
      <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px 28px;border:1px solid #e2e8f0;">
        <h2 style="margin:0 0 12px 0;font-size:17px;color:#0f766e;">Birthday Reminder System Connected</h2>
        <p style="margin:0 0 14px 0;font-size:14px;color:#475569;line-height:1.5;">
          Email reminder notifications are active for <strong>${sanitizeText(recipientEmail)}</strong>.
        </p>
        <ul style="margin:0 0 16px 0;padding-left:18px;font-size:13px;line-height:1.8;color:#334155;">
          <li>Monthly Digest: 12:00 PM WAT on last day of each month.</li>
          <li>24-Hour Eve Alert: 12:00 PM WAT on day before each birthday.</li>
        </ul>
        <p style="margin:16px 0 0 0;padding-top:12px;border-top:1px solid #f1f5f9;font-size:11px;color:#94a3b8;">
          Team Taraba River Executive Notification System
        </p>
      </div>
    </body>
    </html>
  `;
  const text = `Birthday Reminder System Connected for ${recipientEmail}.`;
  return { subject, html, text };
}

export async function sendEmailViaResend(params: {
  apiKey: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  sender?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const key = params.apiKey.trim();
    if (!key) {
      return { success: false, error: "Resend API Key is required." };
    }

    const sender = params.sender || "Team Taraba River <onboarding@resend.dev>";
    const payload = {
      from: sender,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text || "",
    };

    let res: Response;
    try {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // Fallback for browsers: proxy through CORS relay
      res = await fetch(`https://corsproxy.io/?url=${encodeURIComponent("https://api.resend.com/emails")}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data.message || data.error?.message || `Resend error HTTP ${res.status}`;
      return { success: false, error: errMsg };
    }

    return {
      success: true,
      messageId: data.id,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || String(err),
    };
  }
}
