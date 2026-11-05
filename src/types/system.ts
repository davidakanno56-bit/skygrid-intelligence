export interface LiveCorridorTelemetry {
  corridor_id: string;
  name: string;
  riskIndex: number;
  overallRiskGauge: number;
  activeVectors: number;
  throughputTonnesPerHour: number;
  autonomousDirectivesCount: number;
}

export interface LiveWeatherReport {
  windshear_index_kts: number;
  condition: string;
  temperature_c: number;
  wind_speed_kts: number;
  wind_direction_deg: number;
  visibility_km: number;
  last_updated: string;
}

export interface IngestionPipelineStats {
  aviationstack_source?: string;
  weatherstack_source?: string;
  cache_hits: number;
  api_call_count: number;
  seconds_until_next_poll: number;
  db_engine?: string;
}

export interface LiveSyncResponse {
  status: string;
  corridor: LiveCorridorTelemetry;
  weather: LiveWeatherReport;
  cache_stats: IngestionPipelineStats;
}

export interface WebhookRecord {
  id: number;
  url: string;
  event_types: string;
  is_active: number | boolean;
  failure_count: number;
  created_at: string;
}

export interface DispatchAlertRecord {
  id: number;
  flight_id: string;
  callsign: string;
  alert_type: string;
  severity: 'WARNING' | 'CRITICAL' | 'EMERGENCY';
  details: string;
  dispatched_channels: string;
  status: string;
  created_at: string;
}

export interface ComplianceAuditRecord {
  id: number;
  corridor_id: string;
  risk_index: number;
  active_vectors: number;
  throughput_tonnes: number;
  directives_count: number;
  weather_note: string;
  recorded_at: string;
}

export interface SystemStatusResponse {
  system: string;
  version: string;
  status: string;
  database: {
    engine: string;
    is_postgres: boolean;
    configured_url: boolean;
  };
  ingestion_pipeline: IngestionPipelineStats;
  timestamp: string;
}

