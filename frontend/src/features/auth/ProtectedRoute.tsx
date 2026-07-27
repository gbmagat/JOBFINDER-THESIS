import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { type AuthRole, useAuth } from "./AuthContext";
import {
  sanitizeEmployerReturnTo,
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
  const { user } = useAuth();
  const location = useLocation();
  const content = children === undefined ? <Outlet /> : children;

  if (!user) {
    const employerAccess =
      allowedRoles?.length === 1 && allowedRoles[0] === "employer";
    const returnTo = employerAccess
      ? sanitizeEmployerReturnTo(
          `${location.pathname}${location.search}${location.hash}`,
        )
      : sanitizeReturnTo(
          `${location.pathname}${location.search}${location.hash}`,
        );
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
