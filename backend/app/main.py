import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app import database
from app.config import get_settings
from app.routes import chat, study_packs

logging.basicConfig(level=logging.INFO)
settings = get_settings()

@asynccontextmanager
async def lifespan(_: FastAPI):
    database.init_db()
    yield

app = FastAPI(
    title="NHEWRON API",
    description="Learning workspace API and Ron AI chat service.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(chat.router)
app.include_router(study_packs.router)

@app.get("/", tags=["system"])
async def root() -> dict[str, str]:
    return {"name": "NHEWRON API", "status": "ok", "docs": "/docs"}

@app.get("/api/health", tags=["system"])
async def health() -> dict[str, str | bool]:
    return {
        "status": "ok",
        "groq_configured": bool(settings.groq_api_key.strip()),
        "model": settings.groq_model,
    }
