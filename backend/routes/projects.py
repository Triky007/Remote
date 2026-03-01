"""
Rutas de gestión de proyectos: CRUD, upload de PDFs, preflight, comentarios.
"""
import os
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from config import settings
from services.auth_service import get_current_user, get_current_admin
from services.project_service import project_service
from services.pdf_preflight_service import pdf_preflight_service
from models.pdf_preflight import PreflightResponse

router = APIRouter(prefix="/api/projects", tags=["projects"])


class CreateProjectRequest(BaseModel):
    name: str
    description: str = ""
    client_user_id: str
    client_info: Optional[Dict[str, Any]] = None
    product_info: Optional[Dict[str, Any]] = None


class UpdateStatusRequest(BaseModel):
    status: str


class AddCommentRequest(BaseModel):
    message: str
    pdf_filename: Optional[str] = None


class AddProcessRequest(BaseModel):
    process_type_id: str
    name: str
    estimated_hours: float = 1.0
    machine_id: Optional[str] = None
    assigned_to: Optional[str] = None
    dependencies: Optional[List[str]] = None
    priority: int = 1
    notes: str = ""
    fold_schemes: Optional[List[Dict[str, Any]]] = None


class UpdateProcessRequest(BaseModel):
    name: Optional[str] = None
    process_type_id: Optional[str] = None
    estimated_hours: Optional[float] = None
    machine_id: Optional[str] = None
    assigned_to: Optional[str] = None
    dependencies: Optional[List[str]] = None
    priority: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    notes: Optional[str] = None
    fold_schemes: Optional[List[Dict[str, Any]]] = None


class UpdateProcessStatusRequest(BaseModel):
    status: str


# ─── PROJECTS CRUD ────────────────────────────────────────────────────────────

@router.get("")
async def list_projects(current_user: dict = Depends(get_current_user)):
    """Lista proyectos (admin: todos, client: los suyos)"""
    if current_user["role"] == "admin":
        return project_service.get_all_projects()
    return project_service.get_projects_for_user(current_user["user_id"])


@router.post("")
async def create_project(request: CreateProjectRequest, current_user: dict = Depends(get_current_admin)):
    """Crea un proyecto (solo admin)"""
    project = project_service.create_project(
        name=request.name,
        description=request.description,
        client_user_id=request.client_user_id,
        client_info=request.client_info,
        created_by=current_user["user_id"],
        product_info=request.product_info
    )
    return {"success": True, "project": project}


@router.get("/{project_id}")
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    """Obtiene detalle de un proyecto"""
    project = project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    # Clients can only see their own projects
    if current_user["role"] == "client" and project.get("client_user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Sin acceso a este proyecto")

    return project


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    product_info: Optional[Dict[str, Any]] = None


@router.put("/{project_id}")
async def update_project(project_id: str, request: UpdateProjectRequest, current_user: dict = Depends(get_current_admin)):
    """Actualiza info del proyecto (solo admin)"""
    update_data = {k: v for k, v in request.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")
    project = project_service.update_project(project_id, update_data)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return {"success": True, "project": project}

@router.put("/{project_id}/status")
async def update_project_status(
    project_id: str,
    request: UpdateStatusRequest,
    current_user: dict = Depends(get_current_admin)
):
    """Cambia estado de un proyecto (solo admin). Si pasa a 'approved', auto-planifica."""
    try:
        # Obtener estado actual antes de actualizar
        existing = project_service.get_project_by_id(project_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")

        old_status = existing.get("status")
        new_status = request.status

        project = project_service.update_status(project_id, new_status)
        if not project:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")

        # Trigger auto-scheduling cuando pasa a 'approved'
        if new_status == "approved" and old_status != "approved":
            try:
                from services.planning_service import schedule_project_processes
                project = schedule_project_processes(project_id)
                print(f"✅ Proyecto {project_id} aprobado y planificado automáticamente")
            except Exception as plan_err:
                print(f"⚠️ Error planificando proyecto: {plan_err}")

        return {"success": True, "project": project}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{project_id}/client-approve")
async def client_approve_project(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """El cliente aprueba el proyecto. Solo el cliente asignado puede hacerlo."""
    project = project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    # Solo el cliente asignado puede aprobar
    if current_user["role"] != "client" and current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Sin permisos")
    if current_user["role"] == "client" and project.get("client_user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="No tiene acceso a este proyecto")

    # Solo se puede aprobar desde pending o reviewing
    if project.get("status") not in ("pending", "reviewing"):
        raise HTTPException(status_code=400, detail="Solo se puede aprobar un proyecto pendiente o en revisión")

    updated = project_service.update_status(project_id, "client_approved")
    if not updated:
        raise HTTPException(status_code=500, detail="Error actualizando estado")

    return {"success": True, "project": updated, "message": "Proyecto aprobado por el cliente"}


@router.delete("/{project_id}")
async def delete_project(project_id: str, current_user: dict = Depends(get_current_admin)):
    """Elimina un proyecto (solo admin)"""
    if project_service.delete_project(project_id):
        return {"success": True, "message": "Proyecto eliminado"}
    raise HTTPException(status_code=404, detail="Proyecto no encontrado")


# ─── PDF UPLOAD ───────────────────────────────────────────────────────────────

@router.post("/{project_id}/upload")
async def upload_pdf(
    project_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Sube un PDF a un proyecto"""
    project = project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    # Clients can only upload to their own projects
    if current_user["role"] == "client" and project.get("client_user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Sin acceso a este proyecto")

    # Validate file type
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")

    # Save file
    upload_dir = os.path.join(settings.UPLOADS_DIR, project_id)
    os.makedirs(upload_dir, exist_ok=True)

    # Use unique filename to avoid collisions
    safe_filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    filepath = os.path.join(upload_dir, safe_filename)

    file_content = await file.read()
    with open(filepath, "wb") as f:
        f.write(file_content)

    file_size = len(file_content)

    # Extract page count
    page_count = 0
    try:
        from services.pdf_thumbnail_service import pdf_thumbnail_service
        page_count = pdf_thumbnail_service.get_page_count(Path(filepath))
    except Exception:
        pass

    # Register in project
    pdf_entry = project_service.add_pdf(
        project_id=project_id,
        filename=safe_filename,
        original_filename=file.filename,
        file_size=file_size,
        page_count=page_count
    )

    return {
        "success": True,
        "pdf": pdf_entry,
        "message": f"PDF '{file.filename}' subido correctamente ({file_size / 1024:.1f} KB)"
    }


@router.delete("/{project_id}/pdfs/{filename}")
async def remove_pdf(
    project_id: str,
    filename: str,
    current_user: dict = Depends(get_current_user)
):
    """Elimina un PDF de un proyecto"""
    project = project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    if current_user["role"] == "client" and project.get("client_user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Sin acceso")

    if project_service.remove_pdf(project_id, filename):
        return {"success": True, "message": "PDF eliminado"}
    raise HTTPException(status_code=404, detail="PDF no encontrado")


# ─── PREFLIGHT ────────────────────────────────────────────────────────────────

@router.post("/{project_id}/preflight/{filename}")
async def run_preflight(
    project_id: str,
    filename: str,
    current_user: dict = Depends(get_current_user)
):
    """Ejecuta análisis preflight en un PDF"""
    project = project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    if current_user["role"] == "client" and project.get("client_user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Sin acceso")

    # Find the PDF file
    pdf_path = Path(os.path.join(settings.UPLOADS_DIR, project_id, filename))
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Archivo PDF no encontrado")

    # Run preflight
    result = pdf_preflight_service.analyze_pdf(pdf_path)
    result_dict = result.to_dict()

    # Update project
    project_service.update_pdf_preflight(
        project_id=project_id,
        filename=filename,
        preflight_status=result.status,
        preflight_result=result_dict
    )

    response = PreflightResponse(
        success=True,
        status=result.status,
        analyzed_at=result.analyzed_at,
        summary=result.summary,
        errors=result_dict["errors"],
        warnings=result_dict["warnings"],
        info=result_dict["info"],
        pdf_name=pdf_path.stem,
        filename=filename
    )

    return response


# ─── COMMENTS ─────────────────────────────────────────────────────────────────

@router.get("/{project_id}/comments")
async def get_comments(project_id: str, current_user: dict = Depends(get_current_user)):
    """Obtiene comentarios de un proyecto"""
    project = project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    if current_user["role"] == "client" and project.get("client_user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Sin acceso")

    return project.get("comments", [])


@router.post("/{project_id}/comments")
async def add_comment(
    project_id: str,
    request: AddCommentRequest,
    current_user: dict = Depends(get_current_user)
):
    """Añade un comentario a un proyecto"""
    project = project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    if current_user["role"] == "client" and project.get("client_user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Sin acceso")

    comment = project_service.add_comment(
        project_id=project_id,
        user_id=current_user["user_id"],
        username=current_user["username"],
        message=request.message,
        pdf_filename=request.pdf_filename
    )

    return {"success": True, "comment": comment}


# ─── THUMBNAILS ───────────────────────────────────────────────────────────────

@router.get("/{project_id}/thumbnail/{filename}/page/{page_number}")
async def get_pdf_page_thumbnail(
    project_id: str,
    filename: str,
    page_number: int,
    width: int = 400,
    current_user: dict = Depends(get_current_user)
):
    """Genera thumbnail de una página de un PDF"""
    from services.pdf_thumbnail_service import pdf_thumbnail_service

    project = project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    if current_user["role"] == "client" and project.get("client_user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Sin acceso")

    pdf_path = Path(os.path.join(settings.UPLOADS_DIR, project_id, filename))
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF no encontrado")

    result = pdf_thumbnail_service.get_page_thumbnail(pdf_path, page_number, width)
    return result


@router.get("/{project_id}/pdf-info/{filename}")
async def get_pdf_info(
    project_id: str,
    filename: str,
    current_user: dict = Depends(get_current_user)
):
    """Obtiene info básica de un PDF (número de páginas)"""
    from services.pdf_thumbnail_service import pdf_thumbnail_service

    project = project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    if current_user["role"] == "client" and project.get("client_user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Sin acceso")

    pdf_path = Path(os.path.join(settings.UPLOADS_DIR, project_id, filename))
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="PDF no encontrado")

    page_count = pdf_thumbnail_service.get_page_count(pdf_path)
    return {"filename": filename, "page_count": page_count}


# ─── PROCESSES ────────────────────────────────────────────────────────────────

@router.post("/{project_id}/processes", status_code=status.HTTP_201_CREATED)
async def add_process(
    project_id: str,
    request: AddProcessRequest,
    current_user: dict = Depends(get_current_admin),
):
    """Añade un proceso a un proyecto (solo admin)"""
    process = project_service.add_process(
        project_id=project_id,
        process_type_id=request.process_type_id,
        name=request.name,
        estimated_hours=request.estimated_hours,
        machine_id=request.machine_id,
        assigned_to=request.assigned_to,
        dependencies=request.dependencies,
        priority=request.priority,
        notes=request.notes,
        fold_schemes=request.fold_schemes,
    )
    if not process:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return {"success": True, "process": process}


@router.put("/{project_id}/processes/{process_id}")
async def update_process(
    project_id: str,
    process_id: str,
    request: UpdateProcessRequest,
    current_user: dict = Depends(get_current_admin),
):
    """Actualiza un proceso (solo admin)"""
    update_data = request.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")

    process = project_service.update_process(project_id, process_id, update_data)
    if not process:
        raise HTTPException(status_code=404, detail="Proyecto o proceso no encontrado")
    return {"success": True, "process": process}


@router.delete("/{project_id}/processes/{process_id}")
async def remove_process(
    project_id: str,
    process_id: str,
    current_user: dict = Depends(get_current_admin),
):
    """Elimina un proceso de un proyecto (solo admin)"""
    if not project_service.remove_process(project_id, process_id):
        raise HTTPException(status_code=404, detail="Proyecto o proceso no encontrado")
    return {"success": True, "detail": "Proceso eliminado"}


@router.patch("/{project_id}/processes/{process_id}/status")
async def update_process_status(
    project_id: str,
    process_id: str,
    request: UpdateProcessStatusRequest,
    current_user: dict = Depends(get_current_admin),
):
    """Cambia el estado de un proceso (solo admin)"""
    try:
        process = project_service.update_process_status(
            project_id, process_id, request.status
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not process:
        raise HTTPException(status_code=404, detail="Proyecto o proceso no encontrado")
    return {"success": True, "process": process}
