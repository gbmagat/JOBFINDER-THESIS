import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AuthProvider, AUTH_USER_STORAGE_KEY } from "./AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import type { StorageLike } from "./auth-intent";

afterEach(cleanup);

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

function LocationResult() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}

function renderGuard(
  initialPath: string,
  allowedRoles: readonly ("job-seeker" | "employer")[],
  storage: StorageLike | null = null,
) {
  return render(
    <AuthProvider storage={storage}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<ProtectedRoute allowedRoles={allowedRoles} />}>
            <Route path={initialPath} element={<h1>Protected content</h1>} />
          </Route>
          <Route path="/sign-in" element={<LocationResult />} />
          <Route path="/jobs" element={<LocationResult />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("ProtectedRoute", () => {
  it("sends a guest account route to sign in with a safe return path", async () => {
    renderGuard("/applications", ["job-seeker"]);

    expect(await screen.findByTestId("location")).toHaveTextContent(
      "/sign-in?returnTo=%2Fapplications",
    );
  });

  it("preserves the explicit employer role and return path", async () => {
    renderGuard("/employer", ["employer"]);

    const location = await screen.findByTestId("location");
    expect(location).toHaveTextContent("/sign-in?");
    expect(location).toHaveTextContent("returnTo=%2Femployer");
    expect(location).toHaveTextContent("role=employer");
  });

  it("prevents a job seeker account from entering employer routes", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      AUTH_USER_STORAGE_KEY,
      JSON.stringify({
        id: "job-seeker-1",
        email: "gabriel@example.com",
        displayName: "Gabriel",
        role: "job-seeker",
      }),
    );

    renderGuard("/employer", ["employer"], storage);

    expect(await screen.findByTestId("location")).toHaveTextContent("/jobs");
  });
});
