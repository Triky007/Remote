"""
Servicio de autenticación para Remote.
JWT + bcrypt. Busca en users.json (admins) y clients.json (clientes).
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


def _find_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    """Busca un usuario por username en users.json (admins) y clients.json (clientes)"""
    # Primero buscar en admins
    from services.user_service import user_service
    user = user_service.get_user_by_username(username)
    if user:
        return user

    # Luego buscar en clientes
    from services.client_service import client_service
    client = client_service.get_by_username(username)
    if client:
        # Normalizar: auth_service espera user_id, clients usan client_id
        client["user_id"] = client["client_id"]
        return client

    return None


def _find_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Busca un usuario por ID en users.json y clients.json"""
    from services.user_service import user_service
    user = user_service.get_user_by_id(user_id)
    if user:
        return user

    from services.client_service import client_service
    client = client_service.get_by_id(user_id)
    if client:
        client["user_id"] = client["client_id"]
        return client

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

    user = _find_user_by_username(username)
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
    Searches both users.json (admins) and clients.json (clients).
    Returns (success, message, user_data_with_token)
    """
    user = _find_user_by_username(username)
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

    user_id = user.get("user_id") or user.get("client_id")
    user_data = {
        "user_id": user_id,
        "username": user["username"],
        "email": user.get("email", ""),
        "role": user.get("role", "client"),
        "full_name": user.get("full_name", ""),
        "token": token
    }

    return True, "Autenticación exitosa", user_data
