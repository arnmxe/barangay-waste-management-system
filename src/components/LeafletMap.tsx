"use client";

import React, { useEffect, useRef } from "react";
import { BARANGAY_CENTER } from "@/lib/geo";
import type L from "leaflet";

export interface MapPin {
  id: string | number;
  lat: number;
  lng: number;
  label: string;
  detail?: string;
  orderNumber?: number;
  color?: "green" | "blue" | "amber" | "red" | "slate" | "depot";
}

interface LeafletMapProps {
  pins: MapPin[];
  showPolyline?: boolean;
  includeDepot?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
  heightClass?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
}

const COLOR_HEX: Record<string, string> = {
  green: "#15803D",
  blue: "#1D4ED8",
  amber: "#D97706",
  red: "#B91C1C",
  slate: "#475569",
  depot: "#166534",
};

export function LeafletMap({
  pins,
  showPolyline = false,
  includeDepot = false,
  onMapClick,
  heightClass = "h-[360px]",
  center = BARANGAY_CENTER,
  zoom = 15,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const leafletRef = useRef<typeof L | null>(null);
  const onClickRef = useRef(onMapClick);

  useEffect(() => {
    onClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    let mounted = true;
    async function init() {
      if (!containerRef.current || mapRef.current) return;
      const leaflet = (await import("leaflet")).default;
      if (!mounted || !containerRef.current) return;
      leafletRef.current = leaflet;

      const map = leaflet.map(containerRef.current, {
        center: [center.lat, center.lng],
        zoom,
        scrollWheelZoom: true,
      });

      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        })
        .addTo(map);

      const group = leaflet.layerGroup().addTo(map);
      mapRef.current = map;
      layerGroupRef.current = group;

      map.on("click", (e: L.LeafletMouseEvent) => {
        if (onClickRef.current) {
          onClickRef.current(
            Number(e.latlng.lat.toFixed(6)),
            Number(e.latlng.lng.toFixed(6))
          );
        }
      });

      renderPins(leaflet, map, group);
    }

    init();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerGroupRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderPins(leaflet: typeof L, map: L.Map, group: L.LayerGroup) {
    group.clearLayers();
    const coords: [number, number][] = [];

    if (includeDepot) {
      coords.push([BARANGAY_CENTER.lat, BARANGAY_CENTER.lng]);
      const depotIcon = leaflet.divIcon({
        className: "custom-pin-icon",
        html: `<div style="background:#166534;color:#fff;border:2px solid #F59E0B;border-radius:8px;padding:2px 7px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3);">MRF</div>`,
        iconSize: [42, 24],
        iconAnchor: [21, 12],
      });
      leaflet
        .marker([BARANGAY_CENTER.lat, BARANGAY_CENTER.lng], { icon: depotIcon })
        .bindPopup(`<strong>${BARANGAY_CENTER.label}</strong><br/>Starting Depot`)
        .addTo(group);
    }

    for (const pin of pins) {
      coords.push([pin.lat, pin.lng]);
      const bg = COLOR_HEX[pin.color ?? "green"] ?? "#166534";
      const text =
        pin.orderNumber !== undefined ? String(pin.orderNumber) : "•";

      const icon = leaflet.divIcon({
        className: "custom-pin-icon",
        html: `<div style="background:${bg};color:#fff;width:30px;height:30px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.35);">${text}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

      const safeLabel = pin.label.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const safeDetail = (pin.detail ?? "")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      leaflet
        .marker([pin.lat, pin.lng], { icon })
        .bindPopup(
          `<div style="min-width:160px"><strong>${safeLabel}</strong>${
            safeDetail ? `<div style="margin-top:4px;font-size:12px;color:#475569">${safeDetail}</div>` : ""
          }</div>`
        )
        .addTo(group);
    }

    if (showPolyline && coords.length >= 2) {
      leaflet
        .polyline(coords, {
          color: "#166534",
          weight: 4,
          opacity: 0.85,
          dashArray: "8 6",
        })
        .addTo(group);
    }

    if (coords.length >= 2) {
      const bounds = leaflet.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
    } else if (coords.length === 1) {
      map.setView(coords[0], 16);
    }
  }

  useEffect(() => {
    if (leafletRef.current && mapRef.current && layerGroupRef.current) {
      renderPins(leafletRef.current, mapRef.current, layerGroupRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, showPolyline, includeDepot]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      <div
        ref={containerRef}
        className={`w-full ${heightClass} ${onMapClick ? "cursor-crosshair" : ""}`}
        aria-label="Barangay San Isidro interactive OpenStreetMap"
      />
      {onMapClick && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-lg bg-slate-900/85 px-3 py-1.5 text-xs font-medium text-white shadow">
          Click anywhere on the map to drop a pin
        </div>
      )}
    </div>
  );
}
