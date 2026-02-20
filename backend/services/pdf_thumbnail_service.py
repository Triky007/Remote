"""
Servicio de thumbnails para páginas de PDF.
Usa pdf2image (poppler) + Pillow para generar miniaturas.
Adaptado del MIS pdf_thumbnail_service.py.
"""
import base64
import io
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

try:
    from pdf2image import convert_from_path
    PDF2IMAGE_AVAILABLE = True
except ImportError:
    PDF2IMAGE_AVAILABLE = False


class PdfThumbnailService:

    def _get_poppler_path(self):
        """En Windows necesita poppler en el PATH o ruta explícita"""
        if os.name == 'nt':
            # Buscar poppler en ubicaciones comunes de Windows
            common_paths = [
                r"C:\poppler\poppler-24.08.0\Library\bin",
                r"C:\Program Files\poppler\bin",
                r"C:\poppler\bin",
            ]
            for p in common_paths:
                if os.path.isdir(p):
                    return p
        return None

    def _placeholder_base64(self, page_number: int, width: int) -> str:
        """Genera un placeholder cuando no se puede renderizar la página"""
        height = int(width * 1.414)
        img = Image.new('RGB', (width, height), color='#f5f5f5')
        draw = ImageDraw.Draw(img)

        draw.rectangle([(5, 5), (width - 5, height - 5)], outline='#cccccc', width=2)

        try:
            font = ImageFont.truetype("arial.ttf", 40)
        except Exception:
            font = ImageFont.load_default()

        text = str(page_number)
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        draw.text(((width - text_w) // 2, (height - text_h) // 2), text, fill='#666666', font=font)

        try:
            small_font = ImageFont.truetype("arial.ttf", 16)
        except Exception:
            small_font = ImageFont.load_default()

        label = "Pág."
        bbox_s = draw.textbbox((0, 0), label, font=small_font)
        label_w = bbox_s[2] - bbox_s[0]
        draw.text(((width - label_w) // 2, (height - text_h) // 2 - 30), label, fill='#999999', font=small_font)

        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=85)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode()

    def get_page_thumbnail(self, pdf_path: Path, page_number: int, width: int = 400) -> dict:
        """Genera thumbnail JPEG base64 de una página del PDF"""
        if not pdf_path.exists():
            return {"page_number": page_number, "thumbnail": None, "error": "PDF no encontrado"}

        if not PDF2IMAGE_AVAILABLE:
            img_b64 = self._placeholder_base64(page_number, width)
            return {
                "page_number": page_number,
                "thumbnail": f"data:image/jpeg;base64,{img_b64}",
                "placeholder": True
            }

        try:
            poppler_path = self._get_poppler_path()
            kwargs = {
                "pdf_path": str(pdf_path),
                "first_page": page_number,
                "last_page": page_number,
                "dpi": 100,
            }
            if poppler_path:
                kwargs["poppler_path"] = poppler_path

            images = convert_from_path(**kwargs)

            if not images:
                raise Exception("No se pudo convertir la página")

            img = images[0]

            # Resize manteniendo aspect ratio
            aspect = img.height / img.width
            new_width = width
            new_height = int(width * aspect)
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

            buf = io.BytesIO()
            img.save(buf, format='JPEG', quality=85, optimize=True)
            buf.seek(0)
            img_b64 = base64.b64encode(buf.read()).decode()

            return {
                "page_number": page_number,
                "thumbnail": f"data:image/jpeg;base64,{img_b64}"
            }

        except Exception as e:
            print(f"❌ Error generando thumbnail página {page_number}: {e}")
            img_b64 = self._placeholder_base64(page_number, width)
            return {
                "page_number": page_number,
                "thumbnail": f"data:image/jpeg;base64,{img_b64}",
                "placeholder": True
            }

    def get_page_count(self, pdf_path: Path) -> int:
        """Obtiene el número de páginas de un PDF"""
        try:
            import pikepdf
            with pikepdf.open(pdf_path) as pdf:
                return len(pdf.pages)
        except Exception:
            try:
                import PyPDF2
                with open(pdf_path, 'rb') as f:
                    reader = PyPDF2.PdfReader(f)
                    return len(reader.pages)
            except Exception:
                return 0


pdf_thumbnail_service = PdfThumbnailService()
