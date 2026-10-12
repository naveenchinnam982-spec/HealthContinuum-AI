"""
HealthContinuum AI — FastAPI Application Entry Point
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from app.api.routes import (
    auth,
    changes,
    companion,
    decisions,
    decision_memory,
    doctor_access,
    documents,
    labs,
    medications,
    patients,
    summary,
    visits,
)
from app.core.config import get_settings
from app.database.connection import AsyncSessionLocal, create_all_tables

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("healthcontinuum")

settings = get_settings()


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables. Shutdown: clean up."""
    logger.info("Starting HealthContinuum AI backend...")
    await create_all_tables()
    logger.info("Database tables verified.")

    # Render sets SEED_DEMO_DATA=true for the hackathon/demo environment.
    # Seed only the demo doctor account here; the seed function is idempotent
    # and never resets the password of an account that already exists.
    if os.getenv("SEED_DEMO_DATA", "false").strip().lower() in {"1", "true", "yes"}:
        try:
            from seed import seed_doctor

            async with AsyncSessionLocal() as db:
                await seed_doctor(db)
            logger.info("Demo doctor account seed checked.")
        except Exception:
            logger.exception("Demo doctor seeding failed; authentication will require a provisioned doctor account.")

    yield
    logger.info("HealthContinuum AI backend shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="HealthContinuum AI",
    description=(
        "Understand what changed. Know why. Close the gap.\n\n"
        "Backend API for the patient-facing health continuity platform."
    ),
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred. Please try again.",
            },
        },
    )


# ── Routers ───────────────────────────────────────────────────────────────────
API_PREFIX = "/api"

app.include_router(auth.router,           prefix=API_PREFIX)
app.include_router(patients.router,       prefix=API_PREFIX)
app.include_router(visits.router,         prefix=API_PREFIX)
app.include_router(documents.router,      prefix=API_PREFIX)
app.include_router(medications.router,    prefix=API_PREFIX)
app.include_router(labs.router,           prefix=API_PREFIX)
app.include_router(changes.router,        prefix=API_PREFIX)
app.include_router(decisions.router,      prefix=API_PREFIX)
app.include_router(decision_memory.router, prefix=API_PREFIX)
app.include_router(doctor_access.router,  prefix=API_PREFIX)
app.include_router(summary.router,        prefix=API_PREFIX)
app.include_router(companion.router,      prefix=API_PREFIX)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["system"])
async def health_check():
    return {
        "success": True,
        "data": {
            "status": "ok",
            "app": settings.app_name,
            "env": settings.app_env,
            "version": "1.0.0",
        },
        "message": "HealthContinuum AI backend is running",
    }


from fastapi.staticfiles import StaticFiles

FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent  # .../maruthi/Health
MARUTHI_ROOT = FRONTEND_DIR.parent                             # .../maruthi
WORKSPACE_ROOT = MARUTHI_ROOT.parent                          # .../Downloads/maruthi
DOCTOR_DIST_DIR = WORKSPACE_ROOT / "doctorsdashboard-main" / "dist"
PORTAL_PATH = MARUTHI_ROOT / "healthcontinuum.html"

NO_CACHE_HEADERS = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
}

# Mount doctor dashboard assets if built
if (DOCTOR_DIST_DIR / "assets").exists():
    app.mount("/doctor/assets", StaticFiles(directory=str(DOCTOR_DIST_DIR / "assets")), name="doctor_assets")

if (FRONTEND_DIR / "assets").exists():
    app.mount("/patient/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="patient_assets")


@app.get("/assets/{file_path:path}", include_in_schema=False)
async def serve_root_assets(file_path: str):
    # Check doctor dist assets first
    doc_asset = DOCTOR_DIST_DIR / "assets" / file_path
    if doc_asset.exists():
        media_type = "text/css" if file_path.endswith(".css") else ("application/javascript" if file_path.endswith(".js") else None)
        return FileResponse(doc_asset, media_type=media_type, headers=NO_CACHE_HEADERS)
    # Check patient assets
    patient_asset = FRONTEND_DIR / "assets" / file_path
    if patient_asset.exists():
        return FileResponse(patient_asset, headers=NO_CACHE_HEADERS)
    return JSONResponse(status_code=404, content={"message": "Asset not found"})



# ── Unified Portal (Landing Page) ─────────────────────────────────────────────
@app.get("/", include_in_schema=False)
@app.get("/portal", include_in_schema=False)
async def serve_unified_portal():
    if PORTAL_PATH.exists():
        return FileResponse(PORTAL_PATH, media_type="text/html", headers=NO_CACHE_HEADERS)
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path, headers=NO_CACHE_HEADERS)
    return {
        "app": "HealthContinuum AI",
        "docs": "/api/docs",
        "health": "/api/health",
        "patient": "/patient",
        "doctor": "/doctor",
    }


# ── Patient App Routes ────────────────────────────────────────────────────────
@app.get("/patient", include_in_schema=False)
@app.get("/patient/{full_path:path}", include_in_schema=False)
async def serve_patient_app(full_path: str = ""):
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path, media_type="text/html", headers=NO_CACHE_HEADERS)
    return JSONResponse(status_code=404, content={"message": "Patient app not found"})


# ── Doctor Dashboard Routes (SPA) ─────────────────────────────────────────────
@app.get("/doctor", include_in_schema=False)
@app.get("/doctor/{full_path:path}", include_in_schema=False)
async def serve_doctor_dashboard(full_path: str = ""):
    doctor_index = DOCTOR_DIST_DIR / "index.html"
    if doctor_index.exists():
        return FileResponse(doctor_index, media_type="text/html", headers=NO_CACHE_HEADERS)
    return JSONResponse(
        status_code=404,
        content={"message": "Doctor dashboard dist bundle not found. Please run 'npm run build' in doctorsdashboard-main directory."},
    )


# ── Direct Patient App Static Assets ──────────────────────────────────────────
@app.get("/styles.css", include_in_schema=False)
async def serve_styles():
    return FileResponse(FRONTEND_DIR / "styles.css", media_type="text/css", headers=NO_CACHE_HEADERS)


@app.get("/app.js", include_in_schema=False)
async def serve_app_js():
    return FileResponse(FRONTEND_DIR / "app.js", media_type="application/javascript", headers=NO_CACHE_HEADERS)


@app.get("/api.js", include_in_schema=False)
async def serve_api_js():
    return FileResponse(FRONTEND_DIR / "api.js", media_type="application/javascript", headers=NO_CACHE_HEADERS)


@app.get("/firebase-config.js", include_in_schema=False)
async def serve_firebase_config_js():
    return FileResponse(FRONTEND_DIR / "firebase-config.js", media_type="application/javascript", headers=NO_CACHE_HEADERS)


@app.get("/firebase-service.js", include_in_schema=False)
async def serve_firebase_service_js():
    return FileResponse(FRONTEND_DIR / "firebase-service.js", media_type="application/javascript", headers=NO_CACHE_HEADERS)


@app.get("/firebase-config.json", include_in_schema=False)
async def serve_firebase_config_json():
    return FileResponse(FRONTEND_DIR / "firebase-config.json", media_type="application/json", headers=NO_CACHE_HEADERS)


@app.get("/verify-firebase.html", include_in_schema=False)
async def serve_verify_firebase_html():
    return FileResponse(FRONTEND_DIR / "verify-firebase.html", media_type="text/html", headers=NO_CACHE_HEADERS)


