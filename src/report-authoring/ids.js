import crypto from "node:crypto";

function sanitizeFragment(value) {
  return String(value || "")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 40);
}

export function createId(length = 20) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

export function createPageName(preferredName) {
  const sanitized = sanitizeFragment(preferredName);
  return sanitized ? sanitized : `ReportSection${createId(20)}`;
}

export function createVisualName(preferredName) {
  const sanitized = sanitizeFragment(preferredName);
  return sanitized ? sanitized : createId(20);
}

export function createBookmarkName(preferredName) {
  const sanitized = sanitizeFragment(preferredName);
  return sanitized ? sanitized : createId(20);
}

export function createBookmarkGroupName(preferredName) {
  const sanitized = sanitizeFragment(preferredName);
  return sanitized ? sanitized : `BookmarkGroup_${createId(12)}`;
}
