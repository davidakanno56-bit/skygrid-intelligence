import time
import secrets
import hashlib
import datetime
from typing import Dict, Any, Optional, Tuple
from fastapi import Request, HTTPException, Security, status
from backend.config import settings
from backend.database import db

# Strict Commercial B2B Licensing Specifications (Zero Free Tier)
COMMERCIAL_TIERS = {
    "regional_hub": {
        "name": "Regional Hub License",
        "monthly_fee_usd": 2500,
        "rate_limit_rpm": 120,
        "daily_call_limit": 50000,
        "sla_uptime": "99.9%",
        "corridor_access": "Single Corridor (DXB) Telemetry & CRI Feed",
        "description": "Engineered for single hub freight operators and regional ground dispatchers."
    },
    "global_cargo_carrier": {
        "name": "Global Cargo Carrier License",
        "monthly_fee_usd": 7500,
        "rate_limit_rpm": 500,
        "daily_call_limit": 500000,
        "sla_uptime": "99.99%",
        "corridor_access": "Multi-Corridor Routing Directives & Real-Time Webhooks",
        "description": "Mission-critical tier for international cargo airlines (Emirates SkyCargo, FedEx, Atlas, DHL)."
    },
    "sovereign_defense": {
        "name": "Sovereign Airspace & Defense License",
        "monthly_fee_usd": 25000, # Custom Annual baseline
        "rate_limit_rpm": 3000,
        "daily_call_limit": "Unlimited Dedicated Node Throughput",
        "sla_uptime": "99.999% Dedicated Node SLA",
        "corridor_access": "Global Axis & Sovereign Airspace Deconfliction",
        "description": "For civil aviation authorities, national defense, and sovereign airspace regulators."
    }
}

class RateLimiter:
    def __init__(self):
        self.request_windows: Dict[str, list] = {}

    def check_rate_limit(self, key_hash: str, limit_rpm: int) -> Tuple[bool, int, int]:
        now = time.time()
        window_start = now - 60.0

        if key_hash not in self.request_windows:
            self.request_windows[key_hash] = []

        self.request_windows[key_hash] = [
            ts for ts in self.request_windows[key_hash] if ts > window_start
        ]

        current_count = len(self.request_windows[key_hash])
        remaining = max(0, limit_rpm - current_count)

        if current_count >= limit_rpm:
            reset_seconds = int(60.0 - (now - self.request_windows[key_hash][0])) if self.request_windows[key_hash] else 60
            return False, 0, reset_seconds

        self.request_windows[key_hash].append(now)
        return True, remaining - 1, 60

rate_limiter = RateLimiter()

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def create_api_key(name: str, license_type: str = "regional_hub", billing_email: str = "") -> Dict[str, Any]:
    license_type = license_type.lower()
    if license_type not in COMMERCIAL_TIERS:
        license_type = "regional_hub"
    
    tier_info = COMMERCIAL_TIERS[license_type]
    limit_rpm = tier_info["rate_limit_rpm"]
    monthly_fee = tier_info["monthly_fee_usd"]
    sla = tier_info["sla_uptime"]

    random_code = secrets.token_hex(4).upper()
    prefix_code = license_type[:3].upper()
    license_id = f"LIC-{prefix_code}-2026-{random_code}"

    random_token = secrets.token_urlsafe(20).replace("-", "").replace("_", "")[:22]
    raw_key = f"sk_live_{license_type[:3]}_{random_token}"
    key_hash = hash_token(raw_key)
    key_prefix = f"sk_live_{license_type[:3]}_{random_token[:4]}..."

    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    db.execute_write("""
        INSERT INTO api_keys 
        (key_hash, key_prefix, name, tier, rate_limit_rpm, is_active, is_paid_enterprise, license_type, license_id, monthly_fee_usd, sla_uptime, created_at, last_used_at, total_requests)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    """, (
        key_hash, key_prefix, name, license_type, limit_rpm, 1, 1,
        tier_info["name"], license_id, monthly_fee, sla, now, now, 0
    ))

    return {
        "raw_key": raw_key,
        "key_prefix": key_prefix,
        "name": name,
        "tier": license_type,
        "tier_name": tier_info["name"],
        "license_id": license_id,
        "monthly_fee_usd": monthly_fee,
        "sla_uptime": sla,
        "rate_limit_rpm": limit_rpm,
        "is_paid_enterprise": True,
        "created_at": now
    }

def list_api_keys():
    try:
        return db.execute_query(
            """SELECT id, key_prefix, name, tier, rate_limit_rpm, is_active, 
                      is_paid_enterprise, license_type, license_id, monthly_fee_usd, 
                      sla_uptime, created_at, last_used_at, total_requests 
               FROM api_keys ORDER BY created_at DESC;"""
        )
    except Exception as e:
        print(f"[AUTH DB ERROR] {e}")
        return []

def revoke_api_key(key_id: int):
    return db.execute_write("UPDATE api_keys SET is_active = 0 WHERE id = %s;", (key_id,))

async def authenticate_partner(request: Request) -> Dict[str, Any]:
    """Dependency for validating enterprise API keys and enforcing strict paid licensing."""
    api_key = request.headers.get("x-api-key")

    if not api_key:
        referer = request.headers.get("referer", "")
        # Internal browser dashboard session bypass
        if "localhost" in referer or "127.0.0.1" in referer:
            return {
                "name": "SkyGrid Internal Command Session",
                "tier": "sovereign_defense",
                "tier_name": "Sovereign Airspace & Defense License",
                "license_id": "LIC-SOV-INTERNAL-2026",
                "rate_limit_rpm": 3000,
                "is_paid_enterprise": True,
                "is_internal": True
            }
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing 'x-api-key' authentication header. Commercial Akanno Tech Labs enterprise license required."
        )

    key_hash = hash_token(api_key.strip())
    rows = db.execute_query(
        """SELECT id, name, tier, rate_limit_rpm, is_active, is_paid_enterprise, 
                  license_type, license_id, monthly_fee_usd, sla_uptime, total_requests 
           FROM api_keys WHERE key_hash = %s;""",
        (key_hash,)
    )

    if not rows or not rows[0]["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or revoked 'x-api-key'. Please verify your logistics partner credentials."
        )

    partner = rows[0]

    # Enforce Strict Paid-Only Enterprise Licensing (Zero Free Tier)
    if not partner.get("is_paid_enterprise"):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="402 Payment Required — Commercial Akanno Tech Labs Enterprise License Required. Active subscription needed for Regional Hub ($2,500/mo), Global Cargo Carrier ($7,500/mo), or Sovereign Airspace & Defense."
        )

    limit_rpm = int(partner.get("rate_limit_rpm") or 120)

    # Enforce Rate Limiting
    allowed, remaining, reset_sec = rate_limiter.check_rate_limit(key_hash, limit_rpm)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Subscription rate limit exceeded for license tier '{partner.get('license_type') or partner.get('tier')}' ({limit_rpm} req/min). Cooldown resets in {reset_sec}s.",
            headers={
                "X-RateLimit-Limit": str(limit_rpm),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(reset_sec)
            }
        )

    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        db.execute_write(
            "UPDATE api_keys SET total_requests = total_requests + 1, last_used_at = %s WHERE id = %s;",
            (now_str, partner["id"])
        )
    except Exception as e:
        print(f"[AUTH USAGE UPDATE ERROR] {e}")

    return partner
