"""
Rutas CRUD para el catálogo de procesos (plantillas).
Admin: crear, editar, eliminar. Auth: listar.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from services.auth_service import get_current_user, get_current_admin
from services.process_catalog_service import process_catalog_service

router = APIRouter(prefix="/api/process-catalog", tags=["process-catalog"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateProcessTypeRequest(BaseModel):
    name: str
    category: str = "other"
    default_estimated_hours: float = 1.0
    requires_machine: bool = False
    allowed_machine_types: Optional[List[str]] = None
    color: str = "#95A5A6"
    icon: str = "settings"


class UpdateProcessTypeRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    default_estimated_hours: Optional[float] = None
    requires_machine: Optional[bool] = None
    allowed_machine_types: Optional[List[str]] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    active: Optional[bool] = None


# ─── ENDPOINTS ────────────────────────────────────────────────────────────────

@router.get("")
async def list_process_types(
    active_only: bool = False,
    current_user: dict = Depends(get_current_user),
):
    """Lista todas las plantillas de procesos"""
    return process_catalog_service.get_all(active_only=active_only)


@router.get("/{process_type_id}")
async def get_process_type(
    process_type_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Obtiene una plantilla de proceso por ID"""
    item = process_catalog_service.get_by_id(process_type_id)
    if not item:
        raise HTTPException(status_code=404, detail="Plantilla de proceso no encontrada")
    return item


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_process_type(
    request: CreateProcessTypeRequest,
    current_user: dict = Depends(get_current_admin),
):
    """Crea una nueva plantilla de proceso (solo admin)"""
    try:
        return process_catalog_service.create(
            name=request.name,
            category=request.category,
            default_estimated_hours=request.default_estimated_hours,
            requires_machine=request.requires_machine,
            allowed_machine_types=request.allowed_machine_types,
            color=request.color,
            icon=request.icon,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{process_type_id}")
async def update_process_type(
    process_type_id: str,
    request: UpdateProcessTypeRequest,
    current_user: dict = Depends(get_current_admin),
):
    """Actualiza una plantilla de proceso (solo admin)"""
    update_data = request.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")

    try:
        item = process_catalog_service.update(process_type_id, update_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not item:
        raise HTTPException(status_code=404, detail="Plantilla de proceso no encontrada")
    return item


@router.delete("/{process_type_id}")
async def delete_process_type(
    process_type_id: str,
    current_user: dict = Depends(get_current_admin),
):
    """Elimina una plantilla de proceso (solo admin)"""
    if not process_catalog_service.delete(process_type_id):
        raise HTTPException(status_code=404, detail="Plantilla de proceso no encontrada")
    return {"detail": "Plantilla de proceso eliminada"}
