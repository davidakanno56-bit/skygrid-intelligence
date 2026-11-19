import * as maplibregl from 'maplibre-gl';
import type { FlightVector } from '../types/telemetry';
import type { AirportHub, CorridorCameraPreset, FlightArcDefinition, LayerToggleState } from '../types/radar';
import {
  resolveTacticalBasemap,
  REAL_LIVE_MAP_STYLE,
  REAL_SATELLITE_MAP_STYLE,
  ESRI_DARK_GRAY_RASTER_STYLE,
  buildCartoDarkMatterStyle,
  TACTICAL_OFFLINE_DARK_STYLE,
  createRangeRingCoordinates,
  isValidCoordinate,
  buildAircraftTrailsGeoJSON,
  buildHeadingVectorsGeoJSON,
  buildHazardZonesGeoJSON,
  buildAirspaceOverlayGeoJSON,
  buildTacticalGraticuleGeoJSON,
  advanceSimulatedFlight,
  getRiskTrackColor
} from './radarUtils';

// Default to REAL LIVE GEOGRAPHIC MAP (OpenStreetMap) showing real blue oceans, coastlines & Dubai runways
const BASEMAP_RESOLUTION = resolveTacticalBasemap(import.meta.env.VITE_CARTO_BASEMAP_KEY as string | undefined, 'live');
export const TACTICAL_DARK_BASEMAP_STYLE = BASEMAP_RESOLUTION.style;

export interface RadarEngineDeps {
  getFlights: () => FlightVector[];
  airportHubs: AirportHub[];
  corridorCameraTargets: Record<string, CorridorCameraPreset>;
  onOpenFlightModal: (flightId: string) => void;
  onPlayClick: () => void;
}

function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

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

function getRiskPillStyle(riskCategory: string): string {
  if (riskCategory === 'critical') return 'bg-red-950 text-red-400 border border-red-600';
  if (riskCategory === 'elevated') return 'bg-amber-950 text-amber-300 border border-amber-600';
  if (riskCategory === 'watch') return 'bg-sky-950 text-sky-300 border border-sky-600';
  return 'bg-emerald-950 text-emerald-400 border border-emerald-600';
}

export class TacticalRadarEngine {
  private deps: RadarEngineDeps;
  private map: maplibregl.Map | null = null;
  private mapInitialized: boolean = false;
  private mapInitializing: boolean = false;
  private usingOfflineFallbackStyle: boolean = false;
  private styleFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private containerObserver: ResizeObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private aircraftMarkers: Record<string, { marker: maplibregl.Marker; el: HTMLElement; flight: FlightVector }> = {};
  private hubMarkers: maplibregl.Marker[] = [];
  private movementInterval: ReturnType<typeof setInterval> | null = null;
  private azimuthInterval: ReturnType<typeof setInterval> | null = null;
  private visibilityAttached: boolean = false;
  private currentSweepAzimuth: number = 184;
  private selectedFlightId: string | null = null;
  private viewMode: '3d' | '2d' = '3d';
  private layersState: LayerToggleState = { vectors: true, trails: true, sweep: true, grid: true };

  constructor(deps: RadarEngineDeps) {
    this.deps = deps;
  }

  private handleVisibilityChange = (): void => {
    if (!this.mapInitialized) return;
    if (document.hidden) {
      this.stopLoops();
    } else {
      this.startAircraftMovementLoop();
      this.startAzimuthSweepSimulation();
    }
  };

  private stopLoops(): void {
    if (this.movementInterval) {
      clearInterval(this.movementInterval);
      this.movementInterval = null;
    }
    if (this.azimuthInterval) {
      clearInterval(this.azimuthInterval);
      this.azimuthInterval = null;
    }
  }

  private updateBasemapStatus(label: string): void {
    const el = document.getElementById('radar-basemap-status');
    if (el) el.textContent = label;
  }

  private updateTrackCount(): void {
    const el = document.getElementById('radar-track-count');
    if (el) el.textContent = `${this.deps.getFlights().length} SIM TRACKS`;
  }

  public isReady(): boolean {
    return this.mapInitialized && this.map !== null;
  }

  public resizeIfReady(): void {
    if (this.map) {
      this.map.resize();
      if (this.map.isStyleLoaded()) {
        this.ensureRadarOverlays();
      }
    } else if (!this.mapInitialized) {
      this.init();
    }
  }

  public cleanup(): void {
    if (this.styleFallbackTimer) {
      clearTimeout(this.styleFallbackTimer);
      this.styleFallbackTimer = null;
    }
    this.stopLoops();
    if (this.visibilityAttached && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.visibilityAttached = false;
    }
    Object.keys(this.aircraftMarkers).forEach((id) => {
      try {
        this.aircraftMarkers[id]?.marker.remove();
      } catch {}
      delete this.aircraftMarkers[id];
    });
    this.hubMarkers.forEach((m) => {
      try {
        m.remove();
      } catch {}
    });
    this.hubMarkers = [];
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.containerObserver) {
      this.containerObserver.disconnect();
      this.containerObserver = null;
    }
    if (this.map) {
      try {
        this.map.remove();
      } catch (e) {
        console.warn('[RADAR ENGINE CLEANUP]', e);
      }
      this.map = null;
    }
    this.mapInitialized = false;
    this.mapInitializing = false;
    this.usingOfflineFallbackStyle = false;
  }

  public reinit(): void {
    const fallbackEl = document.getElementById('radar-webgl-fallback');
    if (fallbackEl) fallbackEl.classList.add('hidden');
    this.cleanup();
    this.init();
  }

  public init(): void {
    if (this.map) {
      this.map.resize();
      if (this.map.isStyleLoaded()) {
        this.ensureRadarOverlays();
      }
      return;
    }
    if (this.mapInitializing) return;

    const container =
      document.getElementById('tactical-map-container') || document.getElementById('radar-canvas-container');
    if (!container) return;

    const fallbackEl = document.getElementById('radar-webgl-fallback');
    if (!isWebGLSupported()) {
      if (fallbackEl) fallbackEl.classList.remove('hidden');
      console.warn('[RADAR ENGINE] Hardware WebGL context not available');
      return;
    }

    // Prevent zero-dimension initialization when dashboard is hidden
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      if (!this.containerObserver) {
        this.containerObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
              this.containerObserver?.disconnect();
              this.containerObserver = null;
              this.init();
              break;
            }
          }
        });
        this.containerObserver.observe(container);
      }
      return;
    }

    this.mapInitializing = true;
    this.usingOfflineFallbackStyle = false;
    this.updateBasemapStatus(BASEMAP_RESOLUTION.label);

    try {
      this.map = new maplibregl.Map({
        container,
        style: TACTICAL_DARK_BASEMAP_STYLE,
        center: [55.3657, 25.2532], // OMDB / DXB
        zoom: 8.6,
        pitch: prefersReducedMotion() ? 0 : 38,
        bearing: prefersReducedMotion() ? 0 : -12,
        attributionControl: false
      });

      this.map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
      this.map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'nautical' }), 'bottom-left');

      this.map.on('move', () => {
        if (!this.map) return;
        const pitchEl = document.getElementById('radar-pitch-display');
        const bearingEl = document.getElementById('radar-bearing-display');
        const zoomEl = document.getElementById('radar-zoom-level');
        if (pitchEl) pitchEl.textContent = `${Math.round(this.map.getPitch())}°`;
        if (bearingEl) bearingEl.textContent = `${Math.round(this.map.getBearing())}°`;
        if (zoomEl) zoomEl.textContent = `${Math.round(this.map.getZoom() * 11)}%`;
      });

      this.map.on('click', (ev) => {
        const target = ev.originalEvent.target as HTMLElement | null;
        if (target && !target.closest('.tactical-plane-marker') && !target.closest('.tactical-hub-beacon')) {
          this.closeSelectedAircraftPanel();
        }
      });

      const activateRadar = (): void => {
        if (this.styleFallbackTimer) {
          clearTimeout(this.styleFallbackTimer);
          this.styleFallbackTimer = null;
        }
        this.mapInitialized = true;
        this.mapInitializing = false;
        if (fallbackEl) fallbackEl.classList.add('hidden');

        this.ensureRadarOverlays();
        this.startAircraftMovementLoop();
        this.startAzimuthSweepSimulation();

        if (!this.visibilityAttached && typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', this.handleVisibilityChange);
          this.visibilityAttached = true;
        }

        setTimeout(() => {
          this.map?.resize();
        }, 60);

        if (!this.resizeObserver && container) {
          this.resizeObserver = new ResizeObserver(() => {
            this.map?.resize();
          });
          this.resizeObserver.observe(container);
        }
      };

      this.map.on('load', activateRadar);
      // Restore all GeoJSON sources and layers whenever style changes or falls back
      this.map.on('style.load', () => {
        if (this.mapInitialized) {
          this.ensureRadarOverlays();
        } else {
          activateRadar();
        }
      });

      // Never allow an unreachable basemap network to block radar overlays indefinitely
      this.styleFallbackTimer = setTimeout(() => {
        if (!this.mapInitialized && this.map && !this.usingOfflineFallbackStyle) {
          console.warn('[RADAR ENGINE] Basemap load timeout after 12s, switching to tactical offline grid mode');
          this.usingOfflineFallbackStyle = true;
          this.updateBasemapStatus('TACTICAL RADAR GRID (OFFLINE)');
          try {
            this.map.setStyle(TACTICAL_OFFLINE_DARK_STYLE);
          } catch {}
        }
      }, 12000);

      this.map.on('error', (e: unknown) => {
        // MapLibre emits non-fatal warnings for minor network retries, missing optional glyphs, etc.
        // DO NOT wipe or abort the basemap on non-fatal events!
        console.warn('[MAPLIBRE NON-FATAL WARNING]', e);
      });
    } catch (err) {
      this.mapInitializing = false;
      console.error('[MAPLIBRE INIT ERROR]', err);
      if (fallbackEl) fallbackEl.classList.remove('hidden');
    }
  }

  public ensureRadarOverlays(): void {
    if (!this.map || !this.map.isStyleLoaded()) return;

    this.addTacticalGraticuleLayer();
    this.addAirspaceOverlayLayer();
    this.addRangeRingsLayers();
    this.addHazardZonesLayer();
    this.addFlightPathArcLayers();
    this.syncAircraftTrackLayers();
    this.renderHubBeaconMarkers();
    this.renderMovingAircraftMarkers();
    this.applyLayerVisibilityState();
    this.updateTrackCount();
  }

  public syncFlights(): void {
    if (!this.mapInitialized) return;
    this.renderMovingAircraftMarkers();
    this.syncAircraftTrackLayers();
    this.updateTrackCount();
    if (this.selectedFlightId) {
      const sel = this.deps.getFlights().find((f) => f.id === this.selectedFlightId) ?? null;
      this.updateSelectedAircraftPanel(sel);
    }
  }

  private addTacticalGraticuleLayer(): void {
    if (!this.map) return;
    const data = buildTacticalGraticuleGeoJSON();
    const existing = this.map.getSource('tactical-graticule') as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
      return;
    }
    this.map.addSource('tactical-graticule', { type: 'geojson', data });
    this.map.addLayer({
      id: 'tactical-graticule-lines',
      type: 'line',
      source: 'tactical-graticule',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'width'],
        'line-dasharray': [3, 4],
        'line-opacity': ['get', 'opacity']
      }
    });
  }

  private addAirspaceOverlayLayer(): void {
    if (!this.map) return;
    const data = buildAirspaceOverlayGeoJSON();
    const existing = this.map.getSource('dxb-airspace-tma') as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
      return;
    }
    this.map.addSource('dxb-airspace-tma', { type: 'geojson', data });
    this.map.addLayer({
      id: 'dxb-airspace-tma-fill',
      type: 'fill',
      source: 'dxb-airspace-tma',
      paint: { 'fill-color': '#0ea5e9', 'fill-opacity': 0.04 }
    });
    this.map.addLayer({
      id: 'dxb-airspace-tma-line',
      type: 'line',
      source: 'dxb-airspace-tma',
      paint: { 'line-color': '#38bdf8', 'line-width': 1.1, 'line-dasharray': [6, 4], 'line-opacity': 0.35 }
    });
  }

  private addRangeRingsLayers(): void {
    if (!this.map) return;
    const dxbCenter: [number, number] = [55.3657, 25.2532];
    const data = {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: { name: '25 NM RING', color: '#22d3ee', opacity: 0.65, width: 1.5 },
          geometry: { type: 'LineString' as const, coordinates: createRangeRingCoordinates(dxbCenter, 46.3) }
        },
        {
          type: 'Feature' as const,
          properties: { name: '50 NM RING', color: '#06b6d4', opacity: 0.5, width: 1.2 },
          geometry: { type: 'LineString' as const, coordinates: createRangeRingCoordinates(dxbCenter, 92.6) }
        },
        {
          type: 'Feature' as const,
          properties: { name: '100 NM RING', color: '#0e7490', opacity: 0.4, width: 1.0 },
          geometry: { type: 'LineString' as const, coordinates: createRangeRingCoordinates(dxbCenter, 185.2) }
        }
      ]
    };

    const existing = this.map.getSource('dxb-range-rings') as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
      return;
    }
    this.map.addSource('dxb-range-rings', { type: 'geojson', data });
    this.map.addLayer({
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

  private addHazardZonesLayer(): void {
    if (!this.map) return;
    const data = buildHazardZonesGeoJSON();
    const existing = this.map.getSource('corridor-hazard-zones') as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
      return;
    }
    this.map.addSource('corridor-hazard-zones', { type: 'geojson', data });
    this.map.addLayer({
      id: 'corridor-hazard-fill',
      type: 'fill',
      source: 'corridor-hazard-zones',
      paint: { 'fill-color': ['get', 'lineColor'], 'fill-opacity': 0.14 }
    });
    this.map.addLayer({
      id: 'corridor-hazard-line',
      type: 'line',
      source: 'corridor-hazard-zones',
      paint: {
        'line-color': ['get', 'lineColor'],
        'line-width': 1.8,
        'line-dasharray': [4, 2],
        'line-opacity': 0.85
      }
    });
  }

  private addFlightPathArcLayers(): void {
    if (!this.map) return;
    const hubCoords: Record<string, [number, number]> = {};
    this.deps.airportHubs.forEach((h) => {
      const key = h.code.split('/')[1]?.trim() ?? h.code.split('/')[0]?.trim() ?? h.code;
      hubCoords[key] = h.coords;
    });

    const corridorConnections: FlightArcDefinition[] = [
      { from: 'FRA', to: 'DXB', color: '#0ea5e9', callsign: 'EK-902' },
      { from: 'ORD', to: 'DXB', color: '#0ea5e9', callsign: 'ATLAS-81' },
      { from: 'LEJ', to: 'DWC', color: '#10b981', callsign: 'DHL-109' },
      { from: 'SIN', to: 'DXB', color: '#0ea5e9', callsign: 'SQ-77' },
      { from: 'DOH', to: 'DXB', color: '#10b981', callsign: 'QTR-994' },
      { from: 'HKG', to: 'DWC', color: '#38bdf8', callsign: 'CPA-63' },
      { from: 'SYD', to: 'DXB', color: '#10b981', callsign: 'UAE-9902' },
      { from: 'LUX', to: 'DXB', color: '#38bdf8', callsign: 'CLX-714' },
      { from: 'LHR', to: 'DXB', color: '#0ea5e9', callsign: 'BAW-208' }
    ];

    const features = corridorConnections
      .map((conn) => {
        const fromCoord = hubCoords[conn.from];
        const toCoord = hubCoords[conn.to];
        if (!fromCoord || !toCoord) return null;
        return {
          type: 'Feature' as const,
          properties: { from: conn.from, to: conn.to, color: conn.color, callsign: conn.callsign },
          geometry: { type: 'LineString' as const, coordinates: generateCurvedArc(fromCoord, toCoord) }
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    const data = { type: 'FeatureCollection' as const, features };
    const existing = this.map.getSource('flight-arcs') as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
      return;
    }
    this.map.addSource('flight-arcs', { type: 'geojson', data });
    this.map.addLayer({
      id: 'flight-arcs-glow',
      type: 'line',
      source: 'flight-arcs',
      paint: { 'line-color': ['get', 'color'], 'line-width': 3.0, 'line-opacity': 0.2, 'line-blur': 2.0 }
    });
    this.map.addLayer({
      id: 'flight-arcs-core',
      type: 'line',
      source: 'flight-arcs',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.2,
        'line-opacity': 0.45,
        'line-dasharray': [4, 3]
      }
    });
  }

  private syncAircraftTrackLayers(): void {
    if (!this.map || !this.map.isStyleLoaded()) return;
    const flights = this.deps.getFlights();
    const trailsData = buildAircraftTrailsGeoJSON(flights, this.selectedFlightId);
    const headingData = buildHeadingVectorsGeoJSON(flights, this.selectedFlightId, 2.5);

    const selFlight = this.selectedFlightId ? flights.find((f) => f.id === this.selectedFlightId) : undefined;
    const selData = {
      type: 'FeatureCollection' as const,
      features:
        selFlight && isValidCoordinate(selFlight.lat, selFlight.lng)
          ? [
              {
                type: 'Feature' as const,
                properties: { callsign: selFlight.callsign },
                geometry: { type: 'Point' as const, coordinates: [selFlight.lng, selFlight.lat] as [number, number] }
              }
            ]
          : []
    };

    const trailsSrc = this.map.getSource('aircraft-trails') as maplibregl.GeoJSONSource | undefined;
    if (trailsSrc) {
      trailsSrc.setData(trailsData);
    } else {
      this.map.addSource('aircraft-trails', { type: 'geojson', data: trailsData });
      this.map.addLayer({
        id: 'aircraft-trails-glow',
        type: 'line',
        source: 'aircraft-trails',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 5.5, 'line-opacity': 0.24, 'line-blur': 2.5 }
      });
      this.map.addLayer({
        id: 'aircraft-trails-line',
        type: 'line',
        source: 'aircraft-trails',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-opacity': ['get', 'opacity'] }
      });
    }

    const hdgSrc = this.map.getSource('aircraft-heading-vectors') as maplibregl.GeoJSONSource | undefined;
    if (hdgSrc) {
      hdgSrc.setData(headingData);
    } else {
      this.map.addSource('aircraft-heading-vectors', { type: 'geojson', data: headingData });
      this.map.addLayer({
        id: 'aircraft-heading-vectors-line',
        type: 'line',
        source: 'aircraft-heading-vectors',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'width'],
          'line-opacity': ['get', 'opacity'],
          'line-dasharray': [1.5, 1.5]
        }
      });
    }

    const selSrc = this.map.getSource('aircraft-selection-ring') as maplibregl.GeoJSONSource | undefined;
    if (selSrc) {
      selSrc.setData(selData);
    } else {
      this.map.addSource('aircraft-selection-ring', { type: 'geojson', data: selData });
      this.map.addLayer({
        id: 'aircraft-selection-halo',
        type: 'circle',
        source: 'aircraft-selection-ring',
        paint: {
          'circle-radius': 20,
          'circle-color': 'rgba(34, 211, 238, 0.14)',
          'circle-stroke-color': '#22d3ee',
          'circle-stroke-width': 2
        }
      });
    }
  }

  private renderHubBeaconMarkers(): void {
    if (!this.map) return;
    this.hubMarkers.forEach((m) => {
      try {
        m.remove();
      } catch {}
    });
    this.hubMarkers = [];

    this.deps.airportHubs.forEach((hub) => {
      const el = document.createElement('div');
      el.className = 'tactical-hub-beacon';
      const shortLabel = hub.code.split('/')[1]?.trim() ?? hub.code;
      el.innerHTML = `
        <div class="hub-beacon-inner">
          <div class="hub-beacon-pulse ${hub.isPrimary ? 'primary' : ''}"></div>
          <div class="hub-beacon-core ${hub.isPrimary ? 'primary' : ''}"></div>
          <div class="hub-beacon-label ${hub.isPrimary ? 'primary' : ''}">${shortLabel}</div>
        </div>
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
      const popup = new maplibregl.Popup({ offset: 15, closeButton: true, maxWidth: '280px' }).setHTML(popupHtml);
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(hub.coords)
        .setPopup(popup)
        .addTo(this.map!);
      this.hubMarkers.push(marker);
    });
  }

  private renderMovingAircraftMarkers(): void {
    if (!this.map) return;
    const flights = this.deps.getFlights();
    const activeIds = new Set(flights.map((f) => f.id));

    Object.keys(this.aircraftMarkers).forEach((id) => {
      if (!activeIds.has(id)) {
        try {
          this.aircraftMarkers[id]?.marker.remove();
        } catch {}
        delete this.aircraftMarkers[id];
      }
    });

    flights.forEach((flight) => {
      if (!isValidCoordinate(flight.lat, flight.lng)) return;

      const colorHex = getRiskTrackColor(flight.riskCategory, false);
      const riskPillClass = getRiskPillStyle(flight.riskCategory);
      const hdgStr = `${Math.round(flight.heading).toString().padStart(3, '0')}°`;
      const metaLine = `${flight.flightLevel} • ${Math.round(flight.speed)}kt • ${hdgStr}`;
      const shortId = flight.icao24 || flight.transponder;

      const existing = this.aircraftMarkers[flight.id];
      if (existing) {
        existing.flight = flight;
        existing.marker.setLngLat([flight.lng, flight.lat]);
        const iconBox = existing.el.querySelector('.plane-icon-box') as HTMLElement | null;
        if (iconBox) iconBox.style.transform = `rotate(${flight.heading}deg)`;
        const metaEl = existing.el.querySelector('.plane-tag-meta') as HTMLElement | null;
        if (metaEl) metaEl.textContent = metaLine;
        const criEl = existing.el.querySelector('.cri-pill') as HTMLElement | null;
        if (criEl) {
          criEl.textContent = `${Number(flight.riskScore).toFixed(1)}%`;
          criEl.className = `cri-pill ${riskPillClass}`;
        }
        return;
      }

      const el = document.createElement('div');
      el.className = `tactical-plane-marker${this.selectedFlightId === flight.id ? ' is-selected' : ''}`;
      el.dataset.flightId = flight.id;
      el.style.display = this.layersState.vectors ? 'block' : 'none';
      el.innerHTML = `
        <div class="plane-marker-inner">
          <div class="plane-icon-box" style="transform: rotate(${flight.heading}deg);">
            <svg class="plane-icon-svg" viewBox="0 0 24 24" fill="${colorHex}">
              <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
            </svg>
          </div>
          <div class="plane-tag">
            <div class="plane-tag-row">
              <span class="font-bold text-white">${flight.callsign}</span>
              <span class="text-cyan-400 text-[7px]">${shortId}</span>
              <span class="cri-pill ${riskPillClass}">${Number(flight.riskScore).toFixed(1)}%</span>
            </div>
            <div class="plane-tag-meta">${metaLine}</div>
          </div>
        </div>
      `;

      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.selectAircraft(flight.id);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([flight.lng, flight.lat])
        .addTo(this.map!);

      this.aircraftMarkers[flight.id] = { marker, el, flight };
    });
  }

  private updateSelectedAircraftPanel(flight: FlightVector | null): void {
    const panel = document.getElementById('radar-aircraft-info-panel');
    if (!panel) return;
    if (!flight) {
      panel.classList.add('hidden');
      return;
    }

    panel.classList.remove('hidden');
    const setText = (id: string, val: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setText('sel-ac-callsign', flight.callsign);
    setText('sel-ac-subtitle', `${flight.aircraft} • ${flight.carrier}`);
    setText('sel-ac-icao', `ICAO24: ${flight.icao24 || flight.id}`);
    setText('sel-ac-route', `${flight.origin} → ${flight.destination}`);
    setText('sel-ac-alt', `${flight.flightLevel} (${flight.altitude.toLocaleString()} ft)`);
    setText('sel-ac-speed', `${Math.round(flight.speed)} kts (M${flight.mach.toFixed(2)})`);
    setText('sel-ac-hdg', `${Math.round(flight.heading).toString().padStart(3, '0')}°`);
    const vRate = flight.verticalRateFpm ?? 0;
    setText('sel-ac-vrate', vRate > 0 ? `+${vRate} fpm` : `${vRate} fpm`);
    setText('sel-ac-squawk', flight.transponder || '7000-S');
    setText('sel-ac-pos', `${flight.lat.toFixed(4)}°N, ${flight.lng.toFixed(4)}°E`);

    const pill = document.getElementById('sel-ac-risk-pill');
    if (pill) {
      pill.textContent = `CRI ${Number(flight.riskScore).toFixed(1)}%`;
      pill.className = `px-1.5 py-0.5 rounded text-[9px] font-bold ${getRiskPillStyle(flight.riskCategory)}`;
    }

    const dossierBtn = document.getElementById('sel-ac-dossier-btn') as HTMLButtonElement | null;
    if (dossierBtn) {
      dossierBtn.onclick = () => this.deps.onOpenFlightModal(flight.id);
    }
  }

  public selectAircraft(flightId: string): void {
    const flight = this.deps.getFlights().find((f) => f.id === flightId) ?? null;
    this.selectedFlightId = flight ? flight.id : null;
    this.deps.onPlayClick();

    Object.entries(this.aircraftMarkers).forEach(([id, entry]) => {
      entry.el.classList.toggle('is-selected', id === this.selectedFlightId);
    });

    this.updateSelectedAircraftPanel(flight);
    this.syncAircraftTrackLayers();
  }

  public closeSelectedAircraftPanel(): void {
    this.selectedFlightId = null;
    Object.values(this.aircraftMarkers).forEach((entry) => {
      entry.el.classList.remove('is-selected');
    });
    this.updateSelectedAircraftPanel(null);
    this.syncAircraftTrackLayers();
  }

  private startAircraftMovementLoop(): void {
    if (this.movementInterval) clearInterval(this.movementInterval);
    const tickMs = prefersReducedMotion() ? 2400 : 900;

    this.movementInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const dtSec = tickMs / 1000;
      const flights = this.deps.getFlights();

      flights.forEach((flight) => {
        advanceSimulatedFlight(flight, dtSec);
        const markerObj = this.aircraftMarkers[flight.id];
        if (markerObj) {
          markerObj.marker.setLngLat([flight.lng, flight.lat]);
          const metaEl = markerObj.el.querySelector('.plane-tag-meta') as HTMLElement | null;
          if (metaEl) {
            const hdgStr = `${Math.round(flight.heading).toString().padStart(3, '0')}°`;
            metaEl.textContent = `${flight.flightLevel} • ${Math.round(flight.speed)}kt • ${hdgStr}`;
          }
        }
      });

      this.syncAircraftTrackLayers();

      if (this.selectedFlightId) {
        const sel = flights.find((f) => f.id === this.selectedFlightId) ?? null;
        if (sel) this.updateSelectedAircraftPanel(sel);
      }
    }, tickMs);
  }

  private startAzimuthSweepSimulation(): void {
    if (this.azimuthInterval) {
      clearInterval(this.azimuthInterval);
      this.azimuthInterval = null;
    }
    if (prefersReducedMotion()) return;
    this.azimuthInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      this.currentSweepAzimuth = (this.currentSweepAzimuth + 2) % 360;
      const azEl = document.getElementById('radar-azimuth');
      if (azEl) azEl.textContent = `${this.currentSweepAzimuth}°`;
    }, 150);
  }

  private applyLayerVisibilityState(): void {
    Object.values(this.aircraftMarkers).forEach((m) => {
      m.el.style.display = this.layersState.vectors ? 'block' : 'none';
    });
    if (!this.map || !this.map.isStyleLoaded()) return;

    const setVis = (layerId: string, visible: boolean) => {
      if (this.map?.getLayer(layerId)) {
        this.map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      }
    };

    setVis('aircraft-heading-vectors-line', this.layersState.vectors);
    setVis('aircraft-selection-halo', this.layersState.vectors);
    setVis('aircraft-trails-glow', this.layersState.trails);
    setVis('aircraft-trails-line', this.layersState.trails);
    setVis('flight-arcs-glow', this.layersState.trails);
    setVis('flight-arcs-core', this.layersState.trails);
    setVis('dxb-range-rings-line', this.layersState.sweep);
    setVis('dxb-airspace-tma-fill', this.layersState.sweep);
    setVis('dxb-airspace-tma-line', this.layersState.sweep);
    setVis('corridor-hazard-fill', this.layersState.sweep);
    setVis('corridor-hazard-line', this.layersState.sweep);
    setVis('tactical-graticule-lines', this.layersState.grid);

    const hudGrid = document.getElementById('radar-hud-grid-overlay');
    if (hudGrid) {
      hudGrid.style.display = this.layersState.grid ? 'block' : 'none';
    }
  }

  public setBasemap(mode: 'live' | 'satellite' | 'dark'): void {
    this.deps.onPlayClick();
    let style: maplibregl.StyleSpecification;
    let label = 'REAL LIVE MAP (OPENSTREETMAP)';

    if (mode === 'satellite') {
      style = REAL_SATELLITE_MAP_STYLE;
      label = 'REAL LIVE SATELLITE (ESRI WORLD)';
    } else if (mode === 'dark') {
      const key = (import.meta.env.VITE_CARTO_BASEMAP_KEY as string | undefined)?.trim();
      style = key ? buildCartoDarkMatterStyle(key) : ESRI_DARK_GRAY_RASTER_STYLE;
      label = key ? 'CARTO DARK MATTER (AUTHORIZED)' : 'TACTICAL DARK CANVAS (ESRI)';
    } else {
      style = REAL_LIVE_MAP_STYLE;
      label = 'REAL LIVE GEOGRAPHIC MAP (OPENSTREETMAP)';
    }

    this.updateBasemapStatus(label);

    const btnLive = document.getElementById('btn-basemap-live');
    const btnSat = document.getElementById('btn-basemap-satellite');
    const btnDark = document.getElementById('btn-basemap-dark');

    const activeClass =
      'px-2.5 py-1 text-[11px] rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm transition-all';
    const inactiveClass = 'px-2.5 py-1 text-[11px] rounded text-slate-400 hover:text-white transition-all';

    if (btnLive) btnLive.className = mode === 'live' ? activeClass : inactiveClass;
    if (btnSat) btnSat.className = mode === 'satellite' ? activeClass : inactiveClass;
    if (btnDark) btnDark.className = mode === 'dark' ? activeClass : inactiveClass;

    if (this.map) {
      this.map.setStyle(style);
    }
  }

  public toggleLayer(layer: 'vectors' | 'trails' | 'sweep' | 'grid'): void {
    this.deps.onPlayClick();
    this.layersState[layer] = !this.layersState[layer];
    this.applyLayerVisibilityState();

    const btn = document.getElementById(`btn-toggle-${layer}`);
    if (btn) {
      btn.className = this.layersState[layer]
        ? 'px-2 py-1 text-[11px] rounded bg-obsidian-850 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-950 font-bold'
        : 'px-2 py-1 text-[11px] rounded bg-obsidian-850 border border-slate-800 text-slate-500 hover:text-slate-300';
    }
  }

  public recenter(playSound: boolean = true): void {
    if (playSound) this.deps.onPlayClick();
    this.map?.flyTo({
      center: [55.3657, 25.2532],
      zoom: 8.6,
      pitch: this.viewMode === '3d' ? 38 : 0,
      bearing: this.viewMode === '3d' ? -12 : 0,
      duration: prefersReducedMotion() ? 0 : 1200
    });
  }

  public zoom(factor: number): void {
    this.deps.onPlayClick();
    if (!this.map) return;
    const currentZoom = this.map.getZoom();
    const targetZoom = factor > 1 ? currentZoom + 1.0 : currentZoom - 1.0;
    this.map.easeTo({
      zoom: Math.max(2.0, Math.min(16.0, targetZoom)),
      duration: prefersReducedMotion() ? 0 : 500
    });
  }

  public setViewMode(mode: '3d' | '2d'): void {
    this.deps.onPlayClick();
    this.viewMode = mode;
    const btn3D = document.getElementById('btn-mode-3d');
    const btn2D = document.getElementById('btn-mode-2d');

    if (mode === '3d') {
      if (btn3D)
        btn3D.className =
          'px-2.5 py-1 text-[11px] rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm transition-all';
      if (btn2D) btn2D.className = 'px-2.5 py-1 text-[11px] rounded text-slate-400 hover:text-white transition-all';
      this.map?.easeTo({ pitch: 38, bearing: -12, duration: prefersReducedMotion() ? 0 : 900 });
    } else {
      if (btn2D)
        btn2D.className =
          'px-2.5 py-1 text-[11px] rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm transition-all';
      if (btn3D) btn3D.className = 'px-2.5 py-1 text-[11px] rounded text-slate-400 hover:text-white transition-all';
      this.map?.easeTo({ pitch: 0, bearing: 0, duration: prefersReducedMotion() ? 0 : 900 });
    }
  }

  public flyToCorridor(corridorKey: string): void {
    const preset = this.deps.corridorCameraTargets[corridorKey];
    if (this.map && preset) {
      this.map.flyTo({ ...preset, duration: prefersReducedMotion() ? 0 : preset.duration });
    }
  }

  public flyToFlight(flight: FlightVector): void {
    if (!this.map || !isValidCoordinate(flight.lat, flight.lng)) return;
    this.selectAircraft(flight.id);
    this.map.flyTo({
      center: [flight.lng, flight.lat],
      zoom: 10.8,
      pitch: this.viewMode === '3d' ? 42 : 0,
      bearing: flight.heading ? flight.heading - 45 : -12,
      duration: prefersReducedMotion() ? 0 : 1400
    });
  }
}
