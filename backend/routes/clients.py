"""
Rutas CRUD para el catálogo de clientes.
Admin: crear, editar, eliminar, listar.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any

from services.auth_service import get_current_user, get_current_admin
from services.client_service import client_service

router = APIRouter(prefix="/api/clients", tags=["clients"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateClientRequest(BaseModel):
    username: str
    password: str
    email: str
    full_name: str = ""
    company_name: str = ""
    cif: str = ""
    notification_email: str = ""
    address: str = ""
    city: str = ""
    postal_code: str = ""
    phone: str = ""
    contact_person: str = ""
    notes: str = ""


class UpdateClientRequest(BaseModel):
    # Campos de usuario
    username: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    active: Optional[bool] = None
    # Campos de ficha comercial
    company_name: Optional[str] = None
    cif: Optional[str] = None
    notification_email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    phone: Optional[str] = None
    contact_person: Optional[str] = None
    notes: Optional[str] = None


# ─── ENDPOINTS ────────────────────────────────────────────────────────────────

@router.get("")
async def list_clients(current_user: dict = Depends(get_current_admin)):
    """Lista todos los clientes (solo admin)"""
    return client_service.get_all()


@router.get("/{client_id}")
async def get_client(
    client_id: str,
    current_user: dict = Depends(get_current_admin),
):
    """Obtiene un cliente por ID (solo admin)"""
    client = client_service.get_by_id(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return client


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_client(
    request: CreateClientRequest,
    current_user: dict = Depends(get_current_admin),
):
    """Crea un nuevo cliente con usuario + ficha comercial (solo admin)"""
    try:
        return client_service.create(
            username=request.username,
            password=request.password,
            email=request.email,
            full_name=request.full_name,
            company_name=request.company_name,
            cif=request.cif,
            notification_email=request.notification_email,
            address=request.address,
            city=request.city,
            postal_code=request.postal_code,
            phone=request.phone,
            contact_person=request.contact_person,
            notes=request.notes,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{client_id}")
async def update_client(
    client_id: str,
    request: UpdateClientRequest,
    current_user: dict = Depends(get_current_admin),
):
    """Actualiza un cliente (solo admin)"""
    update_data = request.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")

    try:
        client = client_service.update(client_id, update_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return client


@router.delete("/{client_id}")
async def delete_client(
    client_id: str,
    current_user: dict = Depends(get_current_admin),
):
    """Elimina un cliente y su usuario (solo admin)"""
    if not client_service.delete(client_id):
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return {"detail": "Cliente eliminado"}
