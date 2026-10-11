"""
HealthContinuum AI — Authentication Routes
POST /api/auth/login
POST /api/auth/register
POST /api/auth/google
GET  /api/auth/me
"""
from __future__ import annotations

import uuid
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.patient import Patient
from app.models.doctor import Doctor
from app.core.security import create_access_token, decode_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    identifier: str = Field(..., description="Email, Phone, UHID, or Patient ID")
    password: str = Field(default="", description="Password")
    remember_me: bool = Field(default=True)


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2)
    email: str | None = None
    phone: str | None = None
    password: str = Field(default="password123")


class GoogleAuthRequest(BaseModel):
    email: str
    name: str
    google_id: str | None = None


class AuthData(BaseModel):
    access_token: str
    token_type: str = "bearer"
    patient: dict[str, Any]


class AuthResponse(BaseModel):
    success: bool
    data: AuthData | None = None
    message: str | None = None


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest):
    """Legacy passwordless login is disabled; use Firebase Authentication in the patient client."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "code": "FIREBASE_AUTH_REQUIRED",
            "message": "Patient sign-in must be verified through Firebase Authentication. The legacy API did not verify patient passwords and is disabled.",
        },
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest):
    """Legacy API registration is disabled; it did not store/verify patient credentials."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "code": "FIREBASE_AUTH_REQUIRED",
            "message": "Create patient accounts through Firebase Authentication. The legacy API registration endpoint is disabled.",
        },
    )


@router.post("/google", response_model=AuthResponse)
async def google_auth(payload: GoogleAuthRequest):
    """Never trust a client-supplied email as proof of Google authentication."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "code": "VERIFIED_ID_TOKEN_REQUIRED",
            "message": "Google sign-in must be verified by Firebase Authentication. The legacy email-only endpoint is disabled.",
        },
    )


@router.get("/me", response_model=AuthResponse)
async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Return a patient only when a signed bearer token is supplied."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required.")

    payload = decode_access_token(auth_header[7:].strip())
    if not payload or not payload.get("sub") or payload.get("role") == "doctor":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid patient session.")

    result = await db.execute(select(Patient).where(Patient.id == payload["sub"]))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Patient session is not valid.")

    return AuthResponse(
        success=True,
        data=AuthData(
            access_token=auth_header[7:].strip(),
            token_type="bearer",
            patient={
                "id": patient.id,
                "name": patient.name,
                "email": patient.email,
                "phone": patient.phone,
                "uhid": patient.uhid,
            },
        ),
    )


# ── DOCTOR AUTHENTICATION ─────────────────────────────────────────────────────

class DoctorLoginRequest(BaseModel):
    email: str = Field(..., description="Doctor email")
    password: str = Field(..., description="Doctor password")


class DoctorProfileOut(BaseModel):
    id: str
    fullName: str
    credentials: str
    registrationNumber: str
    specialty: str
    facilityName: str
    facilityId: str | None = None
    avatarInitials: str
    email: str
    verified: bool


class DoctorAuthData(BaseModel):
    access_token: str
    token_type: str = "bearer"
    doctor: DoctorProfileOut


class DoctorAuthResponse(BaseModel):
    success: bool
    data: DoctorAuthData | None = None
    message: str | None = None


@router.post("/doctor/login", response_model=DoctorAuthResponse)
async def doctor_login(
    payload: DoctorLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    email = payload.email.strip().lower()
    stmt = select(Doctor).where(Doctor.email.ilike(email))
    res = await db.execute(stmt)
    doctor = res.scalar_one_or_none()
    if not doctor or not doctor.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Invalid doctor email or password."},
        )

    if not verify_password(payload.password, doctor.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Invalid doctor email or password."},
        )

    token = create_access_token({
        "sub": doctor.id,
        "email": doctor.email,
        "name": doctor.full_name,
        "role": "doctor",
    })

    profile = DoctorProfileOut(
        id=doctor.id,
        fullName=doctor.full_name,
        credentials=doctor.credentials,
        registrationNumber=doctor.registration_number,
        specialty=doctor.specialty,
        facilityName=doctor.facility_name,
        facilityId=doctor.facility_id,
        avatarInitials=doctor.avatar_initials,
        email=doctor.email,
        verified=doctor.verified,
    )

    return DoctorAuthResponse(
        success=True,
        data=DoctorAuthData(
            access_token=token,
            doctor=profile,
        ),
        message=f"Welcome back, {doctor.full_name}",
    )


@router.get("/doctor/me", response_model=DoctorAuthResponse)
async def get_current_doctor(
    request: Request,
    token: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Doctor session token required."},
        )

    payload = decode_access_token(token)
    if not payload or payload.get("role") != "doctor" or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_SESSION", "message": "Invalid or expired doctor session."},
        )

    stmt = select(Doctor).where(Doctor.id == payload["sub"])
    res = await db.execute(stmt)
    doctor = res.scalar_one_or_none()
    if not doctor or not doctor.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "DOCTOR_NOT_FOUND", "message": "Doctor profile not found."},
        )

    profile = DoctorProfileOut(
        id=doctor.id,
        fullName=doctor.full_name,
        credentials=doctor.credentials,
        registrationNumber=doctor.registration_number,
        specialty=doctor.specialty,
        facilityName=doctor.facility_name,
        facilityId=doctor.facility_id,
        avatarInitials=doctor.avatar_initials,
        email=doctor.email,
        verified=doctor.verified,
    )

    return DoctorAuthResponse(
        success=True,
        data=DoctorAuthData(
            access_token=token,
            doctor=profile,
        ),
        message="Doctor session active.",
    )


@router.post("/doctor/logout")
async def doctor_logout():
    return {"success": True, "message": "Doctor signed out successfully."}

