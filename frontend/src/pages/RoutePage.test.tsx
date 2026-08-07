import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthContext";
import { JobsProvider } from "../features/jobs/JobsContext";
import { RoutePage } from "./RoutePage";

const apiMocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock("../lib/api", () => apiMocks);

const originalGeolocationDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "geolocation",
);

function setGeolocation(
  getCurrentPosition: Geolocation["getCurrentPosition"] | undefined,
) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: getCurrentPosition
      ? {
          clearWatch: vi.fn(),
          getCurrentPosition,
          watchPosition: vi.fn(),
        }
      : undefined,
  });
}

function grantLocation(latitude = 15.1667, longitude = 120.5874) {
  setGeolocation(
    vi.fn((success: PositionCallback) => {
      success({
        coords: {
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          latitude,
          longitude,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      });
    }) as Geolocation["getCurrentPosition"],
  );
}

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
  setGeolocation(undefined);
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  if (originalGeolocationDescriptor) {
    Object.defineProperty(
      navigator,
      "geolocation",
      originalGeolocationDescriptor,
    );
  } else {
    Reflect.deleteProperty(navigator, "geolocation");
  }
});

describe("RoutePage Dijkstra integration", () => {
  it("shows only the selected job until the user chooses to share a location", () => {
    renderRoutePage();

    expect(apiMocks.apiRequest).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Use My Location" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("route-map")).toHaveAttribute(
      "data-marker-count",
      "1",
    );
    expect(screen.getByTestId("route-map")).toHaveAttribute(
      "data-route-id",
      "",
    );
    expect(
      screen.getByText("Your location has not been added to this map."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/starting area/i)).not.toBeInTheDocument();
  });

  it("requests and renders a Dijkstra route from a granted location", async () => {
    grantLocation();
    apiMocks.apiRequest.mockResolvedValue({
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
    fireEvent.click(screen.getByRole("button", { name: "Use My Location" }));

    await waitFor(() =>
      expect(apiMocks.apiRequest).toHaveBeenCalledWith(
        "/jobs/it-support-assistant-lumina-tech/route?latitude=15.1667&longitude=120.5874",
      ),
    );

    expect(
      await screen.findByText("Calculated by JobFinder Dijkstra"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("9.6 km").length).toBeGreaterThan(0);
    expect(
      screen.getByText("The shortest available graph path is 9.6 km."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("route-map")).toHaveAttribute(
      "data-route-id",
      "route-api-dijkstra",
    );
    expect(screen.queryByText(/starting area/i)).not.toBeInTheDocument();
  });

  it("keeps the job-only map when location access is unsupported", () => {
    renderRoutePage();

    fireEvent.click(screen.getByRole("button", { name: "Use My Location" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Location is not supported by this browser.",
    );
    expect(apiMocks.apiRequest).not.toHaveBeenCalled();
    expect(screen.getByTestId("route-map")).toHaveAttribute(
      "data-marker-count",
      "1",
    );
    expect(screen.getByTestId("route-map")).toHaveAttribute(
      "data-route-id",
      "",
    );
  });
});
