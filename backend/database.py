import os
import sqlite3
import datetime
import hashlib
import json
from typing import List, Dict, Any, Optional
from backend.config import settings

# Attempt PostgreSQL driver import
try:
    import psycopg
    from psycopg.rows import dict_row
    HAS_POSTGRES = True
except ImportError:
    HAS_POSTGRES = False

class DatabaseManager:
    def __init__(self):
        self.is_postgres = False
        self.conn_string = settings.DATABASE_URL
        self.engine_name = "SQLite (Local Vault)"
        self.test_connection()
        self.init_schema()
        self.seed_defaults()

    def test_connection(self):
        """Attempts connection to PostgreSQL if configured, otherwise falls back to SQLite."""
        if self.conn_string and HAS_POSTGRES:
            try:
                with psycopg.connect(self.conn_string, autocommit=True) as conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT 1;")
                self.is_postgres = True
                self.engine_name = "PostgreSQL (Enterprise Live)"
                print(f"[DB] Connected successfully to PostgreSQL at {self.conn_string.split('@')[-1] if '@' in self.conn_string else 'configured endpoint'}")
                return
            except Exception as e:
                print(f"[DB WARNING] Could not connect to PostgreSQL ({e}). Falling back to persistent SQLite vault.")

        self.is_postgres = False
        self.engine_name = "SQLite (Local Vault)"
        print(f"[DB] Initialized persistent SQLite vault at {settings.SQLITE_PATH}")

    def get_connection(self):
        if self.is_postgres:
            return psycopg.connect(self.conn_string, row_factory=dict_row, autocommit=True)
        else:
            conn = sqlite3.connect(str(settings.SQLITE_PATH), timeout=30.0)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL;")
            return conn

    def init_schema(self):
        """Initializes tables for either PostgreSQL or SQLite with identical schema definitions."""
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            id_type = "SERIAL PRIMARY KEY" if self.is_postgres else "INTEGER PRIMARY KEY AUTOINCREMENT"
            ts_type = "TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP" if self.is_postgres else "DATETIME DEFAULT CURRENT_TIMESTAMP"
            bool_type = "BOOLEAN" if self.is_postgres else "INTEGER"

            # 1. Corridor Risk Shifts
            cur.execute(f"""
            CREATE TABLE IF NOT EXISTS corridor_risk_shifts (
                id {id_type},
                corridor_id VARCHAR(64) NOT NULL,
                corridor_name VARCHAR(128) NOT NULL,
                risk_index REAL NOT NULL,
                active_vectors INTEGER NOT NULL,
                throughput_tonnes REAL NOT NULL,
                directives_count INTEGER NOT NULL,
                hazard_status VARCHAR(64) NOT NULL,
                weather_note TEXT,
                recorded_at {ts_type}
            );
            """)

            # 2. Flight Telemetry History
            cur.execute(f"""
            CREATE TABLE IF NOT EXISTS flight_telemetry_history (
                id {id_type},
                flight_id VARCHAR(64) NOT NULL,
                callsign VARCHAR(64) NOT NULL,
                carrier VARCHAR(128) NOT NULL,
                aircraft VARCHAR(64) NOT NULL,
                origin VARCHAR(32) NOT NULL,
                destination VARCHAR(32) NOT NULL,
                altitude INTEGER NOT NULL,
                flight_level VARCHAR(32) NOT NULL,
                speed INTEGER NOT NULL,
                mach REAL NOT NULL,
                heading INTEGER NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                risk_score REAL NOT NULL,
                risk_category VARCHAR(32) NOT NULL,
                status VARCHAR(64) NOT NULL,
                cargo_payload TEXT,
                cargo_weight_tonnes REAL,
                hazard_note TEXT,
                recorded_at {ts_type}
            );
            """)

            # 3. Routing Directives Audit
            cur.execute(f"""
            CREATE TABLE IF NOT EXISTS routing_directives_audit (
                id {id_type},
                directive_id VARCHAR(64) UNIQUE NOT NULL,
                flight_id VARCHAR(64) NOT NULL,
                callsign VARCHAR(64) NOT NULL,
                action VARCHAR(64) NOT NULL,
                description TEXT NOT NULL,
                risk_reduction REAL NOT NULL,
                confidence REAL NOT NULL,
                status VARCHAR(32) NOT NULL,
                triggered_by VARCHAR(64) DEFAULT 'AI_AUTONOMOUS_ENGINE',
                created_at {ts_type}
            );
            """)

            # 4. API Keys & Multi-Tenant Commercial Licenses (Zero Free Tier)
            cur.execute(f"""
            CREATE TABLE IF NOT EXISTS api_keys (
                id {id_type},
                key_hash VARCHAR(128) UNIQUE NOT NULL,
                key_prefix VARCHAR(32) NOT NULL,
                name VARCHAR(128) NOT NULL,
                tier VARCHAR(32) NOT NULL,
                rate_limit_rpm INTEGER NOT NULL,
                is_active {bool_type} DEFAULT 1,
                is_paid_enterprise {bool_type} DEFAULT 1,
                license_type VARCHAR(64) NOT NULL,
                license_id VARCHAR(64) NOT NULL,
                monthly_fee_usd INTEGER NOT NULL,
                sla_uptime VARCHAR(32) DEFAULT '99.9%',
                created_at {ts_type},
                last_used_at {ts_type},
                total_requests INTEGER DEFAULT 0
            );
            """)

            # 5. Outbound Webhook Endpoints
            cur.execute(f"""
            CREATE TABLE IF NOT EXISTS webhooks (
                id {id_type},
                url VARCHAR(512) NOT NULL,
                event_types TEXT NOT NULL,
                secret VARCHAR(128) NOT NULL,
                is_active {bool_type} DEFAULT 1,
                created_at {ts_type},
                last_triggered_at {ts_type},
                failure_count INTEGER DEFAULT 0
            );
            """)

            # 6. Live Dispatch Alerts
            cur.execute(f"""
            CREATE TABLE IF NOT EXISTS dispatch_alerts (
                id {id_type},
                alert_id VARCHAR(64) UNIQUE NOT NULL,
                flight_id VARCHAR(64) NOT NULL,
                callsign VARCHAR(64) NOT NULL,
                alert_type VARCHAR(64) NOT NULL,
                severity VARCHAR(32) NOT NULL,
                risk_score REAL NOT NULL,
                details TEXT NOT NULL,
                dispatched_channels TEXT NOT NULL,
                status VARCHAR(32) DEFAULT 'DISPATCHED',
                created_at {ts_type}
            );
            """)

            # Migration guard for commercial license columns
            for col, col_def in [
                ("is_paid_enterprise", "INTEGER DEFAULT 1"),
                ("license_type", "VARCHAR(64) DEFAULT 'regional_hub'"),
                ("license_id", "VARCHAR(64) DEFAULT 'LIC-ENTERPRISE-2026'"),
                ("monthly_fee_usd", "INTEGER DEFAULT 2500"),
                ("sla_uptime", "VARCHAR(32) DEFAULT '99.9%'")
            ]:
                try:
                    cur.execute(f"ALTER TABLE api_keys ADD COLUMN {col} {col_def};")
                except Exception:
                    pass

            if not self.is_postgres:
                conn.commit()
        finally:
            conn.close()

    def seed_defaults(self):
        """Seeds initial default API keys and historical data if table is empty."""
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            # Check API keys
            cur.execute("SELECT COUNT(*) as cnt FROM api_keys;")
            row = cur.fetchone()
            count = row["cnt"] if isinstance(row, dict) else row[0]
            if count == 0:
                def hash_key(k: str) -> str:
                    return hashlib.sha256(k.encode("utf-8")).hexdigest()

                now = datetime.datetime.now(datetime.timezone.utc).isoformat()
                keys_to_seed = [
                    (
                        hash_key("sk_live_akanno_sovereign_dxb_001"),
                        "sk_live_sov_akan...",
                        "Akanno Tech Labs (Sovereign Defense Master)",
                        "sovereign_defense",
                        3000,
                        1,
                        1,
                        "Sovereign Airspace & Defense License",
                        "LIC-SOV-2026-AKANNO-001",
                        25000,
                        "99.999% Dedicated",
                        now,
                        now,
                        0
                    ),
                    (
                        hash_key("sk_live_ek_cargo_dispatch_772"),
                        "sk_live_glo_ekca...",
                        "Emirates SkyCargo Dispatch Operations",
                        "global_cargo_carrier",
                        500,
                        1,
                        1,
                        "Global Cargo Carrier License",
                        "LIC-GLO-2026-EK-772",
                        7500,
                        "99.99%",
                        now,
                        now,
                        0
                    ),
                    (
                        hash_key("sk_live_fdx_global_route_890"),
                        "sk_live_reg_fdxg...",
                        "FedEx Express Gulf Regional Hub",
                        "regional_hub",
                        120,
                        1,
                        1,
                        "Regional Hub License",
                        "LIC-REG-2026-FDX-890",
                        2500,
                        "99.9%",
                        now,
                        now,
                        0
                    )
                ]

                for item in keys_to_seed:
                    cur.execute("""
                        INSERT INTO api_keys 
                        (key_hash, key_prefix, name, tier, rate_limit_rpm, is_active, is_paid_enterprise, license_type, license_id, monthly_fee_usd, sla_uptime, created_at, last_used_at, total_requests)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                    """ if not self.is_postgres else """
                        INSERT INTO api_keys 
                        (key_hash, key_prefix, name, tier, rate_limit_rpm, is_active, is_paid_enterprise, license_type, license_id, monthly_fee_usd, sla_uptime, created_at, last_used_at, total_requests)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                    """, item)

            # Check webhooks
            cur.execute("SELECT COUNT(*) as cnt FROM webhooks;")
            row = cur.fetchone()
            w_count = row["cnt"] if isinstance(row, dict) else row[0]
            if w_count == 0:
                now = datetime.datetime.now(datetime.timezone.utc).isoformat()
                sample_hook = (
                    "https://dispatch.akannotechlabs.internal/api/v1/aviation/alerts",
                    "risk_breach,severe_weather,directive_executed",
                    settings.WEBHOOK_SIGNING_SECRET,
                    1,
                    now,
                    now,
                    0
                )
                cur.execute("""
                    INSERT INTO webhooks (url, event_types, secret, is_active, created_at, last_triggered_at, failure_count)
                    VALUES (?, ?, ?, ?, ?, ?, ?);
                """ if not self.is_postgres else """
                    INSERT INTO webhooks (url, event_types, secret, is_active, created_at, last_triggered_at, failure_count)
                    VALUES (%s, %s, %s, %s, %s, %s, %s);
                """, sample_hook)

            if not self.is_postgres:
                conn.commit()
        finally:
            conn.close()

    # Query Helpers
    def execute_query(self, query: str, params: tuple = ()) -> List[Dict[str, Any]]:
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            sql = query if self.is_postgres else query.replace("%s", "?")
            cur.execute(sql, params)
            if cur.description:
                columns = [desc[0] for desc in cur.description]
                rows = cur.fetchall()
                if self.is_postgres:
                    return [dict(r) for r in rows]
                else:
                    return [dict(zip(columns, r)) for r in rows]
            return []
        finally:
            conn.close()

    def execute_write(self, query: str, params: tuple = ()) -> int:
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            sql = query if self.is_postgres else query.replace("%s", "?")
            cur.execute(sql, params)
            if not self.is_postgres:
                conn.commit()
            return cur.rowcount
        finally:
            conn.close()

    # Domain methods
    def log_corridor_shift(self, shift_data: dict):
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        params = (
            shift_data["corridor_id"],
            shift_data["corridor_name"],
            shift_data["risk_index"],
            shift_data["active_vectors"],
            shift_data["throughput_tonnes"],
            shift_data["directives_count"],
            shift_data["hazard_status"],
            shift_data.get("weather_note", ""),
            now
        )
        self.execute_write("""
            INSERT INTO corridor_risk_shifts
            (corridor_id, corridor_name, risk_index, active_vectors, throughput_tonnes, directives_count, hazard_status, weather_note, recorded_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
        """, params)

    def log_flight_telemetry(self, flight: dict):
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        params = (
            flight["id"],
            flight["callsign"],
            flight["carrier"],
            flight["aircraft"],
            flight["origin"],
            flight["destination"],
            int(flight["altitude"]),
            flight["flightLevel"],
            int(flight["speed"]),
            float(flight.get("mach", 0.8)),
            int(flight["heading"]),
            float(flight["lat"]),
            float(flight["lng"]),
            float(flight["riskScore"]),
            flight["riskCategory"],
            flight["status"],
            flight.get("cargoPayload", ""),
            float(flight.get("cargoWeightTonnes", 70.0)),
            flight.get("hazardNote", ""),
            now
        )
        self.execute_write("""
            INSERT INTO flight_telemetry_history
            (flight_id, callsign, carrier, aircraft, origin, destination, altitude, flight_level, speed, mach, heading, lat, lng, risk_score, risk_category, status, cargo_payload, cargo_weight_tonnes, hazard_note, recorded_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """, params)

    def log_directive(self, directive: dict):
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        params = (
            directive["id"],
            directive["flightId"],
            directive["callsign"],
            directive["action"],
            directive["description"],
            float(directive["riskReduction"]),
            float(directive["confidence"]),
            directive["status"],
            directive.get("triggered_by", "AI_AUTONOMOUS_ENGINE"),
            now
        )
        self.execute_write("""
            INSERT INTO routing_directives_audit
            (directive_id, flight_id, callsign, action, description, risk_reduction, confidence, status, triggered_by, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """, params)

    def log_dispatch_alert(self, alert: dict):
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        params = (
            alert["id"],
            alert["flight_id"],
            alert["callsign"],
            alert["alert_type"],
            alert["severity"],
            float(alert["risk_score"]),
            alert["details"],
            alert["dispatched_channels"],
            alert.get("status", "DISPATCHED"),
            now
        )
        self.execute_write("""
            INSERT INTO dispatch_alerts
            (alert_id, flight_id, callsign, alert_type, severity, risk_score, details, dispatched_channels, status, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """, params)

db = DatabaseManager()
