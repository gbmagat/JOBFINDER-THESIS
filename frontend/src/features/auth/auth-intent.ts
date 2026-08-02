export const AUTH_INTENT_STORAGE_KEY = "jobfinder.pending-auth-intent.v1";
export const DEFAULT_RETURN_TO = "/jobs";

const DEFAULT_ORIGIN = "https://jobfinder.local";
const UNSAFE_PATH_PREFIXES = [
  "/admin",
  "/api",
  "/employer",
  "/lgu",
  "/peso",
];

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ApplyIntent {
  kind: "apply";
  jobId: string;
  returnTo: string;
  createdAt: number;
}

export type AuthIntent = ApplyIntent;

function isAllowedPath(pathname: string): boolean {
  const normalizedPath = pathname.toLowerCase();

  if (
    UNSAFE_PATH_PREFIXES.some(
      (prefix) =>
        normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
    )
  ) {
    return false;
  }

  return (
    /^\/$/.test(pathname) ||
    /^\/jobs\/?$/.test(pathname) ||
    /^\/jobs\/[^/]+(?:\/(?:route|apply))?\/?$/.test(pathname) ||
    /^\/(?:saved|applications|profile|preferences)\/?$/.test(pathname) ||
    /^\/onboarding\/(?:profile|skills)\/?$/.test(pathname) ||
    /^\/about\/data-sources\/?$/.test(pathname)
  );
}

function sanitizeCandidate(value: string | null | undefined, origin: string) {
  if (typeof value !== "string") {
    return null;
  }

  const candidate = value.trim();
  const pathOnly = candidate.split(/[?#]/, 1)[0] ?? "";

  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate) ||
    /%(?:2f|5c)/i.test(pathOnly)
  ) {
    return null;
  }

  try {
    const baseUrl = new URL(origin);
    const parsed = new URL(candidate, baseUrl);

    if (parsed.origin !== baseUrl.origin) {
      return null;
    }

    const decodedPath = decodeURIComponent(parsed.pathname);
    const decodedSegments = decodedPath.split("/");

    if (
      decodedPath.startsWith("//") ||
      decodedPath.includes("\\") ||
      decodedSegments.some((segment) => segment === "." || segment === "..") ||
      !isAllowedPath(decodedPath)
    ) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function sanitizeReturnTo(
  value: string | null | undefined,
  fallback = DEFAULT_RETURN_TO,
  origin = DEFAULT_ORIGIN,
): string {
  return (
    sanitizeCandidate(value, origin) ??
    sanitizeCandidate(fallback, origin) ??
    DEFAULT_RETURN_TO
  );
}

export function sanitizeEmployerReturnTo(
  value: string | null | undefined,
  fallback = "/employer",
  origin = DEFAULT_ORIGIN,
): string {
  if (typeof value !== "string") return fallback;

  const candidate = value.trim();
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const baseUrl = new URL(origin);
    const parsed = new URL(candidate, baseUrl);
    const decodedPath = decodeURIComponent(parsed.pathname);
    const isAllowed =
      /^\/employer\/?$/.test(decodedPath) ||
      /^\/employer\/(?:candidates|company|posts(?:\/new)?|posts\/[^/]+\/candidates)\/?$/.test(
        decodedPath,
      );

    if (
      parsed.origin !== baseUrl.origin ||
      decodedPath.startsWith("//") ||
      decodedPath.includes("\\") ||
      decodedPath
        .split("/")
        .some((segment) => segment === "." || segment === "..") ||
      !isAllowed
    ) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function sanitizeLguReturnTo(
  value: string | null | undefined,
  fallback = "/lgu",
  origin = DEFAULT_ORIGIN,
): string {
  if (typeof value !== "string") return fallback;

  const candidate = value.trim();
  const pathOnly = candidate.split(/[?#]/, 1)[0] ?? "";
  if (
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate) ||
    /%(?:2f|5c)/i.test(pathOnly)
  ) {
    return fallback;
  }

  try {
    const baseUrl = new URL(origin);
    const parsed = new URL(candidate, baseUrl);
    const decodedPath = decodeURIComponent(parsed.pathname);
    const isAllowed =
      /^\/lgu\/?$/.test(decodedPath) ||
      /^\/lgu\/(?:verification|employers|audit-log)\/?$/.test(decodedPath) ||
      /^\/lgu\/(?:verification\/jobs|employers)\/[^/]+\/?$/.test(decodedPath);

    if (
      parsed.origin !== baseUrl.origin ||
      decodedPath.startsWith("//") ||
      decodedPath.includes("\\") ||
      decodedPath
        .split("/")
        .some((segment) => segment === "." || segment === "..") ||
      !isAllowed
    ) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function getJobDetailPath(jobId: string): string {
  const normalizedJobId = jobId.trim();

  if (!normalizedJobId) {
    return DEFAULT_RETURN_TO;
  }

  return `/jobs/${encodeURIComponent(normalizedJobId)}`;
}

export function getApplyResumePath(intent: Pick<ApplyIntent, "jobId">): string {
  const jobPath = getJobDetailPath(intent.jobId);
  return jobPath === DEFAULT_RETURN_TO ? DEFAULT_RETURN_TO : `${jobPath}/apply`;
}

export function createApplyIntent(
  jobId: string,
  returnTo: string,
  createdAt = Date.now(),
): ApplyIntent {
  const normalizedJobId = jobId.trim();

  if (!normalizedJobId) {
    throw new Error("A job ID is required to create an apply intent.");
  }

  const fallback = getJobDetailPath(normalizedJobId);

  return {
    kind: "apply",
    jobId: normalizedJobId,
    returnTo: sanitizeReturnTo(returnTo, fallback),
    createdAt,
  };
}

function getSessionStorage(
  storage: StorageLike | null | undefined,
): StorageLike | null {
  if (storage !== undefined) {
    return storage;
  }

  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveApplyIntent(
  intent: ApplyIntent,
  storage?: StorageLike | null,
): void {
  const targetStorage = getSessionStorage(storage);

  if (!targetStorage) {
    return;
  }

  try {
    targetStorage.setItem(AUTH_INTENT_STORAGE_KEY, JSON.stringify(intent));
  } catch {}
}

function isApplyIntent(value: unknown): value is ApplyIntent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const intent = value as Partial<ApplyIntent>;

  return (
    intent.kind === "apply" &&
    typeof intent.jobId === "string" &&
    intent.jobId.trim().length > 0 &&
    typeof intent.returnTo === "string" &&
    typeof intent.createdAt === "number" &&
    Number.isFinite(intent.createdAt) &&
    intent.createdAt > 0
  );
}

export function readApplyIntent(
  storage?: StorageLike | null,
): ApplyIntent | null {
  const targetStorage = getSessionStorage(storage);

  if (!targetStorage) {
    return null;
  }

  try {
    const storedValue = targetStorage.getItem(AUTH_INTENT_STORAGE_KEY);

    if (!storedValue) {
      return null;
    }

    const parsed: unknown = JSON.parse(storedValue);

    if (!isApplyIntent(parsed)) {
      return null;
    }

    const jobId = parsed.jobId.trim();

    return {
      kind: "apply",
      jobId,
      returnTo: sanitizeReturnTo(parsed.returnTo, getJobDetailPath(jobId)),
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

export function clearApplyIntent(storage?: StorageLike | null): void {
  const targetStorage = getSessionStorage(storage);

  if (!targetStorage) {
    return;
  }

  try {
    targetStorage.removeItem(AUTH_INTENT_STORAGE_KEY);
  } catch {}
}

export function consumeApplyIntent(
  storage?: StorageLike | null,
): ApplyIntent | null {
  const intent = readApplyIntent(storage);
  clearApplyIntent(storage);
  return intent;
}

export const saveAuthIntent = saveApplyIntent;
export const readAuthIntent = readApplyIntent;
export const clearAuthIntent = clearApplyIntent;
