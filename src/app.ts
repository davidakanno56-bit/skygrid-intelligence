/**
 * SkyGrid Intelligence - Enterprise Aviation Risk Command Center
 * Akanno Tech Labs • Production B2B SaaS Platform
 * Bloomberg-grade Real-Time Flight Telemetry & MapLibre Vector Radar System
 * Strictly Typed Modern TypeScript Implementation
 */

import 'maplibre-gl/dist/maplibre-gl.css';
import { TacticalAudioSystem } from './audio';
import {
  FlightVector,
  CorridorMetric,
  TacticalDirective
} from './types/telemetry';
import {
  ApiKeyRecord,
  CommercialTierKey
} from './types/licensing';
import {
  AirportHub,
  CorridorCameraPreset
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
import { TacticalRadarEngine } from './radar/radarEngine';

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
 * Enforces a modern light-themed aesthetic on the landing page and dark operations aesthetic on the dashboard
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
    // Switch to Dark Aviation Operations HUD
    document.documentElement.classList.add('dark');
    document.body.classList.remove('light-theme', 'bg-slate-50', 'text-slate-900');
    document.body.classList.add('dark-theme', 'bg-obsidian-900', 'text-slate-100');
    landingEl?.classList.add('hidden');
    dashboardEl?.classList.remove('hidden');
    document.title = 'SkyGrid Intelligence | Live Aviation Command Center | Akanno Tech Labs';
    
    // Refresh vectors and telemetry feed immediately on dashboard view entry
    renderFlightFeed();
    updateClocks();
    fetchLiveBackendTelemetry();

    // Resize MapLibre canvas on reveal so viewport calculates proper dimensions
    setTimeout(() => {
      radarEngine.resizeIfReady();
    }, 150);
  } else {
    // Switch to Modern Light Aerospace Public Experience
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark-theme', 'bg-obsidian-900', 'text-slate-100');
    document.body.classList.add('light-theme', 'bg-slate-50', 'text-slate-900');
    dashboardEl?.classList.add('hidden');
    landingEl?.classList.remove('hidden');
    document.title = 'SkyGrid Intelligence | Sovereign Aviation Risk Intelligence | Akanno Tech Labs';
    if (typeof window !== 'undefined' && window.location.hash) {
      try {
        const targetEl = document.querySelector(window.location.hash);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth' });
        }
      } catch {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

export interface LandingScenario {
  id: string;
  name: string;
  hub: string;
  cri: number;
  status: string;
  statusBadgeClass: string;
  separationNm: number;
  windshearKts: number;
  activeVectors: number;
  directive: string;
  directiveClass: string;
}

const DEFAULT_LANDING_SCENARIO: LandingScenario = {
  id: 'dxb',
  name: 'DXB-DWC Megahub Transcontinental Corridor',
  hub: 'OMDB / DXB Dubai Primary',
  cri: 14.2,
  status: 'NOMINAL / LAMINAR ENVELOPE',
  statusBadgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  separationNm: 6.0,
  windshearKts: 8.2,
  activeVectors: 14,
  directive: 'LAMINAR SEPARATION MAINTAINED — ZERO CONFLICT DETECTED',
  directiveClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
};

const LANDING_SCENARIOS: Record<string, LandingScenario> = {
  dxb: DEFAULT_LANDING_SCENARIO,
  doh: {
    id: 'doh',
    name: 'DOH-DXB Superway Convective Anomaly',
    hub: 'OTHH / DOH Doha Superway',
    cri: 28.6,
    status: 'HAZARD ADVISORY (CRITICAL > 25%)',
    statusBadgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    separationNm: 4.8,
    windshearKts: 19.4,
    activeVectors: 19,
    directive: 'RECOMMENDED STEP-CLIMB FL340 + 15KT SEPARATION VECTOR',
    directiveClass: 'bg-amber-50 text-amber-950 border-amber-300',
  },
  sin: {
    id: 'sin',
    name: 'SIN-DXB Eurasia Axis Wake Contention',
    hub: 'WSSS / SIN Singapore Axis',
    cri: 34.1,
    status: 'ACTIVE DECONFLICTION REQUIRED',
    statusBadgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
    separationNm: 3.9,
    windshearKts: 12.0,
    activeVectors: 22,
    directive: 'AUTONOMOUS VECTOR INSERTION TO RESTORE 6.0 NM WAKE SEPARATION',
    directiveClass: 'bg-rose-50 text-rose-950 border-rose-300',
  },
};

/**
 * Interactive Landing Page Scenario Switcher
 */
export function setLandingScenario(scenarioKey: string): void {
  audio.playClick();
  const scenario: LandingScenario = LANDING_SCENARIOS[scenarioKey] ?? DEFAULT_LANDING_SCENARIO;

  ['dxb', 'doh', 'sin'].forEach((key) => {
    const btn = document.getElementById(`landing-scen-tab-${key}`);
    if (btn) {
      if (key === scenarioKey) {
        btn.classList.add('bg-sky-600', 'text-white', 'shadow-sm');
        btn.classList.remove('bg-white', 'text-slate-700', 'border-slate-200');
      } else {
        btn.classList.remove('bg-sky-600', 'text-white', 'shadow-sm');
        btn.classList.add('bg-white', 'text-slate-700', 'border-slate-200');
      }
    }
  });

  const hubEl = document.getElementById('scen-hub-name');
  const criValEl = document.getElementById('scen-cri-val');
  const criBarEl = document.getElementById('scen-cri-bar');
  const statusBadgeEl = document.getElementById('scen-status-badge');
  const sepEl = document.getElementById('scen-separation');
  const windEl = document.getElementById('scen-windshear');
  const directiveEl = document.getElementById('scen-directive');

  if (hubEl) hubEl.textContent = scenario.name;
  if (criValEl) criValEl.textContent = `${scenario.cri.toFixed(1)}%`;
  if (criBarEl) {
    criBarEl.style.width = `${Math.min(scenario.cri * 2.8, 100)}%`;
    if (scenario.cri > 30) {
      criBarEl.className = 'h-full bg-rose-500 transition-all duration-500';
    } else if (scenario.cri > 20) {
      criBarEl.className = 'h-full bg-amber-500 transition-all duration-500';
    } else {
      criBarEl.className = 'h-full bg-emerald-500 transition-all duration-500';
    }
  }
  if (statusBadgeEl) {
    statusBadgeEl.textContent = scenario.status;
    statusBadgeEl.className = `px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${scenario.statusBadgeClass}`;
  }
  if (sepEl) sepEl.textContent = `${scenario.separationNm.toFixed(1)} NM`;
  if (windEl) windEl.textContent = `${scenario.windshearKts.toFixed(1)} KTS`;
  if (directiveEl) {
    directiveEl.textContent = scenario.directive;
    directiveEl.className = `p-3 rounded-lg font-mono text-xs font-semibold border ${scenario.directiveClass}`;
  }
}

const DEFAULT_LANDING_RATES = { regional: '$2,500', carrier: '$7,500', sovereign: '$25,000' };

const LANDING_CURRENCY_RATES: Record<string, { regional: string; carrier: string; sovereign: string }> = {
  USD: DEFAULT_LANDING_RATES,
  EUR: { regional: '€2,350', carrier: '€7,050', sovereign: '€23,500' },
  GBP: { regional: '£1,980', carrier: '£5,940', sovereign: '£19,800' },
  AED: { regional: 'AED 9,180', carrier: 'AED 27,550', sovereign: 'AED 91,800' },
  NGN: { regional: '₦3,750,000', carrier: '₦11,250,000', sovereign: '₦37,500,000' },
};

/**
 * Interactive Landing Page Currency Selector
 */
export function setLandingCurrency(currency: string): void {
  audio.playClick();
  const rates = LANDING_CURRENCY_RATES[currency] ?? DEFAULT_LANDING_RATES;

  ['USD', 'EUR', 'GBP', 'AED', 'NGN'].forEach((c) => {
    const btn = document.getElementById(`landing-curr-${c}`);
    if (btn) {
      if (c === currency) {
        btn.classList.add('bg-sky-600', 'text-white', 'shadow-sm');
        btn.classList.remove('bg-white', 'text-slate-700', 'border-slate-300');
      } else {
        btn.classList.remove('bg-sky-600', 'text-white', 'shadow-sm');
        btn.classList.add('bg-white', 'text-slate-700', 'border-slate-300');
      }
    }
  });

  const pReg = document.getElementById('landing-price-reg');
  const pCar = document.getElementById('landing-price-car');
  const pSov = document.getElementById('landing-price-sov');

  if (pReg) pReg.textContent = rates.regional;
  if (pCar) pCar.textContent = rates.carrier;
  if (pSov) pSov.textContent = rates.sovereign;
}

/**
 * Transmit Enterprise Partnership Enquiry (persists to FastAPI /api/v1/enquiries with offline resilience)
 */
export async function submitPartnershipEnquiry(): Promise<void> {
  audio.playDirectiveChime();
  const nameInput = document.getElementById('enquiry-name') as HTMLInputElement | null;
  const orgInput = document.getElementById('enquiry-org') as HTMLInputElement | null;
  const emailInput = document.getElementById('enquiry-email') as HTMLInputElement | null;
  const interestSelect = document.getElementById('enquiry-interest') as HTMLSelectElement | null;
  const messageInput = document.getElementById('enquiry-message') as HTMLTextAreaElement | null;
  const banner = document.getElementById('enquiry-success-banner');
  const refIdEl = document.getElementById('enquiry-ref-id');
  const btn = document.getElementById('btn-enquiry-submit') as HTMLButtonElement | null;

  const fullName = (nameInput?.value ?? '').trim();
  const organization = (orgInput?.value ?? '').trim();
  const email = (emailInput?.value ?? '').trim();
  const interestTier = interestSelect?.value || 'commercial_api';
  const message = (messageInput?.value ?? '').trim();

  if (!fullName || !organization || !email) {
    return;
  }

  let enquiryRef = `ENQ-SKY-${Math.floor(100000 + Math.random() * 899999)}`;

  try {
    const res = await apiFetch('/api/v1/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName,
        organization,
        email,
        interest_tier: interestTier,
        message
      })
    });
    if (res.ok) {
      const data: { enquiry_ref?: string } = await res.json();
      if (data.enquiry_ref) enquiryRef = data.enquiry_ref;
    }
  } catch {
    // Graceful local confirmation when backend is waking or offline
  }

  if (refIdEl) refIdEl.textContent = enquiryRef;

  const waContainer = document.getElementById('enquiry-wa-actions');
  if (waContainer) {
    const waText = encodeURIComponent(
      `*SKYGRID INTELLIGENCE — ENTERPRISE ENQUIRY*\n` +
      `• Ref: ${enquiryRef}\n` +
      `• Name: ${fullName}\n` +
      `• Organization: ${organization}\n` +
      `• Email: ${email}\n` +
      `• Strategic Interest: ${interestTier}\n` +
      `• Details: ${message || 'Requesting sovereign airspace evaluation.'}`
    );
    const waUrl = `https://wa.me/2348133535112?text=${waText}`;
    const mailUrl = `mailto:davidakanno56@gmail.com?subject=${encodeURIComponent(`SkyGrid Enterprise Enquiry [${enquiryRef}]`)}&body=${encodeURIComponent(`Hello David,\n\nI submitted an enquiry for SkyGrid Intelligence:\n• Ref: ${enquiryRef}\n• Name: ${fullName}\n• Organization: ${organization}\n• Email: ${email}\n• Strategic Interest: ${interestTier}\n• Details: ${message}`)}`;

    waContainer.innerHTML = `
      <div class="mt-4 pt-3 border-t border-emerald-300/60 flex flex-wrap items-center gap-3">
        <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-all">
          <span>💬 Open in WhatsApp &amp; Message Founder Directly</span>
        </a>
        <a href="${mailUrl}" class="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 font-bold text-xs border border-cyan-500/40 flex items-center gap-2 transition-all">
          <span>✉️ Send Email to davidakanno56@gmail.com</span>
        </a>
      </div>
    `;
  }

  if (banner) {
    banner.classList.remove('hidden');
    banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  if (btn) {
    btn.innerHTML = '<span>✓ ENQUIRY RECEIVED BY AKANNO TECH LABS</span>';
    btn.classList.add('opacity-75');
  }

  if (nameInput) nameInput.value = '';
  if (orgInput) orgInput.value = '';
  if (emailInput) emailInput.value = '';
  if (messageInput) messageInput.value = '';
}

// Map of Air Corridors indexed by ID
const CORRIDOR_MAP: Record<string, CorridorMetric> = {};
DEFAULT_AIR_CORRIDORS.forEach((c: CorridorMetric) => {
  CORRIDOR_MAP[c.id] = c;
});

let FLIGHTS_DATA: FlightVector[] = INITIAL_FLIGHTS.map((f) => ({
  ...f,
  isSimulated: true,
  vectorHistory: f.vectorHistory.map((pt) => [pt[0], pt[1]] as [number, number])
}));
let DIRECTIVES_LOG: TacticalDirective[] = [...DEFAULT_DIRECTIVES];

// Tactical Web Audio Synthesizer
const audio = new TacticalAudioSystem();

// Application State
let activeCorridorKey: string = 'dxb-primary';
let currentFilter: string = 'all';
let selectedFlight: FlightVector | null = null;
const activeApiKey: string = 'sk_demo_skygrid_evaluation_001';

// Strategic Geographic Airport Hub Coordinates (Global Intercontinental Network)
const AIRPORT_HUBS: AirportHub[] = [
  { code: 'OMDB / DXB', name: 'Dubai International Mega-Terminal', city: 'Dubai, UAE', coords: [55.3657, 25.2532], isPrimary: true, role: 'Primary Cargo Mega-Terminal & Strategic Hub' },
  { code: 'OMDW / DWC', name: 'Al Maktoum International Logistics', city: 'Jebel Ali, UAE', coords: [55.1614, 24.8967], isPrimary: true, role: 'Logistics Superhub & Dual Runway Sync' },
  { code: 'KJFK / JFK', name: 'John F. Kennedy International', city: 'New York, USA', coords: [-73.7781, 40.6413], isPrimary: true, role: 'North Atlantic Oceanic Gateway' },
  { code: 'EGLL / LHR', name: 'London Heathrow Cargo Terminal', city: 'London, UK', coords: [-0.4614, 51.4700], isPrimary: true, role: 'Transatlantic Axis Gateway' },
  { code: 'WSSS / SIN', name: 'Singapore Changi Cargo Hub', city: 'Singapore', coords: [103.9915, 1.3644], isPrimary: true, role: 'Southeast Asia Intercontinental Hub' },
  { code: 'RJTT / HND', name: 'Tokyo Haneda International', city: 'Tokyo, Japan', coords: [139.7811, 35.5494], isPrimary: true, role: 'Transpacific Gateway & Asia Hub' },
  { code: 'EDDF / FRA', name: 'Frankfurt CargoCity', city: 'Frankfurt, Germany', coords: [8.5706, 50.0379], isPrimary: false, role: 'European Continental Cargo Hub' },
  { code: 'LFPG / CDG', name: 'Paris Charles de Gaulle', city: 'Paris, France', coords: [2.5500, 49.0097], isPrimary: false, role: 'Western European Express Axis' },
  { code: 'KORD / ORD', name: 'Chicago O’Hare Intermodal Terminal', city: 'Chicago, USA', coords: [-87.9073, 41.9742], isPrimary: false, role: 'North American Trans-Polar Hub' },
  { code: 'KLAX / LAX', name: 'Los Angeles International', city: 'Los Angeles, USA', coords: [-118.4085, 33.9416], isPrimary: false, role: 'Transpacific West Coast Gateway' },
  { code: 'VHHH / HKG', name: 'Hong Kong SuperTerminal 1', city: 'Hong Kong', coords: [113.9145, 22.3080], isPrimary: false, role: 'Greater Bay Area Pacific Axis' },
  { code: 'OTHH / DOH', name: 'Hamad International', city: 'Doha, Qatar', coords: [51.6080, 25.2731], isPrimary: false, role: 'Gulf Inter-Hub High-Speed Vector' },
  { code: 'EDDP / LEJ', name: 'Leipzig/Halle Cargo Hub', city: 'Leipzig, Germany', coords: [12.2364, 51.4239], isPrimary: false, role: 'DHL European Express Superhub' },
  { code: 'ELLX / LUX', name: 'Luxembourg Findel Cargo Hub', city: 'Luxembourg', coords: [6.2158, 49.6233], isPrimary: false, role: 'Cargolux Global Headquarters' },
  { code: 'YSSY / SYD', name: 'Sydney Kingsford Smith', city: 'Sydney, Australia', coords: [151.1772, -33.9461], isPrimary: false, role: 'Trans-Oceanic Southern Axis' }
];

// Global Airspace Camera Orientations (Full Earth Globe & Regional Air Corridors)
const CORRIDOR_CAMERA_TARGETS: Record<string, CorridorCameraPreset> = {
  'global-earth': {
    center: [55.3657, 25.2532],
    zoom: 2.8,
    pitch: 32,
    bearing: 0,
    duration: 2500
  },
  'dxb-primary': {
    center: [55.3657, 25.2532],
    zoom: 9.0,
    pitch: 45,
    bearing: -18,
    duration: 2200
  },
  'europe-atlantic': {
    center: [30.0, 40.0],
    zoom: 4.2,
    pitch: 40,
    bearing: -10,
    duration: 2400
  },
  'trans-america': {
    center: [-80.0, 32.0],
    zoom: 4.2,
    pitch: 38,
    bearing: 5,
    duration: 2400
  },
  'asia-pacific': {
    center: [80.0, 20.0],
    zoom: 4.2,
    pitch: 40,
    bearing: -15,
    duration: 2400
  },
  'doh-dxb': {
    center: [54.2000, 25.3200],
    zoom: 8.2,
    pitch: 45,
    bearing: -15,
    duration: 2200
  },
  'sin-dxb': {
    center: [56.2000, 25.1000],
    zoom: 8.4,
    pitch: 44,
    bearing: -20,
    duration: 2200
  },
  'lhr-dxb': {
    center: [54.8000, 25.3000],
    zoom: 8.4,
    pitch: 45,
    bearing: -15,
    duration: 2200
  },
  'dwc-expansion': {
    center: [55.1614, 24.8967],
    zoom: 11.2,
    pitch: 50,
    bearing: 15,
    duration: 2200
  }
};

// Modular Air-Traffic Surveillance MapLibre GL Radar Engine
const radarEngine = new TacticalRadarEngine({
  getFlights: () => FLIGHTS_DATA,
  airportHubs: AIRPORT_HUBS,
  corridorCameraTargets: CORRIDOR_CAMERA_TARGETS,
  onOpenFlightModal: (flightId: string) => openFlightModal(flightId),
  onPlayClick: () => audio.playClick()
});

export function initMapLibreRadar(): void {
  radarEngine.init();
}

export function cleanupRadar(): void {
  radarEngine.cleanup();
}

export function reinitRadar(): void {
  radarEngine.reinit();
}

export function recenterRadar(playSound: boolean = true): void {
  radarEngine.recenter(playSound);
}

export function zoomRadar(factor: number): void {
  radarEngine.zoom(factor);
}

export function setRadarViewMode(mode: '3d' | '2d'): void {
  radarEngine.setViewMode(mode);
}

export function setRadarBasemap(mode: 'live' | 'satellite' | 'dark'): void {
  radarEngine.setBasemap(mode);
}

export function toggleLayer(
  layer: 'vectors' | 'trails' | 'sweep' | 'grid' | 'satellites' | 'fusion' | 'deconfliction' | 'gpsSpoofing' | 'spaceLaunch'
): void {
  radarEngine.toggleLayer(layer);
}

export function executeAiDeconflictionManeuver(conflictId?: string): void {
  audio.playDirectiveChime();
  radarEngine.executeAiDeconflictionManeuver(conflictId);
}

export function selectAirspaceScope(scopeKey: string): void {
  audio.playClick();
  radarEngine.flyToCorridor(scopeKey);

  const scopeButtons: Record<string, string> = {
    'global-earth': 'scope-btn-global',
    'dxb-primary': 'scope-btn-gulf',
    'europe-atlantic': 'scope-btn-europe',
    'trans-america': 'scope-btn-americas',
    'asia-pacific': 'scope-btn-asiapac'
  };

  const activeClass =
    'px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm whitespace-nowrap transition-all';
  const inactiveClass =
    'px-2.5 py-1 rounded bg-obsidian-850 hover:bg-cyan-950 border border-slate-800 text-slate-400 hover:text-white whitespace-nowrap transition-all';

  Object.entries(scopeButtons).forEach(([key, btnId]) => {
    const el = document.getElementById(btnId);
    if (el) el.className = key === scopeKey ? activeClass : inactiveClass;
  });

  const titles: Record<string, { title: string; target: string; rng: string }> = {
    'global-earth': {
      title: 'GLOBAL SOVEREIGN SURVEILLANCE & SPACE-BASED RADAR',
      target: 'ORBITAL: 0.0000° N, 0.0000° E',
      rng: 'GLOBAL PLANET-WIDE (TRANS-OCEANIC)'
    },
    'dxb-primary': {
      title: 'DUBAI & ARABIAN GULF TACTICAL RADAR (DXB / OMDB)',
      target: 'TARGET: 25.2532° N, 55.3657° E',
      rng: 'RANGE: 250 NM | ELEV: SFC-FL450'
    },
    'europe-atlantic': {
      title: 'EUROPEAN CORE & NORTH ATLANTIC TRACKS (EGLL / EDDF)',
      target: 'TARGET: 51.4700° N, 0.4543° W',
      rng: 'RANGE: 850 NM | TRANSATLANTIC AXIS'
    },
    'trans-america': {
      title: 'NORTH AMERICAN INTERMODAL & TRANSPACIFIC (KJFK / KORD)',
      target: 'TARGET: 40.6413° N, 73.7781° W',
      rng: 'RANGE: 1200 NM | TRANS-POLAR'
    },
    'asia-pacific': {
      title: 'ASIA-PACIFIC TRANS-OCEANIC AIRSPACE (WSSS / VHHH)',
      target: 'TARGET: 1.3644° N, 103.9915° E',
      rng: 'RANGE: 950 NM | EQUATORIAL GATEWAY'
    }
  };

  const info = titles[scopeKey];
  if (info) {
    const titleEl = document.getElementById('radar-scope-title');
    const targetEl = document.getElementById('radar-scope-target-coords');
    const rngEl = document.getElementById('radar-scope-range-text');
    if (titleEl) titleEl.textContent = info.title;
    if (targetEl) targetEl.textContent = info.target;
    if (rngEl) rngEl.textContent = info.rng;
  }
}

export function selectRadarAircraft(flightId: string): void {
  radarEngine.selectAircraft(flightId);
}

export function closeSelectedAircraftPanel(): void {
  radarEngine.closeSelectedAircraftPanel();
}

export function createFlightArcsAndVectors(): void {
  radarEngine.syncFlights();
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

  // Fetch Flights Telemetry (preserving smooth local simulation trajectories without snap-back jitter)
  try {
    const flightRes = await apiFetch('/api/v1/telemetry/flights', {
      headers: { 'x-api-key': activeApiKey }
    });
    if (flightRes.ok) {
      const flightData: { count: number; flights: FlightVector[]; is_simulation_mode?: boolean } = await flightRes.json();
      if (flightData.flights && flightData.flights.length > 0) {
        const isSimMode = flightData.is_simulation_mode !== false;
        if (isSimMode) {
          // Merge risk/status updates while keeping smooth client-interpolated positions & track histories
          const existingMap = new Map(FLIGHTS_DATA.map((f) => [f.id, f]));
          FLIGHTS_DATA = flightData.flights.map((incoming) => {
            const current = existingMap.get(incoming.id);
            if (current) {
              return {
                ...incoming,
                lat: current.lat,
                lng: current.lng,
                altitude: current.altitude,
                flightLevel: current.flightLevel,
                heading: current.heading,
                vectorHistory:
                  current.vectorHistory && current.vectorHistory.length > 0
                    ? current.vectorHistory
                    : incoming.vectorHistory || [[incoming.lat, incoming.lng]],
                isSimulated: true
              };
            }
            return {
              ...incoming,
              isSimulated: true,
              vectorHistory: incoming.vectorHistory || [[incoming.lat, incoming.lng]]
            };
          });
        } else {
          FLIGHTS_DATA = flightData.flights;
        }
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
  radarEngine.flyToCorridor(corridorKey);
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
  radarEngine.flyToFlight(selectedFlight);
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

// ==================== ELECTRONIC FLIGHT STRIP BAY (EFS) ====================

export function openElectronicFlightStripsModal(): void {
  audio.playClick();
  renderElectronicFlightStrips();
  const modal = document.getElementById('efs-modal');
  modal?.classList.remove('hidden');
}

export function closeElectronicFlightStripsModal(): void {
  audio.playClick();
  const modal = document.getElementById('efs-modal');
  modal?.classList.add('hidden');
}

export function executeStripVectorClearance(callsign: string, action: string): void {
  audio.playClick();
  const flight = FLIGHTS_DATA.find((f) => f.callsign === callsign);
  if (!flight) return;

  if (action === 'CLIMB_FL390') {
    flight.altitude = 39000;
    flight.flightLevel = 'FL390';
    flight.status = 'Vector Corrected';
  } else if (action === 'DESCEND_FL340') {
    flight.altitude = 34000;
    flight.flightLevel = 'FL340';
    flight.status = 'Vector Corrected';
  } else if (action === 'HDG_RIGHT_15') {
    flight.heading = (flight.heading + 15) % 360;
    flight.status = 'Vector Corrected';
  } else if (action === 'DECONFLICT') {
    flight.heading = (flight.heading + 25) % 360;
    flight.altitude = 38000;
    flight.flightLevel = 'FL380';
    flight.riskScore = 3.2;
    flight.riskCategory = 'minimal';
    flight.status = 'Vector Corrected';
  }

  renderFlightFeed();
  radarEngine.syncFlights();
  radarEngine.syncDeconflictionLayers();
  renderElectronicFlightStrips();
}

export function renderElectronicFlightStrips(): void {
  const container = document.getElementById('efs-strips-container');
  if (!container) return;

  container.innerHTML = FLIGHTS_DATA.map((flight) => {
    const isHighRisk = flight.riskScore > 20;
    const borderClass = isHighRisk ? 'border-amber-500/50 bg-amber-950/20' : 'border-cyan-500/30 bg-obsidian-850';
    return `
      <div class="p-3 rounded-lg border ${borderClass} flex flex-col md:flex-row items-start md:items-center justify-between gap-3 font-mono text-xs transition-all">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center font-bold text-cyan-300">
            ${flight.callsign.substring(0, 3)}
          </div>
          <div>
            <div class="flex items-center space-x-2">
              <span class="text-white font-bold text-sm">${flight.callsign}</span>
              <span class="text-cyan-400 text-[10px]">${flight.transponder || flight.icao24}</span>
              <span class="text-slate-400 text-[10px]">${flight.aircraft}</span>
            </div>
            <div class="text-slate-400 text-[11px] mt-0.5">
              ${flight.origin} (${flight.originCity}) &rarr; ${flight.destination} (${flight.destinationCity})
            </div>
          </div>
        </div>

        <div class="flex items-center space-x-4">
          <div class="text-center">
            <span class="text-slate-500 text-[9px] block">FLIGHT LEVEL</span>
            <span class="text-cyan-300 font-bold">${flight.flightLevel}</span>
          </div>
          <div class="text-center">
            <span class="text-slate-500 text-[9px] block">SPEED / MACH</span>
            <span class="text-slate-200 font-bold">${flight.speed}kt / M${flight.mach}</span>
          </div>
          <div class="text-center">
            <span class="text-slate-500 text-[9px] block">HEADING</span>
            <span class="text-slate-200 font-bold">${Math.round(flight.heading)}°</span>
          </div>
          <div class="text-center">
            <span class="text-slate-500 text-[9px] block">CRI RISK</span>
            <span class="${isHighRisk ? 'text-amber-400 font-bold' : 'text-emerald-400'}">${Number(flight.riskScore).toFixed(1)}%</span>
          </div>
        </div>

        <div class="flex items-center space-x-1.5 flex-wrap">
          <button onclick="window.executeStripVectorClearance('${flight.callsign}', 'CLIMB_FL390')" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold border border-cyan-500/20">
            &uarr; FL390
          </button>
          <button onclick="window.executeStripVectorClearance('${flight.callsign}', 'DESCEND_FL340')" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold border border-cyan-500/20">
            &darr; FL340
          </button>
          <button onclick="window.executeStripVectorClearance('${flight.callsign}', 'HDG_RIGHT_15')" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold border border-cyan-500/20">
            &nearr; HDG+15°
          </button>
          <button onclick="window.executeStripVectorClearance('${flight.callsign}', 'DECONFLICT')" class="px-2.5 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-[10px] font-bold border border-emerald-600">
            ⚡ DECONFLICT
          </button>
        </div>
      </div>
    `;
  }).join('');
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
  setTimeout(() => {
    radarEngine.resizeIfReady();
  }, 100);
}

export function viewLicensingPlans(): void {
  closeEnterprisePortal();
  navigateTo('/', true);
  setTimeout(() => {
    const el = document.getElementById('landing-licensing');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, 120);
}

export function requestEnterpriseAccess(): void {
  closeEnterprisePortal();
  navigateTo('/', true);
  setTimeout(() => {
    const el = document.getElementById('landing-contact');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      const nameInput = document.getElementById('enquiry-name') as HTMLInputElement | null;
      nameInput?.focus();
    }
  }, 120);
}

export function requestEnterprisePlan(planName: string): void {
  const el = document.getElementById('landing-contact');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
  const interestSelect = document.getElementById('enquiry-interest') as HTMLSelectElement | null;
  const messageTextarea = document.getElementById('enquiry-message') as HTMLTextAreaElement | null;
  const nameInput = document.getElementById('enquiry-name') as HTMLInputElement | null;

  if (planName.toLowerCase().includes('regional')) {
    if (interestSelect) interestSelect.value = 'commercial_api';
    if (messageTextarea) messageTextarea.value = 'Enquiry for Regional Hub License ($2,500/mo). Requesting DXB corridor telemetry and CRI real-time risk integration.';
  } else if (planName.toLowerCase().includes('carrier')) {
    if (interestSelect) interestSelect.value = 'commercial_api';
    if (messageTextarea) messageTextarea.value = 'Enquiry for Global Cargo Carrier License ($7,500/mo). Requesting multi-corridor autonomous routing directives and 500,000 req/day API access.';
  } else if (planName.toLowerCase().includes('sovereign')) {
    if (interestSelect) interestSelect.value = 'sovereign_defense';
    if (messageTextarea) messageTextarea.value = 'Enquiry for Sovereign Airspace & Defense License ($25,000/mo annual contract). Dedicated node throughput, private cloud vault sync, and raw telemetry feed.';
  }

  setTimeout(() => {
    nameInput?.focus();
  }, 150);
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
  }
  if (tabName === 'webhooks') loadWebhooksAndAlerts();
  if (tabName === 'audit') refreshAuditLogs();
  if (tabName === 'db-config') loadSystemConfig();
}

export async function loadApiKeys(): Promise<void> {
  try {
    const res = await apiFetch('/api/v1/auth/keys');
    if (res.ok) {
      const data: {
        count: number;
        environment_mode?: string;
        live_payments_enabled?: boolean;
        keys: ApiKeyRecord[];
      } = await res.json();

      const envBadge = document.getElementById('portal-env-badge');
      const billingBadge = document.getElementById('portal-billing-badge');
      const subStatus = document.getElementById('portal-sub-status');
      const liveEnabled = Boolean(data.live_payments_enabled);

      if (envBadge) {
        envBadge.textContent = liveEnabled ? 'PRODUCTION ENVIRONMENT' : 'DEMO / EVALUATION ENVIRONMENT';
      }
      if (billingBadge) {
        billingBadge.textContent = liveEnabled ? 'LIVE BILLING: ACTIVE' : 'LIVE BILLING: NOT ACTIVE';
      }
      if (subStatus) {
        const hasVerifiedPaid = (data.keys || []).some((k) => Boolean(k.is_active) && Boolean(k.is_paid_enterprise));
        subStatus.textContent = hasVerifiedPaid ? 'Verified Active Subscription' : 'Evaluation Only (Unpaid)';
      }

      const tbody = document.getElementById('api-keys-table-body');
      if (tbody && data.keys) {
        if (data.keys.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-slate-500 text-xs">No access keys registered.</td></tr>';
        } else {
          tbody.innerHTML = data.keys.map((k) => {
            const isActive = Boolean(k.is_active);
            const isPaid = Boolean(k.is_paid_enterprise);
            const statusHtml = !isActive
              ? '<span class="text-slate-500 font-mono text-[10px]">REVOKED</span>'
              : isPaid
                ? '<span class="text-emerald-400 font-bold text-[10px] font-mono">● VERIFIED PAID</span>'
                : '<span class="text-amber-300 font-bold text-[10px] font-mono">● DEMO / EVALUATION</span>';
            const tierBadgeClass = isPaid
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-600'
              : 'bg-amber-950/70 text-amber-300 border border-amber-600/70';

            return `
              <tr class="hover:bg-obsidian-900/60 transition-colors">
                <td class="p-2.5 font-bold text-cyan-400 font-mono">${k.key_prefix}</td>
                <td class="p-2.5 text-white font-semibold">${k.name}</td>
                <td class="p-2.5 text-slate-300 font-mono text-[11px]">${k.license_id || 'DEMO-EVAL-2026'}</td>
                <td class="p-2.5">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${tierBadgeClass}">
                    ${k.license_type || k.tier || 'Evaluation Sandbox'}
                  </span>
                </td>
                <td class="p-2.5 text-white font-mono">${k.total_requests || 0} req (${k.rate_limit_rpm || 120} rpm)</td>
                <td class="p-2.5">${statusHtml}</td>
                <td class="p-2.5 text-right text-[10px] text-slate-400 font-mono">
                  ${isPaid ? 'Server-Verified' : 'Sandbox Read-Only'}
                </td>
              </tr>
            `;
          }).join('');
        }
      }
    }
  } catch (e) {
    console.warn('[LOAD API KEYS ERROR]', e);
  }
}

export function initiateEnterpriseCheckout(): void {
  alert('Enterprise billing activation is being prepared. Contact our team for licensing enquiries.');
}

export function completeEnterpriseOrder(): void {
  alert('Enterprise billing activation is being prepared. Contact our team for licensing enquiries.');
}

export function downloadCurrentInvoice(): void {
  alert('Enterprise billing activation is being prepared. Contact our team for licensing enquiries.');
}

export async function generatePartnerApiKey(): Promise<void> {
  const nameInput = document.getElementById('new-key-org-name') as HTMLInputElement | null;
  const tierSelect = document.getElementById('new-key-tier') as HTMLSelectElement | null;

  const name = (nameInput?.value ?? '').trim() || 'Emirates SkyCargo Flight Ops';
  const licenseType = tierSelect?.value || 'regional_hub';

  audio.playDirectiveChime();
  const btn = document.getElementById('btn-generate-key') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>PROVISIONING...</span>';
  }

  try {
    const res = await apiFetch('/api/v1/auth/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        license_type: licenseType,
        billing_email: ''
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to generate token');
    }

    const data: {
      api_key: string;
      license_id?: string;
      monthly_fee_usd?: number;
      sla_uptime?: string;
    } = await res.json();

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
    alert('Key Provisioning Error: ' + (err instanceof Error ? err.message : String(err)));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>⚡ PROVISION TOKEN</span>';
    }
  }
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
      latencyEl.textContent = `Status: ${res.status} | Latency: ${duration} ms | Mode: Evaluation Sandbox`;
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
window.selectAirspaceScope = selectAirspaceScope;
window.toggleAudioFeedback = toggleAudioFeedback;
window.setRadarViewMode = setRadarViewMode;
window.setRadarBasemap = setRadarBasemap;
window.toggleLayer = toggleLayer;
window.selectRadarAircraft = selectRadarAircraft;
window.closeSelectedAircraftPanel = closeSelectedAircraftPanel;
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
window.setLandingScenario = setLandingScenario;
window.setLandingCurrency = setLandingCurrency;
window.reinitRadar = reinitRadar;
window.viewLicensingPlans = viewLicensingPlans;
window.requestEnterpriseAccess = requestEnterpriseAccess;
window.requestEnterprisePlan = requestEnterprisePlan;
window.executeAiDeconflictionManeuver = executeAiDeconflictionManeuver;
window.openElectronicFlightStripsModal = openElectronicFlightStripsModal;
window.closeElectronicFlightStripsModal = closeElectronicFlightStripsModal;
window.executeStripVectorClearance = executeStripVectorClearance;

// Boot up sequence
function initApp(): void {
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

  // Continuous sync interval (pauses automatically when tab is hidden)
  setInterval(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    fetchLiveBackendTelemetry();
  }, 3000);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}


