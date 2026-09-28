import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Flight } from '../types/flight';
import { MapControls } from './MapControls';
import { Radio, AlertCircle } from 'lucide-react';

interface FlightMapProps {
  selectedFlight: Flight | null;
  /** Why no live position is available, when the backend said so. */
  liveUnavailableMessage?: string | null;
}

/**
 * Rejects missing/NaN coordinates and the (0, 0) "null island" sentinel some
 * providers use for an unknown position, so bad data never reaches a marker.
 */
function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

export const FlightMap: React.FC<FlightMapProps> = ({ selectedFlight, liveUnavailableMessage }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const aircraftMarkerRef = useRef<L.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const container = mapContainerRef.current as HTMLDivElement & { _leaflet_id?: number };
    if (container._leaflet_id) {
      delete container._leaflet_id;
    }

    let map: L.Map;
    try {
      map = L.map(container, {
        center: [20.5937, 78.9629],
        zoom: 4,
        zoomControl: false,
        attributionControl: true,
        fadeAnimation: false,
      });
      map.attributionControl.setPrefix(false);
    } catch (err) {
      console.error('[FlightMap] Leaflet map initialization failed:', err);
      return;
    }

    L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
      maxZoom: 20,
      subdomains: ['a', 'b', 'c'],
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, tiles by <a href="https://www.cyclosm.org">CyclOSM</a>',
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;
    setMapReady(true);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
    } else {
      window.setTimeout(() => map.invalidateSize(), 100);
    }

    return () => {
      resizeObserver?.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      layerGroupRef.current = null;
      aircraftMarkerRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Redraw departure/arrival pins, route line, and fit bounds
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup || !mapReady) return;

    layerGroup.clearLayers();

    if (!selectedFlight) {
      return;
    }

    const { departure, arrival, route, live } = selectedFlight;
    const boundsPoints: L.LatLngExpression[] = [];

    // 1. Departure Airport Marker
    if (isValidCoordinate(departure.latitude, departure.longitude)) {
      const depLatLng = L.latLng(departure.latitude as number, departure.longitude as number);
      boundsPoints.push(depLatLng);

      const depIcon = L.divIcon({
        className: 'custom-dep-pin',
        html: `
          <div style="background: #0284c7; border: 2.5px solid #ffffff; color: #ffffff; border-radius: 9999px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; font-family: monospace; box-shadow: 0 4px 12px rgba(2,132,199,0.5);">
            ${departure.iata || 'DEP'}
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const depMarker = L.marker(depLatLng, { icon: depIcon });
      depMarker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px;">
          <div style="color: #38bdf8; font-weight: 800; font-size: 13px; margin-bottom: 2px;">ORIGIN: ${departure.iata}</div>
          <div style="font-weight: 600; color: #ffffff;">${departure.name}</div>
          <div style="color: #94a3b8; font-size: 11px; margin-top: 4px;">${departure.city || ''}${departure.country ? ', ' + departure.country : ''}</div>
          ${departure.terminal ? `<div style="color: #e2e8f0; font-size: 11px; margin-top: 3px;">Terminal: ${departure.terminal} ${departure.gate ? `| Gate: ${departure.gate}` : ''}</div>` : ''}
        </div>
      `);
      layerGroup.addLayer(depMarker);
    }

    // 2. Arrival Airport Marker
    if (isValidCoordinate(arrival.latitude, arrival.longitude)) {
      const arrLatLng = L.latLng(arrival.latitude as number, arrival.longitude as number);
      boundsPoints.push(arrLatLng);

      const arrIcon = L.divIcon({
        className: 'custom-arr-pin',
        html: `
          <div style="background: #059669; border: 2.5px solid #ffffff; color: #ffffff; border-radius: 9999px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; font-family: monospace; box-shadow: 0 4px 12px rgba(5,150,105,0.5);">
            ${arrival.iata || 'ARR'}
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const arrMarker = L.marker(arrLatLng, { icon: arrIcon });
      arrMarker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px;">
          <div style="color: #34d399; font-weight: 800; font-size: 13px; margin-bottom: 2px;">DESTINATION: ${arrival.iata}</div>
          <div style="font-weight: 600; color: #ffffff;">${arrival.name}</div>
          <div style="color: #94a3b8; font-size: 11px; margin-top: 4px;">${arrival.city || ''}${arrival.country ? ', ' + arrival.country : ''}</div>
          ${arrival.terminal ? `<div style="color: #e2e8f0; font-size: 11px; margin-top: 3px;">Terminal: ${arrival.terminal} ${arrival.gate ? `| Gate: ${arrival.gate}` : ''}</div>` : ''}
        </div>
      `);
      layerGroup.addLayer(arrMarker);
    }

    // 3. Flight Route Polyline
    if (route && route.length > 0) {
      const polyline = L.polyline(route, {
        color: '#0284c7',
        weight: 3.5,
        opacity: 0.85,
        dashArray: selectedFlight.hasLiveTracking ? '6, 8' : undefined,
        lineCap: 'round',
        lineJoin: 'round',
      });
      layerGroup.addLayer(polyline);
    }

    if (live && isValidCoordinate(live.latitude, live.longitude)) {
      boundsPoints.push(L.latLng(live.latitude, live.longitude));
    }

    if (boundsPoints.length > 0) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 7,
        animate: true,
      });
    }
  }, [
    selectedFlight?.flightNumber,
    selectedFlight?.departure.latitude,
    selectedFlight?.departure.longitude,
    selectedFlight?.arrival.latitude,
    selectedFlight?.arrival.longitude,
    selectedFlight?.route,
    mapReady,
  ]);

  // Handle live aircraft marker update
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady) return;

    const live = selectedFlight?.live;

    if (!live || !isValidCoordinate(live.latitude, live.longitude)) {
      if (aircraftMarkerRef.current) {
        map.removeLayer(aircraftMarkerRef.current);
        aircraftMarkerRef.current = null;
      }
      return;
    }

    const planeLatLng = L.latLng(live.latitude, live.longitude);
    const heading = live.heading ?? 0;

    const aircraftIcon = L.divIcon({
      className: 'custom-aircraft-marker',
      html: `
        <div style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; background: rgba(56, 189, 248, 0.25); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="transform: rotate(${heading}deg); transition: transform 0.5s ease-out; width: 38px; height: 38px; background: #0284c7; border: 2.5px solid #ffffff; border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(56, 189, 248, 0.7);">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="#ffffff" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });

    // Only fields the provider actually returned are shown.
    const rows: Array<[string, string]> = [];
    if (typeof live.altitude === 'number') rows.push(['Altitude', `${live.altitude.toLocaleString()} ft`]);
    if (typeof live.speed === 'number') rows.push(['Speed', `${live.speed} km/h`]);
    if (typeof live.heading === 'number') rows.push(['Heading', `${live.heading}°`]);
    rows.push(['Status', live.isGround ? 'On Ground' : 'Airborne']);
    const ageSeconds = live.updatedAt ? Math.max(0, Math.round((Date.now() - new Date(live.updatedAt).getTime()) / 1000)) : null;
    const sourceLabel = live.source === 'airlabs' ? 'AirLabs ADS-B' : live.source === 'opensky' ? 'OpenSky Network' : null;
    const footer = [sourceLabel, ageSeconds !== null ? `updated ${ageSeconds < 60 ? `${ageSeconds}s` : `${Math.round(ageSeconds / 60)} min`} ago` : null]
      .filter(Boolean)
      .join(' · ');

    const tooltipHtml = `
      <div style="font-family: sans-serif; font-size: 12px; min-width: 170px;">
        <div style="font-weight: 800; color: #38bdf8; font-size: 13px; font-family: monospace; display: flex; align-items: center; gap: 4px;">
          <span>&#9992;</span> ${selectedFlight?.flightNumber ?? ''}
        </div>
        <hr style="border: 0; border-top: 1px solid #334155; margin: 6px 0;" />
        <div style="color: #94a3b8; font-size: 11px;">Current Coordinates:</div>
        <div style="color: #f8fafc; font-family: monospace; font-weight: 700; margin-bottom: 4px;">
          ${live.latitude.toFixed(4)}°, ${live.longitude.toFixed(4)}°
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; margin-top: 4px;">
          ${rows.map(([k, v]) => `<div><span style="color: #94a3b8;">${k}:</span> <b style="color: ${k === 'Status' ? '#34d399' : '#f8fafc'};">${v}</b></div>`).join('')}
        </div>
        ${footer ? `<div style="color: #64748b; font-size: 10px; margin-top: 6px;">${footer}</div>` : ''}
      </div>
    `;

    if (aircraftMarkerRef.current) {
      aircraftMarkerRef.current.setLatLng(planeLatLng);
      aircraftMarkerRef.current.setIcon(aircraftIcon);
      aircraftMarkerRef.current.setTooltipContent(tooltipHtml);
    } else {
      const planeMarker = L.marker(planeLatLng, { icon: aircraftIcon, zIndexOffset: 1000 });
      planeMarker.bindTooltip(tooltipHtml, {
        direction: 'top',
        offset: [0, -24],
        opacity: 1,
        className: 'aircraft-tooltip',
      });
      planeMarker.addTo(map);
      aircraftMarkerRef.current = planeMarker;
    }
  }, [selectedFlight?.live, selectedFlight?.flightNumber, mapReady]);

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const handleCenterAircraft = () => {
    if (!mapInstanceRef.current || !selectedFlight?.live) return;
    const { latitude, longitude } = selectedFlight.live;
    if (isValidCoordinate(latitude, longitude)) {
      mapInstanceRef.current.flyTo([latitude, longitude], 8, {
        animate: true,
        duration: 1.2,
      });
    }
  };

  const handleFitBounds = () => {
    if (!mapInstanceRef.current || !selectedFlight) return;
    const points: L.LatLngExpression[] = [];
    if (isValidCoordinate(selectedFlight.departure.latitude, selectedFlight.departure.longitude)) {
      points.push([selectedFlight.departure.latitude as number, selectedFlight.departure.longitude as number]);
    }
    if (isValidCoordinate(selectedFlight.arrival.latitude, selectedFlight.arrival.longitude)) {
      points.push([selectedFlight.arrival.latitude as number, selectedFlight.arrival.longitude as number]);
    }
    if (selectedFlight.live && isValidCoordinate(selectedFlight.live.latitude, selectedFlight.live.longitude)) {
      points.push([selectedFlight.live.latitude, selectedFlight.live.longitude]);
    }
    if (points.length > 0) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(points), {
        padding: [60, 60],
        maxZoom: 7,
      });
    }
  };

  const hasAircraftPosition = Boolean(
    selectedFlight?.live && isValidCoordinate(selectedFlight.live.latitude, selectedFlight.live.longitude)
  );

  const hasRoute = Boolean(selectedFlight?.route && selectedFlight.route.length > 0);

  return (
    <div className="relative w-full h-[380px] lg:h-[480px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 shadow-sm">
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Map Controls */}
      <MapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onCenterAircraft={handleCenterAircraft}
        onFitBounds={handleFitBounds}
        hasAircraftPosition={hasAircraftPosition}
        hasRoute={hasRoute}
      />

      {/* Top-Left Radar Status Badge */}
      <div className="absolute left-4 top-4 z-[1000] flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-slate-700 px-3.5 py-1.5 rounded-xl shadow-xl text-white">
        <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
        <span className="text-xs font-mono font-bold tracking-wider">
          {selectedFlight ? `RADAR // ${selectedFlight.flightNumber}` : 'RADAR // GLOBAL MAP'}
        </span>
        {selectedFlight && hasAircraftPosition && (
          <span className="text-[10px] font-mono font-bold text-emerald-400 border-l border-slate-700 pl-2 ml-1">
            LIVE ADS-B ACTIVE
          </span>
        )}
      </div>

      {/* Notice Banner when Live Tracking Coordinates are Unavailable */}
      {selectedFlight && !hasAircraftPosition && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-[1000] max-w-sm bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl p-3 shadow-2xl flex items-center gap-2.5 text-xs text-slate-300">
          <AlertCircle className="w-4 h-4 text-sky-400 shrink-0" />
          <span>
            <b className="text-slate-100">Live position unavailable</b>
            {liveUnavailableMessage ? ` - ${liveUnavailableMessage}` : ''}
          </span>
        </div>
      )}
    </div>
  );
};
