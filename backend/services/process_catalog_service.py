"""
Servicio de catálogo de procesos (plantillas) con persistencia JSON.
Admin crea plantillas, los procesos en proyectos las instancian.
"""
import uuid
import json
import os
from datetime import datetime
from typing import Optional, Dict, Any, List

from config import settings


PROCESS_CATEGORIES = ["design", "prepress", "printing", "finishing", "shipping", "other"]


class ProcessCatalogService:
    """Gestión del catálogo de plantillas de procesos"""

    def __init__(self):
        self.data_file = os.path.join(settings.DATA_DIR, "process_catalog.json")
        self._ensure_data_file()

    def _ensure_data_file(self):
        os.makedirs(settings.DATA_DIR, exist_ok=True)
        if not os.path.exists(self.data_file):
            self._save_catalog([])

    def _load_catalog(self) -> List[Dict[str, Any]]:
        try:
            with open(self.data_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _save_catalog(self, catalog: List[Dict[str, Any]]):
        with open(self.data_file, "w", encoding="utf-8") as f:
            json.dump(catalog, f, indent=2, ensure_ascii=False)

    def get_all(self, active_only: bool = False) -> List[Dict[str, Any]]:
        """Obtiene todas las plantillas de procesos"""
        catalog = self._load_catalog()
        if active_only:
            catalog = [p for p in catalog if p.get("active", True)]
        return catalog

    def get_by_id(self, process_type_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene una plantilla por ID"""
        catalog = self._load_catalog()
        for item in catalog:
            if item["process_type_id"] == process_type_id:
                return item
        return None

    def create(
        self,
        name: str,
        category: str = "other",
        default_estimated_hours: float = 1.0,
        requires_machine: bool = False,
        allowed_machine_types: Optional[List[str]] = None,
        color: str = "#95A5A6",
        icon: str = "settings",
    ) -> Dict[str, Any]:
        """Crea una nueva plantilla de proceso"""
        if category not in PROCESS_CATEGORIES:
            raise ValueError(f"Categoría inválida. Categorías válidas: {PROCESS_CATEGORIES}")

        item = {
            "process_type_id": str(uuid.uuid4()),
            "name": name,
            "category": category,
            "default_estimated_hours": default_estimated_hours,
            "requires_machine": requires_machine,
            "allowed_machine_types": allowed_machine_types or [],
            "color": color,
            "icon": icon,
            "active": True,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }

        catalog = self._load_catalog()
        catalog.append(item)
        self._save_catalog(catalog)
        return item

    def update(self, process_type_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Actualiza una plantilla de proceso"""
        catalog = self._load_catalog()
        for i, item in enumerate(catalog):
            if item["process_type_id"] == process_type_id:
                update_data.pop("process_type_id", None)

                if "category" in update_data and update_data["category"] not in PROCESS_CATEGORIES:
                    raise ValueError(f"Categoría inválida. Categorías válidas: {PROCESS_CATEGORIES}")

                catalog[i].update(update_data)
                catalog[i]["updated_at"] = datetime.now().isoformat()
                self._save_catalog(catalog)
                return catalog[i]
        return None

    def delete(self, process_type_id: str) -> bool:
        """Elimina una plantilla de proceso"""
        catalog = self._load_catalog()
        original_len = len(catalog)
        catalog = [p for p in catalog if p["process_type_id"] != process_type_id]
        if len(catalog) < original_len:
            self._save_catalog(catalog)
            return True
        return False


# Instancia global
process_catalog_service = ProcessCatalogService()
