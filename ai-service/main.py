"""
Speci-Index AI Service
Species identification, image validation, and anti-cheat detection.
"""

import os
import io
import base64
import logging
import asyncio
from contextlib import asynccontextmanager
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.species_identifier import SpeciesIdentifier
from services.image_validator import ImageValidator
from services.fraud_detector import FraudDetector

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global model instances
identifier: Optional[SpeciesIdentifier] = None
validator: Optional[ImageValidator] = None
fraud_detector: Optional[FraudDetector] = None

# Self-ping task to prevent Render free tier sleep (every 14 min)
async def self_ping():
    import httpx
    render_url = os.getenv("RENDER_EXTERNAL_URL")
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    interval_render = 14 * 60   # 14 minutes
    interval_supabase = 2 * 60 * 60  # 2 hours
    tick = 0
    while True:
        await asyncio.sleep(interval_render)
        tick += 1
        # Ping self (Render keep-alive)
        if render_url:
            try:
                async with httpx.AsyncClient() as c:
                    r = await c.get(f"{render_url}/health", timeout=10)
                    logger.info(f"Self-ping: {r.status_code}")
            except Exception as e:
                logger.warning(f"Self-ping failed: {e}")
        # Ping Supabase every ~2 hours (every 8th tick at 14-min intervals ≈ 112 min)
        if tick % 8 == 0 and supabase_url and supabase_key:
            try:
                async with httpx.AsyncClient() as c:
                    r = await c.get(
                        f"{supabase_url}/rest/v1/",
                        headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"},
                        timeout=10,
                    )
                    logger.info(f"Supabase ping: {r.status_code}")
            except Exception as e:
                logger.warning(f"Supabase ping failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global identifier, validator, fraud_detector
    logger.info("Loading AI models...")
    identifier = SpeciesIdentifier()
    validator = ImageValidator()
    fraud_detector = FraudDetector()
    logger.info("AI models loaded successfully")
    # Start self-ping background task
    ping_task = asyncio.create_task(self_ping())
    yield
    ping_task.cancel()
    logger.info("Shutting down AI service")


app = FastAPI(
    title="Speci-Index AI Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("ALLOWED_ORIGIN", "http://localhost:3000")],
    allow_methods=["POST"],
    allow_headers=["*"],
)

API_KEY = os.getenv("AI_SERVICE_API_KEY", "dev-key")


async def verify_api_key(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.split(" ", 1)[1]
    if token != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


class IdentifyRequest(BaseModel):
    image: str  # base64 encoded


class SpeciesResult(BaseModel):
    scientificName: str
    commonName: str
    confidence: float
    category: str
    conservationStatus: Optional[str] = None
    habitat: Optional[str] = None
    regions: list[str] = []
    description: Optional[str] = None
    observationCount: Optional[int] = None


class IdentifyResponse(BaseModel):
    species: Optional[SpeciesResult] = None
    confidence: float = 0.0
    isHuman: bool = False
    isTree: bool = False
    isAIGenerated: bool = False
    qualityScore: float = 0.0
    rejectionReason: Optional[str] = None


class ValidateRequest(BaseModel):
    image: str
    perceptualHash: Optional[str] = None


class ValidateResponse(BaseModel):
    isValid: bool
    qualityScore: float
    isBlurry: bool = False
    isDark: bool = False
    isCropped: bool = False
    isScreenshot: bool = False
    isAIGenerated: bool = False
    perceptualHash: str = ""
    rejectionReason: Optional[str] = None


@app.get("/health")
async def health():
    return {"status": "ok", "models_loaded": identifier is not None}


@app.post("/identify", response_model=IdentifyResponse, dependencies=[Depends(verify_api_key)])
async def identify_species(request: IdentifyRequest):
    try:
        image_bytes = base64.b64decode(request.image)

        # Step 1: Validate image quality
        quality = validator.validate(image_bytes)
        if not quality["is_valid"]:
            return IdentifyResponse(
                qualityScore=quality["score"],
                rejectionReason=quality["reason"],
            )

        # Step 2: Check for fraud
        fraud = fraud_detector.check(image_bytes)
        if fraud["is_ai_generated"]:
            return IdentifyResponse(
                isAIGenerated=True,
                qualityScore=quality["score"],
                rejectionReason="Image appears to be AI-generated",
            )

        # Step 3: Identify species
        result = identifier.identify(image_bytes)

        return IdentifyResponse(
            species=SpeciesResult(**result["species"]) if result["species"] else None,
            confidence=result["confidence"],
            isHuman=result["is_human"],
            isTree=result["is_tree"],
            isAIGenerated=False,
            qualityScore=quality["score"],
        )

    except Exception as e:
        logger.error(f"Identification error: {e}")
        raise HTTPException(status_code=500, detail="Identification failed")


@app.post("/validate", response_model=ValidateResponse, dependencies=[Depends(verify_api_key)])
async def validate_image(request: ValidateRequest):
    try:
        image_bytes = base64.b64decode(request.image)
        quality = validator.validate(image_bytes)
        fraud = fraud_detector.check(image_bytes)
        phash = validator.compute_perceptual_hash(image_bytes)

        is_valid = quality["is_valid"] and not fraud["is_ai_generated"]
        reason = quality.get("reason") or (
            "AI-generated image detected" if fraud["is_ai_generated"] else None
        )

        return ValidateResponse(
            isValid=is_valid,
            qualityScore=quality["score"],
            isBlurry=quality.get("is_blurry", False),
            isDark=quality.get("is_dark", False),
            isCropped=quality.get("is_cropped", False),
            isScreenshot=fraud.get("is_screenshot", False),
            isAIGenerated=fraud["is_ai_generated"],
            perceptualHash=phash,
            rejectionReason=reason,
        )

    except Exception as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=500, detail="Validation failed")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
