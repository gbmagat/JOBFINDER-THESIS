import { Navigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import { getLguRootRedirect } from "../features/auth/lgu-host";
import { HomePage } from "./HomePage";

export function LguHostRootPage() {
  const { user } = useAuth();
  const redirect = getLguRootRedirect(window.location.hostname, user?.role);
  return redirect ? <Navigate replace to={redirect} /> : <HomePage />;
}
