import { useEffect, useRef, useState } from "react";
import L, { type LatLngBoundsExpression, type LatLngTuple } from "leaflet";

const ANGELES_CITY_CENTER: LatLngTuple = [15.145, 120.59];
const ANGELES_CITY_BOUNDS: LatLngBoundsExpression = [
  [15.08, 120.52],
  [15.22, 120.67],
];
const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export interface HomeLocationPoint {
  latitude: number;
  longitude: number;
}

interface HomeLocationMapProps {
  disabled?: boolean;
  onChange: (location: HomeLocationPoint) => void;
  value: HomeLocationPoint | null;
}

function isValidPoint(point: HomeLocationPoint | null) {
  return Boolean(
    point &&
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      point.latitude >= -90 &&
      point.latitude <= 90 &&
      point.longitude >= -180 &&
      point.longitude <= 180,
  );
}

function pinIcon() {
  return L.divIcon({
    className: "home-location-map__marker-host",
    html: '<span class="home-location-map__marker" aria-hidden="true"></span>',
    iconAnchor: [22, 42],
    iconSize: [44, 44],
  });
}

export function HomeLocationMap({
  disabled = false,
  onChange,
  value,
}: HomeLocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  const [mapReady, setMapReady] = useState(false);
  const [tileError, setTileError] = useState(false);
  const tileUrl =
    import.meta.env.VITE_MAP_TILE_URL?.trim() || DEFAULT_TILE_URL;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || import.meta.env.MODE === "test") return;

    const map = L.map(container, {
      attributionControl: false,
      keyboard: true,
      maxBounds: ANGELES_CITY_BOUNDS,
      maxBoundsViscosity: 0.9,
      scrollWheelZoom: false,
      zoomControl: true,
    }).setView(ANGELES_CITY_CENTER, 13);
    const tiles = L.tileLayer(tileUrl, { maxZoom: 19 });
    tiles.on("tileerror", () => setTileError(true));
    tiles.on("load", () => setTileError(false));
    tiles.addTo(map);
    map.on("click", (event: L.LeafletMouseEvent) => {
      if (disabledRef.current) return;
      onChangeRef.current({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    });

    mapRef.current = map;
    setMapReady(true);
    const resizeTimer = window.setTimeout(
      () => map.invalidateSize({ animate: false, pan: false }),
      0,
    );

    return () => {
      window.clearTimeout(resizeTimer);
      markerRef.current = null;
      mapRef.current = null;
      setMapReady(false);
      map.remove();
    };
  }, [tileUrl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    markerRef.current?.remove();
    markerRef.current = null;
    if (!isValidPoint(value) || !value) return;

    const marker = L.marker([value.latitude, value.longitude], {
      draggable: !disabled,
      icon: pinIcon(),
      keyboard: true,
      title: "Approximate home pin",
    })
      .bindTooltip("Approximate home pin", {
        direction: "top",
        offset: [0, -20],
      })
      .addTo(map);
    marker.on("dragend", () => {
      if (disabled) return;
      const position = marker.getLatLng();
      onChangeRef.current({
        latitude: position.lat,
        longitude: position.lng,
      });
    });
    markerRef.current = marker;
    map.panTo([value.latitude, value.longitude], { animate: false });
  }, [disabled, mapReady, value]);

  function pinMapCenter() {
    const center = mapRef.current?.getCenter();
    if (!center || disabled) return;
    onChangeRef.current({
      latitude: center.lat,
      longitude: center.lng,
    });
  }

  return (
    <div className="home-location-map" data-testid="home-location-map">
      <p className="home-location-map__instructions" id="home-map-help">
        Tap the map to place a pin, or move the map and pin its center.
      </p>
      <div className="home-location-map__viewport">
        <div
          aria-describedby="home-map-help"
          aria-label="Choose your approximate home area in Angeles City"
          className="home-location-map__canvas"
          ref={containerRef}
          role="region"
        />
        <span aria-hidden="true" className="home-location-map__crosshair" />
        {tileError ? (
          <p className="home-location-map__status" role="status">
            Map tiles are unavailable, but you can still use the barangay field.
          </p>
        ) : null}
        <a
          className="home-location-map__attribution"
          href="https://www.openstreetmap.org/copyright"
          rel="noreferrer"
          target="_blank"
        >
          © OpenStreetMap
        </a>
      </div>
      <button
        className="button button--secondary home-location-map__center-button"
        disabled={disabled || !mapReady}
        onClick={pinMapCenter}
        type="button"
      >
        Pin map center
      </button>
    </div>
  );
}
