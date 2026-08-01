import { randomUUID } from "node:crypto";

export function sendError(response, status, code, message, fields) {
  response.status(status).json({
    error: {
      code,
      message,
      ...(fields ? { fields } : {}),
    },
  });
}

export function requiredText(value, maximumLength = 200) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maximumLength);
}

export function optionalText(value, maximumLength = 2000) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

export function validEmail(value) {
  return (
    typeof value === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  );
}

export function validHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function numberInRange(value, minimum, maximum, fallback) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && !value.trim()) ||
    typeof value === "boolean"
  ) {
    return fallback;
  }
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? number
    : fallback;
}

export function stringArray(value, maximumItems = 20, maximumLength = 80) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (const item of value) {
    const text = requiredText(item, maximumLength)
      .normalize("NFKC")
      .replace(/\s+/g, " ");
    const key = text.toLocaleLowerCase("en");
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length === maximumItems) break;
  }
  return result;
}

export function createId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

export function createSlug(value) {
  return requiredText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
}
