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

settings = Settings()

