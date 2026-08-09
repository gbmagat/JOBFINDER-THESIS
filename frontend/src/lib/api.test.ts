import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiRequest", () => {
  it("returns a valid JSON response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest<{ ok: boolean }>("/health")).resolves.toEqual({
      ok: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("preserves a valid JSON API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: "INVALID_CREDENTIALS",
              message: "The email or password is incorrect.",
              fields: { email: "Check this email address." },
            },
          },
          401,
        ),
      ),
    );

    await expect(apiRequest("/auth/login")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "The email or password is incorrect.",
      fields: { email: "Check this email address." },
    });
  });

  it("returns null for a 204 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );

    await expect(apiRequest<null>("/auth/logout")).resolves.toBeNull();
  });

  it("explains how to start the server when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    await expect(apiRequest("/auth/login")).rejects.toMatchObject({
      name: "ApiError",
      status: 0,
      code: "SERVER_UNAVAILABLE",
      message: expect.stringContaining(
        "Run npm run dev from the main project folder",
      ),
    });
  });

  it("handles an empty server error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );

    await expect(apiRequest("/auth/login")).rejects.toMatchObject({
      name: "ApiError",
      status: 500,
      code: "SERVER_UNAVAILABLE",
      message: expect.stringContaining(
        "Run npm run dev from the main project folder",
      ),
    });
  });

  it("handles an empty successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );

    await expect(apiRequest("/health")).rejects.toMatchObject({
      name: "ApiError",
      status: 200,
      code: "SERVER_UNAVAILABLE",
      message: expect.stringContaining(
        "Run npm run dev from the main project folder",
      ),
    });
  });

  it("handles a non-JSON server error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("Bad Gateway", { status: 502 })),
    );

    await expect(apiRequest("/auth/login")).rejects.toMatchObject({
      name: "ApiError",
      status: 502,
      code: "SERVER_UNAVAILABLE",
      message: expect.stringContaining(
        "Run npm run dev from the main project folder",
      ),
    });
  });
});
