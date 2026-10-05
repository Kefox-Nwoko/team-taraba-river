#!/usr/bin/env node
// Prints a short snippet of the most recent PREVIOUS Claude Code session for
// this project: when it ended, its title, the user's last few prompts and the
// assistant's last reply. Read-only. Usage: node last-session.cjs [sessionIdToSkip]
const fs = require('fs');
const os = require('os');
const path = require('path');

const skipId = process.argv[2] || '';
const slug = process.cwd().replace(/[:\\/]/g, '-');
const root = path.join(os.homedir(), '.claude', 'projects');
// Claude Code names the folder after the working directory; the drive letter's case can differ.
const projectDir = [slug, slug.charAt(0).toLowerCase() + slug.slice(1)].map((n) => path.join(root, n)).find((d) => fs.existsSync(d));
if (!projectDir) {
  console.log('No saved sessions found for this project.');
  process.exit(0);
}
const THREE_MIN = 3 * 60 * 1000;
const files = fs
  .readdirSync(projectDir)
  .filter((f) => f.endsWith('.jsonl') && !f.startsWith(skipId || '\0'))
  .map((f) => ({ f, t: fs.statSync(path.join(projectDir, f)).mtimeMs }))
  // The session running right now keeps touching its own file; skip anything that fresh.
  .filter((x) => Date.now() - x.t > THREE_MIN)
  .sort((a, b) => b.t - a.t);

if (files.length === 0) {
  console.log('No earlier session found.');
  process.exit(0);
}

const { f, t } = files[0];
const rows = fs
  .readFileSync(path.join(projectDir, f), 'utf8')
  .split('\n')
  .map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  })
  .filter(Boolean);

const textOf = (content) =>
  typeof content === 'string'
    ? content
    : (content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');

const isRealPrompt = (s) => s && !/^\s*(<system-reminder|\[SYSTEM NOTIFICATION|<ide_|<task-notification|<command-|\[Image:|\[Request interrupted)/.test(s) && !s.includes('<system-reminder>');
const clip = (s, n) => (s.length > n ? s.slice(0, n).trim() + '…' : s.trim());

const prompts = rows
  .filter((r) => r.type === 'user' && r.message)
  .map((r) => textOf(r.message.content))
  .filter(isRealPrompt);
const lastReply = rows
  .filter((r) => r.type === 'assistant' && r.message)
  .map((r) => textOf(r.message.content))
  .filter((s) => s && s.trim().length > 40)
  .pop();
const title = rows.filter((r) => r.type === 'ai-title').map((r) => r.aiTitle || r.title).filter(Boolean).pop();

console.log(`Session ended: ${new Date(t).toISOString()}${title ? `  |  Title: ${title}` : ''}`);
console.log('\nYour last messages:');
for (const p of prompts.slice(-3)) console.log(`  - ${clip(p, 280)}`);
console.log('\nMy last reply:');
console.log(`  ${clip(lastReply || '(none)', 700).replace(/\n/g, '\n  ')}`);
