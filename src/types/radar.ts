export interface AirportHub {
  code: string;
  name: string;
  city: string;
  coords: [number, number]; // [lng, lat]
  isPrimary: boolean;
  role: string;
}

export interface CorridorCameraPreset {
  center: [number, number]; // [lng, lat]
  zoom: number;
  pitch: number;
  bearing: number;
  duration: number;
}

export interface FlightArcDefinition {
  from: string;
  to: string;
  color: string;
  callsign: string;
}

export interface LayerToggleState {
  vectors: boolean;
  sweep: boolean;
}

