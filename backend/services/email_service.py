"""
Servicio de email para envío de invitaciones con magic link.
Patrón MIS email_service.py simplificado (solo SMTP).
"""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime
from typing import Optional

from config import settings


class EmailService:
    """Servicio de email SMTP para invitaciones"""

    def __init__(self):
        pass

    @property
    def is_configured(self) -> bool:
        """Verifica si el SMTP está configurado"""
        return bool(settings.SMTP_USERNAME and settings.SMTP_PASSWORD)

    def _create_connection(self):
        """Crea conexión SMTP"""
        server = smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT)
        if settings.SMTP_USE_TLS:
            server.starttls()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        return server

    def send_invitation(
        self,
        to_email: str,
        to_name: str,
        magic_url: str,
        project_name: Optional[str] = None,
        custom_message: Optional[str] = None
    ) -> bool:
        """
        Envía email de invitación con magic link.
        
        Returns:
            True si se envió correctamente
        """
        if not self.is_configured:
            print("⚠️ Email no configurado (SMTP_USERNAME/SMTP_PASSWORD vacíos)")
            return False

        try:
            subject = f"📄 Invitación: {project_name or 'Revisión de PDF'}"
            html_body = self._create_invitation_body(
                to_name=to_name,
                magic_url=magic_url,
                project_name=project_name,
                custom_message=custom_message
            )

            msg = MIMEMultipart()
            msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_ADDRESS or settings.SMTP_USERNAME}>"
            msg["To"] = f"{to_name} <{to_email}>" if to_name else to_email
            msg["Subject"] = subject
            msg.attach(MIMEText(html_body, "html", "utf-8"))

            server = self._create_connection()
            server.send_message(msg)
            server.quit()

            print(f"✅ Email de invitación enviado a {to_email}")
            return True

        except Exception as e:
            print(f"❌ Error enviando email: {e}")
            return False

    def send_test_email(self, to_email: str) -> bool:
        """Envía un email de prueba"""
        if not self.is_configured:
            return False

        try:
            msg = MIMEMultipart()
            msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_ADDRESS or settings.SMTP_USERNAME}>"
            msg["To"] = to_email
            msg["Subject"] = "🧪 Test - Remote PDF Review"
            msg.attach(MIMEText(
                "<h2>✅ Email de prueba</h2><p>El servicio de correo de Remote está funcionando correctamente.</p>",
                "html", "utf-8"
            ))

            server = self._create_connection()
            server.send_message(msg)
            server.quit()
            return True

        except Exception as e:
            print(f"❌ Error en email de prueba: {e}")
            return False

    def _create_invitation_body(
        self,
        to_name: str,
        magic_url: str,
        project_name: Optional[str] = None,
        custom_message: Optional[str] = None
    ) -> str:
        """Crea HTML del email de invitación"""

        project_section = ""
        if project_name:
            project_section = f"""
            <div style="background-color: #f0f4ff; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #6b7280;">Proyecto</p>
                <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: 600; color: #1e3a5f;">{project_name}</p>
            </div>
            """

        custom_section = ""
        if custom_message:
            custom_section = f"""
            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; font-size: 14px; color: #92400e;">{custom_message}</p>
            </div>
            """

        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #374151; margin: 0; padding: 0; background-color: #f3f4f6;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background-color: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);">
                    <!-- Header -->
                    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 30px; text-align: center;">
                        <span style="font-size: 48px;">📄</span>
                        <h1 style="color: white; margin: 10px 0 0 0; font-size: 24px; font-weight: 700;">Remote PDF Review</h1>
                        <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px;">Sistema de revisión de artes finales</p>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding: 30px;">
                        <p style="font-size: 16px; color: #1f2937;">Hola <strong>{to_name}</strong>,</p>
                        
                        <p style="font-size: 15px; color: #4b5563;">
                            Se le ha invitado a acceder al sistema de revisión de PDF. 
                            Pulse el botón para acceder directamente a su panel:
                        </p>

                        {project_section}
                        {custom_section}
                        
                        <!-- CTA Button -->
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="{magic_url}" 
                               style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(37,99,235,0.4);">
                                Acceder al Panel
                            </a>
                        </div>
                        
                        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                            Si el botón no funciona, copie y pegue este enlace en su navegador:<br>
                            <a href="{magic_url}" style="color: #2563eb; word-break: break-all;">{magic_url}</a>
                        </p>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                            Este es un mensaje automático. Por favor, no responda a este correo.
                        </p>
                        <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">
                            © {datetime.now().year} Remote PDF Review
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        return html


# Instancia global
email_service = EmailService()
