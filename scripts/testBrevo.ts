import https from "https";
import dotenv from "dotenv";
dotenv.config();

import { getUpcomingNextMonthCelebrants, buildMonthlyDigestEmailHtml, getWATDate } from "../src/utils/birthdayUtils";
import { CSV_SEED_MEMBERS } from "../src/data/csvMembers";

const apiKey = (process.env.BREVO_API_KEY || "").trim();
if (!apiKey) {
  console.error("Error: BREVO_API_KEY environment variable is required. Set it in your .env file.");
  process.exit(1);
}

const watDate = getWATDate();
const nextMonthInfo = getUpcomingNextMonthCelebrants(CSV_SEED_MEMBERS as any, watDate);
const email = buildMonthlyDigestEmailHtml({
  monthName: nextMonthInfo.nextMonthName,
  year: nextMonthInfo.year,
  celebrants: nextMonthInfo.celebrants,
  adminRecipientEmail: "tarabateam@gmail.com",
});

console.log(`Dispatching ${nextMonthInfo.nextMonthName} ${nextMonthInfo.year} Digest (${nextMonthInfo.celebrants.length} celebrants) to tarabateam@gmail.com...`);

const postData = JSON.stringify({
  sender: { name: "Team Taraba River", email: "tarabateam@gmail.com" },
  to: [{ email: "tarabateam@gmail.com" }],
  subject: email.subject,
  htmlContent: email.html,
  textContent: email.text,
});

const options: https.RequestOptions = {
  hostname: "api.brevo.com",
  port: 443,
  path: "/v3/smtp/email",
  method: "POST",
  headers: {
    "api-key": apiKey,
    "Content-Type": "application/json",
    "accept": "application/json",
    "Content-Length": Buffer.byteLength(postData),
  },
};

const req = https.request(options, (res) => {
  let body = "";
  console.log("Status Code:", res.statusCode);
  res.setEncoding("utf8");
  res.on("data", (chunk) => {
    body += chunk;
  });
  res.on("end", () => {
    console.log("Response Body:", body);
  });
});

req.on("error", (e) => {
  console.error("Request Error:", e.message);
});

req.write(postData);
req.end();
