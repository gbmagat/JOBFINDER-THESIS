import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { type AuthRole, useAuth } from "./AuthContext";
import {
  sanitizeEmployerReturnTo,
  sanitizeLguReturnTo,
  sanitizeReturnTo,
} from "./auth-intent";

interface ProtectedRouteProps {
  children?: ReactNode;
  allowedRoles?: readonly AuthRole[];
  redirectTo?: string;
  unauthorizedTo?: string;
}

export function ProtectedRoute({
  children,
  allowedRoles,
  redirectTo = "/sign-in",
  unauthorizedTo = "/jobs",
}: ProtectedRouteProps) {
  const { isReady, user } = useAuth();
  const location = useLocation();
  const content = children === undefined ? <Outlet /> : children;

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

  if (!user) {
    const employerAccess =
      allowedRoles?.length === 1 && allowedRoles[0] === "employer";
    const lguAccess =
      allowedRoles?.length === 1 && allowedRoles[0] === "peso-lgu";
    const requestedPath = `${location.pathname}${location.search}${location.hash}`;
    const returnTo = employerAccess
      ? sanitizeEmployerReturnTo(requestedPath)
      : lguAccess
        ? sanitizeLguReturnTo(requestedPath)
        : sanitizeReturnTo(requestedPath);
    const signInSearch = new URLSearchParams({
      returnTo,
      ...(employerAccess ? { role: "employer" } : {}),
    }).toString();

    return (
      <Navigate
        replace
        to={`${redirectTo}?${signInSearch}`}
        state={{ returnTo }}
      />
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const separator = unauthorizedTo.includes("?") ? "&" : "?";
    return (
      <Navigate
        replace
        to={`${unauthorizedTo}${separator}state=unauthorized`}
      />
    );
  }

  return content;
}

export default ProtectedRoute;
