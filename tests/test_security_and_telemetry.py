"""
SkyGrid Intelligence — Automated Regression Test Suite
Covers:
1. Enterprise Billing & Access Control Security (zero unauthenticated key minting, zero fake paid status)
2. Signed Webhook Verification & Live Billing Safety Guards
3. Simulated Aircraft Telemetry Integrity & Mandatory Simulation Mode Indicators
4. Commercial Enquiry Persistence
"""
import hashlib
import hmac
import json
import unittest
from fastapi.testclient import TestClient

from backend.main import app
from backend.config import settings
from backend.billing import verify_paystack_signature, verify_flutterwave_signature


class SkyGridSecurityAndTelemetryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_billing_config_is_provisional_and_has_no_fake_bank_details(self):
        res = self.client.get("/api/v1/billing/config")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertFalse(body["live_payments_enabled"])
        self.assertEqual(body["billing_mode"], "PROVISIONAL_ENQUIRY_ONLY")
        raw_text = json.dumps(body)
        for forbidden in ("101000695", "884920194821", "LEADUS33XXX", "FLWSECK", "sk_test_"):
            self.assertNotIn(forbidden, raw_text)

    def test_public_unauthenticated_api_key_minting_is_blocked(self):
        res = self.client.post(
            "/api/v1/auth/keys",
            json={
                "name": "Unauthorized Visitor",
                "license_type": "sovereign_defense",
                "is_paid_enterprise": True
            }
        )
        self.assertEqual(res.status_code, 403)

    def test_public_key_revocation_is_blocked(self):
        res = self.client.delete("/api/v1/auth/keys/1")
        self.assertEqual(res.status_code, 403)

    def test_sensitive_mutation_and_invoice_endpoints_require_admin_auth(self):
        self.assertEqual(
            self.client.post("/api/v1/webhooks", json={"url": "https://example.com/hook"}).status_code,
            403
        )
        self.assertEqual(self.client.delete("/api/v1/webhooks/1").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/billing/invoice/ORD-SKY-123456").status_code, 403)
        self.assertEqual(
            self.client.post("/api/v1/system/api-keys", json={"aviationstack_key": "x"}).status_code,
            403
        )
        self.assertEqual(
            self.client.post("/api/v1/system/db-config", json={"database_url": "sqlite:///x.db"}).status_code,
            403
        )

    def test_checkout_initiation_and_client_completion_are_blocked_when_live_disabled(self):
        res_init = self.client.post(
            "/api/v1/billing/checkout/initiate",
            json={
                "organization_name": "Test Airline",
                "billing_email": "ops@testairline.example",
                "license_type": "regional_hub",
                "currency": "USD",
                "payment_method": "card"
            }
        )
        self.assertEqual(res_init.status_code, 503)

        res_complete = self.client.post(
            "/api/v1/billing/checkout/complete",
            json={"order_ref": "ORD-SKY-FAKE", "gateway_reference": "SIM-123"}
        )
        self.assertEqual(res_complete.status_code, 403)

    def test_demo_key_cannot_bypass_paid_enterprise_guard(self):
        res = self.client.get(
            "/api/v1/enterprise/protected-status",
            headers={"x-api-key": settings.DEMO_EVALUATION_KEY}
        )
        self.assertEqual(res.status_code, 402)

    def test_referer_spoofing_cannot_grant_paid_enterprise_access(self):
        res = self.client.get(
            "/api/v1/enterprise/protected-status",
            headers={"Referer": "http://localhost:3000/dashboard"}
        )
        self.assertEqual(res.status_code, 401)

    def test_keys_list_contains_no_fake_paid_customers(self):
        res = self.client.get("/api/v1/auth/keys")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertFalse(data["live_payments_enabled"])
        self.assertFalse(data["public_key_minting_enabled"])
        for k in data["keys"]:
            self.assertFalse(bool(k["is_paid_enterprise"]), f"Unexpected paid key in demo DB: {k}")
            self.assertNotEqual(k["subscription_status"], "VERIFIED_PAID")

    def test_webhook_signature_verifiers(self):
        orig_ps = settings.PAYSTACK_SECRET_KEY
        orig_fw = settings.FLUTTERWAVE_WEBHOOK_HASH
        try:
            settings.PAYSTACK_SECRET_KEY = "ps_test_secret_unit"
            payload = b'{"event":"charge.success","data":{"reference":"ORD-1"}}'
            valid_sig = hmac.new(b"ps_test_secret_unit", payload, hashlib.sha512).hexdigest()
            self.assertTrue(verify_paystack_signature(payload, valid_sig))
            self.assertFalse(verify_paystack_signature(payload, "forged_sig"))
            self.assertFalse(verify_paystack_signature(payload, None))

            settings.FLUTTERWAVE_WEBHOOK_HASH = "fw_hash_unit"
            self.assertTrue(verify_flutterwave_signature("fw_hash_unit"))
            self.assertFalse(verify_flutterwave_signature("wrong_hash"))
        finally:
            settings.PAYSTACK_SECRET_KEY = orig_ps
            settings.FLUTTERWAVE_WEBHOOK_HASH = orig_fw

    def test_enterprise_enquiry_submission(self):
        res = self.client.post(
            "/api/v1/enquiries",
            json={
                "full_name": "Aviation Test Director",
                "organization": "Evaluation Carrier",
                "email": "director@evalcarrier.example",
                "interest_tier": "global_cargo_carrier",
                "message": "Requesting technical licensing briefing."
            }
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["status"], "RECEIVED")
        self.assertTrue(body["enquiry_ref"].startswith("ENQ-SKY-"))

    def test_flight_telemetry_returns_14_simulated_tracks_with_history_and_disclaimer(self):
        res = self.client.get(
            "/api/v1/telemetry/flights",
            headers={"x-api-key": settings.DEMO_EVALUATION_KEY}
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertTrue(body["is_simulation_mode"])
        self.assertEqual(body["data_mode"], "SIMULATION_MODE")
        self.assertIn("SIMULATED TRAFFIC", body["disclaimer"])
        self.assertGreaterEqual(body["count"], 10)
        self.assertLessEqual(body["count"], 20)

        for f in body["flights"]:
            self.assertTrue(f.get("isSimulated"), f"Flight {f.get('callsign')} missing isSimulated flag")
            self.assertTrue(f.get("icao24"), f"Flight {f.get('callsign')} missing icao24")
            self.assertGreaterEqual(f["lat"], 24.0)
            self.assertLessEqual(f["lat"], 26.5)
            self.assertGreaterEqual(f["lng"], 54.0)
            self.assertLessEqual(f["lng"], 57.0)
            self.assertIsInstance(f.get("vectorHistory"), list)
            self.assertGreaterEqual(len(f["vectorHistory"]), 2)


if __name__ == "__main__":
    unittest.main()
