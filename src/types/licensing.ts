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

export type BillingCurrency = 'USD' | 'AED' | 'EUR' | 'GBP' | 'NGN';

export interface CurrencySpec {
  symbol: string;
  rate: number;
  name: string;
}

export interface WireSettlementDetails {
  beneficiary_name: string;
  bank_name: string;
  routing_number: string;
  account_number: string;
  swift_bic: string;
  invoice_download_url: string;
}

export interface FlutterwaveConfig {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: string;
  customer_email: string;
  customer_name: string;
  title: string;
  description: string;
}

export interface InitiateCheckoutPayload {
  organization_name: string;
  billing_email: string;
  license_type: string;
  currency: BillingCurrency | string;
  payment_method: 'card' | 'wire' | string;
}

export interface InitiateCheckoutResponse {
  order_ref: string;
  license_type: string;
  tier_name: string;
  amount_usd: number;
  amount_charged: number;
  currency: BillingCurrency | string;
  currency_symbol: string;
  payment_method: string;
  payment_gateway: string;
  flutterwave_config: FlutterwaveConfig;
  wire_settlement: WireSettlementDetails;
  status: string;
}

export interface CompleteCheckoutResponse {
  status: string;
  order_ref: string;
  api_key: string;
  key_prefix: string;
  license_id: string;
  license_name: string;
  monthly_fee_usd: number;
  sla_uptime: string;
  amount_charged: number;
  currency: string;
  is_paid_enterprise: boolean;
  message: string;
}

