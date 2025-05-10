"""
Email utility for sending emails via SMTP.
"""

import logging
import smtplib
import ssl
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

async def send_email(
    recipients: List[str],
    subject: str,
    html_content: str,
    text_content: Optional[str] = None,
    cc: Optional[List[str]] = None,
    bcc: Optional[List[str]] = None,
) -> bool:
    """
    Send an email to the given recipients using the configured SMTP server.
    
    Args:
        recipients: List of email addresses to send to
        subject: Email subject
        html_content: HTML content of the email
        text_content: Plain text content of the email (optional)
        cc: List of CC email addresses (optional)
        bcc: List of BCC email addresses (optional)
        
    Returns:
        True if the email was sent successfully, False otherwise
    """
    # Skip if SMTP settings are not configured
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning(
            "Email sending skipped: SMTP settings not configured. "
            "Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in your environment variables."
        )
        return False
    
    # Create message
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
    message["To"] = ", ".join(recipients)
    
    # Add CC if provided
    if cc:
        message["Cc"] = ", ".join(cc)
        
    # Add plain text and HTML parts
    if text_content:
        message.attach(MIMEText(text_content, "plain"))
    message.attach(MIMEText(html_content, "html"))
    
    try:
        # All recipients, including CC and BCC
        all_recipients = recipients.copy()
        if cc:
            all_recipients.extend(cc)
        if bcc:
            all_recipients.extend(bcc)
            
        # Create SMTP connection
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            if settings.SMTP_TLS:
                server.starttls(context=context)
                server.ehlo()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(
                settings.EMAILS_FROM_EMAIL, 
                all_recipients,
                message.as_string()
            )
        logger.info(f"Email sent to {len(all_recipients)} recipient(s) with subject: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return False

def get_password_reset_email(username: str, token: str, reset_url: str) -> Dict[str, str]:
    """
    Generate the HTML and text content for a password reset email.
    
    Args:
        username: User's name
        token: Reset token
        reset_url: URL for password reset
        
    Returns:
        Dictionary with 'html' and 'text' keys
    """
    html = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background-color: #38a169; color: white; padding: 10px 20px; text-align: center; }}
            .content {{ padding: 20px; border: 1px solid #ddd; }}
            .button {{ display: inline-block; padding: 10px 20px; background-color: #38a169; color: white; 
                       text-decoration: none; border-radius: 5px; margin: 20px 0; }}
            .footer {{ text-align: center; margin-top: 20px; font-size: 12px; color: #777; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>CVSU Alumni System</h1>
            </div>
            <div class="content">
                <h2>Password Reset Request</h2>
                <p>Hello {username},</p>
                <p>We received a request to reset your password for your CVSU Alumni System account. 
                   To reset your password, click the button below:</p>
                <p><a href="{reset_url}" class="button">Reset Your Password</a></p>
                <p>If you're having trouble with the button above, copy and paste the URL below into your web browser:</p>
                <p>{reset_url}</p>
                <p>If you didn't request a password reset, you can safely ignore this email. 
                   Your password will not be changed.</p>
                <p>The password reset link will expire in 1 hour.</p>
                <p>Best regards,<br/>CVSU Alumni System Team</p>
            </div>
            <div class="footer">
                <p>This is an automated email. Please do not reply to this message.</p>
                <p>&copy; {datetime.now().year} CVSU Carmona. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text = f"""
    CVSU Alumni System - Password Reset Request
    
    Hello {username},
    
    We received a request to reset your password for your CVSU Alumni System account.
    To reset your password, please visit the following link:
    
    {reset_url}
    
    If you didn't request a password reset, you can safely ignore this email.
    Your password will not be changed.
    
    The password reset link will expire in 1 hour.
    
    Best regards,
    CVSU Alumni System Team
    
    This is an automated email. Please do not reply to this message.
    """
    
    return {
        "html": html,
        "text": text
    }

def get_mfa_verification_email(username: str, verification_code: str) -> Dict[str, str]:
    """
    Generate email content for MFA verification
    """
    html_content = f"""
    <html>
    <body>
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #38a89d; padding: 20px; text-align: center; color: white;">
                <h1>CVSU Alumni Authentication Code</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
                <p>Hello {username},</p>
                <p>We received a request to access your CVSU Alumni account. Use the verification code below to complete the login process:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <div style="font-size: 24px; font-weight: bold; letter-spacing: 8px; padding: 15px; background-color: #f5f5f5; border-radius: 5px; display: inline-block;">
                        {verification_code}
                    </div>
                </div>
                <p>This code will expire in 10 minutes. If you didn't request this code, please ignore this email or contact support if you believe your account security may be at risk.</p>
                <p>Best regards,<br>CVSU Alumni Portal Team</p>
            </div>
            <div style="padding: 10px; background-color: #f5f5f5; text-align: center; font-size: 12px; color: #666;">
                <p>This is an automated message, please do not reply directly to this email.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_content = f"""
    CVSU Alumni Authentication Code
    
    Hello {username},
    
    We received a request to access your CVSU Alumni account. Use the verification code below to complete the login process:
    
    {verification_code}
    
    This code will expire in 10 minutes. If you didn't request this code, please ignore this email or contact support if you believe your account security may be at risk.
    
    Best regards,
    CVSU Alumni Portal Team
    """
    
    return {
        "html": html_content,
        "text": text_content
    } 