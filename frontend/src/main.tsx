import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./features/auth/AuthContext";
import { router } from "./app/router";
import "./styles/globals.css";
import "./styles/application.css";
import "./styles/auth-dialog.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("JobFinder could not find the application root.");
}

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <Suspense
        fallback={
          <main className="route-loading-state" aria-live="polite">
            <span className="route-loading-state__mark" aria-hidden="true">
              JF
            </span>
            <p>Loading JobFinder…</p>
          </main>
        }
      >
        <RouterProvider router={router} />
      </Suspense>
    </AuthProvider>
  </StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
