"""
Rutas de planificación: visualización de procesos programados en timeline.
"""
from fastapi import APIRouter, Depends
from typing import Optional

from services.auth_service import get_current_admin
from services.project_service import project_service
from services.machine_service import machine_service

router = APIRouter(prefix="/api/planning", tags=["planning"])


@router.get("/processes")
async def get_all_scheduled_processes(
    current_user: dict = Depends(get_current_admin),
):
    """
    Devuelve todos los procesos programados de todos los proyectos aprobados,
    junto con info del proyecto al que pertenecen.
    Formato optimizado para el planificador visual Gantt.
    """
    all_projects = project_service.get_all_projects()
    processes = []

    for project in all_projects:
        if project.get("status") not in ("approved", "completed"):
            continue

        for proc in project.get("processes", []):
            if proc.get("status") == "cancelled":
                continue

            processes.append({
                "process_id": proc["process_id"],
                "project_id": project["project_id"],
                "project_name": project["name"],
                "name": proc["name"],
                "process_type_id": proc.get("process_type_id", ""),
                "machine_id": proc.get("machine_id"),
                "status": proc.get("status", "pending"),
                "estimated_hours": proc.get("estimated_hours", 1),
                "start_date": proc.get("start_date"),
                "end_date": proc.get("end_date"),
                "priority": proc.get("priority", 1),
                "dependencies": proc.get("dependencies", []),
            })

    return {
        "processes": processes,
        "total": len(processes),
    }
