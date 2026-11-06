/**
 * SkyGrid Intelligence - Centralized Enterprise API Client
 * Akanno Tech Labs • Production B2B SaaS Platform
 * 
 * Securely handles communication between Vite frontend and Render FastAPI backend.
 * Uses VITE_API_BASE_URL with graceful cold-start mitigation and fallback resilience.
 */

// Read base URL from Vite environment variables (e.g. https://skygrid-backend.onrender.com)
// Defaults to empty string for relative proxying in local/preview environments
const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

export interface ConnectionState {
  isConnected: boolean;
  isColdStarting: boolean;
  lastPingTime: number | null;
  latencyMs: number | null;
  activeBaseUrl: string;
  backendEngine?: string;
  isPostgres?: boolean;
}

type ConnectionListener = (state: ConnectionState) => void;

class ApiClient {
  private listeners: ConnectionListener[] = [];
  private state: ConnectionState = {
    isConnected: false,
    isColdStarting: false,
    lastPingTime: null,
    latencyMs: null,
    activeBaseUrl: API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
  };

  public subscribe(listener: ConnectionListener): () => void {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener({ ...this.state });
    }
  }

  public getBaseUrl(): string {
    return API_BASE_URL;
  }

  public getFullUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return API_BASE_URL ? `${API_BASE_URL}${cleanPath}` : cleanPath;
  }

  /**
   * Centralized resilient fetch wrapper
   */
  public async request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const url = this.getFullUrl(path);
    const startTime = performance.now();

    // Start cold-start detection timer if request takes > 2500ms
    const coldStartTimer = setTimeout(() => {
      if (!this.state.isColdStarting) {
        this.state.isColdStarting = true;
        this.notify();
      }
    }, 2500);

    const defaultHeaders: Record<string, string> = {
      'Accept': 'application/json'
    };

    if (options.body && typeof options.body === 'string') {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    const mergedOptions: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    };

    try {
      const response = await fetch(url, mergedOptions);
      clearTimeout(coldStartTimer);
      const elapsed = Math.round(performance.now() - startTime);

      this.state.latencyMs = elapsed;
      this.state.lastPingTime = Date.now();
      this.state.isColdStarting = false;
      this.state.isConnected = response.ok;
      this.notify();

      if (!response.ok) {
        let errMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errData = await response.json();
          if (errData && errData.detail) {
            errMessage = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
          }
        } catch {
          // Response body was not JSON
        }
        throw new Error(errMessage);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      clearTimeout(coldStartTimer);
      this.state.isColdStarting = false;
      this.state.isConnected = false;
      this.notify();
      throw err;
    }
  }

  // ==================== SPECIFIC API ENDPOINTS ====================

  /**
   * Health check and cold-start wake-up ping
   */
  public async checkHealth(): Promise<boolean> {
    try {
      const res = await this.request<{ status: string; database?: { engine: string; is_postgres: boolean } }>('/api/v1/system/status');
      if (res && res.database) {
        this.state.backendEngine = res.database.engine;
        this.state.isPostgres = res.database.is_postgres;
        this.notify();
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Live corridor telemetry and risk calculation
   */
  public async getCorridorLive(corridorId: string = 'dxb-primary') {
    return this.request<{
      corridor: unknown;
      weather: unknown;
      cache_stats: unknown;
      timestamp: string;
      client_tier: string;
    }>(`/api/v1/corridor/live?corridor_id=${encodeURIComponent(corridorId)}`);
  }

  /**
   * Live aircraft telemetry vector feed
   */
  public async getFlightTelemetry() {
    return this.request<{
      count: number;
      corridor: string;
      timestamp: string;
      source: string;
      flights: unknown[];
    }>('/api/v1/telemetry/flights');
  }

  /**
   * Autonomous trajectory deconfliction evaluation
   */
  public async evaluateDirective(payload: {
    flight_id: string;
    callsign: string;
    target_action?: string;
    altitude_target?: number;
  }) {
    return this.request<{
      status: string;
      directive_id: string;
      resolution: unknown;
      message: string;
    }>('/api/v1/directives/evaluate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Active commercial partner API keys
   */
  public async getApiKeys() {
    return this.request<{ count: number; keys: unknown[] }>('/api/v1/auth/keys');
  }

  /**
   * Revoke partner API key
   */
  public async revokeApiKey(keyId: number) {
    return this.request<{ status: string; key_id: number }>(`/api/v1/auth/keys/${keyId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Billing and multi-currency gateway configuration
   */
  public async getBillingConfig() {
    return this.request<{
      payment_gateway: string;
      supported_currencies: Record<string, { symbol: string; rate: number; name: string }>;
      flutterwave_public_key: string;
      paystack_public_key: string;
      raenest_wire_settlement: unknown;
    }>('/api/v1/billing/config');
  }

  /**
   * Initiate commercial checkout order
   */
  public async initiateCheckout(payload: {
    organization_name: string;
    billing_email: string;
    license_type: string;
    currency: string;
    payment_method: string;
  }) {
    return this.request<{
      order_ref: string;
      license_type: string;
      tier_name: string;
      amount_usd: number;
      amount_charged: number;
      currency: string;
      currency_symbol: string;
      payment_method: string;
      payment_gateway: string;
      flutterwave_config: unknown;
      wire_settlement: unknown;
      status: string;
    }>('/api/v1/billing/checkout/initiate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Complete commercial order & unlock API key
   */
  public async completeCheckout(payload: { order_ref: string; gateway_reference?: string }) {
    return this.request<{
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
    }>('/api/v1/billing/checkout/complete', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Direct download URLs for reports
   */
  public getInvoiceUrl(orderRef: string): string {
    return this.getFullUrl(`/api/v1/billing/invoice/${orderRef}`);
  }

  public getComplianceCsvUrl(): string {
    return this.getFullUrl('/api/v1/export/compliance-report.csv');
  }

  public getCompliancePdfUrl(): string {
    return this.getFullUrl('/api/v1/export/compliance-report.pdf');
  }
}

export const apiClient = new ApiClient();
