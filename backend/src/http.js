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

export function numberInRange(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum
    ? number
    : fallback;
}

export function stringArray(value, maximumItems = 20, maximumLength = 80) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => requiredText(item, maximumLength))
        .filter(Boolean),
    ),
  ].slice(0, maximumItems);
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
