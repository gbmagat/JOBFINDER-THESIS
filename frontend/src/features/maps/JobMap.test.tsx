import { cleanup, render, screen } from "@testing-library/react";
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

  it("exposes stable map metadata and an accessible label", () => {
    render(
      <JobMap
        jobs={[
          {
            id: "job-one",
            latitude: 15.1667,
            longitude: 120.5874,
            title: "First Job",
          },
          {
            id: "job-two",
            latitude: 15.1458,
            longitude: 120.5882,
            title: "Second Job",
          },
        ]}
        label="Map showing local jobs and a Dijkstra route"
        route={route}
        testId="test-job-map"
      />,
    );

    const map = screen.getByTestId("test-job-map");
    expect(map).toHaveAttribute("data-marker-count", "2");
    expect(map).toHaveAttribute("data-route-id", "route-test-dijkstra");
    expect(
      screen.getByRole("region", {
        name: "Map showing local jobs and a Dijkstra route",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "2 job markers shown. Route route-test-dijkstra contains 2 mapped points.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "© OpenStreetMap contributors" }),
    ).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
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
