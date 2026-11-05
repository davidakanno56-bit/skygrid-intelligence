export type CommercialTierKey = 'regional_hub' | 'global_cargo_carrier' | 'sovereign_defense';

export interface CommercialTierSpec {
  name: string;
  monthly_fee_usd: number;
  rate_limit_rpm: number;
  daily_call_limit: number | string;
  sla_uptime: string;
  corridor_access: string;
  description: string;
}

export interface ApiKeyRecord {
  id: number;
  key_prefix: string;
  name: string;
  tier: CommercialTierKey | string;
  rate_limit_rpm: number;
  is_active: number | boolean;
  is_paid_enterprise: number | boolean;
  license_type: string;
  license_id: string;
  monthly_fee_usd: number;
  sla_uptime: string;
  created_at?: string;
  last_used_at?: string;
  total_requests: number;
}

export interface CreateKeyRequestPayload {
  name: string;
  license_type: CommercialTierKey | string;
  billing_email?: string;
}

export interface CreateKeyResponsePayload {
  status: string;
  api_key: string;
  key_prefix: string;
  name: string;
  license_type: string;
  license_name: string;
  license_id: string;
  monthly_fee_usd: number;
  sla_uptime: string;
  rate_limit_rpm: number;
  is_paid_enterprise: boolean;
  message: string;
}

export interface LicensingTiersResponse {
  licensing_policy: string;
  zero_free_tier: boolean;
  tiers: Record<CommercialTierKey, CommercialTierSpec>;
}

