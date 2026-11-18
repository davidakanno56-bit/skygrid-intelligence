import time
import hmac
import secrets
import hashlib
import datetime
from typing import Dict, Any, Optional, Tuple
from fastapi import Request, HTTPException, status
from backend.config import settings
from backend.database import db

# Provisional Commercial B2B Licensing Specifications (Live payments not yet activated)
COMMERCIAL_TIERS = {
    "regional_hub": {
        "name": "Regional Hub License",
        "monthly_fee_usd": 2500,
        "rate_limit_rpm": 120,
        "daily_call_limit": 50000,
        "sla_uptime": "Target 99.9%",
        "pricing_status": "PROVISIONAL",
        "corridor_access": "Single Corridor (DXB) Telemetry & CRI Feed",
        "description": "Proposed commercial tier for single-hub freight operators and regional dispatch teams."
    },
    "global_cargo_carrier": {
        "name": "Global Cargo Carrier License",
        "monthly_fee_usd": 7500,
        "rate_limit_rpm": 500,
        "daily_call_limit": 500000,
        "sla_uptime": "Target 99.99%",
        "pricing_status": "PROVISIONAL",
        "corridor_access": "Multi-Corridor Routing Advisory & Real-Time Webhooks",
        "description": "Proposed commercial tier for international cargo carriers requiring multi-corridor evaluation."
    },
    "sovereign_defense": {
        "name": "Sovereign Airspace & Defense License",
        "monthly_fee_usd": 25000,
        "rate_limit_rpm": 3000,
        "daily_call_limit": "Custom Dedicated Node Throughput",
        "sla_uptime": "Custom Annual Agreement",
        "pricing_status": "PROVISIONAL_ANNUAL_CONCEPT",
        "corridor_access": "Global Axis & Private-Cloud Deployment Architecture",
        "description": "Proposed annual contract concept for civil aviation authorities and enterprise partners."
    }
}

DEMO_EVALUATION_TIER = {
    "name": "Evaluation Sandbox (Non-Commercial)",
    "monthly_fee_usd": 0,
    "rate_limit_rpm": 120,
    "daily_call_limit": 5000,
    "sla_uptime": "Evaluation / Best-Effort",
    "pricing_status": "DEMO",
    "corridor_access": "Simulated DXB Radar & Prototype Telemetry Evaluation",
    "description": "Non-commercial evaluation environment with simulated traffic."
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


def require_admin_auth(request: Request) -> Dict[str, Any]:
    """Strictly requires server-configured SKYGRID_ADMIN_SECRET via x-admin-secret header."""
    configured_secret = (settings.ADMIN_API_SECRET or "").strip()
    if not configured_secret:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative key provisioning is disabled until SKYGRID_ADMIN_SECRET is configured on the server."
        )
    provided = (request.headers.get("x-admin-secret") or "").strip()
    if not provided or not hmac.compare_digest(provided, configured_secret):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing administrative authorization header (x-admin-secret)."
        )
    return {"actor": "SKYGRID_ADMIN", "authorized": True}


def create_api_key(
    name: str,
    license_type: str = "demo_evaluation",
    billing_email: str = "",
    is_paid_enterprise: bool = False,
    verified_payment_ref: Optional[str] = None,
    expires_in_days: int = 30
) -> Dict[str, Any]:
    """
    Issues an API key. Paid enterprise status (is_paid_enterprise=True) is NEVER allowed
    without a server-verified payment reference or explicit administrative grant.
    """
    license_type = license_type.lower().strip()
    if is_paid_enterprise and not verified_payment_ref:
        raise ValueError("Paid enterprise keys require a verified server-side payment or contract reference.")

    if is_paid_enterprise and license_type in COMMERCIAL_TIERS:
        tier_info = COMMERCIAL_TIERS[license_type]
        key_env_prefix = "sk_live"
        subscription_status = "VERIFIED_PAID"
        paid_flag = 1
    else:
        license_type = "demo_evaluation"
        tier_info = DEMO_EVALUATION_TIER
        key_env_prefix = "sk_demo"
        subscription_status = "DEMO_EVALUATION"
        paid_flag = 0

    limit_rpm = int(tier_info["rate_limit_rpm"])
    monthly_fee = int(tier_info["monthly_fee_usd"])
    sla = str(tier_info["sla_uptime"])

    random_code = secrets.token_hex(4).upper()
    prefix_code = license_type[:3].upper()
    license_id = f"{'LIC' if paid_flag else 'DEMO'}-{prefix_code}-2026-{random_code}"

    random_token = secrets.token_urlsafe(20).replace("-", "").replace("_", "")[:22]
    raw_key = f"{key_env_prefix}_{license_type[:3]}_{random_token}"
    key_hash = hash_token(raw_key)
    key_prefix = f"{key_env_prefix}_{license_type[:3]}_{random_token[:4]}..."

    now_dt = datetime.datetime.now(datetime.timezone.utc)
    now = now_dt.isoformat()
    expires_at = (now_dt + datetime.timedelta(days=max(1, expires_in_days))).isoformat()

    db.execute_write("""
        INSERT INTO api_keys
        (key_hash, key_prefix, name, tier, rate_limit_rpm, is_active, is_paid_enterprise, license_type, license_id, monthly_fee_usd, sla_uptime, subscription_status, expires_at, created_at, last_used_at, total_requests)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    """, (
        key_hash, key_prefix, name, license_type, limit_rpm, 1, paid_flag,
        tier_info["name"], license_id, monthly_fee, sla, subscription_status, expires_at, now, now, 0
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
        "is_paid_enterprise": bool(paid_flag),
        "subscription_status": subscription_status,
        "expires_at": expires_at,
        "created_at": now
    }


def list_api_keys():
    try:
        rows = db.execute_query(
            """SELECT id, key_prefix, name, tier, rate_limit_rpm, is_active,
                      is_paid_enterprise, license_type, license_id, monthly_fee_usd,
                      sla_uptime, subscription_status, expires_at, created_at, last_used_at, total_requests
               FROM api_keys ORDER BY created_at DESC;"""
        )
        for r in rows:
            is_active = bool(r.get("is_active"))
            is_paid = bool(r.get("is_paid_enterprise"))
            if not is_active:
                r["subscription_status"] = "REVOKED"
            elif is_paid:
                r["subscription_status"] = "VERIFIED_PAID"
            else:
                r["subscription_status"] = "DEMO_EVALUATION"
        return rows
    except Exception as e:
        print(f"[AUTH DB ERROR] {e}")
        return []


def revoke_api_key(key_id: int):
    return db.execute_write(
        "UPDATE api_keys SET is_active = 0, subscription_status = 'REVOKED' WHERE id = %s;",
        (key_id,)
    )


def _is_expired(expires_at: Optional[str]) -> bool:
    if not expires_at:
        return False
    try:
        exp = datetime.datetime.fromisoformat(str(expires_at).replace("Z", "+00:00"))
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=datetime.timezone.utc)
        return datetime.datetime.now(datetime.timezone.utc) > exp
    except Exception:
        return False


async def authenticate_partner(request: Request) -> Dict[str, Any]:
    """
    Validates API credentials for telemetry & evaluation routes.
    - If a valid x-api-key is provided, verifies active status, expiry, and rate limits from DB.
    - Never trusts frontend flags or spoofable Referer headers to grant paid enterprise status.
    - Allows clearly labelled DEMO_EVALUATION read access for the public prototype dashboard.
    """
    api_key = (request.headers.get("x-api-key") or "").strip()

    if not api_key:
        # Public prototype evaluation session (explicitly non-paid, rate-limited per IP)
        client_ip = request.client.host if request.client else "unknown"
        demo_bucket = hash_token(f"demo_session:{client_ip}")
        allowed, _, reset_sec = rate_limiter.check_rate_limit(demo_bucket, 120)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Evaluation sandbox rate limit exceeded (120 req/min). Cooldown resets in {reset_sec}s."
            )
        return {
            "name": "Public Evaluation Session (DEMO)",
            "tier": "demo_evaluation",
            "tier_name": DEMO_EVALUATION_TIER["name"],
            "license_id": "DEMO-EVAL-SESSION",
            "rate_limit_rpm": 120,
            "is_paid_enterprise": False,
            "subscription_status": "DEMO_EVALUATION",
            "is_demo": True
        }

    key_hash = hash_token(api_key)
    rows = db.execute_query(
        """SELECT id, name, tier, rate_limit_rpm, is_active, is_paid_enterprise,
                  license_type, license_id, monthly_fee_usd, sla_uptime, subscription_status,
                  expires_at, total_requests
           FROM api_keys WHERE key_hash = %s;""",
        (key_hash,)
    )

    if not rows or not rows[0]["is_active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or revoked 'x-api-key'. Please verify your credentials or request enterprise access."
        )

    partner = dict(rows[0])

    if _is_expired(partner.get("expires_at")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="API license key has expired. Renewal required for continued access."
        )

    limit_rpm = int(partner.get("rate_limit_rpm") or 120)
    allowed, _, reset_sec = rate_limiter.check_rate_limit(key_hash, limit_rpm)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded for tier '{partner.get('tier')}' ({limit_rpm} req/min). Cooldown resets in {reset_sec}s.",
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

    partner["is_paid_enterprise"] = bool(partner.get("is_paid_enterprise"))
    partner["subscription_status"] = "VERIFIED_PAID" if partner["is_paid_enterprise"] else "DEMO_EVALUATION"
    partner["is_demo"] = not partner["is_paid_enterprise"]
    return partner


async def require_paid_enterprise(request: Request) -> Dict[str, Any]:
    """Strict server-side access guard for paid enterprise API features."""
    api_key = (request.headers.get("x-api-key") or "").strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing 'x-api-key' header. Server-verified paid enterprise license required."
        )
    partner = await authenticate_partner(request)
    if not partner.get("is_paid_enterprise"):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="402 Payment Required — A server-verified paid enterprise subscription is required for this endpoint."
        )
    return partner
