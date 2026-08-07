import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RouteOption } from "../jobs/types";
import { JobMap, routeCoordinatesToLatLng } from "./JobMap";

afterEach(cleanup);

const route: RouteOption = {
  algorithm: "dijkstra",
  routeId: "route-test-dijkstra",
  mode: "walk",
  geometry: {
    type: "LineString",
    coordinates: [
      [120.5874, 15.1667],
      [120.5882, 15.1458],
    ],
  },
  distanceKm: 3.1,
  steps: [{ order: 1, instruction: "Follow the shortest path." }],
  textSummary: "A route calculated by JobFinder Dijkstra.",
  isEstimate: true,
};

describe("JobMap", () => {
  it("converts GeoJSON longitude-latitude coordinates for Leaflet", () => {
    const routeWithInvalidPoint: RouteOption = {
      ...route,
      geometry: {
        type: "LineString",
        coordinates: [
          [120.5874, 15.1667],
          [Number.NaN, 15.1458],
          [120.5882, 15.1458],
        ],
      },
    };

    expect(routeCoordinatesToLatLng(routeWithInvalidPoint)).toEqual([
      [15.1667, 120.5874],
      [15.1458, 120.5882],
    ]);
  });

  it("shows only the selected job when the user location is unavailable", () => {
    render(
      <JobMap
        jobs={[
          {
            id: "job-two",
            latitude: 15.1458,
            longitude: 120.5882,
            title: "Second Job",
          },
        ]}
        label="Map showing local jobs and a Dijkstra route"
        route={route}
        selectedJobId="job-two"
        testId="test-job-map"
      />,
    );

    const map = screen.getByTestId("test-job-map");
    expect(map).toHaveAttribute("data-marker-count", "1");
    expect(map).toHaveAttribute("data-route-id", "");
    expect(
      screen.getByRole("region", {
        name: "Map showing local jobs and a Dijkstra route",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "1 job marker shown. Only the selected job location is shown. Your location is not available.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "© OpenStreetMap contributors" }),
    ).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");

    const markerKey = screen.getByRole("list", { name: "Map marker key" });
    expect(within(markerKey).getByText("Selected job")).toBeInTheDocument();
    expect(within(markerKey).queryByText("You are here")).not.toBeInTheDocument();
    expect(within(markerKey).queryByText("Starting area")).not.toBeInTheDocument();
  });

  it("shows the user and selected job when a valid location is available", () => {
    render(
      <JobMap
        currentLocation={{ latitude: 15.155, longitude: 120.595 }}
        jobs={[
          {
            id: "job-two",
            latitude: 15.1458,
            longitude: 120.5882,
            title: "Second Job",
          },
        ]}
        label="Map with device location"
        route={route}
        selectedJobId="job-two"
        testId="device-location-map"
      />,
    );

    expect(screen.getByTestId("device-location-map")).toHaveAttribute(
      "data-route-id",
      "route-test-dijkstra",
    );
    const markerKey = screen.getByRole("list", { name: "Map marker key" });
    expect(within(markerKey).getByText("You are here")).toBeInTheDocument();
    expect(within(markerKey).getByText("Selected job")).toBeInTheDocument();
    expect(within(markerKey).queryByText("Starting area")).not.toBeInTheDocument();
    expect(within(markerKey).queryByText("Device location")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "1 job marker shown. Your location and the selected job are shown. Route route-test-dijkstra runs from your location to the selected job and contains 2 mapped points.",
      ),
    ).toBeInTheDocument();
  });

  it("announces when no route line is available", () => {
    render(
      <JobMap
        label="Empty job map"
        testId="empty-job-map"
      />,
    );

    expect(screen.getByTestId("empty-job-map")).toHaveAttribute(
      "data-route-id",
      "",
    );
    expect(
      screen.getByText("0 job markers shown. No route line is available."),
    ).toBeInTheDocument();
  });
});
