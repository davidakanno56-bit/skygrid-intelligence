export type RiskSeverity = 'minimal' | 'low' | 'watch' | 'elevated' | 'critical';

export interface FlightVector {
  id: string;
  callsign: string;
  carrier: string;
  aircraft: string;
  origin: string;
  destination: string;
  originCity: string;
  destinationCity: string;
  altitude: number; // in feet (e.g. 38000)
  flightLevel: string; // e.g. "FL380"
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
  hazardNote?: string;
  vectorHistory: [number, number][]; // lat/lng pairs
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
