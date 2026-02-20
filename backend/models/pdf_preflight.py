"""
Pydantic models para preflight PDF.
Adaptado del MIS models/pdf_preflight.py.
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any, List


class PreflightResponse(BaseModel):
    success: bool
    status: str
    analyzed_at: str
    summary: Dict[str, Any]
    errors: list
    warnings: list
    info: list
    pdf_name: Optional[str] = None
    filename: Optional[str] = None
