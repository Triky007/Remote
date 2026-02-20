"""
Rutas de autenticación.
Login con username/password y magic link.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional

from services.auth_service import authenticate_user, create_access_token, get_current_user
from services.token_service import token_service
from services.user_service import user_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class MagicLinkRequest(BaseModel):
    token: str


class LoginResponse(BaseModel):
    success: bool
    message: str
    token: Optional[str] = None
    user: Optional[dict] = None


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Login con username y password"""
    success, message, user_data = authenticate_user(request.username, request.password)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=message
        )

    return LoginResponse(
        success=True,
        message=message,
        token=user_data["token"],
        user={k: v for k, v in user_data.items() if k != "token"}
    )


@router.post("/magic-link", response_model=LoginResponse)
async def login_magic_link(request: MagicLinkRequest):
    """Login con magic token (link de invitación)"""
    validation = token_service.validate_token(request.token)

    if not validation:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado"
        )

    # Get user
    user = user_service.get_user_by_id(validation["user_id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )

    if not user.get("active", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo"
        )

    # Create JWT
    token = create_access_token(
        data={"sub": user["username"], "role": user.get("role", "client")}
    )

    return LoginResponse(
        success=True,
        message="Acceso concedido",
        token=token,
        user={
            "user_id": user["user_id"],
            "username": user["username"],
            "email": user.get("email", ""),
            "role": user["role"],
            "full_name": user.get("full_name", "")
        }
    )


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """Obtiene datos del usuario autenticado"""
    return {
        "user_id": current_user["user_id"],
        "username": current_user["username"],
        "email": current_user.get("email", ""),
        "role": current_user["role"],
        "full_name": current_user.get("full_name", "")
    }
