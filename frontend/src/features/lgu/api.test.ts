import { afterEach, describe, expect, it, vi } from "vitest";
import { getLguAuditLog } from "./api";
import type { LguAuditEntry } from "./types";

function auditEntry(id: string): LguAuditEntry {
  return {
    id,
    time: "2026-08-02T06:00:00.000Z",
    reviewer: "LGU Reviewer",
    action: "Approved job post",
    subject: `Job ${id}`,
    detail: "Decision recorded.",
    tone: "success",
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LGU API", () => {
  it("loads every page of the Audit Log", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          entries: [auditEntry("3"), auditEntry("2")],
          page: 1,
          pageSize: 2,
          total: 3,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          entries: [auditEntry("1")],
          page: 2,
          pageSize: 2,
          total: 3,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getLguAuditLog();

    expect(result.entries.map((entry) => entry.id)).toEqual(["3", "2", "1"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(
      "/api/lgu/audit-log?page=2&pageSize=100",
    );
  });
});
