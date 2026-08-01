import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthContext";
import { JobDetailPage } from "./JobDetailPage";
import { JobsPage } from "./JobsPage";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function renderGuestRoute(path: string, routePath: string, element: ReactNode) {
  return render(
    <AuthProvider storage={null}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("guest job browsing", () => {
  it("does not show personalized percentages in job results", () => {
    renderGuestRoute("/jobs", "/jobs", <JobsPage />);

    expect(
      screen.getByRole("heading", { name: "Search Local Jobs" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\d+% match/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Best match/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps public details and travel visible without a match score", () => {
    renderGuestRoute(
      "/jobs/it-support-assistant-lumina-tech",
      "/jobs/:jobId",
      <JobDetailPage />,
    );

    expect(
      screen.getByRole("heading", { name: "IT Support Assistant" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Overall Match/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View the estimated 18-minute travel route/i }),
    ).toHaveAttribute(
      "href",
      "/jobs/it-support-assistant-lumina-tech/route",
    );
    expect(
      screen.getAllByRole("button", { name: "Sign In to Apply" }),
    ).toHaveLength(2);
  });
});
