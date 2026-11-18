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

    # Security & Administrative Authorization
    WEBHOOK_SIGNING_SECRET: str = os.getenv("WEBHOOK_SIGNING_SECRET", "")
    ADMIN_API_SECRET: str = os.getenv("SKYGRID_ADMIN_SECRET", "")
    DEMO_EVALUATION_KEY: str = os.getenv("DEMO_EVALUATION_KEY", "sk_demo_skygrid_evaluation_001")
    DEFAULT_MASTER_KEY: str = os.getenv("DEFAULT_MASTER_KEY", "sk_demo_skygrid_evaluation_001")

    # Payment Gateway & Settlement Configuration (Disabled by default until verified merchant onboarding)
    ENABLE_LIVE_BILLING: bool = os.getenv("ENABLE_LIVE_BILLING", "false").lower() == "true"
    PAYMENT_GATEWAY: str = os.getenv("PAYMENT_GATEWAY", "paystack")
    FLUTTERWAVE_PUBLIC_KEY: str = os.getenv("FLUTTERWAVE_PUBLIC_KEY", "")
    FLUTTERWAVE_SECRET_KEY: str = os.getenv("FLUTTERWAVE_SECRET_KEY", "")
    FLUTTERWAVE_WEBHOOK_HASH: str = os.getenv("FLUTTERWAVE_WEBHOOK_HASH", "")
    PAYSTACK_PUBLIC_KEY: str = os.getenv("PAYSTACK_PUBLIC_KEY", "")
    PAYSTACK_SECRET_KEY: str = os.getenv("PAYSTACK_SECRET_KEY", "")

    # Corporate Settlement Details (Configured only via verified environment variables — never hardcoded)
    CORPORATE_BENEFICIARY_NAME: str = os.getenv("CORPORATE_BENEFICIARY_NAME", "Akanno Tech Labs Limited")
    CORPORATE_BANK_NAME: str = os.getenv("CORPORATE_BANK_NAME", "")
    CORPORATE_ROUTING_NUMBER: str = os.getenv("CORPORATE_ROUTING_NUMBER", "")
    CORPORATE_ACCOUNT_NUMBER: str = os.getenv("CORPORATE_ACCOUNT_NUMBER", "")
    CORPORATE_SWIFT_BIC: str = os.getenv("CORPORATE_SWIFT_BIC", "")

    @property
    def BILLING_LIVE_ENABLED(self) -> bool:
        if not self.ENABLE_LIVE_BILLING:
            return False
        gw = self.PAYMENT_GATEWAY.lower().strip()
        if gw == "paystack":
            return bool(self.PAYSTACK_SECRET_KEY and self.PAYSTACK_PUBLIC_KEY)
        if gw == "flutterwave":
            return bool(self.FLUTTERWAVE_SECRET_KEY and self.FLUTTERWAVE_PUBLIC_KEY and self.FLUTTERWAVE_WEBHOOK_HASH)
        return False

settings = Settings()

