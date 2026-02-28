"""
Servicio de máquinas con persistencia JSON.
CRUD de catálogo de máquinas para planificación.
"""
import uuid
import json
import os
from datetime import datetime
from typing import Optional, Dict, Any, List

from config import settings


MACHINE_TYPES = ["offset", "digital", "finishing", "cnc", "laser", "plotter", "other"]


class MachineService:
    """Gestión del catálogo de máquinas con persistencia en JSON"""

    def __init__(self):
        self.data_file = os.path.join(settings.DATA_DIR, "machines.json")
        self._ensure_data_file()

    def _ensure_data_file(self):
        os.makedirs(settings.DATA_DIR, exist_ok=True)
        if not os.path.exists(self.data_file):
            self._save_machines([])

    def _load_machines(self) -> List[Dict[str, Any]]:
        try:
            with open(self.data_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _save_machines(self, machines: List[Dict[str, Any]]):
        with open(self.data_file, "w", encoding="utf-8") as f:
            json.dump(machines, f, indent=2, ensure_ascii=False)

    def get_all(self, active_only: bool = False) -> List[Dict[str, Any]]:
        """Obtiene todas las máquinas"""
        machines = self._load_machines()
        if active_only:
            machines = [m for m in machines if m.get("active", True)]
        return machines

    def get_by_id(self, machine_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene una máquina por ID"""
        machines = self._load_machines()
        for machine in machines:
            if machine["machine_id"] == machine_id:
                return machine
        return None

    def create(
        self,
        name: str,
        machine_type: str = "other",
        description: str = "",
    ) -> Dict[str, Any]:
        """Crea una nueva máquina"""
        if machine_type not in MACHINE_TYPES:
            raise ValueError(f"Tipo inválido. Tipos válidos: {MACHINE_TYPES}")

        machine = {
            "machine_id": str(uuid.uuid4()),
            "name": name,
            "type": machine_type,
            "description": description,
            "active": True,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }

        machines = self._load_machines()
        machines.append(machine)
        self._save_machines(machines)
        return machine

    def update(self, machine_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Actualiza una máquina"""
        machines = self._load_machines()
        for i, machine in enumerate(machines):
            if machine["machine_id"] == machine_id:
                # No permitir cambiar machine_id
                update_data.pop("machine_id", None)

                if "type" in update_data and update_data["type"] not in MACHINE_TYPES:
                    raise ValueError(f"Tipo inválido. Tipos válidos: {MACHINE_TYPES}")

                machines[i].update(update_data)
                machines[i]["updated_at"] = datetime.now().isoformat()
                self._save_machines(machines)
                return machines[i]
        return None

    def delete(self, machine_id: str) -> bool:
        """Elimina una máquina"""
        machines = self._load_machines()
        original_len = len(machines)
        machines = [m for m in machines if m["machine_id"] != machine_id]
        if len(machines) < original_len:
            self._save_machines(machines)
            return True
        return False


# Instancia global
machine_service = MachineService()
