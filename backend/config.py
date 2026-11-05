import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# Load simple .env if present
env_file = BASE_DIR / ".env"
if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ.setdefault(key.strip(), val.strip())

class Settings:
    # Service Metadata
    APP_NAME: str = "SkyGrid Intelligence Enterprise Gateway"
    ORGANIZATION: str = "Akanno Tech Labs"
    VERSION: str = "4.9.0-PROD"
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "3000"))

    # Database Configuration (PostgreSQL primary with automated SQLite fallback)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    SQLITE_PATH: Path = DATA_DIR / "skygrid_vault.db"

    # External Real-World Aviation & Meteorology API Keys
    AVIATIONSTACK_API_KEY: str = os.getenv("AVIATIONSTACK_API_KEY", "")
    WEATHERSTACK_API_KEY: str = os.getenv("WEATHERSTACK_API_KEY", "")
    
    # Ingestion & Polling Schedule (seconds)
    POLL_INTERVAL_SECONDS: int = int(os.getenv("POLL_INTERVAL_SECONDS", "60"))
    CACHE_TTL_SECONDS: int = int(os.getenv("CACHE_TTL_SECONDS", "60"))

    # Critical Risk Thresholds
    CORRIDOR_RISK_THRESHOLD: float = float(os.getenv("CORRIDOR_RISK_THRESHOLD", "25.0"))
    FLIGHT_RISK_THRESHOLD: float = float(os.getenv("FLIGHT_RISK_THRESHOLD", "25.0"))
    WINDSHEAR_THRESHOLD_KTS: float = float(os.getenv("WINDSHEAR_THRESHOLD_KTS", "15.0"))

    # Security & Webhook Signatures
    WEBHOOK_SIGNING_SECRET: str = os.getenv("WEBHOOK_SIGNING_SECRET", "skygrid_sec_8f99c27940e4ab91")
    DEFAULT_MASTER_KEY: str = os.getenv("DEFAULT_MASTER_KEY", "sk_live_akanno_sovereign_dxb_001")

    # Payment Gateway & Settlement Configuration (Flutterwave, Paystack, Raenest, Grey)
    PAYMENT_GATEWAY: str = os.getenv("PAYMENT_GATEWAY", "flutterwave")
    FLUTTERWAVE_PUBLIC_KEY: str = os.getenv("FLUTTERWAVE_PUBLIC_KEY", "FLWPUBK_TEST-94028371-X")
    FLUTTERWAVE_SECRET_KEY: str = os.getenv("FLUTTERWAVE_SECRET_KEY", "FLWSECK_TEST-94028371-X")
    PAYSTACK_PUBLIC_KEY: str = os.getenv("PAYSTACK_PUBLIC_KEY", "pk_test_akanno_sandbox_001")
    PAYSTACK_SECRET_KEY: str = os.getenv("PAYSTACK_SECRET_KEY", "sk_test_akanno_sandbox_001")

    # Global B2B Wire Transfer / Invoicing Vault (Raenest / Grey USD Corporate Settlement)
    RAENEST_BENEFICIARY_NAME: str = os.getenv("RAENEST_BENEFICIARY_NAME", "Akanno Tech Labs Ltd")
    RAENEST_USD_BANK_NAME: str = os.getenv("RAENEST_USD_BANK_NAME", "Lead Bank / Raenest Corp Banking")
    RAENEST_USD_ROUTING: str = os.getenv("RAENEST_USD_ROUTING", "101000695")
    RAENEST_USD_ACCOUNT: str = os.getenv("RAENEST_USD_ACCOUNT", "884920194821")
    RAENEST_SWIFT_BIC: str = os.getenv("RAENEST_SWIFT_BIC", "LEADUS33XXX")

settings = Settings()

