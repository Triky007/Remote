"""
Servicio de autenticación para Remote.
JWT + bcrypt. Patrón W2P jwt.py + MIS auth_service.py
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import bcrypt

from config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash"""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    """FastAPI dependency to get the current authenticated user"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudieron validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = verify_token(token)
    if payload is None:
        raise credentials_exception

    username = payload.get("sub")
    if username is None:
        raise credentials_exception

    # Get user from user service
    from services.user_service import user_service
    user = user_service.get_user_by_username(username)
    if user is None:
        raise credentials_exception

    if not user.get("active", False):
        raise HTTPException(status_code=400, detail="Usuario inactivo")

    return user


def get_current_admin(current_user: Dict = Depends(get_current_user)) -> Dict[str, Any]:
    """FastAPI dependency to require admin role"""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permisos insuficientes"
        )
    return current_user


def authenticate_user(username: str, password: str) -> Tuple[bool, str, Optional[Dict[str, Any]]]:
    """
    Authenticate a user with username and password.
    Returns (success, message, user_data_with_token)
    """
    from services.user_service import user_service

    user = user_service.get_user_by_username(username)
    if not user:
        return False, "Usuario no encontrado", None

    if not user.get("active", False):
        return False, "Usuario inactivo", None

    if not verify_password(password, user.get("password_hash", "")):
        return False, "Contraseña incorrecta", None

    # Create token
    token = create_access_token(
        data={"sub": username, "role": user.get("role", "client")}
    )

    user_data = {
        "user_id": user["user_id"],
        "username": user["username"],
        "email": user.get("email", ""),
        "role": user["role"],
        "full_name": user.get("full_name", ""),
        "token": token
    }

    return True, "Autenticación exitosa", user_data
