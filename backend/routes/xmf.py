"""
Rutas XMF — preview y envío de JSON_OT al servicio externo.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any

from config import settings
from services.auth_service import get_current_admin
from services.project_service import project_service
from services.machine_service import machine_service
from services.xmf_service import build_xmf_json, get_auth_token, upload_pdf_to_xmf, send_to_xmf

import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/xmf", tags=["xmf"])


@router.get("/preview/{project_id}")
async def preview_xmf(project_id: str, current_user: dict = Depends(get_current_admin)):
    """Genera y devuelve el JSON XMF para previsualización (sin enviar)."""
    project = project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    machines = machine_service.get_all()

    # Obtener datos del cliente
    client_data = None
    client_user_id = project.get("client_user_id")
    if client_user_id:
        try:
            from services.client_service import client_service
            client_data = client_service.get_by_id_safe(client_user_id)
        except Exception:
            pass

    json_ot = build_xmf_json(project, machines, client_data)
    return {"json_ot": json_ot}


@router.post("/send/{project_id}")
async def send_xmf(project_id: str, current_user: dict = Depends(get_current_admin)):
    """Sube PDFs y envía JSON_OT al servicio externo XMF."""
    project = project_service.get_project_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    machines = machine_service.get_all()

    # Obtener datos del cliente
    client_data = None
    client_user_id = project.get("client_user_id")
    if client_user_id:
        try:
            from services.client_service import client_service
            client_data = client_service.get_by_id_safe(client_user_id)
        except Exception:
            pass

    server_url = settings.XMF_SERVER_URL
    if not server_url:
        raise HTTPException(status_code=500, detail="XMF_SERVER_URL no configurada")

    try:
        # 1. Obtener token
        auth_token = await get_auth_token()

        # 2. Subir PDFs al servidor externo
        external_pdfs = []
        for pdf in project.get("pdfs", []):
            pdf_path = os.path.join(settings.UPLOADS_DIR, project_id, pdf["filename"])
            if not os.path.exists(pdf_path):
                logger.warning(f"PDF no encontrado: {pdf_path}")
                continue
            try:
                result = await upload_pdf_to_xmf(pdf_path, auth_token, server_url)
                external_pdfs.append({
                    "name": pdf.get("original_filename", pdf.get("filename", "")),
                    "url": result.get("url", ""),
                    "pages": pdf.get("page_count", 1),
                })
                logger.info(f"PDF subido: {pdf.get('original_filename')} -> {result.get('url')}")
            except Exception as e:
                logger.error(f"Error subiendo PDF {pdf.get('original_filename')}: {e}")

        # 3. Generar JSON
        json_ot = build_xmf_json(project, machines, client_data)

        # 4. Actualizar runlists con URLs del servidor externo
        if external_pdfs:
            runlists = []
            for idx, pdf_info in enumerate(external_pdfs, 1):
                runlists.append({
                    "runlist_id": f"RL-{idx}",
                    "name": pdf_info["name"],
                    "pages": pdf_info["pages"],
                    "page_range": f"0 ~ {pdf_info['pages'] - 1}",
                    "signature_ref": "Sig-1",
                    "pdf_url": pdf_info["url"],
                })
            json_ot["runlists"] = runlists

        # 5. Enviar al servicio externo
        result = await send_to_xmf(json_ot, auth_token, server_url)
        return result

    except Exception as e:
        logger.exception(f"Error en envío XMF: {e}")
        return {
            "success": False,
            "message": f"Error al enviar a XMF: {str(e)}",
            "details": {"error": str(e)},
        }
