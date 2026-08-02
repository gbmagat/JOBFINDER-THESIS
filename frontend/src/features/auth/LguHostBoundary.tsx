import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { isLguHostname } from "./lgu-host";

export function LguHostBoundary({ children }: { children: ReactNode }) {
  const { isReady, user } = useAuth();
  const location = useLocation();
  const hostname = typeof window === "undefined" ? "" : window.location.hostname;
  const isLguPath =
    location.pathname === "/lgu/sign-in" ||
    location.pathname === "/lgu" ||
    location.pathname.startsWith("/lgu/");

  if (!isLguHostname(hostname) || isLguPath) return children;

  if (!isReady) {
    return (
      <main className="route-loading-state" aria-live="polite">
        <span className="route-loading-state__mark" aria-hidden="true">
          JF
        </span>
        <p>Checking Your Account…</p>
      </main>
    );
  }

  return (
    <Navigate
      replace
      to={user?.role === "peso-lgu" ? "/lgu" : "/lgu/sign-in"}
    />
  );
}
