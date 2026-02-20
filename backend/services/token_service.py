"""
Servicio de magic tokens para acceso remoto.
Patrón MIS w2p_access_token_service.py adaptado a JSON.
"""
import secrets
import json
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from config import settings


class TokenService:
    """Gestión de magic tokens con persistencia JSON"""

    DEFAULT_EXPIRY_HOURS = 72
    DEFAULT_MAX_USES = 10

    def __init__(self):
        self.data_file = os.path.join(settings.DATA_DIR, "tokens.json")
        self._ensure_data_file()

    def _ensure_data_file(self):
        os.makedirs(settings.DATA_DIR, exist_ok=True)
        if not os.path.exists(self.data_file):
            self._save_tokens([])

    def _load_tokens(self) -> List[Dict[str, Any]]:
        try:
            with open(self.data_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _save_tokens(self, tokens: List[Dict[str, Any]]):
        with open(self.data_file, "w", encoding="utf-8") as f:
            json.dump(tokens, f, indent=2, ensure_ascii=False)

    def generate_token(
        self,
        user_id: str,
        user_email: str,
        project_id: Optional[str] = None,
        expiry_hours: Optional[int] = None,
        max_uses: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Genera un magic token para acceso directo.
        
        Returns:
            Dict con token, url, expiración
        """
        token = secrets.token_urlsafe(32)
        exp_hours = expiry_hours or self.DEFAULT_EXPIRY_HOURS
        m_uses = max_uses or self.DEFAULT_MAX_USES
        expires_at = (datetime.now() + timedelta(hours=exp_hours)).isoformat()

        token_doc = {
            "token": token,
            "user_id": user_id,
            "user_email": user_email,
            "project_id": project_id,
            "created_at": datetime.now().isoformat(),
            "expires_at": expires_at,
            "use_count": 0,
            "max_uses": m_uses,
            "last_used_at": None,
            "active": True
        }

        tokens = self._load_tokens()
        tokens.append(token_doc)
        self._save_tokens(tokens)

        magic_url = f"{settings.FRONTEND_URL}/login?token={token}"

        return {
            "token": token,
            "magic_url": magic_url,
            "expires_at": expires_at,
            "expires_in_hours": exp_hours,
            "max_uses": m_uses,
            "user_id": user_id
        }

    def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Valida un magic token e incrementa uso.
        Returns dict con user_id y project_id si válido, None si no.
        """
        tokens = self._load_tokens()
        now = datetime.now()

        for i, t in enumerate(tokens):
            if t["token"] != token:
                continue

            if not t.get("active", True):
                return None

            # Check expiry
            expires_at = datetime.fromisoformat(t["expires_at"])
            if now > expires_at:
                return None

            # Check uses
            if t["use_count"] >= t["max_uses"]:
                return None

            # Valid! Increment use
            tokens[i]["use_count"] += 1
            tokens[i]["last_used_at"] = now.isoformat()
            self._save_tokens(tokens)

            return {
                "valid": True,
                "user_id": t["user_id"],
                "user_email": t["user_email"],
                "project_id": t.get("project_id"),
                "remaining_uses": t["max_uses"] - t["use_count"] - 1
            }

        return None

    def revoke_token(self, token: str) -> bool:
        """Revoca un token"""
        tokens = self._load_tokens()
        for i, t in enumerate(tokens):
            if t["token"] == token:
                tokens[i]["active"] = False
                self._save_tokens(tokens)
                return True
        return False

    def cleanup_expired(self) -> int:
        """Elimina tokens expirados"""
        tokens = self._load_tokens()
        now = datetime.now()
        original = len(tokens)
        tokens = [
            t for t in tokens
            if datetime.fromisoformat(t["expires_at"]) > now
        ]
        removed = original - len(tokens)
        if removed > 0:
            self._save_tokens(tokens)
        return removed

    def get_tokens_for_user(self, user_id: str) -> List[Dict[str, Any]]:
        """Obtiene tokens activos de un usuario"""
        tokens = self._load_tokens()
        now = datetime.now()
        return [
            {k: v for k, v in t.items() if k != "token"}  # No exponer el token completo
            for t in tokens
            if t["user_id"] == user_id
            and t.get("active", True)
            and datetime.fromisoformat(t["expires_at"]) > now
        ]


# Instancia global
token_service = TokenService()
