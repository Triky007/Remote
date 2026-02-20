# Remote PDF Review

Sistema de revisión remota de artes finales PDF con análisis preflight integrado.

## Tech Stack

| Componente | Tecnología |
|---|---|
| **Backend** | FastAPI (Python) |
| **Frontend** | React 18 + Vite + Material UI |
| **Autenticación** | JWT + Magic Links |
| **Persistencia** | JSON files |
| **Preflight** | pikepdf + PyPDF2 |

## Estructura

```
Remote/
├── backend/          # FastAPI API (port 3888)
│   ├── main.py       # Entry point
│   ├── config.py     # Settings (pydantic-settings)
│   ├── routes/       # API endpoints
│   ├── services/     # Business logic
│   └── models/       # Pydantic models
└── frontend/         # React SPA (port 4888)
    └── src/
        ├── pages/    # Admin & Client views
        ├── components/
        ├── context/  # Auth context
        └── api/      # Axios service
```

## Inicio rápido

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
python main.py               # http://localhost:3888
```

### Frontend

```bash
cd frontend
npm install
npm run dev                  # http://localhost:4888
```

### Credenciales por defecto

- **Usuario:** `admin`
- **Contraseña:** `admin123`

## Funcionalidades

- **Autenticación** — Login con usuario/contraseña y magic links (invitación por email)
- **Gestión de usuarios** — Admin crea clientes, envía invitaciones
- **Gestión de proyectos** — CRUD, estados, asignación a clientes
- **Upload de PDFs** — Subida múltiple con validación
- **Preflight PDF** — Análisis completo:
  - Fuentes embebidas
  - Espacios de color (CMYK, RGB, tintas planas)
  - Resolución de imágenes
  - Page boxes (TrimBox, BleedBox, sangrado)
  - Transparencias
  - Líneas finas (hairlines)
  - Conformidad PDF/X
  - Encriptación
- **Comentarios** — Sistema de comentarios por proyecto y por PDF
- **Dashboards** — Vistas diferenciadas para admin y cliente

## API Docs

Con el backend corriendo: [http://localhost:3888/docs](http://localhost:3888/docs)

## Licencia

Privado — Todos los derechos reservados.
