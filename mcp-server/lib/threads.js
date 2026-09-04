import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const THREADS_DIR = path.join(__dirname, "..", "..", "wiki", "threads");

function slugify(str) {
  if (!str) return "default";
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

function formatTimestamp(date) {
  return date.toISOString().replace("T", " ").substring(0, 19);
}

function ensureThreadsDir() {
  if (!fs.existsSync(THREADS_DIR)) {
    fs.mkdirSync(THREADS_DIR, { recursive: true });
  }
}

function getThreadFilePath(userName, threadName, date) {
  const dateStr = formatDate(date);
  const userPart = slugify(userName);
  const threadPart = slugify(threadName);
  return path.join(THREADS_DIR, `${userPart}-${threadPart}-${dateStr}.md`);
}

function deriveThreadName(userPrompt) {
  const clean = userPrompt.trim().replace(/[^\w\s-]/g, " ").split(/\s+/).filter(Boolean);
  const words = clean.slice(0, 6).join("-").toLowerCase();
  return words || "conversation";
}

function parseFrontmatter(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fmMatch) return { data: {}, body: content };
  const data = {};
  for (const line of fmMatch[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    data[key] = val;
  }
  return { data, body: content.slice(fmMatch[0].length) };
}

function updateFrontmatterTimestamp(filePath, date) {
  const content = fs.readFileSync(filePath, "utf-8");
  const { data, body } = parseFrontmatter(content);
  data.updated = formatDate(date);
  const fmLines = Object.entries(data).map(([k, v]) => `${k}: ${v}`);
  const newContent = `---\n${fmLines.join("\n")}\n---\n${body}`;
  fs.writeFileSync(filePath, newContent, "utf-8");
}

export function saveThreadMessage({ userName = "claude-user", threadName, userPrompt, aiResponse }) {
  ensureThreadsDir();
  const date = new Date();
  const resolvedThreadName = threadName || deriveThreadName(userPrompt);
  const filePath = getThreadFilePath(userName, resolvedThreadName, date);
  const existed = fs.existsSync(filePath);

  const entry = `
---

## ${formatTimestamp(date)}

### User (${userName}):
${userPrompt}

### Assistant:
${aiResponse}
`;

  if (!existed) {
    const frontmatter = `---
user_name: ${userName}
thread_name: ${resolvedThreadName}
created: ${formatDate(date)}
updated: ${formatDate(date)}
---

# ${userName} - ${resolvedThreadName}

## Conversation Start

`;
    fs.writeFileSync(filePath, frontmatter, "utf-8");
    fs.appendFileSync(filePath, entry.trimStart() + "\n", "utf-8");
  } else {
    fs.appendFileSync(filePath, entry, "utf-8");
    updateFrontmatterTimestamp(filePath, date);
  }

  return {
    filePath: path.relative(path.join(__dirname, "..", ".."), filePath),
    threadName: resolvedThreadName,
    isNew: !existed,
  };
}

export function getThread(threadName, userName) {
  ensureThreadsDir();
  if (!fs.existsSync(THREADS_DIR)) return null;

  const files = fs.readdirSync(THREADS_DIR).filter((f) => f.endsWith(".md"));
  const userPart = slugify(userName || "claude-user");
  const threadPart = slugify(threadName);

  const matches = files.filter((f) => {
    if (!f.startsWith(userPart + "-")) return false;
    if (!f.includes(threadPart)) return false;
    return true;
  });

  matches.sort((a, b) => {
    const statA = fs.statSync(path.join(THREADS_DIR, a));
    const statB = fs.statSync(path.join(THREADS_DIR, b));
    return statB.mtime.getTime() - statA.mtime.getTime();
  });

  if (matches.length === 0) return null;

  const fileName = matches[0];
  const content = fs.readFileSync(path.join(THREADS_DIR, fileName), "utf-8");
  return { fileName, content };
}

export function listThreads(userName) {
  ensureThreadsDir();
  if (!fs.existsSync(THREADS_DIR)) return [];

  const files = fs.readdirSync(THREADS_DIR).filter((f) => f.endsWith(".md"));
  const userPart = slugify(userName || "claude-user");

  const filtered = files.filter((f) => {
    if (userName) {
      return f.startsWith(userPart + "-");
    }
    return true;
  });

  return filtered
    .map((f) => {
      const stat = fs.statSync(path.join(THREADS_DIR, f));
      const { data } = parseFrontmatter(fs.readFileSync(path.join(THREADS_DIR, f), "utf-8"));
      const dateMatch = f.match(/-(\d{4}-\d{2}-\d{2})\.md$/);
      return {
        fileName: f,
        threadName: data.thread_name || f,
        userName: data.user_name || "claude-user",
        date: data.created || (dateMatch ? dateMatch[1] : null),
        updated: data.updated || null,
        size: stat.size,
        mtime: stat.mtime,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
