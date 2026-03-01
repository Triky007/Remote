"""
Servicio de planificación para Remote.
Asigna start_date/end_date a los procesos de un proyecto,
respetando dependencias y disponibilidad de máquina.
"""
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from services.project_service import project_service
from services.machine_service import machine_service


def schedule_project_processes(project_id: str, delivery_days: int = 5) -> Dict[str, Any]:
    """
    Programa automáticamente los procesos de un proyecto al aprobarlo.
    - Establece delivery_deadline
    - Asigna start_date/end_date respetando dependencias y disponibilidad de máquina
    - Ordena procesos por prioridad (mayor prioridad primero)

    Returns:
        El proyecto actualizado
    """
    project = project_service.get_project_by_id(project_id)
    if not project:
        raise ValueError("Proyecto no encontrado")

    processes = project.get("processes", [])
    if not processes:
        # Sin procesos, solo establecer deadline
        now = datetime.now()
        project_service.update_project(project_id, {
            "delivery_deadline": (now + timedelta(days=delivery_days)).isoformat(),
            "approved_at": now.isoformat(),
        })
        return project_service.get_project_by_id(project_id)

    now = datetime.now()
    deadline = now + timedelta(days=delivery_days)

    # Construir mapa de procesos para resolución de dependencias
    process_map = {p["process_id"]: p for p in processes}

    # Obtener carga actual de cada máquina (de otros proyectos)
    machine_load = _get_machine_load(project_id)

    # Programar en orden topológico
    programmed = set()

    def get_end_time(proc):
        """Calcula end_time respetando dependencias y carga de máquina"""
        if proc["process_id"] in programmed:
            return datetime.fromisoformat(proc["end_date"])

        earliest_start = now

        # 1. Respetar dependencias
        for dep_id in proc.get("dependencies", []):
            if dep_id in process_map:
                dep_end = get_end_time(process_map[dep_id])
                if dep_end > earliest_start:
                    earliest_start = dep_end

        # 2. Respetar disponibilidad de máquina
        machine_id = proc.get("machine_id")
        if machine_id and machine_id in machine_load:
            machine_available = machine_load[machine_id]
            if machine_available > earliest_start:
                earliest_start = machine_available

        # 3. Calcular fechas
        hours = proc.get("estimated_hours", 1.0)
        end_time = earliest_start + timedelta(hours=hours)

        proc["start_date"] = earliest_start.isoformat()
        proc["end_date"] = end_time.isoformat()
        programmed.add(proc["process_id"])

        # Actualizar carga de máquina
        if machine_id:
            machine_load[machine_id] = end_time

        return end_time

    # Ordenar por prioridad descendente (mayor prioridad primero)
    sorted_processes = sorted(processes, key=lambda p: p.get("priority", 1), reverse=True)

    for proc in sorted_processes:
        get_end_time(proc)

    # Guardar todo de una vez
    project_service.update_project(project_id, {
        "processes": processes,
        "delivery_deadline": deadline.isoformat(),
        "approved_at": now.isoformat(),
    })

    print(f"✅ Proyecto {project_id} planificado: {len(processes)} procesos programados, deadline {deadline.strftime('%Y-%m-%d %H:%M')}")
    return project_service.get_project_by_id(project_id)


def _get_machine_load(exclude_project_id: str) -> Dict[str, datetime]:
    """
    Obtiene la carga actual de cada máquina basándose en procesos
    pendientes/en progreso de OTROS proyectos.

    Returns:
        Dict machine_id → datetime cuando estará libre
    """
    machine_load: Dict[str, datetime] = {}

    all_projects = project_service.get_all_projects()
    for project in all_projects:
        if project["project_id"] == exclude_project_id:
            continue
        if project.get("status") not in ("approved", "reviewing"):
            continue

        for proc in project.get("processes", []):
            if proc.get("status") in ("completed", "cancelled"):
                continue
            machine_id = proc.get("machine_id")
            end_date_str = proc.get("end_date")
            if machine_id and end_date_str:
                try:
                    end_date = datetime.fromisoformat(end_date_str)
                    if machine_id not in machine_load or end_date > machine_load[machine_id]:
                        machine_load[machine_id] = end_date
                except (ValueError, TypeError):
                    pass

    return machine_load
