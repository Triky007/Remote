"""
Rutas de gestión de usuarios (admin).
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional

from services.auth_service import get_current_admin, get_current_user
from services.user_service import user_service
from services.token_service import token_service
from services.email_service import email_service

router = APIRouter(prefix="/api/users", tags=["users"])


class CreateUserRequest(BaseModel):
    username: str
    password: str
    email: str
    full_name: str = ""
    role: str = "client"


class InviteUserRequest(BaseModel):
    project_id: Optional[str] = None
    custom_message: Optional[str] = None
    expiry_hours: Optional[int] = 72
    max_uses: Optional[int] = 10


@router.get("")
async def list_users(current_user: dict = Depends(get_current_admin)):
    """Lista todos los usuarios (solo admin)"""
    return user_service.get_all_users()


@router.get("/clients")
async def list_clients(current_user: dict = Depends(get_current_admin)):
    """Lista solo clientes (desde clients.json)"""
    from services.client_service import client_service
    return client_service.get_all()


@router.post("")
async def create_user(request: CreateUserRequest, current_user: dict = Depends(get_current_admin)):
    """Crea un nuevo usuario (solo admin)"""
    try:
        user = user_service.create_user(
            username=request.username,
            password=request.password,
            email=request.email,
            role=request.role,
            full_name=request.full_name
        )
        return {"success": True, "user": user}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_admin)):
    """Elimina un usuario"""
    # Cannot delete yourself
    if user_id == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="No puede eliminarse a sí mismo")

    if user_service.delete_user(user_id):
        return {"success": True, "message": "Usuario eliminado"}
    raise HTTPException(status_code=404, detail="Usuario no encontrado")


@router.post("/{user_id}/invite")
async def invite_user(
    user_id: str,
    request: InviteUserRequest,
    current_user: dict = Depends(get_current_admin)
):
    """Envía invitación email con magic link a un usuario"""
    from services.auth_service import _find_user_by_id
    user = _find_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if not user.get("email"):
        raise HTTPException(status_code=400, detail="El usuario no tiene email configurado")

    # Generate magic token
    token_data = token_service.generate_token(
        user_id=user_id,
        user_email=user["email"],
        project_id=request.project_id,
        expiry_hours=request.expiry_hours,
        max_uses=request.max_uses
    )

    # Get project name if applicable
    project_name = None
    if request.project_id:
        from services.project_service import project_service
        project = project_service.get_project_by_id(request.project_id)
        if project:
            project_name = project.get("name", "")

    # Send email
    email_sent = email_service.send_invitation(
        to_email=user["email"],
        to_name=user.get("full_name", user["username"]),
        magic_url=token_data["magic_url"],
        project_name=project_name,
        custom_message=request.custom_message
    )

    return {
        "success": True,
        "email_sent": email_sent,
        "magic_url": token_data["magic_url"],
        "expires_at": token_data["expires_at"],
        "message": "Invitación enviada" if email_sent else "Token generado (email no configurado)"
    }
