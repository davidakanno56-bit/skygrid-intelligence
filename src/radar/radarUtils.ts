import type * as maplibregl from 'maplibre-gl';
import type { FlightVector } from '../types/telemetry';

export const OPENFREEMAP_DARK_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

export const CARTO_ATTRIBUTION_HTML =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>';

export const ESRI_ATTRIBUTION_HTML =
  'Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noopener noreferrer">Esri</a> &mdash; Esri, DeLorme, NAVTEQ, TomTom';

/**
 * High-reliability, keyless dark canvas raster basemap style provided by Esri ArcGIS Online.
 * Requires zero API keys, never watermarks, and provides crisp global dark oceans,
 * UAE coastlines, Dubai shoreline, international borders, and highway terrain.
 */
export const ESRI_DARK_GRAY_RASTER_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'esri-dark-tiles': {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256,
      attribution: ESRI_ATTRIBUTION_HTML
    },
    'esri-dark-reference': {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
      ],
      tileSize: 256
    }
  },
  layers: [
    {
      id: 'esri-dark-tiles-layer',
      type: 'raster',
      source: 'esri-dark-tiles',
      minzoom: 0,
      maxzoom: 16
    },
    {
      id: 'esri-dark-reference-layer',
      type: 'raster',
      source: 'esri-dark-reference',
      minzoom: 0,
      maxzoom: 16,
      paint: {
        'raster-opacity': 0.65
      }
    }
  ]
};

/**
 * Pure dark fallback style used ONLY if external basemap networks fail/offline,
 * ensuring radar overlays, aircraft tracks, trails, graticules, and range rings always render.
 */
export const TACTICAL_OFFLINE_DARK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'tactical-offline-bg',
      type: 'background',
      paint: {
        'background-color': '#030916'
      }
    }
  ]
};

/**
 * Builds the CARTO Dark Matter raster MapLibre style with an authorized basemap API key.
 * Official docs: https://www.carto.com/basemaps/apikey/index.html
 */
export function buildCartoDarkMatterStyle(apiKey: string): maplibregl.StyleSpecification {
  const cleanKey = apiKey.trim();
  const keyParam = cleanKey ? `?api_key=${encodeURIComponent(cleanKey)}` : '';

  return {
    version: 8,
    sources: {
      'carto-dark': {
        type: 'raster',
        tiles: [
          `https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png${keyParam}`,
          `https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png${keyParam}`,
          `https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png${keyParam}`,
          `https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png${keyParam}`
        ],
        tileSize: 256,
        attribution: CARTO_ATTRIBUTION_HTML
      }
    },
    layers: [
      {
        id: 'carto-dark-tiles',
        type: 'raster',
        source: 'carto-dark',
        minzoom: 0,
        maxzoom: 20
      }
    ]
  };
}

export interface BasemapResolution {
  provider: 'carto-dark-matter' | 'esri-dark-gray' | 'openfreemap-dark';
  style: string | maplibregl.StyleSpecification;
  hasCartoKey: boolean;
  label: string;
}

/**
 * Selects the authorized CARTO Dark Matter style when VITE_CARTO_BASEMAP_KEY is provided;
 * otherwise uses the high-reliability keyless Esri Dark Gray Canvas raster basemap
 * (zero watermarks, zero font dependencies, instant load across all networks).
 */
export function resolveTacticalBasemap(cartoApiKey?: string): BasemapResolution {
  const key = (cartoApiKey ?? '').trim();
  if (key.length > 0) {
    return {
      provider: 'carto-dark-matter',
      style: buildCartoDarkMatterStyle(key),
      hasCartoKey: true,
      label: 'CARTO DARK MATTER (AUTHORIZED)'
    };
  }
  return {
    provider: 'esri-dark-gray',
    style: ESRI_DARK_GRAY_RASTER_STYLE,
    hasCartoKey: false,
    label: 'TACTICAL DARK GRAY CANVAS (KEYLESS)'
  };
}

export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Geodesic circle generator for tactical range rings (25 NM, 50 NM, 100 NM).
 */
export function createRangeRingCoordinates(
  center: [number, number],
  radiusKm: number,
  points: number = 72
): [number, number][] {
  const coords: [number, number][] = [];
  const kmPerLng = 111.32 * Math.cos((center[1] * Math.PI) / 180);
  const kmPerLat = 110.574;
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * (2 * Math.PI);
    const lng = center[0] + (radiusKm * Math.cos(angle)) / kmPerLng;
    const lat = center[1] + (radiusKm * Math.sin(angle)) / kmPerLat;
    coords.push([lng, lat]);
  }
  return coords;
}

/**
 * Projects a geographic coordinate forward along a true heading (degrees) by distanceKm.
 */
export function projectPointAlongHeading(
  lng: number,
  lat: number,
  headingDeg: number,
  distanceKm: number
): [number, number] {
  const rad = (headingDeg * Math.PI) / 180;
  const kmPerLng = 111.32 * Math.cos((lat * Math.PI) / 180);
  const kmPerLat = 110.574;
  const dLat = (distanceKm * Math.cos(rad)) / kmPerLat;
  const dLng = (distanceKm * Math.sin(rad)) / kmPerLng;
  return [Number((lng + dLng).toFixed(5)), Number((lat + dLat).toFixed(5))];
}

export function getRiskTrackColor(riskCategory: string, isSelected: boolean = false): string {
  if (isSelected) return '#ffffff';
  switch (riskCategory) {
    case 'critical':
      return '#f87171';
    case 'elevated':
      return '#fbbf24';
    case 'watch':
      return '#38bdf8';
    case 'low':
      return '#22d3ee';
    default:
      return '#34d399';
  }
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: Record<string, string | number | boolean>;
    geometry:
      | { type: 'LineString'; coordinates: [number, number][] }
      | { type: 'Polygon'; coordinates: [number, number][][] }
      | { type: 'Point'; coordinates: [number, number] };
  }>;
}

/**
 * Generates GeoJSON LineString trails from each flight's historical [lat, lng] positions.
 */
export function buildAircraftTrailsGeoJSON(
  flights: FlightVector[],
  selectedFlightId: string | null = null
): GeoJSONFeatureCollection {
  const features: GeoJSONFeatureCollection['features'] = [];

  for (const flight of flights) {
    if (!isValidCoordinate(flight.lat, flight.lng)) continue;
    const coords: [number, number][] = [];

    if (Array.isArray(flight.vectorHistory) && flight.vectorHistory.length > 0) {
      for (const pt of flight.vectorHistory) {
        if (Array.isArray(pt) && pt.length >= 2 && isValidCoordinate(pt[0], pt[1])) {
          coords.push([pt[1], pt[0]]); // GeoJSON uses [lng, lat]
        }
      }
    }

    // Ensure trail terminates cleanly at current live/simulated coordinate
    const last = coords[coords.length - 1];
    if (!last || Math.abs(last[0] - flight.lng) > 0.0001 || Math.abs(last[1] - flight.lat) > 0.0001) {
      coords.push([flight.lng, flight.lat]);
    }

    // If only one point exists (e.g. just wrapped), synthesize a short rear wake stub
    if (coords.length < 2) {
      const rearPoint = projectPointAlongHeading(flight.lng, flight.lat, (flight.heading + 180) % 360, 8);
      coords.unshift(rearPoint);
    }

    const isSelected = selectedFlightId === flight.id;
    features.push({
      type: 'Feature',
      properties: {
        id: flight.id,
        callsign: flight.callsign,
        color: getRiskTrackColor(flight.riskCategory, isSelected),
        width: isSelected ? 3.2 : 1.9,
        opacity: isSelected ? 0.98 : 0.72,
        isSelected
      },
      geometry: {
        type: 'LineString',
        coordinates: coords
      }
    });
  }

  return { type: 'FeatureCollection', features };
}

/**
 * Generates forward heading predictor vectors proportional to each aircraft's ground speed.
 */
export function buildHeadingVectorsGeoJSON(
  flights: FlightVector[],
  selectedFlightId: string | null = null,
  leadMinutes: number = 2.5
): GeoJSONFeatureCollection {
  const features: GeoJSONFeatureCollection['features'] = [];

  for (const flight of flights) {
    if (!isValidCoordinate(flight.lat, flight.lng)) continue;
    const speedKts = Math.max(180, Math.min(600, Number(flight.speed) || 400));
    // 1 knot = 1.852 km/h -> distance in km over leadMinutes
    const distanceKm = (speedKts * 1.852 * leadMinutes) / 60;
    const projected = projectPointAlongHeading(flight.lng, flight.lat, flight.heading, distanceKm);
    const isSelected = selectedFlightId === flight.id;

    features.push({
      type: 'Feature',
      properties: {
        id: flight.id,
        callsign: flight.callsign,
        color: isSelected ? '#fde047' : '#67e8f9',
        width: isSelected ? 2.4 : 1.4,
        opacity: isSelected ? 0.95 : 0.78
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [flight.lng, flight.lat],
          projected
        ]
      }
    });
  }

  return { type: 'FeatureCollection', features };
}

/**
 * Builds visually distinct hazard zones (amber/crimson convective & windshear corridors)
 * separate from cyan/blue aircraft tracks.
 */
export function buildHazardZonesGeoJSON(): GeoJSONFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          id: 'HZ-DXB-SHEAR-01',
          name: 'SIMULATED WINDSHEAR CELL (FL280-FL340)',
          severity: 'ELEVATED',
          fillColor: 'rgba(245, 158, 11, 0.16)',
          lineColor: '#f59e0b'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [55.48, 25.44],
              [55.76, 25.48],
              [55.84, 25.31],
              [55.62, 25.24],
              [55.44, 25.32],
              [55.48, 25.44]
            ]
          ]
        }
      },
      {
        type: 'Feature',
        properties: {
          id: 'HZ-GULF-TURB-02',
          name: 'SIMULATED WAKE / SHEAR ADVISORY',
          severity: 'WATCH',
          fillColor: 'rgba(239, 68, 68, 0.12)',
          lineColor: '#ef4444'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [54.76, 25.12],
              [55.02, 25.16],
              [55.08, 24.98],
              [54.82, 24.94],
              [54.76, 25.12]
            ]
          ]
        }
      }
    ]
  };
}

/**
 * Builds the Dubai Terminal Control Area (OMDB/OMDW TMA) airspace boundary overlay.
 */
export function buildAirspaceOverlayGeoJSON(): GeoJSONFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: 'OMDB / OMDW DUBAI TMA (SIMULATED OVERLAY)'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [54.55, 25.85],
              [56.15, 25.85],
              [56.25, 24.65],
              [54.65, 24.55],
              [54.45, 25.20],
              [54.55, 25.85]
            ]
          ]
        }
      }
    ]
  };
}

/**
 * Builds the Tactical Radar Graticule GeoJSON:
 * 1. Latitude parallels every 0.25° (15 NM) across 23.00°N - 27.50°N
 * 2. Longitude meridians every 0.25° (15 NM) across 52.00°E - 57.50°E
 * 3. Major lines every 0.50° (30 NM) highlighted
 * 4. Radial azimuth spokes radiating from OMDB [55.3657, 25.2532] out to 100 NM (185.2 km)
 */
export function buildTacticalGraticuleGeoJSON(): GeoJSONFeatureCollection {
  const features: GeoJSONFeatureCollection['features'] = [];

  const minLat = 23.0;
  const maxLat = 27.5;
  const minLng = 52.0;
  const maxLng = 57.5;
  const step = 0.25;

  // Latitude parallels (horizontal coordinate grid lines)
  for (let lat = minLat; lat <= maxLat + 0.001; lat += step) {
    const roundedLat = Math.round(lat * 100) / 100;
    const isMajor = Math.abs(roundedLat % 0.5) < 0.01;
    features.push({
      type: 'Feature',
      properties: {
        kind: 'graticule-parallel',
        isMajor,
        color: isMajor ? '#22d3ee' : '#0891b2',
        opacity: isMajor ? 0.38 : 0.18,
        width: isMajor ? 1.2 : 0.75,
        label: `${roundedLat.toFixed(2)}°N`
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [minLng, roundedLat],
          [maxLng, roundedLat]
        ]
      }
    });
  }

  // Longitude meridians (vertical coordinate grid lines)
  for (let lng = minLng; lng <= maxLng + 0.001; lng += step) {
    const roundedLng = Math.round(lng * 100) / 100;
    const isMajor = Math.abs(roundedLng % 0.5) < 0.01;
    features.push({
      type: 'Feature',
      properties: {
        kind: 'graticule-meridian',
        isMajor,
        color: isMajor ? '#22d3ee' : '#0891b2',
        opacity: isMajor ? 0.38 : 0.18,
        width: isMajor ? 1.2 : 0.75,
        label: `${roundedLng.toFixed(2)}°E`
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [roundedLng, minLat],
          [roundedLng, maxLat]
        ]
      }
    });
  }

  // Radial azimuth spokes radiating from OMDB center
  const omdbCenter: [number, number] = [55.3657, 25.2532];
  const radialBearings = [0, 45, 90, 135, 180, 225, 270, 315];
  const maxRangeKm = 185.2; // 100 NM

  radialBearings.forEach((brg) => {
    const spokeEnd = projectPointAlongHeading(omdbCenter[0], omdbCenter[1], brg, maxRangeKm);
    const isCardinal = brg % 90 === 0;
    features.push({
      type: 'Feature',
      properties: {
        kind: 'radial-spoke',
        isMajor: isCardinal,
        color: isCardinal ? '#38bdf8' : '#06b6d4',
        opacity: isCardinal ? 0.35 : 0.20,
        width: isCardinal ? 1.2 : 0.8,
        bearing: brg
      },
      geometry: {
        type: 'LineString',
        coordinates: [omdbCenter, spokeEnd]
      }
    });
  });

  return {
    type: 'FeatureCollection',
    features
  };
}

/**
 * Advances a simulated aircraft smoothly along its heading for dtSeconds,
 * updating altitude slightly from verticalRateFpm and maintaining a bounded track history (max 20 points).
 */
export function advanceSimulatedFlight(flight: FlightVector, dtSeconds: number = 1.0): FlightVector {
  const speedKts = Math.max(220, Math.min(560, Number(flight.speed) || 440));
  // Real-time accelerated slightly (2.5x) so tracks visibly move on radar during demo/evaluation
  const distanceKm = ((speedKts * 1.852) / 3600) * dtSeconds * 2.5;
  const [nextLngRaw, nextLatRaw] = projectPointAlongHeading(flight.lng, flight.lat, flight.heading, distanceKm);

  let nextLng = nextLngRaw;
  let nextLat = nextLatRaw;
  let wrapped = false;

  if (nextLng > 56.45) {
    nextLng = 54.45;
    wrapped = true;
  } else if (nextLng < 54.25) {
    nextLng = 56.20;
    wrapped = true;
  }
  if (nextLat > 26.05) {
    nextLat = 24.55;
    wrapped = true;
  } else if (nextLat < 24.45) {
    nextLat = 25.90;
    wrapped = true;
  }

  flight.lng = Number(nextLng.toFixed(5));
  flight.lat = Number(nextLat.toFixed(5));
  flight.isSimulated = true;

  // Gently evolve altitude if climbing or descending within FL080 - FL430
  const vRate = flight.verticalRateFpm ?? 0;
  if (vRate !== 0) {
    const nextAlt = Math.round(flight.altitude + (vRate / 60) * dtSeconds);
    if (nextAlt >= 8000 && nextAlt <= 43000) {
      flight.altitude = nextAlt;
      flight.flightLevel = `FL${Math.round(nextAlt / 100)
        .toString()
        .padStart(3, '0')}`;
    } else {
      flight.verticalRateFpm = -vRate;
    }
  }

  if (!Array.isArray(flight.vectorHistory)) {
    flight.vectorHistory = [];
  }

  if (wrapped) {
    flight.vectorHistory = [[flight.lat, flight.lng]];
  } else {
    const last = flight.vectorHistory[flight.vectorHistory.length - 1];
    if (!last || Math.hypot(last[0] - flight.lat, last[1] - flight.lng) >= 0.0025) {
      flight.vectorHistory.push([flight.lat, flight.lng]);
      if (flight.vectorHistory.length > 20) {
        flight.vectorHistory = flight.vectorHistory.slice(-20);
      }
    }
  }

  return flight;
}
