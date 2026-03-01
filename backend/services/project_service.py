"""
Servicio de proyectos con persistencia JSON.
Cada proyecto contiene info del cliente, PDFs subidos, estado y comentarios.
"""
import uuid
import json
import os
import shutil
from datetime import datetime
from typing import Optional, Dict, Any, List

from config import settings


class ProjectService:
    """Gestión de proyectos con persistencia JSON"""

    STATUSES = ["pending", "reviewing", "client_approved", "approved", "rejected", "completed"]

    def __init__(self):
        self.data_file = os.path.join(settings.DATA_DIR, "projects.json")
        self._ensure_data_file()

    def _ensure_data_file(self):
        os.makedirs(settings.DATA_DIR, exist_ok=True)
        os.makedirs(settings.UPLOADS_DIR, exist_ok=True)
        if not os.path.exists(self.data_file):
            self._save_projects([])

    def _load_projects(self) -> List[Dict[str, Any]]:
        try:
            with open(self.data_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _save_projects(self, projects: List[Dict[str, Any]]):
        with open(self.data_file, "w", encoding="utf-8") as f:
            json.dump(projects, f, indent=2, ensure_ascii=False)

    def _get_project_upload_dir(self, project_id: str) -> str:
        """Directorio de uploads para un proyecto"""
        path = os.path.join(settings.UPLOADS_DIR, project_id)
        os.makedirs(path, exist_ok=True)
        return path

    def get_all_projects(self) -> List[Dict[str, Any]]:
        """Obtiene todos los proyectos"""
        return self._load_projects()

    def get_projects_for_user(self, user_id: str) -> List[Dict[str, Any]]:
        """Obtiene proyectos asignados a un usuario"""
        projects = self._load_projects()
        return [p for p in projects if p.get("client_user_id") == user_id]

    def get_project_by_id(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene un proyecto por ID"""
        projects = self._load_projects()
        for p in projects:
            if p["project_id"] == project_id:
                return p
        return None

    def create_project(
        self,
        name: str,
        description: str,
        client_user_id: str,
        client_info: Optional[Dict[str, Any]] = None,
        created_by: str = "",
        product_info: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """Crea un nuevo proyecto"""
        project = {
            "project_id": str(uuid.uuid4()),
            "name": name,
            "description": description,
            "client_user_id": client_user_id,
            "client_info": client_info or {},
            "product_info": product_info or {},
            "status": "pending",
            "pdfs": [],
            "comments": [],
            "processes": [],
            "created_by": created_by,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }

        projects = self._load_projects()
        projects.append(project)
        self._save_projects(projects)

        # Crear directorio de uploads
        self._get_project_upload_dir(project["project_id"])

        return project

    def update_project(self, project_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Actualiza un proyecto"""
        projects = self._load_projects()
        for i, p in enumerate(projects):
            if p["project_id"] == project_id:
                update_data.pop("project_id", None)
                projects[i].update(update_data)
                projects[i]["updated_at"] = datetime.now().isoformat()
                self._save_projects(projects)
                return projects[i]
        return None

    def update_status(self, project_id: str, new_status: str) -> Optional[Dict[str, Any]]:
        """Cambia el estado de un proyecto"""
        if new_status not in self.STATUSES:
            raise ValueError(f"Estado inválido: {new_status}")
        return self.update_project(project_id, {"status": new_status})

    def add_pdf(self, project_id: str, filename: str, original_filename: str, file_size: int) -> Optional[Dict[str, Any]]:
        """Registra un PDF subido"""
        projects = self._load_projects()
        for i, p in enumerate(projects):
            if p["project_id"] == project_id:
                pdf_entry = {
                    "pdf_id": str(uuid.uuid4()),
                    "filename": filename,
                    "original_filename": original_filename,
                    "file_size": file_size,
                    "uploaded_at": datetime.now().isoformat(),
                    "preflight_status": "pending",
                    "preflight_result": None,
                    "preflight_checked_at": None
                }
                projects[i]["pdfs"].append(pdf_entry)
                projects[i]["updated_at"] = datetime.now().isoformat()
                self._save_projects(projects)
                return pdf_entry
        return None

    def update_pdf_preflight(
        self,
        project_id: str,
        filename: str,
        preflight_status: str,
        preflight_result: Dict[str, Any]
    ) -> bool:
        """Actualiza el resultado preflight de un PDF"""
        projects = self._load_projects()
        for i, p in enumerate(projects):
            if p["project_id"] == project_id:
                for j, pdf in enumerate(p["pdfs"]):
                    if pdf["filename"] == filename:
                        projects[i]["pdfs"][j]["preflight_status"] = preflight_status
                        projects[i]["pdfs"][j]["preflight_result"] = preflight_result
                        projects[i]["pdfs"][j]["preflight_checked_at"] = datetime.now().isoformat()
                        projects[i]["updated_at"] = datetime.now().isoformat()
                        self._save_projects(projects)
                        return True
        return False

    def remove_pdf(self, project_id: str, filename: str) -> bool:
        """Elimina un PDF de un proyecto"""
        projects = self._load_projects()
        for i, p in enumerate(projects):
            if p["project_id"] == project_id:
                original_len = len(p["pdfs"])
                projects[i]["pdfs"] = [pdf for pdf in p["pdfs"] if pdf["filename"] != filename]
                if len(projects[i]["pdfs"]) < original_len:
                    # Delete file
                    filepath = os.path.join(self._get_project_upload_dir(project_id), filename)
                    if os.path.exists(filepath):
                        os.remove(filepath)
                    projects[i]["updated_at"] = datetime.now().isoformat()
                    self._save_projects(projects)
                    return True
        return False

    def add_comment(
        self,
        project_id: str,
        user_id: str,
        username: str,
        message: str,
        pdf_filename: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Añade un comentario a un proyecto"""
        projects = self._load_projects()
        for i, p in enumerate(projects):
            if p["project_id"] == project_id:
                comment = {
                    "comment_id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "username": username,
                    "message": message,
                    "pdf_filename": pdf_filename,
                    "created_at": datetime.now().isoformat()
                }
                projects[i]["comments"].append(comment)
                projects[i]["updated_at"] = datetime.now().isoformat()
                self._save_projects(projects)
                return comment
        return None

    # ─── PROCESSES ─────────────────────────────────────────────────────────────

    def _ensure_processes_array(self, project: Dict[str, Any]) -> Dict[str, Any]:
        """Asegura que el proyecto tiene el array processes (backwards compatible)"""
        if "processes" not in project:
            project["processes"] = []
        return project

    def add_process(
        self,
        project_id: str,
        process_type_id: str,
        name: str,
        estimated_hours: float = 1.0,
        machine_id: Optional[str] = None,
        assigned_to: Optional[str] = None,
        dependencies: Optional[List[str]] = None,
        priority: int = 1,
        notes: str = "",
    ) -> Optional[Dict[str, Any]]:
        """Añade un proceso a un proyecto"""
        projects = self._load_projects()
        for i, p in enumerate(projects):
            if p["project_id"] == project_id:
                self._ensure_processes_array(projects[i])
                process = {
                    "process_id": str(uuid.uuid4()),
                    "process_type_id": process_type_id,
                    "name": name,
                    "status": "pending",
                    "estimated_hours": estimated_hours,
                    "start_date": None,
                    "end_date": None,
                    "machine_id": machine_id,
                    "assigned_to": assigned_to,
                    "dependencies": dependencies or [],
                    "priority": priority,
                    "notes": notes,
                    "created_at": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat(),
                }
                projects[i]["processes"].append(process)
                projects[i]["updated_at"] = datetime.now().isoformat()
                self._save_projects(projects)
                return process
        return None

    def update_process(
        self, project_id: str, process_id: str, update_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Actualiza un proceso de un proyecto"""
        projects = self._load_projects()
        for i, p in enumerate(projects):
            if p["project_id"] == project_id:
                self._ensure_processes_array(projects[i])
                for j, proc in enumerate(projects[i]["processes"]):
                    if proc["process_id"] == process_id:
                        update_data.pop("process_id", None)
                        projects[i]["processes"][j].update(update_data)
                        projects[i]["processes"][j]["updated_at"] = datetime.now().isoformat()
                        projects[i]["updated_at"] = datetime.now().isoformat()
                        self._save_projects(projects)
                        return projects[i]["processes"][j]
        return None

    def remove_process(self, project_id: str, process_id: str) -> bool:
        """Elimina un proceso de un proyecto"""
        projects = self._load_projects()
        for i, p in enumerate(projects):
            if p["project_id"] == project_id:
                self._ensure_processes_array(projects[i])
                original_len = len(projects[i]["processes"])
                projects[i]["processes"] = [
                    proc for proc in projects[i]["processes"]
                    if proc["process_id"] != process_id
                ]
                if len(projects[i]["processes"]) < original_len:
                    projects[i]["updated_at"] = datetime.now().isoformat()
                    self._save_projects(projects)
                    return True
        return False

    def update_process_status(
        self, project_id: str, process_id: str, new_status: str
    ) -> Optional[Dict[str, Any]]:
        """Cambia el estado de un proceso"""
        valid_statuses = ["pending", "in_progress", "completed", "cancelled"]
        if new_status not in valid_statuses:
            raise ValueError(f"Estado inválido. Estados válidos: {valid_statuses}")
        return self.update_process(project_id, process_id, {"status": new_status})

    # ─── DELETE PROJECT ───────────────────────────────────────────────────────

    def delete_project(self, project_id: str) -> bool:
        """Elimina un proyecto y sus archivos"""
        projects = self._load_projects()
        original_len = len(projects)
        projects = [p for p in projects if p["project_id"] != project_id]
        if len(projects) < original_len:
            # Delete upload directory
            upload_dir = os.path.join(settings.UPLOADS_DIR, project_id)
            if os.path.exists(upload_dir):
                shutil.rmtree(upload_dir)
            self._save_projects(projects)
            return True
        return False


# Instancia global
project_service = ProjectService()
