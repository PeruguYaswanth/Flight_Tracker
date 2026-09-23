import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Flight } from '../types/flight';
import { MapControls } from './MapControls';
import { Radio, AlertCircle } from 'lucide-react';

interface FlightMapProps {
  selectedFlight: Flight | null;
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

export const FlightMap: React.FC<FlightMapProps> = ({ selectedFlight }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  // The aircraft marker lives outside `layerGroupRef` (which the
  // dep/arr/route effect below clears and rebuilds on every flight change)
  // so that a fresh live-position poll can move it in place via
  // `setLatLng`/`setIcon` instead of tearing down and re-adding it - which
  // would otherwise also force an unwanted `fitBounds` re-animation every
  // poll.
  const aircraftMarkerRef = useRef<L.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Defensive guard: React 18 StrictMode (dev only) mounts every effect
    // twice (mount -> cleanup -> mount again). Verified directly (mounting
    // this component through a real createRoot+StrictMode tree) that
    // Leaflet 1.9.4's map.remove() already clears the `_leaflet_id` stamp
    // it sets on the container, so the second mount does NOT throw "Map
    // container is already initialized." in practice - but clearing any
    // stray stamp before init is a harmless, zero-cost safety net against
    // that well-known class of bug regardless.
    const container = mapContainerRef.current as HTMLDivElement & { _leaflet_id?: number };
    if (container._leaflet_id) {
      delete container._leaflet_id;
    }

    let map: L.Map;
    try {
      // Default center (World view). fadeAnimation disabled: Leaflet's
      // tile/zoom fade-in is driven entirely by a recursive
      // requestAnimationFrame loop that interpolates each tile's opacity
      // from 0 to 1 over ~200ms (see leaflet-src.js _updateOpacity). If
      // that RAF loop doesn't run to completion for any reason, tiles are
      // left permanently stuck at inline `opacity: 0` - which no CSS rule
      // can override. Confirmed exactly this via a real headless Chrome
      // capture: tiles had `leaflet-tile-loaded` (genuinely loaded) but
      // `style="opacity: 0"` forever. Disabling the animation removes this
      // entire failure mode - tiles simply appear at full opacity the
      // instant they load, with no dependency on animation-frame timing.
      map = L.map(container, {
        center: [20.5937, 78.9629],
        zoom: 4,
        zoomControl: false,
        // Attribution is required by the tile provider's usage terms - see
        // the tile layer below for why this can no longer be disabled.
        attributionControl: true,
        fadeAnimation: false,
      });
      map.attributionControl.setPrefix(false);
    } catch (err) {
      console.error('[FlightMap] Leaflet map initialization failed:', err);
      return;
    }

    // Base tiles. NOT api.tile.openstreetmap.org: that endpoint is reserved
    // for light/casual use per OSM's tile usage policy and actively blocks
    // non-compliant clients by serving a small "418 Access Blocked" notice
    // image in place of real tiles - confirmed directly (fetched the tile
    // URL and inspected the actual PNG content) as the reason the map
    // looked blank. CyclOSM's community tile service explicitly allows
    // this kind of third-party app usage and was verified working the
    // same way (fetched and inspected real tile content) before switching.
    L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
      maxZoom: 20,
      subdomains: ['a', 'b', 'c'],
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, tiles by <a href="https://www.cyclosm.org">CyclOSM</a>',
    }).addTo(map);

    // Layer group for dynamic items (pins, aircraft, polylines)
    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapInstanceRef.current = map;
    setMapReady(true);

    // Leaflet measures its container's pixel size at init time to compute
    // tile positions. If that size isn't settled yet (CSS/webfonts/layout
    // still resolving right as this panel mounts, min-height-only parents,
    // etc.), tiles and markers can end up positioned outside the visible
    // area - a container that LOOKS empty even though Leaflet "succeeded".
    // A ResizeObserver re-measures whenever the container's actual size
    // changes (fires once immediately with the current size, then again
    // only on real changes) - not a continuous per-render resize loop.
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
    } else {
      // Fallback for an environment without ResizeObserver: one deferred
      // correction after initial layout should have settled.
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

  // Redraw the departure/arrival pins, route line, and fit the view. Keyed
  // on the flight's identity and its static geography - NOT on `live` - so
  // a live-position poll (every 60s) never tears down and refits the whole
  // map. That is handled separately, below.
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
          <div style="background: #0f172a; border: 2px solid #00f0ff; color: #00f0ff; border-radius: 9999px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; font-family: monospace; box-shadow: 0 0 14px rgba(0,240,255,0.45);">
            ${departure.iata || 'DEP'}
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const depMarker = L.marker(depLatLng, { icon: depIcon });
      depMarker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px;">
          <div style="color: #00f0ff; font-weight: 700; margin-bottom: 2px;">ORIGIN: ${departure.iata}</div>
          <div style="font-weight: 600; color: #fff;">${departure.name}</div>
          <div style="color: #94a3b8; font-size: 11px; margin-top: 4px;">${departure.city || ''}${departure.country ? ', ' + departure.country : ''}</div>
          ${departure.terminal ? `<div style="color: #cbd5e1; font-size: 11px; margin-top: 2px;">Terminal: ${departure.terminal} ${departure.gate ? `| Gate: ${departure.gate}` : ''}</div>` : ''}
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
          <div style="background: #0f172a; border: 2px solid #10b981; color: #10b981; border-radius: 9999px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; font-family: monospace; box-shadow: 0 0 14px rgba(16,185,129,0.45);">
            ${arrival.iata || 'ARR'}
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const arrMarker = L.marker(arrLatLng, { icon: arrIcon });
      arrMarker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px;">
          <div style="color: #10b981; font-weight: 700; margin-bottom: 2px;">DESTINATION: ${arrival.iata}</div>
          <div style="font-weight: 600; color: #fff;">${arrival.name}</div>
          <div style="color: #94a3b8; font-size: 11px; margin-top: 4px;">${arrival.city || ''}${arrival.country ? ', ' + arrival.country : ''}</div>
          ${arrival.terminal ? `<div style="color: #cbd5e1; font-size: 11px; margin-top: 2px;">Terminal: ${arrival.terminal} ${arrival.gate ? `| Gate: ${arrival.gate}` : ''}</div>` : ''}
        </div>
      `);
      layerGroup.addLayer(arrMarker);
    }

    // 3. Flight Route Line (if coordinates available)
    if (route && route.length > 0) {
      const polyline = L.polyline(route, {
        color: '#00f0ff',
        weight: 3,
        opacity: 0.75,
        dashArray: selectedFlight.hasLiveTracking ? '6, 8' : undefined,
        lineCap: 'round',
        lineJoin: 'round',
      });
      layerGroup.addLayer(polyline);
    }

    // The aircraft marker itself is created/updated by the effect below,
    // keyed on `live` alone - this only needs its coordinates (when
    // present) so the initial fit includes the aircraft, not just the
    // airports.
    if (live && isValidCoordinate(live.latitude, live.longitude)) {
      boundsPoints.push(L.latLng(live.latitude, live.longitude));
    }

    // Fit bounds smoothly to encapsulate the flight path
    if (boundsPoints.length > 0) {
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, {
        padding: [60, 60],
        maxZoom: 7,
        animate: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedFlight?.flightNumber,
    selectedFlight?.departure.latitude,
    selectedFlight?.departure.longitude,
    selectedFlight?.arrival.latitude,
    selectedFlight?.arrival.longitude,
    selectedFlight?.route,
    mapReady,
  ]);

  // Create/move the aircraft marker in place as fresh live-position polls
  // arrive, without touching the departure/arrival pins, the route line, or
  // the map's viewport (no `fitBounds` here) - per the requirement that a
  // live update must move the existing marker, not redraw the map.
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
        <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 42px; height: 42px; border-radius: 9999px; background: rgba(0, 240, 255, 0.2); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="transform: rotate(${heading}deg); transition: transform 0.5s ease-out; width: 36px; height: 36px; background: #00f0ff; border: 2px solid #ffffff; border-radius: 9999px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px #00f0ff;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#0b132b" stroke="#0b132b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
            </svg>
          </div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    const tooltipHtml = `
      <div style="font-family: sans-serif; font-size: 12px;">
        <div style="font-weight: 700; color: #00f0ff; font-size: 13px; font-family: monospace;">&#9992; ${selectedFlight?.flightNumber ?? ''}</div>
        <hr style="border: 0; border-top: 1px solid #334155; margin: 6px 0;" />
        <div style="color: #64748b;">Current Position:</div>
        <div style="color: #f8fafc; margin-bottom: 4px;">${live.latitude.toFixed(4)}, ${live.longitude.toFixed(4)}</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
          <div><span style="color: #64748b;">Altitude:</span> <b style="color: #f8fafc;">${live.altitude ? live.altitude.toLocaleString() + ' ft' : 'N/A'}</b></div>
          <div><span style="color: #64748b;">Speed:</span> <b style="color: #f8fafc;">${live.speed ? live.speed + ' km/h' : 'N/A'}</b></div>
          <div><span style="color: #64748b;">Heading:</span> <b style="color: #f8fafc;">${live.heading != null ? live.heading + '°' : 'N/A'}</b></div>
        </div>
      </div>
    `;

    if (aircraftMarkerRef.current) {
      // Already showing this flight's marker - move it and refresh its
      // icon/tooltip in place instead of recreating it.
      aircraftMarkerRef.current.setLatLng(planeLatLng);
      aircraftMarkerRef.current.setIcon(aircraftIcon);
      aircraftMarkerRef.current.setTooltipContent(tooltipHtml);
    } else {
      const planeMarker = L.marker(planeLatLng, { icon: aircraftIcon, zIndexOffset: 1000 });
      // Hover, not click: bindTooltip shows on mouseover/mouseout, unlike
      // bindPopup (click-triggered) used for the airport pins above.
      planeMarker.bindTooltip(tooltipHtml, {
        direction: 'top',
        offset: [0, -22],
        opacity: 1,
        className: 'aircraft-tooltip',
      });
      planeMarker.addTo(map);
      aircraftMarkerRef.current = planeMarker;
    }
  }, [selectedFlight?.live, selectedFlight?.flightNumber, mapReady]);

  // Controls Handlers
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

  const hasAircraftPosition = !!(
    selectedFlight?.live && isValidCoordinate(selectedFlight.live.latitude, selectedFlight.live.longitude)
  );

  const hasRoute = !!(selectedFlight?.route && selectedFlight.route.length > 0);

  return (
    <div className="relative w-full h-[380px] lg:h-[500px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
      {/* Map DOM Target - explicit height, not h-full/percentage: confirmed
          via a real browser measurement (getBoundingClientRect) that this
          card's parent chain does not establish a definite height, so a
          percentage height here was resolving to 0px at Leaflet init time
          - tiles loaded and were positioned, but into a zero-height
          viewport, i.e. nothing visible. An explicit height has no such
          dependency. */}
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
      <div className="absolute left-4 top-4 z-[1000] flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-xl shadow-xl">
        <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
        <span className="text-xs font-mono font-medium text-slate-200">
          {selectedFlight ? `RADAR // ${selectedFlight.flightNumber}` : 'RADAR // GLOBAL MAP'}
        </span>
        {selectedFlight && hasAircraftPosition && (
          <span className="text-[10px] font-mono font-semibold text-emerald-400 border-l border-slate-700 pl-2 ml-1">
            LIVE POSITION AVAILABLE
          </span>
        )}
      </div>

      {/* Notice Banner when Live Tracking Coordinates are Unavailable */}
      {selectedFlight && !hasAircraftPosition && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-[1000] max-w-sm bg-slate-900/95 backdrop-blur border border-amber-500/40 rounded-xl p-3 shadow-2xl flex items-center gap-2.5 text-xs text-amber-300">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Live position is currently unavailable for this flight.</span>
        </div>
      )}
    </div>
  );
};
