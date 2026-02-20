"""
Rutas de gestión de proyectos: CRUD, upload de PDFs, preflight, comentarios.
"""
import os
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional, Dict, Any

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


class UpdateStatusRequest(BaseModel):
    status: str


class AddCommentRequest(BaseModel):
    message: str
    pdf_filename: Optional[str] = None


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
        created_by=current_user["user_id"]
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


@router.put("/{project_id}/status")
async def update_project_status(
    project_id: str,
    request: UpdateStatusRequest,
    current_user: dict = Depends(get_current_admin)
):
    """Cambia estado de un proyecto (solo admin)"""
    try:
        project = project_service.update_status(project_id, request.status)
        if not project:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")
        return {"success": True, "project": project}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


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

    # Register in project
    pdf_entry = project_service.add_pdf(
        project_id=project_id,
        filename=safe_filename,
        original_filename=file.filename,
        file_size=file_size
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
