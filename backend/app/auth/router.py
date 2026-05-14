from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.schemas import (
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    TokenResponse,
    VerifyOTPRequest,
)
from app.auth.service import login_user, register_user, verify_otp
from app.core.db import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=MessageResponse)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    try:
        return register_user(db, req.first_name, req.last_name, req.user_id, req.email, req.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/verify-otp", response_model=MessageResponse)
def verify(req: VerifyOTPRequest, db: Session = Depends(get_db)):
    try:
        return verify_otp(db, req.email, req.code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    try:
        return login_user(db, req.email, req.password)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
