import hmac
import hashlib
import json
import time
import datetime
import threading
import requests
from typing import Dict, Any, List, Optional
from backend.config import settings
from backend.database import db

class WebhookAndAlertEngine:
    def __init__(self):
        self.lock = threading.Lock()
        # Cooldown map: (flight_id, alert_type) -> last_dispatched_timestamp
        self.cooldown_map: Dict[str, float] = {}
        self.alert_history: List[Dict[str, Any]] = []

    def _generate_signature(self, payload_bytes: bytes, secret: str) -> str:
        return "sha256=" + hmac.new(
            secret.encode("utf-8"),
            payload_bytes,
            hashlib.sha256
        ).hexdigest()

    def dispatch_critical_alert(self, flight: dict, reason: str, details: str):
        """Triggers real-time alerts if threshold is breached and not in cooldown."""
        flight_id = flight["id"]
        key = f"{flight_id}:{reason}"
        now = time.time()

        with self.lock:
            last_sent = self.cooldown_map.get(key, 0)
            if now - last_sent < 180: # 3-minute cooldown per flight per alert type
                return
            self.cooldown_map[key] = now

        alert_id = f"ALT-{int(now)}-{flight['callsign'].replace(' ', '')}"
        alert_payload = {
            "alert_id": alert_id,
            "event": "risk_breach",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "corridor": "DXB AIR CORRIDOR (25.25°N, 55.36°E)",
            "flight": {
                "id": flight["id"],
                "callsign": flight["callsign"],
                "carrier": flight["carrier"],
                "aircraft": flight["aircraft"],
                "origin": flight["origin"],
                "destination": flight["destination"],
                "altitude": flight["altitude"],
                "flight_level": flight["flightLevel"],
                "speed_kts": flight["speed"],
                "heading": flight["heading"],
                "risk_score": flight["riskScore"],
                "risk_category": flight["riskCategory"]
            },
            "reason": reason,
            "details": details,
            "action_required": "Autonomous Vector Deconfliction or Immediate ATC Handshake"
        }

        # Send in background thread so it doesn't block
        threading.Thread(target=self._broadcast_webhooks, args=(alert_payload,), daemon=True).start()

    def dispatch_weather_anomaly(self, weather: dict, reason: str):
        now = time.time()
        key = f"WEATHER:{reason}"
        with self.lock:
            last_sent = self.cooldown_map.get(key, 0)
            if now - last_sent < 300: # 5-minute cooldown for general weather alerts
                return
            self.cooldown_map[key] = now

        alert_id = f"WX-{int(now)}"
        alert_payload = {
            "alert_id": alert_id,
            "event": "severe_weather",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "corridor": "DXB AIR CORRIDOR (25.25°N, 55.36°E)",
            "weather": weather,
            "reason": reason,
            "details": f"Windshear index of {weather.get('windshear_index_kts')} kts exceeds safety tolerance (15.0 kts).",
            "action_required": "Issue Windshear Advisories to Terminal Arrival Sequence"
        }

        threading.Thread(target=self._broadcast_webhooks, args=(alert_payload,), daemon=True).start()

    def dispatch_directive_executed(self, directive: dict):
        """Dispatches notification when AI Autonomous routing directive is executed."""
        now = time.time()
        alert_id = f"DIR-EXEC-{int(now)}"
        alert_payload = {
            "alert_id": alert_id,
            "event": "directive_executed",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "directive": directive,
            "action_required": "Log & Monitor Telemetry Trajectory"
        }
        threading.Thread(target=self._broadcast_webhooks, args=(alert_payload,), daemon=True).start()

    def _broadcast_webhooks(self, alert_payload: dict):
        event_type = alert_payload.get("event", "risk_breach")
        # Fetch active webhooks from database
        try:
            active_hooks = db.execute_query(
                "SELECT id, url, event_types, secret FROM webhooks WHERE is_active = 1;"
            )
        except Exception as e:
            print(f"[WEBHOOK DB ERROR] {e}")
            active_hooks = []

        payload_bytes = json.dumps(alert_payload).encode("utf-8")
        dispatched_channels = []

        # Deliver to configured endpoints
        for hook in active_hooks:
            url = hook["url"]
            events = hook.get("event_types", "").split(",")
            if event_type not in events and "all" not in events:
                continue

            secret = hook.get("secret") or settings.WEBHOOK_SIGNING_SECRET
            signature = self._generate_signature(payload_bytes, secret)
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "SkyGrid-Intelligence-Dispatch/4.9",
                "X-SkyGrid-Event": event_type,
                "X-SkyGrid-Signature": signature,
                "X-SkyGrid-Timestamp": str(int(time.time()))
            }

            try:
                # Format Slack compatible block if slack webhook
                target_payload = alert_payload
                if "slack.com" in url or "hooks.slack" in url:
                    target_payload = {
                        "text": f"🚨 [SkyGrid Intelligence] Airspace Risk Breach: {alert_payload.get('alert_id')}",
                        "attachments": [{
                            "color": "#EF4444" if event_type == "risk_breach" else "#F59E0B",
                            "title": f"Airspace Alert: {event_type.upper()}",
                            "text": alert_payload.get("details", ""),
                            "fields": [
                                {"title": "Corridor", "value": alert_payload.get("corridor", "DXB"), "short": True},
                                {"title": "Action", "value": alert_payload.get("action_required", "Monitor"), "short": True}
                            ]
                        }]
                    }
                    payload_bytes = json.dumps(target_payload).encode("utf-8")

                resp = requests.post(url, data=payload_bytes, headers=headers, timeout=5)
                dispatched_channels.append(f"{url} ({resp.status_code})")
                # Update last triggered
                now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
                db.execute_write(
                    "UPDATE webhooks SET last_triggered_at = %s WHERE id = %s;",
                    (now_str, hook["id"])
                )
            except Exception as e:
                dispatched_channels.append(f"{url} (FAILED: {e})")
                db.execute_write(
                    "UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = %s;",
                    (hook["id"],)
                )

        # Log alert to database
        channels_str = ", ".join(dispatched_channels) if dispatched_channels else "INTERNAL_DISPATCH_BUS"
        flight_info = alert_payload.get("flight", {})
        alert_record = {
            "id": alert_payload["alert_id"],
            "flight_id": flight_info.get("id", "AIRSPACE-CORRIDOR"),
            "callsign": flight_info.get("callsign", "CORRIDOR-HAZARD"),
            "alert_type": event_type.upper(),
            "severity": "CRITICAL" if event_type == "risk_breach" else "ELEVATED",
            "risk_score": float(flight_info.get("risk_score", 28.0)),
            "details": alert_payload.get("details", "Corridor Hazard Envelope Exceeded"),
            "dispatched_channels": channels_str,
            "status": "DELIVERED" if dispatched_channels else "QUEUED_INTERNAL"
        }

        with self.lock:
            self.alert_history.insert(0, alert_record)
            if len(self.alert_history) > 100:
                self.alert_history.pop()

        try:
            db.log_dispatch_alert(alert_record)
        except Exception as e:
            print(f"[DB LOG ALERT ERROR] {e}")

    def test_dispatch(self, test_url: Optional[str] = None) -> Dict[str, Any]:
        """Manually triggers a test alert dispatch."""
        test_flight = {
            "id": "SIM-882",
            "callsign": "EK-CARGO 882 (TEST)",
            "carrier": "Emirates SkyCargo",
            "aircraft": "Boeing 777-200LRF",
            "origin": "DXB",
            "destination": "ORD",
            "altitude": 32000,
            "flightLevel": "FL320",
            "speed": 490,
            "heading": 300,
            "riskScore": 32.4,
            "riskCategory": "elevated",
            "hazardNote": "Crosswind shear test boundary at waypoint DESIG."
        }
        self.dispatch_critical_alert(
            flight=test_flight,
            reason="OPERATIONAL_TEST_SIMULATION",
            details="Manual verification dispatch alert triggered from Enterprise Gateway."
        )
        return {
            "status": "success",
            "message": "Outbound dispatch broadcast initiated. Check webhook delivery logs.",
            "test_flight": test_flight["callsign"],
            "simulated_risk": 32.4
        }

    def get_recent_alerts(self, limit: int = 20) -> List[Dict[str, Any]]:
        # Query from database or memory
        try:
            rows = db.execute_query(
                "SELECT * FROM dispatch_alerts ORDER BY created_at DESC LIMIT %s;",
                (limit,)
            )
            if rows:
                return rows
        except Exception as e:
            print(f"[DB GET ALERTS ERROR] {e}")
        with self.lock:
            return self.alert_history[:limit]

alert_engine = WebhookAndAlertEngine()

