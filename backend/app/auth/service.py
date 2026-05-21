import random
import smtplib
import string
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy.orm import Session

from app.auth.repository import (
    activate_user,
    create_otp,
    create_user,
    get_latest_otp,
    get_user_by_email,
    get_user_by_user_id,
    mark_otp_used,
)
from app.auth.schemas import TokenResponse
from app.core.config import EMAIL_FROM, EMAIL_PASSWORD
from app.core.security import create_access_token, verify_password


def _generate_otp_code() -> str:
    return "".join(random.choices(string.digits, k=6))


def _send_otp_email(to_email: str, code: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Travel From Photo - Email Verification Code"
    msg["From"] = EMAIL_FROM
    msg["To"] = to_email

    html = f"""
    <div style="font-family: sans-serif; max-width: 400px; margin: auto;">
        <h2>Email Verification</h2>
        <p>Enter the following verification code. Code will expire in 5 minutes.</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px;
                    text-align: center; padding: 20px; background: #f0f0f0;
                    border-radius: 8px;">
            {code}
        </div>
    </div>
    """

    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(EMAIL_FROM, EMAIL_PASSWORD)
        server.sendmail(EMAIL_FROM, to_email, msg.as_string())


def register_user(
    db: Session,
    first_name: str,
    last_name: str,
    user_id: str,
    email: str,
    password: str,
) -> dict:
    if get_user_by_email(db, email):
        raise ValueError("Entered email is already registered.")
    if get_user_by_user_id(db, user_id):
        raise ValueError("Entered ID is already taken.")

    create_user(db, first_name, last_name, user_id, email, password)

    code = _generate_otp_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    create_otp(db, email, code, expires_at)
    _send_otp_email(email, code)

    return {"message": "OTP Code is sent to your email."}


def verify_otp(db: Session, email: str, code: str) -> dict:
    otp = get_latest_otp(db, email)

    if not otp:
        raise ValueError("Code is not found.")
    if otp.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise ValueError("Code is expired.")
    if otp.code != code:
        raise ValueError("Code is wrong.")

    mark_otp_used(db, otp)
    activate_user(db, email)

    return {"message": "Email verification is completed successfully."}


def login_user(db: Session, email: str, password: str) -> TokenResponse:
    user = get_user_by_email(db, email)

    if not user or not user.password_hash:
        raise ValueError("Email or Password is not correct.")
    if not verify_password(password, user.password_hash):
        raise ValueError("Email or Password is not correct.")
    if not user.is_active:
        raise ValueError("This account needs to verify email first.")

    token = create_access_token(user.id, user.role)

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.user_id,
        role=user.role,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
    )
