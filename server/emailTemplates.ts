import { ParsedCelebrant } from "./birthdayService";

const LOGO_URL = "https://team-taraba-river.web.app/apple-touch-icon.png";
const PRIMARY_COLOR = "#0f766e"; // Teal
const APP_NAME = "Team Taraba River";

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

function getBaseEmailLayout(subject: string, title: string, preheader: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; -webkit-font-smoothing: antialiased; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f1f5f9; padding-bottom: 60px; }
    .main { margin: 0 auto; width: 100%; max-width: 600px; padding: 32px 20px; }
    .header { text-align: center; padding-bottom: 24px; }
    .header img { height: 48px; width: 48px; object-fit: contain; }
    .header h2 { margin: 12px 0 0 0; font-size: 16px; font-weight: 600; color: #475569; letter-spacing: 0.5px; }
    .card { background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); overflow: hidden; }
    .card-body { padding: 32px; }
    .title { margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #0f172a; }
    .content { font-size: 15px; line-height: 1.6; color: #475569; }
    .footer { text-align: center; padding-top: 32px; font-size: 12px; color: #94a3b8; line-height: 1.5; }
    .list-item { margin-bottom: 12px; font-size: 15px; }
    .list-item-title { font-weight: 600; color: #0f172a; }
    .list-item-subtitle { font-size: 14px; color: #64748b; margin-left: 8px; }
    .btn { display: inline-block; padding: 10px 20px; background-color: ${PRIMARY_COLOR}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; text-align: center; margin-top: 24px; }
  </style>
</head>
<body>
  <!-- Preheader text for email clients -->
  <div style="display: none; max-height: 0px; overflow: hidden;">${preheader}</div>
  <table class="wrapper" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center">
        <table class="main" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td class="header">
              <img src="${LOGO_URL}" alt="${APP_NAME} Logo">
              <h2>${APP_NAME}</h2>
            </td>
          </tr>
          <tr>
            <td>
              <table class="card" width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td class="card-body">
                    <h1 class="title">${title}</h1>
                    <div class="content">
                      ${content}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="footer">
              <p style="margin: 0;">This is an automated notification from the ${APP_NAME} Admin System.</p>
              <p style="margin: 4px 0 0 0;">Please do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Builds the Monthly Advance Birthday Digest Email.
 */
export function buildMonthlyDigestEmailHtml(params: {
  monthName: string;
  year: number;
  celebrants: ParsedCelebrant[];
  adminRecipientEmail: string;
}): { subject: string; html: string; text: string } {
  const { monthName, year, celebrants } = params;
  const count = celebrants.length;
  
  const subject = `[Team Taraba] Upcoming Birthdays for ${monthName} ${year}`;
  const preheader = `Summary of upcoming birthdays in ${monthName}.`;
  const title = `Birthdays in ${monthName} ${year}`;
  
  const itemsHtml = celebrants.length > 0 
    ? celebrants.map(c => `
      <div class="list-item">
        <span class="list-item-title">🎉 ${formatMemberName(c)}</span>
        <span class="list-item-subtitle">— ${monthName} ${c.day}</span>
      </div>
    `).join("")
    : `<p>There are no members celebrating birthdays in ${monthName}.</p>`;

  const content = `
    <p>Hello Admin,</p>
    <p>Here is the monthly summary of upcoming member birthdays for <strong>${monthName} ${year}</strong> (${count} member${count !== 1 ? 's' : ''}):</p>
    <div style="margin: 24px 0;">
      ${itemsHtml}
    </div>
    <p>Please use this list to prepare any general announcements or recognitions for the team group.</p>
    <a href="https://team-taraba-river.web.app/" class="btn">Go to Dashboard</a>
  `;

  const html = getBaseEmailLayout(subject, title, preheader, content);

  const text = `
Team Taraba River — Monthly Birthday Digest
Upcoming Celebrants for ${monthName} ${year} (${count} Members):

${celebrants.map((c, i) => `${i + 1}. ${formatMemberName(c)} — ${monthName} ${c.day}`).join("\n")}

Admin reminder for general team group notice.
  `.trim();

  return { subject, html, text };
}

/**
 * Builds the 8 PM Eve Alert Email.
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
    ? `[Team Taraba] Birthday Tomorrow: ${formatMemberName(celebrants[0])}`
    : `[Team Taraba] Birthday Tomorrow Reminder (${count} members)`;
    
  const preheader = `Action required: Prepare birthday announcements for tomorrow.`;
  const title = `Birthday Eve Reminder`;

  const itemsHtml = celebrants.length > 0 
    ? celebrants.map(c => `
      <div class="list-item">
        <span class="list-item-title">🎉 ${formatMemberName(c)}</span>
        <span class="list-item-subtitle">— Tomorrow, ${dayName}, ${dateStr}</span>
      </div>
    `).join("")
    : `<p>There are no celebrants tomorrow.</p>`;

  const content = `
    <p>Hello Admin,</p>
    <p>This is your 8:00 PM Eve Reminder. The following member${count !== 1 ? 's are' : ' is'} celebrating a birthday tomorrow, <strong>${dayName}, ${dateStr}</strong>:</p>
    <div style="margin: 24px 0;">
      ${itemsHtml}
    </div>
    <p>Please ensure that birthday graphics and announcements are ready to be posted in the morning.</p>
    <a href="https://team-taraba-river.web.app/" class="btn">View Profiles</a>
  `;

  const html = getBaseEmailLayout(subject, title, preheader, content);

  const text = `
Team Taraba River — Birthday Tomorrow Reminder
Date: ${dayName}, ${dateStr}

${celebrants.map((c, i) => `${i + 1}. ${formatMemberName(c)} — ${dayName}, ${dateStr}`).join("\n")}

Please prepare announcements.
  `.trim();

  return { subject, html, text };
}

/**
 * Builds the 6 AM D-Day Alert Email.
 */
export function buildDailyDDayAlertEmailHtml(params: {
  todayDate: Date;
  celebrants: ParsedCelebrant[];
  adminRecipientEmail: string;
}): { subject: string; html: string; text: string } {
  const { todayDate, celebrants } = params;
  const count = celebrants.length;
  const dayName = todayDate.toLocaleDateString("en-US", { weekday: "long" });
  const dateStr = todayDate.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  const subject = count === 1
    ? `[Team Taraba] ACTION REQUIRED: It's ${formatMemberName(celebrants[0])}'s Birthday Today!`
    : `[Team Taraba] ACTION REQUIRED: ${count} Birthdays Today!`;
    
  const preheader = `Action required: Post birthday announcements to the team group now.`;
  const title = `It's Birthday Time! 🎂`;

  const itemsHtml = celebrants.length > 0 
    ? celebrants.map(c => `
      <div class="list-item">
        <span class="list-item-title">🎉 ${formatMemberName(c)}</span>
        <span class="list-item-subtitle">— Today, ${dayName}, ${dateStr}</span>
      </div>
    `).join("")
    : `<p>There are no celebrants today.</p>`;

  const content = `
    <p>Hello Admin,</p>
    <p>This is your 6:00 AM Action Alert. Today is <strong>${dayName}, ${dateStr}</strong> and we have birthday${count !== 1 ? 's' : ''} to celebrate!</p>
    <div style="margin: 24px 0;">
      ${itemsHtml}
    </div>
    <p><strong>Action Required:</strong> Please proceed to make the official birthday announcements on the general team group right away.</p>
    <a href="https://team-taraba-river.web.app/" class="btn">View Dashboard</a>
  `;

  const html = getBaseEmailLayout(subject, title, preheader, content);

  const text = `
Team Taraba River — Action Required: Birthdays Today!
Date: ${dayName}, ${dateStr}

${celebrants.map((c, i) => `${i + 1}. ${formatMemberName(c)}`).join("\n")}

Please make the official announcements on the group now.
  `.trim();

  return { subject, html, text };
}

/**
 * Builds a verification test email.
 */
export function buildTestEmailHtml(recipientEmail: string): { subject: string; html: string; text: string } {
  const subject = `[Team Taraba] Birthday Alerts Connected`;
  const title = `System Connected`;
  const preheader = `Your birthday alert settings have been verified.`;

  const content = `
    <p>Hello Admin,</p>
    <p>This email confirms that the Admin Birthday Alerts system is properly connected and active for <strong>${sanitizeText(recipientEmail)}</strong>.</p>
    <p>You will now receive the following automated schedules:</p>
    <div style="margin: 24px 0;">
      <div class="list-item">
        <span class="list-item-title">🎉 Monthly Digest</span>
        <span class="list-item-subtitle">— 1st of every month summarizing upcoming celebrants</span>
      </div>
      <div class="list-item">
        <span class="list-item-title">🎉 Eve Alert (8:00 PM)</span>
        <span class="list-item-subtitle">— Reminder to prepare announcements for tomorrow</span>
      </div>
      <div class="list-item">
        <span class="list-item-title">🎉 D-Day Alert (6:00 AM)</span>
        <span class="list-item-subtitle">— Final reminder to post the announcement today</span>
      </div>
    </div>
    <p>Thank you for keeping Team Taraba River organized!</p>
  `;

  const html = getBaseEmailLayout(subject, title, preheader, content);
  const text = `Birthday Reminder System Connected for ${recipientEmail}.`;
  
  return { subject, html, text };
}
