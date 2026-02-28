"""
Servicio de clientes con persistencia JSON.
Cada cliente tiene datos de autenticación + ficha comercial, todo en clients.json.
users.json queda reservado exclusivamente para administradores.
"""
import uuid
import json
import os
from datetime import datetime
from typing import Optional, Dict, Any, List

from config import settings
from services.auth_service import hash_password


class ClientService:
    """Gestión autónoma de clientes (auth + ficha comercial) en clients.json"""

    def __init__(self):
        self.data_file = os.path.join(settings.DATA_DIR, "clients.json")
        self._ensure_data_file()

    def _ensure_data_file(self):
        os.makedirs(settings.DATA_DIR, exist_ok=True)
        if not os.path.exists(self.data_file):
            self._save_clients([])

    def _load_clients(self) -> List[Dict[str, Any]]:
        try:
            with open(self.data_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _save_clients(self, clients: List[Dict[str, Any]]):
        with open(self.data_file, "w", encoding="utf-8") as f:
            json.dump(clients, f, indent=2, ensure_ascii=False)

    def _sanitize(self, client: Dict[str, Any]) -> Dict[str, Any]:
        """Devuelve cliente sin password_hash, con user_id alias"""
        result = {k: v for k, v in client.items() if k != "password_hash"}
        # Alias para backward compatibility con frontend que usa user_id
        result["user_id"] = result.get("client_id", "")
        return result

    # ─── Lookups (usados por auth_service) ────────────────────────────────────

    def get_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """Busca un cliente por username (incluye password_hash para auth)"""
        clients = self._load_clients()
        for c in clients:
            if c.get("username") == username:
                return c
        return None

    def get_by_id(self, client_id: str) -> Optional[Dict[str, Any]]:
        """Busca un cliente por ID (incluye password_hash para auth)"""
        clients = self._load_clients()
        for c in clients:
            if c["client_id"] == client_id:
                return c
        return None

    def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Busca un cliente por email"""
        clients = self._load_clients()
        for c in clients:
            if c.get("email", "").lower() == email.lower():
                return c
        return None

    # ─── CRUD ─────────────────────────────────────────────────────────────────

    def get_all(self) -> List[Dict[str, Any]]:
        """Obtiene todos los clientes (sin password_hash)"""
        return [self._sanitize(c) for c in self._load_clients()]

    def get_by_id_safe(self, client_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene un cliente por ID sin password_hash"""
        c = self.get_by_id(client_id)
        return self._sanitize(c) if c else None

    def create(
        self,
        username: str,
        password: str,
        email: str,
        full_name: str = "",
        company_name: str = "",
        cif: str = "",
        notification_email: str = "",
        address: str = "",
        city: str = "",
        postal_code: str = "",
        phone: str = "",
        contact_person: str = "",
        notes: str = "",
    ) -> Dict[str, Any]:
        """Crea un nuevo cliente (auth + ficha comercial)"""
        # Verificar duplicados (también en users.json para admins)
        if self.get_by_username(username):
            raise ValueError(f"El usuario '{username}' ya existe")
        from services.user_service import user_service
        if user_service.get_user_by_username(username):
            raise ValueError(f"El usuario '{username}' ya existe como administrador")
        if email and self.get_by_email(email):
            raise ValueError(f"El email '{email}' ya está registrado")

        client = {
            # Auth fields
            "client_id": str(uuid.uuid4()),
            "username": username,
            "password_hash": hash_password(password),
            "email": email,
            "role": "client",
            "full_name": full_name,
            "active": True,
            # Commercial fields
            "company_name": company_name,
            "cif": cif,
            "notification_email": notification_email or email,
            "address": address,
            "city": city,
            "postal_code": postal_code,
            "phone": phone,
            "contact_person": contact_person or full_name,
            "notes": notes,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }

        clients = self._load_clients()
        clients.append(client)
        self._save_clients(clients)
        return self._sanitize(client)

    def update(self, client_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Actualiza un cliente"""
        clients = self._load_clients()
        for i, client in enumerate(clients):
            if client["client_id"] == client_id:
                update_data.pop("client_id", None)
                update_data.pop("password_hash", None)

                # Handle password change
                if "password" in update_data:
                    pwd = update_data.pop("password")
                    if pwd:
                        clients[i]["password_hash"] = hash_password(pwd)

                clients[i].update(update_data)
                clients[i]["updated_at"] = datetime.now().isoformat()
                self._save_clients(clients)
                return self._sanitize(clients[i])
        return None

    def delete(self, client_id: str) -> bool:
        """Elimina un cliente"""
        clients = self._load_clients()
        original_len = len(clients)
        clients = [c for c in clients if c["client_id"] != client_id]
        if len(clients) < original_len:
            self._save_clients(clients)
            return True
        return False


# Instancia global
client_service = ClientService()
