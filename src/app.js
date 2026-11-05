/**
 * SkyGrid Intelligence - Enterprise Aviation Risk Command Center
 * Akanno Tech Labs
 * Bloomberg-grade Real-Time Flight Telemetry & 3D Radar System
 * Production B2B SaaS Integration Layer
 */

// Tactical Data Sets & Fallback State
const AIR_CORRIDORS = {
  'dxb-primary': {
    name: 'DXB AIR CORRIDOR',
    code: 'DXB-CORR-01',
    lat: 25.2532,
    lng: 55.3657,
    coordsLabel: '25.25°N, 55.36°E',
    activeVectors: 1428,
    riskIndex: 14.2,
    throughput: 842.6,
    directives: 42,
    riskGauge: 28,
    status: 'Optimal'
  },
  'doh-dxb': {
    name: 'DOH-DXB SUPERWAY',
    code: 'GULF-SW-04',
    lat: 25.3200,
    lng: 53.5000,
    coordsLabel: '25.32°N, 53.50°E',
    activeVectors: 964,
    riskIndex: 19.8,
    throughput: 620.4,
    directives: 28,
    riskGauge: 34,
    status: 'Caution'
  },
  'sin-dxb': {
    name: 'SIN-DXB EURASIA ROUTE',
    code: 'EURASIA-E07',
    lat: 18.4200,
    lng: 68.1000,
    coordsLabel: '18.42°N, 68.10°E',
    activeVectors: 1850,
    riskIndex: 16.5,
    throughput: 1140.2,
    directives: 65,
    riskGauge: 24,
    status: 'Optimal'
  },
  'lhr-dxb': {
    name: 'LHR-DXB GLOBAL AXIS',
    code: 'TRANS-AXIS-02',
    lat: 34.8000,
    lng: 42.1000,
    coordsLabel: '34.80°N, 42.10°E',
    activeVectors: 1215,
    riskIndex: 12.9,
    throughput: 795.0,
    directives: 31,
    riskGauge: 22,
    status: 'Optimal'
  },
  'dwc-expansion': {
    name: 'DWC EXPANSION SECTOR',
    code: 'DWC-LOG-9',
    lat: 24.8967,
    lng: 55.1614,
    coordsLabel: '24.90°N, 55.16°E',
    activeVectors: 712,
    riskIndex: 8.4,
    throughput: 510.8,
    directives: 18,
    riskGauge: 16,
    status: 'Optimal'
  }
};

let FLIGHTS_DATA = [
  {
    id: 'FL-902',
    callsign: 'EK-CARGO 902',
    carrier: 'Emirates SkyCargo',
    aircraft: 'Boeing 777-200LRF',
    origin: 'FRA',
    originCity: 'Frankfurt',
    destination: 'DXB',
    destinationCity: 'Dubai',
    altitude: 38000,
    flightLevel: 'FL380',
    speed: 488,
    mach: 0.83,
    heading: 128,
    lat: 25.324,
    lng: 55.452,
    riskScore: 4.2,
    riskCategory: 'minimal',
    status: 'In Corridor',
    cargoPayload: 'Cold-Chain Bio-Pharmaceuticals (Active Dry Ice Containers)',
    cargoWeightTonnes: 94.2,
    transponder: '7142-S',
    etaMinutes: 14,
    hazardNote: 'Nominal corridor trajectory. Laminar separation confirmed.'
  },
  {
    id: 'FL-4412',
    callsign: 'FDX-4412',
    carrier: 'FedEx Express Global',
    aircraft: 'McDonnell Douglas MD-11F',
    origin: 'MEM',
    originCity: 'Memphis',
    destination: 'DXB',
    destinationCity: 'Dubai',
    altitude: 31000,
    flightLevel: 'FL310',
    speed: 452,
    mach: 0.79,
    heading: 104,
    lat: 25.185,
    lng: 55.221,
    riskScore: 28.0,
    riskCategory: 'watch',
    status: 'Vector Corrected',
    cargoPayload: 'Class 9 High-Density Lithium-Ion Energy Cells (Temp Regulated)',
    cargoWeightTonnes: 68.5,
    transponder: '4521-X',
    etaMinutes: 22,
    hazardNote: 'Tailwind windshear anomaly at FL310; speed vector dampened by -12 kts.'
  },
  {
    id: 'FL-81',
    callsign: 'ATLAS-81',
    carrier: 'Atlas Air Heavy Freight',
    aircraft: 'Boeing 747-8F',
    origin: 'ORD',
    originCity: 'Chicago O’Hare',
    destination: 'DXB',
    destinationCity: 'Dubai',
    altitude: 36000,
    flightLevel: 'FL360',
    speed: 495,
    mach: 0.85,
    heading: 135,
    lat: 25.405,
    lng: 55.502,
    riskScore: 14.6,
    riskCategory: 'low',
    status: 'In Corridor',
    cargoPayload: 'Precision Aerospace Turbofan Assemblies & Avionics Spares',
    cargoWeightTonnes: 118.4,
    transponder: '6330-S',
    etaMinutes: 31,
    hazardNote: 'Clear of wake turbulence zones. Speed schedule synchronized.'
  },
  {
    id: 'FL-109',
    callsign: 'DHL-AERO 109',
    carrier: 'DHL Aviation Middle East',
    aircraft: 'Airbus A330-200F',
    origin: 'LEJ',
    originCity: 'Leipzig',
    destination: 'DWC',
    destinationCity: 'Al Maktoum',
    altitude: 12000,
    flightLevel: 'FL120',
    speed: 310,
    mach: 0.58,
    heading: 195,
    lat: 24.952,
    lng: 55.155,
    riskScore: 7.8,
    riskCategory: 'minimal',
    status: 'Final Descent',
    cargoPayload: 'Cross-Border High-Value Express Priority Freight',
    cargoWeightTonnes: 54.1,
    transponder: '2214-S',
    etaMinutes: 9,
    hazardNote: 'Direct straight-in ILS Runway 30L cleared at DWC.'
  },
  {
    id: 'FL-77',
    callsign: 'SQ-CARGO 77',
    carrier: 'Singapore Cargo',
    aircraft: 'Boeing 777F',
    origin: 'SIN',
    originCity: 'Singapore Changi',
    destination: 'DXB',
    destinationCity: 'Dubai',
    altitude: 26000,
    flightLevel: 'FL260',
    speed: 440,
    mach: 0.76,
    heading: 310,
    lat: 25.552,
    lng: 55.705,
    riskScore: 19.3,
    riskCategory: 'watch',
    status: 'Holding Pattern',
    cargoPayload: 'ASML EUV Semiconductor Components & Optoelectronics',
    cargoWeightTonnes: 72.8,
    transponder: '7504-T',
    etaMinutes: 38,
    hazardNote: 'Approach sector slot saturation; holding orbit 2 cleared.'
  },
  {
    id: 'FL-994',
    callsign: 'QTR-994',
    carrier: 'Qatar Airways Cargo',
    aircraft: 'Boeing 777-200F',
    origin: 'DOH',
    originCity: 'Doha Hamad',
    destination: 'DXB',
    destinationCity: 'Dubai',
    altitude: 24000,
    flightLevel: 'FL240',
    speed: 395,
    mach: 0.72,
    heading: 85,
    lat: 25.105,
    lng: 55.052,
    riskScore: 11.2,
    riskCategory: 'low',
    status: 'In Corridor',
    cargoPayload: 'Perishable Diplomatic Consignments & Bank Bullion',
    cargoWeightTonnes: 62.0,
    transponder: '3318-S',
    etaMinutes: 18,
    hazardNote: 'Nominal crossing boundary. Sector handover approved.'
  },
  {
    id: 'FL-63',
    callsign: 'CPA-CARGO 63',
    carrier: 'Cathay Pacific Cargo',
    aircraft: 'Boeing 747-400ERF',
    origin: 'HKG',
    originCity: 'Hong Kong Chek Lap Kok',
    destination: 'DWC',
    destinationCity: 'Al Maktoum',
    altitude: 39000,
    flightLevel: 'FL390',
    speed: 512,
    mach: 0.86,
    heading: 265,
    lat: 24.855,
    lng: 55.302,
    riskScore: 23.5,
    riskCategory: 'watch',
    status: 'Vector Corrected',
    cargoPayload: 'Consumer Electronics & Solid State Storage Modules',
    cargoWeightTonnes: 104.7,
    transponder: '5190-S',
    etaMinutes: 26,
    hazardNote: 'Autonomous altitude step to FL370 confirmed for laminar merge.'
  },
  {
    id: 'FL-9902',
    callsign: 'UAE-9902',
    carrier: 'Emirates SkyCargo Special',
    aircraft: 'Airbus A350-1000F',
    origin: 'SYD',
    originCity: 'Sydney Kingsford Smith',
    destination: 'DXB',
    destinationCity: 'Dubai',
    altitude: 41000,
    flightLevel: 'FL410',
    speed: 504,
    mach: 0.85,
    heading: 305,
    lat: 25.602,
    lng: 55.854,
    riskScore: 3.1,
    riskCategory: 'minimal',
    status: 'In Corridor',
    cargoPayload: 'Fresh Chilled Wagyu Export & Sovereign Gold Bullion',
    cargoWeightTonnes: 88.0,
    transponder: '7721-S',
    etaMinutes: 44,
    hazardNote: 'Clear oceanic arrival corridor. Zero hazard profile.'
  },
  {
    id: 'DLH-8220',
    callsign: 'DLH-8220',
    carrier: 'Lufthansa Cargo AG',
    aircraft: 'Boeing 777F',
    origin: 'CGN',
    originCity: 'Cologne Bonn',
    destination: 'DXB',
    destinationCity: 'Dubai',
    altitude: 37000,
    flightLevel: 'FL370',
    speed: 482,
    mach: 0.82,
    heading: 120,
    lat: 25.221,
    lng: 55.285,
    riskScore: 8.4,
    riskCategory: 'minimal',
    status: 'In Corridor',
    cargoPayload: 'German Automotive Precision Robotics Components',
    cargoWeightTonnes: 81.3,
    transponder: '4112-S',
    etaMinutes: 19,
    hazardNote: 'Standard STAR transition on schedule.'
  },
  {
    id: 'CLX-714',
    callsign: 'CLX-714',
    carrier: 'Cargolux International',
    aircraft: 'Boeing 747-8F',
    origin: 'LUX',
    originCity: 'Luxembourg Findel',
    destination: 'DXB',
    destinationCity: 'Dubai',
    altitude: 35000,
    flightLevel: 'FL350',
    speed: 465,
    mach: 0.81,
    heading: 142,
    lat: 25.385,
    lng: 55.625,
    riskScore: 31.2,
    riskCategory: 'elevated',
    status: 'Rerouting Required',
    cargoPayload: 'High-Value Banknotes & Spacecraft Subsystem Harnesses',
    cargoWeightTonnes: 112.0,
    transponder: '7005-X',
    etaMinutes: 35,
    hazardNote: 'Geomagnetic beacon jitter detected; autonomous vector offset 15° Right requested.'
  }
];

const TACTICAL_NODES = [
  { name: 'OMDB (DXB)', type: 'PRIMARY HUB', lat: 25.2532, lng: 55.3657, desc: 'Dubai International Mega Terminal' },
  { name: 'OMDW (DWC)', type: 'LOGISTICS HUB', lat: 24.8967, lng: 55.1614, desc: 'Al Maktoum Int Logistics Hub' },
  { name: 'DESIG', type: 'TAC GATE', lat: 25.6500, lng: 55.7500, desc: 'Eastern Arrival STAR Fix' },
  { name: 'RIKET', type: 'WAYPOINT', lat: 25.8200, lng: 55.1200, desc: 'Northern Inbound Oceanic Gate' },
  { name: 'GUPVO', type: 'TAC GATE', lat: 24.6200, lng: 56.1000, desc: 'Southeastern Gulf Transition' },
  { name: 'ORSAR', type: 'WAYPOINT', lat: 25.4800, lng: 54.4500, desc: 'Arabian Gulf Western Fix' },
  { name: 'VUTEB', type: 'HOLDING', lat: 24.4500, lng: 54.9500, desc: 'Southwest Holding Pattern' },
  { name: 'ITRAX', type: 'WAYPOINT', lat: 25.0800, lng: 55.2200, desc: 'Terminal Dual-Runway Merge' }
];

let DIRECTIVES_LOG = [
  {
    id: 'DIR-88102',
    time: '19:24 GST',
    flight: 'FDX-4412',
    action: 'VORTEX_SEPARATION',
    text: 'Separation vector extended to 6.2 NM trailing EK-902 due to heavy MD-11 wake vortex index.',
    reduction: '-14.2%',
    confidence: '99.6%'
  },
  {
    id: 'DIR-88101',
    time: '19:23 GST',
    flight: 'CLX-714',
    action: 'WAYPOINT_BYPASS',
    text: 'Bypassing congested DESIG entry fix directly to RIKET waypoint at heading 142° to eliminate hold delay.',
    reduction: '-18.7%',
    confidence: '99.2%'
  },
  {
    id: 'DIR-88100',
    time: '19:21 GST',
    flight: 'CPA-CARGO 63',
    action: 'ALTITUDE_STEP_CLIMB',
    text: 'Step-descent to FL370 confirmed to establish laminar separation with inbound SYD A350.',
    reduction: '-12.0%',
    confidence: '99.8%'
  },
  {
    id: 'DIR-88099',
    time: '19:18 GST',
    flight: 'SQ-CARGO 77',
    action: 'SPEED_ADJUSTMENT',
    text: 'Mach reduction to 0.74 issued to optimize DWC cross-corridor runway arrival slot.',
    reduction: '-8.5%',
    confidence: '99.4%'
  },
  {
    id: 'DIR-88098',
    time: '19:15 GST',
    flight: 'DHL-AERO 109',
    action: 'SLOT_OPTIMIZATION',
    text: 'Direct straight-in ILS Runway 30L cleared at DWC; slot utilization efficiency +16.2%.',
    reduction: '-6.4%',
    confidence: '99.9%'
  }
];

// Tactical Web Audio System
class TacticalAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }
  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
  playPing() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.14);
    } catch (e) {}
  }
  playClick() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch (e) {}
  }
  playChime() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [587.33, 880, 1174.66].forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.04, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.2);
      });
    } catch (e) {}
  }
}

const audio = new TacticalAudio();

// Application State
let activeCorridorKey = 'dxb-primary';
let currentFilter = 'all';
let selectedFlight = null;
let layersState = { vectors: true, sweep: true };
let radarViewMode = '3d'; // '3d' or '2d'
let activeApiKey = 'sk_live_akanno_sovereign_dxb_001';

// ==================== MAPLIBRE GL JS TACTICAL VECTOR RADAR SYSTEM ====================

let map = null;
let mapInitialized = false;
let aircraftMarkers = {};
let hubMarkers = [];
let movementInterval = null;
let currentSweepAzimuth = 184;

// Strategic Geographic Airport Hub Coordinates
const AIRPORT_HUBS = [
  { code: 'OMDB / DXB', name: 'Dubai International Mega-Terminal', city: 'Dubai, UAE', coords: [55.3657, 25.2532], isPrimary: true, role: 'Primary Cargo Mega-Terminal & Hub Center' },
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
const CORRIDOR_CAMERA_TARGETS = {
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

// Generate precise geodesic circle coordinates for tactical range rings
function createRangeRingCoordinates(center, radiusKm, points = 64) {
  const coords = [];
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

// Generate curved Bezier arc between two geographic hubs
function generateCurvedArc(start, end, numPoints = 40) {
  const points = [];
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

// Initialize MapLibre GL JS Dark-Matter Vector Radar
function initMapLibreRadar() {
  const container = document.getElementById('tactical-map-container') || document.getElementById('radar-canvas-container');
  if (!container) return;

  if (typeof maplibregl === 'undefined') {
    console.warn('[MAPLIBRE GL] Library not loaded yet, retrying in 300ms...');
    setTimeout(initMapLibreRadar, 300);
    return;
  }

  // Carto Dark Matter Vector Map Style
  const cartoDarkStyle = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

  try {
    map = new maplibregl.Map({
      container: container,
      style: cartoDarkStyle,
      center: [55.3657, 25.2532], // Centered at OMDB / Dubai International
      zoom: 9.0,
      pitch: 45, // Requested tilted 3D pitch
      bearing: -20,
      antialias: true,
      attributionControl: false
    });

    // Update HUD metrics on map camera move
    map.on('move', () => {
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

    // Handle map load errors gracefully with dark fallback styling
    map.on('error', (e) => {
      console.warn('[MAPLIBRE EVENT WARNING]', e);
    });

  } catch (err) {
    console.error('[MAPLIBRE INIT ERROR]', err);
  }
}

// Add Range Rings GeoJSON Layers (25NM, 50NM, 100NM centered on DXB)
function addRangeRingsLayers() {
  if (!map) return;
  const dxbCenter = [55.3657, 25.2532];
  // 1 NM = 1.852 km: 25NM = 46.3km, 50NM = 92.6km, 100NM = 185.2km
  const ring25 = createRangeRingCoordinates(dxbCenter, 46.3);
  const ring50 = createRangeRingCoordinates(dxbCenter, 92.6);
  const ring100 = createRangeRingCoordinates(dxbCenter, 185.2);

  const rangeRingsGeoJSON = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: '25 NM RING', color: '#22d3ee', opacity: 0.65, width: 1.5 },
        geometry: { type: 'LineString', coordinates: ring25 }
      },
      {
        type: 'Feature',
        properties: { name: '50 NM RING', color: '#06b6d4', opacity: 0.5, width: 1.2 },
        geometry: { type: 'LineString', coordinates: ring50 }
      },
      {
        type: 'Feature',
        properties: { name: '100 NM RING', color: '#0e7490', opacity: 0.4, width: 1.0 },
        geometry: { type: 'LineString', coordinates: ring100 }
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
function addFlightPathArcLayers() {
  if (!map) return;
  const hubCoords = {};
  AIRPORT_HUBS.forEach(h => {
    const key = h.code.split('/')[1]?.trim() || h.code.split('/')[0]?.trim();
    hubCoords[key] = h.coords;
  });

  const corridorConnections = [
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

  const arcFeatures = [];
  corridorConnections.forEach((conn) => {
    if (hubCoords[conn.from] && hubCoords[conn.to]) {
      const arcPoints = generateCurvedArc(hubCoords[conn.from], hubCoords[conn.to]);
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

    // Glowing Blur Layer
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

    // Sharp Dashed Tactical Core Line
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
function renderHubBeaconMarkers() {
  if (!map) return;
  hubMarkers.forEach(m => m.remove());
  hubMarkers = [];

  AIRPORT_HUBS.forEach((hub) => {
    const el = document.createElement('div');
    el.className = 'tactical-hub-beacon';
    el.innerHTML = `
      <div class="hub-beacon-pulse ${hub.isPrimary ? 'primary' : ''}"></div>
      <div class="hub-beacon-core ${hub.isPrimary ? 'primary' : ''}"></div>
      <div class="hub-beacon-label ${hub.isPrimary ? 'primary' : ''}">${hub.code.split('/')[1]?.trim() || hub.code}</div>
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
      .addTo(map);

    hubMarkers.push(marker);
  });
}

// Render Moving Aircraft Markers with Clickable Popups
function renderMovingAircraftMarkers() {
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

    if (aircraftMarkers[flight.id]) {
      const markerObj = aircraftMarkers[flight.id];
      markerObj.marker.setLngLat([flight.lng, flight.lat]);
      const iconBox = markerObj.el.querySelector('.plane-icon-box');
      if (iconBox) {
        iconBox.style.transform = `rotate(${flight.heading || 0}deg)`;
      }
      return;
    }

    const el = document.createElement('div');
    el.className = 'tactical-plane-marker';
    el.innerHTML = `
      <div class="plane-icon-box" style="transform: rotate(${flight.heading || 0}deg);">
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
      .addTo(map);

    aircraftMarkers[flight.id] = { marker, el, flight };
  });
}

// Smooth Continuous Movement Loop for Active Vectors
function startAircraftMovementLoop() {
  if (movementInterval) clearInterval(movementInterval);
  movementInterval = setInterval(() => {
    FLIGHTS_DATA.forEach((flight) => {
      const rad = ((flight.heading || 90) * Math.PI) / 180;
      const speedFactor = 0.00035 * (flight.speed / 450);
      flight.lng += Math.sin(rad) * speedFactor;
      flight.lat += Math.cos(rad) * speedFactor;

      // Wrap vectors smoothly around Dubai terminal airspace
      if (flight.lng > 56.6) flight.lng = 54.7;
      if (flight.lng < 54.2) flight.lng = 55.9;
      if (flight.lat > 26.1) flight.lat = 24.7;
      if (flight.lat < 24.6) flight.lat = 25.6;

      if (aircraftMarkers[flight.id]) {
        aircraftMarkers[flight.id].marker.setLngLat([flight.lng, flight.lat]);
      }
    });
  }, 1200);
}

// Tactical Azimuth Sweep Compass Simulator
function startAzimuthSweepSimulation() {
  setInterval(() => {
    currentSweepAzimuth = (currentSweepAzimuth + 2) % 360;
    const azEl = document.getElementById('radar-azimuth');
    if (azEl) {
      azEl.textContent = `${currentSweepAzimuth}°`;
    }
  }, 100);
}

// Camera Controls: Recenter, 3D Pitch / 2D Plan Scope, Zoom
function recenterRadar(playSound = true) {
  if (playSound) audio.playClick();
  if (map) {
    map.flyTo({
      center: [55.3657, 25.2532],
      zoom: 9.0,
      pitch: 45,
      bearing: -20,
      duration: 1800
    });
  }
}

function zoomRadar(factor) {
  audio.playClick();
  if (map) {
    if (factor > 1) {
      map.zoomIn();
    } else {
      map.zoomOut();
    }
  }
}

function setRadarViewMode(mode) {
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

function toggleLayer(layer) {
  audio.playClick();
  layersState[layer] = !layersState[layer];
  const btn = document.getElementById(`btn-toggle-${layer}`);

  if (layer === 'vectors') {
    Object.values(aircraftMarkers).forEach(m => {
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

// Fallback compatibility for any legacy callers
function createFlightArcsAndVectors() {
  if (mapInitialized) {
    renderMovingAircraftMarkers();
  }
}

// ==================== LIVE BACKEND SYNCHRONIZATION ====================

async function fetchLiveBackendTelemetry() {
  try {
    const res = await fetch(`/api/v1/corridor/live?corridor_id=${activeCorridorKey}`, {
      headers: { 'x-api-key': activeApiKey }
    });
    if (res.ok) {
      const data = await res.json();
      const corridor = data.corridor;
      const weather = data.weather;
      const stats = data.cache_stats;

      // Update Top Metrics Cards
      const vecEl = document.getElementById('metric-vectors');
      if (vecEl && corridor.activeVectors) vecEl.textContent = corridor.activeVectors.toLocaleString();

      const riskEl = document.getElementById('metric-risk-index');
      if (riskEl && corridor.riskIndex) riskEl.textContent = Number(corridor.riskIndex).toFixed(1);

      const tputEl = document.getElementById('metric-throughput');
      if (tputEl && corridor.throughputTonnesPerHour) tputEl.textContent = Number(corridor.throughputTonnesPerHour).toFixed(1);

      const dirEl = document.getElementById('metric-directives');
      if (dirEl && corridor.autonomousDirectivesCount) dirEl.textContent = corridor.autonomousDirectivesCount;

      // Update Overall Risk Gauge
      const gaugeValEl = document.getElementById('risk-gauge-val');
      const gaugeArc = document.getElementById('risk-gauge-arc');
      if (gaugeValEl) {
        const val = corridor.overallRiskGauge || 28;
        gaugeValEl.textContent = `${Math.round(val)}%`;
      }
      if (gaugeArc) {
        const val = corridor.overallRiskGauge || 28;
        const targetOffset = 301.59 - (301.59 * (val / 100) * 0.82);
        gaugeArc.style.strokeDashoffset = targetOffset;
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
          dbDot.className = stats.db_engine.includes('Postgre') ? 'w-2 h-2 rounded-full bg-cyan-400 animate-pulse' : 'w-2 h-2 rounded-full bg-emerald-400';
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
    const flightRes = await fetch('/api/v1/telemetry/flights', {
      headers: { 'x-api-key': activeApiKey }
    });
    if (flightRes.ok) {
      const flightData = await flightRes.json();
      if (flightData.flights && flightData.flights.length > 0) {
        FLIGHTS_DATA = flightData.flights;
        renderFlightFeed();
        createFlightArcsAndVectors();
      }
    }
  } catch (e) {}
}

// Render Live Flight Sidebar Feed
function renderFlightFeed() {
  const container = document.getElementById('flight-feed-list');
  if (!container) return;

  const searchQuery = (document.getElementById('flight-search')?.value || '').toLowerCase();

  const filtered = FLIGHTS_DATA.filter((flight) => {
    const matchesSearch =
      flight.callsign.toLowerCase().includes(searchQuery) ||
      flight.carrier.toLowerCase().includes(searchQuery) ||
      flight.origin.toLowerCase().includes(searchQuery) ||
      flight.destination.toLowerCase().includes(searchQuery);

    if (!matchesSearch) return false;

    if (currentFilter === 'watch') return flight.riskScore >= 15;
    if (currentFilter === 'corridor') return flight.status === 'In Corridor';
    return true;
  });

  const countEl = document.getElementById('active-flight-count');
  if (countEl) countEl.textContent = filtered.length;

  container.innerHTML = filtered
    .map((flight) => {
      let badgeClass = 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60';
      if (flight.riskCategory === 'watch') {
        badgeClass = 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60';
      } else if (flight.riskCategory === 'elevated') {
        badgeClass = 'bg-amber-950/80 text-amber-300 border-amber-700/60';
      }

      const isCorrected = flight.status === 'Vector Corrected';
      const statusPill = isCorrected
        ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-cyan-900/60 text-cyan-300 font-bold border border-cyan-600/40">DECONFLICTED</span>'
        : `<span class="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">${flight.status}</span>`;

      return `
      <div onclick="window.openFlightModal('${flight.id}')" 
           class="p-2.5 rounded-lg bg-obsidian-850/80 border border-slate-800/90 hover:border-cyan-400/60 hover:bg-obsidian-800 transition-all cursor-pointer group">
        
        <div class="flex items-center justify-between font-mono mb-1">
          <div class="flex items-center space-x-1.5">
            <span class="w-1.5 h-1.5 rounded-full ${flight.riskCategory === 'elevated' ? 'bg-amber-400 animate-ping' : 'bg-cyan-400'}"></span>
            <span class="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">${flight.callsign}</span>
            <span class="text-[10px] text-slate-400">(${flight.aircraft})</span>
          </div>
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold font-telemetry border ${badgeClass}">
            ${Number(flight.riskScore).toFixed(1)}% RISK
          </span>
        </div>

        <div class="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div class="flex items-center space-x-2">
            <span class="text-white font-semibold">${flight.origin}</span>
            <span class="text-cyan-400">➔</span>
            <span class="text-white font-semibold">${flight.destination}</span>
            <span class="text-slate-600">|</span>
            <span class="text-slate-300 font-telemetry">${flight.flightLevel}</span>
          </div>
          <div class="font-telemetry text-slate-300">
            ${flight.speed} kts
          </div>
        </div>

        <div class="mt-1.5 flex items-center justify-between text-[10px] font-mono">
          <span class="text-slate-500 truncate max-w-[170px]">${flight.carrier}</span>
          ${statusPill}
        </div>
      </div>
    `;
    })
    .join('');
}

function setFlightFilter(filter) {
  audio.playClick();
  currentFilter = filter;
  ['all', 'watch', 'corridor'].forEach((f) => {
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

function filterFlights() {
  renderFlightFeed();
}

function handleCorridorChange(corridorKey) {
  audio.playClick();
  activeCorridorKey = corridorKey;
  fetchLiveBackendTelemetry();

  if (map && CORRIDOR_CAMERA_TARGETS[corridorKey]) {
    map.flyTo(CORRIDOR_CAMERA_TARGETS[corridorKey]);
  }
}

function toggleAudioFeedback() {
  audio.enabled = !audio.enabled;
  const onIcon = document.getElementById('audio-icon-on');
  const offIcon = document.getElementById('audio-icon-off');
  if (audio.enabled) {
    onIcon.classList.remove('hidden');
    offIcon.classList.add('hidden');
    audio.playClick();
  } else {
    onIcon.classList.add('hidden');
    offIcon.classList.remove('hidden');
  }
}

function updateClocks() {
  const now = new Date();
  const gstHours = (now.getUTCHours() + 4) % 24;
  const pad = (n) => String(n).padStart(2, '0');

  const gstStr = `${pad(gstHours)}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} GST`;
  const utcStr = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} Z`;

  const gstEl = document.getElementById('clock-gst');
  const utcEl = document.getElementById('clock-utc');
  if (gstEl) gstEl.textContent = gstStr;
  if (utcEl) utcEl.textContent = utcStr;
}

// Flight Telemetry Dossier Modal
function openFlightModal(flightId) {
  audio.playClick();
  const flight = FLIGHTS_DATA.find((f) => f.id === flightId);
  if (!flight) return;
  selectedFlight = flight;

  document.getElementById('modal-callsign').textContent = flight.callsign;
  document.getElementById('modal-carrier').textContent = `${flight.carrier} • ${flight.aircraft}`;
  document.getElementById('modal-fl').textContent = flight.flightLevel;
  document.getElementById('modal-speed').textContent = `${flight.speed} kts (M ${flight.mach || 0.8})`;
  document.getElementById('modal-heading').textContent = `${flight.heading}° TRK`;
  document.getElementById('modal-transponder').textContent = flight.transponder;
  document.getElementById('modal-origin').textContent = `${flight.origin} (${flight.originCity || ''})`;
  document.getElementById('modal-destination').textContent = `${flight.destination} (${flight.destinationCity || ''})`;
  document.getElementById('modal-eta').textContent = `ETA: ${flight.etaMinutes} mins to ${flight.destination}`;
  document.getElementById('modal-cargo').textContent = `${flight.cargoPayload} - ${flight.cargoWeightTonnes} Tonnes`;
  document.getElementById('modal-hazard').textContent = flight.hazardNote || 'Nominal trajectory envelope. No wake vortex or windshear anomalies detected.';

  const badge = document.getElementById('modal-risk-badge');
  badge.textContent = `${Number(flight.riskScore).toFixed(1)}% ${flight.riskCategory.toUpperCase()}`;
  if (flight.riskCategory === 'watch') {
    badge.className = 'px-2 py-0.5 rounded text-xs font-bold bg-cyan-950 text-cyan-300 border border-cyan-600';
  } else if (flight.riskCategory === 'elevated') {
    badge.className = 'px-2 py-0.5 rounded text-xs font-bold bg-amber-950 text-amber-300 border border-amber-600';
  } else {
    badge.className = 'px-2 py-0.5 rounded text-xs font-bold bg-emerald-950 text-emerald-400 border border-emerald-600';
  }

  const deconflictBtn = document.getElementById('modal-deconflict-btn');
  if (flight.status === 'Vector Corrected') {
    deconflictBtn.textContent = 'ALREADY OPTIMIZED (DECONFLICTED)';
    deconflictBtn.disabled = true;
    deconflictBtn.className = 'px-4 py-1.5 rounded bg-slate-800 text-slate-500 font-bold text-xs cursor-not-allowed';
  } else {
    deconflictBtn.textContent = 'EXECUTE AI VECTOR DECONFLICTION';
    deconflictBtn.disabled = false;
    deconflictBtn.className = 'px-4 py-1.5 rounded bg-cyan-500 text-obsidian-950 font-bold hover:bg-cyan-400 text-xs shadow-glow-cyan transition-colors';
  }

  document.getElementById('flight-modal').classList.remove('hidden');
}

function closeFlightModal() {
  audio.playClick();
  document.getElementById('flight-modal').classList.add('hidden');
}

async function executeFlightDeconfliction() {
  if (!selectedFlight) return;
  audio.playChime();

  try {
    const res = await fetch('/api/v1/directives/evaluate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': activeApiKey
      },
      body: JSON.stringify({
        flight_id: selectedFlight.id,
        callsign: selectedFlight.callsign,
        target_action: 'VORTEX_SEPARATION_LAMINAR_STEP'
      })
    });

    if (res.ok) {
      const data = await res.json();
      const updated = data.flight_telemetry;
      selectedFlight.riskScore = updated.riskScore;
      selectedFlight.riskCategory = updated.riskCategory;
      selectedFlight.status = updated.status;
      selectedFlight.hazardNote = updated.hazardNote;

      const newDirective = {
        id: data.directive.id,
        time: 'JUST NOW',
        flight: selectedFlight.callsign,
        action: data.directive.action,
        text: data.directive.description,
        reduction: `${data.directive.riskReduction}%`,
        confidence: `${data.directive.confidence}%`
      };
      DIRECTIVES_LOG.unshift(newDirective);

      const timeEl = document.getElementById('latest-directive-time');
      const textEl = document.getElementById('latest-directive-text');
      if (timeEl) timeEl.textContent = newDirective.time;
      if (textEl) textEl.textContent = newDirective.text;

      createFlightArcsAndVectors();
      renderFlightFeed();
      closeFlightModal();
      return;
    }
  } catch (e) {
    console.warn('[BACKEND DIRECTIVE POST FAILED]', e);
  }

  // Fallback local calculation
  selectedFlight.riskScore = Math.max(3.2, selectedFlight.riskScore - 14.5);
  selectedFlight.riskCategory = selectedFlight.riskScore < 10 ? 'minimal' : 'low';
  selectedFlight.status = 'Vector Corrected';
  selectedFlight.hazardNote = 'AI Resolution applied: Vector stepped down by 2,000 ft; laminar separation restored.';

  createFlightArcsAndVectors();
  renderFlightFeed();
  closeFlightModal();
}

function focusOnFlightInRadar() {
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
    if (aircraftMarkers[selectedFlight.id] && aircraftMarkers[selectedFlight.id].marker) {
      aircraftMarkers[selectedFlight.id].marker.togglePopup();
    }
  }
}

function openDirectivesModal() {
  audio.playClick();
  const listEl = document.getElementById('directives-modal-list');
  if (listEl) {
    listEl.innerHTML = DIRECTIVES_LOG.map((d) => `
      <div class="p-3 rounded bg-obsidian-850 border border-slate-800 flex items-start justify-between">
        <div>
          <div class="flex items-center space-x-2">
            <span class="text-xs font-bold text-cyan-400">${d.id}</span>
            <span class="text-[10px] text-slate-400">${d.time}</span>
            <span class="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 text-[10px] font-bold border border-cyan-800">${d.action}</span>
          </div>
          <div class="text-xs text-slate-200 mt-1">${d.text}</div>
        </div>
        <div class="text-right pl-3">
          <span class="text-emerald-400 font-bold block">${d.reduction}</span>
          <span class="text-[10px] text-slate-400">Conf: ${d.confidence}</span>
        </div>
      </div>
    `).join('');
  }
  document.getElementById('directives-modal').classList.remove('hidden');
}

function closeDirectivesModal() {
  audio.playClick();
  document.getElementById('directives-modal').classList.add('hidden');
}

function triggerDeconflictSimulation() {
  audio.playChime();
  const banner = document.getElementById('sim-banner');
  if (banner) {
    banner.classList.remove('hidden');
    setTimeout(() => {
      banner.classList.add('hidden');
    }, 6000);
  }

  const gaugeVal = document.getElementById('risk-gauge-val');
  if (gaugeVal) {
    gaugeVal.textContent = '22%';
    gaugeVal.className = 'text-3xl font-extrabold font-telemetry tracking-tight text-emerald-400';
    setTimeout(() => {
      gaugeVal.textContent = '28%';
      gaugeVal.className = 'text-3xl font-extrabold font-telemetry tracking-tight text-white';
    }, 5000);
  }
}

// ==================== ENTERPRISE & API GATEWAY MODAL LOGIC ====================

function openEnterprisePortal(defaultTab = 'keys') {
  audio.playClick();
  document.getElementById('enterprise-portal-modal').classList.remove('hidden');
  switchPortalTab(defaultTab);
}

function closeEnterprisePortal() {
  audio.playClick();
  document.getElementById('enterprise-portal-modal').classList.add('hidden');
}

function switchPortalTab(tabName) {
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

  if (tabName === 'keys') loadApiKeys();
  if (tabName === 'webhooks') loadWebhooksAndAlerts();
  if (tabName === 'audit') refreshAuditLogs();
  if (tabName === 'db-config') loadSystemConfig();
}

// Helper: Select Commercial B2B Tier
function selectLicensingTier(tier) {
  audio.playClick();
  const select = document.getElementById('new-key-tier');
  if (select) {
    select.value = tier;
    select.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// 1. Commercial API Keys Management (Strict Paid Licensing)
async function loadApiKeys() {
  try {
    const res = await fetch('/api/v1/auth/keys');
    if (res.ok) {
      const data = await res.json();
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

async function generatePartnerApiKey() {
  const nameInput = document.getElementById('new-key-name');
  const tierSelect = document.getElementById('new-key-tier');
  const name = (nameInput?.value || '').trim();
  const licenseType = tierSelect?.value || 'global_cargo_carrier';

  if (!name) {
    alert('Please enter a partner or client organization name.');
    return;
  }

  audio.playChime();
  try {
    const res = await fetch('/api/v1/auth/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        license_type: licenseType,
        billing_email: ''
      })
    });

    if (res.ok) {
      const data = await res.json();
      const banner = document.getElementById('new-key-banner');
      const text = document.getElementById('new-key-raw-text');
      const licIdEl = document.getElementById('new-key-license-id');
      const feeEl = document.getElementById('new-key-fee');
      const slaEl = document.getElementById('new-key-sla');

      if (banner && text) {
        text.textContent = data.api_key;
        if (licIdEl) licIdEl.textContent = data.license_id || 'COMMERCIAL-LIC';
        if (feeEl) feeEl.textContent = data.monthly_fee_usd ? `$${data.monthly_fee_usd.toLocaleString()}/mo` : 'CUSTOM ANNUAL';
        if (slaEl) slaEl.textContent = data.sla_uptime || '99.99%';
        banner.classList.remove('hidden');
      }
      nameInput.value = '';
      loadApiKeys();
    } else {
      const err = await res.json();
      alert(`License provisioning failed: ${err.detail || 'Commercial authorization required'}`);
    }
  } catch (e) {
    alert('Failed to generate key: ' + e);
  }
}

function copyRawApiKey() {
  const text = document.getElementById('new-key-raw-text')?.textContent || '';
  navigator.clipboard.writeText(text);
  audio.playClick();
  alert('API Key copied to clipboard!');
}

async function revokeApiKey(keyId) {
  if (!confirm('Are you sure you want to revoke this partner API key? It will immediately block all requests.')) return;
  audio.playClick();
  try {
    const res = await fetch(`/api/v1/auth/keys/${keyId}`, { method: 'DELETE' });
    if (res.ok) {
      loadApiKeys();
    }
  } catch (e) {
    alert('Revocation error: ' + e);
  }
}

// 2. Interactive API Explorer & cURL
async function testApiEndpoint(path, method = 'GET', body = null) {
  audio.playClick();
  const latencyEl = document.getElementById('api-test-latency');
  const responseEl = document.getElementById('api-test-response');

  if (responseEl) {
    responseEl.textContent = `Executing ${method} ${path} ...`;
  }

  const startTime = performance.now();
  try {
    const options = {
      method,
      headers: {
        'x-api-key': activeApiKey,
        'Content-Type': 'application/json'
      }
    };
    if (body) options.body = JSON.stringify(body);

    const res = await fetch(path, options);
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

// 3. Outbound Webhooks & Alerts
async function loadWebhooksAndAlerts() {
  try {
    const hookRes = await fetch('/api/v1/webhooks');
    if (hookRes.ok) {
      const data = await hookRes.json();
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

    const alertRes = await fetch('/api/v1/alerts/history');
    if (alertRes.ok) {
      const data = await alertRes.json();
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

async function registerWebhook() {
  const urlInput = document.getElementById('new-webhook-url');
  const url = (urlInput?.value || '').trim();
  if (!url || !url.startsWith('http')) {
    alert('Please enter a valid HTTP/HTTPS webhook URL.');
    return;
  }
  audio.playClick();
  try {
    const res = await fetch('/api/v1/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (res.ok) {
      urlInput.value = '';
      loadWebhooksAndAlerts();
    }
  } catch (e) {
    alert('Error registering webhook: ' + e);
  }
}

async function deleteWebhook(id) {
  audio.playClick();
  try {
    await fetch(`/api/v1/webhooks/${id}`, { method: 'DELETE' });
    loadWebhooksAndAlerts();
  } catch (e) {}
}

async function triggerManualTestDispatch() {
  audio.playChime();
  try {
    const res = await fetch('/api/v1/alerts/test-dispatch', {
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

// 4. Compliance Audits
async function refreshAuditLogs() {
  try {
    const res = await fetch('/api/v1/audit/logs?limit=30');
    if (res.ok) {
      const data = await res.json();
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

// 5. Ingestion Pipeline & PostgreSQL Config
async function loadSystemConfig() {
  try {
    const res = await fetch('/api/v1/system/status');
    if (res.ok) {
      const data = await res.json();
      const db = data.database;
      const stats = data.ingestion_pipeline;

      document.getElementById('cfg-flight-source').textContent = stats.aviationstack_source || 'STREAMING ACTIVE';
      document.getElementById('cfg-weather-source').textContent = stats.weatherstack_source || 'STREAMING ACTIVE';
      document.getElementById('cfg-cache-hits').textContent = `${stats.cache_hits || 0} PULLS (${stats.api_call_count || 0} API CALLS)`;
      document.getElementById('cfg-next-poll').textContent = `${stats.seconds_until_next_poll || 60}s`;

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

async function saveIngestionApiKeys() {
  audio.playClick();
  const avKey = (document.getElementById('cfg-aviationstack-key')?.value || '').trim();
  const wxKey = (document.getElementById('cfg-weatherstack-key')?.value || '').trim();

  try {
    const res = await fetch('/api/v1/system/api-keys', {
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

async function saveDatabaseConfig() {
  audio.playClick();
  const dbUrl = (document.getElementById('cfg-database-url')?.value || '').trim();
  const statusMsg = document.getElementById('cfg-db-status-msg');

  if (!dbUrl) {
    alert('Please enter a valid PostgreSQL connection string.');
    return;
  }

  if (statusMsg) statusMsg.textContent = 'Connecting and verifying schema migrations...';

  try {
    const res = await fetch('/api/v1/system/db-config', {
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
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

  const corridorKeys = ['dxb-primary', 'doh-dxb', 'sin-dxb', 'lhr-dxb', 'dwc-expansion'];
  if (['1', '2', '3', '4', '5'].includes(e.key)) {
    const idx = parseInt(e.key, 10) - 1;
    const select = document.getElementById('corridor-selector');
    if (select && corridorKeys[idx]) {
      select.value = corridorKeys[idx];
      handleCorridorChange(corridorKeys[idx]);
    }
  } else if (e.key.toLowerCase() === 'r') {
    recenterRadar();
  } else if (e.key.toLowerCase() === 'e') {
    const modal = document.getElementById('enterprise-portal-modal');
    if (modal.classList.contains('hidden')) {
      openEnterprisePortal();
    } else {
      closeEnterprisePortal();
    }
  } else if (e.key === ' ') {
    e.preventDefault();
    audio.playClick();
  }
});

// Window Bindings
window.initMapLibreRadar = initMapLibreRadar;
window.initThreeRadar = initMapLibreRadar; // Alias for backward compatibility
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

// Enterprise Portal Window Bindings
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

// Boot up sequence
window.addEventListener('DOMContentLoaded', () => {
  initMapLibreRadar();
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
