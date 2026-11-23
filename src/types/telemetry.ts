export type RiskSeverity = 'minimal' | 'low' | 'watch' | 'elevated' | 'critical';

export interface SensorFusionMetrics {
  psrActive: boolean;
  ssrActive: boolean;
  spaceAdsbActive: boolean;
  weatherDopplerActive: boolean;
  uasFlarmActive: boolean;
  confidenceScore: number; // e.g. 99.8
  latencyMs: number; // e.g. 11.4
  quantumResistantChannel: 'KYBER-768' | 'AES-256-GCM';
  antiSpoofingParity: 'SECURE' | 'ANOMALY_DETECTED';
}

export interface GpsInterferenceZone {
  id: string;
  name: string;
  region: string;
  threatLevel: 'MODERATE_JAMMING' | 'SEVERE_SPOOFING' | 'GNSS_DENIAL';
  frequencyBand: string;
  insFailoverActive: boolean;
  centerCoords: [number, number]; // [lng, lat]
  radiusKm: number;
}

export interface SpaceLaunchCorridor {
  id: string;
  name: string;
  spaceport: string;
  vehicle: string;
  corridorType: 'ORBITAL_INSERTION' | 'SUBORBITAL_HYPERSONIC' | 'RE_ENTRY_ZONE';
  status: 'ACTIVE_TFR' | 'WINDOW_STANDBY' | 'CLEAR';
  floorFL: string;
  ceilingFL: string;
  trajectoryMach: number;
  quarantineRadiusNm: number;
}

export interface ConflictPrediction4D {
  conflictId: string;
  flightAId: string;
  flightBId: string;
  flightACallsign: string;
  flightBCallsign: string;
  timeToCpaSeconds: number; // closest point of approach
  predictedDistanceNm: number;
  predictedAltitudeDiffFt: number;
  severity: 'WARNING' | 'CRITICAL_COLLISION_ALERT';
  resolutionAdvisory: {
    targetFlight: string;
    action: 'CLIMB' | 'DESCEND' | 'TURN_LEFT' | 'TURN_RIGHT' | 'SPEED_ADJUST';
    clearedAltitude?: string;
    clearedHeading?: number;
    clearedMach?: number;
    separationRestoredNm: number;
  };
}

export interface FlightVector {
  id: string;
  icao24?: string;
  callsign: string;
  carrier: string;
  aircraft: string;
  origin: string;
  destination: string;
  originCity: string;
  destinationCity: string;
  altitude: number; // in feet (e.g. 38000)
  flightLevel: string; // e.g. "FL380"
  verticalRateFpm?: number; // feet per minute
  speed: number; // knots
  mach: number;
  heading: number; // degrees
  lat: number;
  lng: number;
  riskScore: number; // 0 - 100%
  riskCategory: RiskSeverity;
  status: 'In Corridor' | 'Holding Pattern' | 'Vector Corrected' | 'Final Descent' | 'Rerouting Required';
  cargoPayload: string;
  cargoWeightTonnes: number;
  transponder: string;
  etaMinutes: number;
  isSimulated?: boolean;
  hazardNote?: string;
  vectorHistory: [number, number][]; // lat/lng pairs
  sensorSources?: ('PSR' | 'SSR' | 'SPACE_ADSB' | 'FLARM')[];
  gpsIntegrity?: 'NOMINAL' | 'DEGRADED' | 'SPOOFED';
}

export interface CorridorMetric {
  id: string;
  name: string;
  code: string;
  status: 'Optimal' | 'Caution' | 'Congested';
  centerCoords: { lat: number; lng: number };
  activeVectorsCount: number;
  riskIndex: number;
  throughputTonnesPerHour: number;
  autonomousDirectivesCount: number;
  weatherHazards: string;
  coordinatesLabel: string;
}

export interface TacticalDirective {
  id: string;
  timestamp: string;
  flightId: string;
  callsign: string;
  action: 'VORTEX_SEPARATION' | 'ALTITUDE_STEP_CLIMB' | 'WAYPOINT_BYPASS' | 'SPEED_ADJUSTMENT' | 'SLOT_OPTIMIZATION';
  description: string;
  riskReduction: number;
  confidence: number;
  status: 'EXECUTED' | 'MONITORING' | 'PENDING';
}

export interface WaypointNode {
  name: string;
  code: string;
  lat: number;
  lng: number;
  type: 'HUB' | 'WAYPOINT' | 'GATE' | 'HOLDING';
  flightCount: number;
  riskIndex: number;
}
