/**
 * SkyGrid Intelligence - Enterprise Aviation Risk Command Center
 * Akanno Tech Labs • Production B2B SaaS Platform
 * Bloomberg-grade Real-Time Flight Telemetry & MapLibre Vector Radar System
 * Strictly Typed Modern TypeScript Implementation
 */

import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { TacticalAudioSystem } from './audio';
import {
  FlightVector,
  CorridorMetric,
  TacticalDirective
} from './types/telemetry';
import {
  ApiKeyRecord,
  CommercialTierKey,
  InitiateCheckoutPayload,
  InitiateCheckoutResponse,
  CompleteCheckoutResponse
} from './types/licensing';
import {
  AirportHub,
  CorridorCameraPreset,
  FlightArcDefinition,
  LayerToggleState
} from './types/radar';
import {
  LiveSyncResponse,
  WebhookRecord,
  DispatchAlertRecord,
  ComplianceAuditRecord,
  SystemStatusResponse
} from './types/system';
import {
  AIR_CORRIDORS as DEFAULT_AIR_CORRIDORS,
  INITIAL_FLIGHTS,
  INITIAL_DIRECTIVES as DEFAULT_DIRECTIVES
} from './data/mockData';
import { apiClient } from './api/client';

export type AppRoute = '/' | '/dashboard';

/**
 * Resilient Centralized API Fetcher
 * Routes automatically through VITE_API_BASE_URL (Render backend) or relative path
 */
export function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const fullUrl = apiClient.getFullUrl(path);
  return fetch(fullUrl, options);
}

/**
 * Client-Side SPA Navigation Router
 * Seamlessly routes between the Public Landing Page (/) and Command Center (/dashboard)
 */
export function navigateTo(route: string, updateHistory = true): void {
  audio.playClick();
  const normalizedRoute: AppRoute = (route === '/dashboard' || route.startsWith('/dashboard')) ? '/dashboard' : '/';

  if (updateHistory && typeof window !== 'undefined' && window.location.pathname !== normalizedRoute) {
    window.history.pushState({}, '', normalizedRoute);
  }

  const landingEl = document.getElementById('landing-page-view');
  const dashboardEl = document.getElementById('dashboard-view');

  if (normalizedRoute === '/dashboard') {
    landingEl?.classList.add('hidden');
    dashboardEl?.classList.remove('hidden');
    document.title = 'SkyGrid Intelligence | Live Aviation Command Center | Akanno Tech Labs';
    
    // Resize MapLibre canvas on reveal so viewport calculates proper dimensions
    setTimeout(() => {
      if (map) {
        map.resize();
      } else if (!mapInitialized) {
        initMapLibreRadar();
      }
    }, 150);
  } else {
    dashboardEl?.classList.add('hidden');
    landingEl?.classList.remove('hidden');
    document.title = 'SkyGrid Intelligence | Sovereign Aviation Risk Intelligence | Akanno Tech Labs';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/**
 * Transmit Enterprise Partnership Enquiry
 */
export function submitPartnershipEnquiry(): void {
  audio.playDirectiveChime();
  const nameInput = document.getElementById('enquiry-name') as HTMLInputElement | null;
  const orgInput = document.getElementById('enquiry-org') as HTMLInputElement | null;
  const emailInput = document.getElementById('enquiry-email') as HTMLInputElement | null;
  const messageInput = document.getElementById('enquiry-message') as HTMLTextAreaElement | null;
  const banner = document.getElementById('enquiry-success-banner');
  const refIdEl = document.getElementById('enquiry-ref-id');
  const btn = document.getElementById('btn-enquiry-submit') as HTMLButtonElement | null;

  const randomRef = `AT-ENQ-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  if (refIdEl) refIdEl.textContent = randomRef;

  if (banner) {
    banner.classList.remove('hidden');
    banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (btn) {
    btn.innerHTML = '<span>✓ ENQUIRY TRANSMITTED</span>';
    btn.classList.add('opacity-75');
  }

  if (nameInput) nameInput.value = '';
  if (orgInput) orgInput.value = '';
  if (emailInput) emailInput.value = '';
  if (messageInput) messageInput.value = '';
}

// Map of Air Corridors indexed by ID
const CORRIDOR_MAP: Record<string, CorridorMetric> = {};
DEFAULT_AIR_CORRIDORS.forEach((c) => {
  CORRIDOR_MAP[c.id] = c;
});

let FLIGHTS_DATA: FlightVector[] = [...INITIAL_FLIGHTS];
let DIRECTIVES_LOG: TacticalDirective[] = [...DEFAULT_DIRECTIVES];

// Tactical Web Audio Synthesizer
const audio = new TacticalAudioSystem();

// Application State
let activeCorridorKey: string = 'dxb-primary';
let currentFilter: string = 'all';
let selectedFlight: FlightVector | null = null;
const layersState: LayerToggleState = { vectors: true, sweep: true };
let radarViewMode: '3d' | '2d' = '3d';
const activeApiKey: string = 'sk_live_akanno_sovereign_dxb_001';

// Strategic Geographic Airport Hub Coordinates
const AIRPORT_HUBS: AirportHub[] = [
  { code: 'OMDB / DXB', name: 'Dubai International Mega-Terminal', city: 'Dubai, UAE', coords: [55.3657, 25.2532], isPrimary: true, role: 'Primary Cargo Mega-Terminal & Strategic Hub' },
  { code: 'OMDW / DWC', name: 'Al Maktoum International Logistics', city: 'Jebel Ali, UAE', coords: [55.1614, 24.8967], isPrimary: true, role: 'Logistics Superhub & Dual Runway Sync' },
  { code: 'OTHH / DOH', name: 'Hamad International', city: 'Doha, Qatar', coords: [51.6080, 25.2731], isPrimary: false, role: 'Gulf Inter-Hub High-Speed Vector' },
  { code: 'EGLL / LHR', name: 'London Heathrow Cargo Terminal', city: 'London, UK', coords: [-0.4614, 51.4700], isPrimary: false, role: 'Transatlantic Axis Gateway' },
  { code: 'WSSS / SIN', name: 'Singapore Changi Cargo Hub', city: 'Singapore', coords: [103.9915, 1.3644], isPrimary: false, role: 'Southeast Asia Gateway' },
  { code: 'EDDF / FRA', name: 'Frankfurt CargoCity', city: 'Frankfurt, Germany', coords: [8.5706, 50.0379], isPrimary: false, role: 'European Continental Cargo Hub' },
  { code: 'KORD / ORD', name: 'Chicago O’Hare Intermodal Terminal', city: 'Chicago, USA', coords: [-87.9073, 41.9742], isPrimary: false, role: 'North American Trans-Polar Hub' },
  { code: 'EDDP / LEJ', name: 'Leipzig/Halle Cargo Hub', city: 'Leipzig, Germany', coords: [12.2364, 51.4239], isPrimary: false, role: 'DHL European Express Superhub' },
  { code: 'VHHH / HKG', name: 'Hong Kong SuperTerminal 1', city: 'Hong Kong', coords: [113.9145, 22.3080], isPrimary: false, role: 'Greater Bay Area Pacific Axis' },
  { code: 'ELLX / LUX', name: 'Luxembourg Findel Cargo Hub', city: 'Luxembourg', coords: [6.2158, 49.6233], isPrimary: false, role: 'Cargolux Global Headquarters' },
  { code: 'YSSY / SYD', name: 'Sydney Kingsford Smith', city: 'Sydney, Australia', coords: [151.1772, -33.9461], isPrimary: false, role: 'Trans-Oceanic Southern Axis' }
];

// Corridor Camera Orientations (Real Geographic Targets with 3D Pitch: 45)
const CORRIDOR_CAMERA_TARGETS: Record<string, CorridorCameraPreset> = {
  'dxb-primary': {
    center: [55.3657, 25.2532],
    zoom: 9.2,
    pitch: 45,
    bearing: -20,
    duration: 2200
  },
  'doh-dxb': {
    center: [53.5000, 25.3200],
    zoom: 7.5,
    pitch: 45,
    bearing: -15,
    duration: 2200
  },
  'sin-dxb': {
    center: [78.0000, 16.0000],
    zoom: 4.4,
    pitch: 40,
    bearing: -30,
    duration: 2800
  },
  'lhr-dxb': {
    center: [35.0000, 36.0000],
    zoom: 4.2,
    pitch: 45,
    bearing: -10,
    duration: 2800
  },
  'dwc-expansion': {
    center: [55.1614, 24.8967],
    zoom: 11.5,
    pitch: 50,
    bearing: 15,
    duration: 2200
  }
};

// MapLibre GL Instances & Tracking
let map: maplibregl.Map | null = null;
let mapInitialized: boolean = false;
const aircraftMarkers: Record<string, { marker: maplibregl.Marker; el: HTMLElement; flight: FlightVector }> = {};
let hubMarkers: maplibregl.Marker[] = [];
let movementInterval: ReturnType<typeof setInterval> | null = null;
let currentSweepAzimuth: number = 184;

// Precise geodesic circle generator for tactical range rings
function createRangeRingCoordinates(center: [number, number], radiusKm: number, points: number = 64): [number, number][] {
  const coords: [number, number][] = [];
  const kmPerLng = 111.320 * Math.cos((center[1] * Math.PI) / 180);
  const kmPerLat = 110.574;
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * (2 * Math.PI);
    const lng = center[0] + (radiusKm * Math.cos(angle)) / kmPerLng;
    const lat = center[1] + (radiusKm * Math.sin(angle)) / kmPerLat;
    coords.push([lng, lat]);
  }
  return coords;
}

// Curved Bezier arc between two geographic hubs
function generateCurvedArc(start: [number, number], end: [number, number], numPoints: number = 40): [number, number][] {
  const points: [number, number][] = [];
  const midLng = (start[0] + end[0]) / 2;
  const isLongRange = Math.abs(start[0] - end[0]) > 25;
  const arcDeflection = isLongRange ? 4.8 : 0.85;
  const midLat = (start[1] + end[1]) / 2 + arcDeflection;

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const lng = (1 - t) * (1 - t) * start[0] + 2 * (1 - t) * t * midLng + t * t * end[0];
    const lat = (1 - t) * (1 - t) * start[1] + 2 * (1 - t) * t * midLat + t * t * end[1];
    points.push([lng, lat]);
  }
  return points;
}

// Initialize MapLibre GL Vector Radar
export function initMapLibreRadar(): void {
  const container = document.getElementById('tactical-map-container') || document.getElementById('radar-canvas-container');
  if (!container) return;

  const cartoDarkStyle = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

  try {
    map = new maplibregl.Map({
      container: container,
      style: cartoDarkStyle,
      center: [55.3657, 25.2532], // Centered on OMDB / DXB
      zoom: 9.0,
      pitch: 45, // Tilted 3D pitch
      bearing: -20,
      attributionControl: false
    });

    map.on('move', () => {
      if (!map) return;
      const pitchEl = document.getElementById('radar-pitch-display');
      const bearingEl = document.getElementById('radar-bearing-display');
      const zoomEl = document.getElementById('radar-zoom-level');
      if (pitchEl) pitchEl.textContent = `${Math.round(map.getPitch())}°`;
      if (bearingEl) bearingEl.textContent = `${Math.round(map.getBearing())}°`;
      if (zoomEl) zoomEl.textContent = `${Math.round(map.getZoom() * 11)}%`;
    });

    map.on('load', () => {
      mapInitialized = true;
      addRangeRingsLayers();
      addFlightPathArcLayers();
      renderHubBeaconMarkers();
      renderMovingAircraftMarkers();
      startAircraftMovementLoop();
      startAzimuthSweepSimulation();
    });

    map.on('error', (e: unknown) => {
      console.warn('[MAPLIBRE WARNING]', e);
    });

  } catch (err) {
    console.error('[MAPLIBRE INIT ERROR]', err);
  }
}

// Add Range Rings GeoJSON Layers (25NM, 50NM, 100NM centered on DXB)
function addRangeRingsLayers(): void {
  if (!map) return;
  const dxbCenter: [number, number] = [55.3657, 25.2532];
  const ring25 = createRangeRingCoordinates(dxbCenter, 46.3);
  const ring50 = createRangeRingCoordinates(dxbCenter, 92.6);
  const ring100 = createRangeRingCoordinates(dxbCenter, 185.2);

  const rangeRingsGeoJSON = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: { name: '25 NM RING', color: '#22d3ee', opacity: 0.65, width: 1.5 },
        geometry: { type: 'LineString' as const, coordinates: ring25 }
      },
      {
        type: 'Feature' as const,
        properties: { name: '50 NM RING', color: '#06b6d4', opacity: 0.5, width: 1.2 },
        geometry: { type: 'LineString' as const, coordinates: ring50 }
      },
      {
        type: 'Feature' as const,
        properties: { name: '100 NM RING', color: '#0e7490', opacity: 0.4, width: 1.0 },
        geometry: { type: 'LineString' as const, coordinates: ring100 }
      }
    ]
  };

  if (!map.getSource('dxb-range-rings')) {
    map.addSource('dxb-range-rings', {
      type: 'geojson',
      data: rangeRingsGeoJSON
    });

    map.addLayer({
      id: 'dxb-range-rings-line',
      type: 'line',
      source: 'dxb-range-rings',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'width'],
        'line-dasharray': [2, 2],
        'line-opacity': ['get', 'opacity']
      }
    });
  }
}

// Add Animated GeoJSON Flight Path Arcs connecting Origin & Destination Hubs
function addFlightPathArcLayers(): void {
  if (!map) return;
  const hubCoords: Record<string, [number, number]> = {};
  AIRPORT_HUBS.forEach((h) => {
    const key = h.code.split('/')[1]?.trim() ?? h.code.split('/')[0]?.trim() ?? h.code;
    hubCoords[key] = h.coords;
  });

  const corridorConnections: FlightArcDefinition[] = [
    { from: 'FRA', to: 'DXB', color: '#22d3ee', callsign: 'EK-902' },
    { from: 'ORD', to: 'DXB', color: '#22d3ee', callsign: 'ATLAS-81' },
    { from: 'LEJ', to: 'DWC', color: '#10b981', callsign: 'DHL-109' },
    { from: 'SIN', to: 'DXB', color: '#22d3ee', callsign: 'SQ-77' },
    { from: 'DOH', to: 'DXB', color: '#10b981', callsign: 'QTR-994' },
    { from: 'HKG', to: 'DWC', color: '#f59e0b', callsign: 'CPA-63' },
    { from: 'SYD', to: 'DXB', color: '#10b981', callsign: 'UAE-9902' },
    { from: 'LUX', to: 'DXB', color: '#ef4444', callsign: 'CLX-714' },
    { from: 'LHR', to: 'DXB', color: '#22d3ee', callsign: 'BAW-208' },
  ];

  const arcFeatures: Array<{
    type: 'Feature';
    properties: { from: string; to: string; color: string; callsign: string };
    geometry: { type: 'LineString'; coordinates: [number, number][] };
  }> = [];

  corridorConnections.forEach((conn) => {
    const fromCoord = hubCoords[conn.from];
    const toCoord = hubCoords[conn.to];
    if (fromCoord && toCoord) {
      const arcPoints = generateCurvedArc(fromCoord, toCoord);
      arcFeatures.push({
        type: 'Feature',
        properties: {
          from: conn.from,
          to: conn.to,
          color: conn.color,
          callsign: conn.callsign
        },
        geometry: {
          type: 'LineString',
          coordinates: arcPoints
        }
      });
    }
  });

  if (!map.getSource('flight-arcs')) {
    map.addSource('flight-arcs', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: arcFeatures
      }
    });

    map.addLayer({
      id: 'flight-arcs-glow',
      type: 'line',
      source: 'flight-arcs',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 3.5,
        'line-opacity': 0.35,
        'line-blur': 2.5
      }
    });

    map.addLayer({
      id: 'flight-arcs-core',
      type: 'line',
      source: 'flight-arcs',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.6,
        'line-opacity': 0.8,
        'line-dasharray': [3, 2]
      }
    });
  }
}

// Render Glowing Cyan / Emerald Airport Beacons (OMDB, OMDW, OTHH, EGLL, WSSS, etc.)
function renderHubBeaconMarkers(): void {
  if (!map) return;
  hubMarkers.forEach((m) => m.remove());
  hubMarkers = [];

  AIRPORT_HUBS.forEach((hub) => {
    const el = document.createElement('div');
    el.className = 'tactical-hub-beacon';
    const shortLabel = hub.code.split('/')[1]?.trim() ?? hub.code;
    el.innerHTML = `
      <div class="hub-beacon-pulse ${hub.isPrimary ? 'primary' : ''}"></div>
      <div class="hub-beacon-core ${hub.isPrimary ? 'primary' : ''}"></div>
      <div class="hub-beacon-label ${hub.isPrimary ? 'primary' : ''}">${shortLabel}</div>
    `;

    const popupHtml = `
      <div class="font-mono text-xs">
        <div class="flex items-center justify-between border-b border-cyan-500/30 pb-1 mb-1.5">
          <span class="text-cyan-300 font-extrabold">${hub.code}</span>
          <span class="text-[9px] px-1.5 py-0.2 rounded ${hub.isPrimary ? 'bg-emerald-950 text-emerald-300 border border-emerald-600' : 'bg-slate-800 text-slate-300'} font-bold">
            ${hub.isPrimary ? 'STRATEGIC HUB' : 'EXTERNAL NODE'}
          </span>
        </div>
        <div class="text-white font-bold">${hub.name}</div>
        <div class="text-slate-400 text-[11px]">${hub.city}</div>
        <div class="text-cyan-400 text-[10px] mt-1">${hub.role}</div>
        <div class="text-slate-500 text-[9px] mt-1">POS: ${hub.coords[1].toFixed(4)}°N, ${hub.coords[0].toFixed(4)}°E</div>
      </div>
    `;

    const popup = new maplibregl.Popup({ offset: 15, closeButton: true, maxWidth: '280px' })
      .setHTML(popupHtml);

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat(hub.coords)
      .setPopup(popup)
      .addTo(map!);

    hubMarkers.push(marker);
  });
}

// Render Moving Aircraft Markers with Clickable Popups
function renderMovingAircraftMarkers(): void {
  if (!map) return;

  FLIGHTS_DATA.forEach((flight) => {
    let colorHex = '#10b981';
    let riskPillClass = 'bg-emerald-950 text-emerald-400 border border-emerald-600';
    if (flight.riskCategory === 'watch') {
      colorHex = '#22d3ee';
      riskPillClass = 'bg-cyan-950 text-cyan-300 border border-cyan-600';
    } else if (flight.riskCategory === 'elevated') {
      colorHex = '#f59e0b';
      riskPillClass = 'bg-amber-950 text-amber-300 border border-amber-600';
    } else if (flight.riskCategory === 'critical') {
      colorHex = '#ef4444';
      riskPillClass = 'bg-red-950 text-red-400 border border-red-600';
    }

    const existing = aircraftMarkers[flight.id];
    if (existing) {
      existing.marker.setLngLat([flight.lng, flight.lat]);
      const iconBox = existing.el.querySelector('.plane-icon-box') as HTMLElement | null;
      if (iconBox) {
        iconBox.style.transform = `rotate(${flight.heading}deg)`;
      }
      return;
    }

    const el = document.createElement('div');
    el.className = 'tactical-plane-marker';
    el.innerHTML = `
      <div class="plane-icon-box" style="transform: rotate(${flight.heading}deg);">
        <svg class="plane-icon-svg" viewBox="0 0 24 24" fill="${colorHex}">
          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
        </svg>
      </div>
      <div class="plane-tag">
        <span class="font-bold text-white">${flight.callsign}</span>
        <span class="cri-pill ${riskPillClass}">${Number(flight.riskScore).toFixed(1)}%</span>
      </div>
    `;

    const popupHtml = `
      <div class="font-mono text-xs">
        <div class="flex items-center justify-between border-b border-cyan-500/30 pb-1 mb-2">
          <span class="text-white font-extrabold text-sm">${flight.callsign}</span>
          <span class="px-1.5 py-0.2 rounded text-[10px] font-bold ${riskPillClass}">
            CRI: ${Number(flight.riskScore).toFixed(1)}%
          </span>
        </div>
        <div class="text-cyan-300 font-semibold text-[11px]">${flight.aircraft} • ${flight.carrier}</div>
        <div class="grid grid-cols-2 gap-1.5 my-2 text-[11px] bg-obsidian-950 p-2 rounded border border-slate-800">
          <div><span class="text-slate-400">ROUTE:</span> <span class="text-white font-bold">${flight.origin} → ${flight.destination}</span></div>
          <div><span class="text-slate-400">ALTITUDE:</span> <span class="text-cyan-300 font-bold">${flight.flightLevel}</span></div>
          <div><span class="text-slate-400">SPEED:</span> <span class="text-white font-bold">${flight.speed} kts</span></div>
          <div><span class="text-slate-400">HEADING:</span> <span class="text-white font-bold">${flight.heading}°</span></div>
        </div>
        <div class="text-[10px] text-slate-300 mb-2 truncate">PAYLOAD: ${flight.cargoPayload}</div>
        <button onclick="window.openFlightModal('${flight.id}')" class="w-full py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 font-bold rounded text-[11px] transition-colors">
          INSPECT TACTICAL DOSSIER
        </button>
      </div>
    `;

    const popup = new maplibregl.Popup({ offset: 20, closeButton: true, maxWidth: '300px' })
      .setHTML(popupHtml);

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([flight.lng, flight.lat])
      .setPopup(popup)
      .addTo(map!);

    aircraftMarkers[flight.id] = { marker, el, flight };
  });
}

// Smooth Continuous Movement Loop for Active Vectors
function startAircraftMovementLoop(): void {
  if (movementInterval) clearInterval(movementInterval);
  movementInterval = setInterval(() => {
    FLIGHTS_DATA.forEach((flight) => {
      const rad = (flight.heading * Math.PI) / 180;
      const speedFactor = 0.00035 * (flight.speed / 450);
      flight.lng += Math.sin(rad) * speedFactor;
      flight.lat += Math.cos(rad) * speedFactor;

      // Wrap vectors smoothly around Dubai terminal airspace
      if (flight.lng > 56.6) flight.lng = 54.7;
      if (flight.lng < 54.2) flight.lng = 55.9;
      if (flight.lat > 26.1) flight.lat = 24.7;
      if (flight.lat < 24.6) flight.lat = 25.6;

      const markerObj = aircraftMarkers[flight.id];
      if (markerObj) {
        markerObj.marker.setLngLat([flight.lng, flight.lat]);
      }
    });
  }, 1200);
}

// Tactical Azimuth Sweep Compass Simulator
function startAzimuthSweepSimulation(): void {
  setInterval(() => {
    currentSweepAzimuth = (currentSweepAzimuth + 2) % 360;
    const azEl = document.getElementById('radar-azimuth');
    if (azEl) {
      azEl.textContent = `${currentSweepAzimuth}°`;
    }
  }, 100);
}

// Camera Controls: Recenter, 3D Pitch / 2D Plan Scope, Zoom
export function recenterRadar(playSound: boolean = true): void {
  if (playSound) audio.playClick();
  if (map) {
    map.flyTo({
      center: [55.3657, 25.2532],
      zoom: 9.0,
      pitch: radarViewMode === '3d' ? 45 : 0,
      bearing: radarViewMode === '3d' ? -20 : 0,
      duration: 1800
    });
  }
}

export function zoomRadar(factor: number): void {
  audio.playClick();
  if (map) {
    if (factor > 1) {
      map.zoomIn();
    } else {
      map.zoomOut();
    }
  }
}

export function setRadarViewMode(mode: '3d' | '2d'): void {
  audio.playClick();
  radarViewMode = mode;
  const btn3D = document.getElementById('btn-mode-3d');
  const btn2D = document.getElementById('btn-mode-2d');

  if (mode === '3d') {
    if (btn3D) btn3D.className = 'px-2.5 py-1 text-[11px] rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm transition-all';
    if (btn2D) btn2D.className = 'px-2.5 py-1 text-[11px] rounded text-slate-400 hover:text-white transition-all';
    if (map) {
      map.easeTo({ pitch: 45, bearing: -20, duration: 1200 });
    }
  } else {
    if (btn2D) btn2D.className = 'px-2.5 py-1 text-[11px] rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm transition-all';
    if (btn3D) btn3D.className = 'px-2.5 py-1 text-[11px] rounded text-slate-400 hover:text-white transition-all';
    if (map) {
      map.easeTo({ pitch: 0, bearing: 0, duration: 1200 });
    }
  }
}

export function toggleLayer(layer: 'vectors' | 'sweep'): void {
  audio.playClick();
  layersState[layer] = !layersState[layer];
  const btn = document.getElementById(`btn-toggle-${layer}`);

  if (layer === 'vectors') {
    Object.values(aircraftMarkers).forEach((m) => {
      m.el.style.display = layersState.vectors ? 'flex' : 'none';
    });
  }
  if (layer === 'sweep' && map) {
    if (map.getLayer('dxb-range-rings-line')) {
      map.setLayoutProperty('dxb-range-rings-line', 'visibility', layersState.sweep ? 'visible' : 'none');
    }
  }

  if (btn) {
    if (layersState[layer]) {
      btn.className = 'px-2 py-1 text-[11px] rounded bg-obsidian-850 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-950 font-bold';
    } else {
      btn.className = 'px-2 py-1 text-[11px] rounded bg-obsidian-850 border border-slate-800 text-slate-500 hover:text-slate-300';
    }
  }
}

// Fallback compatibility
export function createFlightArcsAndVectors(): void {
  if (mapInitialized) {
    renderMovingAircraftMarkers();
  }
}

// ==================== LIVE BACKEND SYNCHRONIZATION ====================

export async function fetchLiveBackendTelemetry(): Promise<void> {
  try {
    const res = await apiFetch(`/api/v1/corridor/live?corridor_id=${activeCorridorKey}`, {
      headers: { 'x-api-key': activeApiKey }
    });
    if (res.ok) {
      const data: LiveSyncResponse = await res.json();
      const corridor = data.corridor;
      const weather = data.weather;
      const stats = data.cache_stats;

      // Update Top Metrics Cards
      const vecEl = document.getElementById('metric-vectors');
      if (vecEl && corridor.activeVectors) vecEl.textContent = corridor.activeVectors.toLocaleString();

      const riskEl = document.getElementById('metric-risk-index');
      if (riskEl && corridor.riskIndex !== undefined) riskEl.textContent = Number(corridor.riskIndex).toFixed(1);

      const tputEl = document.getElementById('metric-throughput');
      if (tputEl && corridor.throughputTonnesPerHour !== undefined) tputEl.textContent = Number(corridor.throughputTonnesPerHour).toFixed(1);

      const dirEl = document.getElementById('metric-directives');
      if (dirEl && corridor.autonomousDirectivesCount !== undefined) dirEl.textContent = String(corridor.autonomousDirectivesCount);

      // Update Overall Risk Gauge
      const gaugeValEl = document.getElementById('risk-gauge-val');
      const gaugeArc = document.getElementById('risk-gauge-arc');
      const val = corridor.overallRiskGauge || 28;
      if (gaugeValEl) {
        gaugeValEl.textContent = `${Math.round(val)}%`;
      }
      if (gaugeArc) {
        const targetOffset = 301.59 - (301.59 * (val / 100) * 0.82);
        gaugeArc.style.strokeDashoffset = String(targetOffset);
      }

      // Update weather & windshear bar
      const shearVal = weather.windshear_index_kts || 8.0;
      const shearEl = document.getElementById('comp-windshear-val');
      const shearBar = document.getElementById('comp-windshear-bar');
      if (shearEl) shearEl.innerHTML = `${shearVal} kts <span class="text-slate-500 font-normal">/ 25 max</span>`;
      if (shearBar) shearBar.style.width = `${Math.min(100, (shearVal / 25) * 100)}%`;

      // Update Top Bar DB / Cache Indicators
      const dbText = document.getElementById('db-status-text');
      const dbDot = document.getElementById('db-status-dot');
      if (dbText && stats.db_engine) {
        dbText.textContent = stats.db_engine.toUpperCase();
        if (dbDot) {
          dbDot.className = stats.db_engine.includes('Postgre')
            ? 'w-2 h-2 rounded-full bg-cyan-400 animate-pulse'
            : 'w-2 h-2 rounded-full bg-emerald-400';
        }
      }

      const syncTimer = document.getElementById('sync-timer-label');
      if (syncTimer && stats.seconds_until_next_poll !== undefined) {
        syncTimer.textContent = `${stats.seconds_until_next_poll}s TTL`;
      }
    }
  } catch (e) {
    console.warn('[SKYGRID LIVE PULL ERROR]', e);
  }

  // Fetch Live Flights Telemetry
  try {
    const flightRes = await apiFetch('/api/v1/telemetry/flights', {
      headers: { 'x-api-key': activeApiKey }
    });
    if (flightRes.ok) {
      const flightData: { count: number; flights: FlightVector[] } = await flightRes.json();
      if (flightData.flights && flightData.flights.length > 0) {
        FLIGHTS_DATA = flightData.flights;
        renderFlightFeed();
        createFlightArcsAndVectors();
      }
    }
  } catch (e) {
    // ignore
  }
}

// Render Live Flight Sidebar Feed
export function renderFlightFeed(): void {
  const container = document.getElementById('flight-feed-list');
  if (!container) return;

  const searchInput = document.getElementById('flight-search') as HTMLInputElement | null;
  const searchQuery = (searchInput?.value ?? '').toLowerCase();

  const filtered = FLIGHTS_DATA.filter((f) => {
    const matchesFilter = currentFilter === 'all' || f.riskCategory === currentFilter;
    const matchesSearch =
      f.callsign.toLowerCase().includes(searchQuery) ||
      f.carrier.toLowerCase().includes(searchQuery) ||
      f.origin.toLowerCase().includes(searchQuery) ||
      f.destination.toLowerCase().includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  const countBadge = document.getElementById('feed-count-badge');
  if (countBadge) {
    countBadge.textContent = `${filtered.length} VECTORS`;
  }

  container.innerHTML = filtered.map((flight) => {
    let riskBadgeColor = 'text-emerald-400 bg-emerald-950/80 border-emerald-800';
    let cardBorder = 'border-slate-800/80 hover:border-cyan-500/40';

    if (flight.riskCategory === 'watch') {
      riskBadgeColor = 'text-cyan-400 bg-cyan-950/80 border-cyan-800';
    } else if (flight.riskCategory === 'elevated') {
      riskBadgeColor = 'text-amber-400 bg-amber-950/80 border-amber-800';
      cardBorder = 'border-amber-500/30 hover:border-amber-400/60 bg-amber-950/10';
    } else if (flight.riskCategory === 'critical') {
      riskBadgeColor = 'text-red-400 bg-red-950/80 border-red-800';
      cardBorder = 'border-red-500/40 hover:border-red-400/80 bg-red-950/20';
    }

    return `
      <div onclick="window.openFlightModal('${flight.id}')" class="p-3 rounded-lg obsidian-card ${cardBorder} cursor-pointer transition-all hover:scale-[1.01] group relative">
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center space-x-2">
            <span class="font-extrabold text-white text-xs font-mono group-hover:text-cyan-300 transition-colors">${flight.callsign}</span>
            <span class="text-[10px] text-slate-400 font-mono">${flight.aircraft}</span>
          </div>
          <div class="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono border ${riskBadgeColor}">
            ${flight.riskScore.toFixed(1)}% CRI
          </div>
        </div>
        <div class="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-2">
          <span>${flight.carrier}</span>
          <span class="text-slate-300 font-semibold">${flight.origin} → ${flight.destination}</span>
        </div>
        <div class="grid grid-cols-4 gap-1 text-[10px] font-mono bg-obsidian-900/60 p-1.5 rounded border border-slate-800/60 text-slate-300">
          <div><span class="text-slate-500 block">ALT</span>${flight.flightLevel}</div>
          <div><span class="text-slate-500 block">SPD</span>${flight.speed}kt</div>
          <div><span class="text-slate-500 block">MACH</span>${flight.mach.toFixed(2)}</div>
          <div class="text-right"><span class="text-slate-500 block">HDG</span>${flight.heading}°</div>
        </div>
      </div>
    `;
  }).join('');
}

export function setFlightFilter(filter: string): void {
  audio.playClick();
  currentFilter = filter;
  ['all', 'minimal', 'low', 'watch', 'elevated'].forEach((f) => {
    const btn = document.getElementById(`filter-btn-${f}`);
    if (btn) {
      if (f === filter) {
        btn.className = 'px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold';
      } else {
        btn.className = 'px-2 py-0.5 rounded bg-obsidian-850 border border-slate-800 text-slate-400 hover:text-white';
      }
    }
  });
  renderFlightFeed();
}

export function filterFlights(): void {
  renderFlightFeed();
}

export function handleCorridorChange(corridorKey: string): void {
  audio.playClick();
  activeCorridorKey = corridorKey;
  fetchLiveBackendTelemetry();

  const preset = CORRIDOR_CAMERA_TARGETS[corridorKey];
  if (map && preset) {
    map.flyTo(preset);
  }
}

export function toggleAudioFeedback(): void {
  audio.enabled = !audio.enabled;
  const onIcon = document.getElementById('audio-icon-on');
  const offIcon = document.getElementById('audio-icon-off');
  if (audio.enabled) {
    onIcon?.classList.remove('hidden');
    offIcon?.classList.add('hidden');
    audio.playClick();
  } else {
    onIcon?.classList.add('hidden');
    offIcon?.classList.remove('hidden');
  }
}

// Clock updates
function updateClocks(): void {
  const now = new Date();
  const gstEl = document.getElementById('clock-gst');
  const utcEl = document.getElementById('clock-utc');

  if (gstEl) {
    const gstTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dubai',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(now);
    gstEl.textContent = `${gstTime} GST`;
  }

  if (utcEl) {
    const utcTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(now);
    utcEl.textContent = `${utcTime} Z`;
  }
}

// ==================== MODALS & TACTICAL DOSSIERS ====================

export function openFlightModal(flightId: string): void {
  const flight = FLIGHTS_DATA.find((f) => f.id === flightId);
  if (!flight) return;
  selectedFlight = flight;
  audio.playClick();

  const modal = document.getElementById('flight-dossier-modal');
  if (!modal) return;

  const setText = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setText('modal-callsign', flight.callsign);
  setText('modal-carrier', flight.carrier);
  setText('modal-aircraft', flight.aircraft);
  setText('modal-route', `${flight.origin} (${flight.originCity}) → ${flight.destination} (${flight.destinationCity})`);
  setText('modal-altitude', `${flight.altitude.toLocaleString()} FT (${flight.flightLevel})`);
  setText('modal-speed', `${flight.speed} KTS / Mach ${flight.mach.toFixed(2)}`);
  setText('modal-heading', `${flight.heading}° TRUE`);
  setText('modal-coords', `${flight.lat.toFixed(4)}°N, ${flight.lng.toFixed(4)}°E`);
  setText('modal-transponder', flight.transponder);
  setText('modal-payload', `${flight.cargoPayload} (${flight.cargoWeightTonnes} Tonnes)`);
  setText('modal-eta', `${flight.etaMinutes} MINS`);
  setText('modal-hazard-note', flight.hazardNote ?? 'Nominal flight envelope confirmed.');

  const riskBadge = document.getElementById('modal-risk-badge');
  if (riskBadge) {
    riskBadge.textContent = `${flight.riskScore.toFixed(1)}% CRI`;
    riskBadge.className = `px-2 py-0.5 rounded text-xs font-bold font-mono border ${
      flight.riskCategory === 'critical' || flight.riskCategory === 'elevated'
        ? 'bg-red-950 text-red-400 border-red-700'
        : flight.riskCategory === 'watch'
          ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
          : 'bg-emerald-950 text-emerald-400 border-emerald-700'
    }`;
  }

  modal.classList.remove('hidden');
}

export function closeFlightModal(): void {
  audio.playClick();
  const modal = document.getElementById('flight-dossier-modal');
  modal?.classList.add('hidden');
}

export async function executeFlightDeconfliction(): Promise<void> {
  if (!selectedFlight) return;
  audio.playDirectiveChime();

  try {
    const res = await apiFetch('/api/v1/directives/evaluate', {
      method: 'POST',
      headers: {
        'x-api-key': activeApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        flight_id: selectedFlight.id,
        callsign: selectedFlight.callsign,
        target_action: 'AUTONOMOUS_VECTOR_DECONFLICTION'
      })
    });

    if (res.ok) {
      const data = await res.json();
      selectedFlight.riskScore = data.flight_telemetry.riskScore;
      selectedFlight.riskCategory = data.flight_telemetry.riskCategory;
      selectedFlight.status = 'Vector Corrected';
      selectedFlight.hazardNote = data.flight_telemetry.hazardNote;

      createFlightArcsAndVectors();
      renderFlightFeed();
      closeFlightModal();
      return;
    }
  } catch {
    // fallback local resolution
  }

  selectedFlight.riskScore = Math.max(3.2, Number((selectedFlight.riskScore - 14.5).toFixed(1)));
  selectedFlight.riskCategory = 'minimal';
  selectedFlight.status = 'Vector Corrected';
  selectedFlight.hazardNote = 'AI Resolution applied: Vector stepped down by 2,000 ft; laminar separation restored.';

  createFlightArcsAndVectors();
  renderFlightFeed();
  closeFlightModal();
}

export function focusOnFlightInRadar(): void {
  if (!selectedFlight) return;
  audio.playClick();
  closeFlightModal();

  if (map) {
    map.flyTo({
      center: [selectedFlight.lng, selectedFlight.lat],
      zoom: 11.2,
      pitch: 50,
      bearing: selectedFlight.heading ? (selectedFlight.heading - 45) : -20,
      duration: 1800
    });
    const markerObj = aircraftMarkers[selectedFlight.id];
    if (markerObj?.marker) {
      markerObj.marker.togglePopup();
    }
  }
}

export function openDirectivesModal(): void {
  audio.playClick();
  const listEl = document.getElementById('directives-modal-list');
  if (listEl) {
    listEl.innerHTML = DIRECTIVES_LOG.map((d) => `
      <div class="p-3 rounded bg-obsidian-850 border border-slate-800 flex items-start justify-between">
        <div>
          <div class="flex items-center space-x-2">
            <span class="text-xs font-bold text-cyan-400">${d.id}</span>
            <span class="text-[10px] text-slate-400">${d.timestamp}</span>
            <span class="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 text-[10px] font-bold border border-cyan-800">${d.action}</span>
          </div>
          <div class="text-white text-xs mt-1 font-semibold">${d.callsign}</div>
          <div class="text-slate-300 text-[11px] mt-0.5">${d.description}</div>
        </div>
        <div class="text-right">
          <span class="text-emerald-400 font-bold text-xs">${d.riskReduction < 0 ? d.riskReduction : `-${d.riskReduction}`}%</span>
          <span class="text-slate-500 text-[10px] block">Risk Delta</span>
        </div>
      </div>
    `).join('');
  }

  const modal = document.getElementById('directives-modal');
  modal?.classList.remove('hidden');
}

export function closeDirectivesModal(): void {
  audio.playClick();
  const modal = document.getElementById('directives-modal');
  modal?.classList.add('hidden');
}

export function triggerDeconflictSimulation(): void {
  audio.playWarning();
  const simBanner = document.getElementById('sim-banner');
  simBanner?.classList.remove('hidden');

  const target = FLIGHTS_DATA.find((f) => f.callsign === 'FDX-4412') || FLIGHTS_DATA[0];
  if (target) {
    target.riskScore = 38.4;
    target.riskCategory = 'critical';
    target.hazardNote = 'SEVERE WINDSHEAR ANOMALY AT FL310! Imminent corridor conflict detected.';
    renderFlightFeed();
    createFlightArcsAndVectors();
  }

  setTimeout(() => {
    simBanner?.classList.add('hidden');
  }, 10000);
}

// ==================== MULTI-CURRENCY & ENTERPRISE BILLING ====================

export const CURRENCY_RATES: Record<string, { symbol: string; rate: number; name: string }> = {
  USD: { symbol: '$', rate: 1.0, name: 'US Dollar (Global Standard)' },
  AED: { symbol: 'AED', rate: 3.6725, name: 'UAE Dirham (Dubai / GCC)' },
  EUR: { symbol: '€', rate: 0.9250, name: 'Euro (European Cargo)' },
  GBP: { symbol: '£', rate: 0.7920, name: 'British Pound (Heathrow)' },
  NGN: { symbol: '₦', rate: 1550.0, name: 'Nigerian Naira (West Africa)' }
};

let currentBillingCurrency: string = 'USD';
let currentPaymentRail: 'card' | 'wire' = 'card';
let activeOrderRef: string | null = null;

export function formatCurrencyAmount(amountUsd: number, currency: string = currentBillingCurrency): { formatted: string; raw: number; symbol: string } {
  const spec = CURRENCY_RATES[currency.toUpperCase()] ?? CURRENCY_RATES['USD']!;
  const raw = Math.round(amountUsd * spec.rate);
  const formatted = `${spec.symbol} ${raw.toLocaleString()}`;
  return { formatted, raw, symbol: spec.symbol };
}

export function setBillingCurrency(currency: string): void {
  audio.playClick();
  currentBillingCurrency = currency.toUpperCase();
  const currencies = ['USD', 'AED', 'EUR', 'GBP', 'NGN'];

  currencies.forEach((c) => {
    const btn = document.getElementById(`curr-btn-${c}`);
    if (btn) {
      if (c === currentBillingCurrency) {
        btn.className = 'px-2 py-1 text-[11px] rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/50 shadow-sm transition-all';
      } else {
        btn.className = 'px-2 py-1 text-[11px] rounded text-slate-400 hover:text-white transition-all';
      }
    }
  });

  // Update tier pricing labels
  const regionalQuote = formatCurrencyAmount(2500, currentBillingCurrency);
  const carrierQuote = formatCurrencyAmount(7500, currentBillingCurrency);
  const sovereignQuote = formatCurrencyAmount(25000, currentBillingCurrency);

  const priceReg = document.getElementById('tier-price-regional');
  const priceCar = document.getElementById('tier-price-carrier');
  const priceSov = document.getElementById('tier-price-sovereign');

  if (priceReg) priceReg.textContent = regionalQuote.formatted;
  if (priceCar) priceCar.textContent = carrierQuote.formatted;
  if (priceSov) priceSov.textContent = sovereignQuote.formatted;

  const subReg = document.getElementById('tier-sub-regional');
  const subCar = document.getElementById('tier-sub-carrier');
  const subSov = document.getElementById('tier-sub-sovereign');

  if (subReg) subReg.textContent = currentBillingCurrency === 'USD' ? '/ month' : `/ month (~$2,500 USD)`;
  if (subCar) subCar.textContent = currentBillingCurrency === 'USD' ? '/ month' : `/ month (~$7,500 USD)`;
  if (subSov) subSov.textContent = currentBillingCurrency === 'USD' ? '/ month (Annual)' : `/ month (~$25,000 USD Annual)`;

  updateCheckoutQuote();
}

export function selectPaymentRail(rail: 'card' | 'wire'): void {
  audio.playClick();
  currentPaymentRail = rail;
  const btnCard = document.getElementById('rail-btn-card');
  const btnWire = document.getElementById('rail-btn-wire');
  const secCard = document.getElementById('drawer-card-section');
  const secWire = document.getElementById('drawer-wire-section');

  if (rail === 'card') {
    if (btnCard) btnCard.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40';
    if (btnWire) btnWire.className = 'px-2 py-0.5 rounded text-[10px] font-bold text-slate-400 hover:text-white';
    secCard?.classList.remove('hidden');
    secWire?.classList.add('hidden');
  } else {
    if (btnWire) btnWire.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40';
    if (btnCard) btnCard.className = 'px-2 py-0.5 rounded text-[10px] font-bold text-slate-400 hover:text-white';
    secWire?.classList.remove('hidden');
    secCard?.classList.add('hidden');
  }
}

export function updateCheckoutQuote(): void {
  const select = document.getElementById('checkout-tier') as HTMLSelectElement | null;
  const tier = select?.value || 'global_cargo_carrier';
  let baseUsd = 7500;
  if (tier === 'regional_hub') baseUsd = 2500;
  if (tier === 'sovereign_defense') baseUsd = 25000;

  const quote = formatCurrencyAmount(baseUsd, currentBillingCurrency);
  const quoteEl = document.getElementById('checkout-total-quote');
  if (quoteEl) {
    quoteEl.textContent = `${quote.formatted} ${currentBillingCurrency}`;
  }
}

export function selectLicensingTier(tier: CommercialTierKey | string): void {
  audio.playClick();
  const select = document.getElementById('checkout-tier') as HTMLSelectElement | null;
  if (select) {
    select.value = tier;
  }

  // Update card border highlights
  const cardReg = document.getElementById('card-tier-regional');
  const cardCar = document.getElementById('card-tier-carrier');
  const cardSov = document.getElementById('card-tier-sovereign');

  cardReg?.classList.remove('border-cyan-400', 'shadow-glow-cyan');
  cardCar?.classList.remove('border-cyan-400', 'shadow-glow-cyan');
  cardSov?.classList.remove('border-cyan-400', 'shadow-glow-cyan');

  if (tier === 'regional_hub') cardReg?.classList.add('border-cyan-400', 'shadow-glow-cyan');
  if (tier === 'global_cargo_carrier') cardCar?.classList.add('border-cyan-400', 'shadow-glow-cyan');
  if (tier === 'sovereign_defense') cardSov?.classList.add('border-cyan-400', 'shadow-glow-cyan');

  updateCheckoutQuote();
}

// ==================== ENTERPRISE & API PORTAL ====================

export function openEnterprisePortal(initialTab: string = 'keys'): void {
  audio.playClick();
  const modal = document.getElementById('enterprise-portal-modal');
  modal?.classList.remove('hidden');
  const scrollContainer = modal?.querySelector('.overflow-y-auto') as HTMLElement | null;
  if (scrollContainer) scrollContainer.scrollTop = 0;
  switchPortalTab(initialTab);
}

export function closeEnterprisePortal(): void {
  audio.playClick();
  const modal = document.getElementById('enterprise-portal-modal');
  modal?.classList.add('hidden');
}

export function switchPortalTab(tabName: string): void {
  audio.playClick();
  const tabs = ['keys', 'explorer', 'webhooks', 'audit', 'db-config'];
  tabs.forEach((t) => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const content = document.getElementById(`tab-content-${t}`);
    if (btn && content) {
      if (t === tabName) {
        btn.className = 'px-3 py-1.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40';
        content.classList.remove('hidden');
      } else {
        btn.className = 'px-3 py-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800';
        content.classList.add('hidden');
      }
    }
  });

  if (tabName === 'keys') {
    loadApiKeys();
    setBillingCurrency(currentBillingCurrency);
  }
  if (tabName === 'webhooks') loadWebhooksAndAlerts();
  if (tabName === 'audit') refreshAuditLogs();
  if (tabName === 'db-config') loadSystemConfig();
}

export async function loadApiKeys(): Promise<void> {
  try {
    const res = await apiFetch('/api/v1/auth/keys');
    if (res.ok) {
      const data: { count: number; keys: ApiKeyRecord[] } = await res.json();
      const tbody = document.getElementById('api-keys-table-body');
      if (tbody && data.keys) {
        tbody.innerHTML = data.keys.map((k) => `
          <tr class="hover:bg-obsidian-900/60 transition-colors">
            <td class="p-2.5 font-bold text-cyan-400 font-mono">${k.key_prefix}</td>
            <td class="p-2.5 text-white font-semibold">${k.name}</td>
            <td class="p-2.5 text-slate-300 font-mono text-[11px]">${k.license_id || 'LIC-STD-2026'}</td>
            <td class="p-2.5">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                k.tier === 'sovereign_defense' || (k.license_type && k.license_type.includes('Sovereign'))
                  ? 'bg-purple-950 text-purple-300 border border-purple-600'
                  : (k.tier === 'global_cargo_carrier' || (k.license_type && k.license_type.includes('Global'))
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-600'
                    : 'bg-emerald-950 text-emerald-400 border border-emerald-600')
              }">
                ${k.license_type || k.tier || 'Regional Hub'}
              </span>
            </td>
            <td class="p-2.5 text-slate-300 font-mono text-[11px]">
              ${k.monthly_fee_usd ? `$${Number(k.monthly_fee_usd).toLocaleString()}/mo` : 'Annual'} • <span class="text-emerald-400 font-bold">${k.sla_uptime || '99.9%'}</span>
            </td>
            <td class="p-2.5 text-white font-mono">${k.total_requests || 0} req (${k.rate_limit_rpm || 120} rpm)</td>
            <td class="p-2.5">
              ${k.is_active && k.is_paid_enterprise
                ? '<span class="text-emerald-400 font-bold text-[10px] font-mono">● PAID ENTERPRISE</span>'
                : (k.is_active ? '<span class="text-cyan-400 font-bold text-[10px] font-mono">● ACTIVE</span>' : '<span class="text-slate-500 font-mono text-[10px]">REVOKED</span>')}
            </td>
            <td class="p-2.5 text-right">
              ${k.is_active ? `<button onclick="window.revokeApiKey(${k.id})" class="text-red-400 hover:text-red-300 text-[11px] underline font-mono">Revoke</button>` : '<span class="text-slate-600">—</span>'}
            </td>
          </tr>
        `).join('');
      }
    }
  } catch (e) {
    console.warn('[LOAD API KEYS ERROR]', e);
  }
}

export async function initiateEnterpriseCheckout(): Promise<void> {
  const orgInput = document.getElementById('checkout-org-name') as HTMLInputElement | null;
  const emailInput = document.getElementById('checkout-billing-email') as HTMLInputElement | null;
  const tierSelect = document.getElementById('checkout-tier') as HTMLSelectElement | null;

  const orgName = (orgInput?.value ?? '').trim();
  const email = (emailInput?.value ?? '').trim();
  const licenseType = tierSelect?.value || 'global_cargo_carrier';

  if (!orgName) {
    alert('Please enter an Airline or Partner Organization Name.');
    return;
  }
  if (!email || !email.includes('@')) {
    alert('Please enter a valid Corporate Billing / Accounts Payable Email.');
    return;
  }

  audio.playDirectiveChime();
  const btn = document.getElementById('btn-initiate-checkout') as HTMLButtonElement | null;
  if (btn) btn.textContent = 'CONNECTING TO ENTERPRISE VAULT...';

  try {
    const payload: InitiateCheckoutPayload = {
      organization_name: orgName,
      billing_email: email,
      license_type: licenseType,
      currency: currentBillingCurrency,
      payment_method: currentPaymentRail
    };

    const res = await apiFetch('/api/v1/billing/checkout/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Order initialization failed');
    }

    const data: InitiateCheckoutResponse = await res.json();
    activeOrderRef = data.order_ref;

    // Reveal order drawer
    const drawer = document.getElementById('checkout-order-drawer');
    const orderRefEl = document.getElementById('order-ref-display');
    const memoRefEl = document.getElementById('wire-memo-ref');
    const amountEl = document.getElementById('order-amount-display');
    const statusBadge = document.getElementById('order-status-badge');

    if (drawer) drawer.classList.remove('hidden');
    if (orderRefEl) orderRefEl.textContent = data.order_ref;
    if (memoRefEl) memoRefEl.textContent = data.order_ref;
    if (amountEl) {
      amountEl.textContent = `${data.currency_symbol} ${Number(data.amount_charged).toLocaleString()} ${data.currency} (≈ $${Number(data.amount_usd).toLocaleString()} USD)`;
    }
    if (statusBadge) {
      statusBadge.textContent = 'AWAITING PAYMENT';
      statusBadge.className = 'px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600 text-[10px] font-bold';
    }

    // Toggle view according to currentPaymentRail
    selectPaymentRail(currentPaymentRail);

    // Scroll into drawer smoothly
    drawer?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    if (btn) {
      btn.innerHTML = `
        <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        ORDER INITIATED (${data.order_ref})
      `;
    }
  } catch (err: unknown) {
    alert('Checkout initialization error: ' + (err instanceof Error ? err.message : String(err)));
    if (btn) btn.textContent = 'INITIALIZE SECURE ENTERPRISE CHECKOUT';
  }
}

export async function completeEnterpriseOrder(): Promise<void> {
  if (!activeOrderRef) {
    alert('Please click "INITIALIZE SECURE ENTERPRISE CHECKOUT" first to create an order reference.');
    return;
  }

  audio.playDirectiveChime();
  try {
    const res = await apiFetch('/api/v1/billing/checkout/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_ref: activeOrderRef })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to complete order verification');
    }

    const data: CompleteCheckoutResponse = await res.json();

    // Update status badge
    const statusBadge = document.getElementById('order-status-badge');
    if (statusBadge) {
      statusBadge.textContent = 'PAID & VERIFIED (SETTLED)';
      statusBadge.className = 'px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500 text-[10px] font-bold shadow-glow-cyan';
    }

    // Reveal token banner
    const banner = document.getElementById('new-key-banner');
    const text = document.getElementById('new-key-raw-text');
    const licIdEl = document.getElementById('new-key-license-id');
    const feeEl = document.getElementById('new-key-fee');
    const slaEl = document.getElementById('new-key-sla');

    if (banner && text) {
      text.textContent = data.api_key;
      if (licIdEl) licIdEl.textContent = data.license_id || 'COMMERCIAL-LIC';
      if (feeEl) feeEl.textContent = data.monthly_fee_usd ? `$${Number(data.monthly_fee_usd).toLocaleString()}/mo` : 'CUSTOM ANNUAL';
      if (slaEl) slaEl.textContent = data.sla_uptime || '99.99%';
      banner.classList.remove('hidden');
      banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    loadApiKeys();
  } catch (err: unknown) {
    alert('Order verification error: ' + (err instanceof Error ? err.message : String(err)));
  }
}

export function downloadCurrentInvoice(): void {
  if (!activeOrderRef) {
    alert('Please initialize an enterprise checkout order first to generate a proforma invoice.');
    return;
  }
  audio.playClick();
  window.open(apiClient.getInvoiceUrl(activeOrderRef), '_blank');
}

export function generatePartnerApiKey(): void {
  initiateEnterpriseCheckout();
}

export function copyRawApiKey(): void {
  const text = document.getElementById('new-key-raw-text')?.textContent ?? '';
  navigator.clipboard.writeText(text);
  audio.playClick();
  alert('API Key copied to clipboard!');
}

export async function revokeApiKey(keyId: number): Promise<void> {
  if (!confirm('Are you sure you want to revoke this partner API key? It will immediately block all requests.')) return;
  audio.playClick();
  try {
    const res = await apiFetch(`/api/v1/auth/keys/${keyId}`, { method: 'DELETE' });
    if (res.ok) {
      loadApiKeys();
    }
  } catch (e) {
    alert('Revocation error: ' + e);
  }
}

export async function testApiEndpoint(path: string, method: string = 'GET', body: unknown = null): Promise<void> {
  audio.playClick();
  const latencyEl = document.getElementById('api-test-latency');
  const responseEl = document.getElementById('api-test-response');

  if (responseEl) {
    responseEl.textContent = `Executing ${method} ${path} ...`;
  }

  const startTime = performance.now();
  try {
    const options: RequestInit = {
      method,
      headers: {
        'x-api-key': activeApiKey,
        'Content-Type': 'application/json'
      }
    };
    if (body) options.body = JSON.stringify(body);

    const res = await apiFetch(path, options);
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    if (latencyEl) {
      latencyEl.textContent = `Status: ${res.status} | Latency: ${duration} ms | Tier: Sovereign`;
    }

    const json = await res.json();
    if (responseEl) {
      responseEl.textContent = JSON.stringify(json, null, 2);
    }
  } catch (e) {
    if (responseEl) responseEl.textContent = `API Request Error: ${e}`;
  }
}

export async function loadWebhooksAndAlerts(): Promise<void> {
  try {
    const hookRes = await apiFetch('/api/v1/webhooks');
    if (hookRes.ok) {
      const data: { count: number; webhooks: WebhookRecord[] } = await hookRes.json();
      const list = document.getElementById('webhooks-list');
      if (list && data.webhooks) {
        if (data.webhooks.length === 0) {
          list.innerHTML = '<div class="text-slate-500 text-xs italic">No external webhooks configured yet. Register a Slack, Teams, or HTTP endpoint above.</div>';
        } else {
          list.innerHTML = data.webhooks.map((h) => `
            <div class="p-2.5 rounded bg-obsidian-900 border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <div class="text-cyan-300 font-bold break-all">${h.url}</div>
                <div class="text-[10px] text-slate-400 mt-0.5">Events: ${h.event_types} • Failures: ${h.failure_count}</div>
              </div>
              <button onclick="window.deleteWebhook(${h.id})" class="text-red-400 hover:text-red-300 text-xs underline ml-3">
                Remove
              </button>
            </div>
          `).join('');
        }
      }
    }

    const alertRes = await apiFetch('/api/v1/alerts/history');
    if (alertRes.ok) {
      const data: { count: number; alerts: DispatchAlertRecord[] } = await alertRes.json();
      const histList = document.getElementById('dispatch-history-list');
      if (histList && data.alerts) {
        if (data.alerts.length === 0) {
          histList.innerHTML = '<div class="text-slate-500 text-xs italic">No critical alerts logged yet. Airspace corridor is in nominal state.</div>';
        } else {
          histList.innerHTML = data.alerts.map((a) => `
            <div class="p-2 rounded bg-obsidian-900 border border-slate-800/80 flex items-start justify-between text-xs font-mono">
              <div>
                <div class="flex items-center space-x-2">
                  <span class="px-1.5 py-0.2 rounded text-[9px] font-bold ${a.severity === 'CRITICAL' ? 'bg-red-950 text-red-400 border border-red-700' : 'bg-amber-950 text-amber-300 border border-amber-700'}">
                    ${a.alert_type}
                  </span>
                  <span class="text-white font-bold">${a.callsign}</span>
                  <span class="text-slate-500 text-[10px]">${a.created_at || 'Just now'}</span>
                </div>
                <div class="text-slate-300 text-[11px] mt-1">${a.details}</div>
              </div>
              <div class="text-right pl-2">
                <span class="text-cyan-400 text-[10px] font-bold block">${a.status}</span>
                <span class="text-slate-500 text-[9px]">${a.dispatched_channels || 'WEBHOOK BUS'}</span>
              </div>
            </div>
          `).join('');
        }
      }
    }
  } catch (e) {
    console.warn('[LOAD WEBHOOKS ERROR]', e);
  }
}

export async function registerWebhook(): Promise<void> {
  const urlInput = document.getElementById('new-webhook-url') as HTMLInputElement | null;
  const url = (urlInput?.value ?? '').trim();
  if (!url || !url.startsWith('http')) {
    alert('Please enter a valid HTTP/HTTPS webhook URL.');
    return;
  }
  audio.playClick();
  try {
    const res = await apiFetch('/api/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (res.ok) {
      if (urlInput) urlInput.value = '';
      loadWebhooksAndAlerts();
    }
  } catch (e) {
    alert('Error registering webhook: ' + e);
  }
}

export async function deleteWebhook(id: number): Promise<void> {
  audio.playClick();
  try {
    await apiFetch(`/api/v1/webhooks/${id}`, { method: 'DELETE' });
    loadWebhooksAndAlerts();
  } catch (e) {
    // ignore
  }
}

export async function triggerManualTestDispatch(): Promise<void> {
  audio.playDirectiveChime();
  try {
    const res = await apiFetch('/api/v1/alerts/test-dispatch', {
      method: 'POST',
      headers: { 'x-api-key': activeApiKey }
    });
    if (res.ok) {
      const data = await res.json();
      alert(`Outbound Dispatch Alert Broadcast Initiated!\nFlight: ${data.test_flight}\nSimulated Risk: ${data.simulated_risk}%\nBroadcasted to configured partner webhooks.`);
      loadWebhooksAndAlerts();
    }
  } catch (e) {
    alert('Test dispatch failed: ' + e);
  }
}

export async function refreshAuditLogs(): Promise<void> {
  try {
    const res = await apiFetch('/api/v1/audit/logs?limit=30');
    if (res.ok) {
      const data: { count: number; logs: ComplianceAuditRecord[] } = await res.json();
      const tbody = document.getElementById('audit-logs-table-body');
      if (tbody && data.logs) {
        tbody.innerHTML = data.logs.map((log) => `
          <tr class="hover:bg-obsidian-950/70 transition-colors">
            <td class="p-2 text-slate-400">${log.recorded_at ? log.recorded_at.replace('T', ' ').slice(0, 19) : 'LIVE'}</td>
            <td class="p-2 text-cyan-300 font-bold">${log.corridor_id}</td>
            <td class="p-2 text-emerald-400 font-bold">${Number(log.risk_index).toFixed(1)} CRI</td>
            <td class="p-2 text-white">${log.active_vectors}</td>
            <td class="p-2 text-slate-300">${Number(log.throughput_tonnes).toFixed(1)} T/h</td>
            <td class="p-2 text-cyan-400">${log.directives_count}</td>
            <td class="p-2 text-slate-400 truncate max-w-[200px]">${log.weather_note || 'CAVOK'}</td>
          </tr>
        `).join('');
      }
    }
  } catch (e) {
    console.warn('[AUDIT LOGS ERROR]', e);
  }
}

export async function loadSystemConfig(): Promise<void> {
  try {
    const res = await apiFetch('/api/v1/system/status');
    if (res.ok) {
      const data: SystemStatusResponse = await res.json();
      const db = data.database;
      const stats = data.ingestion_pipeline;

      const avEl = document.getElementById('cfg-flight-source');
      if (avEl) avEl.textContent = stats.aviationstack_source || 'STREAMING ACTIVE';

      const wxEl = document.getElementById('cfg-weather-source');
      if (wxEl) wxEl.textContent = stats.weatherstack_source || 'STREAMING ACTIVE';

      const hitsEl = document.getElementById('cfg-cache-hits');
      if (hitsEl) hitsEl.textContent = `${stats.cache_hits || 0} PULLS (${stats.api_call_count || 0} API CALLS)`;

      const nextPollEl = document.getElementById('cfg-next-poll');
      if (nextPollEl) nextPollEl.textContent = `${stats.seconds_until_next_poll || 60}s`;

      const badge = document.getElementById('cfg-db-engine-badge');
      if (badge && db.engine) {
        badge.textContent = db.engine.toUpperCase();
        badge.className = db.is_postgres
          ? 'px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-600 text-[10px] font-bold'
          : 'px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold';
      }
    }
  } catch (e) {
    console.warn('[SYSTEM STATUS ERROR]', e);
  }
}

export async function saveIngestionApiKeys(): Promise<void> {
  audio.playClick();
  const avInput = document.getElementById('cfg-aviationstack-key') as HTMLInputElement | null;
  const wxInput = document.getElementById('cfg-weatherstack-key') as HTMLInputElement | null;
  const avKey = (avInput?.value ?? '').trim();
  const wxKey = (wxInput?.value ?? '').trim();

  try {
    const res = await apiFetch('/api/v1/system/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aviationstack_key: avKey || null,
        weatherstack_key: wxKey || null
      })
    });
    if (res.ok) {
      alert('Ingestion credentials updated! Strict 60s polling refreshed with new credentials.');
      loadSystemConfig();
      fetchLiveBackendTelemetry();
    }
  } catch (e) {
    alert('Failed to update credentials: ' + e);
  }
}

export async function saveDatabaseConfig(): Promise<void> {
  audio.playClick();
  const dbInput = document.getElementById('cfg-database-url') as HTMLInputElement | null;
  const dbUrl = (dbInput?.value ?? '').trim();
  const statusMsg = document.getElementById('cfg-db-status-msg');

  if (!dbUrl) {
    alert('Please enter a valid PostgreSQL connection string.');
    return;
  }

  if (statusMsg) statusMsg.textContent = 'Connecting and verifying schema migrations...';

  try {
    const res = await apiFetch('/api/v1/system/db-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ database_url: dbUrl })
    });
    if (res.ok) {
      const data = await res.json();
      if (statusMsg) {
        statusMsg.innerHTML = `<span class="text-emerald-400 font-bold">✓ Successfully connected to: ${data.engine}</span>`;
      }
      loadSystemConfig();
      fetchLiveBackendTelemetry();
    } else {
      if (statusMsg) {
        statusMsg.innerHTML = `<span class="text-red-400">Failed to connect to configured URL. Falling back to persistent SQLite vault.</span>`;
      }
    }
  } catch (e) {
    if (statusMsg) statusMsg.innerHTML = `<span class="text-red-400">Connection error: ${e}</span>`;
  }
}

// Hotkey Navigation
window.addEventListener('keydown', (e: KeyboardEvent) => {
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;

  const keyNum = parseInt(e.key, 10);
  if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= 5) {
    const corridorKeys = ['dxb-primary', 'doh-dxb', 'sin-dxb', 'lhr-dxb', 'dwc-expansion'];
    const idx = keyNum - 1;
    const select = document.getElementById('corridor-selector') as HTMLSelectElement | null;
    const targetKey = corridorKeys[idx];
    if (select && targetKey) {
      select.value = targetKey;
      handleCorridorChange(targetKey);
    }
  } else if (e.key.toLowerCase() === 'r') {
    recenterRadar();
  } else if (e.key.toLowerCase() === 'e') {
    const modal = document.getElementById('enterprise-portal-modal');
    if (modal?.classList.contains('hidden')) {
      openEnterprisePortal();
    } else {
      closeEnterprisePortal();
    }
  } else if (e.key === ' ') {
    e.preventDefault();
    audio.playClick();
  }
});

// Window Bindings for HTML Event Handlers
window.initMapLibreRadar = initMapLibreRadar;
window.initThreeRadar = initMapLibreRadar;
window.selectLicensingTier = selectLicensingTier;
window.handleCorridorChange = handleCorridorChange;
window.toggleAudioFeedback = toggleAudioFeedback;
window.setRadarViewMode = setRadarViewMode;
window.toggleLayer = toggleLayer;
window.recenterRadar = recenterRadar;
window.zoomRadar = zoomRadar;
window.setFlightFilter = setFlightFilter;
window.filterFlights = filterFlights;
window.openFlightModal = openFlightModal;
window.closeFlightModal = closeFlightModal;
window.executeFlightDeconfliction = executeFlightDeconfliction;
window.focusOnFlightInRadar = focusOnFlightInRadar;
window.openDirectivesModal = openDirectivesModal;
window.closeDirectivesModal = closeDirectivesModal;
window.triggerDeconflictSimulation = triggerDeconflictSimulation;
window.openEnterprisePortal = openEnterprisePortal;
window.closeEnterprisePortal = closeEnterprisePortal;
window.switchPortalTab = switchPortalTab;
window.generatePartnerApiKey = generatePartnerApiKey;
window.copyRawApiKey = copyRawApiKey;
window.revokeApiKey = revokeApiKey;
window.testApiEndpoint = testApiEndpoint;
window.registerWebhook = registerWebhook;
window.deleteWebhook = deleteWebhook;
window.triggerManualTestDispatch = triggerManualTestDispatch;
window.refreshAuditLogs = refreshAuditLogs;
window.saveIngestionApiKeys = saveIngestionApiKeys;
window.saveDatabaseConfig = saveDatabaseConfig;
window.setBillingCurrency = setBillingCurrency;
window.selectPaymentRail = selectPaymentRail;
window.initiateEnterpriseCheckout = initiateEnterpriseCheckout;
window.completeEnterpriseOrder = completeEnterpriseOrder;
window.downloadCurrentInvoice = downloadCurrentInvoice;
window.navigateTo = navigateTo;
window.submitPartnershipEnquiry = submitPartnershipEnquiry;

// Boot up sequence
window.addEventListener('DOMContentLoaded', () => {
  // Initialize SPA Route based on current browser URL
  const initialPath = window.location.pathname;
  if (initialPath === '/dashboard' || initialPath.startsWith('/dashboard')) {
    navigateTo('/dashboard', false);
    initMapLibreRadar();
  } else {
    navigateTo('/', false);
  }

  // Handle browser back/forward buttons
  window.addEventListener('popstate', () => {
    navigateTo(window.location.pathname, false);
  });

  // Subscribe to central API client connection and cold-start events
  apiClient.subscribe((state) => {
    const coldStartBanner = document.getElementById('render-cold-start-banner');
    if (coldStartBanner) {
      if (state.isColdStarting) {
        coldStartBanner.classList.remove('hidden');
      } else {
        coldStartBanner.classList.add('hidden');
      }
    }

    const dbText = document.getElementById('db-status-text');
    const dbDot = document.getElementById('db-status-dot');
    if (dbText && dbDot) {
      if (state.isConnected) {
        dbText.textContent = state.isPostgres ? 'POSTGRES VAULT' : 'SQLITE WAL VAULT';
        dbDot.className = 'w-2 h-2 rounded-full bg-emerald-400';
      } else if (state.isColdStarting) {
        dbText.textContent = 'RENDER WAKING';
        dbDot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-ping';
      }
    }
  });

  renderFlightFeed();
  setInterval(updateClocks, 1000);
  updateClocks();

  // Initial sync with FastAPI backend
  fetchLiveBackendTelemetry();

  // Continuous sync interval (every 3 seconds for live dashboard responsiveness)
  setInterval(() => {
    fetchLiveBackendTelemetry();
  }, 3000);
});


