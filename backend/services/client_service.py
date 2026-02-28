"""
Servicio de clientes con persistencia JSON.
Gestiona fichas comerciales vinculadas a usuarios (users.json).
"""
import uuid
import json
import os
from datetime import datetime
from typing import Optional, Dict, Any, List

from config import settings
from services.user_service import user_service
from services.auth_service import hash_password


class ClientService:
    """Gestión de fichas comerciales de clientes"""

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

    def get_all(self) -> List[Dict[str, Any]]:
        """Obtiene todos los clientes con info de usuario"""
        clients = self._load_clients()
        result = []
        for client in clients:
            # Enriquecer con datos del usuario
            user = user_service.get_user_by_id(client["client_id"])
            enriched = {**client}
            if user:
                enriched["username"] = user.get("username", "")
                enriched["email"] = user.get("email", "")
                enriched["full_name"] = user.get("full_name", "")
                enriched["active"] = user.get("active", True)
            result.append(enriched)
        return result

    def get_by_id(self, client_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene un cliente por ID"""
        clients = self._load_clients()
        for client in clients:
            if client["client_id"] == client_id:
                # Enriquecer con datos del usuario
                user = user_service.get_user_by_id(client_id)
                enriched = {**client}
                if user:
                    enriched["username"] = user.get("username", "")
                    enriched["email"] = user.get("email", "")
                    enriched["full_name"] = user.get("full_name", "")
                    enriched["active"] = user.get("active", True)
                return enriched
        return None

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
        """Crea un cliente: usuario (para login) + ficha comercial"""
        # 1. Crear usuario con rol client
        user = user_service.create_user(
            username=username,
            password=password,
            email=email,
            role="client",
            full_name=full_name,
        )

        # 2. Crear ficha comercial
        client = {
            "client_id": user["user_id"],
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

        # Devolver datos combinados
        return {
            **client,
            "username": user["username"],
            "email": user["email"],
            "full_name": user["full_name"],
            "active": user.get("active", True),
        }

    def update(self, client_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Actualiza la ficha comercial de un cliente"""
        clients = self._load_clients()

        # Separar campos de usuario de campos de ficha
        user_fields = {}
        for key in ["username", "email", "full_name", "password", "active"]:
            if key in update_data:
                user_fields[key] = update_data.pop(key)

        # Actualizar usuario si hay campos de usuario
        if user_fields:
            user_service.update_user(client_id, user_fields)

        # Actualizar ficha comercial
        for i, client in enumerate(clients):
            if client["client_id"] == client_id:
                update_data.pop("client_id", None)
                clients[i].update(update_data)
                clients[i]["updated_at"] = datetime.now().isoformat()
                self._save_clients(clients)
                return self.get_by_id(client_id)
        return None

    def delete(self, client_id: str) -> bool:
        """Elimina un cliente: usuario + ficha comercial"""
        # 1. Eliminar ficha comercial
        clients = self._load_clients()
        original_len = len(clients)
        clients = [c for c in clients if c["client_id"] != client_id]
        if len(clients) < original_len:
            self._save_clients(clients)
            # 2. Eliminar usuario
            user_service.delete_user(client_id)
            return True
        return False


# Instancia global
client_service = ClientService()
