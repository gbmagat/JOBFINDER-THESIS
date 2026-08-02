import { describe, expect, it } from "vitest";
import { getLguRootRedirect, isLguHostname } from "./lgu-host";

describe("LGU hostname routing", () => {
  it("recognizes only the dedicated LGU and PESO subdomains", () => {
    expect(isLguHostname("lgu.jobfinder.ph")).toBe(true);
    expect(isLguHostname("PESO.jobfinder.ph.")).toBe(true);
    expect(isLguHostname("localhost")).toBe(false);
    expect(isLguHostname("jobfinder.ph")).toBe(false);
  });

  it("routes a dedicated subdomain by reviewer authentication state", () => {
    expect(getLguRootRedirect("lgu.jobfinder.ph")).toBe("/lgu/sign-in");
    expect(getLguRootRedirect("peso.jobfinder.ph", "peso-lgu")).toBe("/lgu");
    expect(getLguRootRedirect("localhost", "peso-lgu")).toBeNull();
  });
});
