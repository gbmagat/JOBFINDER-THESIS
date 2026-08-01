import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    const { container } = renderGuestRoute("/jobs", "/jobs", <JobsPage />);

    expect(
      screen.getByRole("heading", { name: "Search Local Jobs" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\d+% match/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /Best match/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "4 Jobs Found" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("option", { name: "Nearest distance" }),
    ).toHaveLength(2);
    expect(
      screen.queryByRole("option", { name: /Shortest commute|Shortest travel/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Maximum travel time/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Sort"), {
      target: { value: "distance" },
    });
    const titles = [...container.querySelectorAll(".job-card__title-link")].map(
      (link) => link.textContent,
    );
    expect(titles).toEqual([
      "Customer Service Associate",
      "Customer Service Associate",
      "IT Support Assistant",
      "Junior Web Developer",
    ]);
  });

  it("keeps public details and route distance visible without time or a match score", () => {
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
      screen.getByRole("link", { name: /View.*route/i }),
    ).toHaveAttribute(
      "href",
      "/jobs/it-support-assistant-lumina-tech/route",
    );
    expect(screen.getAllByText(/5\.2 km/i).length).toBeGreaterThan(0);
    expect(
      screen.queryByText(/\b\d+\s*(?:min|minute|minutes)\b/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Sign In to Apply" }),
    ).toHaveLength(2);
  });
});
