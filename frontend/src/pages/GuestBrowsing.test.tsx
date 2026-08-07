import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthContext";
import { JobDetailPage } from "./JobDetailPage";
import { JobsPage } from "./JobsPage";

const originalGeolocation = Object.getOwnPropertyDescriptor(
  window.navigator,
  "geolocation",
);

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
  if (originalGeolocation) {
    Object.defineProperty(
      window.navigator,
      "geolocation",
      originalGeolocation,
    );
  } else {
    Reflect.deleteProperty(window.navigator, "geolocation");
  }
});

function allowCurrentLocation() {
  Object.defineProperty(window.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn((success: PositionCallback) => {
        success({
          coords: {
            latitude: 15.155,
            longitude: 120.595,
          },
        } as GeolocationPosition);
      }),
    },
  });
}

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
  it("does not show personalized percentages in job results", async () => {
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

    const jobsMap = screen.getByTestId("jobs-map");
    expect(jobsMap).toHaveAttribute(
      "data-marker-count",
      "4",
    );
    expect(jobsMap).toHaveAttribute("data-route-id", "");
    expect(
      screen.getByRole("heading", { name: "4 Jobs Shown" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Shortest path calculated by JobFinder Dijkstra"),
    ).not.toBeInTheDocument();
    const mapToggle = screen.getByRole("button", { name: "Show Map" });
    expect(mapToggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(mapToggle);
    expect(
      screen.getByRole("button", { name: "Show List" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Select IT Support Assistant on map",
      }),
    );
    expect(screen.queryByText(/Show(?:ing)? on Map/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(jobsMap).toHaveAttribute("data-marker-count", "1");
      expect(jobsMap).toHaveAttribute("data-route-id", "");
    });
    expect(
      screen.getByRole("heading", { name: "1 Selected Job" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        "OpenStreetMap showing only IT Support Assistant. Use location to calculate a route.",
      ),
    ).toBeInTheDocument();
    const markerKey = screen.getByRole("list", { name: "Map marker key" });
    expect(within(markerKey).getByText("Selected job")).toBeInTheDocument();
    expect(within(markerKey).queryByText("You are here")).not.toBeInTheDocument();
    expect(within(markerKey).queryByText("Starting area")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Shortest path calculated by JobFinder Dijkstra"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Deselect IT Support Assistant and show all jobs on map",
      }),
    );
    await waitFor(() => {
      expect(jobsMap).toHaveAttribute("data-marker-count", "4");
      expect(jobsMap).toHaveAttribute("data-route-id", "");
    });
    expect(
      screen.getByRole("heading", { name: "4 Jobs Shown" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Select IT Support Assistant on map",
      }),
    ).toHaveAttribute("aria-pressed", "false");

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

  it("shows the user, selected job, and Dijkstra route after location access", async () => {
    allowCurrentLocation();
    renderGuestRoute("/jobs", "/jobs", <JobsPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Use current location" }),
    );
    await waitFor(() => {
      expect(screen.getByText("You are here")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Select IT Support Assistant on map",
      }),
    );

    const jobsMap = screen.getByTestId("jobs-map");
    await waitFor(() => {
      expect(jobsMap).toHaveAttribute("data-marker-count", "1");
      expect(jobsMap.getAttribute("data-route-id")).not.toBe("");
    });
    const markerKey = screen.getByRole("list", { name: "Map marker key" });
    expect(within(markerKey).getByText("You are here")).toBeInTheDocument();
    expect(within(markerKey).getByText("Selected job")).toBeInTheDocument();
    expect(within(markerKey).queryByText("Starting area")).not.toBeInTheDocument();
    expect(
      screen.getByText("Shortest path calculated by JobFinder Dijkstra"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Deselect IT Support Assistant and show all jobs on map",
      }),
    );
    await waitFor(() => {
      expect(jobsMap).toHaveAttribute("data-marker-count", "4");
      expect(jobsMap).toHaveAttribute("data-route-id", "");
    });
    expect(
      screen.queryByText("Shortest path calculated by JobFinder Dijkstra"),
    ).not.toBeInTheDocument();
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
