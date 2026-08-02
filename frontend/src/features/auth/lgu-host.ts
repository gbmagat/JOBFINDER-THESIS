import type { AuthRole } from "./AuthContext";

export function isLguHostname(hostname: string): boolean {
  const normalizedHostname = hostname.trim().toLowerCase().replace(/\.$/, "");
  return (
    normalizedHostname.startsWith("lgu.") ||
    normalizedHostname.startsWith("peso.")
  );
}

export function getLguRootRedirect(
  hostname: string,
  role?: AuthRole,
): string | null {
  if (!isLguHostname(hostname)) return null;
  return role === "peso-lgu" ? "/lgu" : "/lgu/sign-in";
}
