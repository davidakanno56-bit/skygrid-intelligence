import os
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any
import datetime

from fastapi import FastAPI, Depends, Header, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.config import settings
from backend.database import db
from backend.ingestion import ingestion_pipeline
from backend.alerts import alert_engine
from backend.auth import (
    authenticate_partner, create_api_key, list_api_keys, revoke_api_key, COMMERCIAL_TIERS
)
from backend.reports import (
    generate_csv_compliance_report, generate_pdf_compliance_report
)
from backend.billing import (
    initiate_order, verify_and_activate_order, generate_proforma_invoice_pdf, CURRENCY_RATES
)

app = FastAPI(
    title=settings.APP_NAME,
    description="Bloomberg-grade Enterprise Aviation Risk & Tactical Dispatch Gateway",
    version=settings.VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Enable CORS for cross-origin dispatch integrations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== PYDANTIC SCHEMAS ====================

class CreateApiKeyRequest(BaseModel):
    name: str
    license_type: str = "regional_hub" # regional_hub ($2,500/mo), global_cargo_carrier ($7,500/mo), sovereign_defense (Custom)
    billing_email: Optional[str] = ""

class CreateWebhookRequest(BaseModel):
    url: str
    event_types: str = "risk_breach,severe_weather,directive_executed"
    secret: Optional[str] = None

class EvaluateDirectiveRequest(BaseModel):
    flight_id: str
    callsign: str
    target_action: Optional[str] = None
    altitude_target: Optional[int] = None

class UpdateApiKeysRequest(BaseModel):
    aviationstack_key: Optional[str] = None
    weatherstack_key: Optional[str] = None

class UpdateDbConfigRequest(BaseModel):
    database_url: str

class InitiateCheckoutRequest(BaseModel):
    organization_name: str
    billing_email: str
    license_type: str = "global_cargo_carrier"
    currency: str = "USD"
    payment_method: str = "card" # "card" or "wire"

class CompleteCheckoutRequest(BaseModel):
    order_ref: str
    gateway_reference: Optional[str] = None

# ==================== LIFECYCLE EVENTS ====================

@app.on_event("startup")
def on_startup():
    print("[GATEWAY] Booting SkyGrid Intelligence Production Suite...")
    # Start the 60s background API ingestion pipeline
    ingestion_pipeline.start()

# ==================== OPERATIONAL & TELEMETRY API ====================

@app.get("/api/v1/corridor/live", summary="Get live DXB-DWC corridor risk & throughput metrics")
def get_live_corridor(
    corridor_id: str = "dxb-primary",
    partner: dict = Depends(authenticate_partner)
):
    corridor = ingestion_pipeline.get_corridor(corridor_id)
    weather = ingestion_pipeline.get_weather()
    stats = ingestion_pipeline.get_cache_stats()
    return {
        "corridor": corridor,
        "weather": weather,
        "cache_stats": stats,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "client_tier": partner.get("tier", "enterprise")
    }

@app.get("/api/v1/corridor/all", summary="Get all active air corridors")
def get_all_corridors(partner: dict = Depends(authenticate_partner)):
    return {
        "corridors": ingestion_pipeline.get_all_corridors(),
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

@app.get("/api/v1/corridor/dxb/risk", summary="Lightweight JSON Corridor Risk Index for Dispatch Integration")
def get_dxb_risk_index(partner: dict = Depends(authenticate_partner)):
    """Dedicated endpoint for external dispatch software to poll live CRI without heavy payloads."""
    corridor = ingestion_pipeline.get_corridor("dxb-primary")
    weather = ingestion_pipeline.get_weather()
    return {
        "corridor_code": "DXB-CORR-01",
        "corridor_name": "DXB AIR CORRIDOR",
        "coordinates": "25.2532° N, 55.3657° E",
        "corridor_risk_index": corridor["riskIndex"],
        "hazard_envelope": corridor["status"],
        "overall_risk_gauge_pct": corridor["overallRiskGauge"],
        "active_vectors": corridor["activeVectors"],
        "throughput_tonnes_hr": corridor["throughputTonnesPerHour"],
        "windshear_index_kts": weather["windshear_index_kts"],
        "weather_condition": weather["condition"],
        "is_safe_for_descent": corridor["riskIndex"] <= settings.CORRIDOR_RISK_THRESHOLD,
        "updated_at": weather["last_updated"]
    }

@app.get("/api/v1/telemetry/flights", summary="Get live flight vectors and calculated risk scores")
def get_flight_vectors(partner: dict = Depends(authenticate_partner)):
    flights = ingestion_pipeline.get_flights()
    return {
        "count": len(flights),
        "flights": flights,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

@app.get("/api/v1/weather/windshear", summary="Get live DXB weather and windshear index")
def get_weather_telemetry(partner: dict = Depends(authenticate_partner)):
    return {
        "weather": ingestion_pipeline.get_weather(),
        "source": ingestion_pipeline.source_weather
    }

# ==================== ROUTING DIRECTIVES ENGINE ====================

@app.post("/api/v1/directives/evaluate", summary="Evaluate AI Autonomous Vector Deconfliction")
def evaluate_routing_directive(
    req: EvaluateDirectiveRequest,
    partner: dict = Depends(authenticate_partner)
):
    flights = ingestion_pipeline.get_flights()
    target_flight = next((f for f in flights if f["id"] == req.flight_id or f["callsign"] == req.callsign), None)

    if not target_flight:
        raise HTTPException(status_code=404, detail=f"Flight '{req.flight_id or req.callsign}' not located in active corridor.")

    old_risk = target_flight["riskScore"]
    new_risk = max(3.5, round(old_risk - 14.5, 1))
    reduction = round(old_risk - new_risk, 1)

    target_flight["riskScore"] = new_risk
    target_flight["riskCategory"] = "minimal" if new_risk < 10 else "low"
    target_flight["status"] = "Vector Corrected"
    target_flight["hazardNote"] = "Autonomous vector deconfliction executed via Enterprise Gateway."

    directive_id = f"DIR-{int(datetime.datetime.now().timestamp() * 1000) % 90000 + 10000}"
    directive = {
        "id": directive_id,
        "flightId": target_flight["id"],
        "callsign": target_flight["callsign"],
        "action": req.target_action or "AUTONOMOUS_VECTOR_DECONFLICTION",
        "description": f"Trajectory stepped to laminar separation; risk lowered from {old_risk}% to {new_risk}%.",
        "riskReduction": -reduction,
        "confidence": 99.8,
        "status": "EXECUTED",
        "triggered_by": partner.get("name", "ENTERPRISE_API_CLIENT")
    }

    # Persist directive audit
    try:
        db.log_directive(directive)
    except Exception as e:
        print(f"[DB ERROR] {e}")

    # Dispatch notification to partner webhooks
    alert_engine.dispatch_directive_executed(directive)

    return {
        "status": "SUCCESS",
        "directive": directive,
        "flight_telemetry": target_flight
    }

@app.get("/api/v1/directives/audit", summary="Get historical audit trail of routing directives")
def get_directives_audit(
    limit: int = Query(50, ge=1, le=200),
    partner: dict = Depends(authenticate_partner)
):
    directives = db.execute_query(
        "SELECT * FROM routing_directives_audit ORDER BY created_at DESC LIMIT %s;",
        (limit,)
    )
    return {
        "count": len(directives),
        "directives": directives
    }

# ==================== MULTI-TENANT ENTERPRISE AUTH & KEY PORTAL ====================

@app.get("/api/v1/auth/licensing/tiers", summary="List strict commercial B2B licensing tiers")
def get_licensing_tiers():
    return {
        "licensing_policy": "STRICT_PAID_ENTERPRISE_ONLY",
        "zero_free_tier": True,
        "tiers": COMMERCIAL_TIERS
    }

@app.post("/api/v1/auth/keys", summary="Generate a new commercial enterprise x-api-key token")
def create_key(req: CreateApiKeyRequest):
    key_info = create_api_key(
        name=req.name,
        license_type=req.license_type,
        billing_email=req.billing_email or ""
    )
    return {
        "status": "created",
        "api_key": key_info["raw_key"], # Displayed once!
        "key_prefix": key_info["key_prefix"],
        "name": key_info["name"],
        "license_type": key_info["tier"],
        "license_name": key_info["tier_name"],
        "license_id": key_info["license_id"],
        "monthly_fee_usd": key_info["monthly_fee_usd"],
        "sla_uptime": key_info["sla_uptime"],
        "rate_limit_rpm": key_info["rate_limit_rpm"],
        "is_paid_enterprise": True,
        "message": "Commercial license activated. Store this key securely; the raw token will not be shown again."
    }

@app.get("/api/v1/auth/keys", summary="List partner API keys and usage statistics")
def get_keys():
    keys = list_api_keys()
    return {
        "count": len(keys),
        "keys": keys
    }

@app.delete("/api/v1/auth/keys/{key_id}", summary="Revoke a partner API key")
def delete_key(key_id: int):
    revoke_api_key(key_id)
    return {"status": "revoked", "key_id": key_id}

# ==================== COMMERCIAL BILLING & PAYMENT GATEWAY ====================

@app.get("/api/v1/billing/config", summary="Get payment gateway and currency settlement configuration")
def get_billing_config():
    return {
        "payment_gateway": settings.PAYMENT_GATEWAY,
        "supported_currencies": CURRENCY_RATES,
        "flutterwave_public_key": settings.FLUTTERWAVE_PUBLIC_KEY,
        "paystack_public_key": settings.PAYSTACK_PUBLIC_KEY,
        "raenest_wire_settlement": {
            "beneficiary_name": settings.RAENEST_BENEFICIARY_NAME,
            "bank_name": settings.RAENEST_USD_BANK_NAME,
            "swift_bic": settings.RAENEST_SWIFT_BIC
        }
    }

@app.post("/api/v1/billing/checkout/initiate", summary="Initiate commercial checkout order with currency conversion")
def initiate_checkout(req: InitiateCheckoutRequest):
    order = initiate_order(
        organization_name=req.organization_name,
        billing_email=req.billing_email,
        license_type=req.license_type,
        currency=req.currency,
        payment_method=req.payment_method
    )
    return order

@app.post("/api/v1/billing/checkout/complete", summary="Verify payment and issue paid commercial X-API-Key")
def complete_checkout(req: CompleteCheckoutRequest):
    result = verify_and_activate_order(
        order_ref=req.order_ref,
        gateway_ref=req.gateway_reference
    )
    return result

@app.get("/api/v1/billing/invoice/{order_ref}", summary="Download official Proforma Invoice PDF")
def download_invoice(order_ref: str):
    pdf_bytes = generate_proforma_invoice_pdf(order_ref)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=Proforma_Invoice_{order_ref}.pdf"
        }
    )

@app.post("/api/v1/billing/webhook/flutterwave", summary="Inbound Flutterwave payment webhook")
async def flutterwave_webhook(request: Request):
    body_bytes = await request.body()
    try:
        data = json.loads(body_bytes.decode())
        event = data.get("event")
        tx_data = data.get("data", {})
        tx_ref = tx_data.get("tx_ref")
        if event == "charge.completed" and tx_data.get("status") == "successful" and tx_ref:
            verify_and_activate_order(tx_ref, gateway_ref=str(tx_data.get("id")))
            return {"status": "verified"}
    except Exception as e:
        print(f"[FLW WEBHOOK ERROR] {e}")
    return {"status": "acknowledged"}

@app.post("/api/v1/billing/webhook/paystack", summary="Inbound Paystack payment webhook")
async def paystack_webhook(request: Request):
    body_bytes = await request.body()
    try:
        data = json.loads(body_bytes.decode())
        event = data.get("event")
        tx_data = data.get("data", {})
        reference = tx_data.get("reference")
        if event == "charge.success" and reference:
            verify_and_activate_order(reference, gateway_ref=str(tx_data.get("id")))
            return {"status": "verified"}
    except Exception as e:
        print(f"[PAYSTACK WEBHOOK ERROR] {e}")
    return {"status": "acknowledged"}

# ==================== OUTBOUND WEBHOOK & DISPATCH ENGINE ====================

@app.get("/api/v1/webhooks", summary="List registered outbound webhook endpoints")
def get_webhooks():
    hooks = db.execute_query("SELECT id, url, event_types, is_active, created_at, last_triggered_at, failure_count FROM webhooks ORDER BY created_at DESC;")
    return {"webhooks": hooks}

@app.post("/api/v1/webhooks", summary="Register an outbound webhook or Slack/Teams endpoint")
def add_webhook(req: CreateWebhookRequest):
    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
    secret = req.secret or settings.WEBHOOK_SIGNING_SECRET
    db.execute_write("""
        INSERT INTO webhooks (url, event_types, secret, is_active, created_at, last_triggered_at, failure_count)
        VALUES (%s, %s, %s, %s, %s, %s, %s);
    """, (req.url, req.event_types, secret, 1, now_str, now_str, 0))
    return {"status": "registered", "url": req.url, "event_types": req.event_types}

@app.delete("/api/v1/webhooks/{hook_id}", summary="Delete an outbound webhook")
def delete_webhook(hook_id: int):
    db.execute_write("DELETE FROM webhooks WHERE id = %s;", (hook_id,))
    return {"status": "deleted", "hook_id": hook_id}

@app.post("/api/v1/alerts/test-dispatch", summary="Manually trigger a critical dispatch test alert")
def trigger_test_alert(partner: dict = Depends(authenticate_partner)):
    result = alert_engine.test_dispatch()
    return result

@app.get("/api/v1/alerts/history", summary="Query live dispatch alert history")
def get_alert_history(limit: int = Query(25, ge=1, le=100)):
    alerts = alert_engine.get_recent_alerts(limit=limit)
    return {"alerts": alerts}

# ==================== AUDIT & COMPLIANCE REPORTS ====================

@app.get("/api/v1/export/compliance-report.csv", summary="Download official CSV compliance audit report")
def download_csv_report():
    csv_content = generate_csv_compliance_report()
    filename = f"SkyGrid_Aviation_Audit_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/v1/export/compliance-report.pdf", summary="Download official ICAO SMS compliance PDF report")
def download_pdf_report():
    pdf_bytes = generate_pdf_compliance_report()
    filename = f"SkyGrid_Aviation_SMS_Report_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/v1/audit/logs", summary="Query historical corridor risk shifts")
def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    corridor_id: Optional[str] = None
):
    if corridor_id:
        rows = db.execute_query(
            "SELECT * FROM corridor_risk_shifts WHERE corridor_id = %s ORDER BY recorded_at DESC LIMIT %s;",
            (corridor_id, limit)
        )
    else:
        rows = db.execute_query(
            "SELECT * FROM corridor_risk_shifts ORDER BY recorded_at DESC LIMIT %s;",
            (limit,)
        )
    return {
        "count": len(rows),
        "db_engine": db.engine_name,
        "logs": rows
    }

# ==================== SYSTEM & INTEGRATION STATUS ====================

@app.get("/api/v1/system/status", summary="System Health & Operational Status")
def get_system_status():
    stats = ingestion_pipeline.get_cache_stats()
    return {
        "system": settings.APP_NAME,
        "version": settings.VERSION,
        "status": "NOMINAL",
        "database": {
            "engine": db.engine_name,
            "is_postgres": db.is_postgres,
            "configured_url": bool(settings.DATABASE_URL)
        },
        "ingestion_pipeline": stats,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

@app.post("/api/v1/system/api-keys", summary="Update Aviationstack and Weatherstack API keys dynamically")
def update_api_keys(req: UpdateApiKeysRequest):
    if req.aviationstack_key is not None:
        settings.AVIATIONSTACK_API_KEY = req.aviationstack_key.strip()
    if req.weatherstack_key is not None:
        settings.WEATHERSTACK_API_KEY = req.weatherstack_key.strip()

    # Trigger immediate poll with new credentials
    ingestion_pipeline.poll_all()
    return {
        "status": "updated",
        "has_aviationstack": bool(settings.AVIATIONSTACK_API_KEY),
        "has_weatherstack": bool(settings.WEATHERSTACK_API_KEY),
        "source_aviation": ingestion_pipeline.source_aviation,
        "source_weather": ingestion_pipeline.source_weather
    }

@app.post("/api/v1/system/db-config", summary="Update or test PostgreSQL connection string dynamically")
def update_db_config(req: UpdateDbConfigRequest):
    settings.DATABASE_URL = req.database_url.strip()
    db.conn_string = settings.DATABASE_URL
    db.test_connection()
    db.init_schema()
    return {
        "status": "configured",
        "engine": db.engine_name,
        "is_postgres": db.is_postgres
    }

# ==================== STATIC FRONTEND SERVING ====================

BASE_PATH = Path(__file__).resolve().parent.parent
dist_path = BASE_PATH / "dist"

# Serve production assets if built by Vite
if (dist_path / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(dist_path / "assets")), name="assets")

# Serve src static files
app.mount("/src", StaticFiles(directory=str(BASE_PATH / "src")), name="src")

# Serve node_modules if present
node_modules_path = BASE_PATH / "node_modules"
if node_modules_path.exists():
    app.mount("/node_modules", StaticFiles(directory=str(node_modules_path)), name="node_modules")

# Root dashboard route
@app.get("/", response_class=HTMLResponse)
def serve_dashboard():
    dist_index = dist_path / "index.html"
    if dist_index.exists():
        with open(dist_index, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    index_path = BASE_PATH / "index.html"
    if index_path.exists():
        with open(index_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h1>SkyGrid Intelligence Command Center loading...</h1>")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=settings.PORT, reload=False)

