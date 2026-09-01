import { ParsedCelebrant } from "./birthdayService";

function sanitizeText(str?: string | null): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMemberName(c: ParsedCelebrant): string {
  const m = c.member;
  const fullName = (m.fullName || `${m.firstName || ""} ${m.surname || ""}`).trim();
  return sanitizeText(fullName) || "Member";
}

/**
 * Builds the simplified Monthly Advance Birthday Digest Email.
 * Clean, simple list of celebrants for admin copy-paste notice into general group.
 */
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

/**
 * Builds the simplified Daily 24-Hour Eve Alert Email.
 * Clean, simple list of tomorrow's celebrants for admin copy-paste notice into general group.
 */
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

/**
 * Builds a verification test email.
 */
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
