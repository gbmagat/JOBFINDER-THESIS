import { useEffect, useRef, useState } from "react";
import L, {
  type FitBoundsOptions,
  type LatLngBounds,
  type LatLngTuple,
} from "leaflet";
import type { RouteOption } from "../jobs/types";

const ANGELES_CITY_CENTER: LatLngTuple = [15.145, 120.59];
const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const FIT_BOUNDS_OPTIONS: FitBoundsOptions = {
  animate: false,
  maxZoom: 15,
  paddingTopLeft: [72, 72],
  paddingBottomRight: [44, 88],
};

export interface JobMapPoint {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
}

interface CurrentMapLocation {
  latitude: number;
  longitude: number;
}

interface JobMapProps {
  className?: string;
  currentLocation?: CurrentMapLocation | null;
  jobs?: JobMapPoint[];
  label: string;
  locationLabel?: string;
  onSelectJob?: (jobId: string) => void;
  route?: RouteOption | null;
  selectedJobId?: string | null;
  testId: string;
}

function isCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function routeCoordinatesToLatLng(
  route?: RouteOption | null,
): LatLngTuple[] {
  const positions: LatLngTuple[] = [];

  for (const coordinate of route?.geometry?.coordinates ?? []) {
    const [longitude, latitude] = coordinate;
    if (isCoordinate(latitude, longitude)) {
      positions.push([latitude, longitude]);
    }
  }

  return positions;
}

type MapMarkerVariant = "job" | "user" | "destination";

const MAP_MARKER_GLYPHS: Record<MapMarkerVariant, string> = {
  job: `
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>`,
  user: `
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>`,
  destination: `
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" />
    </svg>`,
};

function markerIcon(variant: MapMarkerVariant) {
  return L.divIcon({
    className: "job-map-marker-host",
    html: `<span class="job-map-marker job-map-marker--${variant}">${MAP_MARKER_GLYPHS[variant]}</span>`,
    iconAnchor: [22, 22],
    iconSize: [44, 44],
  });
}

function extendBounds(bounds: LatLngBounds, position: LatLngTuple) {
  if (isCoordinate(position[0], position[1])) bounds.extend(position);
}

export function JobMap({
  className = "",
  currentLocation,
  jobs = [],
  label,
  locationLabel = "You are here",
  onSelectJob,
  route,
  selectedJobId,
  testId,
}: JobMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const boundsRef = useRef<LatLngBounds | null>(null);
  const [tileError, setTileError] = useState(false);
  const tileUrl =
    import.meta.env.VITE_MAP_TILE_URL?.trim() || DEFAULT_TILE_URL;
  const validJobCount = jobs.filter((job) =>
    isCoordinate(job.latitude, job.longitude),
  ).length;
  const mapLocation =
    currentLocation &&
    isCoordinate(currentLocation.latitude, currentLocation.longitude)
      ? currentLocation
      : null;
  const accessibleLocationLabel =
    locationLabel === "You are here" ? "Your location" : locationLabel;
  const visibleRoute = mapLocation ? route : null;
  const visibleRoutePointCount = routeCoordinatesToLatLng(visibleRoute).length;
  const hasRoute = visibleRoutePointCount >= 2;
  const hasSelectedJob = Boolean(selectedJobId) || hasRoute;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || import.meta.env.MODE === "test") return;

    const map = L.map(container, {
      attributionControl: false,
      scrollWheelZoom: false,
      zoomControl: true,
    }).setView(ANGELES_CITY_CENTER, 13);

    const tileLayer = L.tileLayer(tileUrl, {
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19,
    });
    let tilesLoaded = false;
    const tileWatchdog = window.setTimeout(() => {
      if (!tilesLoaded) setTileError(true);
    }, 5_000);
    tileLayer.on("tileerror", () => setTileError(true));
    tileLayer.on("load", () => {
      tilesLoaded = true;
      window.clearTimeout(tileWatchdog);
      setTileError(false);
    });
    tileLayer.addTo(map);

    const overlays = L.layerGroup().addTo(map);
    mapRef.current = map;
    overlayRef.current = overlays;

    let active = true;
    const resizeMap = () => {
      if (
        !active ||
        mapRef.current !== map ||
        !map.getPane("mapPane") ||
        container.clientWidth === 0 ||
        container.clientHeight === 0
      ) {
        return;
      }
      map.invalidateSize({ animate: false, pan: false });
      const bounds = boundsRef.current;
      if (bounds?.isValid()) map.fitBounds(bounds, FIT_BOUNDS_OPTIONS);
    };
    const observer =
      "ResizeObserver" in window ? new ResizeObserver(resizeMap) : null;
    observer?.observe(container);
    window.addEventListener("resize", resizeMap);
    const initialResizeTimer = window.setTimeout(resizeMap, 0);

    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener("resize", resizeMap);
      window.clearTimeout(initialResizeTimer);
      window.clearTimeout(tileWatchdog);
      mapRef.current = null;
      overlayRef.current = null;
      boundsRef.current = null;
      map.remove();
    };
  }, [tileUrl]);

  useEffect(() => {
    const map = mapRef.current;
    const overlays = overlayRef.current;
    if (!map || !overlays) return;

    overlays.clearLayers();
    const bounds = L.latLngBounds([]);
    boundsRef.current = bounds;
    const routePositions = routeCoordinatesToLatLng(visibleRoute);
    routePositions.forEach((position) => extendBounds(bounds, position));

    if (routePositions.length >= 2) {
      L.polyline(routePositions, {
        color: "#ffffff",
        lineCap: "round",
        lineJoin: "round",
        opacity: 0.9,
        weight: 10,
      }).addTo(overlays);

      L.polyline(routePositions, {
        color: "#164135",
        lineCap: "round",
        lineJoin: "round",
        opacity: 0.92,
        weight: 6,
      }).addTo(overlays);

      const routeEnd = routePositions.at(-1) as LatLngTuple;
      const selectedDestination = jobs.find(
        (job) =>
          job.id === selectedJobId &&
          job.latitude === routeEnd[0] &&
          job.longitude === routeEnd[1],
      );
      const endMarker = L.marker(routeEnd, {
        icon: markerIcon("destination"),
        keyboard: Boolean(selectedDestination),
        title: selectedDestination
          ? `Selected job: ${selectedDestination.title}`
          : "Selected job destination",
      }).addTo(overlays);
      if (selectedDestination) {
        const destinationTooltip = document.createElement("span");
        destinationTooltip.textContent = `Selected job: ${selectedDestination.title}`;
        endMarker
          .bindTooltip(destinationTooltip, {
            direction: "top",
            offset: [0, -14],
          })
          .on("click", () => onSelectJob?.(selectedDestination.id));
      } else {
        endMarker.bindTooltip("Selected job destination", {
          direction: "top",
          offset: [0, -14],
        });
      }
    }

    jobs.forEach((job) => {
      if (!isCoordinate(job.latitude, job.longitude)) return;
      const position: LatLngTuple = [job.latitude, job.longitude];
      const routeEnd = routePositions.at(-1);
      if (
        job.id === selectedJobId &&
        routeEnd?.[0] === position[0] &&
        routeEnd[1] === position[1]
      ) {
        return;
      }
      extendBounds(bounds, position);
      const marker = L.marker(position, {
        icon: markerIcon(selectedJobId === job.id ? "destination" : "job"),
        keyboard: true,
        title:
          selectedJobId === job.id
            ? `Selected job: ${job.title}`
            : `Job: ${job.title}`,
      }).addTo(overlays);
      const tooltip = document.createElement("span");
      tooltip.textContent =
        selectedJobId === job.id
          ? `Selected job: ${job.title}`
          : job.title;
      marker.bindTooltip(tooltip, { direction: "top", offset: [0, -14] });
      marker.on("click", () => onSelectJob?.(job.id));
    });

    if (mapLocation) {
      const position: LatLngTuple = [
        mapLocation.latitude,
        mapLocation.longitude,
      ];
      extendBounds(bounds, position);
      const userLocationMarker = L.marker(position, {
        icon: markerIcon("user"),
        keyboard: false,
        title: locationLabel,
      })
        .bindTooltip(locationLabel, {
          direction: "top",
          offset: [0, -14],
        })
        .addTo(overlays);
      userLocationMarker
        .getElement()
        ?.setAttribute("aria-label", locationLabel);
      userLocationMarker.getElement()?.setAttribute("role", "img");
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, FIT_BOUNDS_OPTIONS);
    } else {
      map.setView(ANGELES_CITY_CENTER, 13, { animate: false });
    }
  }, [jobs, locationLabel, mapLocation, onSelectJob, selectedJobId, visibleRoute]);

  return (
    <div
      className={`job-map-shell${className ? ` ${className}` : ""}`}
      data-marker-count={validJobCount}
      data-route-id={hasRoute ? visibleRoute?.routeId ?? "" : ""}
      data-testid={testId}
    >
      <div className="job-map__viewport">
        <div
          aria-label={label}
          className="job-map"
          ref={containerRef}
          role="region"
        />
        {tileError ? (
          <p className="job-map__status" role="status">
            Map tiles are temporarily unavailable. The route summary remains
            available below.
          </p>
        ) : null}
        <a
          className="job-map__attribution"
          href="https://www.openstreetmap.org/copyright"
          rel="noreferrer"
          target="_blank"
        >
          © OpenStreetMap contributors
        </a>
      </div>
      {mapLocation || hasSelectedJob ? (
        <div
          aria-label="Map marker key"
          className="job-map__legend"
          role="list"
        >
          {mapLocation ? (
            <span className="job-map__legend-item" role="listitem">
              <span
                aria-hidden="true"
                className="job-map__legend-symbol job-map__legend-symbol--user"
              />
              {locationLabel}
            </span>
          ) : null}
          {hasSelectedJob ? (
            <span className="job-map__legend-item" role="listitem">
              <span
                aria-hidden="true"
                className="job-map__legend-symbol job-map__legend-symbol--destination"
              />
              Selected job
            </span>
          ) : null}
        </div>
      ) : null}
      <p className="sr-only">
        {validJobCount} job {validJobCount === 1 ? "marker" : "markers"} shown.
        {hasRoute && visibleRoute
          ? ` ${accessibleLocationLabel} and the selected job are shown. Route ${visibleRoute.routeId} runs from ${accessibleLocationLabel.toLowerCase()} to the selected job and contains ${visibleRoutePointCount} mapped points.`
          : hasSelectedJob && mapLocation
            ? ` ${accessibleLocationLabel} and the selected job are shown. No route line is available.`
            : hasSelectedJob
              ? ` Only the selected job location is shown. ${accessibleLocationLabel} is not available.`
              : mapLocation
                ? ` ${accessibleLocationLabel} is also shown. No route line is available.`
                : " No route line is available."}
      </p>
    </div>
  );
}
