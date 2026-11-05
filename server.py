import sys
import uvicorn
from backend.config import settings

if __name__ == "__main__":
    print(f"================================================================")
    print(f"  SKYGRID INTELLIGENCE | ENTERPRISE AVIATION RISK COMMAND CENTER")
    print(f"  Akanno Tech Labs • Production B2B SaaS Platform")
    print(f"  Listening on: http://localhost:{settings.PORT}")
    print(f"  Swagger Docs: http://localhost:{settings.PORT}/api/docs")
    print(f"================================================================")
    sys.stdout.flush()
    uvicorn.run("backend.main:app", host="0.0.0.0", port=settings.PORT, log_level="info")
