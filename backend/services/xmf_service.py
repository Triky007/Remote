"""
Servicio XMF — genera el JSON_OT y lo envía al servicio externo jdf-maker-back.
"""
import os
import json
import logging
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

from config import settings

logger = logging.getLogger(__name__)

# ─── Lookup tables ────────────────────────────────────────────────────────────

SIZE_MM: Dict[str, tuple] = {
    "A5": (148.0, 210.0),
    "A4": (210.0, 297.0),
    "A3": (297.0, 420.0),
    "A2": (420.0, 594.0),
    "A1": (594.0, 841.0),
    "A0": (841.0, 1189.0),
    "Carta": (216.0, 279.0),
    "Legal": (216.0, 356.0),
    "SRA3": (320.0, 450.0),
    "SRA2": (450.0, 640.0),
    "70x100": (700.0, 1000.0),
    "Personalizado": (210.0, 297.0),  # fallback
}

PAPER_SIZE_MM: Dict[str, tuple] = {
    "A5": (148.0, 210.0),
    "A4": (210.0, 297.0),
    "A3": (297.0, 420.0),
    "SRA3": (320.0, 450.0),
    "A2": (420.0, 594.0),
    "SRA2": (450.0, 640.0),
    "70x100": (700.0, 1000.0),
    "Personalizado": (700.0, 1000.0),
}

BINDING_TO_ASSEMBLY: Dict[str, str] = {
    "none": "Gathering",
    "stapled": "Gathering",
    "perfect": "Collecting",
    "sewn": "Collecting",
    "spiral": "Collecting",
    "wire-o": "Collecting",
}


def _parse_colors(color_str: str) -> tuple:
    """Parses '4/4' → (4, 4), '4/0' → (4, 0)"""
    try:
        parts = color_str.split("/")
        return int(parts[0]), int(parts[1])
    except Exception:
        return 4, 4


def _build_color_names(n: int) -> List[str]:
    """Returns ink names for n colors."""
    if n == 0:
        return []
    if n == 1:
        return ["Black"]
    if n == 2:
        return ["Black", "Spot1"]
    names = ["Cyan", "Magenta", "Yellow", "Black"]
    for i in range(5, n + 1):
        names.append(f"Spot{i - 4}")
    return names


# ─── JSON builder ─────────────────────────────────────────────────────────────

def build_xmf_json(
    project: Dict[str, Any],
    machines: List[Dict[str, Any]],
    client_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Builds the XMF JSON_OT payload from a Remote project.
    """
    pi = project.get("product_info", {}) or {}
    colors = pi.get("colors", "4/4")
    front_colors, back_colors = _parse_colors(colors)
    binding = pi.get("binding", "none")
    assembly_order = BINDING_TO_ASSEMBLY.get(binding, "Gathering")
    page_size = pi.get("size", "A4")
    trim_w, trim_h = SIZE_MM.get(page_size, SIZE_MM["A4"])
    paper_name = pi.get("paper", "Papel estándar")
    paper_size_name = pi.get("paper_size", "SRA3")
    paper_w, paper_h = PAPER_SIZE_MM.get(paper_size_name, PAPER_SIZE_MM["SRA3"])

    machine_map = {m["machine_id"]: m for m in machines}

    # ── Signatures (one per offset process) ──
    signatures = []
    sig_idx = 1
    for proc in project.get("processes", []):
        machine = machine_map.get(proc.get("machine_id", ""))
        if not machine or machine.get("type") != "offset":
            continue

        fold_schemes = proc.get("fold_schemes", [])
        if not fold_schemes:
            fold_schemes = [{"fold_catalog": "F16", "total_sheets": 1, "is_duplex": False}]

        sheets = []
        scheme_idx = 1
        for scheme in fold_schemes:
            fold_catalog = scheme.get("fold_catalog", "F16")
            total_sheets = scheme.get("total_sheets", 1)
            is_duplex = scheme.get("is_duplex", False)

            # work_style
            if back_colors == 0:
                work_style = "Flat"
            elif is_duplex:
                work_style = "WorkAndTurn"
            else:
                work_style = "WorkAndBack"

            for pliego in range(1, total_sheets + 1):
                sheets.append({
                    "sheet_name": f"Sheet-{sig_idx}-{scheme_idx}-{pliego}",
                    "bindery_signature_name": f"Sig-{sig_idx}-{scheme_idx}-{pliego}",
                    "paper_ref": paper_name,
                    "fold_catalog": fold_catalog,
                    "work_style": work_style,
                    "strip_cell_params": {
                        "trim_size_width": trim_w,
                        "trim_size_height": trim_h,
                        "bleed_face": 3.0,
                        "bleed_foot": 3.0,
                        "bleed_head": 3.0,
                        "bleed_spine": 3.0,
                        "trim_face": 3.0,
                        "trim_foot": 3.0,
                        "trim_head": 3.0,
                        "spine": 0.0,
                        "orientation": "Rotate0",
                    },
                })
                scheme_idx += 1

        signatures.append({
            "signature_ID": f"Sig-{sig_idx}",
            "job_part_id_name": proc.get("name", "Impresión"),
            "press_name": machine.get("name", "Offset"),
            "assembly_order": assembly_order,
            "color_config": colors,
            "color_details": {
                "front": _build_color_names(front_colors),
                "back": _build_color_names(back_colors),
            },
            "stripping_params": {
                "signature_name": f"Sig-{sig_idx}",
                "sheets": sheets,
            },
        })
        sig_idx += 1

    # ── Paper configs ──
    paper_configs = [{
        "weight": 80.0,
        "dimension_width": paper_w,
        "dimension_height": paper_h,
        "media_type": "Paper",
        "product_id": paper_name,
        "thickness": 100.0,
        "descriptive_name": paper_name,
    }]

    # ── Runlists (from PDFs) ──
    runlists = []
    for idx, pdf in enumerate(project.get("pdfs", []), 1):
        pages = pdf.get("page_count", 1)
        runlists.append({
            "runlist_id": f"RL-{idx}",
            "name": pdf.get("original_filename", pdf.get("filename", f"PDF-{idx}")),
            "pages": pages,
            "page_range": f"0 ~ {pages - 1}",
            "signature_ref": "Sig-1",
            "pdf_url": "",  # Filled after upload to external service
        })

    # ── Customer info ──
    customer_info = None
    ci = project.get("client_info", {}) or {}
    if client_data:
        ci = {**ci, **{k: v for k, v in client_data.items() if k != "password_hash"}}
    if ci:
        customer_info = {
            "customer_id": ci.get("client_id", ci.get("user_id", "")),
            "billing_code": "",
            "order_id": "",
            "company_name": ci.get("company_name", ""),
            "country": ci.get("country", ""),
            "region": ci.get("region", ""),
            "city": ci.get("city", ""),
            "street": ci.get("address", ""),
            "postal_code": ci.get("postal_code", ""),
            "first_name": ci.get("contact_person", ci.get("full_name", "")).split(" ")[0] if ci.get("contact_person") or ci.get("full_name") else "",
            "family_name": " ".join((ci.get("contact_person", ci.get("full_name", ""))).split(" ")[1:]) if ci.get("contact_person") or ci.get("full_name") else "",
            "phone": ci.get("phone", ""),
            "fax": "",
            "email": ci.get("email", ci.get("notification_email", "")),
        }

    # ── Root JSON_OT ──
    json_ot = {
        "job_id": project.get("name", project.get("project_id", "")),
        "descriptive_name": project.get("description", ""),
        "author": "JDFast",
        "agent_name": "JDFast",
        "agent_version": "3.1",
        "timestamp": datetime.now().isoformat(),
        "comment": f"Generado desde Remote — proyecto {project.get('project_id', '')}",
        "product_type": pi.get("product", ""),
        "job_name": project.get("name", ""),
        "product_id": project.get("project_id", ""),
        "binding_side": "Left",
        "signatures": signatures,
        "paper_configs": paper_configs,
    }

    if runlists:
        json_ot["runlists"] = runlists
    if customer_info:
        json_ot["customer_info"] = customer_info

    return json_ot


# ─── Auth ─────────────────────────────────────────────────────────────────────

async def get_auth_token() -> str:
    """Gets JWT token from external auth service. In test mode, generates a local one."""
    if settings.XMF_TEST_MODE:
        logger.info("XMF test mode — generating local token")
        import jwt as pyjwt
        payload = {
            "sub": settings.XMF_AUTH_USERNAME,
            "exp": datetime.utcnow() + timedelta(hours=1),
            "iat": datetime.utcnow(),
            "test_mode": True,
        }
        secret = os.getenv("SECRET_KEY", "test-secret")
        return pyjwt.encode(payload, secret, algorithm="HS256")

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            settings.XMF_AUTH_URL,
            json={"username": settings.XMF_AUTH_USERNAME, "password": settings.XMF_AUTH_PASSWORD},
            headers={"Content-Type": "application/json"},
        )
        if resp.status_code != 200:
            raise Exception(f"Auth failed: {resp.status_code} — {resp.text}")
        data = resp.json()
        for key in ("access_token", "token", "jwt", "id_token", "accessToken"):
            if key in data:
                return data[key]
        raise Exception("No token found in auth response")


# ─── Upload PDF ───────────────────────────────────────────────────────────────

async def upload_pdf_to_xmf(pdf_path: str, auth_token: str, server_url: str) -> Dict[str, Any]:
    """Uploads a PDF to the external XMF service and returns the result."""
    upload_url = f"{server_url.rstrip('/')}/api/upload-pdf"
    filename = os.path.basename(pdf_path)

    with open(pdf_path, "rb") as f:
        content = f.read()

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            upload_url,
            files={"file": (filename, content, "application/pdf")},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        if resp.status_code in (200, 201):
            return resp.json()
        raise Exception(f"PDF upload failed: {resp.status_code} — {resp.text}")


# ─── Send JSON to XMF ────────────────────────────────────────────────────────

async def send_to_xmf(json_data: Dict[str, Any], auth_token: str, server_url: str) -> Dict[str, Any]:
    """Sends the XMF JSON to the external service."""
    send_url = f"{server_url.rstrip('/')}/api/generate-and-send"

    if settings.XMF_TEST_MODE:
        logger.info("XMF test mode — simulating send")
        # Save locally
        xmf_dir = os.path.join(settings.DATA_DIR, "xmf")
        os.makedirs(xmf_dir, exist_ok=True)
        job_id = json_data.get("job_id", "unknown")
        path = os.path.join(xmf_dir, f"xmf_{job_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        return {
            "success": True,
            "message": "XMF enviado correctamente (simulado — test mode)",
            "details": {
                "job_id": job_id,
                "status": "processed",
                "timestamp": datetime.now().isoformat(),
                "test_mode": True,
                "saved_to": path,
            },
        }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            send_url,
            json=json_data,
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json",
            },
        )
        if resp.status_code == 200:
            return {"success": True, "message": "XMF enviado correctamente", "details": resp.json()}
        return {"success": False, "message": f"Error {resp.status_code}", "details": {"error": resp.text}}
