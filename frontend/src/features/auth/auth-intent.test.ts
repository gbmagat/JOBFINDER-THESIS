import { describe, expect, it } from "vitest";
import {
  AUTH_INTENT_STORAGE_KEY,
  consumeApplyIntent,
  createApplyIntent,
  getApplyResumePath,
  readApplyIntent,
  sanitizeReturnTo,
  saveApplyIntent,
  type StorageLike,
} from "./auth-intent";

function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe("sanitizeReturnTo", () => {
  it("keeps allowed internal JobFinder routes", () => {
    expect(sanitizeReturnTo("/jobs/it-101?from=recommended#match")).toBe(
      "/jobs/it-101?from=recommended#match",
    );
    expect(sanitizeReturnTo("/applications")).toBe("/applications");
  });

  it.each([
    "https://malicious.example/jobs",
    "//malicious.example/jobs",
    "/\\malicious.example",
    "javascript:alert(1)",
    "/employer",
    "/employer/applicants",
    "/admin/users",
    "/jobs%2f..%2femployer",
  ])("rejects unsafe or privileged return target %s", (target) => {
    expect(sanitizeReturnTo(target)).toBe("/jobs");
  });
});

describe("apply intent storage", () => {
  it("persists, reads, and consumes a contextual apply intent", () => {
    const storage = createMemoryStorage();
    const intent = createApplyIntent(
      "it-support-101",
      "/jobs/it-support-101",
      1234,
    );

    saveApplyIntent(intent, storage);
    expect(readApplyIntent(storage)).toEqual(intent);
    expect(consumeApplyIntent(storage)).toEqual(intent);
    expect(readApplyIntent(storage)).toBeNull();
  });

  it("repairs a tampered return path to the selected job", () => {
    const storage = createMemoryStorage();
    storage.setItem(
      AUTH_INTENT_STORAGE_KEY,
      JSON.stringify({
        kind: "apply",
        jobId: "customer-service-7",
        returnTo: "//malicious.example",
        createdAt: 1234,
      }),
    );

    expect(readApplyIntent(storage)?.returnTo).toBe(
      "/jobs/customer-service-7",
    );
  });

  it("encodes job IDs in the authenticated resume route", () => {
    expect(getApplyResumePath({ jobId: "LGU 24/7" })).toBe(
      "/jobs/LGU%2024%2F7/apply",
    );
  });
});
