# SkyGrid Intelligence | Enterprise Aviation Risk Command Center
**Akanno Tech Labs** — Production-Grade B2B SaaS Platform for Aviation Risk & Tactical Dispatch

---

## Production B2B Architecture Overview

SkyGrid Intelligence has been transformed from an enterprise frontend demo into an operational B2B SaaS platform engineered for multi-tenant air logistics operators, dispatch teams, and aviation safety auditors.

```
                              ┌──────────────────────────────────────────────┐
                              │     SKYGRID FRONTEND COMMAND CENTER HUD      │
                              │ Dark Obsidian (#030712) • Cyan • SF Pro/Mono │
                              └──────────────────────┬───────────────────────┘
                                                     │
                                      REST API & Live Telemetry Pull
                                                     │
                                                     ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 FASTAPI ENTERPRISE GATEWAY (PORT 3000)                                 │
├────────────────────────────────┬──────────────────────────────────────┬────────────────────────────────┤
│    MULTI-TENANT AUTH & TIER    │        LIVE INGESTION PIPELINE       │    WEBHOOK & DISPATCH ENGINE   │
│   • x-api-key token auth       │   • 60s background scheduler         │   • Outbound HMAC-SHA256 hooks │
│   • SHA-256 secure hash store  │   • Aviationstack ADS-B ingestion    │   • Instant breach triggers:   │
│   • Tier Rate Limiting:        │   • Weatherstack windshear index     │       - CRI > 25%              │
│       - Starter: 60 RPM        │   • In-memory TTL cache shield       │       - Severe Shear > 15 kts  │
│       - Professional: 300 RPM  │   • Zero API rate limit burn         │   • Slack / Teams JSON formats │
│       - Sovereign: 3000 RPM    │   • Dynamic corridor risk weighting  │   • Audit log & delivery queue │
├────────────────────────────────┴──────────────────────────────────────┴────────────────────────────────┤
│                              PERSISTENT TELEMETRY & AUDIT DATABASE                                     │
│   • Native PostgreSQL Engine (AWS RDS, Neon, Supabase, Cloud SQL via psycopg v3)                       │
│   • Automated fallback to high-concurrency SQLite (WAL Mode)                                           │
│   • Schemas: corridor_risk_shifts, flight_telemetry_history, routing_directives_audit, api_keys, webhooks   │
│   • Downloadable Official Reports: CSV Audits & ICAO Annex 19 Safety Management Systems (SMS) PDF       │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Operational Modules

### 1. Live API Ingestion & In-Memory Cache Shield
- **Scheduled Polling**: Runs on a background thread every 60 seconds (`POLL_INTERVAL_SECONDS=60`).
- **Aviationstack Integration**: Ingests real inbound Dubai International (`DXB / OMDB`) and Al Maktoum (`DWC / OMDW`) flight vectors.
- **Weatherstack Integration**: Ingests live surface wind speed, direction, temperature, barometric pressure, and dynamically calculates the real-time **windshear index** and turbulence components.
- **Cache Shielding**: Multiple concurrent clients and external logistics dispatchers querying `/api/v1/corridor/live` or `/api/v1/telemetry/flights` are served directly from the cached state, preventing third-party API rate-limit exhaustion.
- **Resilient Fallback**: If external API keys are not provided or if third-party limits are reached, the system gracefully operates on a high-fidelity real-time ADS-B and windshear stream.

### 2. Multi-Tenant Enterprise API & Auth Gateway
- **Portal Access**: Click the **`ENTERPRISE & API`** button on the top navigation bar or press **`[E]`**.
- **Cryptographic Key Management**: Generates secure tokens (`sk_live_...`), storing only the SHA-256 hash.
- **Subscription Tiers & Rate Limiting**:
  - `Starter`: 60 requests per minute
  - `Professional`: 300 requests per minute
  - `Enterprise Sovereign`: 3,000 requests per minute
- **Interactive API Explorer**: Test live API endpoints directly in the UI console and copy ready-to-run `curl` commands.
- **Standard HTTP Headers**:
  - `X-RateLimit-Limit`: Maximum requests permitted per 60-second window
  - `X-RateLimit-Remaining`: Remaining request quota
  - `X-RateLimit-Reset`: Seconds remaining until quota reset

### 3. Outbound Webhook & Dispatch Alert Engine
- **Instant Outbound Broadcast**: Dispatches HTTP POST notifications within milliseconds whenever:
  - Flight Risk Score exceeds critical threshold (`> 25%`)
  - Corridor Risk Index (CRI) breaches safety envelope (`> 25%`)
  - Severe terminal windshear occurs (`> 15 kts`)
  - AI Autonomous routing directive is executed
- **HMAC Signatures**: Every outbound request includes an `X-SkyGrid-Signature: sha256=...` header for cryptographic authenticity verification.
- **Slack & Microsoft Teams Compatible**: Automatically formats incoming webhooks into rich color-coded dispatch cards (`#EF4444` for Critical Breaches, `#F59E0B` for Weather Advisories).
- **Manual Test Alert**: Trigger live simulated broadcasts via the portal to verify webhook listener integrations.

### 4. Persistent PostgreSQL & SQLite Vault Database
- **PostgreSQL Connection**: Configurable via `DATABASE_URL` in `.env` or dynamically updated via the **Ingestion & DB Config** tab in the Enterprise Portal.
- **Database Engine Support**: Direct connectivity using modern `psycopg` v3.
- **Automated SQLite Fallback**: If a remote PostgreSQL instance is unreachable, the system automatically falls back to an embedded SQLite vault (`data/skygrid_vault.db`) in Write-Ahead Logging (`WAL`) mode with a 30s lock timeout for concurrency.
- **Compliance Reports**:
  - **CSV Audit Export**: `GET /api/v1/export/compliance-report.csv`
  - **ICAO SMS PDF Report**: `GET /api/v1/export/compliance-report.pdf` (Generates Bloomberg-grade, ICAO Annex 19 compliant aviation safety audit documents with cryptographic SHA-256 verification seals using ReportLab).

---

## Dedicated REST API Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/v1/corridor/dxb/risk` | Dedicated lightweight JSON CRI risk score for dispatch systems | `x-api-key` |
| `GET` | `/api/v1/corridor/live` | Full DXB corridor telemetry, weather, and cache metrics | `x-api-key` |
| `GET` | `/api/v1/telemetry/flights` | Active aircraft vectors, flight levels, and calculated risk % | `x-api-key` |
| `GET` | `/api/v1/weather/windshear` | Live surface winds, gusts, and windshear anomaly indices | `x-api-key` |
| `POST` | `/api/v1/directives/evaluate` | Evaluates autonomous trajectory deconfliction & laminar step | `x-api-key` |
| `GET` | `/api/v1/directives/audit` | Audit trail of all generated autonomous routing directives | `x-api-key` |
| `POST` | `/api/v1/auth/keys` | Generates a new tenant API key (`starter`, `professional`, `enterprise`) | None |
| `GET` | `/api/v1/auth/keys` | Lists all partner API credentials and request counters | None |
| `DELETE` | `/api/v1/auth/keys/{id}` | Revokes a partner API key | None |
| `POST` | `/api/v1/webhooks` | Registers an outbound dispatch webhook | None |
| `GET` | `/api/v1/webhooks` | Lists active webhook URLs and failure counts | None |
| `POST` | `/api/v1/alerts/test-dispatch` | Fires a test simulated dispatch alert to all webhooks | `x-api-key` |
| `GET` | `/api/v1/alerts/history` | Historical dispatch alerts queue | None |
| `GET` | `/api/v1/export/compliance-report.csv` | Streams RFC-compliant CSV audit export | None |
| `GET` | `/api/v1/export/compliance-report.pdf` | Streams official ICAO Annex 19 Safety PDF report | None |
| `GET` | `/api/v1/audit/logs` | Query historical corridor risk shifts | None |
| `GET` | `/api/v1/system/status` | Ingestion cache stats, DB engine, and poll intervals | None |
| `POST` | `/api/v1/system/api-keys` | Dynamically updates Aviationstack & Weatherstack API keys | None |
| `POST` | `/api/v1/system/db-config` | Tests and connects live PostgreSQL database | None |

---

## Interactive Hotkeys
- `[1 - 5]`: Switch Air Corridors (DXB, DOH-DXB, SIN-DXB, LHR-DXB, DWC)
- `[R]`: Recalibrate radar / Snap focus to DXB Coordinates (25.25°N, 55.36°E)
- `[E]`: Toggle Enterprise Gateway & Auth Portal Modal
- `[Space]`: Tactical Audio Ping
