import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthContext";
import { JobsProvider } from "../features/jobs/JobsContext";
import { RoutePage } from "./RoutePage";

const apiMocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock("../lib/api", () => apiMocks);

function renderRoutePage() {
  return render(
    <AuthProvider storage={null}>
      <JobsProvider>
        <MemoryRouter
          initialEntries={["/jobs/it-support-assistant-lumina-tech/route"]}
        >
          <Routes>
            <Route path="/jobs/:jobId/route" element={<RoutePage />} />
          </Routes>
        </MemoryRouter>
      </JobsProvider>
    </AuthProvider>,
  );
}

beforeEach(() => {
  apiMocks.apiRequest.mockReset();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("RoutePage Dijkstra integration", () => {
  it("renders the route returned by the Dijkstra endpoint", async () => {
    apiMocks.apiRequest.mockResolvedValue({
      personalized: false,
      startingArea: "Balibago Reference Area",
      route: {
        algorithm: "dijkstra",
        routeId: "route-api-dijkstra",
        mode: "public-transport",
        geometry: {
          type: "LineString",
          coordinates: [
            [120.5874, 15.1667],
            [120.5901, 15.154],
            [120.5882, 15.1458],
          ],
        },
        distanceKm: 9.6,
        estimatedFarePhp: 26,
        steps: [
          {
            order: 1,
            instruction: "Follow the Dijkstra path to Nepo Center.",
            distanceKm: 9.6,
          },
        ],
        textSummary: "The shortest available graph path is 9.6 km.",
        isEstimate: true,
      },
    });

    renderRoutePage();

    await waitFor(() =>
      expect(apiMocks.apiRequest).toHaveBeenCalledWith(
        "/jobs/it-support-assistant-lumina-tech/route",
      ),
    );

    expect(
      await screen.findByText("Calculated by JobFinder Dijkstra"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("9.6 km").length).toBeGreaterThan(0);
    expect(
      screen.getByText("The shortest available graph path is 9.6 km."),
    ).toBeInTheDocument();
    expect(screen.getByText("Balibago Reference Area", { exact: false }))
      .toBeInTheDocument();
    expect(screen.getByTestId("route-map")).toHaveAttribute(
      "data-route-id",
      "route-api-dijkstra",
    );
  });

  it("shows a failure instead of substituting a stored route", async () => {
    apiMocks.apiRequest.mockRejectedValue(
      new Error("The road graph is unavailable."),
    );

    renderRoutePage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The road graph is unavailable.");
    expect(alert).toHaveTextContent(
      "JobFinder will not substitute a route that was not calculated by Dijkstra.",
    );
    expect(screen.queryByTestId("route-map")).not.toBeInTheDocument();
  });
});
