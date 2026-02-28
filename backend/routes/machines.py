"""
Rutas CRUD para el catálogo de máquinas.
Admin: crear, editar, eliminar. Auth: listar.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any

from services.auth_service import get_current_user, get_current_admin
from services.machine_service import machine_service

router = APIRouter(prefix="/api/machines", tags=["machines"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateMachineRequest(BaseModel):
    name: str
    type: str = "other"
    description: str = ""


class UpdateMachineRequest(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None


# ─── ENDPOINTS ────────────────────────────────────────────────────────────────

@router.get("")
async def list_machines(
    active_only: bool = False,
    current_user: dict = Depends(get_current_user),
):
    """Lista todas las máquinas"""
    return machine_service.get_all(active_only=active_only)


@router.get("/{machine_id}")
async def get_machine(
    machine_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Obtiene una máquina por ID"""
    machine = machine_service.get_by_id(machine_id)
    if not machine:
        raise HTTPException(status_code=404, detail="Máquina no encontrada")
    return machine


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_machine(
    request: CreateMachineRequest,
    current_user: dict = Depends(get_current_admin),
):
    """Crea una nueva máquina (solo admin)"""
    try:
        return machine_service.create(
            name=request.name,
            machine_type=request.type,
            description=request.description,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{machine_id}")
async def update_machine(
    machine_id: str,
    request: UpdateMachineRequest,
    current_user: dict = Depends(get_current_admin),
):
    """Actualiza una máquina (solo admin)"""
    update_data = request.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")

    try:
        machine = machine_service.update(machine_id, update_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not machine:
        raise HTTPException(status_code=404, detail="Máquina no encontrada")
    return machine


@router.delete("/{machine_id}")
async def delete_machine(
    machine_id: str,
    current_user: dict = Depends(get_current_admin),
):
    """Elimina una máquina (solo admin)"""
    if not machine_service.delete(machine_id):
        raise HTTPException(status_code=404, detail="Máquina no encontrada")
    return {"detail": "Máquina eliminada"}
