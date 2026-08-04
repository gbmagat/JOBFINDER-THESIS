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
  paddingTopLeft: [28, 28],
  paddingBottomRight: [28, 88],
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

function markerIcon(label: string, variant: string) {
  return L.divIcon({
    className: "job-map-marker-host",
    html: `<span class="job-map-marker job-map-marker--${variant}">${label}</span>`,
    iconAnchor: [18, 18],
    iconSize: [36, 36],
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
    const routePositions = routeCoordinatesToLatLng(route);
    routePositions.forEach((position) => extendBounds(bounds, position));

    if (routePositions.length >= 2) {
      L.polyline(routePositions, {
        color: "#164135",
        lineCap: "round",
        lineJoin: "round",
        opacity: 0.92,
        weight: 6,
      }).addTo(overlays);

      L.marker(routePositions[0], {
        icon: markerIcon("A", "start"),
        keyboard: false,
      }).addTo(overlays);
      const routeEnd = routePositions.at(-1) as LatLngTuple;
      const selectedDestination = jobs.find(
        (job) =>
          job.id === selectedJobId &&
          job.latitude === routeEnd[0] &&
          job.longitude === routeEnd[1],
      );
      const endMarker = L.marker(routeEnd, {
        icon: markerIcon("B", "end"),
        keyboard: Boolean(selectedDestination),
        title: selectedDestination?.title ?? "Route destination",
      }).addTo(overlays);
      if (selectedDestination) {
        endMarker
          .bindTooltip(selectedDestination.title, {
            direction: "top",
            offset: [0, -10],
          })
          .on("click", () => onSelectJob?.(selectedDestination.id));
      }
    }

    jobs.forEach((job, index) => {
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
        icon: markerIcon(
          String(index + 1),
          selectedJobId === job.id ? "selected" : "job",
        ),
        keyboard: true,
        title: job.title,
      }).addTo(overlays);
      const tooltip = document.createElement("span");
      tooltip.textContent = job.title;
      marker.bindTooltip(tooltip, { direction: "top", offset: [0, -10] });
      marker.on("click", () => onSelectJob?.(job.id));
    });

    if (
      currentLocation &&
      isCoordinate(currentLocation.latitude, currentLocation.longitude)
    ) {
      const position: LatLngTuple = [
        currentLocation.latitude,
        currentLocation.longitude,
      ];
      L.circleMarker(position, {
        color: "#ffffff",
        fillColor: "#1e3054",
        fillOpacity: 1,
        radius: 8,
        weight: 3,
      })
        .bindTooltip("Your current position")
        .addTo(overlays);
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, FIT_BOUNDS_OPTIONS);
    } else {
      map.setView(ANGELES_CITY_CENTER, 13, { animate: false });
    }
  }, [currentLocation, jobs, onSelectJob, route, selectedJobId]);

  return (
    <div
      className={`job-map-shell${className ? ` ${className}` : ""}`}
      data-marker-count={validJobCount}
      data-route-id={route?.routeId ?? ""}
      data-testid={testId}
    >
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
      <p className="sr-only">
        {validJobCount} job {validJobCount === 1 ? "marker" : "markers"} shown.
        {route?.geometry?.coordinates.length
          ? ` Route ${route.routeId} contains ${route.geometry.coordinates.length} mapped points.`
          : " No route line is available."}
      </p>
    </div>
  );
}
