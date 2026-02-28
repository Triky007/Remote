"""
Servicio de usuarios con persistencia JSON.
Patrón MIS user_service.py adaptado a ficheros JSON.
"""
import uuid
import json
import os
from datetime import datetime
from typing import Optional, Dict, Any, List

from config import settings
from services.auth_service import hash_password


class UserService:
    """Gestión de usuarios con persistencia en JSON"""

    def __init__(self):
        self.data_file = os.path.join(settings.DATA_DIR, "users.json")
        self._ensure_data_file()
        self._ensure_admin()

    def _ensure_data_file(self):
        """Crea el fichero de datos si no existe"""
        os.makedirs(settings.DATA_DIR, exist_ok=True)
        if not os.path.exists(self.data_file):
            self._save_users([])

    def _load_users(self) -> List[Dict[str, Any]]:
        """Carga usuarios del fichero JSON"""
        try:
            with open(self.data_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _save_users(self, users: List[Dict[str, Any]]):
        """Guarda usuarios en el fichero JSON"""
        with open(self.data_file, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=2, ensure_ascii=False)

    def _ensure_admin(self):
        """Crea el usuario admin por defecto si no existe"""
        admin = self.get_user_by_username(settings.ADMIN_USERNAME)
        if not admin:
            self.create_user(
                username=settings.ADMIN_USERNAME,
                password=settings.ADMIN_PASSWORD,
                email=settings.ADMIN_EMAIL,
                role="admin",
                full_name="Administrador"
            )
            print(f"✅ Admin user '{settings.ADMIN_USERNAME}' created")

    def get_all_users(self) -> List[Dict[str, Any]]:
        """Obtiene todos los usuarios (sin password_hash)"""
        users = self._load_users()
        return [{k: v for k, v in u.items() if k != "password_hash"} for u in users]

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Obtiene un usuario por ID"""
        users = self._load_users()
        for user in users:
            if user["user_id"] == user_id:
                return user
        return None

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """Obtiene un usuario por username"""
        users = self._load_users()
        for user in users:
            if user["username"] == username:
                return user
        return None

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Obtiene un usuario por email"""
        users = self._load_users()
        for user in users:
            if user.get("email", "").lower() == email.lower():
                return user
        return None

    def create_user(
        self,
        username: str,
        password: str,
        email: str,
        role: str = "client",
        full_name: str = ""
    ) -> Dict[str, Any]:
        """Crea un nuevo usuario"""
        # Verificar duplicados
        if self.get_user_by_username(username):
            raise ValueError(f"El usuario '{username}' ya existe")
        if email and self.get_user_by_email(email):
            raise ValueError(f"El email '{email}' ya está registrado")

        user = {
            "user_id": str(uuid.uuid4()),
            "username": username,
            "password_hash": hash_password(password),
            "email": email,
            "role": role,
            "full_name": full_name,
            "active": True,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }

        users = self._load_users()
        users.append(user)
        self._save_users(users)

        # Devolver sin password_hash
        return {k: v for k, v in user.items() if k != "password_hash"}

    def update_user(self, user_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Actualiza un usuario"""
        users = self._load_users()
        for i, user in enumerate(users):
            if user["user_id"] == user_id:
                # No permitir cambiar user_id ni password_hash directamente
                for key in ["user_id", "password_hash"]:
                    update_data.pop(key, None)

                if "password" in update_data:
                    users[i]["password_hash"] = hash_password(update_data.pop("password"))

                users[i].update(update_data)
                users[i]["updated_at"] = datetime.now().isoformat()
                self._save_users(users)
                return {k: v for k, v in users[i].items() if k != "password_hash"}
        return None

    def delete_user(self, user_id: str) -> bool:
        """Elimina un usuario"""
        users = self._load_users()
        original_len = len(users)
        users = [u for u in users if u["user_id"] != user_id]
        if len(users) < original_len:
            self._save_users(users)
            return True
        return False


# Instancia global
user_service = UserService()
