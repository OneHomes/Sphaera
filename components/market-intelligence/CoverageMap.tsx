"use client";
import { useEffect, useRef, useState } from "react";
import type { Observation } from "@/lib/marketIntelligence/insights";

const cityMap: Record<string, { lat: number; lon: number }> = {
  Lahore: { lat: 31.5204, lon: 74.3587 },
  Karachi: { lat: 24.8607, lon: 67.0011 },
  Islamabad: { lat: 33.6844, lon: 73.0479 },
  Rawalpindi: { lat: 33.5651, lon: 73.0169 },
  Faisalabad: { lat: 31.4504, lon: 73.135 },
  Multan: { lat: 30.1575, lon: 71.5249 },
  Peshawar: { lat: 34.0151, lon: 71.5249 },
  Gujranwala: { lat: 32.1877, lon: 74.1945 },
  Bahawalpur: { lat: 29.3956, lon: 71.6836 },
};
const tileSize = 256;
const clampLat = (lat: number) => Math.max(-85.0511, Math.min(85.0511, lat));
const worldPoint = (lat: number, lon: number, z: number) => {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const r = (clampLat(lat) * Math.PI) / 180;
  const y = ((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * n;
  return { x: x * tileSize, y: y * tileSize };
};
function tileUrl(z: number, x: number, y: number) {
  const n = 2 ** z;
  const wrapped = ((x % n) + n) % n;
  if (y < 0 || y >= n) return "";
  const shard = ["a", "b", "c", "d"][Math.abs(x + y) % 4];
  return `https://${shard}.basemaps.cartocdn.com/light_all/${z}/${wrapped}/${y}.png`;
}
export default function CoverageMap({
  city,
  points,
  segments,
  onSelect,
  selectedId,
  onHover,
}: {
  city: string;
  points: Observation[];
  segments: Record<string, string>;
  currency: string;
  onSelect: (o: Observation) => void;
  selectedId: string | null;
  onHover: (id: string | null) => void;
}) {
  const base = cityMap[city] || cityMap.Lahore;
  const [zoom, setZoom] = useState(11);
  const [centre, setCentre] = useState(base);
  const mapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; centre: { lat: number; lon: number } } | null>(null);
  useEffect(() => {
    setCentre(base);
    setZoom(11);
  }, [city]);
  const [width, setWidth] = useState(900);
  const height = 520;
  useEffect(() => {
    if (typeof ResizeObserver === "undefined" || !mapRef.current) return;
    const observer = new ResizeObserver((entries) => setWidth(entries[0]?.contentRect.width || 900));
    observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, []);
  const centrePx = worldPoint(centre.lat, centre.lon, zoom);
  const tileX = Math.floor(centrePx.x / tileSize);
  const tileY = Math.floor(centrePx.y / tileSize);
  const tiles = [];
  for (let x = tileX - 2; x <= tileX + 2; x++) for (let y = tileY - 2; y <= tileY + 2; y++) tiles.push({ x, y, url: tileUrl(zoom, x, y) });
  const markerPoints = points
    .map((point, i) => {
      const angle = (i * 137.5 * Math.PI) / 180;
      const radius = 0.012 + (i % 5) * 0.006;
      const lat = base.lat + Math.sin(angle) * radius;
      const lon = base.lon + (Math.cos(angle) * radius) / Math.max(0.35, Math.cos((base.lat * Math.PI) / 180));
      const world = worldPoint(lat, lon, zoom);
      return { point, x: world.x - centrePx.x + width / 2, y: world.y - centrePx.y + height / 2 };
    })
    .filter((m) => m.x > -20 && m.x < width + 20 && m.y > -20 && m.y < height + 20);
  function zoomBy(delta: number) {
    setZoom((z) => Math.max(9, Math.min(15, z + delta)));
  }
  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX, y: e.clientY, centre };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const start = worldPoint(drag.current.centre.lat, drag.current.centre.lon, zoom);
    const next = { x: start.x - (e.clientX - drag.current.x), y: start.y - (e.clientY - drag.current.y) };
    const n = 2 ** zoom;
    const lon = (next.x / tileSize / n) * 360 - 180;
    const y = next.y / tileSize / n;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
    setCentre({ lat, lon });
  }
  function onPointerUp() {
    drag.current = null;
  }
  return (
    <div
      className="coverage-map"
      ref={mapRef}
      role="application"
      aria-label={`Interactive city coverage map for ${city}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="map-tiles">
        {tiles.map(
          (t) =>
            t.url && (
              <img
                key={`${t.x}:${t.y}`}
                src={t.url}
                alt=""
                draggable={false}
                style={{ left: `${t.x * tileSize - centrePx.x + width / 2}px`, top: `${t.y * tileSize - centrePx.y + height / 2}px` }}
              />
            )
        )}
      </div>
      <div className="map-overlay">
        {markerPoints.map(({ point, x, y }) => (
          <button
            key={point.id}
            className={`map-point ${selectedId === point.id ? "selected" : ""}`}
            style={{ left: x, top: y }}
            onMouseEnter={() => onHover(point.id)}
            onFocus={() => onHover(point.id)}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(point);
            }}
            aria-label={`${point.area}, ${segments[point.segment]}`}
          >
            <span className="map-point-dot" />
            <span className="map-point-label">{point.area}</span>
            <span className="map-tooltip">
              {point.area} · {segments[point.segment]}
              <b>{point.price.toLocaleString("en-GB")} PKR</b>
            </span>
          </button>
        ))}
      </div>
      <div className="map-controls">
        <button
          onClick={(e) => {
            e.stopPropagation();
            zoomBy(1);
          }}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            zoomBy(-1);
          }}
          aria-label="Zoom out"
        >
          &minus;
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCentre(base);
            setZoom(11);
          }}
          aria-label="Reset map"
        >
          &#8962;
        </button>
      </div>
      <div className="map-attribution">
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          © OpenStreetMap contributors
        </a>{" "}
        ·{" "}
        <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">
          © CARTO
        </a>
      </div>
    </div>
  );
}
