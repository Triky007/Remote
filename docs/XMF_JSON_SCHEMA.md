# Esquema JSON para XMF (jdf-maker-back)

Este JSON se envía al servicio externo `jdf-maker-back` a través del endpoint `/api/generate-and-send`.
Previamente, los PDFs se suben al endpoint `/api/upload-pdf` y la URL devuelta se usa en `runlists[].pdf_url`.

## Ejemplo completo

```json
{
  "job_id": "OT-2024-001",
  "descriptive_name": "Catálogo primavera 2024",
  "author": "JDFast",
  "agent_name": "JDFast",
  "agent_version": "3.1",
  "timestamp": "2024-03-01T21:35:00",
  "comment": "Generado a partir del proyecto xxx",
  "product_type": "Revista",
  "job_name": "Catálogo primavera 2024",
  "product_id": "product-uuid",
  "binding_side": "Left",

  "signatures": [
    {
      "signature_ID": "Sig-1",
      "job_part_id_name": "Interior",
      "press_name": "Komori Lithrone 40",
      "assembly_order": "Gathering",
      "color_config": "4/4",
      "color_details": {
        "front": ["Cyan", "Magenta", "Yellow", "Black"],
        "back": ["Cyan", "Magenta", "Yellow", "Black"]
      },
      "stripping_params": {
        "signature_name": "Sig-1",
        "sheets": [
          {
            "sheet_name": "Sheet-1-1-1",
            "bindery_signature_name": "Sig-1-1-1",
            "paper_ref": "paper-uuid",
            "fold_catalog": "F16-7",
            "work_style": "WorkAndBack",
            "strip_cell_params": {
              "trim_size_width": 210.0,
              "trim_size_height": 297.0,
              "bleed_face": 3.0,
              "bleed_foot": 3.0,
              "bleed_head": 3.0,
              "bleed_spine": 3.0,
              "trim_face": 3.0,
              "trim_foot": 3.0,
              "trim_head": 3.0,
              "spine": 0.0,
              "orientation": "Rotate0"
            }
          }
        ]
      }
    }
  ],

  "paper_configs": [
    {
      "weight": 135.0,
      "dimension_width": 1000.0,
      "dimension_height": 700.0,
      "media_type": "Paper",
      "product_id": "paper-uuid",
      "thickness": 100.0,
      "descriptive_name": "Estucado brillo 135g"
    }
  ],

  "runlists": [
    {
      "runlist_id": "RL-1",
      "name": "interior.pdf",
      "pages": 32,
      "page_range": "0 ~ 31",
      "signature_ref": "Sig-1",
      "pdf_url": "https://jdf-maker-back.triky.app/uploads/interior.pdf"
    }
  ],

  "customer_info": {
    "customer_id": "client-uuid",
    "billing_code": "",
    "order_id": "",
    "company_name": "Empresa S.L.",
    "country": "España",
    "region": "Cataluña",
    "city": "Barcelona",
    "street": "Calle Mayor 1",
    "postal_code": "08001",
    "job_title": "",
    "first_name": "Juan",
    "family_name": "García",
    "phone": "934567890",
    "fax": "",
    "email": "juan@empresa.com"
  }
}
```

## Descripción de bloques

| Bloque | Descripción |
|---|---|
| **root** | Identificación del trabajo: `job_id`, nombre, tipo de producto, binding |
| **signatures[]** | Cada "parte" del trabajo (ej: interior, cubierta). Incluye máquina (`press_name`), colores y los pliegos (`sheets`) con esquema de plegado |
| **paper_configs[]** | Catálogo de papeles usados: gramaje, dimensión del pliego, tipo, grosor |
| **runlists[]** | PDFs a imprimir: URL al servidor externo y nº de páginas |
| **customer_info** | Datos del cliente: empresa, dirección, contacto |

## Campos raíz

| Campo | Tipo | Descripción |
|---|---|---|
| `job_id` | string | Identificador del trabajo (ej: "OT-2024-001") |
| `descriptive_name` | string | Descripción corta del trabajo |
| `author` | string | Siempre "JDFast" |
| `agent_name` | string | Siempre "JDFast" |
| `agent_version` | string | Siempre "3.1" |
| `timestamp` | string | Fecha/hora de generación (ISO 8601) |
| `comment` | string | Comentario libre |
| `product_type` | string | Tipo de producto (ej: "Revista", "Folleto") |
| `job_name` | string | Nombre del trabajo |
| `product_id` | string | UUID del producto |
| `binding_side` | string | Lado de encuadernación: "Left", "Right", "Top" |

## Signature

| Campo | Tipo | Descripción |
|---|---|---|
| `signature_ID` | string | ID de la signatura (ej: "Sig-1") |
| `job_part_id_name` | string | Nombre de la parte (ej: "Interior", "Cubierta") |
| `press_name` | string | Nombre de la máquina offset |
| `assembly_order` | string | "Gathering" (alzado) o "Collecting" (encartado) |
| `color_config` | string | Configuración de colores (ej: "4/4", "4/0") |
| `color_details.front` | string[] | Tintas del frente: ["Cyan","Magenta","Yellow","Black"] |
| `color_details.back` | string[] | Tintas del dorso |

## Sheet (dentro de stripping_params.sheets[])

| Campo | Tipo | Descripción |
|---|---|---|
| `sheet_name` | string | Nombre del pliego (ej: "Sheet-1-1-1") |
| `bindery_signature_name` | string | Nombre de signatura de encuadernación |
| `paper_ref` | string | Referencia al papel (debe coincidir con `paper_configs[].product_id`) |
| `fold_catalog` | string | Esquema de plegado XMF (ej: "F16-7", "F8-1", "F4-1") |
| `work_style` | string | "WorkAndBack" (retiración), "WorkAndTurn" (tira y retira), "Flat" (solo tira) |

## Strip Cell Params

| Campo | Tipo | Descripción |
|---|---|---|
| `trim_size_width` | float | Ancho de la página acabada en mm |
| `trim_size_height` | float | Alto de la página acabada en mm |
| `bleed_face` / `bleed_foot` / `bleed_head` / `bleed_spine` | float | Sangrado en mm (normalmente 3.0) |
| `trim_face` / `trim_foot` / `trim_head` | float | Corte en mm (normalmente 3.0) |
| `spine` | float | Lomo en mm |
| `orientation` | string | "Rotate0", "Rotate90", "Rotate180", "Rotate270" |

## Paper Config

| Campo | Tipo | Descripción |
|---|---|---|
| `weight` | float | Gramaje en g/m² (ej: 135.0) |
| `dimension_width` | float | Ancho del pliego de papel en mm (ej: 1000.0 para 70×100) |
| `dimension_height` | float | Alto del pliego de papel en mm (ej: 700.0) |
| `media_type` | string | "Paper", "Board", "Transparency" |
| `product_id` | string | Referencia única del papel |
| `thickness` | float | Grosor en micras (ej: 100.0) |
| `descriptive_name` | string | Nombre descriptivo (ej: "Estucado brillo 135g") |

## RunList

| Campo | Tipo | Descripción |
|---|---|---|
| `runlist_id` | string | ID de la runlist (ej: "RL-1") |
| `name` | string | Nombre del archivo PDF |
| `pages` | int | Número total de páginas |
| `page_range` | string | Rango de páginas (ej: "0 ~ 31") |
| `signature_ref` | string | Referencia a la signatura (ej: "Sig-1") |
| `pdf_url` | string | URL completa del PDF en el servidor externo |

## Customer Info

| Campo | Tipo | Descripción |
|---|---|---|
| `customer_id` | string | ID del cliente |
| `billing_code` | string | Código de facturación |
| `order_id` | string | ID del pedido |
| `company_name` | string | Nombre de la empresa |
| `country` / `region` / `city` / `street` / `postal_code` | string | Dirección |
| `first_name` / `family_name` | string | Nombre y apellido del contacto |
| `phone` / `fax` / `email` | string | Datos de contacto |

## Flujo de envío

1. **Subir PDFs** → `POST /api/upload-pdf` (multipart) → devuelve `{ "url": "https://..." }`
2. **Construir JSON** con las URLs devueltas en `runlists[].pdf_url`
3. **Enviar JSON** → `POST /api/generate-and-send` con Bearer token
