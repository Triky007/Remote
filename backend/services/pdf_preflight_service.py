"""
Servicio de preflight PDF adaptado del MIS.
Análisis completo con pikepdf + PyPDF2.
"""
import io
import math
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

try:
    import pikepdf
    PIKEPDF_AVAILABLE = True
except ImportError:
    PIKEPDF_AVAILABLE = False

try:
    import PyPDF2
    PYPDF2_AVAILABLE = True
except ImportError:
    PYPDF2_AVAILABLE = False


class PreflightCheck:
    """Representa un chequeo individual de preflight"""
    def __init__(self, code: str, message: str, severity: str, page: Optional[int] = None, details: Optional[Dict] = None):
        self.code = code
        self.message = message
        self.severity = severity  # "error", "warning", "info"
        self.page = page
        self.details = details or {}

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "code": self.code,
            "message": self.message,
            "severity": self.severity
        }
        if self.page is not None:
            result["page"] = self.page
        if self.details:
            result["details"] = self.details
        return result


class PreflightResult:
    """Resultado completo del análisis preflight"""
    def __init__(self):
        self.checks: List[PreflightCheck] = []
        self.summary: Dict[str, Any] = {}
        self.analyzed_at: str = datetime.now().isoformat()

    def add_check(self, check: PreflightCheck):
        self.checks.append(check)

    def add_error(self, code: str, message: str, page: Optional[int] = None, details: Optional[Dict] = None):
        self.add_check(PreflightCheck(code, message, "error", page, details))

    def add_warning(self, code: str, message: str, page: Optional[int] = None, details: Optional[Dict] = None):
        self.add_check(PreflightCheck(code, message, "warning", page, details))

    def add_info(self, code: str, message: str, page: Optional[int] = None, details: Optional[Dict] = None):
        self.add_check(PreflightCheck(code, message, "info", page, details))

    @property
    def status(self) -> str:
        has_errors = any(c.severity == "error" for c in self.checks)
        has_warnings = any(c.severity == "warning" for c in self.checks)
        if has_errors:
            return "FAIL"
        elif has_warnings:
            return "WARN"
        return "PASS"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "analyzed_at": self.analyzed_at,
            "summary": self.summary,
            "errors": [c.to_dict() for c in self.checks if c.severity == "error"],
            "warnings": [c.to_dict() for c in self.checks if c.severity == "warning"],
            "info": [c.to_dict() for c in self.checks if c.severity == "info"]
        }


class PdfPreflightService:
    """Servicio de análisis preflight adaptado del MIS"""

    DEFAULT_BLEED_TOLERANCE_MM = 2.5
    DEFAULT_MIN_IMAGE_DPI = 149
    DEFAULT_MIN_LINE_WIDTH_PT = 0.25
    RECOMMENDED_IMAGE_DPI = 300

    def __init__(self):
        self._result_cache = {}

    def analyze_pdf(self, pdf_path: Path,
                    bleed_tolerance_mm: float = None,
                    min_image_dpi: int = None,
                    min_line_width_pt: float = None) -> PreflightResult:
        """Analiza un PDF y devuelve el resultado del preflight"""
        result = PreflightResult()

        if not pdf_path.exists():
            result.add_error("FILE_NOT_FOUND", f"El archivo no existe: {pdf_path}")
            return result

        # Cache
        cache_key = self._get_cache_key(pdf_path)
        if cache_key and cache_key in self._result_cache:
            return self._result_cache[cache_key]

        bleed_tol = bleed_tolerance_mm or self.DEFAULT_BLEED_TOLERANCE_MM
        min_dpi = min_image_dpi or self.DEFAULT_MIN_IMAGE_DPI
        min_lw = min_line_width_pt or self.DEFAULT_MIN_LINE_WIDTH_PT

        try:
            if PIKEPDF_AVAILABLE:
                self._analyze_with_pikepdf(pdf_path, result, bleed_tol, min_dpi, min_lw)

            if PYPDF2_AVAILABLE:
                self._analyze_with_pypdf2(pdf_path, result)

            # File size info
            file_size = pdf_path.stat().st_size
            result.summary["file_size_bytes"] = file_size
            result.summary["file_size_mb"] = round(file_size / (1024 * 1024), 2)

            print(f"✅ Preflight completado para {pdf_path.name}: {result.status}")

            if cache_key:
                self._result_cache[cache_key] = result

        except Exception as e:
            print(f"❌ Error en preflight de {pdf_path}: {e}")
            result.add_error("ANALYSIS_ERROR", f"Error al analizar el PDF: {str(e)}")

        return result

    def _get_cache_key(self, pdf_path: Path):
        try:
            stat = pdf_path.stat()
            return (str(pdf_path), stat.st_size, stat.st_mtime)
        except OSError:
            return None

    def _analyze_with_pikepdf(self, pdf_path: Path, result: PreflightResult,
                               bleed_tolerance: float, min_dpi: int, min_lw: float):
        with pikepdf.open(pdf_path) as pdf:
            num_pages = len(pdf.pages)
            result.summary["pages"] = num_pages
            result.add_info("PAGE_COUNT", f"El documento tiene {num_pages} página(s)")

            # Version
            pdf_version = str(pdf.pdf_version)
            result.summary["pdf_version"] = pdf_version
            result.add_info("PDF_VERSION", f"Versión PDF: {pdf_version}")

            # PDF/X compliance
            self._check_pdfx_compliance(pdf, result)

            # Page boxes
            self._check_page_boxes(pdf, result, bleed_tolerance)

            # Fonts
            self._check_fonts(pdf, result)

            # Color spaces
            self._check_color_spaces(pdf, result)

            # Transparency
            self._check_transparency(pdf, result)

            # Images
            self._check_images(pdf, result, min_dpi)

            # Hairlines
            self._check_hairlines(pdf, result, min_lw)

    def _check_pdfx_compliance(self, pdf, result: PreflightResult):
        try:
            root = pdf.Root
            has_output_intent = False

            if "/OutputIntents" in root:
                output_intents = root["/OutputIntents"]
                if len(output_intents) > 0:
                    has_output_intent = True
                    first_intent = output_intents[0]
                    intent_subtype = str(first_intent.get("/S", "")) if "/S" in first_intent else ""
                    output_condition = str(first_intent.get("/OutputConditionIdentifier", "")) if "/OutputConditionIdentifier" in first_intent else ""

                    output_intent_info = {"subtype": intent_subtype, "condition": output_condition}
                    result.summary["output_intent"] = output_intent_info
                    result.add_info("OUTPUT_INTENT", f"OutputIntent encontrado: {output_condition}", details=output_intent_info)

            result.summary["has_output_intent"] = has_output_intent
            if not has_output_intent:
                result.add_warning("NO_OUTPUT_INTENT", "El PDF no tiene OutputIntent definido. Se recomienda para flujos PDF/X.")

            # Check PDF/X version in metadata
            pdfx_version = None
            if "/Metadata" in root:
                try:
                    metadata = root["/Metadata"].read_bytes()
                    metadata_str = metadata.decode("utf-8", errors="ignore")
                    if "PDF/X-4" in metadata_str:
                        pdfx_version = "PDF/X-4"
                    elif "PDF/X-3" in metadata_str:
                        pdfx_version = "PDF/X-3"
                    elif "PDF/X-1a" in metadata_str:
                        pdfx_version = "PDF/X-1a"
                    elif "PDF/X" in metadata_str:
                        pdfx_version = "PDF/X (versión no especificada)"
                except:
                    pass

            if pdfx_version:
                result.summary["pdfx_version"] = pdfx_version
                result.add_info("PDFX_CONFORMANCE", f"Conformidad detectada: {pdfx_version}")
            else:
                result.summary["pdfx_version"] = None

        except Exception as e:
            print(f"Error al verificar PDF/X: {e}")

    def _check_page_boxes(self, pdf, result: PreflightResult, bleed_tolerance_mm: float):
        page_sizes = []
        has_trimbox = True
        has_bleedbox = True

        for i, page in enumerate(pdf.pages, start=1):
            mediabox = page.get("/MediaBox")
            if mediabox:
                width_pts = float(mediabox[2]) - float(mediabox[0])
                height_pts = float(mediabox[3]) - float(mediabox[1])
                width_mm = round(width_pts * 0.352778, 2)
                height_mm = round(height_pts * 0.352778, 2)
                page_size = f"{width_mm}x{height_mm} mm"
                if page_size not in page_sizes:
                    page_sizes.append(page_size)

            trimbox = page.get("/TrimBox")
            if not trimbox:
                has_trimbox = False
                result.add_warning("NO_TRIMBOX", f"La página {i} no tiene TrimBox definido.", page=i)

            bleedbox = page.get("/BleedBox")
            if not bleedbox:
                has_bleedbox = False
                if trimbox:
                    result.add_info("NO_BLEEDBOX", f"La página {i} no tiene BleedBox explícito.", page=i)
            elif trimbox:
                trim_width = float(trimbox[2]) - float(trimbox[0])
                trim_height = float(trimbox[3]) - float(trimbox[1])
                bleed_width = float(bleedbox[2]) - float(bleedbox[0])
                bleed_height = float(bleedbox[3]) - float(bleedbox[1])

                bleed_h = (bleed_width - trim_width) / 2 * 0.352778
                bleed_v = (bleed_height - trim_height) / 2 * 0.352778
                min_bleed = min(bleed_h, bleed_v)

                if min_bleed < bleed_tolerance_mm:
                    result.add_warning(
                        "INSUFFICIENT_BLEED",
                        f"Página {i}: sangrado insuficiente ({min_bleed:.1f}mm). Mínimo 3mm recomendado.",
                        page=i,
                        details={"bleed_h_mm": round(bleed_h, 2), "bleed_v_mm": round(bleed_v, 2)}
                    )

        result.summary["page_sizes"] = page_sizes
        result.summary["has_trimbox"] = has_trimbox
        result.summary["has_bleedbox"] = has_bleedbox

        if len(page_sizes) > 1:
            result.add_warning("MIXED_PAGE_SIZES", f"Páginas de diferentes tamaños: {', '.join(page_sizes)}")

    def _check_fonts(self, pdf, result: PreflightResult):
        fonts_info = {"embedded": [], "not_embedded": [], "subset": []}

        try:
            for i, page in enumerate(pdf.pages, start=1):
                resources = page.get("/Resources", {})
                fonts = resources.get("/Font", {})

                for font_name, font_ref in fonts.items():
                    try:
                        font = font_ref
                        if isinstance(font_ref, pikepdf.Object):
                            font = pdf.get_object(font_ref.objgen) if hasattr(font_ref, 'objgen') else font_ref

                        base_font = str(font.get("/BaseFont", font_name)) if "/BaseFont" in font else str(font_name)
                        base_font = base_font.replace("/", "")

                        is_embedded = False
                        is_subset = False

                        if "/FontDescriptor" in font:
                            descriptor = font["/FontDescriptor"]
                            is_embedded = any(key in descriptor for key in ["/FontFile", "/FontFile2", "/FontFile3"])

                        if "+" in base_font and len(base_font.split("+")[0]) == 6:
                            is_subset = True
                            is_embedded = True

                        if is_subset and base_font not in fonts_info["subset"]:
                            fonts_info["subset"].append(base_font)
                        elif is_embedded and base_font not in fonts_info["embedded"]:
                            fonts_info["embedded"].append(base_font)
                        elif not is_embedded and base_font not in fonts_info["not_embedded"]:
                            fonts_info["not_embedded"].append(base_font)
                    except:
                        continue
        except Exception as e:
            print(f"Error al verificar fuentes: {e}")

        result.summary["fonts"] = fonts_info

        if fonts_info["not_embedded"]:
            result.add_error(
                "FONTS_NOT_EMBEDDED",
                f"Fuentes no embebidas: {', '.join(fonts_info['not_embedded'])}",
                details={"fonts": fonts_info["not_embedded"]}
            )
        else:
            total = len(fonts_info["embedded"]) + len(fonts_info["subset"])
            if total > 0:
                result.add_info("FONTS_EMBEDDED", f"Todas las fuentes embebidas ({total} fuente(s))")

    def _check_color_spaces(self, pdf, result: PreflightResult):
        color_spaces = set()
        rgb_pages = []
        spot_colors = []

        try:
            for i, page in enumerate(pdf.pages, start=1):
                resources = page.get("/Resources", {})
                cs_dict = resources.get("/ColorSpace", {})

                for cs_name, cs_value in cs_dict.items():
                    if isinstance(cs_value, pikepdf.Array):
                        cs_type = str(cs_value[0]) if len(cs_value) > 0 else ""
                        if "DeviceRGB" in cs_type or "CalRGB" in cs_type:
                            color_spaces.add("RGB")
                            if i not in rgb_pages:
                                rgb_pages.append(i)
                        elif "DeviceCMYK" in cs_type or "CalCMYK" in cs_type:
                            color_spaces.add("CMYK")
                        elif "DeviceGray" in cs_type or "CalGray" in cs_type:
                            color_spaces.add("Grayscale")
                        elif "Separation" in cs_type:
                            color_spaces.add("Spot")
                            if len(cs_value) > 1:
                                spot_name = str(cs_value[1]).replace("/", "")
                                if spot_name not in spot_colors:
                                    spot_colors.append(spot_name)
                        elif "ICCBased" in cs_type:
                            color_spaces.add("ICC")
                    else:
                        cs_str = str(cs_value).lower()
                        if "rgb" in cs_str:
                            color_spaces.add("RGB")
                            if i not in rgb_pages:
                                rgb_pages.append(i)
                        elif "cmyk" in cs_str:
                            color_spaces.add("CMYK")
                        elif "gray" in cs_str:
                            color_spaces.add("Grayscale")
        except Exception as e:
            print(f"Error al verificar colores: {e}")

        result.summary["color_spaces"] = list(color_spaces)
        result.summary["spot_colors"] = spot_colors

        if "RGB" in color_spaces:
            result.add_warning("RGB_COLOR_SPACE", f"RGB detectado en página(s): {', '.join(map(str, rgb_pages))}. Se recomienda CMYK.", details={"pages": rgb_pages})
        if spot_colors:
            result.add_info("SPOT_COLORS", f"Tintas planas: {', '.join(spot_colors)}", details={"colors": spot_colors})
        if "CMYK" in color_spaces:
            result.add_info("CMYK_COLOR_SPACE", "El documento usa CMYK")

    def _check_transparency(self, pdf, result: PreflightResult):
        has_transparency = False
        transparency_pages = []

        try:
            for i, page in enumerate(pdf.pages, start=1):
                if "/Group" in page:
                    group = page["/Group"]
                    if "/S" in group and str(group["/S"]) == "/Transparency":
                        has_transparency = True
                        transparency_pages.append(i)

                resources = page.get("/Resources", {})
                ext_gstate = resources.get("/ExtGState", {})
                for gs_name, gs_ref in ext_gstate.items():
                    try:
                        gs = gs_ref
                        if "/CA" in gs or "/ca" in gs:
                            ca_value = float(gs.get("/CA", 1.0)) if "/CA" in gs else 1.0
                            ca_fill = float(gs.get("/ca", 1.0)) if "/ca" in gs else 1.0
                            if ca_value < 1.0 or ca_fill < 1.0:
                                if i not in transparency_pages:
                                    has_transparency = True
                                    transparency_pages.append(i)
                    except:
                        continue
        except Exception as e:
            print(f"Error al verificar transparencias: {e}")

        result.summary["has_transparency"] = has_transparency
        if has_transparency:
            result.add_info("TRANSPARENCY_DETECTED", f"Transparencias en página(s): {', '.join(map(str, transparency_pages))}", details={"pages": transparency_pages})

    def _check_images(self, pdf, result: PreflightResult, min_image_dpi: int):
        low_res_images = []

        try:
            for i, page in enumerate(pdf.pages, start=1):
                resources = page.get("/Resources", {})
                xobjects = resources.get("/XObject", {})
                images_info = {}

                for name, xobj in xobjects.items():
                    if xobj.get("/Subtype") == "/Image":
                        try:
                            width = int(xobj.get("/Width", 0))
                            height = int(xobj.get("/Height", 0))
                            images_info[str(name)] = (width, height)
                        except:
                            pass

                if not images_info:
                    continue

                try:
                    ctm_stack = [[1, 0, 0, 1, 0, 0]]
                    instructions = pikepdf.parse_content_stream(page)

                    for operands, operator in instructions:
                        op = str(operator)
                        if op == "q":
                            ctm_stack.append(list(ctm_stack[-1]))
                        elif op == "Q":
                            if len(ctm_stack) > 1:
                                ctm_stack.pop()
                        elif op == "cm":
                            try:
                                a, b, c, d, e, f = [float(x) for x in operands]
                                cur = ctm_stack[-1]
                                new_a = a * cur[0] + b * cur[2]
                                new_b = a * cur[1] + b * cur[3]
                                new_c = c * cur[0] + d * cur[2]
                                new_d = c * cur[1] + d * cur[3]
                                new_e = e * cur[0] + f * cur[2] + cur[4]
                                new_f = e * cur[1] + f * cur[3] + cur[5]
                                ctm_stack[-1] = [new_a, new_b, new_c, new_d, new_e, new_f]
                            except:
                                pass
                        elif op == "Do":
                            xobj_name = str(operands[0])
                            if xobj_name in images_info:
                                width, height = images_info[xobj_name]
                                if width > 0 and height > 0:
                                    ctm = ctm_stack[-1]
                                    scale_x = math.hypot(ctm[0], ctm[1])
                                    scale_y = math.hypot(ctm[2], ctm[3])
                                    if scale_x == 0: scale_x = 1
                                    if scale_y == 0: scale_y = 1

                                    dpi_x = width / (scale_x / 72.0)
                                    dpi_y = height / (scale_y / 72.0)
                                    effective_dpi = min(dpi_x, dpi_y)

                                    if effective_dpi < min_image_dpi:
                                        low_res_images.append({
                                            "page": i, "image": xobj_name,
                                            "dpi": round(effective_dpi), "dims": f"{width}x{height}"
                                        })
                except:
                    pass
        except Exception as e:
            print(f"Error analizando imágenes: {e}")

        if low_res_images:
            pages_affected = sorted(list(set(item["page"] for item in low_res_images)))
            min_dpi_found = min(item["dpi"] for item in low_res_images)
            result.add_warning(
                "LOW_RES_IMAGES",
                f"Imágenes de baja resolución (mín {min_dpi_found} PPP) en página(s): {', '.join(map(str, pages_affected))}. Recomendado > {min_image_dpi} PPP.",
                details={"images": low_res_images}
            )

    def _check_hairlines(self, pdf, result: PreflightResult, min_line_width_pt: float):
        hairline_issues = []

        try:
            for i, page in enumerate(pdf.pages, start=1):
                try:
                    ctm_stack = [[1, 0, 0, 1, 0, 0]]
                    instructions = pikepdf.parse_content_stream(page)

                    for operands, operator in instructions:
                        op = str(operator)
                        if op == "q":
                            ctm_stack.append(list(ctm_stack[-1]))
                        elif op == "Q":
                            if len(ctm_stack) > 1: ctm_stack.pop()
                        elif op == "cm":
                            try:
                                a, b, c, d, e, f = [float(x) for x in operands]
                                cur = ctm_stack[-1]
                                ctm_stack[-1] = [
                                    a * cur[0] + b * cur[2], a * cur[1] + b * cur[3],
                                    c * cur[0] + d * cur[2], c * cur[1] + d * cur[3],
                                    e * cur[0] + f * cur[2] + cur[4], e * cur[1] + f * cur[3] + cur[5]
                                ]
                            except: pass
                        elif op == "w":
                            try:
                                nominal_width = float(operands[0])
                                ctm = ctm_stack[-1]
                                scale = (math.hypot(ctm[0], ctm[1]) + math.hypot(ctm[2], ctm[3])) / 2
                                if scale == 0: scale = 1
                                effective_width = nominal_width * scale

                                if 0 <= effective_width < min_line_width_pt:
                                    if not any(iss['page'] == i for iss in hairline_issues):
                                        hairline_issues.append({"page": i, "width": round(effective_width, 3)})
                            except:
                                pass
                except:
                    pass
        except Exception as e:
            print(f"Error verificando hairlines: {e}")

        if hairline_issues:
            pages = sorted([h["page"] for h in hairline_issues])
            result.add_warning(
                "HAIRLINES_DETECTED",
                f"Líneas muy finas detectadas en página(s): {', '.join(map(str, pages))}",
                details={"hairlines": hairline_issues}
            )

    def _analyze_with_pypdf2(self, pdf_path: Path, result: PreflightResult):
        try:
            with open(pdf_path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)

                if reader.is_encrypted:
                    result.add_error("PDF_ENCRYPTED", "El PDF está encriptado.")
                    return

                if reader.metadata:
                    metadata = {}
                    for key, value in reader.metadata.items():
                        try:
                            clean_key = key[1:] if key.startswith('/') else key
                            metadata[clean_key] = str(value) if value else None
                        except:
                            continue
                    if metadata:
                        result.summary["metadata"] = metadata
                        creator = metadata.get("Creator", "")
                        producer = metadata.get("Producer", "")
                        if creator or producer:
                            result.add_info("PDF_CREATOR", f"Creado con: {creator or producer}",
                                            details={"creator": creator, "producer": producer})

        except PyPDF2.errors.PdfReadError as e:
            result.add_error("PDF_READ_ERROR", f"Error al leer el PDF: {str(e)}")
        except Exception as e:
            print(f"Error en PyPDF2: {e}")


# Instancia global
pdf_preflight_service = PdfPreflightService()
